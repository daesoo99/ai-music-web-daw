import { memo } from 'react'
import { shallow } from 'zustand/shallow'
import { useSelectionStore } from '../../store/useSelectionStore'

interface SelectionOverlayProps {
  trackId: string
}

function SelectionOverlayInner({ trackId }: SelectionOverlayProps) {
  const isActiveTrack = useSelectionStore(s => s.trackId === trackId)
  if (!isActiveTrack) return null
  return <ActiveOverlayContent />
}

function ActiveOverlayContent() {
  const overlay = useSelectionStore(
    s => ({
      isDragging: s.isDragging,
      valid: s.valid,
      invalidReason: s.invalidReason,
      startPixels: s.startPixels,
      endPixels: s.endPixels,
    }),
    shallow,
  )
  const clearSelection = useSelectionStore(s => s.clearSelection)

  const showInvalidTooltip = overlay.invalidReason !== null && !overlay.isDragging
  const visible = overlay.isDragging || overlay.valid || showInvalidTooltip
  if (!visible) return null

  const left = Math.min(overlay.startPixels, overlay.endPixels)
  const width = Math.max(12, Math.abs(overlay.endPixels - overlay.startPixels))
  const cls = [
    'selection-overlay',
    overlay.valid ? 'valid' : '',
    showInvalidTooltip ? 'invalid' : '',
    overlay.isDragging ? 'dragging' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={cls} style={{ left: `${left}px`, width: `${width}px` }}>
      {showInvalidTooltip && (
        <span className="invalid-tooltip" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{overlay.invalidReason}</span>
          <button 
            onClick={(e) => {
              e.stopPropagation()
              clearSelection()
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.25)',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
              padding: '1px 6px',
              fontSize: '11px',
              lineHeight: '1.2',
              fontWeight: 'bold',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255, 255, 255, 0.45)' }}
            onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255, 255, 255, 0.25)' }}
          >
            ✕
          </button>
        </span>
      )}
    </div>
  )
}

export const SelectionOverlay = memo(SelectionOverlayInner)

