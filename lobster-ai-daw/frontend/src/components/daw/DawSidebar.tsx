import { useState, useEffect } from 'react'
import { PROJECT_ID } from '../../constants/instruments'
import { useProjectStore } from '../../store/useProjectStore'

interface ArchiveItem {
  name: string
  createdAt: number
  updatedAt: number
}

function hasValidArchiveNameCharacter(name: string): boolean {
  return /[A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ]/.test(name)
}

export function DawSidebar() {
  const [activeTab, setActiveTab] = useState<'inst' | 'history' | 'archive'>('inst')
  const [archives, setArchives] = useState<ArchiveItem[]>([])
  const [newArchiveName, setNewArchiveName] = useState('')
  const [isSavingArchive, setIsSavingArchive] = useState(false)

  const historyStack = useProjectStore(s => s.historyStack)
  const historyIndex = useProjectStore(s => s.historyIndex)
  const jumpToHistory = useProjectStore(s => s.jumpToHistory)
  const setProject = useProjectStore(s => s.setProject)
  const tracks = useProjectStore(s => s.tracks)
  const blocks = useProjectStore(s => s.blocks)

  const fetchArchives = async () => {
    try {
      const res = await fetch(`/api/projects/${PROJECT_ID}/archives`)
      if (res.ok) {
        const data = await res.json()
        setArchives(data.archives || [])
      }
    } catch (err) {
      console.error('[Archives] 아카이브 목록 불러오기 실패:', err)
    }
  }

  useEffect(() => {
    if (activeTab === 'archive') {
      fetchArchives()
    }
  }, [activeTab])

  const handleSaveArchive = async () => {
    const name = newArchiveName.trim()

    if (!name) return

    if (!hasValidArchiveNameCharacter(name)) {
      alert('특수문자를 제외한 유효한 이름을 입력해 주세요.')
      return
    }

    const alreadyExists = archives.some(archive => archive.name === name)

    if (alreadyExists) {
      const shouldOverwrite = confirm(
        '이미 존재하는 아카이브 이름입니다. 기존 저장본을 최신 상태로 덮어쓰시겠습니까?',
      )

      if (!shouldOverwrite) {
        return
      }
    }

    setIsSavingArchive(true)

    try {
      const res = await fetch(`/api/projects/${PROJECT_ID}/archives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archiveName: name,
          state: { tracks, blocks },
        }),
      })

      if (res.ok) {
        setNewArchiveName('')
        fetchArchives()
      } else {
        alert('저장에 실패했습니다. 특수문자를 제외하고 입력하세요.')
      }
    } catch (err) {
      console.error('[Archives] 저장 실패:', err)
    } finally {
      setIsSavingArchive(false)
    }
  }

  const handleLoadArchive = async (archiveName: string) => {
    try {
      const res = await fetch(`/api/projects/${PROJECT_ID}/archives/${archiveName}`)
      if (res.ok) {
        const data = await res.json()
        const trks = data.tracks ?? []
        const blks = data.blocks ?? []
        setProject(trks, blks, `아카이브 불러오기: [${archiveName}]`)
      }
    } catch (err) {
      console.error('[Archives] 복원 실패:', err)
    }
  }

  const handleDeleteArchive = async (archiveName: string) => {
    if (!confirm(`'${archiveName}' 아카이브를 영구 삭제하시겠습니까?`)) return

    try {
      const res = await fetch(`/api/projects/${PROJECT_ID}/archives/${archiveName}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        fetchArchives()
      }
    } catch (err) {
      console.error('[Archives] 삭제 실패:', err)
    }
  }

  return (
    <aside className="daw-sidebar glass-card">
      <div className="sidebar-tabs">
        <button
          className={`tab-btn ${activeTab === 'inst' ? 'active' : ''}`}
          onClick={() => setActiveTab('inst')}
        >
          🎵 악기
        </button>

        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          ⏳ 작업 내역
        </button>

        <button
          className={`tab-btn ${activeTab === 'archive' ? 'active' : ''}`}
          onClick={() => setActiveTab('archive')}
        >
          💾 아카이브
        </button>
      </div>

      <div className="sidebar-content">
        {activeTab === 'inst' && (
          <div className="tab-pane instrument-pane animate-fade-in">
            <h4>🎹 가상 악기 트랙</h4>
            <ul className="instrument-list">
              {tracks.map(trk => (
                <li key={trk.trackId} className="instrument-item">
                  <span className="inst-icon">{trk.icon || "🎵"}</span>
                  <span className="inst-name">{trk.name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="tab-pane history-pane animate-fade-in">
            <div className="history-header">
              <h4>⏳ 작업 기록 (실행 취소)</h4>
              <small>기록 항목을 클릭하면 해당 상태로 돌아갑니다.</small>
            </div>

            <ul className="history-list">
              {historyStack.map((item, idx) => {
                const isActive = idx === historyIndex
                const isFuture = idx > historyIndex

                return (
                  <li
                    key={idx}
                    className={`history-item ${isActive ? 'active' : ''} ${isFuture ? 'future' : ''}`}
                  >
                    <button onClick={() => jumpToHistory(idx)}>
                      <span className="history-bullet">{isActive ? '▶ ' : '• '}</span>
                      <span className="history-text">{item.actionName}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {activeTab === 'archive' && (
          <div className="tab-pane archive-pane animate-fade-in">
            <h4>💾 프로젝트 아카이브</h4>
            <small>현재 프로젝트 버전을 서버에 저장합니다.</small>

            <div className="archive-save-box">
              <input
                type="text"
                placeholder="버전 이름을 입력하세요..."
                value={newArchiveName}
                onChange={(e) => setNewArchiveName(e.target.value)}
                disabled={isSavingArchive}
              />

              <button
                onClick={handleSaveArchive}
                disabled={isSavingArchive || !newArchiveName.trim()}
              >
                저장
              </button>
            </div>

            <ul className="archive-list">
              {archives.length === 0 ? (
                <li className="empty-message">저장된 아카이브가 없습니다.</li>
              ) : (
                archives.map(arch => (
                  <li key={arch.name} className="archive-item">
                    <div className="archive-info">
                      <span className="archive-name">{arch.name}</span>
                      <span className="archive-date">
                        {new Date(arch.updatedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="archive-actions">
                      <button
                        className="btn-load"
                        onClick={() => handleLoadArchive(arch.name)}
                        title="이 버전으로 복원"
                      >
                        불러오기
                      </button>

                      <button
                        className="btn-delete"
                        onClick={() => handleDeleteArchive(arch.name)}
                        title="아카이브 삭제"
                      >
                        삭제
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </aside>
  )
}
