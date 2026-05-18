# 🦞 Lobster AI Music Web DAW - 마스터 아키텍처 청사진 (Pivoted Multi-Track DAW Blueprint)

이 문서는 **Lobster AI Music Web DAW** 프로젝트의 핵심 아키텍처와 폴더 구조를 정의한 **마스터 청사진**입니다. 
기존의 단일 트랙 시간 연장 방식을 뛰어넘어, 사용자가 정의한 **세로축 악기 트랙(Y)과 가로축 시간 블록(X)이 결합된 진정한 '멀티 트랙 하이브리드 DAW'**를 구현하기 위한 마스터 가이드라인입니다. 나중에 **GPT Pro**, **Claude** 등 타 대형 AI 에이전트와 아키텍처를 비교 분석하거나 피드백을 받아 코드를 갱신할 때 이 파일을 컨텍스트로 제공하세요.

---

## 🛠️ 1. 핵심 아키텍처 결정 사항 (Core Architectural Decisions)

### 결정 1. 멀티 트랙 2차원 그리드 (Y축 악기 트랙 × X축 시간 블록)
* **구조**:
  - **Y축 (세로)**: 개별 악기 트랙 리스트 (예: Grand Piano, Finger Bass, Strings, Synthesizer 등). 각 트랙은 고유한 `track_id`를 가집니다.
  - **X축 (가로)**: 30초 단위 시간 그리드 블록.
  - **블록 데이터 구조**: 각 블록(`block_meta`)은 자신이 속한 악기 트랙의 식별자인 `track_id`를 명시하며, 동일 트랙 내의 이전 블록 꼬리(`previous_block_id`)를 물고 릴레이 작곡(Chaining)을 실행합니다.

### 결정 2. 이중 연주 엔진 (Dual-Engine Playback & Rendering)
1. **실시간 프리뷰 엔진 (지연율 0ms 브라우저 가상 연주)**:
   - **기술**: 브라우저 Web Audio API + 초경량 SoundFont (SF2).
   - **역할**: 마우스로 찍은 계이름(MIDI)이나 가사를 지연시간 없이 즉시 소리 내어 줍니다. 볼륨 조절, Mute(음소거), Solo 연주가 실시간으로 가볍게 가동됩니다.
2. **AI 스튜디오 렌더링 엔진 (Port 8001)**:
   - **기술**: `ACE-Step 1.5 XL DiT` AI 엔진.
   - **역할**: 사용자가 조율한 계이름 정보와 프롬프트를 취합해 영화 음악 급의 초고해상도 개별 MP3 Stem 음원으로 최종 렌더링합니다.

### 결정 3. 미들웨어: FastAPI Wrapper (Port 8002) 배치
* **역할**:
  1. **Natively Multi-Track Chaining**: 각 악기 트랙별로 독립적으로 오디오 꼬리(Tail)를 잘라내어 해당 트랙의 다음 마디로 자연스럽게 이식하는 비동기 작곡 오케스트레이션 수행.
  2. **WebSocket 실시간 중계**: 무거운 AI 생성 진행률(Progress)을 브라우저에 WebSocket으로 쏴주어 화면에 네온 프로그레스 바 작동.
  3. **프로젝트 영속화**: DAW 프로젝트 세션(트랙 리스트, Mute/Solo 상태, 볼륨값, 세그먼트 블록 배치)을 JSON 파일 데이터베이스로 영속화.

### 결정 4. 포트 바인딩 정책
* **Port 8001**: `ACE-Step XL DiT AI Engine` (기존 로컬 백엔드)
* **Port 8002**: `FastAPI Wrapper Backend` (오케스트레이션 백엔)
* **Port 5173**: `Vite + React + TS Frontend` (DAW 사용자 UI)

---

## 📂 2. 마스터 디렉토리 구조 (Directory Structure)

```
lobster-ai-daw/
├── .gitignore
├── README.md
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
│   │   ├── models/        # Pydantic 데이터 검증 모델 (BlockSpec 내 track_id 포함)
│   │   ├── core/          # CP949 로깅 및 인코딩 패치
│   │   └── utils/         # 오디오/Latent/파일 헬퍼 (6초 꼬리 추출 등)
│   ├── data/              # 로컬 데이터베이스 (JSON 프로젝트, 악기별 오디오 스템 캐시)
│   ├── pyproject.toml
│   └── requirements.txt
│
├── frontend/              # Vite + React + TS (포트 5173)
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx        # 3패널 Glassmorphism 멀티트랙 레이아웃
│   │   ├── components/    # UI 컴포넌트 (timeline/그리드, track/믹서, pianoroll/계이름, common)
│   │   ├── audio/         # Web Audio API (AudioEngine, SoundFont Player, Scheduler)
│   │   ├── store/         # Zustand Stores (project, playback, mixer, ui)
│   │   ├── services/      # API/WS 클라이언트 (wsClient.ts)
│   │   └── styles/        # theme.css, glassmorphism.css
│   └── tsconfig.json
```

---

## 🤝 3. 타 AI 에이전트(GPT Pro / Claude)와 협업 시 팁
* **멀티 트랙 아키텍처 연동**: 새로운 AI 에이전트에게 코딩을 맡길 때 이 청사진 문서를 제시하십시오. 
* **구조 유지**: 악기 트랙별 `track_id`를 기반으로 오디오 파형이 렌더링되고, 하단 피아노 롤에서 MIDI 계이름 노트를 수정하면 해당 트랙의 볼륨 페이더 및 음소거(Mute) 상태와 유기적으로 결합되어 소리가 믹싱되어야 함을 명확히 주지시키면 오작동을 방지할 수 있습니다.
