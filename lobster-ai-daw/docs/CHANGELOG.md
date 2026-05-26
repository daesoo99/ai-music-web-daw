# Lobster AI DAW 변경 로그 (CHANGELOG)

가장 최근이 위. 매 Task 종결 시 1~3줄 추가. **append-only** — 절대 이전 내용 삭제 금지.

핸드오프 docx는 5~10 Task 누적 시 풀 재생성. 그 사이의 변경은 본 CHANGELOG로 추적.

---


## 2026-05-26 (v2.1

### A-FIX-2 (relocated)
- Methodology/ 협업 방법론 자산 정식 추적
- 핸드오프 v2.2 docx 추적 → v2.2 라운드)

### A-FIX-1 (relocated)
- CHANGELOG·STATUS 위치 정정 (루트 → lobster-ai-daw/docs/)
- 이전 빈 파일 추적 제거, Claude 작성본 정식 등록

### A-3e (커밋 `fedbe22`) — git 위생 정리 종결
- `pyproject.toml` 커밋. basic-pitch 0.4.0 + tensorflow 2.15.0 + tensorflow-io-gcs-filesystem 0.31.0 + loguru 0.7.3
- Antigravity 추가 조사로 .venv Python 3.11.13 + cp311-cp311-win_amd64 공식 wheel 정상 설치 확인
- 영향: v2.1 §4.5 "basic-pitch Windows 설치 불가" 라벨 무효화

### A-3d-실행 (커밋 `9118e53`) — git 추적 위생 정리
- ACE-Step-1.5/ 내 자동 패치 파일 2개 assume-unchanged (release_task_audio_paths.py, start_api_server.bat)
- 안전 4개 커밋: AGENTS.md, architecture_blueprint.md, package.json, vite.config.ts
- 추가: memory/ (2026-05-19.md, 2026-05-21.md), lobster-ai-daw/docs/Lobster_AI_DAW_핸드오프_v2_1_2026-05-26.docx
- .gitignore에 backend/bin/ 추가

### A-3d-진단 — 정체 불명 4건 조사
- modified 7개 + untracked 3개 + 원격 origin/main 발견
- start_api_server.bat의 ACESTEP_INIT_LLM=auto→true 변경 발견 → 보컬 봉인 해제 상태로 확인
- pyproject.toml 변경이 2026-05-19 새벽 작성 후 8일째 미커밋 잔존 발견 (R-4 신규)

### A-3c (커밋 `a53f38e`) — git 추적 위생 정리
- ChatComposer.tsx.bak, ChatComposer.tsx.bak2 추적 제거
- .gitignore에 *.bak, *.bak[0-9], *.log 추가

### A-3b (커밋 `0028342`) — 추적 누락 복구
- frontend/src/ + backend/app/ + dev scripts 110개 파일 일괄 add
- 사용자 의심("정말 해결됐는가") 확정 — 핵심 자산 거의 전부 untracked 상태였음
- 영향: R-2 (Playhead 마커 그랩 변경 이력) 추적 영구 불가능 확정

### A-3 — git untracked 진단
- 추적 파일 56개에 불과. frontend/src 거의 전부 untracked
- .gitignore 정상. 단순 git add 누락이 원인
- 사용자 의심 적중

### R-1 무효화 → A-4 흡수 결정
- Antigravity Task 2 "드래그 선택 정상 작동" 결론 무효화
- 사용자 실측: 블록 위 드래그 = 블록 이동 우선 / 빈 영역 = 에러 무조건
- §5 룰 위반 1번째 사례. A-4 Repaint UX 재설계에 흡수 예정

### R-2 영구 보류 라벨 확정
- Playhead 마커 그랩 신규/기존 변경 이력 추적 불가능
- TimelineRuler.tsx가 A-3b 이전 untracked 상태였으므로 git log 추적 영원히 불가능

### R-3 체크리스트 작성 대기
- v1 시기 완료 항목 일괄 재검증 필요
- ReplaceConfirmModal vs SwapConfirmModal 정체 확인 항목 추가 (A-3b 결과에서 발견)

### R-4 신규 — §5 룰 위반 2번째 사례
- 2026-05-19 pyproject.toml 변경이 8일째 미커밋 + 누락 미명시
- §5.4 룰 위반 방지책에 "변경 즉시 커밋 또는 누락 명시" 추가


### R-5 신규 — §5 룰 위반 3번째 사례
- AGENTS-MD-UPDATE Task에 Antigravity가 AGENTS.md 변경 0, CHANGELOG·STATUS 빈 껍데기 생성
- 작업 프롬프트 임의 무시 + 다른 작업 수행 + 의도된 것처럼 보고
- §5 룰 "임의 생략·변경 금지" 위반
- 방지책: 작업 프롬프트에 "작업 프롬프트 절차 정확히 따름" 룰 1줄 추가


### Antigravity 신뢰 회복 신호
- A-3d 추가 조사에서 자발적으로 .venv Python 버전 + WHEEL 파일 cp311 태그까지 확인
- §5 룰 "객관 근거 제시" 정확 준수. R-1·R-4 두 위반과 대조

### 보컬 봉인 정책 — 사후 추인
- start_api_server.bat이 이미 ACESTEP_INIT_LLM=true 상태로 5~8일 운영
- 사용자 결정: 봉인 해제 유지. 가사 미입력으로 인스트루멘탈만 사용하는 정책
- 핸드오프 v2.2 §4.3 + §4.6 F-2 라벨 갱신

### 청취 검증 α (재현성) — 실패 확정
- 동일 prompt "Solo grand piano, slow 60bpm, melancholic" 2회 생성 비교
- 사용자 청각: "전혀 다른 음악 같다"
- librosa 정량: Chroma top 3 다름(G·A·E vs C·G·B), Onset 2.5배 차이(41 vs 96), BPM 60→117/123 미준수
- 결론: 옵션 E (Cover Generation) 통합 필수 확정

### 청취 검증 γ (음질) — 4.5/10
- 사용자 평가: piano 음색은 일관, 다만 디테일 부족
- 영향: 옵션 E 통합 후 reference audio 음질 보존으로 자동 개선 예상

### 청취 §5.1 — 단일 악기 prompt 혼입 검출
- 두 파일 모두 Spectral Centroid 1000~1100Hz piano 범위
- piano에서는 혼입 없음. 다른 악기는 미검증

### Repaint UX 결정 — 표준 DAW 패턴 채택
- B-1·B-2 확정: 우클릭 컨텍스트 메뉴 + 빈 영역 드래그=새 블록 + 블록 드래그=이동
- A-4 작업에서 구현 예정

### Split 표준 채택
- 단일 액션만 채택 (Logic·Ableton·FL Studio·REAPER 공통)
- N등분·다중 마커 split은 만들지 않음

### 트랙 자동 배치 — 별도 트랙
- B-7 확정: 모든 악기 분리 (오케스트라식)
- A-2 한국어 사전 보강에 반영

### 옵션 C 명확 배제 / 옵션 E 필수 확정
- 옵션 C (basic-pitch + FluidSynth) = 인공 합성음 → 사용자 비전 King Gnu 변주와 충돌
- 옵션 E = reference audio conditioning → 사용자 비전 정확히 부합

### 작업 진행 방식 — 직렬 단일 Task 합의
- 사용자 통찰: "한 번에 다 넣지 말고 하나를 확실히"
- 모든 작업 프롬프트 단일 Task로 분리. 묶음 금지

### 협업 방법론 문서 추출
- 시행착오 정리해 별도 md + docx 산출
- 사람·LLM·코드 에이전트 3자 협업에 재사용 가능
- 12개 핵심 섹션 + 8가지 원칙 + 카테고리 체계

### Antigravity 자기 검열 작동 사례
- ".bak 파일 삭제 보고에서 금지어 "완전히" 자체 적발 후 정정
- §5 룰 자기 적용 시작 신호. R-5 후 신뢰 회복 진행 중

---

## 2026-05-25 (v2.1 작성 시점)

v2.1 docx 부록 A 참조. 이전 누적 변경은 docx의 §A.2 (v1 시기 누적) 참조.

핵심 baseline:
- App.tsx 27줄 + 13컴포넌트 + Zustand 7스토어 + AudioEngine·BlockScheduler
- 백엔드 FastAPI Wrapper + 라우터 6개 + 서비스 8개
- GPU 락 Semaphore(1), CPU 전사 락 Semaphore(2)
- 토큰화 (색 25 + 여백 20 + 폰트 8 + radius 5)
- AI 도슨트 (Gemma4 영어 280단어 — A-1 한국어화 대상)

---

## 사용 규칙

1. 매 Task 종결 시 Claude 답변 마지막 "CHANGELOG 추가 라인" 섹션을 보고 사용자가 본 파일에 1~3줄 추가
2. 추가 위치: 가장 최근 날짜 섹션 맨 위. 날짜 바뀌면 새 ## 섹션 생성
3. 절대 이전 내용 삭제·수정 금지 (append-only)
4. 5~10 Task 누적 시 Claude가 핸드오프 docx 풀 재생성. 본 CHANGELOG는 그대로 유지

핸드오프 docx 풀 재생성 시 가장 최근 docx 버전 위치는 STATUS.md "마지막 docx" 항목에 기록.
