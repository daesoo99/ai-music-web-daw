import uuid
import asyncio
import os
from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from typing import Optional

from app.api.deps import get_block_orchestrator, get_acestep_client, get_progress_broker, get_state_store
from app.services.block_orchestrator import BlockOrchestrator
from app.services.acestep_client import ACEStepClient
from app.services.progress_broker import ProgressBroker
from app.services.state_store import StateStore
from app.models.repaint import RepaintRequest
from app.models.block import SequenceResponse
from app.utils.audio_utils import extract_audio_tail

router = APIRouter()

async def run_repaint_composition_task(
    job_id: str,
    new_block_id: str,
    req: RepaintRequest,
    source_block_meta: dict,
    orchestrator: BlockOrchestrator,
    acestep_client: ACEStepClient,
    broker: ProgressBroker,
    state_store: StateStore
):
    logger.info(f"[BgTask] Starting repaint job {job_id} for source block {req.source_block_id}")
    
    await broker.publish(job_id, {
        "type": "job_started",
        "job_id": job_id,
        "total_blocks": 1
    })
    
    await broker.publish(job_id, {
        "type": "block_started",
        "job_id": job_id,
        "block_index": 0,
        "block_id": new_block_id
    })
    
    try:
        project_id = req.project_id or source_block_meta.get("project_id", "default-project")
        # Convert relative API audio path to local physical path
        source_audio_physical = os.path.join(
            orchestrator.base_data_dir,
            "projects",
            project_id,
            "blocks",
            f"{req.source_block_id}.mp3"
        )
        
        if not os.path.exists(source_audio_physical):
            raise FileNotFoundError(f"Source block physical file not found at: {source_audio_physical}")
            
        dest_audio_physical = orchestrator._get_block_path(project_id, new_block_id)
        os.makedirs(os.path.dirname(dest_audio_physical), exist_ok=True)
        
        # Build repaint payload matching ACE-Step 1.5 specifications
        payload = {
            "task_type": "repaint",
            "src_audio_path": os.path.abspath(source_audio_physical),
            "repainting_start": req.start_seconds,
            "repainting_end": req.end_seconds,
            "audio_duration": source_block_meta["duration"],
            "prompt": req.new_prompt,
            "lyrics": "[Instrumental]",
            "bpm": source_block_meta["bpm"],
            "keyscale": source_block_meta["keyscale"],
            "audio_format": "mp3",
            "thinking": False,
            "batch_size": 1,
            "inference_steps": 25,
            "repaint_mode": "balanced",
            "repaint_strength": 0.5,
            "cover_noise_strength": 0.0
        }
        
        # Progress callback
        def on_repaint_progress(percent: float):
            asyncio.create_task(broker.publish(job_id, {
                "type": "block_progress",
                "job_id": job_id,
                "block_index": 0,
                "block_id": new_block_id,
                "progress": percent,
                "overall_progress": percent
            }))
            
        # Call Port 8001
        logger.info(f"[BgTask] Repainting audio using ACE-Step...")
        await acestep_client.compose(payload, dest_audio_physical, on_repaint_progress)
        logger.info(f"[BgTask] Repaint complete. Output saved to {dest_audio_physical}")
        
        # Extract tail for subsequent chaining (Soft-fail design)
        extracted_tail = False
        dest_tail_path = orchestrator._get_tail_path(project_id, new_block_id)
        os.makedirs(os.path.dirname(dest_tail_path), exist_ok=True)
        try:
            success = extract_audio_tail(dest_audio_physical, dest_tail_path, tail_duration_sec=6.0)
            extracted_tail = bool(success)
        except Exception as e:
            logger.error(f"[BgTask] Soft-fail tail extraction for repainted block: {e}")
            
        # Create block metadata record
        block_meta = {
            "block_id": new_block_id,
            "project_id": project_id,
            "prompt": req.new_prompt,
            "duration": source_block_meta["duration"],
            "bpm": source_block_meta["bpm"],
            "keyscale": source_block_meta["keyscale"],
            "audio_path": f"/api/audio/projects/{project_id}/blocks/{new_block_id}.mp3",
            "previous_block_id": source_block_meta.get("previous_block_id"),
            "repainted_from_block_id": req.source_block_id,
            "has_tail": extracted_tail
        }
        
        await state_store.save_block(new_block_id, block_meta)
        
        # Save job status
        job_result = {
            "status": "completed",
            "job_id": job_id,
            "blocks": [block_meta]
        }
        await state_store.save_job(job_id, job_result)
        
        await broker.publish(job_id, {
            "type": "block_complete",
            "job_id": job_id,
            "block_index": 0,
            "block_id": new_block_id,
            "block": block_meta
        })
        
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

@router.post("/", response_model=SequenceResponse, status_code=status.HTTP_202_ACCEPTED)
async def repaint_block(
    req: RepaintRequest,
    orchestrator: BlockOrchestrator = Depends(get_block_orchestrator),
    acestep_client: ACEStepClient = Depends(get_acestep_client),
    broker: ProgressBroker = Depends(get_progress_broker),
    state_store: StateStore = Depends(get_state_store)
):
    # 1. Fetch source block from store
    source_block_meta = await state_store.get_block(req.source_block_id)
    if not source_block_meta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Source block {req.source_block_id} not found in state store"
        )
        
    # 2. Prepare new IDs
    job_id = str(uuid.uuid4())
    new_block_id = str(uuid.uuid4())
    
    # 3. Register job state
    await state_store.save_job(job_id, {
        "status": "pending",
        "job_id": job_id,
        "total_blocks": 1
    })
    
    # 4. Dispatch naked background task
    asyncio.create_task(run_repaint_composition_task(
        job_id=job_id,
        new_block_id=new_block_id,
        req=req,
        source_block_meta=source_block_meta,
        orchestrator=orchestrator,
        acestep_client=acestep_client,
        broker=broker,
        state_store=state_store
    ))
    
    return SequenceResponse(job_id=job_id, block_count=1)
