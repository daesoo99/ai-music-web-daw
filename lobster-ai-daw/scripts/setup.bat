@echo off
chcp 65001 >nul
echo [*] Lobster AI DAW 의존성 설치를 시작합니다...

echo [*] 1. 백엔드 FastAPI 의존성 설치...
cd %~dp0..\backend
call pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [!] pip 설치 중 에러가 발생했습니다. 패키지 설치 환경을 직접 확인해주세요.
)

echo [*] 2. 프론트엔드 React npm 의존성 설치...
cd %~dp0..\frontend
call npm install
if %errorlevel% neq 0 (
    echo [!] npm 패키지 설치 중 에러가 발생했습니다. Node.js/npm 설치 여부를 확인해주세요.
)

echo [*] 의존성 설치 및 셋업 완료!
pause
