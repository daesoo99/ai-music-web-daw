from pydantic import BaseModel
from typing import Optional

class RepaintRequest(BaseModel):
    source_block_id: str
    start_seconds: float
    end_seconds: float
    new_prompt: str
    project_id: Optional[str] = "default-project"
    track_id: str = "default-track"
