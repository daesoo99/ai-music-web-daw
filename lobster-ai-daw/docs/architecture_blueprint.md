# 🦞 Lobster AI Music Web DAW - 마스터 아키텍처 청사진 (v2.0)

이 문서는 **Lobster AI Music Web DAW** 프로젝트의 핵심 아키텍처를 정의한 **마스터 청사진**입니다.
GPT Pro, Claude 등 외부 AI 에이전트에게 작업을 맡길 때 이 파일을 컨텍스트로 제공하세요.

**최종 업데이트: 2026-05-19**

---

## 🛠️ 1. 포트 바인딩 정책
| 포트 | 역할 |
|------|------|
| 8003 | ACE-Step AI Engine (GPU, 음악 생성) |
| 8002 | FastAPI Wrapper Backend (오케스트레이션) |
| 5173 | Vite + React + TS Frontend (DAW UI) |
| 11434 | Ollama (AI 도슨트용 gemma2:4b) |

---

## 🏗️ 2. 핵심 아키텍처 결정 (확정)

### 결정 1: 멀티 트랙 2D 그리드
- **Y축**: 악기 트랙 (piano, strings, drums, bass 등, 각각 고유 `track_id`)
- **X축**: 시간 블록 (가변 길이, `timelineStartSeconds` + `durationSeconds`)
- 블록은 `previous_block_id`로 체이닝 → 자연스러운 이어지는 작곡 (Relayed Composition)

### 결정 2: MIDI 데이터 저장 전략 (B안 채택)
- `useNotesStore` **분리 + Lazy-load + LRU-20** — 메인 프로젝트 스토어에 음표 넣지 않음
- 블록 더블클릭 시 `GET /api/blocks/:id/midi` 호출 → 캐시에 저장
- 드럼 트랙은 Basic Pitch 정확도가 낮아 `status: "unavailable"` graceful degradation

### 결정 3: 악기 스왑 파이프라인
```
블록 드래그→드롭 → SwapConfirmModal (프롬프트 입력)
→ POST /api/blocks/swap-instrument
→ Basic Pitch transcription (.mid 파일) — CPU, GPU 락과 무관
→ FluidSynth MIDI→WAV (reference audio)
→ ACE-Step audio2audio (repaint_strength=0.45, 멜로디 윤곽 보존)
→ 새 블록 생성 (원본 블록 유지, A/B 비교 가능)
```

### 결정 4: AI 도슨트 스트리밍
```
블록 클릭 → PianoRollModal → "이 음악 분석하기" 버튼
→ POST /api/blocks/analyze
→ analyst.py (block_meta + MIDI 통계 → Ollama prompt)
→ NDJSON 스트림 → AnalysisPanel 실시간 표시
```

### 결정 5: 백그라운드 작업 관리
- **GPU 작업**: `asyncio.Semaphore(1)` — ACE-Step 동시 실행 1개 제한 (8GB VRAM 보호)
- **CPU 전사 작업**: `asyncio.Semaphore(2)` — Basic Pitch 최대 2개 병렬
- `task_registry.py`의 `spawn_job()` — 모든 백그라운드 작업 등록/추적

---

## 📂 3. 현재 디렉토리 구조

```
lobster-ai-daw/
├── docs/architecture_blueprint.md   ← 이 파일
├── backend/
│   ├── app/
│   │   ├── main.py                  (lifespan, 라우터 등록, Basic Pitch 워밍업)
│   │   ├── api/routes/
│   │   │   ├── blocks.py            (POST /sequence, transcription spawn_job)
│   │   │   ├── midi.py              (GET /blocks/:id/midi, POST /analyze, POST /swap-instrument)
│   │   │   ├── repaint.py
│   │   │   ├── ws.py
│   │   │   └── audio.py
│   │   ├── models/
│   │   │   └── midi.py              (Note, BlockMidi, AnalyzeRequest, SwapInstrumentRequest)
│   │   └── services/
│   │       ├── block_orchestrator.py (generate_block, dispatch_transcription, swap_instrument)
│   │       ├── midi_transcriber.py   (Basic Pitch 래핑, Krumhansl key detection)
│   │       ├── midi_synth.py         (FluidSynth CLI → WAV)
│   │       ├── analyst.py            (Ollama Gemma 스트리밍 도슨트)
│   │       ├── progress_broker.py    (WebSocket fan-out, ⚠️ publish_global 미구현)
│   │       ├── state_store.py        (in-memory, ⚠️ save_midi/get_midi 미구현)
│   │       ├── task_registry.py      (spawn_job 추적)
│   │       └── acestep_client.py
│   └── data/
│       └── projects/test-proj/
│           ├── blocks/*.mp3          (생성된 오디오)
│           └── midi/*.mid            (Basic Pitch 추출 MIDI, 추후)
│
└── frontend/src/
    ├── App.tsx                       (27줄, 레이아웃 골조만)
    ├── audio/
    │   ├── AudioEngine.ts            (Web Audio API 엔진)
    │   └── BlockScheduler.ts         (블록 스케줄링, 30Hz playhead)
    ├── components/daw/               (13개 컴포넌트)
    │   ├── DawHeader.tsx
    │   ├── DawSidebar.tsx
    │   ├── DawFooter.tsx
    │   ├── Timeline.tsx
    │   ├── TrackRow.tsx              (onDrop → 악기 스왑 트리거)
    │   ├── TrackBlock.tsx            (더블클릭 → PianoRollModal, draggable)
    │   ├── TransportControls.tsx
    │   ├── SelectionOverlay.tsx      (2단 컴포넌트, 드래그 중 비활성 트랙 0 리렌더)
    │   ├── ChatComposer.tsx          (AI 작곡 채팅)
    │   ├── JobMessageView.tsx        (진행률 표시)
    │   ├── PianoRollModal.tsx        (SVG 피아노 롤)
    │   ├── AnalysisPanel.tsx         (도슨트 스트리밍)
    │   └── SwapConfirmModal.tsx      (악기 스왑 확인)
    ├── store/                        (7개 Zustand stores)
    │   ├── useProjectStore.ts
    │   ├── usePlaybackStore.ts       (BlockScheduler 래핑, 30Hz currentTime)
    │   ├── useMixerStore.ts
    │   ├── useSelectionStore.ts
    │   ├── useJobStore.ts
    │   ├── useNotesStore.ts          (Lazy-load + LRU-20)
    │   └── useSwapStore.ts
    ├── hooks/
    │   ├── useGlobalShortcuts.ts     (ESC → clearSelection)
    │   ├── useTimelineDrag.ts        (mousemove/mouseup → endDrag)
    │   └── useSwapInstrument.ts      (swap API 호출)
    ├── services/
    │   ├── composeService.ts         (composeSequence, repaintSegment)
    │   └── wsClient.ts               (WS 연결, block_ready/midi_ready 핸들러)
    ├── constants/instruments.ts
    ├── types/
    │   ├── audio.ts                  (TimelineBlock, TimelineTrack)
    │   └── midi.ts                   (Note, BlockMidi)
    └── utils/formatTime.ts

```

---

## ⚠️ 4. 현재 알려진 버그 / 미구현 (2026-05-19)

| 우선순위 | 항목 | 위치 | 설명 |
|---------|------|------|------|
| 🔴 Critical | WS 이벤트 이름 불일치 | wsClient.ts L28 | 백엔드: `block_complete` / 프론트: `block_ready` → 타임라인에 블록 안 보임 |
| 🟡 Medium | Play 피드백 없음 | - | 위 버그 수정 후 자동 해결 예상 |
| 🟠 Low | StateStore midi 메서드 없음 | state_store.py | `save_midi()`, `get_midi()`, `save_midi_status()` 추가 필요 |
| 🟠 Low | ProgressBroker.publish_global 없음 | progress_broker.py | 모든 subscriber 브로드캐스트 메서드 |
| 🟠 Low | basic-pitch Windows 설치 불가 | pyproject.toml | tensorflow-io-gcs-filesystem win_amd64 없음 → ONNX 대안 필요 |

---

## 🤝 5. 외부 AI 에이전트 협업 시 필수 주의사항
1. **Zustand shallow selector 패턴 유지** — 모든 컴포넌트는 `s => s.fieldName` 형태로 필요한 필드만 구독
2. **App.tsx는 레이아웃 골조만** — 비즈니스 로직은 hooks/services로 분리
3. **GPU 락 필수** — ACE-Step 호출은 반드시 `async with self._gpu_lock:` 안에서
4. **이벤트 이름 통일** — WS 이벤트 타입 변경 시 backend와 frontend 양쪽 동시 수정
5. **드럼 트랙** — track_id에 "drum" 또는 "perc" 포함 시 Basic Pitch 스킵 → `status: "unavailable"`
