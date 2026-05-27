import uuid
import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from loguru import logger
from typing import List, Optional

from app.api.deps import get_block_orchestrator, get_progress_broker, get_state_store
from app.services.block_orchestrator import BlockOrchestrator
from app.services.progress_broker import ProgressBroker
from app.services.state_store import StateStore
from app.models.block import BlockSequenceRequest, SequenceResponse

router = APIRouter()

async def run_sequence_composition_task(
    job_id: str,
    project_id: str,
    block_specs_list: List[dict],
    bpm: int,
    keyscale: str,
    ref_audio_strength: float,
    orchestrator: BlockOrchestrator,
    broker: ProgressBroker,
    state_store: StateStore
):
    total_blocks = len(block_specs_list)
    logger.info(f"[BgTask] Starting composition sequence for job {job_id} ({total_blocks} blocks)")
    
    await broker.publish(job_id, {
        "type": "job_started",
        "job_id": job_id,
        "total_blocks": total_blocks
    })
    
    generated_blocks = []
    previous_block_id = None
    
    try:
        for idx, spec in enumerate(block_specs_list):
            block_id = spec["block_id"]
            prompt = spec["prompt"]
            duration = spec["duration"]
            track_id = spec.get("track_id", "default-track")
              
            if idx == 0 and spec.get("previous_block_id"):
                previous_block_id = spec["previous_block_id"]
            
            logger.info(f"[BgTask] Job {job_id}: Starting block {idx+1}/{total_blocks} (ID: {block_id}, Track: {track_id})")
            await broker.publish(job_id, {
                "type": "block_started",
                "job_id": job_id,
                "block_index": idx,
                "block_id": block_id,
                "track_id": track_id
            })
            
            # Progress callback for this block
            def on_block_progress(percent: float):
                # Calculate overall job progress
                overall_progress = (idx + percent) / total_blocks
                asyncio.create_task(broker.publish(job_id, {
                    "type": "block_progress",
                    "job_id": job_id,
                    "block_index": idx,
                    "block_id": block_id,
                    "progress": percent,
                    "overall_progress": overall_progress
                }))
                
            # Perform actual generation
            block_meta = await orchestrator.generate_block(
                project_id=project_id,
                block_id=block_id,
                prompt=prompt,
                duration=duration,
                bpm=bpm,
                keyscale=keyscale,
                previous_block_id=previous_block_id,
                ref_audio_strength=ref_audio_strength,
                track_id=track_id,
                progress_callback=on_block_progress
            )
            
            # timelineStartSeconds 바인딩
            start_sec = 0.0
            if spec.get("start_time") is not None:
                start_sec = float(spec.get("start_time"))
            elif previous_block_id:
                prev_block = await state_store.get_block(previous_block_id)
                if prev_block:
                    prev_start = prev_block.get("timelineStartSeconds", 0.0)
                    prev_dur = prev_block.get("durationSeconds", prev_block.get("duration", 0.0))
                    start_sec = prev_start + prev_dur
            block_meta["timelineStartSeconds"] = start_sec

            # Save generated block in in-memory state store
            await state_store.save_block(block_id, block_meta)
            generated_blocks.append(block_meta)
            
            # Notify block completion
            await broker.publish(job_id, {
                "type": "block_complete",
                "job_id": job_id,
                "block_index": idx,
                "block_id": block_id,
                "block": block_meta
            })
            
            from app.services.task_registry import spawn_job
            spawn_job(
                f"transcribe_{block_id}",
                orchestrator.dispatch_transcription(
                    project_id=project_id,
                    block_id=block_id,
                    track_id=track_id,
                    broker=broker,
                    state_store=state_store,
                ),
            )
            
            # Chain next block from this one
            previous_block_id = block_id
            
        # Complete sequence
        job_result = {
            "status": "completed",
            "job_id": job_id,
            "blocks": generated_blocks
        }
        await state_store.save_job(job_id, job_result)
        
        await broker.publish(job_id, {
            "type": "job_complete",
            "job_id": job_id,
            "blocks": generated_blocks
        })
        logger.info(f"[BgTask] Job {job_id} successfully completed!")
        
    except Exception as e:
        logger.exception(f"[BgTask] Job {job_id} failed: {e}")
        job_result = {
            "status": "failed",
            "job_id": job_id,
            "error": str(e)
        }
        await state_store.save_job(job_id, job_result)
        
        await broker.publish(job_id, {
            "type": "job_failed",
            "job_id": job_id,
            "error": str(e)
        })

from app.services.task_registry import spawn_job

@router.post("/sequence", response_model=SequenceResponse, status_code=status.HTTP_202_ACCEPTED)
async def compose_sequence(
    req: BlockSequenceRequest,
    orchestrator: BlockOrchestrator = Depends(get_block_orchestrator),
    broker: ProgressBroker = Depends(get_progress_broker),
    state_store: StateStore = Depends(get_state_store)
):
    job_id = str(uuid.uuid4())
    
    # 기존 블록 목록 조회
    existing_blocks = await state_store.get_project_blocks(req.project_id)
    
    # Pre-generate block specs with UUIDs
    processed_specs = []
    bpm = req.bpm if req.bpm is not None else 120
    keyscale = req.keyscale if req.keyscale is not None else "C Major"
    
    for spec in req.specs:
        track_id = spec.track_id
        duration = spec.duration_seconds
        
        # 시작 시간(start_time) 계산 및 검증
        if spec.start_time is None:
            # 자동 배치: 해당 트랙의 마지막 블록 뒤에 순차 배치 (빈 트랙이면 0.0)
            track_blocks = [
                b for b in existing_blocks 
                if b.get("trackId") == track_id or b.get("track_id") == track_id
            ]
            if track_blocks:
                start_time = max(
                    b.get("timelineStartSeconds", 0.0) + b.get("durationSeconds", b.get("duration", 0.0))
                    for b in track_blocks
                )
            else:
                start_time = 0.0
        else:
            # 명시적 시작 시간 지정
            start_time = spec.start_time
            if start_time < 0.0:
                raise HTTPException(
                    status_code=400,
                    detail="시작 시간은 0초 이상이어야 합니다."
                )
            
            # 기존 블록들과의 겹침 검증 (에러 반환)
            track_blocks = [
                b for b in existing_blocks 
                if b.get("trackId") == track_id or b.get("track_id") == track_id
            ]
            for b in track_blocks:
                b_start = b.get("timelineStartSeconds", 0.0)
                b_dur = b.get("durationSeconds", b.get("duration", 0.0))
                b_end = b_start + b_dur
                
                # 겹침 조건 대조
                if start_time < b_end and (start_time + duration) > b_start:
                    raise HTTPException(
                        status_code=400,
                        detail="기존 블록과 겹쳐 배치 불가"
                    )
        
        processed_specs.append({
            "block_id": str(uuid.uuid4()),
            "prompt": spec.prompt,
            "duration": duration,
            "track_id": track_id,
            "previous_block_id": spec.previous_block_id,
            "timeline_start_seconds": start_time
        })
        
    # Register job state as pending
    await state_store.save_job(job_id, {
        "status": "pending",
        "job_id": job_id,
        "total_blocks": len(processed_specs)
    })
    
    # Run task using registry
    spawn_job(job_id, run_sequence_composition_task(
        job_id=job_id,
        project_id=req.project_id,
        block_specs_list=processed_specs,
        bpm=bpm,
        keyscale=keyscale,
        ref_audio_strength=req.ref_audio_strength,
        orchestrator=orchestrator,
        broker=broker,
        state_store=state_store
    ))
    
    return SequenceResponse(job_id=job_id, block_count=len(processed_specs))

@router.get("/")
async def list_blocks(
    project_id: Optional[str] = None,
    track_id: Optional[str] = None,
    state_store: StateStore = Depends(get_state_store)
):
    """Retrieve metadata of all generated blocks, optionally filtered by project_id and track_id."""
    if project_id and track_id:
        return await state_store.get_project_track_blocks(project_id, track_id)
    if project_id:
        return await state_store.get_project_blocks(project_id)
    return await state_store.get_all_blocks()

@router.get("/jobs/{job_id}")
async def get_job_status(
    job_id: str,
    state_store: StateStore = Depends(get_state_store)
):
    """Query the state and outcome of a background composition job."""
    job = await state_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Composition job not found")
    return job

from app.models.block import RepaintRequest, RepaintAccepted
from fastapi import BackgroundTasks

async def run_repaint_task(
    job_id: str,
    request: RepaintRequest,
    orchestrator: BlockOrchestrator,
    broker: ProgressBroker,
    state_store: StateStore
):
    logger.info(f"[BgTask] Starting repaint for job {job_id}")
    
    await broker.publish(job_id, {
        "type": "job_started",
        "job_id": job_id,
        "total_blocks": 1
    })
    
    try:
        def on_progress(percent: float):
            asyncio.create_task(broker.publish(job_id, {
                "type": "block_progress",
                "job_id": job_id,
                "block_index": 0,
                "block_id": request.source_block_id,
                "progress": percent,
                "overall_progress": percent
            }))

        block_meta = await orchestrator.repaint_block(
            project_id=request.project_id,
            source_block_id=request.source_block_id,
            track_id=request.track_id,
            start_seconds=request.start_seconds,
            end_seconds=request.end_seconds,
            new_prompt=request.new_prompt,
            state_store=state_store,
            bpm=request.bpm,
            keyscale=request.keyscale,
            inference_steps=request.inference_steps,
            repaint_variance=request.repaint_variance,
            progress_callback=on_progress
        )

        # In repaint, we are technically replacing the block in the UI. We emit block_complete with the new block.
        new_block_id = block_meta["block_id"]
        await state_store.save_block(new_block_id, block_meta)
        
        await broker.publish(job_id, {
            "type": "block_complete",
            "job_id": job_id,
            "block_index": 0,
            "block_id": new_block_id,
            "block": block_meta
        })

        job_result = {
            "status": "completed",
            "job_id": job_id,
            "blocks": [block_meta]
        }
        await state_store.save_job(job_id, job_result)
        
        await broker.publish(job_id, {
            "type": "job_complete",
            "job_id": job_id,
            "blocks": [block_meta]
        })
        logger.info(f"[BgTask] Repaint job {job_id} successfully completed!")
        
    except Exception as e:
        logger.exception(f"[BgTask] Repaint job {job_id} failed: {e}")
        job_result = {
            "status": "failed",
            "job_id": job_id,
            "error": str(e)
        }
        await state_store.save_job(job_id, job_result)
        
        await broker.publish(job_id, {
            "type": "job_failed",
            "job_id": job_id,
            "error": str(e)
        })

@router.post("/repaint", response_model=RepaintAccepted, status_code=status.HTTP_202_ACCEPTED)
async def repaint_block_route(
    request: RepaintRequest,
    orchestrator: BlockOrchestrator = Depends(get_block_orchestrator),
    broker: ProgressBroker = Depends(get_progress_broker),
    state_store: StateStore = Depends(get_state_store)
):
    job_id = f"repaint_{uuid.uuid4().hex[:12]}"
    
    await state_store.save_job(job_id, {
        "status": "pending",
        "job_id": job_id,
        "total_blocks": 1
    })

    spawn_job(job_id, run_repaint_task(
        job_id=job_id,
        request=request,
        orchestrator=orchestrator,
        broker=broker,
        state_store=state_store
    ))
    
    return RepaintAccepted(job_id=job_id, ws_url=f"/ws/jobs/{job_id}")

@router.delete("/{block_id}")
async def delete_block(
    block_id: str,
    state_store: StateStore = Depends(get_state_store),
):
    block = await state_store.get_block(block_id)
    if not block:
        raise HTTPException(404, "Block not found")
    
    project_id = block.get("project_id")
    file_path = f"data/projects/{project_id}/blocks/{block_id}.mp3"
    tail_path = f"data/projects/{project_id}/tails/{block_id}_tail.mp3"
    midi_path = f"data/projects/{project_id}/midi/{block_id}.notes.json"
    
    import os
    try:
        os.remove(file_path)
    except FileNotFoundError:
        pass
    try:
        os.remove(tail_path)
    except FileNotFoundError:
        pass
    try:
        os.remove(midi_path)
    except FileNotFoundError:
        pass
    
    await state_store.delete_block(block_id)
    return {"status": "deleted"}

@router.get("/{block_id}/download")
async def download_block_audio(
      block_id: str,
      state_store: StateStore = Depends(get_state_store)
  ):
      """블록의 mp3 파일을 첨부 파일로 응답."""
      block = await state_store.get_block(block_id)
      if not block:
          # Check disk if in-memory store is empty (e.g. server restarted)
          import os
          import json
          from app.config import settings
          state_file = os.path.join(settings.DATA_DIR, "projects", "test-proj", "state.json")
          if os.path.exists(state_file):
              try:
                  with open(state_file, "r", encoding="utf-8") as f:
                      state = json.load(f)
                  for b in state.get("blocks", []):
                      if b.get("blockId") == block_id:
                          block = {
                              "block_id": b.get("blockId"),
                              "project_id": "test-proj",
                              "track_id": b.get("trackId"),
                              "prompt": b.get("prompt"),
                              "duration": b.get("durationSeconds"),
                              "bpm": 120,
                              "keyscale": "C Major",
                              "audio_path": b.get("audioUrl"),
                          }
                          await state_store.save_block(block_id, block)
                          break
              except Exception as e:
                  logger.error(f"[BlockRoute] Block restore in download failed: {e}")

      if not block:
          raise HTTPException(status_code=404, detail="블록 또는 오디오 파일이 없습니다.")
      
      project_id = block.get("project_id", "test-proj")
      from app.config import settings
      import os
      import re
      
      file_path = os.path.join(settings.DATA_DIR, "projects", project_id, "blocks", f"{block_id}.mp3")
      if not os.path.exists(file_path):
          raise HTTPException(status_code=404, detail="오디오 파일이 디스크 상에 존재하지 않습니다.")
      
      # 파일명을 블록 라벨 기준으로 예쁘게 설정 (없으면 block_id.mp3)
      prompt = block.get("prompt", "")
      filename = f"{block_id}.mp3"
      if prompt:
          safe_prompt = re.sub(r'[^\w\s-]', '', prompt).strip().replace(' ', '_')
          if safe_prompt:
              filename = f"{safe_prompt}.mp3"
              
      return FileResponse(
          path=file_path,
          media_type="audio/mpeg",
          filename=filename,
          headers={
              "Cache-Control": "no-cache, no-store, must-revalidate",
              "Pragma": "no-cache",
              "Expires": "0"
          }
      )
