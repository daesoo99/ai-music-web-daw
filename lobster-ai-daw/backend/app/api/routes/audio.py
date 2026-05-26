import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from loguru import logger

router = APIRouter()

BASE_DATA_DIR = "data"

@router.get("/projects/{project_id}/blocks/{block_id}.mp3")
async def get_project_block_audio(project_id: str, block_id: str):
    """Serve composition block audio files securely from data/projects/{project_id}/blocks."""
    physical_path = os.path.join(BASE_DATA_DIR, "projects", project_id, "blocks", f"{block_id}.mp3")
    if not os.path.exists(physical_path):
        logger.warning(f"[AudioRoute] Requested block audio not found: {physical_path}")
        raise HTTPException(status_code=404, detail="Block audio file not found")
        
    return FileResponse(
        path=physical_path,
        media_type="audio/mpeg",
        filename=f"{block_id}.mp3",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )

@router.get("/projects/{project_id}/tails/{block_id}_tail.mp3")
async def get_project_block_tail_audio(project_id: str, block_id: str):
    """Serve block continuation tail audio files securely from data/projects/{project_id}/tails."""
    physical_path = os.path.join(BASE_DATA_DIR, "projects", project_id, "tails", f"{block_id}_tail.mp3")
    if not os.path.exists(physical_path):
        logger.warning(f"[AudioRoute] Requested tail audio not found: {physical_path}")
        raise HTTPException(status_code=404, detail="Tail audio file not found")
        
    return FileResponse(
        path=physical_path,
        media_type="audio/mpeg",
        filename=f"{block_id}_tail.mp3",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )

@router.get("/projects/{project_id}/midi/{block_id}.mid")
async def get_project_block_midi_file(project_id: str, block_id: str):
    """Serve block MIDI files securely from data/projects/{project_id}/midi."""
    physical_path = os.path.join(BASE_DATA_DIR, "projects", project_id, "midi", f"{block_id}.mid")
    if not os.path.exists(physical_path):
        logger.warning(f"[AudioRoute] Requested MIDI file not found: {physical_path}")
        raise HTTPException(status_code=404, detail="MIDI file not found")
        
    return FileResponse(
        path=physical_path,
        media_type="audio/midi",
        filename=f"{block_id}.mid",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )
