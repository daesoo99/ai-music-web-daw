from fastapi import APIRouter

router = APIRouter()

@router.get("/{stem_id}")
async def get_audio_stem(stem_id: str):
    return {"stem_id": stem_id, "message": "Audio streaming stub - pending implementation"}
