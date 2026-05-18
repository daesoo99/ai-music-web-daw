import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure local database directories exist
    os.makedirs(settings.PROJECTS_DIR, exist_ok=True)
    os.makedirs(settings.STEMS_DIR, exist_ok=True)
    os.makedirs(settings.EXPORTS_DIR, exist_ok=True)
    
    # Touch .gitkeep files to keep folder templates tracked in git
    for directory in [settings.PROJECTS_DIR, settings.STEMS_DIR, settings.EXPORTS_DIR]:
        with open(os.path.join(directory, ".gitkeep"), "a") as f:
            pass
            
    yield

app = FastAPI(
    title="Lobster AI DAW FastAPI Wrapper",
    description="Orchestrates audio generations, WebSocket progress channels, and project metadata.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Local dev environment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import route handlers
from app.api.routes import blocks, projects, audio, repaint, ws

# Include routers
app.include_router(blocks.router, prefix="/api/blocks", tags=["Blocks"])
app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
app.include_router(audio.router, prefix="/api/audio", tags=["Audio"])
app.include_router(repaint.router, prefix="/api/repaint", tags=["Repaint"])
app.include_router(ws.router, prefix="/api/ws", tags=["WebSocket"])

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "acestep_api_url": settings.ACESTEP_API_URL,
        "wrapper_version": "1.0.0"
    }
