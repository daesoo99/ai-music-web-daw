from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
import json
import asyncio

from app.api.deps import get_block_orchestrator, get_state_store, get_progress_broker
from app.models.midi import AnalyzeRequest, SwapInstrumentRequest, BlockMidi
from app.services.analyst import stream_analysis
from app.services.task_registry import spawn_job
from loguru import logger
import uuid

router = APIRouter()


import os
from app.config import settings
from app.services.midi_transcriber import detect_key_from_notes

@router.get("/blocks/{block_id}/midi")
async def get_block_midi(
    block_id: str,
    state_store=Depends(get_state_store),
) -> dict:
    """프론트 useNotesStore의 lazy fetch 대상.
    
    - status가 'ready'면 노트 데이터 전체 반환
    - 'transcribing'이면 status만 — 프론트는 WS midi_ready 이벤트 대기
    - 'failed'/'unavailable'이면 사유 포함
    """
    midi = await state_store.get_midi(block_id)
    if not midi:
        # Check disk if in-memory store is empty (e.g. server restarted)
        # Scan for existing transcription in test-proj directory
        midi_dir = os.path.join(settings.DATA_DIR, "projects", "test-proj", "midi")
        notes_file = os.path.join(midi_dir, f"{block_id}.notes.json")
        
        if os.path.exists(notes_file):
            try:
                with open(notes_file, "r", encoding="utf-8") as f:
                    notes = json.load(f)
                
                pitches = [n["pitch"] for n in notes]
                pitch_range = (min(pitches), max(pitches)) if pitches else None
                detected_key = detect_key_from_notes(notes)
                
                midi_payload = {
                    "block_id": block_id,
                    "notes": notes,
                    "detected_key": detected_key,
                    "detected_tempo": 120.0,  # fallback estimate
                    "pitch_range": list(pitch_range) if pitch_range else None,
                    "midi_file_url": f"/api/audio/projects/test-proj/midi/{block_id}.mid",
                    "status": "ready",
                    "failure_reason": None,
                }
                await state_store.save_midi(block_id, midi_payload)
                return midi_payload
            except Exception as e:
                logger.error(f"[MidiRoute] Disk restore failed for block {block_id}: {e}")
        
        # 아직 transcription이 dispatch조차 안 됐을 수도 있음
        return {"block_id": block_id, "status": "transcribing", "notes": []}
    return midi


@router.post("/blocks/analyze")
async def analyze_block(
    req: AnalyzeRequest,
    state_store=Depends(get_state_store),
):
    """SSE-like 스트림. 프론트는 ReadableStream으로 chunk를 읽어 표시."""
    block = await state_store.get_block(req.block_id)
    if not block:
        # Check disk if in-memory store is empty (e.g. server restarted)
        state_file = os.path.join(settings.DATA_DIR, "projects", "test-proj", "state.json")
        if os.path.exists(state_file):
            try:
                with open(state_file, "r", encoding="utf-8") as f:
                    state = json.load(f)
                for b in state.get("blocks", []):
                    if b.get("blockId") == req.block_id:
                        block = {
                            "block_id": b.get("blockId"),
                            "project_id": "test-proj",
                            "track_id": b.get("trackId"),
                            "prompt": b.get("prompt"),
                            "duration": b.get("durationSeconds"),
                            "bpm": 120,  # default
                            "keyscale": "C Major",  # default
                            "audio_path": b.get("audioUrl"),
                        }
                        await state_store.save_block(req.block_id, block)
                        break
            except Exception as e:
                logger.error(f"[MidiRoute] Block restore failed for block {req.block_id}: {e}")
                
    if not block:
        raise HTTPException(404, f"Block {req.block_id} not found")
        
    midi = await state_store.get_midi(req.block_id)  # 없어도 OK (분석은 가능)
    if not midi:
        # Also try to load midi from disk as safety
        midi_dir = os.path.join(settings.DATA_DIR, "projects", "test-proj", "midi")
        notes_file = os.path.join(midi_dir, f"{req.block_id}.notes.json")
        if os.path.exists(notes_file):
            try:
                with open(notes_file, "r", encoding="utf-8") as f:
                    notes = json.load(f)
                pitches = [n["pitch"] for n in notes]
                pitch_range = (min(pitches), max(pitches)) if pitches else None
                detected_key = detect_key_from_notes(notes)
                midi = {
                    "block_id": req.block_id,
                    "notes": notes,
                    "detected_key": detected_key,
                    "detected_tempo": 120.0,
                    "pitch_range": list(pitch_range) if pitch_range else None,
                    "midi_file_url": f"/api/audio/projects/test-proj/midi/{req.block_id}.mid",
                    "status": "ready",
                    "failure_reason": None,
                }
                await state_store.save_midi(req.block_id, midi)
            except Exception as e:
                logger.error(f"[MidiRoute] Midi restore in analyze failed: {e}")

    async def event_stream():
        try:
            async for token in stream_analysis(block, midi, req.question):
                # 각 토큰을 NDJSON 한 줄로 전송
                yield json.dumps({"token": token}, ensure_ascii=False) + "\n"
            yield json.dumps({"done": True}) + "\n"
        except Exception as e:
            logger.exception(f"Analysis stream failed: {e}")
            yield json.dumps({"error": str(e)}) + "\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


@router.post("/blocks/swap-instrument", status_code=status.HTTP_202_ACCEPTED)
async def swap_instrument(
    req: SwapInstrumentRequest,
    orchestrator=Depends(get_block_orchestrator),
    broker=Depends(get_progress_broker),
    state_store=Depends(get_state_store),
):
    """드래그앤드롭으로 트리거. 백그라운드에서 FluidSynth + ACE-Step 파이프라인 실행."""
    job_id = f"swap_{uuid.uuid4().hex[:12]}"
    
    # 사전 검증: 원본 MIDI 준비됐는지 즉시 확인 (UX: 빠른 실패)
    source_midi = await state_store.get_midi(req.source_block_id)
    if not source_midi or source_midi.get("status") != "ready":
        raise HTTPException(
            409,
            f"Source block MIDI not ready (status: {source_midi.get('status') if source_midi else 'none'}). "
            f"Wait for transcription to complete and try again."
        )
    
    await state_store.save_job(job_id, {"status": "pending", "job_id": job_id})

    async def run():
        await broker.publish(job_id, {"type": "job_started", "job_id": job_id, "total_blocks": 1})
        try:
            def on_progress(p: float):
                asyncio.create_task(broker.publish(job_id, {
                    "type": "block_progress",
                    "job_id": job_id,
                    "progress": p,
                    "overall_progress": p,
                    "stage": "swapping",
                }))
            
            new_block = await orchestrator.swap_instrument(
                project_id=req.source_block_id.split("_")[0] if "_" in req.source_block_id else "test-proj",  # 임시
                source_block_id=req.source_block_id,
                target_track_id=req.target_track_id,
                target_instrument_prompt=req.target_instrument_prompt,
                timeline_start_seconds=req.timeline_start_seconds,
                state_store=state_store,
                progress_callback=on_progress,
            )
            await state_store.save_block(new_block["block_id"], new_block)
            await broker.publish(job_id, {
                "type": "block_complete",
                "job_id": job_id,
                "block_id": new_block["block_id"],
                "block": new_block,
            })
            await state_store.save_job(job_id, {"status": "completed", "job_id": job_id, "blocks": [new_block]})
            await broker.publish(job_id, {"type": "job_complete", "job_id": job_id, "blocks": [new_block]})
        except Exception as e:
            logger.exception(f"Swap job {job_id} failed")
            await state_store.save_job(job_id, {"status": "failed", "job_id": job_id, "error": str(e)})
            await broker.publish(job_id, {"type": "job_failed", "job_id": job_id, "error": str(e)})
    
    spawn_job(job_id, run())
    return {"job_id": job_id, "ws_url": f"/ws/jobs/{job_id}"}
