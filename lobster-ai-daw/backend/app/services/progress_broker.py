import asyncio
from typing import Dict, Set, Any
from loguru import logger

class ProgressBroker:
    """Manages real-time message distribution (fan-out) from background composition jobs
    to connected WebSocket clients with a drop-oldest bounded-queue policy.
    """
    def __init__(self, queue_maxsize: int = 100):
        self.queue_maxsize = queue_maxsize
        # Map of job_id -> Set of asyncio.Queue
        self.subscribers: Dict[str, Set[asyncio.Queue]] = {}
        self.lock = asyncio.Lock()

    async def subscribe(self, job_id: str) -> asyncio.Queue:
        """Subscribe a new client to a specific job_id, returning their message queue."""
        async with self.lock:
            q = asyncio.Queue(maxsize=self.queue_maxsize)
            if job_id not in self.subscribers:
                self.subscribers[job_id] = set()
            self.subscribers[job_id].add(q)
            logger.info(f"[ProgressBroker] Client subscribed to job: {job_id} (Total: {len(self.subscribers[job_id])})")
            return q

    async def unsubscribe(self, job_id: str, queue: asyncio.Queue):
        """Unsubscribe a client queue from a job_id."""
        async with self.lock:
            if job_id in self.subscribers:
                self.subscribers[job_id].discard(queue)
                if not self.subscribers[job_id]:
                    del self.subscribers[job_id]
                logger.info(f"[ProgressBroker] Client unsubscribed from job: {job_id}")

    async def publish(self, job_id: str, event: Dict[str, Any]):
        """Publish a progress event to all subscribers of a job_id.
        
        Ensures a strict drop-oldest policy if a subscriber queue is full,
        guaranteeing the publisher is never blocked.
        """
        async with self.lock:
            queues = self.subscribers.get(job_id, set())
            if not queues:
                return

            for q in list(queues):
                if q.full():
                    try:
                        # Drop oldest event to make room
                        q.get_nowait()
                        logger.warning(f"[ProgressBroker] Queue full for job {job_id}. Dropped oldest event.")
                    except asyncio.QueueEmpty:
                        pass
                try:
                    q.put_nowait(event)
                except Exception as e:
                    logger.error(f"[ProgressBroker] Failed to publish event to subscriber: {e}")
