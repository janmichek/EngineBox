import { useState, useEffect, useCallback } from 'react'
import './App.css'

function App() {
  const [playlists, setPlaylists] = useState([])
  const [selected, setSelected] = useState({})
  const [status, setStatus] = useState({ status: 'idle', progress: 0, message: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/playlists')
      .then(r => r.json())
      .then(data => {
        setPlaylists(data.playlists || [])
        setLoading(false)
      })
      .catch(err => {
        setError('Failed to load playlists. Is the server running?')
        setLoading(false)
      })
  }, [])

  const pollStatus = useCallback(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(data => {
        setStatus(data)
        if (data.status === 'running') {
          setTimeout(pollStatus, 500)
        }
      })
      .catch(() => {})
  }, [])

  const handleConvert = async () => {
    const names = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => k)
    if (names.length === 0) return

    setStatus({ status: 'running', progress: 0, message: 'Starting...' })

    try {
      await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlists: names }),
      })
      pollStatus()
    } catch (err) {
      setStatus({ status: 'error', progress: 0, message: err.message })
    }
  }

  const toggle = (name) => {
    setSelected(prev => ({ ...prev, [name]: !prev[name] }))
  }

  const selectAll = () => {
    const next = {}
    playlists.forEach(p => { next[p.name] = true })
    setSelected(next)
  }

  const selectNone = () => setSelected({})

  if (loading) return <div className="app"><p>Loading playlists...</p></div>
  if (error) return <div className="app"><p className="error">{error}</p></div>

  const selectedCount = Object.values(selected).filter(Boolean).length
  const isRunning = status.status === 'running'

  return (
    <div className="app">
      <h1>Engine OS → Rekordbox</h1>

      <div className="toolbar">
        <button onClick={selectAll} disabled={isRunning}>Select All</button>
        <button onClick={selectNone} disabled={isRunning}>Select None</button>
        <span className="count">{selectedCount} selected</span>
      </div>

      <ul className="playlist-list">
        {playlists.map(p => (
          <li key={p.name} className={selected[p.name] ? 'selected' : ''}>
            <label>
              <input
                type="checkbox"
                checked={!!selected[p.name]}
                onChange={() => toggle(p.name)}
                disabled={isRunning}
              />
              <span className="name">{p.name}</span>
              <span className="count">{p.track_count} tracks</span>
            </label>
          </li>
        ))}
      </ul>

      <button
        className="convert-btn"
        onClick={handleConvert}
        disabled={selectedCount === 0 || isRunning}
      >
        {isRunning ? 'Converting...' : 'Convert'}
      </button>

      {(status.status !== 'idle') && (
        <div className={`status ${status.status}`}>
          {status.status === 'running' && (
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${status.progress}%` }} />
            </div>
          )}
          <p>{status.message}</p>
          {status.status === 'done' && (
            <a href="/output/rekordbox.xml" download className="download-link">
              Download rekordbox.xml
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export default App
