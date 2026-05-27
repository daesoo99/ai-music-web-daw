# Lobster AI DAW — 현재 상태
**R-12-FIX** 종결 - 블록 시각 겹침 수정 완료 및 durationSeconds 22s/60s 불일치 ACE-Step 추론 지연(b타입) 판정으로 R-13 이관.

사후 순서:
- R-3 체크리스트 작성 + 사용자 실측
- A-2 트랙 자동 배치 한국어 사전 보강

---

**R-6-FIX / R-9** 종결 - AI 엔진 VRAM OOM 해소 및 페이로드 key_scale 필드 동기화 완료.



사후 순서:

- R-3 체크리스트 작성 + 사용자 실측

- A-2 트랙 자동 배치 한국어 사전 보강



---
**R-12 진단·수정** — block_orchestrator latent chaining의 timelineStartSeconds 계산 + durationSeconds 불일치 확인 (Antigravity, 작업 프롬프트 다음 응답에 작성 예정)

이후 순서:
→ R-10 (ACESTEP_INIT_LLM 환경변수 비통작) — 우선순위 낮음, 본격 작업 사이 짬짬이
→ A-2 트랙 자동 배치 한국어 사전 + payload에 트랙 정보 전달 (R-11 해결의 절반)
→ A-4 Repaint UX 재설계 (R-1 흡수)
→ D-1·D-2 옵션 E 통합 (R-7·R-11·R-13 본질 해결)



| 항목 | 값 |
|---|---|
**ARCH-BLUEPRINT-UPDATE** — architecture_blueprint.md v2.2 정합화 (Antigravity, 작업 프롬프트 작성됨)

이후 순서:
→ R-3 체크리스트 작성 + 사용자 실측
→ A-2 트랙 자동 배치 한국어 사전 (본격 비전 작업 시작)
| 마지막 docx | v2.2 (2026-05-26) |
| 누적 변경 로그 | CHANGELOG.md 참조 |
| 협업 방법론 | 직렬_단일_Task_협업_방법론.docx |

---

**AGENTS-MD-UPDATE-V2** — R-5 방지 룰 박은 재실행 버전 (Antigravity, 작업 프롬프트 작성됨)

이후 순서:
→ ARCH-BLUEPRINT-UPDATE
→ R-3 체크리스트 작성 + 사용자 실측
→ A-2 트랙 자동 배치 한국어 사전 (본격 비전 작업 시작)

## 2. 결정 대기 (B 카테고리)

해당 Task 직전에만 답하면 됨. 지금 결정 안 해도 작업 막힘 없음.

| 코드 | 결정 항목 | Claude 권장 |
|---|---|---|
| B-3 | Block Split 시점 | 옵션 3 이후 |
| B-4 | Inspector 패널 시점 | A-4 묶음 |
| B-5 | 도슨트 출력 스타일 | 한국어 5~7문장 |
| B-6 | Piano Roll mp3 재생 | 옵션 A (mp3 재생 버튼) |
| B-신규1 | 우클릭 컨텍스트 메뉴 항목 | Repaint/Split/Delete/Duplicate/Properties 5개 |
| B-신규2 | Split 단일 액션 표준 | 단일 액션만 채택 |

확정된 결정 (변경 시 v2.X에 반영):
- B-1·B-2 Repaint UX = 표준 DAW 패턴
- B-7 트랙 자동 배치 = 별도 트랙 생성
- F-2 보컬 봉인 = 사실상 해제 (사후 추인)

---

## 3. 재검증 필요 (R 카테고리)

| 코드 | 항목 | 상태 |
|---|---|---|
| R-1 | Repaint UX 작동 불가 | A-4에 흡수 예정 |
| R-2 | Playhead 마커 변경 이력 | 영구 보류 (추적 불가) |
| R-3 | v1 시기 자산 재검증 | **종결** (회귀 0건, 메타 정정 v3.0) |
| R-3.S1 | ReplaceConfirmModal vs SwapConfirmModal | **종결** (둘 다 활성, 별개 목적) |
| R-4 | 8일 미커밋 §5 룰 위반 | 방지책 §5.4 적용됨 |
| R-5 | AGENTS-MD-UPDATE 임의 무시 | 방지책 적용됨 |
| R-6 | OOM 음악 생성 실패 | **부분 종결** (OOM 해소, LM 비활성은 R-10) |
| R-7 | 음악 퀄리티 저하 | 옵션 E 통합 의존 |
| R-8 | F-2 보컬 봉인 실 상태 불일치 | **종결** (LM 비활성 의도 채택, 적용은 R-10) |
| R-9 | keyscale → key_scale | **종결** (R-6-FIX 묶음 커밋 b6ee28e) |
| R-10 | ACESTEP_INIT_LLM 환경변수 비통작 | 신규, 우선순위 낮음 |
| R-11 | prompt 피아노 → 비피아노 출력 | 신규, 옵션 E·A-2 의존 |
| R-12 | 블록 시각 겹침 (start_time 0) | **신규, 다음 Task** |
| R-13 | ACE-Step 출력 앞뒤 무음 | 신규, 옵션 E 의존 |
---

## 4. git 상태

- working tree: **clean**
- origin/main 대비 **4 commits ahead**
- assume-unchanged 3개:
  - `ACE-Step-1.5/acestep/api/http/release_task_audio_paths.py`
  - `ACE-Step-1.5/start_api_server.bat`
  - (없음 — pyproject.toml은 커밋됨)

### 최신 커밋 5개

```
fedbe22 deps: add basic-pitch 0.4.0 + tensorflow 2.15.0 + loguru (Python 3.11 .venv, A-3e)
9118e53 chore: track AGENTS+architecture+package+vite+memory+handoff_v21, ignore backend/bin (A-3d)
a53f38e chore: ignore .bak backups and runtime logs (A-3c)
0028342 chore: track v1 frontend src + backend app + dev scripts (A-3b initial recovery snapshot for handoff v2.1)
158677b Feature: track-level block filtering query support (5월 19일)
```

---

## 5. 작업 순서 (큰 흐름)

| # | 작업 | 비용 | 상태 |
|---|---|---|---|
| 1 | git 위생 정리 5단계 (A-3·A-3b·A-3c·A-3d·A-3e) | 완료 | ✓ |
| 2 | v2.2 핸드오프 갱신 + CHANGELOG·STATUS 도입 | 완료 | ✓ |
| 3 | AGENTS-MD-UPDATE-V2 (R-5 방지 룰 박은 재실행) | 0.5h | **완료** |
| 3.5 | ARCH-BLUEPRINT-UPDATE (v2.0 → v2.2 정합화) | 0.5h | **다음** |
| 4 | R-3 체크리스트 작성 + 사용자 실측 | 30분 | 대기 |
| 5 | **A-2 트랙 자동 배치 한국어 사전** | 1~2h | **다음** |
| 6 | A-4 Repaint UX 재설계 (R-1 흡수) | 3~5h | 대기 |
| 7 | B-5 결정 → A-1 도슨트 한국어화 | 1h | 대기 |
| 8 | D-1 옵션 E·3 ACE-Step API 시그니처 검증 | 반나절 | 대기 |
| 9 | D-2 옵션 E (Cover Generation) 통합 | 1~2일 | 대기 |
| 10 | D-3 옵션 3 (Multi-Track stem) 통합 | 1~2일 | 대기 |
| 11 | D-4 Block Split | 0.5일 | 대기 |
| 12 | E-1 별점·로그·Edit History | 1일 | 대기 |
| 13 | E-2 디자인 갈아엎기 일괄 + 트랙 그룹화 | 1~2일 | 대기 |
| 14 | F-1·F-2 큰 결정 (전체 결과 보고 판단) | — | 대기 |

---

## 6. 환경 (v2.2 기준)

| 항목 | 값 |
|---|---|
| OS | Windows 11 |
| GPU | RTX 4060 8GB VRAM |
| RAM | 32GB |
| 시스템 Python | 3.12.2 |
| .venv Python | **3.11.13** (basic-pitch 호환) |
| 포트 | ACE-Step 8001, FastAPI Wrapper 8002, Vite 5173, Ollama 11434 |
| Ollama 모델 | gemma4:latest (9.6GB) |
| 작업 경로 | `C:\Users\kimdaesoo\.gemini\antigravity\music\lobster-ai-daw` |

---

## 사용 규칙

1. 매 Task 종결 시 Claude 답변 마지막 "STATUS 수정 부분" 섹션을 보고 사용자가 본 파일에서 해당 줄만 갱신
2. 항상 1~2페이지 분량 유지. 누적되면 안 됨
3. CHANGELOG.md (append-only)와 역할 분리:
   - CHANGELOG = 변경 이력 누적
   - STATUS = 지금 상태 스냅샷
4. 5~10 Task 누적 시 Claude가 핸드오프 docx 풀 재생성하며 본 STATUS도 같이 갱신
