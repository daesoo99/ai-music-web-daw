import asyncio
import json
import os
from typing import Any, Callable, Dict, Optional
import httpx
from loguru import logger

class ACEStepError(Exception):
    """Base exception for all ACE-Step client errors."""
    pass

class ACEStepConnectionError(ACEStepError):
    """Raised when communication with Port 8001 fails."""
    pass

class ACEStepTaskError(ACEStepError):
    """Raised when the task fails or is rejected by the server."""
    pass

class ACEStepTimeoutError(ACEStepError):
    """Raised when the task polling exceeds the maximum timeout."""
    pass

class ACEStepClient:
    """FastAPI wrapper service client for communicating with the ACE-Step 8001 AI Engine."""

    def __init__(self, base_url: str = "http://127.0.0.1:8001"):
        self.base_url = base_url
        self.client: Optional[httpx.AsyncClient] = None

    def start(self):
        """Initialize the connection pool client."""
        if not self.client:
            self.client = httpx.AsyncClient(timeout=httpx.Timeout(30.0, read=300.0))
            logger.info(f"[ACEStepClient] Connection pool started for {self.base_url}")

    async def close(self):
        """Cleanly close the connection pool client."""
        if self.client:
            await self.client.aclose()
            self.client = None
            logger.info("[ACEStepClient] Connection pool closed")

    async def check_health(self) -> bool:
        """Check if Port 8001 AI Engine is active and healthy."""
        if not self.client:
            raise RuntimeError("ACEStepClient is not started. Call start() first.")
        try:
            r = await self.client.get(f"{self.base_url}/health", timeout=3.0)
            return r.status_code == 200
        except Exception as e:
            logger.warning(f"[ACEStepClient] Health check failed: {e}")
            return False

    async def release_task(self, payload: Dict[str, Any]) -> str:
        """Release a composition task to the ACE-Step AI Engine.
        
        Returns:
            str: The generated task_id.
        """
        if not self.client:
            raise RuntimeError("ACEStepClient is not started. Call start() first.")
        
        logger.info(f"[ACEStepClient] Submitting composition task. Payload keys: {list(payload.keys())}")
        try:
            r = await self.client.post(
                f"{self.base_url}/release_task",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            if r.status_code != 200:
                raise ACEStepTaskError(f"Server returned HTTP {r.status_code}: {r.text}")
                
            response_data = r.json()
            if response_data.get("code") != 200 or response_data.get("error") is not None:
                err_msg = response_data.get("error", "Unknown error")
                raise ACEStepTaskError(f"Task rejected by engine: {err_msg}")
                
            task_id = response_data["data"]["task_id"]
            logger.info(f"[ACEStepClient] Task successfully submitted. Task ID: {task_id}")
            return task_id
        except httpx.RequestError as e:
            raise ACEStepConnectionError(f"Failed to submit task (network error): {e}")

    async def wait_for_completion(
        self,
        task_id: str,
        progress_callback: Optional[Callable[[float], Any]] = None,
        timeout_sec: float = 300.0,
        poll_interval_sec: float = 3.0
    ) -> str:
        """Poll the /query_result endpoint until the task completes.
        
        Returns:
            str: Relative audio file path returned by the server.
        """
        if not self.client:
            raise RuntimeError("ACEStepClient is not started. Call start() first.")
            
        query_payload = {"task_id_list": [task_id]}
        start_time = asyncio.get_event_loop().time()
        
        logger.info(f"[ACEStepClient] Starting status polling for task {task_id}")
        
        while True:
            elapsed = asyncio.get_event_loop().time() - start_time
            if elapsed > timeout_sec:
                raise ACEStepTimeoutError(f"Generation timed out after {timeout_sec}s")
                
            try:
                r = await self.client.post(
                    f"{self.base_url}/query_result",
                    json=query_payload,
                    headers={"Content-Type": "application/json"}
                )
                
                if r.status_code != 200:
                    logger.warning(f"[ACEStepClient] Polling status returned HTTP {r.status_code}")
                else:
                    res = r.json()
                    task_info = res["data"][0]
                    status = task_info["status"]
                    
                    if status == 1:  # Succeeded
                        logger.info(f"[ACEStepClient] Task {task_id} succeeded!")
                        # Parse the inner JSON string from the "result" field
                        result_list = json.loads(task_info["result"])
                        audio_path = result_list[0]["file"]
                        
                        # Set to 1.0 on completion
                        if progress_callback:
                            try:
                                progress_callback(1.0)
                            except Exception as cb_err:
                                logger.error(f"[ACEStepClient] Progress callback exception (ignored): {cb_err}")
                                
                        return audio_path
                        
                    elif status == 2:  # Failed
                        raise ACEStepTaskError(f"Task {task_id} failed on the AI Engine server side.")
                        
            except httpx.RequestError as e:
                logger.warning(f"[ACEStepClient] Connection issue during status polling: {e}")
                
            # UX Heuristic progress updates: cap at 0.95 until completion
            if progress_callback:
                # Estimate progress assuming a standard generation takes ~25s
                est_progress = min(0.95, elapsed / 25.0)
                try:
                    progress_callback(est_progress)
                except Exception as cb_err:
                    logger.error(f"[ACEStepClient] Progress callback exception (ignored): {cb_err}")
                    
            await asyncio.sleep(poll_interval_sec)

    async def download_audio(self, server_path: str, local_dest_path: str):
        """Download the rendered audio file from Port 8001 and save it locally."""
        if not self.client:
            raise RuntimeError("ACEStepClient is not started. Call start() first.")
            
        download_url = f"{self.base_url}{server_path}"
        logger.info(f"[ACEStepClient] Downloading audio from {download_url} to {local_dest_path}")
        
        try:
            r = await self.client.get(download_url)
            if r.status_code != 200:
                raise ACEStepTaskError(f"Failed to download audio file (HTTP {r.status_code})")
                
            # Ensure the directory exists
            os.makedirs(os.path.dirname(local_dest_path), exist_ok=True)
            with open(local_dest_path, "wb") as f:
                f.write(r.content)
            logger.info(f"[ACEStepClient] Audio file successfully downloaded: {local_dest_path}")
        except httpx.RequestError as e:
            raise ACEStepConnectionError(f"Failed to download audio due to network error: {e}")

    async def compose(
        self,
        payload: Dict[str, Any],
        local_dest_path: str,
        progress_callback: Optional[Callable[[float], Any]] = None
    ) -> str:
        """Helper that coordinates the full release-wait-download lifecycle in a single call."""
        task_id = await self.release_task(payload)
        server_path = await self.wait_for_completion(task_id, progress_callback)
        await self.download_audio(server_path, local_dest_path)
        return local_dest_path
