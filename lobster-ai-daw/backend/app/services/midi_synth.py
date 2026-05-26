"""FluidSynth로 MIDI 파일을 깨끗한 WAV로 합성.

악기 스왑 시 reference audio로 ACE-Step에 입력하기 위한 중간 산물.
"""
from pathlib import Path
from typing import Optional
from loguru import logger

# SoundFont 경로 (Antigravity가 설치 시 다운로드)
DEFAULT_SOUNDFONT = "data/soundfonts/GeneralUser_GS.sf2"


def render_midi_to_wav(
    midi_path: str | Path,
    output_wav_path: str | Path,
    *,
    soundfont_path: str | Path = DEFAULT_SOUNDFONT,
    sample_rate: int = 44100,
) -> Optional[Path]:
    """MIDI 파일 -> WAV. 실패 시 None.
    
    FluidSynth는 CLI로 호출하는 게 가장 안정적 (pyfluidsynth는 macOS에서 종종 깨짐).
    """
    import subprocess
    
    midi_path = Path(midi_path)
    output_wav_path = Path(output_wav_path)
    output_wav_path.parent.mkdir(parents=True, exist_ok=True)
    
    if not Path(soundfont_path).exists():
        logger.error(f"[Synth] SoundFont not found at {soundfont_path}")
        return None
    
    try:
        # Use absolute path to the downloaded fluidsynth executable
        fluidsynth_exe = Path(__file__).parent.parent.parent / "bin" / "bin" / "fluidsynth.exe"
        if not fluidsynth_exe.exists():
            fluidsynth_exe = "fluidsynth" # fallback to PATH

        # -ni : non-interactive, -F : output file, -r : sample rate
        cmd = [
            str(fluidsynth_exe), "-ni", "-g", "0.8",
            "-F", str(output_wav_path),
            "-r", str(sample_rate),
            str(soundfont_path),
            str(midi_path),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            logger.error(f"[Synth] FluidSynth failed: {result.stderr}")
            return None
        logger.info(f"[Synth] Rendered {midi_path.name} -> {output_wav_path.name}")
        return output_wav_path
    except subprocess.TimeoutExpired:
        logger.error(f"[Synth] FluidSynth timeout on {midi_path}")
        return None
    except FileNotFoundError:
        logger.error("[Synth] FluidSynth binary not on PATH. Install via 'choco install fluidsynth'.")
        return None
