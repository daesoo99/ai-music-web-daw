@echo off
chcp 65001 >nul
echo [*] 시스템 헬스 체크를 시작합니다...

echo.
echo [*] 1. ACE-Step AI Engine (8001) 체크...
curl -s --max-time 3 http://127.0.0.1:8001/health >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Warning: ACE-Step AI Engine(8001)이 구동 중이 아닙니다! (start_studio.bat를 실행해 주세요)
) else (
    echo [✓] ACE-Step AI Engine (8001) 온라인!
)

echo.
echo [*] 2. FastAPI Wrapper Backend (8002) 체크...
curl -s --max-time 3 http://127.0.0.1:8002/health >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Warning: FastAPI Wrapper Backend(8002)가 구동 중이 아닙니다! (dev.bat를 실행해 주세요)
) else (
    echo [✓] FastAPI Wrapper Backend (8002) 온라인!
)

echo.
echo [*] 3. Vite React Frontend (5173) 체크...
curl -s --max-time 3 http://127.0.0.1:5173 >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Warning: Vite 프론트엔드(5173)가 구동 중이 아닙니다! (dev.bat를 실행해 주세요)
) else (
    echo [✓] Vite 프론트엔드 (5173) 온라인!
)

echo.
pause
