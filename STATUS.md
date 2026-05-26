# Lobster AI DAW — 현재 상태

마지막 갱신: 2026-05-26 (A-3e 완료 후)
마지막 docx: v2.1 (2026-05-26)
누적 변경: CHANGELOG.md 참조

## 다음 Task

- **A-2** (다음): 트랙 자동 배치 한국어 사전 보강

## 결정 대기 (B 카테고리)

| 코드 | 항목 | Claude 권장 |
|---|---|---|
| B-3 | Block Split 시점 | 옵션 3 이후 |
| B-4 | Inspector 패널 시점 | A-4 묶음 |
| B-5 | 도슨트 출력 스타일 | 한국어 5~7문장 |
| B-6 | Piano Roll mp3 재생 | 옵션 A |
| B-신규1 | 우클릭 메뉴 5개 항목 | 동의 권장 |
| B-신규2 | Split 단일 액션 표준 | 동의 권장 |

## 재검증 필요 (R 카테고리)

| 코드 | 항목 | 상태 |
|---|---|---|
| R-1 | Antigravity Task 2 "드래그 정상" 결론 | 무효 (A-4에 흡수) |
| R-2 | Playhead 마커 그랩 변경 이력 | **영구 보류** |
| R-3 | v1 시기 완료 항목 + ReplaceConfirmModal | 체크리스트 작성 대기 |
| R-4 | 8일 미커밋 §5 룰 위반 | §5.4 방지책 추가됨 |

## git 상태

- working tree: clean
- origin/main과 4 commits ahead
- assume-unchanged: 3개 파일 (release_task_audio_paths.py, start_api_server.bat, pyproject.toml)

## 최신 커밋 5개

```
fedbe22 deps: add basic-pitch + tensorflow + loguru (A-3e)
9118e53 chore: track AGENTS+...+memory+handoff (A-3d)
a53f38e chore: ignore .bak + *.log (A-3c)
0028342 chore: track v1 frontend src + backend app (A-3b)
158677b Feature: track-level block filtering (5월 19일)
```
