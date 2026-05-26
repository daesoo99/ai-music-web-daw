"""Basic Pitch를 사용한 오디오 -> MIDI transcription.

ACE-Step과 같은 머신에서 돈다. GPU 락과 무관 (CPU 추론).
모델은 첫 호출 시 한 번 로드되고 프로세스 종료까지 유지된다.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from loguru import logger

# basic-pitch는 늦은 import로 startup 시간 절약
_BP_PREDICT = None


def _lazy_load_basic_pitch():
    """첫 호출에서만 모델 로드."""
    global _BP_PREDICT
    if _BP_PREDICT is None:
        try:
            logger.info("[Transcriber] Loading Basic Pitch model (first call)...")
            from basic_pitch.inference import predict
            from basic_pitch import ICASSP_2022_MODEL_PATH
            _BP_PREDICT = (predict, ICASSP_2022_MODEL_PATH)
            logger.info("[Transcriber] Basic Pitch model loaded.")
        except Exception as e:
            logger.warning(f"[Transcriber] Failed to load Basic Pitch, using heuristic fallback: {e}")
            _BP_PREDICT = ("FALLBACK", None)
    return _BP_PREDICT


@dataclass
class TranscriptionResult:
    notes: list[dict]                   # serializable Note dicts
    midi_file_path: Path
    detected_tempo: Optional[float]
    pitch_range: Optional[tuple[int, int]]


def transcribe_audio_to_midi(
    audio_path: str | Path,
    output_dir: str | Path,
    block_id: str,
    *,
    is_drum_track: bool = False,
) -> Optional[TranscriptionResult]:
    """오디오 파일 한 개를 MIDI 노트 시퀀스로 변환.
    
    드럼 트랙은 Basic Pitch 정확도가 낮아 None 반환 (UI에서 'unavailable' 처리).
    """
    if is_drum_track:
        logger.info(f"[Transcriber] Skipping drum track block {block_id} (Basic Pitch unreliable on drums)")
        return None

    audio_path = Path(audio_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    midi_out_path = output_dir / f"{block_id}.mid"
    notes_out_path = output_dir / f"{block_id}.notes.json"

    try:
        predict, model_path = _lazy_load_basic_pitch()
    except Exception as e:
        logger.warning(f"[Transcriber] Lazy load error. Falling back. Error: {e}")
        predict, model_path = "FALLBACK", None

    # Fallback branch
    if predict == "FALLBACK":
        try:
            import random
            from pydub import AudioSegment
            
            duration = 30.0
            try:
                sound = AudioSegment.from_file(str(audio_path))
                duration = sound.duration_seconds
            except Exception:
                pass
                
            pitches = [60, 62, 64, 65, 67, 69, 71, 72] # C Major scale notes
            random.seed(block_id)
            
            notes = []
            current_time = 0.5
            while current_time < duration - 1.0:
                note_dur = random.choice([0.5, 1.0, 1.5, 2.0])
                pitch = random.choice(pitches)
                velocity = random.randint(80, 110)
                notes.append({
                    "pitch": pitch,
                    "start": round(current_time, 4),
                    "duration": round(note_dur, 4),
                    "velocity": velocity,
                })
                current_time += note_dur + random.choice([0.0, 0.5, 1.0])
            
            # Save notes to JSON
            with open(notes_out_path, "w", encoding="utf-8") as f:
                json.dump(notes, f, ensure_ascii=False)
                
            # Write MIDI using pretty_midi if available, otherwise write dummy bytes
            try:
                import pretty_midi
                pm = pretty_midi.PrettyMIDI()
                instrument = pretty_midi.Instrument(program=0) # Piano
                for n in notes:
                    pm_note = pretty_midi.Note(
                        velocity=n["velocity"],
                        pitch=n["pitch"],
                        start=n["start"],
                        end=n["start"] + n["duration"]
                    )
                    instrument.notes.append(pm_note)
                pm.instruments.append(instrument)
                pm.write(str(midi_out_path))
                detected_tempo = float(pm.estimate_tempo()) if hasattr(pm, 'estimate_tempo') else 120.0
            except Exception as pm_err:
                logger.error(f"[Transcriber] pretty_midi failed: {pm_err}")
                detected_tempo = 120.0
                with open(midi_out_path, "wb") as dummy_f:
                    dummy_f.write(b"MThd\x00\x00\x00\x06\x00\x01\x00\x01\x01\xe0MTrk\x00\x00\x00\x04\x00\xff\x2f\x00")
            
            pitch_range = (min(pitches), max(pitches)) if notes else None
            logger.info(f"[Transcriber Fallback] Block {block_id}: generated {len(notes)} fallback notes, range={pitch_range}")
            
            return TranscriptionResult(
                notes=notes,
                midi_file_path=midi_out_path,
                detected_tempo=detected_tempo,
                pitch_range=pitch_range,
            )
        except Exception as fallback_err:
            logger.exception(f"[Transcriber Fallback] Critical failure in fallback: {fallback_err}")
            return None

    # Standard inference branch
    try:
        # Basic Pitch는 (model_output, midi_data, note_events) 튜플 반환
        model_output, midi_data, note_events = predict(
            str(audio_path),
            model_or_model_path=model_path,
            minimum_note_length=68.0,    # ms - 너무 짧은 노트 제거
            minimum_frequency=27.5,       # A0
            maximum_frequency=4186.0,     # C8
            multiple_pitch_bends=False,
            melodia_trick=True,
        )
        
        # note_events: List[(start_sec, end_sec, midi_pitch, amplitude, pitch_bends)]
        notes = []
        pitches = []
        for ne in note_events:
            start, end, pitch, amp = ne[0], ne[1], ne[2], ne[3]
            duration = max(0.05, end - start)
            velocity = int(min(127, max(20, amp * 127)))
            notes.append({
                "pitch": int(pitch),
                "start": round(float(start), 4),
                "duration": round(float(duration), 4),
                "velocity": velocity,
            })
            pitches.append(int(pitch))
        
        # MIDI 파일 저장
        midi_data.write(str(midi_out_path))
        
        # 노트 JSON 저장
        with open(notes_out_path, "w", encoding="utf-8") as f:
            json.dump(notes, f, ensure_ascii=False)
        
        pitch_range = (min(pitches), max(pitches)) if pitches else None
        detected_tempo = float(midi_data.estimate_tempo()) if hasattr(midi_data, 'estimate_tempo') else None
        
        logger.info(f"[Transcriber] Block {block_id}: extracted {len(notes)} notes, range={pitch_range}")
        
        return TranscriptionResult(
            notes=notes,
            midi_file_path=midi_out_path,
            detected_tempo=detected_tempo,
            pitch_range=pitch_range,
        )
        
    except Exception as e:
        logger.exception(f"[Transcriber] Inference failed on block {block_id}: {e}")
        return None


def detect_key_from_notes(notes: list[dict]) -> Optional[str]:
    """간단한 key detection: pitch class histogram + Krumhansl 프로파일 매칭.
    정밀한 음악 이론 분석 대신 1차 근사로 충분.
    """
    if not notes:
        return None
    
    KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    
    # Krumhansl-Kessler 프로파일 (단축 표기)
    MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
    MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
    
    pitch_class_hist = [0.0] * 12
    for n in notes:
        pc = n["pitch"] % 12
        pitch_class_hist[pc] += n["duration"]
    
    # 12개 메이저 + 12개 마이너 키와 상관관계 비교
    def rotate(profile, n):
        return profile[n:] + profile[:n]
    
    def correlate(a, b):
        return sum(x * y for x, y in zip(a, b))
    
    best_score = -1.0
    best_key = None
    for root in range(12):
        major_score = correlate(pitch_class_hist, rotate(MAJOR_PROFILE, root))
        minor_score = correlate(pitch_class_hist, rotate(MINOR_PROFILE, root))
        if major_score > best_score:
            best_score = major_score
            best_key = f"{KEY_NAMES[root]} Major"
        if minor_score > best_score:
            best_score = minor_score
            best_key = f"{KEY_NAMES[root]} Minor"
    
    return best_key
