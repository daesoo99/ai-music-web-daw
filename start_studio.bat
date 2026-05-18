@echo off
chcp 65001 >nul
title OpenClaw AI Music Studio Controller
color 0B
cls

echo ==========================================================
echo           Lobster AI Music Studio Launcher
echo ==========================================================
echo  Launching Local Gemma 4 and ACE-Step XL Music Server.
echo ==========================================================
echo.

:: 1. Start Ollama
echo [1/3] Checking Ollama service status...
tasklist /FI "IMAGENAME eq ollama.exe" 2>NUL | find /I /N "ollama.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo    - Ollama is already running in the background.
) else (
    echo    - Ollama is offline. Starting in background...
    start /B "" "C:\Users\kimdaesoo\AppData\Local\Programs\Ollama\ollama.exe" serve >nul 2>&1
)
timeout /t 3 >nul
echo.

:: 2. Start OpenClaw Gateway (minimized)
echo [2/3] Starting OpenClaw Gateway service...
tasklist /FI "IMAGENAME eq node.exe" 2>NUL | find /I /N "node.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo    - OpenClaw Gateway is already running or port is occupied.
) else (
    echo    - Starting Gateway in minimized window...
    start /min "OpenClaw Gateway" cmd /c "openclaw gateway"
)
timeout /t 3 >nul
echo.

:: 3. Start ACE-Step v1.5 XL API Server (minimized)
echo [3/3] Starting ACE-Step v1.5 XL API Engine...
echo    - Optimization mode: CPU Offloading + INT8 Quantization (VRAM 8GB)...
cd /d "c:\Users\kimdaesoo\.gemini\antigravity\music\ACE-Step-1.5"
start /min "ACE-Step XL Writer API" cmd /c "set PYTHONUTF8=1&&set ACESTEP_CONFIG_PATH=acestep-v15-xl-base&&set ACESTEP_OFFLOAD_TO_CPU=true&&set ACESTEP_OFFLOAD_DIT_TO_CPU=true&&set ACESTEP_INIT_LLM=false&&set ACESTEP_QUANTIZE_DIT=int8_weight_only&&uv run --no-sync acestep-api --host 127.0.0.1 --port 8001"

echo    - Waiting for API server to load (15 seconds, please wait)...
timeout /t 15 >nul
echo    - All backend services are loaded!
echo.

:: 4. Open Gemma 4 Chat
echo ==========================================================
echo [*] All systems ready! Opening Gemma 4 Chat Session...
echo ==========================================================
timeout /t 2 >nul
cls

cd /d "c:\Users\kimdaesoo\.gemini\antigravity\music"
openclaw chat

echo.
echo ==========================================================
echo Lobster session closed.
echo ==========================================================
set /p opt="Do you want to safely close background services and Ollama? (Y/N): "
if /i "%opt%"=="Y" (
    echo.
    echo Terminating background services...
    taskkill /f /im node.exe >nul 2>&1
    taskkill /f /im ollama.exe >nul 2>&1
    taskkill /f /im python.exe >nul 2>&1
    echo All services stopped successfully. Have a great day!
) else (
    echo Background services remain active in the background.
)
timeout /t 3 >nul
