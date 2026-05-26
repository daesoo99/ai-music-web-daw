import { useJobStore } from '../../store/useJobStore'

interface JobMessageViewProps {
  jobId: string
}

function stageName(stage: string, percent: number): string {
  if (stage === 'ready') return '완료'
  if (stage === 'rendering') {
    if (percent < 0.1) return '큐 대기 중...'
    if (percent < 0.3) return 'AI 모델 초기화...'
    if (percent < 0.7) return `생성 중 (${Math.round(percent * 100)}%)`
    if (percent < 0.95) return `마무리 중 (${Math.round(percent * 100)}%)`
    return '거의 완료...'
  }
  if (stage === 'starting') return '준비 중...'
  if (stage === 'queued') return '큐 대기 중...'
  return stage
}

export function JobMessageView({ jobId }: JobMessageViewProps) {
  const job = useJobStore(s => s.jobs[jobId])
  const dismissJob = useJobStore(s => s.dismissJob)
  const cancelJob = useJobStore(s => s.cancelJob)

  if (!job) return null

  const blockKeys = Object.keys(job.blocks)
  const avgFraction = blockKeys.length === 0
    ? 0
    : blockKeys.reduce((sum, k) => sum + (job.blocks[k].fraction || 0), 0) / blockKeys.length
  const displayPercent = isNaN(avgFraction) ? 0 : avgFraction
  const currentStage = blockKeys.length > 0 ? (job.blocks[blockKeys[blockKeys.length - 1]].stage || 'starting') : 'starting'

  return (
    <div className={`message job-card ${job.status}`}>
      <div className="job-header">
        <span className="prompt-text">"{job.prompt}"</span>
        {job.status === 'completed' && <span className="badge success">완료</span>}
        {job.status === 'failed' && <span className="badge error">실패</span>}
        {job.status === 'running' && <span className="badge running">생성중</span>}
        {job.status === 'pending' && <span className="badge pending">대기중</span>}
      </div>
      {job.status === 'running' && (
        <div className="progress-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '8px' }}>
          <div style={{ flex: 1 }}>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${displayPercent * 100}%` }} />
            </div>
            <span className="progress-text">
              {stageName(currentStage, displayPercent)}
            </span>
          </div>
          <button
            className="btn-cancel"
            onClick={() => cancelJob(jobId)}
            style={{
              background: 'rgba(220, 53, 69, 0.25)',
              border: '1px solid rgba(220, 53, 69, 0.5)',
              color: '#ff6b6b',
              borderRadius: '4px',
              cursor: 'pointer',
              padding: '4px 8px',
              fontSize: '11px',
              whiteSpace: 'nowrap'
            }}
          >
            Cancel
          </button>
        </div>
      )}
      {job.error && (
        <div className="error-text" style={{ fontSize: '11px', marginTop: '8px', color: '#ff6b6b', lineHeight: '1.4' }}>
          {job.error}
        </div>
      )}
      {(job.status === 'completed' || job.status === 'failed') && (
        <button className="btn-dismiss" onClick={() => dismissJob(jobId)} style={{ marginTop: '8px' }}>닫기</button>
      )}
    </div>
  )
}