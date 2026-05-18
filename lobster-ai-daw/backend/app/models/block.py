from pydantic import BaseModel, Field
from typing import List, Optional

class BlockSpec(BaseModel):
    prompt: str
    duration_seconds: float = Field(default=30.0, alias="duration")
    bpm: int = 120
    keyscale: str = "C Major"
    
    class Config:
        populate_by_name = True

class BlockSequenceRequest(BaseModel):
    project_id: str = "default-project"
    specs: List[BlockSpec]
    bpm: Optional[int] = None
    keyscale: Optional[str] = None
    ref_audio_strength: float = 0.6

class SequenceResponse(BaseModel):
    job_id: str
    block_count: int
