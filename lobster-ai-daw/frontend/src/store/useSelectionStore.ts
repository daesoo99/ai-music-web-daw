import { useZoomStore } from './useZoomStore'
﻿import { create } from 'zustand'
import type { TimelineBlock } from '../types/audio'

export interface SelectionState {
  trackId: string | null
  blockId: string | null          // 명시적 매핑
  startSeconds: number | null     // 블록 내부 상대 시간 (0 ~ durationSeconds)
  endSeconds: number | null       // 블록 내부 상대 시간
  
  absoluteStartSeconds: number | null // 타임라인 상의 절대 시작 시간
  absoluteEndSeconds: number | null   // 타임라인 상의 절대 종료 시간

  startPixels: number
  endPixels: number
  isDragging: boolean
  
  valid: boolean
  invalidReason: string | null
  sourceBlockId: string | null    // 하위 호환성을 위해 유지

  startDrag: (trackId: string, x: number) => void
  updateDrag: (x: number) => void
  endDrag: (blocks: TimelineBlock[], timelineWidthPixels: number, totalDurationSeconds: number) => void
  setSelection: (s: { blockId: string | null, trackId: string | null, startSeconds: number | null, endSeconds: number | null }) => void
  setSelectionByAbsoluteSeconds: (
    trackId: string,
    absoluteStartSeconds: number,
    absoluteEndSeconds: number,
    blocks: TimelineBlock[]
  ) => void
  clearSelection: () => void
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  trackId: null,
  blockId: null,
  startSeconds: null,
  endSeconds: null,
  
  absoluteStartSeconds: null,
  absoluteEndSeconds: null,

  startPixels: 0,
  endPixels: 0,
  isDragging: false,
  
  valid: false,
  invalidReason: null,
  sourceBlockId: null,

  startDrag: (trackId, x) => {
    set({
      trackId,
      blockId: null,
      startSeconds: null,
      endSeconds: null,
      absoluteStartSeconds: null,
      absoluteEndSeconds: null,
      startPixels: x,
      endPixels: x,
      isDragging: true,
      valid: false,
      invalidReason: null,
      sourceBlockId: null,
    })
  },

  updateDrag: (x) => {
    if (!get().isDragging) return
    set({ endPixels: x })
  },

  endDrag: (blocks, timelineWidthPixels, totalDurationSeconds) => {
    const s = get()
    if (!s.isDragging) return
    
    // Normalize drag direction
    const rawStart = Math.min(s.startPixels, s.endPixels)
    const rawEnd = Math.max(s.startPixels, s.endPixels)
    
    // Convert pixels to timeline seconds
    const pixelToSecond = totalDurationSeconds / Math.max(timelineWidthPixels, 1)
    const dragStartSec = rawStart * pixelToSecond
    const dragEndSec = rawEnd * pixelToSecond
    
    set({ isDragging: false })
    
    // Find overlapping blocks on the same track
    const trackBlocks = blocks.filter(b => b.trackId === s.trackId)
    const overlappingBlocks = trackBlocks.filter(b => 
      dragStartSec < b.timelineStartSeconds + b.durationSeconds && 
      dragEndSec > b.timelineStartSeconds
    )

    if (overlappingBlocks.length === 0) {
      set({ 
        valid: false, 
        invalidReason: '선택 영역이 오디오 블록 위에 있지 않습니다.',
        blockId: null,
        sourceBlockId: null,
        startSeconds: null,
        endSeconds: null
      })
      return
    }

    // [UX 피드백 반영] 여러 블록에 드래그가 걸치더라도 거부하지 않고 첫 번째 블록에 자동으로 부드럽게 안착시킵니다.
    const block = overlappingBlocks[0]
    const clampedStartSec = Math.max(dragStartSec, block.timelineStartSeconds)
    const clampedEndSec = Math.min(dragEndSec, block.timelineStartSeconds + block.durationSeconds)

    // Calculate relative seconds
    const relStart = clampedStartSec - block.timelineStartSeconds
    const relEnd = clampedEndSec - block.timelineStartSeconds
    const selectionLength = relEnd - relStart

    // Validate selection length (1s ~ 60s)
    if (selectionLength < 1.0) {
      set({ 
        valid: false, 
        invalidReason: '최소 선택 길이는 1초입니다.',
        blockId: null,
        sourceBlockId: null,
        startSeconds: null,
        endSeconds: null
      })
      return
    }

    if (selectionLength > 60.0) {
      set({ 
        valid: false, 
        invalidReason: '최대 60초까지만 선택 가능합니다.',
        blockId: null,
        sourceBlockId: null,
        startSeconds: null,
        endSeconds: null
      })
      return
    }

    // Valid!
    set({
      valid: true,
      invalidReason: null,
      blockId: block.blockId,
      sourceBlockId: block.blockId,
      startSeconds: relStart,
      endSeconds: relEnd,
      absoluteStartSeconds: clampedStartSec,
      absoluteEndSeconds: clampedEndSec,
      startPixels: clampedStartSec / pixelToSecond, // adjust visual rect to clamped
      endPixels: clampedEndSec / pixelToSecond,
    })
  },

  setSelection: ({ blockId, trackId, startSeconds, endSeconds }) => {
    set({
      blockId,
      sourceBlockId: blockId,
      trackId,
      startSeconds,
      endSeconds,
      valid: blockId !== null,
      invalidReason: null,
    })
  },

  setSelectionByAbsoluteSeconds: (
    trackId,
    absStart,
    absEnd,
    blocks
  ) => {
    const startSec = Math.min(absStart, absEnd)
    const endSec = Math.max(absStart, absEnd)

    const trackBlocks = blocks.filter(b => b.trackId === trackId)
    const overlappingBlocks = trackBlocks.filter(b => 
      startSec < b.timelineStartSeconds + b.durationSeconds && 
      endSec > b.timelineStartSeconds
    )

    if (overlappingBlocks.length === 0) {
      set({ 
        valid: false, 
        invalidReason: '선택한 범위에 블록이 존재하지 않습니다.',
        blockId: null,
        sourceBlockId: null,
        startSeconds: null,
        endSeconds: null,
        absoluteStartSeconds: null,
        absoluteEndSeconds: null
      })
      return
    }

    const block = overlappingBlocks[0]
    const clampedStartSec = Math.max(startSec, block.timelineStartSeconds)
    const clampedEndSec = Math.min(endSec, block.timelineStartSeconds + block.durationSeconds)

    const relStart = clampedStartSec - block.timelineStartSeconds
    const relEnd = clampedEndSec - block.timelineStartSeconds
    const selectionLength = relEnd - relStart

    if (selectionLength < 1.0) {
      set({ 
        valid: false, 
        invalidReason: '최소 선택 길이는 1초입니다.',
        blockId: null,
        sourceBlockId: null,
        startSeconds: null,
        endSeconds: null,
        absoluteStartSeconds: null,
        absoluteEndSeconds: null
      })
      return
    }

    if (selectionLength > 60.0) {
      set({ 
        valid: false, 
        invalidReason: '최대 60초까지 선택 가능합니다.',
        blockId: null,
        sourceBlockId: null,
        startSeconds: null,
        endSeconds: null,
        absoluteStartSeconds: null,
        absoluteEndSeconds: null
      })
      return
    }

    const pixelsPerSecond = useZoomStore.getState().pixelsPerSecond

    set({
      valid: true,
      invalidReason: null,
      trackId,
      blockId: block.blockId,
      sourceBlockId: block.blockId,
      startSeconds: relStart,
      endSeconds: relEnd,
      absoluteStartSeconds: clampedStartSec,
      absoluteEndSeconds: clampedEndSec,
      startPixels: clampedStartSec * pixelsPerSecond,
      endPixels: clampedEndSec * pixelsPerSecond,
    })
  },

  clearSelection: () => {
    set({
      trackId: null,
      blockId: null,
      startSeconds: null,
      endSeconds: null,
      absoluteStartSeconds: null,
      absoluteEndSeconds: null,
      startPixels: 0,
      endPixels: 0,
      isDragging: false,
      valid: false,
      invalidReason: null,
      sourceBlockId: null,
    })
  }
}))