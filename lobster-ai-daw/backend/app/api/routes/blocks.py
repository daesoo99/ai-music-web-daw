from fastapi import APIRouter

router = APIRouter()

@router.post("/generate")
async def generate_block():
    return {"message": "Block generation stub - pending implementation"}
