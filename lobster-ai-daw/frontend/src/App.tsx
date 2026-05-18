import React from 'react'
import './styles/theme.css'
import './styles/glassmorphism.css'

function App() {
  return (
    <div className="daw-container">
      {/* Header bar */}
      <header className="daw-header glass-card">
        <div className="logo-container">
          <span className="lobster-logo">🦞</span>
          <h1>LOBSTER AI WEB DAW</h1>
          <span className="badge">v1.0</span>
        </div>
        <div className="server-status">
          <span className="status-indicator online"></span>
          <span>API Wrapper Status: Online (8002)</span>
        </div>
      </header>

      {/* Main content workspace */}
      <div className="daw-workspace">
        {/* Left panel: Instrument Library */}
        <aside className="daw-sidebar glass-card">
          <h3>Instruments</h3>
          <ul className="instrument-list">
            <li><span className="icon">🎹</span> Grand Piano</li>
            <li><span className="icon">🎻</span> Strings Ensemble</li>
            <li><span className="icon">🥁</span> Acoustic Drums</li>
            <li><span className="icon">🎸</span> Bass Guitar</li>
          </ul>
        </aside>

        {/* Center panel: Timeline & Tracks */}
        <main className="daw-main-timeline glass-card">
          <div className="timeline-header">
            <h3>Timeline Editor</h3>
            <div className="transport-controls">
              <button className="btn-play">▶ Play</button>
              <button className="btn-stop">■ Stop</button>
            </div>
          </div>
          <div className="timeline-body">
            <div className="track-row">
              <div className="track-header">🎹 Track 1</div>
              <div className="track-lane">
                <div className="audio-block glass-block">Intro Block (30s)</div>
              </div>
            </div>
            <div className="track-row">
              <div className="track-header">🎻 Track 2</div>
              <div className="track-lane">
                <div className="audio-block glass-block">Verse Block (30s)</div>
              </div>
            </div>
          </div>
        </main>

        {/* Right panel: AI Chat assistant */}
        <section className="daw-chat-panel glass-card">
          <h3>💬 AI Co-Composer</h3>
          <div className="chat-history">
            <div className="message system">
              <p>Welcome! Ask me to compose blocks or edit specific segments on the timeline.</p>
            </div>
          </div>
          <div className="chat-input-container">
            <input type="text" placeholder="e.g., Generate a 30s piano intro..." />
            <button>Send</button>
          </div>
        </section>
      </div>

      {/* Bottom bar */}
      <footer className="daw-footer glass-card">
        <span>GPU: RTX 4060 (Active)</span>
        <span>|</span>
        <span>Buffer Status: Ready</span>
      </footer>
    </div>
  )
}

export default App
