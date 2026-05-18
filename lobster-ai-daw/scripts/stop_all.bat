@echo off
chcp 65001 >nul
echo [*] Lobster AI DAW 개발 프로세스들을 정리합니다...

:: Cleanly target and close the specific spawned command windows by their titles
taskkill /fi "windowtitle eq Lobster Backend 8002*" /f >nul 2>&1
taskkill /fi "windowtitle eq Lobster Frontend 5173*" /f >nul 2>&1

echo [*] 프로세스 정리 완료!
pause
