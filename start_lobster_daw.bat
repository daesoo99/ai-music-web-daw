@echo off
chcp 65001 >nul
title Lobster AI Web DAW Launcher
color 0B
cls

echo ==========================================================
echo           Lobster AI Web DAW Launcher
echo ==========================================================
echo  Launching all required services for the Web DAW...
echo ==========================================================
echo.

:: 1. Start Ollama
echo [1/5] Checking Ollama service status...
tasklist /FI "IMAGENAME eq ollama.exe" 2>NUL | find /I /N "ollama.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo    - Ollama is already running in the background.
) else (
    echo    - Ollama is offline. Starting in background...
    start /B "" "C:\Users\kimdaesoo\AppData\Local\Programs\Ollama\ollama.exe" serve >nul 2>&1
)
timeout /t 2 >nul
echo.

:: 2. Start OpenClaw Gateway
echo [2/5] Starting OpenClaw Gateway service...
tasklist /FI "IMAGENAME eq node.exe" 2>NUL | find /I /N "node.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo    - OpenClaw Gateway is already running.
) else (
    echo    - Starting Gateway in minimized window...
    start /min "OpenClaw Gateway" cmd /c "openclaw gateway"
)
timeout /t 2 >nul
echo.

:: 3. Start ACE-Step v1.5 XL API Server
echo [3/5] Starting ACE-Step v1.5 XL API Engine (Port 8001)...
cd /d "c:\Users\kimdaesoo\.gemini\antigravity\music\ACE-Step-1.5"
start /min "ACE-Step XL Writer API" cmd /c "set PYTHONUTF8=1&&set ACESTEP_CONFIG_PATH=acestep-v15-xl-base&&set ACESTEP_OFFLOAD_TO_CPU=true&&set ACESTEP_OFFLOAD_DIT_TO_CPU=true&&set ACESTEP_INIT_LLM=false&&set ACESTEP_QUANTIZE_DIT=int8_weight_only&&uv run --no-sync acestep-api --host 127.0.0.1 --port 8001"

echo    - Waiting for ACE-Step API Server (Port 8001) to start up...
echo      (This may take 1-2 minutes on Windows CPU-Offload mode as it loads large AI models...)
:wait_8001
netstat -ano | findstr "LISTENING" | findstr "8001" >nul
if %errorlevel% neq 0 (
    <nul set /p =.
    timeout /t 3 >nul
    goto wait_8001
)
echo.
echo    - [SUCCESS] ACE-Step API Server is now ONLINE on Port 8001!
echo.

:: 4. Start Lobster FastAPI Backend
echo [4/5] Starting Lobster FastAPI Backend (Port 8002)...
cd /d "c:\Users\kimdaesoo\.gemini\antigravity\music\lobster-ai-daw\backend"
start /min "Lobster Backend API" cmd /c "set OLLAMA_MODEL=gemma4:latest&&uv run uvicorn app.main:app --host 127.0.0.1 --port 8002"

echo    - Waiting for Lobster FastAPI Backend (Port 8002) to start up...
:wait_8002
netstat -ano | findstr "LISTENING" | findstr "8002" >nul
if %errorlevel% neq 0 (
    <nul set /p =.
    timeout /t 2 >nul
    goto wait_8002
)
echo.
echo    - [SUCCESS] Lobster FastAPI Backend is now ONLINE on Port 8002!
echo.

:: 5. Start Lobster React Frontend
echo [5/5] Starting Lobster React Frontend (Port 5173)...
cd /d "c:\Users\kimdaesoo\.gemini\antigravity\music\lobster-ai-daw\frontend"
start /min "Lobster Web UI" cmd /c "npm run dev"

echo    - Waiting for React Frontend (Port 5173) to start up...
:wait_5173
netstat -ano | findstr "LISTENING" | findstr "5173" >nul
if %errorlevel% neq 0 (
    <nul set /p =.
    timeout /t 2 >nul
    goto wait_5173
)
echo.
echo    - [SUCCESS] Lobster React Frontend is now ONLINE on Port 5173!
echo.

echo ==========================================================
echo [*] All systems are GO! Opening Web DAW in browser...
echo ==========================================================
start http://localhost:5173

echo.
echo ==========================================================
echo Press any key in this window when you want to SHUT DOWN
echo all Lobster DAW services (Backend, Frontend, AI Engine).
echo ==========================================================
pause >nul

echo.
echo Terminating background services...
taskkill /f /fi "WINDOWTITLE eq ACE-Step XL Writer API*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Lobster Backend API*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Lobster Web UI*" >nul 2>&1
echo All Lobster Web DAW services stopped successfully. Have a great day!
timeout /t 3 >nul
