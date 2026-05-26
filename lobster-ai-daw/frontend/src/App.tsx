import { useEffect } from 'react'
import './styles/theme.css'
import './styles/glassmorphism.css'

import { DawHeader } from './components/daw/DawHeader'
import { DawSidebar } from './components/daw/DawSidebar'
import { DawFooter } from './components/daw/DawFooter'
import { Timeline } from './components/daw/Timeline'
import { ChatComposer } from './components/daw/ChatComposer'
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts'
import { SwapConfirmModal } from './components/daw/SwapConfirmModal'
import { loadProjectState } from './services/projectPersistence'
import { PianoRollModal } from './components/daw/PianoRollModal'
import { AnalysisPanel } from './components/daw/AnalysisPanel'
import { useProjectStore } from './store/useProjectStore'

function App() {
  useGlobalShortcuts()

  const activePianoRollBlockId = useProjectStore(s => s.activePianoRollBlockId)
  const setActivePianoRollBlockId = useProjectStore(s => s.setActivePianoRollBlockId)
  const activeAnalysisBlockId = useProjectStore(s => s.activeAnalysisBlockId)
  const setActiveAnalysisBlockId = useProjectStore(s => s.setActiveAnalysisBlockId)

  // 앱 마운트 시 저장된 프로젝트 상태 자동 복원
  useEffect(() => {
    loadProjectState()
  }, [])

  return (
    <div className="daw-container">
      <DawHeader />
      <div className="daw-workspace">
        <DawSidebar />
        <Timeline />
        <ChatComposer />
      </div>
      <DawFooter />
      <SwapConfirmModal />

      {activePianoRollBlockId && (
        <PianoRollModal
          blockId={activePianoRollBlockId}
          onClose={() => setActivePianoRollBlockId(null)}
          onAnalyze={() => {
            setActivePianoRollBlockId(null)
            setActiveAnalysisBlockId(activePianoRollBlockId)
          }}
        />
      )}

      {activeAnalysisBlockId && (
        <AnalysisPanel
          blockId={activeAnalysisBlockId}
          onClose={() => setActiveAnalysisBlockId(null)}
        />
      )}
    </div>
  )
}

export default App
