import { useProjectStore } from '../../store/useProjectStore'

export function DawFooter() {
  const hasTrack = useProjectStore(s => s.tracks.length > 0)
  return (
    <footer className="daw-footer glass-card">
      <span>GPU: RTX 4060 (Active)</span>
      <span>|</span>
      <span>Buffer Status: {hasTrack ? 'Ready' : 'Waiting for blocks'}</span>
    </footer>
  )
}
