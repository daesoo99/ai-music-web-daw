import json
import os
import re
from typing import List, Optional, TypedDict

import anyio
from fastapi import APIRouter, HTTPException, Depends
from app.api.deps import get_state_store
from app.services.state_store import StateStore
from pathlib import Path
from loguru import logger
from pydantic import BaseModel

from app.config import settings

router = APIRouter()


class TrackState(BaseModel):
    trackId: str
    name: str
    instrument: Optional[str] = None


class BlockState(BaseModel):
    blockId: str
    trackId: str
    audioUrl: str
    timelineStartSeconds: float
    durationSeconds: float
    prompt: Optional[str] = None


class ProjectState(BaseModel):
    tracks: List[TrackState]
    blocks: List[BlockState]


class ArchiveRequest(BaseModel):
    archiveName: str
    state: ProjectState


class ArchiveInfo(TypedDict):
    name: str
    createdAt: int
    updatedAt: int


def _state_path(project_id: str) -> str:
    """프로젝트 state.json의 디스크 경로를 반환."""
    return os.path.join(settings.DATA_DIR, "projects", project_id, "state.json")


def _archives_dir(project_id: str) -> str:
    """프로젝트 아카이브 디렉토리 경로 반환."""
    return os.path.join(settings.DATA_DIR, "projects", project_id, "archives")


def _sanitize_filename(name: str) -> str:
    """안전한 파일 이름으로 정제.

    허용:
    - 한글
    - 영문
    - 숫자
    - 공백
    - 하이픈
    - 언더바
    """
    sanitized = re.sub(r"[^\w\s\-\_가-힣]", "", name)
    return sanitized.strip()


def _validate_archive_name(raw_name: str) -> str:
    """아카이브 이름을 정제하고, 유효하지 않으면 400 예외 발생."""
    safe_name = _sanitize_filename(raw_name)

    if not safe_name:
        raise HTTPException(
            status_code=400,
            detail="Invalid archive name - contains only disallowed characters",
        )

    return safe_name


def _scan_archives_sync(dir_path: str) -> List[ArchiveInfo]:
    """아카이브 디렉토리를 동기적으로 스캔.

    이 함수는 FastAPI 이벤트 루프에서 직접 실행하지 않고,
    anyio.to_thread.run_sync()를 통해 워커 스레드에서 실행한다.
    """
    if not os.path.isdir(dir_path):
        return []

    archives: List[ArchiveInfo] = []

    with os.scandir(dir_path) as entries:
        for entry in entries:
            if not entry.is_file():
                continue

            filename = entry.name
            if not filename.endswith(".json"):
                continue

            stat = entry.stat()
            archive_name = filename[:-5]

            archives.append(
                {
                    "name": archive_name,
                    "createdAt": int(stat.st_ctime * 1000),
                    "updatedAt": int(stat.st_mtime * 1000),
                }
            )

    archives.sort(key=lambda item: item["updatedAt"], reverse=True)
    return archives


@router.get("/")
async def list_projects():
    """프로젝트 목록 반환. 현재는 디스크에 state.json이 존재하는 폴더들을 스캔."""
    projects_dir = os.path.join(settings.DATA_DIR, "projects")
    if not os.path.isdir(projects_dir):
        return {"projects": []}

    result = []
    for name in os.listdir(projects_dir):
        project_dir = os.path.join(projects_dir, name)
        state_file = os.path.join(project_dir, "state.json")
        if os.path.isdir(project_dir) and os.path.isfile(state_file):
            result.append({"project_id": name})

    return {"projects": result}


@router.get("/{project_id}/state")
async def get_project_state(project_id: str):
    """프로젝트 상태를 디스크에서 읽어 반환.

    없으면 빈 프로젝트를 반환한다.
    """
    path = _state_path(project_id)

    if not os.path.isfile(path):
        logger.info(
            f"[Projects] No saved state for '{project_id}', returning empty project"
        )
        return {"tracks": [], "blocks": []}

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        logger.info(
            f"[Projects] Loaded state for '{project_id}': "
            f"{len(data.get('tracks', []))} tracks, "
            f"{len(data.get('blocks', []))} blocks"
        )
        return data

    except Exception as e:
        logger.error(f"[Projects] Failed to read state for '{project_id}': {e}")
        raise HTTPException(500, f"Failed to read project state: {e}")


@router.put("/{project_id}/state")
async def save_project_state(project_id: str, state: ProjectState):
    """프로젝트 상태를 JSON으로 저장."""
    path = _state_path(project_id)
    os.makedirs(os.path.dirname(path), exist_ok=True)

    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(state.model_dump(), f, ensure_ascii=False, indent=2)

        logger.info(
            f"[Projects] Saved state for '{project_id}': "
            f"{len(state.tracks)} tracks, {len(state.blocks)} blocks"
        )
        return {"ok": True}

    except Exception as e:
        logger.error(f"[Projects] Failed to save state for '{project_id}': {e}")
        raise HTTPException(500, f"Failed to save project state: {e}")


@router.get("/{project_id}/archives")
async def list_project_archives(project_id: str):
    """소중한 명작 아카이브 목록 반환.

    디렉토리 스캔과 파일 stat 조회는 워커 스레드에서 처리하여
    FastAPI 이벤트 루프 블로킹을 줄인다.
    """
    dir_path = _archives_dir(project_id)

    try:
        archives = await anyio.to_thread.run_sync(_scan_archives_sync, dir_path)
        return {"archives": archives}

    except Exception as e:
        logger.error(f"[Projects] Failed to list archives for '{project_id}': {e}")
        raise HTTPException(500, f"Failed to list archives: {e}")


@router.get("/{project_id}/archives/{archive_name}")
async def get_project_archive(project_id: str, archive_name: str):
    """특정 명작 아카이브의 프로젝트 상태 반환."""
    safe_name = _validate_archive_name(archive_name)
    path = os.path.join(_archives_dir(project_id), f"{safe_name}.json")

    if not os.path.isfile(path):
        raise HTTPException(404, f"Archive '{archive_name}' not found")

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        logger.info(f"[Projects] Loaded archive '{safe_name}' for '{project_id}'")
        return data

    except Exception as e:
        logger.error(f"[Projects] Failed to read archive '{safe_name}': {e}")
        raise HTTPException(500, f"Failed to read archive: {e}")


@router.post("/{project_id}/archives")
async def save_project_archive(project_id: str, req: ArchiveRequest):
    """프로젝트 상태를 명작 아카이브로 영구 보존 저장."""
    safe_name = _validate_archive_name(req.archiveName)

    dir_path = _archives_dir(project_id)
    os.makedirs(dir_path, exist_ok=True)

    path = os.path.join(dir_path, f"{safe_name}.json")

    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(req.state.model_dump(), f, ensure_ascii=False, indent=2)

        logger.info(f"[Projects] Archive '{safe_name}' saved for '{project_id}'")
        return {"ok": True, "name": safe_name}

    except Exception as e:
        logger.error(f"[Projects] Failed to save archive '{safe_name}': {e}")
        raise HTTPException(500, f"Failed to save archive: {e}")


@router.delete("/{project_id}/archives/{archive_name}")
async def delete_project_archive(project_id: str, archive_name: str):
    """특정 명작 아카이브 삭제."""
    safe_name = _validate_archive_name(archive_name)
    path = os.path.join(_archives_dir(project_id), f"{safe_name}.json")

    if not os.path.isfile(path):
        raise HTTPException(404, f"Archive '{archive_name}' not found")

    try:
        os.remove(path)

        logger.info(f"[Projects] Archive '{safe_name}' deleted for '{project_id}'")
        return {"ok": True}

    except Exception as e:
        logger.error(f"[Projects] Failed to delete archive '{safe_name}': {e}")
        raise HTTPException(500, f"Failed to delete archive: {e}")

@router.post("/{project_id}/reset")
async def reset_project(
    project_id: str,
    state_store: StateStore = Depends(get_state_store)
):
    
    async with state_store.lock:
        blocks_to_delete = [
            bid for bid, b in state_store.blocks.items() 
            if b.get("project_id") == project_id
        ]
        for bid in blocks_to_delete:
            state_store.blocks.pop(bid, None)
            state_store.midis.pop(bid, None)
            
    path = _state_path(project_id)
    if os.path.isfile(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            default_ids = {'piano', 'strings', 'drums', 'bass'}
            tracks = data.get("tracks", [])
            default_tracks = [t for t in tracks if t.get("trackId") in default_ids]
            
            if not default_tracks:
                default_tracks = [
                    {"trackId": "piano", "name": "Grand Piano", "instrument": "piano"},
                    {"trackId": "strings", "name": "Strings Ensemble", "instrument": "strings"},
                    {"trackId": "drums", "name": "Acoustic Drums", "instrument": "drums"},
                    {"trackId": "bass", "name": "Bass Guitar", "instrument": "bass"}
                ]
            
            new_state = {
                "tracks": default_tracks,
                "blocks": []
            }
            with open(path, "w", encoding="utf-8") as f:
                json.dump(new_state, f, ensure_ascii=False, indent=2)
                
            logger.info(f"[Projects] Project '{project_id}' successfully reset to default tracks.")
        except Exception as e:
            logger.error(f"[Projects] Failed to reset project state file: {e}")
            raise HTTPException(500, detail=f"?꾨줈?앺듃 ?곹깭 珥덇린???ㅽ뙣: {str(e)}")

    blocks_dir = Path(settings.DATA_DIR) / "projects" / project_id / "blocks"
    if blocks_dir.exists():
        for f in blocks_dir.glob("*.mp3"):
            try:
                f.unlink()
            except Exception as e:
                logger.warning(f"[Projects] Failed to delete file {f}: {e}")
                
    tails_dir = Path(settings.DATA_DIR) / "projects" / project_id / "tails"
    if tails_dir.exists():
        for f in tails_dir.glob("*.wav"):
            try:
                f.unlink()
            except Exception:
                pass

    return {"status": "ok", "message": "?꾨줈?앺듃媛 珥덇린?붾릺?덉뒿?덈떎."}