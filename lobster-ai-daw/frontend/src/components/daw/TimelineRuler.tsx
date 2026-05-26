import { useZoomStore } from '../../store/useZoomStore'
import { TICK_INTERVAL_SECONDS } from '../../constants/timeline'
import { useRef, useEffect, useMemo, useState } from 'react'
import { usePlaybackStore } from '../../store/usePlaybackStore'

interface TimelineRulerProps {
  totalSeconds: number
}

export function TimelineRuler({ totalSeconds }: TimelineRulerProps) {
  const pixelsPerSecond = useZoomStore(s => s.pixelsPerSecond)
  const isPlaying = usePlaybackStore(s => s.isPlaying)
  const currentTime = usePlaybackStore(s => s.currentTime)
  
  const play = usePlaybackStore(s => s.play)
  const pause = usePlaybackStore(s => s.pause)
  const seekTo = usePlaybackStore(s => s.seekTo)
  const setCurrentTime = usePlaybackStore(s => s.setCurrentTime)
  
  const rulerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const wasPlayingBeforeDragRef = useRef(false)
  
  // 마우스 hover 시 Affordance 확보를 위한 React 상태 관리
  const [isHovered, setIsHovered] = useState(false)

  const ticks = useMemo(() => {
    const arr = []
    for (let s = 0; s <= totalSeconds; s += TICK_INTERVAL_SECONDS) {
      arr.push(
        <div
          key={s}
          className="ruler-tick"
          style={{ 
            left: `${s * pixelsPerSecond}px`,
            position: 'absolute',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          <span className="tick-label" style={{ fontSize: '0.65rem', color: '#ffffff73', fontFamily: 'monospace' }}>
            {s}s
          </span>
          <div className="tick-line" style={{ width: '1px', height: '5px', background: '#ffffff40', marginTop: '1px' }} />
        </div>
      )
    }
    return arr
  }, [totalSeconds, pixelsPerSecond])

  // 마우스의 clientX를 받아 룰러 영역 기준 seconds 계산 및 setCurrentTime 갱신
  const seekFromClientX = (clientX: number) => {
    if (!rulerRef.current) return 0
    const rect = rulerRef.current.getBoundingClientRect()
    const relativeX = clientX - rect.left
    const seconds = Math.max(0, Math.min(totalSeconds, relativeX / pixelsPerSecond))
    
    // 드래그로 실시간 시킹
    setCurrentTime(seconds)
    return seconds
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation() // SelectionOverlay 드래그 이벤트 버블링 차단

    isDraggingRef.current = true
    wasPlayingBeforeDragRef.current = isPlaying

    if (wasPlayingBeforeDragRef.current) {
      pause()
    }

    seekFromClientX(e.clientX)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return
      seekFromClientX(moveEvent.clientX)
    }

    const handleMouseUp = (upEvent: MouseEvent) => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false

      const finalSeconds = seekFromClientX(upEvent.clientX)

      if (wasPlayingBeforeDragRef.current) {
        seekTo(finalSeconds).then(() => {
          play()
        })
      } else {
        seekTo(finalSeconds)
      }

      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // 룰러 바깥 이탈 마우스 해제 핸들러
  useEffect(() => {
    const onGlobalMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
      }
    }
    window.addEventListener('mouseup', onGlobalMouseUp)
    return () => {
      window.removeEventListener('mouseup', onGlobalMouseUp)
    }
  }, [])

  return (
    <div 
      className="timeline-ruler" 
      ref={rulerRef}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ 
        position: 'relative', 
        width: `${totalSeconds * pixelsPerSecond}px`,
        height: '32px',
        flexShrink: 0,
        cursor: 'ew-resize',
        userSelect: 'none',
        background: isHovered ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        transition: 'background-color 0.2s ease'
      }}
      title="마우스 클릭/드래그하여 재생 시간 탐색"
    >
      <div 
        className="ruler-lane" 
        style={{ 
          position: 'absolute', 
          left: 0, 
          right: 0,  
          top: 0, 
          bottom: 0, 
          pointerEvents: 'none' 
        }}
      >
        {ticks}
      </div>

      {/* 4. Playhead 마커 시각적 지시침 머리를 룰러 위에 별도 absolute 렌더링 */}
      <div
        className="ruler-playhead-marker"
        onMouseDown={handleMouseDown}
        style={{ 
          left: `${currentTime * pixelsPerSecond}px`,
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: '2px',
          backgroundColor: '#ff3b30',
          pointerEvents: 'auto',
          zIndex: 30,
          cursor: 'ew-resize'
        }}
      >
        {/* 지시침 상단 ▼ 그랩 hit area 보강 */}
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '20px',
            height: '24px',
            backgroundColor: 'transparent',
            zIndex: 31,
            cursor: 'ew-resize'
          }}
        />
        {/* 지시침 시각적 머리 */}
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '12px',
            height: '12px',
            backgroundColor: '#ff3b30',
            clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            pointerEvents: 'none'
          }}
        />
      </div>
    </div>
  )
}
