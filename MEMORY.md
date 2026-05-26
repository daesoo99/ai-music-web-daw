# Lobster AI DAW - Long-Term Memory
**마지막 업데이트: 2026-05-21**

---

## 프로젝트 핵심 정보
- **프로젝트명**: Lobster AI DAW
- **구조**: FastAPI(8002) + React/Vite(5173) + ACE-Step AI 엔진(8001)
- **경로**: `C:\Users\kimdaesoo\.gemini\antigravity\music\lobster-ai-daw`
- **핵심 차별점**: Multi-track 제어, Repaint(In-painting), 타임라인 Seek, 단계별 진행률

---

## 사용자 비전 & 지시 (고정)

사용자가 원하는 것:
- 음악 용어를 모르는 사용자가 UI에서 시작
- 음악 들으면서 특정 구간 선택 → AI에게 변경 지시 → 재생성
- 파트를 on/off하면서 넣었다 뺐다, 다른 악기로 교체

**음악 취향**: Millennium Parade, King Gnu (Aizo/Specialize), 조성진, 아이유, Jane Doe, 추격, 엘카미넬, 아이나의노래, 스타워즈 게임 OST, Lil Nas X (Montero 앨범)

**작업 원칙**:
- 사용자 비전 > Antigravity 추천
- AI 어투/과장/미사여구 금지 ("프리미엄", "미려함", "뼈아프게" 등)
- 팩트와 수치 위주 문체

---

## 완료된 기술 마일스톤

### Phase 1 전체 완료 (2026-05-18~19)
- 13개 모듈형 UI 컴포넌트 구축 (App.tsx + 12개 DAW 컴포넌트)
- 7개 Zustand 스토어 설계 (useProjectStore, usePlaybackStore, useMixerStore, useSelectionStore, useJobStore, useNotesStore, useSwapStore)
- StateStore MIDI 속성 구현 (thread-safe save_midi/get_midi)
- ProgressBroker 글로벌 브로드캐스트 (publish_global)
- WS 타임라인 타임스탬프 오프셋 보정
- Windows 환경 basic-pitch & tensorflow 설치 성공
- 초강력 이중 Fallback Transcriber 도입
- MIDI 파일 서빙 엔드포인트 추가
- Loguru 의존성 복구 & TypeScript 컴파일 에러 제거
- NaN% 프로그레스 버그 수정 (wsClient.ts progress/fraction 혼재 처리)
- Zustand 데이터 레이스 수정 (setProject 단일 호출 통합)
- Photoshop 스타일 작업 이력(Action History) — Ctrl+Z/Y, 50개 FIFO
- 명작 아카이브 (Named Archives) 백엔드 CRUD + UI
- WebSocket 지수 백오프 자동 재연결
- 백엔드 캐시 정리 스케줄러
- block_orchestrator.py DRY 페이로드 공통화 & Deprecated API 제거
- 프론트엔드 Job 메시지 자동 소멸 & FIFO 20개 제한
- 브라우저 통합 검증 23/23 PASS

### Phase 2 버그 패치 완료 (2026-05-20)
- TrackBlock 스크롤 버그 (e.preventDefault())
- Repaint 결과 isActive=false 로직 제거
- Length 슬라이더 step=10s
- 180s 레이블 CSS
- Soft Cancel (useJobStore.cancelJob())
- 생성 중 Undo/Redo + Ctrl+Z/Y 차단

### Phase 2.5 UX 개선 완료 (2026-05-21)
- **Timeline Seek / Scrubbing**: 눈금자 드래그 → 플레이헤드 실시간 이동, mouseup 시 seekTo()+play() 재개
- **드래그 락 & 무한 툴팁 버그**: Drag Threshold 5px + ✕ 닫기 버튼 + clearSelection()
- **진행률 정교화 (백엔드)**: 폴링 간격 3s→0.5s, ACE-Step API 실제 progress 필드 읽기, heuristic fallback
- **진행바 CSS shimmer**: cubic-bezier 0.6s + 보라-파랑 그라디언트 흐름 애니메이션
- **JobMessageView 한글 단계 텍스트**: "큐 대기 중..." / "AI 모델 초기화..." / "생성 중 (X%)" / "마무리 중 (X%)"

---

## 미해결 이슈

| 이슈 | 내용 | 우선순위 |
|---|---|---|
| **#3** | 브라우저 100% 줌에서 가로 overflow 발생. max-width:100vw + overflow-x:auto 적용 필요 | **즉시** |
| 8 | Repaint 결과 trackId 결정 방식 불명 (새 트랙 자동 생성인지, 기존 트랙 배치인지) | E2E 검증 시 |
| - | ACE-Step progress 필드 실제 지원 여부 미확인 (heuristic fallback 동작 중) | 검증 필요 |

---

## 아키텍처 결정 사항 (고정)

- MIDI 노트 데이터는 `useNotesStore` (Lazy-load, LRU-20) — 메인 스토어에 넣지 않음
- 악기 교체 파이프라인: MIDI 추출(Basic Pitch, CPU) → FluidSynth WAV 렌더 → ACE-Step repaint (repaint_strength=0.45)
- Transcription: 블록 완료 후 자동 비동기 디스패치 (CPU 백그라운드, GPU 독립)
- Ollama: gemma2:4b at localhost:11434 (스트리밍 AI Docent 분석용)
- 블록 구조: "하나의 트랙 = 하나의 긴 오디오" (30초 블록 5개 붙이기 구조 폐기)

---

## [중요] Claude 잘못된 사전 정보 정정

Claude 직전 세션 언급 중 8건이 틀렸음 (ACE-Step 1.5 공식 문서 확인 결과):
1. "인스트루멘탈만 됨, 보컬 불가" → 50+ 언어 보컬 native 지원 (한국어 포함)
2. "한국 가사/보컬 안 됨" → 가능
3. "Stem 분리는 Demucs 별도 통합" → Track Extraction native 지원
4. "Multi-Track Layering은 먼 미래" → native 지원
5. "Cover Generation 별도 모델" → native 지원
6. "Vocal2BGM 별도 작업" → native 지원
7. "9개 컴포넌트 통합 테스트 필요" → ACE-Step 단독으로 6가지 native 지원
8. "보컬은 Phase D에서 클라우드 GPU 필요" → 8GB VRAM + LM 0.6B로 가능

**교훈**: 훈련 이후 출시된 최신 도구의 capability는 공식 문서 먼저 확인. 확언 제거.

---

## 다음 세션 우선순위
1. 이슈 #3 가로 overflow 수정
2. Phase 2 E2E 검증 (사용자 직접)
3. ACE-Step progress 실제 연동 확인 (백엔드 로그 "Real task progress: X%" 확인)
4. 방향 결정 — 사용자 옵션 A/B/C