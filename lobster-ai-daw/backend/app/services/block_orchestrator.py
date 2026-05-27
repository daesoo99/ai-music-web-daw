import os
import uuid
import asyncio
from typing import Any, Callable, Dict, List, Optional

from loguru import logger

from app.services.acestep_client import ACEStepClient
from app.services.midi_transcriber import (
    transcribe_audio_to_midi,
    detect_key_from_notes,
)
from app.services.midi_synth import render_midi_to_wav
from app.utils.audio_utils import extract_audio_tail


TRACK_INSTRUMENT_PROMPT = {
    "piano": "Solo grand piano",
    "strings": "Lush string ensemble, orchestral strings",
    "drums": "Acoustic drum kit",
    "bass": "Electric bass guitar",
    "guitar": "Acoustic guitar",
}

class BlockOrchestrator:
    """Orchestrates block-to-block AI music composition, handling continuation tails,
    sequential chain generation, and defensive fallbacks.
    """

    def __init__(self, client: ACEStepClient, base_data_dir: str = "data"):
        self.client = client
        self.base_data_dir = base_data_dir
        self._gpu_lock = asyncio.Semaphore(1)
        self._transcribe_lock = asyncio.Semaphore(2)

    def _get_project_dir(self, project_id: str) -> str:
        return os.path.join(self.base_data_dir, "projects", project_id)

    def _get_block_path(self, project_id: str, block_id: str) -> str:
        return os.path.join(
            self._get_project_dir(project_id),
            "blocks",
            f"{block_id}.mp3",
        )

    def _get_tail_path(self, project_id: str, block_id: str) -> str:
        return os.path.join(
            self._get_project_dir(project_id),
            "tails",
            f"{block_id}_tail.mp3",
        )

    def _get_midi_dir(self, project_id: str) -> str:
        return os.path.join(self._get_project_dir(project_id), "midi")

    def _get_block_audio_url(self, project_id: str, block_id: str) -> str:
        return f"/api/audio/projects/{project_id}/blocks/{block_id}.mp3"

    def _build_repaint_payload(
        self,
        *,
        src_audio_path: str,
        prompt: str,
        lyrics: str,
        bpm: int,
        keyscale: str,
        inference_steps: int = 80,
    ) -> Dict[str, Any]:
        """ACE-Step repaint 怨꾩뿴 ?묒뾽??怨듯넻 payload瑜??앹꽦?쒕떎.

        swap_instrument? repaint_block??怨듭쑀?섎뒗 ?꾨뱶瑜???怨녹뿉??愿由ы븳??
        媛?湲곕뒫蹂??몃? ?듭뀡? ?몄텧遺?먯꽌 異붽?濡?update?쒕떎.
        """
        return {
            "task_type": "repaint",
            "src_audio_path": os.path.abspath(src_audio_path),
            "prompt": prompt,
            "lyrics": lyrics,
            "audio_format": "mp3",
            "thinking": False,
            "inference_steps": int(inference_steps),
            "batch_size": 1,
            "bpm": int(bpm),
            "keyscale": keyscale,
            "key_scale": keyscale,
        }

    async def dispatch_transcription(
        self,
        project_id: str,
        block_id: str,
        track_id: str,
        broker: Any,
        state_store: Any,
    ) -> None:
        async with self._transcribe_lock:
            audio_path = self._get_block_path(project_id, block_id)
            midi_dir = self._get_midi_dir(project_id)
            is_drum = "drum" in track_id.lower() or "perc" in track_id.lower()

            await state_store.save_midi_status(
                block_id,
                {
                    "status": "transcribing",
                    "block_id": block_id,
                },
            )

            await broker.publish_global(
                {
                    "type": "midi_status",
                    "block_id": block_id,
                    "status": "transcribing",
                }
            )

            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(
                None,
                lambda: transcribe_audio_to_midi(
                    audio_path,
                    midi_dir,
                    block_id,
                    is_drum_track=is_drum,
                ),
            )

            if result is None:
                status = "unavailable" if is_drum else "failed"

                await state_store.save_midi_status(
                    block_id,
                    {
                        "status": status,
                        "block_id": block_id,
                        "failure_reason": "Drum track"
                        if is_drum
                        else "Transcription error",
                    },
                )

                await broker.publish_global(
                    {
                        "type": "midi_status",
                        "block_id": block_id,
                        "status": status,
                    }
                )
                return

            detected_key = detect_key_from_notes(result.notes)

            midi_payload = {
                "block_id": block_id,
                "notes": result.notes,
                "detected_key": detected_key,
                "detected_tempo": result.detected_tempo,
                "pitch_range": list(result.pitch_range)
                if result.pitch_range
                else None,
                "midi_file_url": f"/api/audio/projects/{project_id}/midi/{block_id}.mid",
                "status": "ready",
                "failure_reason": None,
            }

            await state_store.save_midi(block_id, midi_payload)

            await broker.publish_global(
                {
                    "type": "midi_ready",
                    "block_id": block_id,
                    "note_count": len(result.notes),
                    "detected_key": detected_key,
                }
            )

    async def swap_instrument(
        self,
        project_id: str,
        source_block_id: str,
        target_track_id: str,
        target_instrument_prompt: str,
        timeline_start_seconds: float,
        state_store: Any,
        progress_callback: Optional[Callable[[float], Any]] = None,
    ) -> Dict[str, Any]:
        source_midi = await state_store.get_midi(source_block_id)

        if not source_midi or source_midi.get("status") != "ready":
            raise ValueError(
                f"Source block {source_block_id} has no transcribed MIDI yet. "
                f"Status: {source_midi.get('status') if source_midi else 'none'}"
            )

        source_block = await state_store.get_block(source_block_id)

        if not source_block:
            raise ValueError(f"Source block {source_block_id} not found")

        midi_path = os.path.join(
            self._get_midi_dir(project_id),
            f"{source_block_id}.mid",
        )

        if not os.path.exists(midi_path):
            raise FileNotFoundError(f"MIDI file missing: {midi_path}")

        loop = asyncio.get_running_loop()

        temp_wav_dir = os.path.join(self._get_project_dir(project_id), "temp")
        os.makedirs(temp_wav_dir, exist_ok=True)

        temp_wav_path = os.path.join(
            temp_wav_dir,
            f"swap_{source_block_id}.wav",
        )

        rendered = await loop.run_in_executor(
            None,
            lambda: render_midi_to_wav(midi_path, temp_wav_path),
        )

        if rendered is None:
            raise RuntimeError("Failed to render MIDI to reference WAV")

        new_block_id = str(uuid.uuid4())
        dest_path = self._get_block_path(project_id, new_block_id)
        duration = float(source_block.get("duration", 30.0))

        payload = self._build_repaint_payload(
            src_audio_path=temp_wav_path,
            prompt=target_instrument_prompt,
            lyrics="[Instrumental]",
            bpm=int(source_block.get("bpm", 120)),
            keyscale=source_midi.get("detected_key")
            or source_block.get("keyscale", "C Major"),
            inference_steps=80,
        )

        payload.update(
            {
                "audio_duration": duration,
                "repainting_start": 0.0,
                "repainting_end": duration,
                "repaint_strength": 0.45,
                "cover_noise_strength": 0.1,
            }
        )

        async with self._gpu_lock:
            await self.client.compose(payload, dest_path, progress_callback)

        new_block_meta = {
            "block_id": new_block_id,
            "project_id": project_id,
            "track_id": target_track_id,
            "prompt": target_instrument_prompt,
            "duration": duration,
            "bpm": payload["bpm"],
            "keyscale": payload["keyscale"],
            "audio_path": self._get_block_audio_url(project_id, new_block_id),
            "previous_block_id": None,
            "has_tail": False,
            "timelineStartSeconds": timeline_start_seconds,
            "swapped_from": source_block_id,
        }

        try:
            os.remove(temp_wav_path)
        except OSError:
            pass

        return new_block_meta

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
        track_id: str = "default-track",
        progress_callback: Optional[Callable[[float], Any]] = None,
    ) -> Dict[str, Any]:
        dest_path = self._get_block_path(project_id, block_id)
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)

        instrument_kw = TRACK_INSTRUMENT_PROMPT.get(track_id, "")
        final_prompt = f"{instrument_kw}. {prompt}" if instrument_kw else prompt
        payload = {
            "prompt": final_prompt,
            "lyrics": "[Instrumental]",
            "bpm": bpm,
            "key_scale": keyscale,
            "audio_format": "mp3",
            "thinking": False,
            "batch_size": 1,
            "inference_steps": 80,
        }

        tail_path = None

        if previous_block_id:
            tail_path = self._get_tail_path(project_id, previous_block_id)

        if tail_path and os.path.exists(tail_path):
            logger.info(
                f"[Orchestrator] Continuation requested on track '{track_id}'. "
                f"Using tail: {tail_path}"
            )

            payload["task_type"] = "repaint"
            payload["src_audio_path"] = os.path.abspath(tail_path)

            tail_duration = 6.0
            payload["repainting_start"] = tail_duration
            payload["repainting_end"] = duration
            payload["audio_duration"] = duration
            payload["repaint_mode"] = "balanced"
            payload["repaint_strength"] = ref_audio_strength
            payload["cover_noise_strength"] = 0.0
        else:
            if previous_block_id:
                logger.warning(
                    f"[Orchestrator] Previous block tail not found at {tail_path}. "
                    "Soft-failing to text2music fallback."
                )

            payload["task_type"] = "text2music"
            payload["audio_duration"] = duration

        logger.info(
            f"[Orchestrator] Dispatching generation job on track '{track_id}' "
            f"for block {block_id}..."
        )

        async with self._gpu_lock:
            await self.client.compose(payload, dest_path, progress_callback)

        logger.info(
            f"[Orchestrator] Successfully generated block {block_id} at {dest_path}"
        )

        extracted_tail = False
        dest_tail_path = self._get_tail_path(project_id, block_id)
        os.makedirs(os.path.dirname(dest_tail_path), exist_ok=True)

        try:
            logger.info(f"[Orchestrator] Slicing tail for block {block_id}...")
            success = extract_audio_tail(
                dest_path,
                dest_tail_path,
                tail_duration_sec=6.0,
            )

            if success:
                logger.info(
                    f"[Orchestrator] Tail successfully created at {dest_tail_path}"
                )
                extracted_tail = True
            else:
                logger.warning(
                    f"[Orchestrator] Tail slicing returned False for block {block_id}"
                )

        except Exception as e:
            logger.error(f"[Orchestrator] Soft-fail: Could not slice audio tail: {e}")

        return {
            "block_id": block_id,
            "project_id": project_id,
            "track_id": track_id,
            "prompt": prompt,
            "duration": duration,
            "bpm": bpm,
            "keyscale": keyscale,
            "audio_path": self._get_block_audio_url(project_id, block_id),
            "previous_block_id": previous_block_id,
            "has_tail": extracted_tail,
        }

    async def generate_sequence(
        self,
        project_id: str,
        block_specs: List[Dict[str, Any]],
        bpm: int = 120,
        keyscale: str = "C Major",
        progress_callback: Optional[Callable[[int, float], Any]] = None,
    ) -> List[Dict[str, Any]]:
        results = []
        previous_block_id = None

        logger.info(
            f"[Orchestrator] Starting sequence generation of "
            f"{len(block_specs)} blocks..."
        )

        for idx, spec in enumerate(block_specs):
            block_id = spec.get("block_id")
            prompt = spec.get("prompt")
            duration = spec.get("duration", 30.0)
            track_id = spec.get("track_id", "default-track")

            def block_prog(percent: float):
                if progress_callback:
                    try:
                        progress_callback(idx, percent)
                    except Exception as e:
                        logger.error(
                            f"[Orchestrator] Sequence callback error: {e}"
                        )

            res = await self.generate_block(
                project_id=project_id,
                block_id=block_id,
                prompt=prompt,
                duration=duration,
                bpm=bpm,
                keyscale=keyscale,
                previous_block_id=previous_block_id,
                track_id=track_id,
                progress_callback=block_prog,
            )

            results.append(res)
            previous_block_id = block_id

        logger.info(
            f"[Orchestrator] Completed sequence generation of {len(results)} blocks"
        )

        return results

    async def repaint_block(
        self,
        project_id: str,
        source_block_id: str,
        track_id: str,
        start_seconds: float,
        end_seconds: float,
        new_prompt: str,
        state_store: Any,
        bpm: Optional[int] = None,
        keyscale: Optional[str] = None,
        inference_steps: int = 80,
        repaint_variance: float = 0.5,
        progress_callback: Optional[Callable[[float], Any]] = None,
    ) -> Dict[str, Any]:
        source_block = await state_store.get_block(source_block_id)

        if not source_block:
            raise ValueError(f"Source block {source_block_id} not found")

        src_audio_path = source_block.get("audio_path")

        if not src_audio_path:
            raise ValueError(f"Source block {source_block_id} has no audio_path")

        local_src_audio_path = self._get_block_path(project_id, source_block_id)

        actual_bpm = int(bpm) if bpm is not None else int(source_block.get("bpm", 120))
        actual_keyscale = keyscale if keyscale is not None else source_block.get("keyscale", "C Major")

        new_block_id = str(uuid.uuid4())
        dest_path = self._get_block_path(project_id, new_block_id)
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)

        logger.info(
            f"[Orchestrator] Dispatching repaint task for "
            f"{source_block_id} -> {new_block_id}"
        )

        async with self._gpu_lock:
            await self.client.repaint_audio(
                source_audio_path=local_src_audio_path,
                start_seconds=start_seconds,
                end_seconds=end_seconds,
                new_prompt=new_prompt,
                bpm=actual_bpm,
                keyscale=actual_keyscale,
                inference_steps=inference_steps,
                repaint_variance=repaint_variance,
                local_dest_path=dest_path,
                progress_callback=progress_callback,
            )

        logger.info(
            f"[Orchestrator] Successfully repainted block {new_block_id} "
            f"at {dest_path}"
        )

        orig_duration = float(source_block.get("duration", 30.0))

        return {
            "block_id": new_block_id,
            "project_id": project_id,
            "track_id": track_id,
            "prompt": new_prompt,
            "duration": orig_duration,
            "bpm": actual_bpm,
            "keyscale": actual_keyscale,
            "audio_path": self._get_block_audio_url(project_id, new_block_id),
            "source_block_id": source_block_id,
            "previous_block_id": source_block.get("previous_block_id"),
            "has_tail": False,
            "timelineStartSeconds": source_block.get("timelineStartSeconds", 0),
        }

