import { useEffect } from 'react'
import { shallow } from 'zustand/shallow'
import { usePlaybackStore } from '../../store/usePlaybackStore'
import { useProjectStore } from '../../store/useProjectStore'
import { useJobStore } from '../../store/useJobStore'
import { formatTime } from '../../utils/formatTime'
export function TransportControls() {
  const { currentTime, duration, isPlaying } = usePlaybackStore(
    s => ({
      currentTime: s.currentTime,
      duration: s.duration,
      isPlaying: s.isPlaying,
    }),
    shallow,
  )
  const play = usePlaybackStore(s => s.play)
  const pause = usePlaybackStore(s => s.pause)
  const stop = usePlaybackStore(s => s.stop)
  const undo = useProjectStore(s => s.undo)
  const redo = useProjectStore(s => s.redo)
  const historyStack = useProjectStore(s => s.historyStack)
  const historyIndex = useProjectStore(s => s.historyIndex)
  // 생성/Repaint 진행 중이면 Undo/Redo 비활성화
  const hasRunningJob = useJobStore(s =>
    Object.values(s.jobs).some(j => j.status === 'running')
  )
  // 전역 Ctrl+Z, Ctrl+Y 단축키 연동
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return // 입력 텍스트 필드 내 단축키는 브라우저 기본 동작 양보
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault()
          if (!hasRunningJob) undo()
        } else if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault()
          if (!hasRunningJob) redo()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, hasRunningJob])
  return (
    <div className="transport-controls">
      <button
        className={`btn-play ${isPlaying ? 'active' : ''}`}
        onClick={() => (isPlaying ? pause() : play())}
      >
        {isPlaying ? '⏸ Pause' : '▶ Play'}
      </button>
      <button className="btn-stop" onClick={stop}>■ Stop</button>
      <div className="history-quick-controls">
        <button
          className="btn-history btn-undo"
          onClick={undo}
          disabled={historyIndex <= 0 || hasRunningJob}
          title="실행 취소 (Ctrl + Z)"
        >
          ↺ Undo
        </button>
        <button
          className="btn-history btn-redo"
          onClick={redo}
          disabled={historyIndex >= historyStack.length - 1 || hasRunningJob}
          title="다시 실행 (Ctrl + Y)"
        >
          ↻ Redo
        </button>
      </div>
      <div className="time-display">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>
    </div>
  )
}
