#!/usr/bin/env python3
import os
from midiutil import MIDIFile

def generate_canon_in_d():
    print("[MIDI Generator] Pachelbel's Canon in D major MIDI file generation started...")
    
    # 1. Create the MIDIFile object with 3 tracks
    # Track 0: Piano Chords (Harmony)
    # Track 1: String Bass (Low End)
    # Track 2: Bright Piano Arpeggio/Melody (Energy)
    midi_file = MIDIFile(numTracks=3, adjust_origin=True)
    
    # 2. Setup Track properties
    tempo = 85  # Elegant and slightly upbeat tempo
    
    # Track Names & Instruments (General MIDI Program Numbers)
    # Track 0: Acoustic Grand Piano (Program 0)
    midi_file.addTrackName(0, 0, "Piano Chords")
    midi_file.addTempo(0, 0, tempo)
    midi_file.addProgramChange(0, 0, 0, 0) # Track 0, Channel 0, Time 0, Program 0 (Piano)
    
    # Track 1: Orchestral Strings / Bass (Program 48 or 32 for Acoustic Bass)
    midi_file.addTrackName(1, 0, "Orchestral Strings Bass")
    midi_file.addTempo(1, 0, tempo)
    midi_file.addProgramChange(1, 1, 0, 48) # Track 1, Channel 1, Time 0, Program 48 (String Ensemble 1)
    
    # Track 2: Bright Piano Melody (Program 1 - Bright Acoustic Piano)
    midi_file.addTrackName(2, 0, "Bright Piano Melody")
    midi_file.addTempo(2, 0, tempo)
    midi_file.addProgramChange(2, 2, 0, 1) # Track 2, Channel 2, Time 0, Program 1 (Bright Piano)
    
    # 3. Pachelbel's Canon in D Chord Progression Voicings & Bass
    # MIDI Note Numbers:
    # C4 = 60, D4 = 62, E4 = 64, F#4 = 66, G4 = 67, A4 = 69, B4 = 71, C#5 = 73, D5 = 74
    # Bass notes: D2 = 38, A2 = 45, B2 = 47, F#2 = 42, G2 = 43, A2 = 45
    
    # 8 Chords in the standard Canon loop
    chords = [
        {"name": "D",   "notes": [62, 66, 69, 74], "bass": 38}, # D4, F#4, A4, D5  | Bass: D2
        {"name": "A",   "notes": [57, 61, 64, 69], "bass": 33}, # A3, C#4, E4, A4  | Bass: A1
        {"name": "Bm",  "notes": [59, 62, 66, 71], "bass": 35}, # B3, D4, F#4, B4  | Bass: B1
        {"name": "F#m", "notes": [54, 57, 61, 66], "bass": 30}, # F#3, A3, C#4, F#4| Bass: F#1
        {"name": "G",   "notes": [55, 59, 62, 67], "bass": 31}, # G3, B3, D4, G4  | Bass: G1
        {"name": "D",   "notes": [50, 54, 57, 62], "bass": 26}, # D3, F#3, A3, D4  | Bass: D1
        {"name": "G",   "notes": [55, 59, 62, 67], "bass": 31}, # G3, B3, D4, G4  | Bass: G1
        {"name": "A",   "notes": [57, 61, 64, 69], "bass": 33}  # A3, C#4, E4, A4  | Bass: A1
    ]
    
    repeats = 4  # Repeat the loop 4 times (around 2 minutes)
    time_cursor = 0.0
    
    # 4. Generate Notes
    for loop in range(repeats):
        for step, chord in enumerate(chords):
            # Track 0: Chords (Harmony)
            # Duration: 4 beats (Whole note per chord)
            # Volume: 80 (Gentle backing)
            for note in chord["notes"]:
                midi_file.addNote(track=0, channel=0, pitch=note, time=time_cursor, duration=4.0, volume=75)
                
            # Track 1: Orchestral Strings Bass
            # Plays low bass notes to give a majestic foundation
            # Volume: 90 (Solid, warm)
            midi_file.addNote(track=1, channel=1, pitch=chord["bass"], time=time_cursor, duration=4.0, volume=85)
            # Also add octave bass for a fuller orchestral low end
            midi_file.addNote(track=1, channel=1, pitch=chord["bass"] + 12, time=time_cursor, duration=4.0, volume=70)
            
            # Track 2: Bright Piano Arpeggio / Melody
            # Let's write a beautiful, classical-pop arpeggiated movement ( 신나고 웅장한 느낌 )
            # 8 eighth notes (0.5 beats each) per chord to create a lovely dynamic pattern
            root = chord["notes"][0]
            third = chord["notes"][1]
            fifth = chord["notes"][2]
            octave = chord["notes"][3]
            
            if loop == 0:
                # Loop 0: Simple quarter-note arpeggio (1 beat each)
                # D - A - Bm - F#m arpeggios
                midi_file.addNote(track=2, channel=2, pitch=root, time=time_cursor, duration=1.0, volume=85)
                midi_file.addNote(track=2, channel=2, pitch=third, time=time_cursor + 1.0, duration=1.0, volume=85)
                midi_file.addNote(track=2, channel=2, pitch=fifth, time=time_cursor + 2.0, duration=1.0, volume=85)
                midi_file.addNote(track=2, channel=2, pitch=octave, time=time_cursor + 3.0, duration=1.0, volume=90)
            else:
                # Loops 1, 2, 3: Energetic, rapid 8th-note classical patterns (0.5 beats each)
                # Pattern: root -> third -> fifth -> octave -> fifth -> third -> root -> octave
                midi_file.addNote(track=2, channel=2, pitch=root, time=time_cursor, duration=0.5, volume=90)
                midi_file.addNote(track=2, channel=2, pitch=third, time=time_cursor + 0.5, duration=0.5, volume=90)
                midi_file.addNote(track=2, channel=2, pitch=fifth, time=time_cursor + 1.0, duration=0.5, volume=90)
                midi_file.addNote(track=2, channel=2, pitch=octave, time=time_cursor + 1.5, duration=0.5, volume=95)
                midi_file.addNote(track=2, channel=2, pitch=octave + 4 if step % 2 == 0 else octave + 2, time=time_cursor + 2.0, duration=0.5, volume=95) # Melody accent
                midi_file.addNote(track=2, channel=2, pitch=fifth, time=time_cursor + 2.5, duration=0.5, volume=90)
                midi_file.addNote(track=2, channel=2, pitch=third, time=time_cursor + 3.0, duration=0.5, volume=90)
                midi_file.addNote(track=2, channel=2, pitch=root, time=time_cursor + 3.5, duration=0.5, volume=85)
                
            time_cursor += 4.0
            
    # 5. Save the MIDI file
    output_filename = "canon_in_d_majestic.mid"
    with open(output_filename, "wb") as output_file:
        midi_file.writeFile(output_file)
        
    print(f"[Success] [MIDI Generator] Successfully composed and saved MIDI file: {os.path.abspath(output_filename)}")
    return output_filename

if __name__ == "__main__":
    generate_canon_in_d()
