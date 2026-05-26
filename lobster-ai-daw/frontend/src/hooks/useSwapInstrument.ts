import { useCallback } from 'react'
import { useSwapStore } from '../store/useSwapStore'
import { useJobStore } from '../store/useJobStore'
import { wsClient } from '../services/wsClient'
import { PROJECT_ID } from '../constants/instruments'

export function useSwapInstrument() {
  const pending = useSwapStore(s => s.pending)
  const requestSwap = useSwapStore(s => s.requestSwap)
  const cancelSwap = useSwapStore(s => s.cancelSwap)
  
  const confirmSwap = useCallback(async (instrumentPrompt: string) => {
    if (!pending) return
    const req = pending
    cancelSwap()
    
    const res = await fetch('/api/blocks/swap-instrument', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_block_id: req.sourceBlockId,
        target_track_id: req.targetTrackId,
        target_instrument_prompt: instrumentPrompt,
        timeline_start_seconds: req.dropAtSeconds,
      }),
    })
    
    if (!res.ok) {
      const err = await res.text()
      alert(`악기 스왑 실패: ${err}`)
      return
    }
    
    const { job_id } = await res.json()
    useJobStore.getState().startJob(job_id, `🔄 악기 스왑 → ${req.targetTrackId}`)
    wsClient.subscribe(job_id, PROJECT_ID)
  }, [pending, cancelSwap])
  
  return { pending, requestSwap, confirmSwap, cancelSwap }
}
