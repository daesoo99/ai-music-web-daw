import { memo, useState, useCallback } from 'react'
import type { TimelineBlock } from '../../types/audio'
import { useZoomStore } from '../../store/useZoomStore'
import { useProjectStore } from '../../store/useProjectStore'
import { generateBlockLabel } from '../../utils/blockLabel'

interface TrackBlockProps {
  block: TimelineBlock
}

function TrackBlockInner({ block }: TrackBlockProps) {
  const [isHovered, setIsHovered] = useState(false)
  
  const updateBlock = useProjectStore(s => s.updateBlock)
  const deleteBlock = useProjectStore(s => s.deleteBlock)
  const setActivePianoRollBlockId = useProjectStore(s => s.setActivePianoRollBlockId)
  
  const pixelsPerSecond = useZoomStore(s => s.pixelsPerSecond)
  
  // 드래그 관련 로컬 상태
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffsetSeconds, setDragOffsetSeconds] = useState(0)
  const [, setDragTrackId] = useState<string | null>(null)
  const [translateY, setTranslateY] = useState(0)
  
  const currentStartSeconds = block.timelineStartSeconds + dragOffsetSeconds
  const leftPx = currentStartSeconds * pixelsPerSecond
  const widthPx = block.durationSeconds * pixelsPerSecond
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // 삭제 버튼이나 다른 버튼 클릭 시 드래그 차단
    const target = e.target as HTMLElement
    if (target.closest('.btn-delete-block') || target.closest('button')) {
      return
    }
    
    e.preventDefault()
    e.stopPropagation() // 부모 TrackRow의 리페인트(Repaint)가 작동되지 않도록
    
    const startX = e.clientX
    const originStart = block.timelineStartSeconds
    const originTrackId = block.trackId
    
    setIsDragging(true)
    setDragOffsetSeconds(0)
    setDragTrackId(originTrackId)
    setTranslateY(0)
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const offsetSec = deltaX / pixelsPerSecond
      
      // 0초 미만으로 가지 않도록 처리
      const newStart = Math.max(0, originStart + offsetSec)
      setDragOffsetSeconds(newStart - originStart)
      
      // Y축 드래그를 통한 트랙 실시간 타겟 감지
      const elem = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)
      const lane = elem?.closest('.track-lane')
      const targetTrackId = lane?.getAttribute('data-track-id')
      
      if (targetTrackId) {
        setDragTrackId(targetTrackId)
        
        // 새 트랙으로의 수직 오프셋(translateY) 계산
        if (targetTrackId !== originTrackId) {
          const originLane = document.querySelector(`.track-lane[data-track-id="${originTrackId}"]`)
          const targetLane = document.querySelector(`.track-lane[data-track-id="${targetTrackId}"]`)
          if (originLane && targetLane) {
            const originRect = originLane.getBoundingClientRect()
            const targetRect = targetLane.getBoundingClientRect()
            setTranslateY(targetRect.top - originRect.top)
          }
        } else {
          setTranslateY(0)
        }
      }
    };
    
    const handleMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      
      setIsDragging(false)
      
      const deltaX = upEvent.clientX - startX
      const finalStart = Math.max(0, originStart + deltaX / pixelsPerSecond)
      
      const elem = document.elementFromPoint(upEvent.clientX, upEvent.clientY)
      const lane = elem?.closest('.track-lane')
      const finalTrackId = lane?.getAttribute('data-track-id') ?? originTrackId
      
      // Zustand 스토어에 드래그 이동 결과 반영
      updateBlock(block.blockId, {
        timelineStartSeconds: finalStart,
        trackId: finalTrackId
      })
      
      setDragOffsetSeconds(0)
      setDragTrackId(null)
      setTranslateY(0)
    };
    
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [block, pixelsPerSecond, updateBlock])
  
  const blockLabel = block.prompt
    ? generateBlockLabel(block.prompt)
    : `Untitled (${Math.round(block.durationSeconds)}s)`
    
  return (
    <>
      <div
        className={`audio-block glass-block ${block.isActive === false ? 'inactive' : ''} ${isDragging ? 'dragging' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ 
          left: `${leftPx}px`, 
          width: `${widthPx}px`,
          transform: translateY ? `translateY(${translateY}px)` : 'none',
          zIndex: isDragging ? 100 : 1,
          opacity: block.isActive === false ? 0.4 : isDragging ? 0.8 : 1,
          filter: block.isActive === false ? 'grayscale(80%)' : 'none',
          pointerEvents: block.isActive === false ? 'none' : 'auto',
          cursor: isDragging ? 'grabbing' : 'grab',
          position: 'absolute'
        }}
        onMouseDown={handleMouseDown}
        onDoubleClick={() => !isDragging && block.isActive !== false && setActivePianoRollBlockId(block.blockId)}
        title={block.prompt ? `Prompt: "${block.prompt}"\n(더블클릭: 피아노롤 / 드래그: 좌우 시간 이동 및 상하 트랙 이동)` : '더블클릭: 피아노롤 / 드래그: 좌우 시간 이동 및 상하 트랙 이동'}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', marginRight: '24px' }}>
          {blockLabel}
        </span>
        
        {/* 다운로드 버튼 */}
        {isHovered && (
          <button
            className="block-download-btn"
            onClick={(e) => {
              e.stopPropagation()
              if (!block.audioUrl) {
                alert("오디오가 아직 생성되지 않았습니다.")
                return
              }
              const downloadUrl = `/api/blocks/${block.blockId}/download`
              const link = document.createElement('a')
              link.href = downloadUrl
              link.setAttribute('download', '')
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
            }}
            title="MP3 다운로드"
            disabled={!block.audioUrl}
            style={{
              position: 'absolute',
              top: 'var(--spacing-4)',
              right: 'var(--spacing-24)',
              width: '18px',
              height: '18px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(0,0,0,0.4)',
              color: block.audioUrl ? 'var(--color-white)' : 'rgba(255, 255, 255, 0.25)',
              border: 'none',
              fontSize: 'var(--font-size-xs)',
              cursor: block.audioUrl ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: '1',
              zIndex: 10
            }}
          >
            ⬇
          </button>
        )}

        {/* 삭제 버튼 */}
        {isHovered && (
          <button
            className="btn-delete-block"
            onClick={(e) => {
              e.stopPropagation()
              if (window.confirm("이 블록을 삭제하시겠습니까?")) {
                deleteBlock(block.blockId)
              }
            }}
            style={{
              position: 'absolute',
              top: 'var(--spacing-4)',
              right: 'var(--spacing-4)',
              width: '18px',
              height: '18px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(0,0,0,0.4)',
              color: 'var(--color-white)',
              border: 'none',
              fontSize: 'var(--font-size-xs)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: '1',
              zIndex: 10
            }}
            title="블록 삭제"
          >
            ❌
          </button>
        )}
      </div>
    </>
  )
}

export const TrackBlock = memo(TrackBlockInner)
