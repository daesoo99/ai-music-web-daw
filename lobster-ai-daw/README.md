# 🦞 Lobster AI Music Web DAW

Windows 11 로컬 환경의 **ACE-Step 1.5 XL (4B DiT)** API 서버와 연동되어, 사용자가 블록 단위로 AI 작곡을 미세 지휘하고 트랙별 사운드를 시각화/믹싱하는 **실시간 AI 작곡 웹 협업 툴(DAW)**입니다.

---

## 🛠️ 포트 및 시스템 아키텍처 (Port Policy)

* **Port 8001**: `ACE-Step XL DiT API Server` (기존 로컬 AI 작곡 엔진)
* **Port 8002**: `FastAPI Wrapper Backend` (오케스트레이션 및 상태 관리 백엔드)
* **Port 5173**: `Vite + React + TypeScript Frontend` (DAW 사용자 웹 인터페이스)

---

## 📁 주요 폴더 구조 (Project Directories)

* `/frontend`: Vite + React + TS (Zustand 상태 관리 및 Web Audio API 믹싱 엔진)
* `/backend`: FastAPI 래퍼 (릴레이 생성 및 Latent 체이닝, 프로젝트 영속화 담당)
* `/shared`: 프론트엔드와 백엔드 간의 공용 데이터 스키마 정의
* `/scripts`: 원도우 환경 자동 구동 배치 스크립트 모음

---

## 🚀 빠른 시작 방법 (Quick Start)

1. **AI 엔진 구동 (8001)**:
   - 기존의 `c:\Users\kimdaesoo\.gemini\antigravity\music\start_studio.bat`를 실행하여 8001 포트의 AI 작곡 서버를 먼저 구동합니다.

2. **DAW 서비스 기동**:
   - `/scripts/setup.bat`을 실행하여 필요한 의존성(npm 패키지, uv 파이썬 라이브러리)을 설치합니다.
   - `/scripts/dev.bat`을 실행하여 백엔드(8002)와 프론트엔드(5173)를 동시에 띄웁니다.
   - 브라우저에서 `http://localhost:5173`으로 접속하여 작곡을 시작합니다!
