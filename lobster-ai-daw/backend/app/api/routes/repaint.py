from fastapi import APIRouter

router = APIRouter()

@router.post("/")
async def repaint_segment():
    return {"message": "Repaint segment stub - pending implementation"}
