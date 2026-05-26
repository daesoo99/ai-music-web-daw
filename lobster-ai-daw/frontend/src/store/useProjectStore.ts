import { create } from 'zustand'
import type { TimelineTrack, TimelineBlock } from '../types/audio'
import { useMixerStore } from './useMixerStore'
import { PROJECT_ID } from '../constants/instruments'
import { usePlaybackStore } from './usePlaybackStore'

function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timer: NodeJS.Timeout | null = null
  return function (...args: Parameters<T>) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

const DEFAULT_TRACKS: TimelineTrack[] = [
  { trackId: "piano", name: "Grand Piano", icon: "🎹" },
  { trackId: "strings", name: "Strings Ensemble", icon: "🎻" },
  { trackId: "drums", name: "Acoustic Drums", icon: "🥁" },
  { trackId: "bass", name: "Bass Guitar", icon: "🎸" }
]

interface HistoryItem {
  actionName: string
  tracks: TimelineTrack[]
  blocks: TimelineBlock[]
}

interface ProjectState {
  tracks: TimelineTrack[]
  blocks: TimelineBlock[]

  // History State
  historyStack: HistoryItem[]
  historyIndex: number

  setProject: (tracks: TimelineTrack[], blocks: TimelineBlock[], actionName?: string) => void
  addBlock: (block: TimelineBlock) => void
  updateBlock: (blockId: string, patch: Partial<TimelineBlock>) => void
  removeBlock: (blockId: string) => void
  deleteBlock: (blockId: string) => void

  // 글로벌 피아노롤 및 분석 패널 관리 상태
  activePianoRollBlockId: string | null
  activeAnalysisBlockId: string | null
  setActivePianoRollBlockId: (blockId: string | null) => void
  setActiveAnalysisBlockId: (blockId: string | null) => void

  // History Actions
  pushHistory: (actionName: string, tracks: TimelineTrack[], blocks: TimelineBlock[]) => void
  undo: () => void
  redo: () => void
  jumpToHistory: (index: number) => void
  clearHistory: () => void
}

const saveProjectStateToBackend = async (tracks: TimelineTrack[], blocks: TimelineBlock[]) => {
  try {
    await fetch(`/api/projects/${PROJECT_ID}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tracks, blocks })
    })
  } catch (err) {
    console.error("Zustand autosave failed:", err)
  }
}

const debouncedSave = debounce(() => {
  const { tracks, blocks } = useProjectStore.getState()
  saveProjectStateToBackend(tracks, blocks)
}, 1000)

export const useProjectStore = create<ProjectState>((set, get) => ({
  tracks: DEFAULT_TRACKS,
  blocks: [],

  // 글로벌 피아노롤 및 분석 패널 관리 상태
  activePianoRollBlockId: null,
  activeAnalysisBlockId: null,
  setActivePianoRollBlockId: (blockId) => set({ activePianoRollBlockId: blockId }),
  setActiveAnalysisBlockId: (blockId) => set({ activeAnalysisBlockId: blockId }),

  // Initial History Session
  historyStack: [{ actionName: '초기 프로젝트', tracks: DEFAULT_TRACKS, blocks: [] }],
  historyIndex: 0,

  setProject: (tracks, blocks, _actionName) => {
    const resolvedTracks = tracks.length === 0 ? DEFAULT_TRACKS : tracks
    set({
      tracks: resolvedTracks,
      blocks,
      activePianoRollBlockId: null,
      activeAnalysisBlockId: null,
    })

    const mixer = useMixerStore.getState()
    for (const t of resolvedTracks) {
      mixer.registerTrack(t.trackId)
    }

    usePlaybackStore.getState().loadBlocks(blocks)
    debouncedSave()

    const { historyStack } = get()
    if (
      historyStack[0]?.actionName === '초기 프로젝트' ||
      historyStack[0]?.actionName === '프로젝트 로드'
    ) {
      set({
        historyStack: [
          createHistoryItem('프로젝트 로드', resolvedTracks, blocks),
        ],
        historyIndex: 0
      })
    }
  },

  addBlock: (block) => {
    set((s) => {
      const exists = s.blocks.some(b => b.blockId === block.blockId)
      const nextBlocks = exists
        ? s.blocks.map(b => b.blockId === block.blockId ? block : b)
        : [...s.blocks, block]

      return { blocks: nextBlocks }
    })

    usePlaybackStore.getState().loadBlocks(get().blocks)
    debouncedSave()
    get().pushHistory('블록 생성', get().tracks, get().blocks)
  },

  updateBlock: (blockId, patch) => {
    const oldBlocks = get().blocks
    const oldBlock = oldBlocks.find(b => b.blockId === blockId)
    
    set((s) => ({
      blocks: s.blocks.map((b) =>
        b.blockId === blockId ? { ...b, ...patch } : b,
      ),
    }))

    usePlaybackStore.getState().loadBlocks(get().blocks)
    debouncedSave()

    const hasTimelineChange = oldBlock && (
      patch.timelineStartSeconds !== undefined && patch.timelineStartSeconds !== oldBlock.timelineStartSeconds ||
      patch.trackId !== undefined && patch.trackId !== oldBlock.trackId
    )
    const label = hasTimelineChange ? '블록 이동' : '블록 업데이트'
    get().pushHistory(label, get().tracks, get().blocks)
  },

  removeBlock: (blockId) => {
    set((s) => {
      const nextActivePianoRoll = s.activePianoRollBlockId === blockId ? null : s.activePianoRollBlockId
      const nextActiveAnalysis = s.activeAnalysisBlockId === blockId ? null : s.activeAnalysisBlockId
      return {
        blocks: s.blocks.filter((b) => b.blockId !== blockId),
        activePianoRollBlockId: nextActivePianoRoll,
        activeAnalysisBlockId: nextActiveAnalysis,
      }
    })

    usePlaybackStore.getState().loadBlocks(get().blocks)
    debouncedSave()
  },

  deleteBlock: (blockId) => {
    get().removeBlock(blockId)
    get().pushHistory('블록 삭제', get().tracks, get().blocks)
  },

  pushHistory: (actionName, tracks, blocks) => {
    const { historyStack, historyIndex } = get()
    const sliced = historyStack.slice(0, historyIndex + 1)
    
    const clonedBlocks = JSON.parse(JSON.stringify(blocks))
    const clonedTracks = JSON.parse(JSON.stringify(tracks))

    const newItem = createHistoryItem(actionName, clonedTracks, clonedBlocks)
    
    set({
      historyStack: [...sliced, newItem],
      historyIndex: sliced.length
    })
  },

  undo: () => {
    const { historyIndex, historyStack } = get()
    if (historyIndex > 0) {
      const nextIndex = historyIndex - 1
      const item = historyStack[nextIndex]
      
      set({
        tracks: item.tracks,
        blocks: item.blocks,
        historyIndex: nextIndex,
        activePianoRollBlockId: null,
        activeAnalysisBlockId: null
      })
      
      usePlaybackStore.getState().loadBlocks(item.blocks)
      debouncedSave()
    }
  },

  redo: () => {
    const { historyIndex, historyStack } = get()
    if (historyIndex < historyStack.length - 1) {
      const nextIndex = historyIndex + 1
      const item = historyStack[nextIndex]
      
      set({
        tracks: item.tracks,
        blocks: item.blocks,
        historyIndex: nextIndex,
        activePianoRollBlockId: null,
        activeAnalysisBlockId: null
      })
      
      usePlaybackStore.getState().loadBlocks(item.blocks)
      debouncedSave()
    }
  },

  jumpToHistory: (index) => {
    const { historyStack } = get()
    if (index >= 0 && index < historyStack.length) {
      const item = historyStack[index]
      
      set({
        tracks: item.tracks,
        blocks: item.blocks,
        historyIndex: index,
        activePianoRollBlockId: null,
        activeAnalysisBlockId: null
      })
      
      usePlaybackStore.getState().loadBlocks(item.blocks)
      debouncedSave()
    }
  },

  clearHistory: () => {
    const { tracks, blocks } = get()
    set({
      historyStack: [createHistoryItem('초기화', tracks, blocks)],
      historyIndex: 0
    })
  }
}))

function createHistoryItem(actionName: string, tracks: TimelineTrack[], blocks: TimelineBlock[]): HistoryItem {
  return {
    actionName,
    tracks: JSON.parse(JSON.stringify(tracks)),
    blocks: JSON.parse(JSON.stringify(blocks))
  }
}
