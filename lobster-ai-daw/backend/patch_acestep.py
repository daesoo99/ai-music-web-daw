filepath = r'app\services\acestep_client.py'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

import re
start_match = re.search(r'async def wait_for_completion\(', content)
if not start_match:
    print('START NOT FOUND')
    exit(1)

end_match = re.search(r'async def download_audio\(', content)
if not end_match:
    print('END NOT FOUND')
    exit(1)

start_idx = start_match.start()
end_idx = end_match.start()

replacement = '''async def wait_for_completion(
        self,
        task_id: str,
        progress_callback: Optional[Callable[[float], Any]] = None,
        timeout_sec: float = 300.0,
        poll_interval_sec: float = 0.5
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
                
            real_progress_notified = False
            
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
                        
                    elif status == 0:  # Running
                        try:
                            result_list = json.loads(task_info.get("result", "[]"))
                            if result_list and isinstance(result_list, list) and len(result_list) > 0:
                                inner_task = result_list[0]
                                real_progress = inner_task.get("progress")
                                if real_progress is not None:
                                    real_progress_val = float(real_progress)
                                    logger.info(f"[ACEStepClient] Real task progress: {real_progress_val * 100:.1f}%")
                                    if progress_callback:
                                        try:
                                            progress_callback(real_progress_val)
                                        except Exception as cb_err:
                                            logger.error(f"[ACEStepClient] Real progress callback exception: {cb_err}")
                                    real_progress_notified = True
                        except Exception as pe:
                            logger.warning(f"[ACEStepClient] Failed to parse real progress: {pe}")
                            
            except httpx.RequestError as e:
                logger.warning(f"[ACEStepClient] Connection issue during status polling: {e}")
                
            # UX Heuristic progress updates: cap at 0.95 until completion, fallback only
            if progress_callback and not real_progress_notified:
                # Estimate progress assuming a standard generation takes ~25s
                est_progress = min(0.95, elapsed / 25.0)
                try:
                    progress_callback(est_progress)
                except Exception as cb_err:
                    logger.error(f"[ACEStepClient] Progress callback exception (ignored): {cb_err}")
                    
            await asyncio.sleep(poll_interval_sec)

    '''

new_content = content[:start_idx] + replacement + content[end_idx:]
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(new_content)
print('SUCCESS')