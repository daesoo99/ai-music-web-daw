from pydantic import BaseModel, Field
from typing import List, Optional

class BlockSpec(BaseModel):
    prompt: str
    duration_seconds: float = Field(
        default=60.0,
        alias="duration",
        ge=5.0,
        le=180.0,
    )
    bpm: int = 120
    keyscale: str = "C Major"
    track_id: str = "default-track"
    previous_block_id: Optional[str] = None
    start_time: Optional[float] = None
    
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

class RepaintRequest(BaseModel):
    project_id: str = Field(..., description="?꾨줈?앺듃(怨? ID")
    source_block_id: str = Field(..., description="?ъ깮????곸씠 ?섎뒗 ?먮낯 釉붾줉 ID")
    track_id: str = Field(..., description="????몃옓 ID (?낃린 ?몃옓 援щ텇??")
    start_seconds: float = Field(..., ge=0.0, description="?ъ깮??援ш컙 ?쒖옉 (珥?")
    end_seconds: float = Field(..., gt=0.0, description="?ъ깮??援ш컙 醫낅즺 (珥?")
    new_prompt: str = Field(..., min_length=1, description="?대떦 援ш컙???곸슜?????꾨＼?꾪듃")
    bpm: Optional[int] = Field(default=None, ge=40, le=240)
    keyscale: Optional[str] = Field(default=None, description="?? 'D Major', 'A Minor'")
    inference_steps: int = Field(default=25, ge=10, le=60, description="DiT 異붾줎 ?ㅽ뀦")
    repaint_variance: float = Field(default=0.5, ge=0.0, le=1.0, description="蹂??媛뺣룄")

    from pydantic import model_validator
    @model_validator(mode="after")
    def _validate_range(self) -> "RepaintRequest":
        if self.end_seconds <= self.start_seconds:
            raise ValueError("end_seconds must be greater than start_seconds")
        duration = self.end_seconds - self.start_seconds
        if duration > 60.0:
            raise ValueError(f"Repaint duration max is 60s (requested: {duration:.2f}s)")
        return self

class RepaintAccepted(BaseModel):
    job_id: str
    status: str = "accepted"
    ws_url: str
