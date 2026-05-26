import { useState } from 'react'
import { useSwapInstrument } from '../../hooks/useSwapInstrument'

export function SwapConfirmModal() {
  const { pending, confirmSwap, cancelSwap } = useSwapInstrument()
  const [prompt, setPrompt] = useState('')

  if (!pending) return null

  return (
    <div className="modal-overlay">
      <div className="swap-confirm-modal glass-card">
        <h3>🔄 악기 스왑 (Timbre Transfer)</h3>
        <p>
          원본 블록의 음표(멜로디)를 추출하여 <strong>{pending.targetTrackId}</strong> 트랙의 악기로 연주합니다.
        </p>
        <div className="form-group">
          <label>새로운 악기 스타일 프롬프트:</label>
          <input 
            type="text" 
            placeholder={`예: warm acoustic ${pending.targetTrackId}, clean sound`}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            autoFocus
          />
        </div>
        <div className="actions">
          <button className="btn-secondary" onClick={cancelSwap}>취소</button>
          <button className="btn-primary" onClick={() => confirmSwap(prompt)} disabled={!prompt.trim()}>
            스왑 실행
          </button>
        </div>
      </div>
    </div>
  )
}
