from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from loguru import logger
import asyncio

router = APIRouter()

@router.websocket("/progress")
async def websocket_progress_endpoint(websocket: WebSocket):
    """WebSocket endpoint to subscribe to real-time progress events for a composition job."""
    await websocket.accept()
    
    query_params = websocket.query_params
    job_id = query_params.get("job_id")
    
    if not job_id:
        logger.warning("[WS] Connection rejected: missing 'job_id' query parameter")
        await websocket.close(code=4000, reason="Missing job_id parameter")
        return
        
    logger.info(f"[WS] Client connected. Subscribing to job_id: {job_id}")
    
    app_state = websocket.app.state
    if not hasattr(app_state, "progress_broker"):
        logger.error("[WS] ProgressBroker singleton not found in app state")
        await websocket.close(code=4001, reason="Server state error: ProgressBroker missing")
        return
        
    broker = app_state.progress_broker
    queue = await broker.subscribe(job_id)
    
    try:
        while True:
            # Wait for next event published by background task
            event = await queue.get()
            
            # Send event to WebSocket client
            await websocket.send_json(event)
            queue.task_done()
            
            # Cleanly break connection upon terminal states
            if event.get("type") in ("job_complete", "job_failed"):
                logger.info(f"[WS] Job {job_id} reached terminal state. Closing connection.")
                await asyncio.sleep(0.5)
                break
                
    except WebSocketDisconnect:
        logger.info(f"[WS] Client disconnected voluntarily from job {job_id}")
    except Exception as e:
        logger.error(f"[WS] WebSocket transmission error for job {job_id}: {e}")
    finally:
        # Crucial clean-up to prevent memory leaks!
        await broker.unsubscribe(job_id, queue)
        try:
            await websocket.close()
        except Exception:
            pass
