import { memo, useMemo, useCallback } from 'react'
import type { Ref } from 'react'
import { shallow } from 'zustand/shallow'
import { useProjectStore } from '../../store/useProjectStore'
import { useMixerStore } from '../../store/useMixerStore'
import { useSelectionStore } from '../../store/useSelectionStore'
import { TrackBlock } from './TrackBlock'
import { SelectionOverlay } from './SelectionOverlay'
import { useSwapInstrument } from '../../hooks/useSwapInstrument'
import { useZoomStore } from '../../store/useZoomStore'
import { TRACK_HEADER_WIDTH_PX } from '../../constants/timeline'

interface TrackRowProps {
  trackId: string
  trackName: string
  trackIcon?: string
  laneRef?: Ref<HTMLDivElement>
}

const DEFAULT_MIXER_STATE = { volume: 0.8, muted: false, soloed: false }

function TrackRowInner({
  trackId,
  trackName,
  trackIcon,
  laneRef,
}: TrackRowProps) {
  const mixerState = useMixerStore(
    s => s.tracks[trackId] ?? DEFAULT_MIXER_STATE,
    shallow,
  )
  const toggleMute = useMixerStore(s => s.toggleMute)
  const toggleSolo = useMixerStore(s => s.toggleSolo)
  const setVolume = useMixerStore(s => s.setVolume)

  const allBlocks = useProjectStore(s => s.blocks)
  const trackBlocks = useMemo(
    () => allBlocks.filter(b => b.trackId === trackId),
    [allBlocks, trackId],
  )

  const startDrag = useSelectionStore(s => s.startDrag)
  const clearSelection = useSelectionStore(s => s.clearSelection)
  const swap = useSwapInstrument()
  const pixelsPerSecond = useZoomStore(s => s.pixelsPerSecond)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement
      if (target.closest('.track-controls') || target.closest('button') || target.closest('input')) {
        return
      }

      clearSelection()

      const laneRect = e.currentTarget.getBoundingClientRect()
      const startX = e.clientX - laneRect.left

      e.preventDefault()

      let hasTriggeredDrag = false

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const currentX = moveEvent.clientX - laneRect.left
        const distance = Math.abs(currentX - startX)

        if (!hasTriggeredDrag && distance > 5) {
          hasTriggeredDrag = true
          startDrag(trackId, startX)
        }
      }

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [trackId, startDrag, clearSelection],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-lobster-block')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const raw = e.dataTransfer.getData('application/x-lobster-block')
    if (!raw) return
    const dragData = JSON.parse(raw)
    if (dragData.sourceTrackId === trackId) return
    
    const laneRect = e.currentTarget.getBoundingClientRect()
    const offsetX = e.clientX - laneRect.left
    const dropSeconds = Math.max(0, offsetX / pixelsPerSecond)
    
    swap.requestSwap({
      sourceBlockId: dragData.blockId,
      targetTrackId: trackId,
      dropAtSeconds: dropSeconds,
    })
  }, [trackId, pixelsPerSecond, swap])

  const hasBlocks = trackBlocks.length > 0
  const headerOpacity = hasBlocks ? 1 : 0.55

  return (
    <div className="track-row">
      <div 
        className="track-header" 
        style={{ 
          width: `${TRACK_HEADER_WIDTH_PX}px`, 
          flexShrink: 0,
          opacity: headerOpacity
        }}
      >
        <div className="track-name">
          {trackIcon && (
            <span className="track-icon" style={{ marginRight: '6px' }}>
              {trackIcon}
            </span>
          )}
          {trackName}
        </div>
        <div className="track-controls">
          <button
            className={`btn-mute ${mixerState.muted ? 'active' : ''}`}
            onClick={() => toggleMute(trackId)}
          >M</button>
          <button
            className={`btn-solo ${mixerState.soloed ? 'active' : ''}`}
            onClick={() => toggleSolo(trackId)}
          >S</button>
          <input
            type="range"
            min="0" max="1" step="0.01"
            value={mixerState.volume}
            onChange={(e) => setVolume(trackId, parseFloat(e.target.value))}
            className="volume-slider"
          />
        </div>
      </div>

      <div 
        className="track-lane" 
        ref={laneRef} 
        onMouseDown={handleMouseDown}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        data-track-id={trackId}
      >
        {trackBlocks.map(block => (
          <TrackBlock
            key={block.blockId}
            block={block}
          />
        ))}
        <SelectionOverlay trackId={trackId} />
      </div>
    </div>
  )
}

export const TrackRow = memo(TrackRowInner)