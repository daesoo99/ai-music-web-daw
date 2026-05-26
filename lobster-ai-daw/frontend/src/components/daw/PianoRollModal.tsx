import { useEffect, useMemo } from 'react'
import { useNotesStore } from '../../store/useNotesStore'
import { useProjectStore } from '../../store/useProjectStore'

interface PianoRollModalProps {
  blockId: string
  onClose: () => void
  onAnalyze: () => void
}

const NOTE_HEIGHT = 6
const PIXELS_PER_SECOND = 80

export function PianoRollModal({ blockId, onClose, onAnalyze }: PianoRollModalProps) {
  const midi = useNotesStore(s => s.midi[blockId])
  const loading = useNotesStore(s => s.loading[blockId])
  const fetchMidi = useNotesStore(s => s.fetchMidi)
  const block = useProjectStore(s => s.blocks.find(b => b.blockId === blockId))
  
  useEffect(() => { fetchMidi(blockId) }, [blockId, fetchMidi])
  
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  
  const { width, viewBox } = useMemo(() => {
    if (!midi?.notes?.length || !block) return { width: 800, viewBox: '0 0 800 400' }
    const [minPitch, maxPitch] = midi.pitchRange ?? [21, 108]
    const pitchSpan = maxPitch - minPitch + 4 
    const w = Math.max(800, block.durationSeconds * PIXELS_PER_SECOND)
    const h = pitchSpan * NOTE_HEIGHT
    return { width: w, viewBox: `0 0 ${w} ${h}` }
  }, [midi, block])
  
  const renderState =
    !midi || loading ? 'loading'
    : midi.status === 'ready' ? 'ready'
    : midi.status
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="piano-roll-modal glass-card" onClick={e => e.stopPropagation()}>
        <header className="piano-roll-header">
          <div>
            <h2>🎹 Piano Roll</h2>
            <p className="block-meta">
              {block?.prompt ?? blockId.substring(0, 8)}
              {midi?.detectedKey && <span className="badge"> · {midi.detectedKey}</span>}
              {midi?.detectedTempo && <span className="badge"> · {Math.round(midi.detectedTempo)} BPM</span>}
            </p>
          </div>
          <div className="actions">
            <button className="btn-primary" onClick={onAnalyze} disabled={renderState !== 'ready'}>
              💬 이 음악 분석하기
            </button>
            {midi?.midiFileUrl && (
              <a href={midi.midiFileUrl} download className="btn-secondary">
                📥 MIDI 다운로드
              </a>
            )}
            <button onClick={onClose}>✕</button>
          </div>
        </header>
        
        <div className="piano-roll-body">
          {renderState === 'loading' && <div className="state-msg">노트 데이터 로딩 중...</div>}
          {renderState === 'transcribing' && (
            <div className="state-msg">
              🎼 AI가 오디오에서 음표를 추출하고 있습니다... <br />
              <small>이 작업은 백그라운드에서 진행되며 완료되면 자동으로 표시됩니다.</small>
            </div>
          )}
          {renderState === 'unavailable' && (
            <div className="state-msg">
              ⚠️ 이 트랙은 자동 노트 추출이 지원되지 않습니다 (드럼/타악기).
            </div>
          )}
          {renderState === 'failed' && (
            <div className="state-msg error">
              ❌ 노트 추출에 실패했습니다: {midi?.failureReason}
            </div>
          )}
          {renderState === 'ready' && midi && (
            <PianoRollSVG
              notes={midi.notes}
              pitchRange={midi.pitchRange ?? [21, 108]}
              width={width}
              viewBox={viewBox}
            />
          )}
        </div>
      </div>
    </div>
  )
}

interface PianoRollSVGProps {
  notes: { pitch: number; start: number; duration: number; velocity: number }[]
  pitchRange: [number, number]
  width: number
  viewBox: string
}

function PianoRollSVG({ notes, pitchRange, width, viewBox }: PianoRollSVGProps) {
  const [minPitch, maxPitch] = pitchRange
  
  const blackKeyPitchClasses = new Set([1, 3, 6, 8, 10])
  const rows = []
  for (let p = minPitch - 2; p <= maxPitch + 2; p++) {
    const isBlack = blackKeyPitchClasses.has(p % 12)
    const isC = (p % 12) === 0
    const y = (maxPitch + 2 - p) * NOTE_HEIGHT
    rows.push(
      <rect
        key={p}
        x={0} y={y} width={width} height={NOTE_HEIGHT}
        fill={isBlack ? 'rgba(255,255,255,0.04)' : 'transparent'}
      />
    )
    if (isC) {
      rows.push(
        <text key={`label-${p}`} x={4} y={y + NOTE_HEIGHT - 1} 
              fontSize="8" fill="rgba(255,255,255,0.4)">
          C{(p / 12) - 1 | 0}
        </text>
      )
    }
  }
  
  return (
    <svg width="100%" viewBox={viewBox} preserveAspectRatio="xMinYMid meet" className="piano-roll-svg">
      {rows}
      {notes.map((n, i) => {
        const x = n.start * PIXELS_PER_SECOND
        const y = (maxPitch + 2 - n.pitch) * NOTE_HEIGHT
        const w = Math.max(2, n.duration * PIXELS_PER_SECOND)
        const opacity = 0.4 + (n.velocity / 127) * 0.6
        return (
          <rect
            key={i}
            x={x} y={y} width={w} height={NOTE_HEIGHT - 1}
            rx={1}
            fill="rgb(100, 200, 255)"
            opacity={opacity}
          />
        )
      })}
    </svg>
  )
}
