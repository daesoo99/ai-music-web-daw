from pydantic import BaseModel, Field
from typing import Optional, List


class Note(BaseModel):
    """단일 MIDI 노트. Basic Pitch 출력 형식과 직접 매핑."""
    pitch: int = Field(..., ge=0, le=127, description="MIDI note number (60=C4)")
    start: float = Field(..., ge=0.0, description="블록 시작 기준 초")
    duration: float = Field(..., gt=0.0)
    velocity: int = Field(..., ge=0, le=127)


class BlockMidi(BaseModel):
    """블록 하나의 MIDI 메타데이터 전체."""
    block_id: str
    notes: List[Note]
    
    # 음악 이론 메타 (도슨트와 스왑에 사용)
    detected_key: Optional[str] = None      # 예: "D Major"
    detected_tempo: Optional[float] = None
    pitch_range: Optional[List[int]] = None # [min_pitch, max_pitch]
    
    # 파일 경로 (export 다운로드용)
    midi_file_url: Optional[str] = None
    
    # transcription 상태
    status: str = "ready"  # "ready" | "transcribing" | "failed" | "unavailable"
    failure_reason: Optional[str] = None


class AnalyzeRequest(BaseModel):
    block_id: str
    question: Optional[str] = None  # 사용자 자유 질문 (없으면 기본 도슨트)


class SwapInstrumentRequest(BaseModel):
    source_block_id: str
    target_track_id: str
    target_instrument_prompt: str  # 예: "warm acoustic drum kit, soft brushes"
    timeline_start_seconds: float  # 새 블록을 어디에 놓을지
