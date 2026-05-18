#!/usr/bin/env python3
import time
import requests
import json
import os
import sys

def main():
    print("[API Render] Starting music render orchestration script...")
    
    # 1. Wait for API Server to become active
    health_url = "http://127.0.0.1:8001/health"
    print("[API Render] Checking if ACE-Step API is online...")
    
    retries = 0
    max_retries = 40  # Wait up to 120 seconds
    server_online = False
    
    while retries < max_retries:
        try:
            r = requests.get(health_url, timeout=2)
            if r.status_code == 200:
                print("[API Render] ACE-Step API is ONLINE and HEALTHY!")
                server_online = True
                break
        except Exception:
            pass
        
        retries += 1
        print(f"[API Render] Still loading... (Waiting {retries * 3}s / 120s)")
        time.sleep(3)
        
    if not server_online:
        print("[Error] ACE-Step API server failed to start or load in time.")
        sys.exit(1)
        
    # 2. Release Music Task
    task_url = "http://127.0.0.1:8001/release_task"
    payload = {
        "prompt": "Majestic and uplifting classical orchestra, Pachelbel's Canon in D major, beautiful violins, grand piano, epic symphonic sound, studio masterpiece, highly energetic and emotional pop-crossover, crystal clear quality",
        "lyrics": "[Instrumental]",
        "audio_format": "mp3",
        "thinking": False,  # Direct DiT generation for 100% speed and reliability
        "batch_size": 1,
        "inference_steps": 25,  # 25 steps for beautiful balance of speed and high quality on 8GB VRAM
        "keyscale": "D Major",
        "bpm": 85,
        "duration": 45.0  # 45 seconds of magnificent classical music
    }
    
    print("[API Render] Submitting composition task to ACE-Step XL DiT...")
    try:
        response = requests.post(task_url, json=payload, headers={"Content-Type": "application/json"})
        response_data = response.json()
        
        if response_data.get("code") != 200 or "error" in response_data and response_data["error"] is not None:
            print(f"[Error] Failed to release task: {response_data.get('error')}")
            sys.exit(1)
            
        task_id = response_data["data"]["task_id"]
        print(f"[API Render] Task submitted successfully! Task ID: {task_id}")
    except Exception as e:
        print(f"[Error] Failed to communicate with API server: {e}")
        sys.exit(1)
        
    # 3. Poll for results
    query_url = "http://127.0.0.1:8001/query_result"
    query_payload = {"task_id_list": [task_id]}
    
    print("[API Render] Generating music in progress on RTX 4060 GPU...")
    print("[API Render] This takes about 20-35 seconds. Please wait...")
    
    start_time = time.time()
    task_completed = False
    audio_path = None
    
    while True:
        try:
            r = requests.post(query_url, json=query_payload)
            res = r.json()
            
            task_info = res["data"][0]
            status = task_info["status"]
            
            if status == 1:  # Succeeded
                print("\n[API Render] Generation complete!")
                # Parse the inner JSON string from the "result" field
                result_list = json.loads(task_info["result"])
                audio_path = result_list[0]["file"]
                task_completed = True
                break
            elif status == 2:  # Failed
                print(f"\n[Error] Music generation task failed on server side.")
                sys.exit(1)
            else:
                elapsed = int(time.time() - start_time)
                # print without newline to show nice progress
                sys.stdout.write(f"\r[API Render] Rendering... {elapsed}s elapsed")
                sys.stdout.flush()
                
        except Exception as e:
            print(f"\n[Warning] Error polling status: {e}")
            
        time.sleep(4)
        
    if not task_completed or not audio_path:
        print("[Error] No audio output path found.")
        sys.exit(1)
        
    # 4. Download final audio file
    download_url = f"http://127.0.0.1:8001{audio_path}"
    output_filename = "canon_in_d_orchestra.mp3"
    
    print(f"\n[API Render] Downloading rendered audio file from server...")
    try:
        audio_response = requests.get(download_url)
        if audio_response.status_code == 200:
            with open(output_filename, "wb") as f:
                f.write(audio_response.content)
            print(f"[Success] Beautiful music saved to: {os.path.abspath(output_filename)}")
        else:
            print(f"[Error] Failed to download audio file: HTTP {audio_response.status_code}")
            sys.exit(1)
    except Exception as e:
        print(f"[Error] Exception occurred while downloading: {e}")
        sys.exit(1)
        
    print("\n" + "="*60)
    print("[*] Music Production Finished successfully!")
    print(f"[MIDI] MIDI File: canon_in_d_majestic.mid")
    print(f"[AUDIO] Orchestra Audio: canon_in_d_orchestra.mp3")
    print("="*60)

if __name__ == "__main__":
    main()
