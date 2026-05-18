import uuid
import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
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

@router.post("/sequence", response_model=SequenceResponse, status_code=status.HTTP_202_ACCEPTED)
async def compose_sequence(
    req: BlockSequenceRequest,
    orchestrator: BlockOrchestrator = Depends(get_block_orchestrator),
    broker: ProgressBroker = Depends(get_progress_broker),
    state_store: StateStore = Depends(get_state_store)
):
    job_id = str(uuid.uuid4())
    
    # Pre-generate block specs with UUIDs
    processed_specs = []
    bpm = req.bpm if req.bpm is not None else 120
    keyscale = req.keyscale if req.keyscale is not None else "C Major"
    
    for spec in req.specs:
        processed_specs.append({
            "block_id": str(uuid.uuid4()),
            "prompt": spec.prompt,
            "duration": spec.duration_seconds,
            "track_id": spec.track_id
        })
        
    # Register job state as pending
    await state_store.save_job(job_id, {
        "status": "pending",
        "job_id": job_id,
        "total_blocks": len(processed_specs)
    })
    
    # Run task in background (Naked task so it lives beyond request scope)
    asyncio.create_task(run_sequence_composition_task(
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
    state_store: StateStore = Depends(get_state_store)
):
    """Retrieve metadata of all generated blocks, optionally filtered by project_id."""
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
