import { useEffect } from 'react'
import type { RefObject } from 'react'
import { useSelectionStore } from '../store/useSelectionStore'
import { useProjectStore } from '../store/useProjectStore'
import { usePlaybackStore } from '../store/usePlaybackStore'
import { MIN_TIMELINE_DURATION_SECONDS } from '../constants/instruments'

interface UseTimelineDragOptions {
  laneRef: RefObject<HTMLDivElement>
}

export function useTimelineDrag({ laneRef }: UseTimelineDragOptions): void {
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const sel = useSelectionStore.getState()
      if (!sel.isDragging) return
      const lane = laneRef.current
      if (!lane) return
      const rect = lane.getBoundingClientRect()
      sel.updateDrag(Math.max(0, e.clientX - rect.left))
    }

    const handleMouseUp = () => {
      const sel = useSelectionStore.getState()
      if (!sel.isDragging) return
      const lane = laneRef.current
      const laneWidth = lane ? lane.getBoundingClientRect().width : 1000
      const duration = Math.max(
        usePlaybackStore.getState().duration,
        MIN_TIMELINE_DURATION_SECONDS,
      )
      const blocks = useProjectStore.getState().blocks
      sel.endDrag(blocks, laneWidth, duration)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [laneRef])
}
