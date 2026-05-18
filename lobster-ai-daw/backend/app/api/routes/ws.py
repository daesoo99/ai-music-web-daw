from fastapi import APIRouter, WebSocket

router = APIRouter()

@router.websocket("/progress")
async def websocket_progress(websocket: WebSocket):
    await websocket.accept()
    await websocket.send_json({"progress": 1.0, "stage": "ready"})
    await websocket.close()
