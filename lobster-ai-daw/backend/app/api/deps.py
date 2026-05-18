from fastapi import Request
from app.services.acestep_client import ACEStepClient
from app.services.block_orchestrator import BlockOrchestrator
from app.services.progress_broker import ProgressBroker
from app.services.state_store import StateStore

def get_acestep_client(request: Request) -> ACEStepClient:
    """Retrieve the global ACEStepClient singleton from FastAPI app state."""
    return request.app.state.acestep_client

def get_block_orchestrator(request: Request) -> BlockOrchestrator:
    """Retrieve the global BlockOrchestrator singleton from FastAPI app state."""
    return request.app.state.block_orchestrator

def get_progress_broker(request: Request) -> ProgressBroker:
    """Retrieve the global ProgressBroker singleton from FastAPI app state."""
    return request.app.state.progress_broker

def get_state_store(request: Request) -> StateStore:
    """Retrieve the global StateStore singleton from FastAPI app state."""
    return request.app.state.state_store
