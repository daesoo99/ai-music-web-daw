import { APP_FULL_NAME, APP_VERSION } from '../../constants/branding'
import { PROJECT_ID } from '../../constants/instruments'
import { useProjectStore } from '../../store/useProjectStore'
import { useState } from 'react'

export function DawHeader() {
  const [isResetting, setIsResetting] = useState(false)
  const setProject = useProjectStore(s => s.setProject)

  const handleResetProject = async () => {
    if (!window.confirm("모든 블록과 트랙이 삭제됩니다. 계속하시겠습니까?")) {
      return
    }

    setIsResetting(true)
    try {
      const res = await fetch(`/api/projects/${PROJECT_ID}/reset`, {
        method: 'POST',
      })

      if (res.ok) {
        const defaultTracks = [
          { trackId: "piano", name: "Grand Piano", icon: "🎹" },
          { trackId: "strings", name: "Strings Ensemble", icon: "🎻" },
          { trackId: "drums", name: "Acoustic Drums", icon: "🥁" },
          { trackId: "bass", name: "Bass Guitar", icon: "🎸" }
        ]
        setProject(defaultTracks, [], "프로젝트 초기화")
        window.location.reload()
      } else {
        alert("프로젝트 초기화 실패")
      }
    } catch (err) {
      console.error(err)
      alert("오류가 발생했습니다.")
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <header className="daw-header glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div className="logo-container" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-10)' }}>
        <span className="lobster-logo">🦞</span>
        <h1>{APP_FULL_NAME.toUpperCase()}</h1>
        <span className="badge">{APP_VERSION}</span>
        
        <button 
          className="btn-reset-project"
          onClick={handleResetProject}
          disabled={isResetting}
          style={{
            marginLeft: 'var(--spacing-16)',
            background: 'var(--color-accent-danger)',
            border: 'none',
            borderRadius: 'var(--radius-4)',
            color: 'var(--color-white)',
            padding: 'var(--spacing-4) var(--spacing-8)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)',
            cursor: isResetting ? 'not-allowed' : 'pointer',
            opacity: isResetting ? 0.5 : 1
          }}
          title="프로젝트를 초기화 상태로 되돌립니다."
        >
          {isResetting ? '초기화 중...' : '🗑 프로젝트 초기화'}
        </button>
      </div>
      <div className="server-status">
        <span className="status-indicator online" />
        <span>API Wrapper Status: Online (8002)</span>
      </div>
    </header>
  )
}
