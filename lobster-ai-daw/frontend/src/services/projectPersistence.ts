/**
 * projectPersistence.ts
 * --------------------
 * 프로젝트 상태(트랙+블록 배치)를 백엔드 디스크에 자동 저장/복원하는 서비스.
 *
 * - saveProjectState(): 현재 Zustand 상태를 PUT /api/projects/{id}/state
 * - loadProjectState(): GET /api/projects/{id}/state → Zustand hydration
 *
 * 디바운스 처리를 통해 블록이 연속으로 추가될 때 과도한 저장 요청을 방지합니다.
 */

import { useProjectStore } from '../store/useProjectStore'
import { PROJECT_ID } from '../constants/instruments'

let saveTimer: ReturnType<typeof setTimeout> | null = null
const DEBOUNCE_MS = 1500

/**
 * 현재 프로젝트 상태를 백엔드에 저장 (디바운스 적용).
 * 블록 추가/삭제/변경 시 호출됩니다.
 */
export function debouncedSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveProjectStateNow()
  }, DEBOUNCE_MS)
}

/**
 * 즉시 저장 (디바운스 없이).
 */
async function saveProjectStateNow(): Promise<void> {
  const { tracks, blocks } = useProjectStore.getState()
  
  // 빈 프로젝트는 저장하지 않음 (첫 로드 시 불필요한 빈 파일 생성 방지)
  if (tracks.length === 0 && blocks.length === 0) return

  try {
    const res = await fetch(`/api/projects/${PROJECT_ID}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tracks, blocks }),
    })
    if (!res.ok) {
      console.error('[Persistence] 저장 실패:', res.status, await res.text())
    }
  } catch (err) {
    console.error('[Persistence] 저장 중 네트워크 오류:', err)
  }
}

/**
 * 앱 시작 시 백엔드에서 프로젝트 상태를 불러와 Zustand에 복원.
 */
export async function loadProjectState(): Promise<void> {
  try {
    const res = await fetch(`/api/projects/${PROJECT_ID}/state`)
    if (!res.ok) {
      console.warn('[Persistence] 프로젝트 상태 불러오기 실패:', res.status)
      return
    }

    const data = await res.json()
    const tracks = data.tracks ?? []
    const blocks = data.blocks ?? []

    if (tracks.length === 0 && blocks.length === 0) {
      console.log('[Persistence] 저장된 프로젝트 없음 — 빈 타임라인으로 시작')
      return
    }

    console.log(`[Persistence] 프로젝트 복원: ${tracks.length}개 트랙, ${blocks.length}개 블록`)
    useProjectStore.getState().setProject(tracks, blocks)
  } catch (err) {
    console.error('[Persistence] 프로젝트 복원 중 네트워크 오류:', err)
  }
}
