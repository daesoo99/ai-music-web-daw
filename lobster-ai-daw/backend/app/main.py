import asyncio
import os
import time
from contextlib import asynccontextmanager, suppress
from typing import Iterable

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.config import settings
from app.services.acestep_client import ACEStepClient
from app.services.block_orchestrator import BlockOrchestrator
from app.services.progress_broker import ProgressBroker
from app.services.state_store import StateStore
from app.services.midi_transcriber import _lazy_load_basic_pitch


# Initialize the services
acestep_client = ACEStepClient(base_url=settings.ACESTEP_API_URL)
block_orchestrator = BlockOrchestrator(
    client=acestep_client,
    base_data_dir=settings.DATA_DIR,
)
progress_broker = ProgressBroker()
state_store = StateStore()


CACHE_PURGE_INTERVAL_SECONDS = 24 * 60 * 60
CACHE_FILE_MAX_AGE_SECONDS = 24 * 60 * 60

TEMP_AUDIO_EXTENSIONS = {
    ".wav",
    ".mp3",
    ".mid",
    ".midi",
    ".flac",
    ".ogg",
    ".m4a",
}


def _is_temp_audio_file(filename: str) -> bool:
    """정제 대상 임시 오디오/미디 파일인지 확인."""
    _, ext = os.path.splitext(filename)
    return ext.lower() in TEMP_AUDIO_EXTENSIONS


def _purge_expired_cache_files_sync(
    directories: Iterable[str],
    max_age_seconds: int,
) -> int:
    """오래된 임시 캐시 파일을 동기적으로 삭제.

    이 함수는 직접 이벤트 루프에서 실행하지 않고,
    asyncio.to_thread()를 통해 별도 스레드에서 실행한다.
    """
    now = time.time()
    removed_count = 0

    for directory in directories:
        if not os.path.isdir(directory):
            logger.warning(f"[CachePurger] Directory does not exist: {directory}")
            continue

        for root, _, files in os.walk(directory):
            for filename in files:
                if not _is_temp_audio_file(filename):
                    continue

                file_path = os.path.join(root, filename)

                try:
                    stat = os.stat(file_path)

                    # mtime: 파일 내용 수정 시간
                    # ctime: Windows에서는 생성 시간, Unix 계열에서는 메타데이터 변경 시간
                    # 둘 중 더 최근 시간을 기준으로 잡아 최근 생성/수정 파일 삭제를 방지한다.
                    last_touched_at = max(stat.st_mtime, stat.st_ctime)
                    age_seconds = now - last_touched_at

                    if age_seconds < max_age_seconds:
                        continue

                    os.remove(file_path)
                    removed_count += 1

                    logger.info(
                        f"[CachePurger] Removed expired cache file: {file_path}"
                    )

                except FileNotFoundError:
                    # 스캔 도중 다른 프로세스가 이미 삭제한 경우
                    continue
                except PermissionError as e:
                    logger.warning(
                        f"[CachePurger] Permission denied while removing "
                        f"'{file_path}': {e}"
                    )
                except OSError as e:
                    logger.warning(
                        f"[CachePurger] Failed to remove cache file "
                        f"'{file_path}': {e}"
                    )

    return removed_count


async def purge_expired_cache_files_once() -> int:
    """오래된 임시 오디오 캐시 파일을 1회 정리."""
    directories = [
        settings.STEMS_DIR,
        settings.EXPORTS_DIR,
    ]

    return await asyncio.to_thread(
        _purge_expired_cache_files_sync,
        directories,
        CACHE_FILE_MAX_AGE_SECONDS,
    )


async def cache_purger_loop() -> None:
    """24시간 주기로 임시 오디오 캐시 파일을 정리하는 백그라운드 루프."""
    logger.info("[CachePurger] Background cache purger started")

    while True:
        try:
            removed_count = await purge_expired_cache_files_once()

            if removed_count > 0:
                logger.info(
                    f"[CachePurger] Removed {removed_count} expired cache files"
                )
            else:
                logger.info("[CachePurger] No expired cache files found")

        except asyncio.CancelledError:
            logger.info("[CachePurger] Background cache purger cancelled")
            raise
        except Exception as e:
            logger.warning(f"[CachePurger] Unexpected error during purge: {e}")

        try:
            await asyncio.sleep(CACHE_PURGE_INTERVAL_SECONDS)
        except asyncio.CancelledError:
            logger.info("[CachePurger] Background cache purger stopped")
            raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure local database directories exist
    os.makedirs(settings.PROJECTS_DIR, exist_ok=True)
    os.makedirs(settings.STEMS_DIR, exist_ok=True)
    os.makedirs(settings.EXPORTS_DIR, exist_ok=True)
    os.makedirs(os.path.join(settings.DATA_DIR, "projects"), exist_ok=True)

    # Touch .gitkeep files to keep folder templates tracked in git
    for directory in [
        settings.PROJECTS_DIR,
        settings.STEMS_DIR,
        settings.EXPORTS_DIR,
    ]:
        gitkeep_path = os.path.join(directory, ".gitkeep")
        with open(gitkeep_path, "a", encoding="utf-8"):
            pass

    # Start service clients
    acestep_client.start()

    loop = asyncio.get_running_loop()
    loop.run_in_executor(None, _lazy_load_basic_pitch)

    cache_purger_task = asyncio.create_task(
        cache_purger_loop(),
        name="cache-purger",
    )

    try:
        yield
    finally:
        # Stop cache purger gracefully
        cache_purger_task.cancel()

        with suppress(asyncio.CancelledError):
            await cache_purger_task

        # Close service clients on shutdown
        await acestep_client.close()


app = FastAPI(
    title="Lobster AI DAW FastAPI Wrapper",
    description=(
        "Orchestrates audio generations, WebSocket progress channels, "
        "and project metadata."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Store singletons on app state for route access
app.state.acestep_client = acestep_client
app.state.block_orchestrator = block_orchestrator
app.state.progress_broker = progress_broker
app.state.state_store = state_store

# CORS configuration for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import route handlers
from app.api.routes import audio, blocks, midi, projects, repaint, ws

# Include routers
app.include_router(blocks.router, prefix="/api/blocks", tags=["Blocks"])
app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
app.include_router(audio.router, prefix="/api/audio", tags=["Audio"])
app.include_router(repaint.router, prefix="/api/repaint", tags=["Repaint"])
app.include_router(ws.router, prefix="/api/ws", tags=["WebSocket"])
app.include_router(midi.router, prefix="/api", tags=["MIDI"])


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "acestep_api_url": settings.ACESTEP_API_URL,
        "wrapper_version": "1.0.0",
    }
