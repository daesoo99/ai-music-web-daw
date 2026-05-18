@echo off
chcp 65001 >nul
echo [*] Lobster AI DAW 개발 서버 구동을 시작합니다...

:: Start FastAPI Backend wrapper in a new window
echo [*] 1. FastAPI 백엔드 래퍼 구동 (Port: 8002)...
start "Lobster Backend 8002" cmd /k "cd %~dp0..\backend && python -m uvicorn app.main:app --port 8002 --reload"

:: Start Vite React Frontend in a new window
echo [*] 2. Vite 프론트엔드 구동 (Port: 5173)...
start "Lobster Frontend 5173" cmd /k "cd %~dp0..\frontend && npm run dev"

echo [*] 서비스 구동 완료! 브라우저에서 http://localhost:5173 에 접속해 주세요.
echo [*] 서비스를 종료하려면 이 창을 닫고 stop_all.bat을 클릭해 주시면 됩니다.
