import os
from typing import Any, Callable, Dict, List, Optional
from loguru import logger

from app.services.acestep_client import ACEStepClient
from app.utils.audio_utils import extract_audio_tail

class BlockOrchestrator:
    """Orchestrates block-to-block AI music composition, handling continuation tails,
    sequential chain generation, and defensive fallbacks.
    """

    def __init__(self, client: ACEStepClient, base_data_dir: str = "data"):
        self.client = client
        self.base_data_dir = base_data_dir

    def _get_project_dir(self, project_id: str) -> str:
        return os.path.join(self.base_data_dir, "projects", project_id)

    def _get_block_path(self, project_id: str, block_id: str) -> str:
        return os.path.join(self._get_project_dir(project_id), "blocks", f"{block_id}.mp3")

    def _get_tail_path(self, project_id: str, block_id: str) -> str:
        return os.path.join(self._get_project_dir(project_id), "tails", f"{block_id}_tail.mp3")

    async def generate_block(
        self,
        project_id: str,
        block_id: str,
        prompt: str,
        duration: float = 30.0,
        bpm: int = 120,
        keyscale: str = "C Major",
        previous_block_id: Optional[str] = None,
        ref_audio_strength: float = 0.6,
        progress_callback: Optional[Callable[[float], Any]] = None
    ) -> Dict[str, Any]:
        """Generate a single music block.
        
        If a previous_block_id is provided, it attempts to continue the composition
        seamlessly by using the previous block's extracted tail via 'repaint' task_type.
        """
        dest_path = self._get_block_path(project_id, block_id)
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)

        payload = {
            "prompt": prompt,
            "lyrics": "[Instrumental]",
            "bpm": bpm,
            "keyscale": keyscale,
            "audio_format": "mp3",
            "thinking": False,
            "batch_size": 1,
            "inference_steps": 25,  # Balanced GPU usage for 8GB VRAM
        }

        tail_path = None
        if previous_block_id:
            tail_path = self._get_tail_path(project_id, previous_block_id)
            
        # Continuation mode using previous block's audio tail
        if tail_path and os.path.exists(tail_path):
            logger.info(f"[Orchestrator] Continuation requested. Using tail: {tail_path}")
            
            # Using repaint task to continue seamlessly
            payload["task_type"] = "repaint"
            payload["src_audio_path"] = os.path.abspath(tail_path)
            
            # We preserve the 6-second tail at the beginning (0.0 to 6.0 seconds),
            # and repaint (generate newly) from 6.0 seconds to target duration.
            tail_duration = 6.0
            payload["repainting_start"] = tail_duration
            payload["repainting_end"] = duration
            payload["audio_duration"] = duration
            payload["repaint_mode"] = "balanced"
            payload["repaint_strength"] = ref_audio_strength  # Balanced continuity
            payload["cover_noise_strength"] = 0.0              # Clean tail preservation
        else:
            if previous_block_id:
                logger.warning(
                    f"[Orchestrator] Previous block tail not found at {tail_path}. "
                    f"Soft-failing to text2music fallback generation."
                )
            # Standard generation mode
            payload["task_type"] = "text2music"
            payload["audio_duration"] = duration

        # 1. Run actual AI rendering via Port 8001
        logger.info(f"[Orchestrator] Dispatching generation job for block {block_id}...")
        await self.client.compose(payload, dest_path, progress_callback)
        logger.info(f"[Orchestrator] Successfully generated block {block_id} at {dest_path}")

        # 2. Extract tail for subsequent chaining (Soft-fail design)
        extracted_tail = False
        dest_tail_path = self._get_tail_path(project_id, block_id)
        os.makedirs(os.path.dirname(dest_tail_path), exist_ok=True)
        
        try:
            logger.info(f"[Orchestrator] Slicing tail for block {block_id}...")
            # Slice last 6 seconds of this block
            success = extract_audio_tail(dest_path, dest_tail_path, tail_duration_sec=6.0)
            if success:
                logger.info(f"[Orchestrator] Tail successfully created at {dest_tail_path}")
                extracted_tail = True
            else:
                logger.warning(f"[Orchestrator] Tail slicing returned False for block {block_id}")
        except Exception as e:
            logger.error(f"[Orchestrator] Soft-fail: Could not slice audio tail: {e}")

        # Return metadata representation of the block
        return {
            "block_id": block_id,
            "project_id": project_id,
            "prompt": prompt,
            "duration": duration,
            "bpm": bpm,
            "keyscale": keyscale,
            "audio_path": f"/api/audio/projects/{project_id}/blocks/{block_id}.mp3",
            "previous_block_id": previous_block_id,
            "has_tail": extracted_tail
        }

    async def generate_sequence(
        self,
        project_id: str,
        block_specs: List[Dict[str, Any]],
        bpm: int = 120,
        keyscale: str = "C Major",
        progress_callback: Optional[Callable[[int, float], Any]] = None
    ) -> List[Dict[str, Any]]:
        """Sequentially generate a chain of blocks.
        
        Uses hard-fail policy: If any block in the chain fails, it raises the exception
        immediately to avoid waste of GPU resources.
        """
        results = []
        previous_block_id = None

        logger.info(f"[Orchestrator] Starting sequence generation of {len(block_specs)} blocks...")
        
        for idx, spec in enumerate(block_specs):
            block_id = spec.get("block_id")
            prompt = spec.get("prompt")
            duration = spec.get("duration", 30.0)

            # Custom block progress wrapper
            def block_prog(percent: float):
                if progress_callback:
                    try:
                        progress_callback(idx, percent)
                    except Exception as e:
                        logger.error(f"[Orchestrator] Sequence callback error: {e}")

            # Generate single block
            res = await self.generate_block(
                project_id=project_id,
                block_id=block_id,
                prompt=prompt,
                duration=duration,
                bpm=bpm,
                keyscale=keyscale,
                previous_block_id=previous_block_id,
                progress_callback=block_prog
            )
            results.append(res)
            
            # The next block in the chain continues from this one
            previous_block_id = block_id

        logger.info(f"[Orchestrator] Completed sequence generation of {len(results)} blocks")
        return results
