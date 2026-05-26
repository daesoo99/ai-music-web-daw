import os
import urllib.request
import zipfile
import shutil

BIN_DIR = "bin"
DATA_DIR = "data/soundfonts"
FLUIDSYNTH_URL = "https://github.com/FluidSynth/fluidsynth/releases/download/v2.3.4/fluidsynth-2.3.4-win10-x64.zip"
SOUNDFONT_URL = "https://cdn.keymusician.com/FluidR3_GM.sf2" # Using a reliable direct link for a GM SoundFont

os.makedirs(BIN_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

print("Downloading FluidSynth...")
zip_path = os.path.join(BIN_DIR, "fluidsynth.zip")
urllib.request.urlretrieve(FLUIDSYNTH_URL, zip_path)

print("Extracting FluidSynth...")
with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    zip_ref.extractall(BIN_DIR)

os.remove(zip_path)

print("Downloading SoundFont (this might take a minute)...")
sf2_path = os.path.join(DATA_DIR, "GeneralUser_GS.sf2") # Naming it to match Claude's config
urllib.request.urlretrieve(SOUNDFONT_URL, sf2_path)

print("Done! FluidSynth and SoundFont are ready.")
