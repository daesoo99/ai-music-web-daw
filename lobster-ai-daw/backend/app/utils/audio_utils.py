import os
import shutil
from loguru import logger
from pydub import AudioSegment

def extract_audio_tail(src_path: str, dest_path: str, tail_duration_sec: float = 6.0) -> bool:
    """Extract the last N seconds of an audio file and save it to dest_path.
    
    If the source audio duration is shorter than tail_duration_sec,
    it copies the entire file to avoid creating empty/corrupt audio files.
    """
    try:
        if not os.path.exists(src_path):
            logger.error(f"[AudioUtils] Source file not found: {src_path}")
            return False
            
        # Get format from file extension
        _, ext = os.path.splitext(src_path)
        fmt = ext.replace(".", "").lower()
        if fmt == "wav32":
            fmt = "wav"
            
        # Load audio segment
        audio = AudioSegment.from_file(src_path, format=fmt)
        duration_ms = len(audio)
        tail_ms = int(tail_duration_sec * 1000)
        
        if duration_ms <= tail_ms:
            logger.warning(
                f"[AudioUtils] Source audio duration ({duration_ms/1000:.2f}s) is shorter or equal "
                f"to requested tail ({tail_duration_sec:.2f}s). Copying full audio."
            )
            shutil.copy2(src_path, dest_path)
            return True
            
        # Slice tail
        tail_audio = audio[-tail_ms:]
        
        # Save sliced audio
        dest_ext = os.path.splitext(dest_path)[1].replace(".", "").lower()
        if dest_ext == "wav32":
            dest_ext = "wav"
        tail_audio.export(dest_path, format=dest_ext)
        logger.info(f"[AudioUtils] Successfully extracted tail ({tail_duration_sec}s) to: {dest_path}")
        return True
    except Exception as e:
        logger.exception(f"[AudioUtils] Failed to extract audio tail: {e}")
        return False
