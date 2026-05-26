import { useState, useCallback } from 'react'

interface AnalysisPanelProps {
  blockId: string
  onClose: () => void
}

export function AnalysisPanel({ blockId, onClose }: AnalysisPanelProps) {
  const [text, setText] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  
  const startAnalysis = useCallback(async (q?: string) => {
    setText('')
    setError(null)
    setStreaming(true)
    
    try {
      const res = await fetch('/api/blocks/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ block_id: blockId, question: q ?? null }),
      })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
      
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const obj = JSON.parse(line)
            if (obj.token) setText(prev => prev + obj.token)
            if (obj.error) setError(obj.error)
            if (obj.done) setStreaming(false)
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setStreaming(false)
    }
  }, [blockId])
  
  return (
    <div className="analysis-panel glass-card">
      <div className="analysis-header">
        <h3>💡 AI 음악 도슨트</h3>
        <button onClick={onClose}>✕</button>
      </div>
      
      {!text && !streaming && (
        <button className="btn-primary" onClick={() => startAnalysis()}>
          이 블록 분석 시작
        </button>
      )}
      
      <div className="analysis-text">
        {text}
        {streaming && <span className="cursor">▊</span>}
      </div>
      
      {error && <div className="error-text">❌ {error}</div>}
      
      {(text && !streaming) && (
        <div className="follow-up">
          <input
            type="text"
            placeholder="더 궁금한 점이 있나요? (예: 코드 진행은 뭐야?)"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && question && startAnalysis(question)}
          />
        </div>
      )}
    </div>
  )
}
