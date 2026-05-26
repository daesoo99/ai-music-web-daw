import os
"""LLM 도슨트. block의 MIDI 통계 + 원본 prompt를 컨텍스트로 묶어
Ollama에 던지고 스트림 응답을 yield 한다.
"""
import httpx
import json
from typing import AsyncIterator
from loguru import logger

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma4:latest")


def _build_analysis_prompt(
    block_meta: dict,
    midi_meta: dict | None,
    user_question: str | None,
) -> str:
    """LLM에게 음악 도슨트로 답하라는 컨텍스트 구축."""
    notes = midi_meta.get("notes", []) if midi_meta else []
    note_count = len(notes)
    detected_key = midi_meta.get("detected_key") if midi_meta else None
    
    pitch_summary = ""
    if notes:
        pitches = [n["pitch"] for n in notes]
        avg = sum(pitches) / len(pitches)
        pitch_summary = (
            f"- Pitch range: MIDI {min(pitches)}–{max(pitches)} "
            f"(roughly {midi_to_note_name(min(pitches))} to {midi_to_note_name(max(pitches))})\n"
            f"- Average pitch: ~{midi_to_note_name(int(avg))}\n"
            f"- Total notes detected: {note_count}\n"
        )
    
    base_question = user_question or (
        "Briefly explain what makes this music interesting. "
        "Discuss its harmony, melodic contour, and emotional character. "
        "Keep it warm and conversational, like a museum docent. 2-3 paragraphs."
    )
    
    return f"""You are a friendly music docent helping a hobbyist composer understand their AI-generated piece.

# Block context
- Original prompt: "{block_meta.get('prompt', 'unknown')}"
- Duration: {block_meta.get('duration', '?')}s, BPM: {block_meta.get('bpm', '?')}
- Track: {block_meta.get('track_id', '?')}
- Detected key: {detected_key or 'unknown'}

# Transcribed MIDI summary
{pitch_summary or '- MIDI transcription unavailable (likely drum/percussion track)'}

# User question
{base_question}

Answer concisely. Avoid technical jargon unless the user asked for it.
"""


def midi_to_note_name(midi: int) -> str:
    names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    octave = (midi // 12) - 1
    return f"{names[midi % 12]}{octave}"


async def stream_analysis(
    block_meta: dict,
    midi_meta: dict | None,
    user_question: str | None,
) -> AsyncIterator[str]:
    """Ollama의 streaming 응답을 청크 단위로 yield."""
    prompt = _build_analysis_prompt(block_meta, midi_meta, user_question)
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST",
            f"{OLLAMA_URL}/api/generate",
            json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": True},
        ) as response:
            if response.status_code != 200:
                yield "(LLM 서버 응답 실패. Ollama가 켜져 있는지 확인하세요.)"
                return
            
            async for raw_line in response.aiter_lines():
                if not raw_line:
                    continue
                try:
                    chunk = json.loads(raw_line)
                except json.JSONDecodeError:
                    continue
                token = chunk.get("response", "")
                if token:
                    yield token
                if chunk.get("done"):
                    break
