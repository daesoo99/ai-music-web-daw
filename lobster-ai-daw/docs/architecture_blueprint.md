# 🦞 Lobster AI Music Web DAW - 마스터 아키텍처 청사진 (Architecture Blueprint)

이 문서는 **Lobster AI Music Web DAW** 프로젝트의 1단계 아키텍처 설계와 폴더 구조 결정을 총망라한 **마스터 가이드라인**입니다. 나중에 **GPT Pro**, **Claude Opus** 등 타 대형 AI 에이전트와 아키텍처를 비교 분석하거나 피드백을 받아 코드를 갱신할 때 이 파일을 컨텍스트로 제공하세요.

---

## 🛠️ 1. 핵심 아키텍처 결정 사항 (Core Architectural Decisions)

### 결정 1. 프론트엔드: Vite + React + TypeScript
* **이유**: SSR/SEO가 필요 없는 로컬 데스크톱형 DAW 서비스입니다. Next.js의 서버 사이드 오버헤드를 차단하고, Web Audio API 및 브라우저 AudioContext 객체와의 완벽한 동기화를 위해 가볍고 HMR(Hot Module Replacement)이 압도적으로 빠른 **Vite**를 채택했습니다.

### 결정 2. 미들웨어: FastAPI Wrapper (Port 8002) 배치
* **이유**: React(5173)와 기존 ACE-Step AI Engine(8001) 사이에 독립적인 FastAPI 래퍼를 둡니다.
  1. **WebSocket 중계**: AI 생성의 실시간 진행률(Progress)을 브라우저에 실시간 WebSocket으로 브로드캐스팅합니다.
  2. **Latent 릴레이 체이닝**: 이전 30초 블록의 마지막 5~8초 Latent를 추출하여 다음 블록 생성 시 컨디셔닝 context로 주입하는 오케스트레이션을 서버 사이드에서 제어합니다.
  3. **프로젝트 영속화**: DAW 프로젝트 세션(트랙 배치, 볼륨, BPM 등)을 JSON 파일로 영속적으로 저장하고 로드합니다.

### 결정 3. 상태 관리 및 스타일
* **상태 관리**: Zustand (Web Audio API 컨텍스트 싱글톤과의 유기적인 연동이 쉽고 보일러플레이트가 가벼움)
* **스타일**: Vanilla CSS + CSS Variables 기반의 글래스모피즘(Glassmorphism) 네온 테마 적용

### 결정 4. 포트 바인딩 정책
* **Port 8001**: `ACE-Step XL DiT AI Engine` (기존 로컬 백엔드)
* **Port 8002**: `FastAPI Wrapper Backend` (오케스트레이션 백엔드)
* **Port 5173**: `Vite + React + TS Frontend` (DAW 사용자 UI)

---

## 📂 2. 마스터 디렉토리 구조 (Directory Structure)

```
lobster-ai-daw/
├── .gitignore
├── .editorconfig
├── README.md
├── LICENSE
│
├── shared/                # 프론트/백 공용 JSON 스키마
│   └── schemas/
│       ├── block.schema.json
│       └── project.schema.json
│
├── backend/               # FastAPI 래퍼 (포트 8002)
│   ├── app/
│   │   ├── main.py        # CORS, 라우터 등록 및 lifespan
│   │   ├── config.py      # BaseSettings 환경 설정
│   │   ├── api/
│   │   │   └── routes/    # 엔드포인트 라우터 (health, blocks, projects, audio, repaint, ws)
│   │   ├── services/      # 핵심 로직 (acestep_client, block_orchestrator 등)
│   │   ├── models/        # Pydantic 데이터 검증 모델
│   │   ├── core/          # CP949 로깅 및 인코딩 패치
│   │   └── utils/         # 오디오/Latent/파일 헬퍼
│   ├── data/              # 로컬 데이터베이스 (JSON 프로젝트, 오디오 스템 캐시)
│   ├── pyproject.toml
│   └── requirements.txt
│
├── frontend/              # Vite + React + TS (포트 5173)
│   ├── index.html
│   ├── vite.config.ts     # 8002 백엔드 및 WebSocket 프록시 설정
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx        # 3패널 Glassmorphism 레이아웃
│   │   ├── components/    # UI 컴포넌트 (layout, timeline, pianoroll, mixer, composer, common)
│   │   ├── audio/         # Web Audio API (AudioEngine, TrackPlayer, Scheduler)
│   │   ├── store/         # Zustand Stores (project, playback, mixer, ui)
│   │   ├── services/      # API/WS 클라이언트
│   │   ├── styles/        # globals.css, theme.css, glassmorphism.css
│   │   └── types/         # TypeScript 타입 정의
│   └── tsconfig.json
│
└── scripts/               # 윈도우 배치 자동화 헬퍼 스크립트
    ├── setup.bat          # 파이썬 pip 및 npm 의존성 일괄 설치
    ├── dev.bat            # 백엔드(8002) + 프론트엔드(5173) 동시 기동
    ├── stop_all.bat       # 백/프론트 구동 윈도우 타겟 자동 종료
    └── health_check.bat   # 8001, 8002, 5173 포트 상태 진단
```

---

## 🤝 3. 타 AI 에이전트(GPT Pro / Claude Opus)와 협업 시 팁
* **전체 구조 파악용**: 새로운 AI와의 채팅방을 개설할 때 이 파일(`docs/architecture_blueprint.md`)을 통째로 컨텍스트로 업로드하십시오.
* **코드 수정 시**: GPT Pro에게 수정 코드를 요청할 때 이 구조를 지키며 기존에 구성된 `backend/app/main.py`나 `frontend/src/App.tsx`를 파괴하지 않고 자연스럽게 스텁(Stub) 코드를 교체하는 형태로 답변하도록 유도하면 코드가 깨지는 것을 방지할 수 있습니다.
