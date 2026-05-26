import { useRef, useMemo, useEffect, useCallback } from 'react'
// import { shallow } from 'zustand/shallow'
import { usePlaybackStore } from '../../store/usePlaybackStore'
import { useProjectStore } from '../../store/useProjectStore'
import { useZoomStore } from '../../store/useZoomStore'
import { TrackRow } from './TrackRow'
import { TransportControls } from './TransportControls'
import { TimelineRuler } from './TimelineRuler'
import { useTimelineDrag } from '../../hooks/useTimelineDrag'
import { TRACK_HEADER_WIDTH_PX } from '../../constants/timeline'

export function Timeline() {
  const duration = usePlaybackStore(s => s.duration)
  const isPlaying = usePlaybackStore(s => s.isPlaying)
  const currentTime = usePlaybackStore(s => s.currentTime)
  
  const tracks = useProjectStore(s => s.tracks)
  const allBlocks = useProjectStore(s => s.blocks)
  const pixelsPerSecond = useZoomStore(s => s.pixelsPerSecond)

  // 모든 오디오 블록들의 최장 끝 시각을 동적으로 구하여 가로폭(totalSeconds) 결정 (기본 최소 300초)
  const totalSeconds = useMemo(() => {
    const maxBlockEnd = allBlocks.reduce((max, b) => Math.max(max, b.timelineStartSeconds + b.durationSeconds), 0)
    return Math.max(300, maxBlockEnd, duration)
  }, [allBlocks, duration])

  const firstLaneRef = useRef<HTMLDivElement>(null)
  useTimelineDrag({ laneRef: firstLaneRef })

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isInternalScrollRef = useRef(false)
  const isAutoScrollRef = useRef(true)

  // 재생 정지 또는 리셋 시 자동 스크롤 추적 활성화
  useEffect(() => {
    if (!isPlaying) {
      isAutoScrollRef.current = true
    }
  }, [isPlaying])

  // 재생헤드 위치에 따른 자동 스크롤 처리 (우측 80% 도달 시 1페이지 점프)
  useEffect(() => {
    if (!isPlaying) {
      isAutoScrollRef.current = true
      return
    }

    const container = scrollContainerRef.current
    if (!container || !isAutoScrollRef.current) return

    const playheadPx = currentTime * pixelsPerSecond
    const containerLeft = container.scrollLeft
    const containerWidth = container.clientWidth
    
    // 뷰포트 내에서의 재생헤드 가시적 X 위치 (좌측 트랙 헤더 영역 포함)
    const absolutePlayheadX = TRACK_HEADER_WIDTH_PX + playheadPx
    const visibleX = absolutePlayheadX - containerLeft

    // 재생헤드가 뷰포트 우측 80% 지점을 넘어가면 자동 점프
    if (visibleX > containerWidth * 0.8) {
      const targetScrollLeft = containerLeft + containerWidth * 0.5
      isInternalScrollRef.current = true
      container.scrollLeft = targetScrollLeft
      setTimeout(() => {
        isInternalScrollRef.current = false
      }, 50)
    }

    // 재생헤드가 루프 등으로 현재 뷰포트 왼쪽 밖으로 벗어난 경우 맨 앞으로 복원
    if (absolutePlayheadX < containerLeft + TRACK_HEADER_WIDTH_PX) {
      isInternalScrollRef.current = true
      container.scrollLeft = Math.max(0, absolutePlayheadX - TRACK_HEADER_WIDTH_PX - 50)
      setTimeout(() => {
        isInternalScrollRef.current = false
      }, 50)
    }
  }, [currentTime, isPlaying, pixelsPerSecond])

  // 수동 가로 스크롤 감지 시 자동 스크롤 추적 일시 해제
  const handleScroll = useCallback(() => {
    if (isInternalScrollRef.current) return
    if (isPlaying) {
      isAutoScrollRef.current = false
    }
  }, [isPlaying])

  return (
    <main className="daw-main-timeline glass-card">
      <div className="timeline-header">
        <h3>Timeline Editor</h3>
        <TransportControls />
      </div>

      <div 
        className="timeline-scroll-container" 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{ 
          overflowX: 'auto', 
          overflowY: 'hidden', 
          flex: 1, 
          position: 'relative',
          marginTop: '16px',
          borderRadius: '6px'
        }}
      >
        <div 
          className="timeline-body"
          style={{ 
            width: `${TRACK_HEADER_WIDTH_PX + totalSeconds * pixelsPerSecond}px`, 
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          {/* Timeline Ruler Row (Header placeholder + ruler clip lane) */}
          <div 
            className="timeline-ruler-row" 
            style={{ 
              display: 'flex', 
              height: '32px',
              alignItems: 'center',
              flexShrink: 0
            }}
          >
            <div 
              className="ruler-header" 
              style={{ 
                width: `${TRACK_HEADER_WIDTH_PX}px`, 
                height: '100%',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                padding: '0 10px',
                fontSize: '0.75rem',
                color: '#ffffff73',
                fontWeight: 'bold',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                background: '#1e1432fa',
                borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(8px)',
                position: 'sticky',
                left: 0,
                zIndex: 20
              }}
            >
              Time
            </div>
            <TimelineRuler totalSeconds={totalSeconds} />
          </div>

          {/* Track Lanes */}
          {tracks.map((track, idx) => (
            <TrackRow
              key={track.trackId}
              trackId={track.trackId}
              trackName={track.name}
              trackIcon={track.icon}
              laneRef={idx === 0 ? firstLaneRef : undefined}
            />
          ))}

          {/* Playhead 직접 독립 렌더링 (부모 pointer-events 제한 해결 및 zIndex 최상위 적용) */}
          <Playhead />
        </div>
      </div>
    </main>
  )
}

function Playhead() {
  const currentTime = usePlaybackStore(s => s.currentTime)
  const pixelsPerSecond = useZoomStore(s => s.pixelsPerSecond)
  
  // absolute 렌더링을 위해 TRACK_HEADER_WIDTH_PX(200px)을 더합니다.
  const leftPx = TRACK_HEADER_WIDTH_PX + currentTime * pixelsPerSecond

  return (
    <div
      style={{
        left: `${leftPx}px`,
        position: 'absolute',
        top: 0,
        bottom: 0,
        zIndex: 25, // 눈금자 삼각형 지시침 머리(30)보다는 아래, 트랙 라인보다는 위에 배치
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'none', // 전체 재생헤드 라인은 트랙 영역 조작(블록 선택/repaint)에 마우스 다운 이벤트를 100% 양보
        width: '2px'
      }}
    >
      {/* 얇고 깨끗한 2px 빨간 실선 복원 + 은은한 발광 효과 */}
      <div 
        style={{
          width: '2px',
          height: '100%',
          backgroundColor: '#ff3b30',
          boxShadow: '0 0 6px rgba(255, 59, 48, 0.5)'
        }}
      />
    </div>
  )
}