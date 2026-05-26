# Lobster AI DAW - soo_todo.md (최종 정리본 2026-05-21)

> 이 문서는 Antigravity + 사용자 + Claude 3자가 공유하는 진행 현황·결정 사항 추적 파일입니다.
> **마지막 업데이트: 2026-05-21 00:47 KST**

---

## 🔴 사용자 직접 결정 필요 (가장 급)

| # | 항목 | 현황 |
|---|---|---|
| 1 | **Phase 2 마감 후 옵션 결정 (A/B/C)** | Lobster 계속 vs Gradio 직접 vs 병행 — 결정 전 |
| 2 | **VRAM 한계 도달 테스트 예정** | 60s/120s/180s 생성 + 보컬 봉인 해제 도전 여부 |
| 3 | **DC 게시물의 "Gemma 4 26B BF16" 확보 여부** | 게시물에서 직접 물어볼지, 무시할지 결정 안 됨 |

---

## 🟡 Antigravity에게 물어봐야 할 것 (검증 낙오)

| # | 항목 | 확인 여부 |
|---|---|---|
| 4 | `wsClient.ts`의 `source_block_id` 분기가 실제 있는가 | 미확인 |
| 5 | `TimelineBlock`의 `isActive`, `isRepaintOf` 필드가 실제 있는가 | 미확인 |
| 6 | `AGENTS.md`에 교정 지침 실제 기록되었는지 | 미확인 |
| 7 | Puppeteer 캡처 PNG 2개 실제 파일 존재 | 미확인 |
| 12 | Soft Cancel 후 즉시 새 작업 시작 시 GPU 충돌 가능성 | 미검증 |
| 13 | `claude-ai-music-skills`의 mix-engineer / mastering-engineer가 실제 Lobster 백엔드에서 호출되는 코드 경로 | 미확인 |
| 14 | `music-composition-main`의 LLM system prompt가 진짜 주입되는지 | 미확인 |
| 15 | `cover_noise_strength=0.5` 제거 전후 실제 Repaint 결과 차이 | 미검증 |

---

## 🟢 완료된 작업 전체 목록

### Phase 1 전체 (완료)
- Phase 1.1~1.5: UI 컴포넌트 13개, Zustand 스토어 7개, 백엔드 FastAPI 구축

### Phase 2 버그 패치 (완료 - 2026-05-20)
| # | 항목 | 상태 |
|---|---|---|
| ✅ | TrackBlock 스크롤 버그 (`e.preventDefault()`) | 완료 |
| ✅ | Repaint 결과 isActive=false 로직 제거 | 완료 |
| ✅ | Length 슬라이더 step=10s | 완료 |
| ✅ | 180s 레이블 CSS | 완료 |
| ✅ | Soft Cancel (`useJobStore.cancelJob()`) | 완료 |
| ✅ | 생성 중 Undo/Redo + Ctrl+Z/Y 차단 | 완료 |

### Phase 2.5 추가 UX 개선 (완료 - 2026-05-21)
| # | 항목 | 상태 |
|---|---|---|
| ✅ | **Timeline Seek / Scrubbing** — 눈금자 드래그로 플레이헤드 이동 | 완료 |
| ✅ | **드래그 락 & 무한 툴팁 버그** — Drag Threshold 5px + ✕ 닫기 버튼 + clearSelection() | 완료 |
| ✅ | **진행률 정교화 (백엔드)** — 폴링 0.5s, 실제 progress 필드 읽기, heuristic fallback | 완료 |
| ✅ | **진행바 CSS shimmer 애니메이션** — cubic-bezier 0.6s + 보라-파랑 그라디언트 흐름 | 완료 |
| ✅ | **JobMessageView 단계별 한글 텍스트** — "큐 대기 중..." / "AI 모델 초기화..." / "생성 중 (X%)" 등 | 완료 |

---

## 🔴 미해결 이슈

| # | 항목 | 우선순위 |
|---|---|---|
| ~~#3~~ | ~~100% 줌 가로 overflow~~ — globals.css 내 .daw-workspace overflow-x: auto 적용 완료 | ~~즉시 처리~~ |
| 8 | Repaint trackId 결정 방식 불명 — 새 트랙 자동 생성인지, 기존 트랙 배치인지 미명시 | 다음 E2E 검증 시 |
| 10 | 포트 5173/5175 좀비 프로세스 정리 필요 (현재는 task 재시작으로 임시 해결) | 낮음 |
| 11 | Soft Cancel UX 메시지 "GPU 작업은 계속 진행되지만 결과는 무시됩니다" 미반영 | 낮음 |
| - | ACE-Step progress 필드 실제 지원 여부 미확인 (heuristic fallback 동작 중) | 검증 필요 |

---

## 📊 현재 진행 상황 (2026-05-21 기준)

| 단계 | 상태 | 비고 |
|---|---|---|
| Phase 1.1~1.5 | ✅ 완료 | |
| Phase 2.1 Selection 추출 | ✅ (사용자 부분 검증) | |
| Phase 2.2 ChatComposer Repaint 모드 | ✅ 완료 | |
| Phase 2.3 백엔드 acestep_client / block_orchestrator | ✅ 완료 | |
| Phase 2 이슈 9개 패치 | ✅ 6개 완료 / 1개 낙오(#3) | |
| Phase 2.5 UX 개선 3건 | ✅ 완료 | |
| Phase 2 E2E 검증 | ✅ 완료 (E2E 통과) | 60초 생성 E2E 테스트 성공 완료 (2026-05-22) |
| Phase 3 (MIDI 봉인 해제) | ⏸ 우선순위 재평가 | 옵션 8 참조 |

---

## 🖥️ 서버 상태

| 포트 | 역할 | 상태 |
|---|---|---|
| 8002 | FastAPI 백엔드 (uvicorn) | ✅ RUNNING (task-1996) |
| 5173 | Vite 프론트엔드 | ✅ RUNNING (task-1629) |
| 8001 | ACE-Step 1.7B AI 엔진 | ✅ RUNNING (task-1730) |

---

## 📋 다음 세션 우선순위

1. **이슈 #3 가로 overflow 수정** (즉시)
2. **Phase 2 E2E 검증** — 사용자 직접 브라우저에서 생성 → Repaint → Seek → Cancel 흐름 테스트
3. **ACE-Step progress 실제 연동 확인** — 음악 생성 시 백엔드 로그에서 "Real task progress: X%" 확인
4. **Phase 2 마감 후 방향 결정** — 사용자 옵션 A/B/C 선택

---

## 📝 사용자 비전 요약

> "처음 원한 건 음악을 만들거나 음악을 용어을 모르는 사용자가 ui에서 시작하는거야. 그리고 음악 으면서 특정 구간을 선택하고 바꾸다고를 전달하면 다시 수정하고. 그리고 이기 부분을 on off 하면서 넣었다 뺐다 다른 악기로도 교체하고 이런 게 만들고 싶었어"

**핵심 취향:** Millennium Parade, King Gnu, 조성진, 아이유, Jane Doe 느낌, 추격/엘카미넬 같은 노래도 좋아함.
**작업 원칙:** 사용자 비전 > Antigravity 추천. AI 어투/과장 금지. 팩트 위주.

---

## 0. [Claude] 잘못된 사전 정보 정정 (중요)

ACE-Step 1.5 공식 문서 확인 결과, Claude가 직전 세션에서 언급했던 것들 중 8건이 틀렸음:

| 항목 | Claude의 잘못된 언급 | 실제 |
|---|---|---|
| 1 | "Lobster에서 인스트루멘탈만 됨, 보컬 불가" | ACE-Step 1.5는 50+ 언어 보컬 native 지원, 한국어 포함 |
| 2 | "한국 가사/한국어 보컬 안 됨" | 가능, K-pop·발라드·힙합 지원 |
| 3 | "Stem 분리는 Demucs 별도 통합 필요" | ACE-Step이 Track Extraction native 지원 |
| 4 | "Multi-Track Layering은 먼 미래 Phase D" | ACE-Step이 Multi-Track Generation native 지원 |
| 5 | "Cover Generation 별도 모델 필요" | ACE-Step이 Cover Generation native 지원 |
| 6 | "Vocal2BGM은 별도 작업" | ACE-Step이 Vocal2BGM native 지원 |
| 7 | "9개 컴포넌트 통합 테스트 필요" | ACE-Step 1.5 단독으로 6가지 작업 native 지원 |
| 8 | "보컬·노래는 Phase D에서 클라우드 GPU 필요" | 8GB VRAM에서도 LM 0.6B 모델로 보컬 가능 |

**결론:** `ACESTEP_INIT_LLM="false"` + `lyrics="[Instrumental]"` 설정은 사용자(또는 Antigravity)의 선택이지, 모델 한계가 아님.

---

## 1. 사용자 비전 (원문 그대로)

> "처음 원한 건 음악을 만들거나 음악을 용어을 모르는 사용자가 ui에서 시작하는거야. 그리고 음악 으면서 특정 구간을 선택하고 바꾸다고를 전달하면 다시 수정하고. 그리고 이기 부분을 on off 하면서 넣었다 뺐다 다른 악기로도 교체하고 이런 게 만들고 싶었어"

> "일단 정착은 계속 ai가 맞거나. 이거 이렇게 말로 하면 고치겠다."

> "ktl 취향 이런거 안쓰고 싶어. 지금 하던대로 만들고 싶어. 내 취향 찾기가 어려워서."

---

## 2. 사용자 음악 취향 (원문)

> "millenium parade랑 kinggnu(aizo, specialize 같은 노래) 그리고 조성진이랑 꽃구름속에 같은 가곡도 좋아하고 하얀눈박이 느낌의 아야나모 느낌못 느낌이이도 좋아해. jane doe느낌의 음악도 좋아하고 이정이름 못부르면도 좋아하고 추격, 엘카미넬 같은 노래도 좋아해"

> "야누 1 2 3도 엄청 좋아하고 아이나의 legend앨범 좋아해. 스타워즈 게임, 강연호 ost거의 좋아하고 조마야 이이 좋아해요. 크레딧노래 좋아하고 릴나스엑스 montero앨범 진짜 좋아해"

---

## 3. 사용자가 명시적으로 결정 변경한 항목

> "lobster에서 처음에 30초 블록을 5개 붙이는 구조였는데 이게 아니더라 안티그래비티가 추천한거야. 굳이 해야돼?"

**[Claude] 반영:** 옵션 B 채택. "하나의 트랙 = 하나의 긴 구조". 블록 추상화 없이 구현하고 사용자에게 안 보임. Length 슬라이더 30s → 180s 확장.

---

## 8. Phase 3 (MIDI 봉인 해제) 우선순위 재평가

v1에서 "Phase 3 = MIDI 봉인 해제 = 사용자 비전 핵심"이라고 했으나 정정 결과 요약:

| 사용자 비전 | MIDI가 필요한가? |
|---|---|
| "악기 교체" (swap) | **ACE-Step Cover Generation으로 대체** → Phase 3 불필요 |
| "악기 편집 (내가 직접)" | basic-pitch + FluidSynth 통합 필요 → Phase 3 |

**Phase 3는 "직접 편집"에만 필요.** 악기 교체는 ACE-Step API 호출 추가로 해결. Phase 3 우선순위 낮춤.

---

## 9. VRAM 8GB 한계 테스트 안전성 ([사용자] 질문 답)

**단발적인 도전으로 하드웨어 수명 영향 없음.** 이유:
1. OOM은 GPU 메모리 한계 도달 시 발생 — 하드웨어 이상 아님, 프로세스가 에러로 종료됨
2. 온도 관리는 RTX 4060 Laptop GPU 자체가 ~87°C 이상 달성 시 thermal throttling으로 자동 감속
3. 진짜로 하드웨어 갉아먹는 것 — 지속적인 24시간/일 풀로드, 배터리 100%/0% 반복 충전

**결론:** 단발 OOM 도전은 수명에 무의미. 충전기 연결 상태에서 여유 있게 실험 권장.

---

## 10. 작업 원칙 (고정)

> **[사용자]**: 안티그래비티 추천보다 사용자 비전이 충돌하면 사용자 비전 우선

1. **[사용자]**: 비전 정의, UI 판단, 의사결정
2. **[Antigravity]**: 로컬 코드 작성·실행·검증
3. **[Claude]**: 설계, 트러블슈팅, 최신 AI 컨텍스트 검증 (단, 훈련 이전 정보 부족 시 검증 필수, 확언 제거)

금지 문체: "프리미엄", "쫀득", "세련", "고급스러움", "미려함", "명품", "100% 확실", "극단적으로", "뼈아프게", 미적 비유.
문체: "~입니다/습니다", 사실 위주, 수식 최소.