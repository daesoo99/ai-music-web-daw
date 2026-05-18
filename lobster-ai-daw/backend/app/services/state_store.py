import asyncio
from typing import Dict, Any, List, Optional

class StateStore:
    """Thread-safe, high-performance in-memory repository for active job statuses
    and generated block metadata, perfect for single-user local DAW operations.
    """
    def __init__(self):
        self.jobs: Dict[str, Dict[str, Any]] = {}
        self.blocks: Dict[str, Dict[str, Any]] = {}
        self.lock = asyncio.Lock()

    async def save_job(self, job_id: str, job_data: Dict[str, Any]):
        """Save or update job status and metadata."""
        async with self.lock:
            self.jobs[job_id] = job_data

    async def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve job details by its ID."""
        async with self.lock:
            return self.jobs.get(job_id)

    async def save_block(self, block_id: str, block_data: Dict[str, Any]):
        """Save or update block metadata."""
        async with self.lock:
            self.blocks[block_id] = block_data

    async def get_block(self, block_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve block metadata by its ID."""
        async with self.lock:
            return self.blocks.get(block_id)

    async def get_all_blocks(self) -> List[Dict[str, Any]]:
        """List all blocks in the store."""
        async with self.lock:
            return list(self.blocks.values())

    async def get_project_blocks(self, project_id: str) -> List[Dict[str, Any]]:
        """List all blocks belonging to a specific project."""
        async with self.lock:
            return [b for b in self.blocks.values() if b.get("project_id") == project_id]
