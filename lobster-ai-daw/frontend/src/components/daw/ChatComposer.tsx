import { useState, useCallback, useMemo, useEffect } from 'react'
import { shallow } from 'zustand/shallow'
import { useSelectionStore } from '../../store/useSelectionStore'
import { useProjectStore } from '../../store/useProjectStore'
import { useJobStore } from '../../store/useJobStore'
import { wsClient } from '../../services/wsClient'
import {
  composeSequence,
  repaintSegment,
  ComposeServiceError,
} from '../../services/composeService'
import { COMPOSER_INSTRUMENTS, PROJECT_ID } from '../../constants/instruments'
import { formatTime } from '../../utils/formatTime'
import { JobMessageView } from './JobMessageView'
import { ReplaceConfirmModal } from './ReplaceConfirmModal'
import { inferTrackFromPrompt } from '../../utils/trackInference'

const DYNAMIC_INSTRUMENTS: Record<string, { name: string; icon: string }> = {
  piano: { name: 'Grand Piano', icon: '🎹' },
  strings: { name: 'Strings Ensemble', icon: '🎻' },
  drums: { name: 'Acoustic Drums', icon: '🥁' },
  bass: { name: 'Bass Guitar', icon: '🎸' },
  guitar: { name: 'Guitar', icon: '🎸' },
  saxophone: { name: 'Saxophone', icon: '🎷' },
  flute: { name: 'Flute', icon: '🎵' },
  trumpet: { name: 'Trumpet', icon: '🎺' }
}

function ensureTrackRegistered(trackId: string) {
  const store = useProjectStore.getState()
  const exists = store.tracks.some(t => t.trackId === trackId)
  if (!exists) {
    const details = DYNAMIC_INSTRUMENTS[trackId]
    const trackName = details ? details.name : `${trackId.charAt(0).toUpperCase() + trackId.slice(1)}`
    const trackIcon = details ? details.icon : '🎵'
    store.setProject([...store.tracks, { trackId, name: trackName, icon: trackIcon }], store.blocks, "트랙 추가")
  }
}

interface RepaintInfo {
  sourceBlockId: string
  trackId: string
  startSeconds: number
  endSeconds: number
  absoluteStartSeconds: number
  absoluteEndSeconds: number
}

export function ChatComposer() {
  const [chatInput, setChatInput] = useState('')
  const [startTimeInput, setStartTimeInput] = useState('')
  const [selectedTrackId, setSelectedTrackId] = useState('piano')
  const [durationSeconds, setDurationSeconds] = useState(60)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [systemError, setSystemError] = useState<string | null>(null)

  // Replace Modal States
  const [showReplaceModal, setShowReplaceModal] = useState(false)
  const [pendingPrompt, setPendingPrompt] = useState('')

  // 인퍼런스 상태
  const [isManuallyOverridden, setIsManuallyOverridden] = useState(false)
  const [inferenceMessage, setInferenceMessage] = useState<string | null>(null)

  const repaintInfo = useSelectionStore<RepaintInfo | null>(
    s => (s.valid && s.sourceBlockId && s.trackId
      ? {
          sourceBlockId: s.sourceBlockId,
          trackId: s.trackId,
          startSeconds: s.startSeconds!,
          endSeconds: s.endSeconds!,
          absoluteStartSeconds: s.absoluteStartSeconds!,
          absoluteEndSeconds: s.absoluteEndSeconds!,
        }
      : null),
    shallow,
  )
  const clearSelection = useSelectionStore(s => s.clearSelection)

  const jobIds = useJobStore(s => Object.keys(s.jobs), shallow)

  const isRepaintMode = repaintInfo !== null
  const selectedInstrument = useMemo(
    () => COMPOSER_INSTRUMENTS.find(i => i.id === selectedTrackId) ?? COMPOSER_INSTRUMENTS[0],
    [selectedTrackId],
  )

  const actuallyCompose = useCallback(async (promptText: string, previousBlockId?: string) => {
    setIsSubmitting(true)
    setSystemError(null)

    let startTime: number | null = null;
    if (startTimeInput.trim() !== '') {
      const parsed = parseTimeStringToSeconds(startTimeInput);
      if (parsed === null) {
        setSystemError("시작 시간이 올바르지 않습니다. (예: 1:30 또는 90)");
        setIsSubmitting(false);
        return;
      }
      startTime = parsed;
    }

    try {
      ensureTrackRegistered(selectedTrackId)
      const { job_id } = await composeSequence({
        projectId: PROJECT_ID,
        specs: [{
          prompt: promptText,
          duration_seconds: durationSeconds,
          track_id: selectedTrackId,
          previous_block_id: previousBlockId,
          start_time: startTime,
        }],
      })
      useJobStore.getState().startJob(job_id, promptText)
      wsClient.subscribe(job_id, PROJECT_ID)
    } catch (err) {
      const message = err instanceof ComposeServiceError
        ? err.message
        : (err as Error).message ?? '오류 발생'
      setSystemError(`요청 실패: ${message}`)
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedTrackId, durationSeconds, startTimeInput])

  const handleSubmit = useCallback(async () => {
    const promptText = chatInput.trim()
    if (!promptText || isSubmitting) return

    setChatInput('')
    setStartTimeInput('')
    setIsManuallyOverridden(false) // 수동 해제
    setInferenceMessage(null)      // 리셋

    if (isRepaintMode && repaintInfo) {
      setIsSubmitting(true)
      setSystemError(null)
      try {
        const { job_id } = await repaintSegment({
          projectId: PROJECT_ID,
          sourceBlockId: repaintInfo.sourceBlockId,
          trackId: repaintInfo.trackId,
          startSeconds: repaintInfo.startSeconds,
          endSeconds: repaintInfo.endSeconds,
          newPrompt: promptText,
        })
        const label = `[Repaint ${repaintInfo.startSeconds.toFixed(1)}-${repaintInfo.endSeconds.toFixed(1)}] ${promptText}`
        useJobStore.getState().startJob(job_id, label)
        wsClient.subscribe(job_id, PROJECT_ID)
        clearSelection()
      } catch (err) {
        const message = err instanceof ComposeServiceError
          ? err.message
          : (err as Error).message ?? '오류 발생'
        setSystemError(`요청 실패: ${message}`)
      } finally {
        setIsSubmitting(false)
      }
    } else {
      const hasBlock = useProjectStore.getState().blocks.some(b => b.trackId === selectedTrackId)
      if (hasBlock) {
        setPendingPrompt(promptText)
        setShowReplaceModal(true)
      } else {
        await actuallyCompose(promptText)
      }
    }
  }, [
    chatInput, isSubmitting, isRepaintMode, repaintInfo,
    selectedTrackId, clearSelection, actuallyCompose,
  ])

  const handleReplaceConfirm = useCallback(async () => {
    setShowReplaceModal(false)
    if (!pendingPrompt) return

    const blocksToRemove = useProjectStore.getState().blocks.filter(b => b.trackId === selectedTrackId)
    blocksToRemove.forEach(b => useProjectStore.getState().removeBlock(b.blockId))

    await actuallyCompose(pendingPrompt)
    setPendingPrompt('')
  }, [selectedTrackId, pendingPrompt, actuallyCompose])

  const handleContinue = useCallback(async () => {
    setShowReplaceModal(false)
    const existingBlock = useProjectStore.getState().blocks.find(b => b.trackId === selectedTrackId)
    if (!existingBlock || !pendingPrompt) return

    await actuallyCompose(pendingPrompt, existingBlock.blockId)
    setPendingPrompt('')
  }, [selectedTrackId, pendingPrompt, actuallyCompose])

  const handleReplaceCancel = useCallback(() => {
    setShowReplaceModal(false)
    setPendingPrompt('')
  }, [])

  return (
    <section className="daw-chat-panel glass-card">
      <h3>🤖 AI Co-Composer</h3>
      <div className="chat-history">
        <div className="message system">
          <p>Welcome! Ask me to compose blocks or drag to repaint.</p>
        </div>
        {systemError && (
          <div className="message system error"><p>{systemError}</p></div>
        )}
        {jobIds.map(jobId => (
          <JobMessageView key={jobId} jobId={jobId} />
        ))}
      </div>

      <ReplaceConfirmModal
        isOpen={showReplaceModal}
        trackName={selectedInstrument.displayName}
        onConfirm={handleReplaceConfirm}
        onContinue={handleContinue}
        onCancel={handleReplaceCancel}
      />

      <div
        className={`chat-input-container composer-input-area ${
          isRepaintMode ? 'repaint-mode' : ''
        }`}
      >
        {isRepaintMode && repaintInfo ? (
          <RepaintBanner info={repaintInfo} onCancel={clearSelection} />
        ) : (
          <>
            {inferenceMessage && (
              <div 
                className="inference-indicator" 
                style={{ 
                  fontSize: '0.8rem', 
                  color: '#ffd700', 
                  background: 'rgba(255, 215, 0, 0.1)', 
                  border: '1px solid rgba(255, 215, 0, 0.2)',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  marginBottom: '8px',
                  animation: 'pulse 2s infinite'
                }}
              >
                ✨ {inferenceMessage}
              </div>
            )}
            <ComposeConfigRow
              selectedTrackId={selectedTrackId}
              onSelectedTrackChange={(id) => {
                setSelectedTrackId(id)
                setIsManuallyOverridden(true) // 수동 모드 설정
                setInferenceMessage(null)
              }}
              durationSeconds={durationSeconds}
              onDurationChange={setDurationSeconds}
              disabled={isSubmitting}
            />

            <div className="chat-config-row" style={{ marginTop: 'var(--spacing-8)' }}>
              <div className="config-group start-time-group" style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-4)' }}>
                  <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--text-secondary)' }}>시작 시간 (초):</label>
                </div>
                <input
                  type="text"
                  placeholder="예: 1:30 또는 90 (비우면 자동)"
                  value={startTimeInput}
                  onChange={e => setStartTimeInput(e.target.value)}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-4)',
                    padding: 'var(--spacing-8)',
                    color: 'var(--color-white)',
                    fontSize: 'var(--font-size-sm)',
                    position: 'relative',
                    zIndex: 10,
                    pointerEvents: 'auto'
                  }}
                />
              </div>
            </div>
          </>
        )}

        <div className="chat-input-row">
          <input
            type="text"
            placeholder={isRepaintMode
              ? '예: 이 구간에 잔잔한 드럼 추가...'
              : `예: 잔잔한 ${selectedInstrument.displayName.toLowerCase()} 인트로...`}
            value={chatInput}
            onChange={(e) => {
              const val = e.target.value
              setChatInput(val)
              
              if (!isManuallyOverridden) {
                const inferred = inferTrackFromPrompt(val)
                if (inferred) {
                  ensureTrackRegistered(inferred)
                  setSelectedTrackId(inferred)
                  const details = DYNAMIC_INSTRUMENTS[inferred]
                  const displayName = details ? details.name : inferred
                  setInferenceMessage(`트랙 '${displayName}'으로 자동 매칭되었습니다.`)
                } else {
                  setInferenceMessage(null)
                }
              }
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            disabled={isSubmitting}
          />
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !chatInput.trim()}
            className={isRepaintMode ? 'btn-repaint' : ''}
          >
            {isSubmitting ? '...' : isRepaintMode ? 'Repaint' : 'Send'}
          </button>
        </div>
      </div>
    </section>
  )
}

function parseTimeStringToSeconds(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const minSecRegex = /^(\d+):([0-5]?\d)$/
  const minSecMatch = trimmed.match(minSecRegex)
  if (minSecMatch) {
    const minutes = parseInt(minSecMatch[1], 10)
    const seconds = parseInt(minSecMatch[2], 10)
    return minutes * 60 + seconds
  }

  const rawSecRegex = /^\d+$/
  if (rawSecRegex.test(trimmed)) {
    return parseInt(trimmed, 10)
  }

  return null
}

function RepaintBanner({
  info, onCancel,
}: { info: RepaintInfo; onCancel: () => void }) {
  const track = useProjectStore(s => s.tracks.find(t => t.trackId === info.trackId))
  const blocks = useProjectStore(s => s.blocks)
  const setSelectionByAbsoluteSeconds = useSelectionStore(s => s.setSelectionByAbsoluteSeconds)

  const displayName = track ? track.name : info.trackId
  const displayIcon = track?.icon ?? '🎹'

  const [startInput, setStartInput] = useState(formatTime(info.absoluteStartSeconds))
  const [endInput, setEndInput] = useState(formatTime(info.absoluteEndSeconds))

  useEffect(() => {
    setStartInput(formatTime(info.absoluteStartSeconds))
  }, [info.absoluteStartSeconds])

  useEffect(() => {
    setEndInput(formatTime(info.absoluteEndSeconds))
  }, [info.absoluteEndSeconds])

  const handleStartCommit = () => {
    const parsed = parseTimeStringToSeconds(startInput)
    if (parsed !== null) {
      setSelectionByAbsoluteSeconds(info.trackId, parsed, info.absoluteEndSeconds, blocks)
    } else {
      setStartInput(formatTime(info.absoluteStartSeconds))
    }
  }

  const handleEndCommit = () => {
    const parsed = parseTimeStringToSeconds(endInput)
    if (parsed !== null) {
      setSelectionByAbsoluteSeconds(info.trackId, info.absoluteStartSeconds, parsed, blocks)
    } else {
      setEndInput(formatTime(info.absoluteEndSeconds))
    }
  }

  const duration = info.absoluteEndSeconds - info.absoluteStartSeconds

  return (
    <div className="repaint-banner flex-column">
      <div className="repaint-banner-header">
        <span className="icon">{displayIcon}</span>
        <strong>Repaint Mode:</strong>{' '}
        <small style={{ marginLeft: '4px' }}>
          in {displayName} / block {info.sourceBlockId.substring(0, 8)}
        </small>
        <button className="btn-cancel-repaint" onClick={onCancel} style={{ marginLeft: 'auto' }}>×</button>
      </div>
      <div className="repaint-inputs-row">
        <div className="time-input-group">
          <label>시작:</label>
          <input
            type="text"
            className="repaint-time-input"
            value={startInput}
            placeholder="예: 1:37 또는 97"
            onChange={(e) => setStartInput(e.target.value)}
            onBlur={handleStartCommit}
            onKeyDown={(e) => e.key === 'Enter' && handleStartCommit()}
          />
        </div>
        <div className="time-input-group">
          <label>종료:</label>
          <input
            type="text"
            className="repaint-time-input"
            value={endInput}
            placeholder="예: 1:37 또는 97"
            onChange={(e) => setEndInput(e.target.value)}
            onBlur={handleEndCommit}
            onKeyDown={(e) => e.key === 'Enter' && handleEndCommit()}
          />
        </div>
        <span className="repaint-duration-label">
          ({duration.toFixed(1)}s 선택)
        </span>
      </div>
    </div>
  )
}

interface ComposeConfigRowProps {
  selectedTrackId: string
  onSelectedTrackChange: (id: string) => void
  durationSeconds: number
  onDurationChange: (d: number) => void
  disabled: boolean
}

function ComposeConfigRow({
  selectedTrackId, onSelectedTrackChange,
  durationSeconds, onDurationChange, disabled,
}: ComposeConfigRowProps) {
  const tracks = useProjectStore(s => s.tracks)

  return (
    <div className="chat-config-row">
      <div className="config-group">
        <label>Track:</label>
        <select
          value={selectedTrackId}
          onChange={(e) => onSelectedTrackChange(e.target.value)}
          disabled={disabled}
          style={{ textTransform: 'capitalize' }}
        >
          {tracks.map(t => (
            <option key={t.trackId} value={t.trackId}>
              {t.icon ? `${t.icon} ${t.name}` : `🎹 ${t.name}`}
            </option>
          ))}
        </select>
      </div>

      <div className="config-group duration-group">
        <div className="duration-header">
          <label>Length:</label>
        </div>
        <div className="slider-container-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="slider-bound">10s</span>
          <input
            type="range" min="10" max="180" step={10}
            value={durationSeconds}
            onChange={(e) => onDurationChange(parseInt(e.target.value))}
            disabled={disabled}
            className="duration-slider"
            style={{ flex: 1 }}
          />
          <span className="slider-bound" style={{ marginRight: '8px' }}>180s</span>
          <span className="duration-value-large" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', minWidth: '40px', textAlign: 'right', color: 'var(--text-secondary)' }}>
            {durationSeconds}s
          </span>
        </div>
        <div className="preset-chips">
          {[60, 90, 120, 150, 180].map(val => (
            <button
              key={val}
              className={`chip ${durationSeconds === val ? 'active' : ''}`}
              onClick={() => onDurationChange(val)}
              disabled={disabled}
            >
              {val}s
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
