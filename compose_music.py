#!/usr/bin/env python3
"""
Interactive Music Composer Script
Uses the downloaded midi-agent-skill modules to generate beautiful MIDI files.
"""

import os
import sys
from pathlib import Path

# Add midi-agent-skill paths to sys.path for direct imports
midi_agent_dir = Path(__file__).parent / "midi-agent-skill-main" / "midi-agent-skill-main"
sys.path.insert(0, str(midi_agent_dir))
sys.path.insert(0, str(midi_agent_dir / "skills"))

try:
    from midi_types.music import Composition, Track, Note
    from skills.generate_midi import generate_midi
except ImportError:
    print("\n[!] Error: Could not import midi-agent-skill modules.")
    print("Please make sure the folder structure exists:")
    print("midi-agent-skill-main/midi-agent-skill-main/midi_types/music.py")
    sys.exit(1)

# Definitions of chords with voicing notes (3 or 4 voices)
CHORD_VOICINGS = {
    # Major & Minor triads
    "C": ["C4", "E4", "G4"],
    "G": ["G3", "B3", "D4"],
    "Am": ["A3", "C4", "E4"],
    "F": ["F3", "A3", "C4"],
    "E": ["E3", "G#3", "B3"],
    "Fm": ["F3", "Ab3", "C4"],
    "D": ["D3", "F#3", "A3"],
    
    # 7th Chords
    "Cmaj7": ["C4", "E4", "G4", "B4"],
    "Am7": ["A3", "C4", "E4", "G4"],
    "Dm7": ["D3", "F3", "A3", "C4"],
    "G7": ["G3", "B3", "D4", "F4"],
    
    # Inverted or Slash Chords (right hand voicing)
    "E/G#": ["E3", "G#3", "B3"],
    "C/G": ["C3", "E3", "G3"],
    "D/F#": ["D3", "F#3", "A3"],
}

# The Bass note associated with each chord
BASS_NOTES = {
    "C": "C2",
    "G": "G1",
    "Am": "A1",
    "F": "F1",
    "E": "E2",
    "Fm": "F2",
    "D": "D2",
    "Cmaj7": "C2",
    "Am7": "A1",
    "Dm7": "D2",
    "G7": "G1",
    
    # Slash chord bass notes (plays the note after the slash!)
    "E/G#": "G#1",
    "C/G": "G1",
    "D/F#": "F#1",
}

# Pre-defined Progressions from the catalog
PROGRESSIONS = {
    "1": {
        "title": "Modern Pop Anthemic Loop",
        "bpm": 120,
        "chords": ["C", "G", "Am", "F"],
        "piano_instrument": "acoustic-grand-piano",
        "bass_instrument": "electric-bass-finger",
        "description": "가장 친근하고 신나는 현대 팝/락 코러스 루프입니다.",
    },
    "2": {
        "title": "Bittersweet Chromatic Mediant",
        "bpm": 95,
        "chords": ["C", "E", "F", "Fm"],
        "piano_instrument": "acoustic-grand-piano",
        "bass_instrument": "acoustic-bass",
        "description": "Radiohead의 'Creep' 스타일로, 감정적이고 몽환적인 분위기를 줍니다.",
    },
    "3": {
        "title": "Tragic Descending Lament Bass",
        "bpm": 80,
        "chords": ["Am", "E/G#", "C/G", "D/F#", "F", "E"],
        "piano_instrument": "acoustic-grand-piano",
        "bass_instrument": "fretless-bass",
        "description": "하행하는 베이스 라인이 극적이고 웅장하면서 슬픈 서사를 만듭니다.",
    },
    "4": {
        "title": "Sophisticated Jazz Turnaround",
        "bpm": 110,
        "chords": ["Cmaj7", "Am7", "Dm7", "G7"],
        "piano_instrument": "electric-piano-1",
        "bass_instrument": "acoustic-bass",
        "description": "세련되고 부드러운 정통 재즈 턴어라운드 진행입니다.",
    }
}

def create_midi_file(progression_id: str, num_repeats: int = 4) -> str:
    """Generate MIDI composition and return the output path."""
    prog = PROGRESSIONS[progression_id]
    chords = prog["chords"]
    bpm = prog["bpm"]
    title = prog["title"]
    
    # 1. Piano Track (Chords)
    piano_notes = []
    # 2. Bass Track (Root / Slash notes)
    bass_notes = []
    
    # Loop over the chord progression multiple times
    for _ in range(num_repeats):
        for chord in chords:
            # Add Piano notes (chord played as whole notes - duration '1')
            voicing = CHORD_VOICINGS.get(chord, ["C4"])
            for pitch in voicing:
                piano_notes.append(Note(pitch=pitch, duration="1"))
            
            # Add Bass note (duration '1')
            bass_pitch = BASS_NOTES.get(chord, "C2")
            bass_notes.append(Note(pitch=bass_pitch, duration="1"))
            
    # Build composition tracks
    tracks = [
        Track(notes=piano_notes, instrument=prog["piano_instrument"]),
        Track(notes=bass_notes, instrument=prog["bass_instrument"])
    ]
    
    comp = Composition(title=title, bpm=bpm, tracks=tracks)
    
    # Generate MIDI file using the skill
    output_path = generate_midi(comp)
    return output_path

def main():
    print("=" * 60)
    print("       🎵 Antigravity AI 음악 작곡 스테이션 🎵")
    print("=" * 60)
    print("로컬에 다운로드된 MIDI 에이전트와 음악 이론 가이드를 활용하여")
    print("나만의 아름다운 MIDI 음악을 즉석에서 생성합니다.\n")
    
    print("[ 작곡할 코드 진행을 선택하세요 ]")
    for key, prog in PROGRESSIONS.items():
        print(f"  {key}. {prog['title']} (BPM: {prog['bpm']})")
        print(f"     └ {prog['description']}")
        print(f"     └ 진행: {' - '.join(prog['chords'])}")
        print()
        
    choice = input("선택 번호를 입력하세요 (1-4, 기본값 1): ").strip()
    if choice not in PROGRESSIONS:
        choice = "1"
        
    repeats_input = input("루프 반복 횟수를 입력하세요 (기본값 4): ").strip()
    try:
        repeats = int(repeats_input)
        if repeats <= 0:
            repeats = 4
    except ValueError:
        repeats = 4
        
    prog = PROGRESSIONS[choice]
    print(f"\n[🎹] '{prog['title']}' 진행으로 작곡을 시작합니다...")
    
    try:
        # Check if midiutil is installed
        import midiutil
    except ImportError:
        print("\n[!] 이 스크립트를 실행하려면 'midiutil' 라이브러리가 필요합니다.")
        print("아래 명령어로 라이브러리를 설치해 주세요:")
        print("  pip install midiutil")
        print("\n설치가 준비되면 다시 실행해 주세요!")
        return
        
    try:
        output_file = create_midi_file(choice, repeats)
        print("\n" + "=" * 60)
        print("🎉 작곡 및 MIDI 파일 생성이 완료되었습니다!")
        print(f"📄 저장 경로: {output_file}")
        print("=" * 60)
        print("\n💡 팁: 생성된 MIDI 파일은 DAW(Ableton, Cubase, GarageBand 등)에")
        print("   드래그 앤 드롭해서 즉시 편집하거나 악기를 교체할 수 있습니다!")
    except Exception as e:
        print(f"\n[!] 작곡 중 에러가 발생했습니다: {e}")

if __name__ == "__main__":
    main()
