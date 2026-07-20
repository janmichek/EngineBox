import { useState, useEffect, useCallback } from 'react'
import './App.css'

const DEFAULT_DB = '/Users/yeahboi/Music/Engine Library/Database2/m.db'

function App() {
  const [dbPath, setDbPath] = useState(DEFAULT_DB)
  const [dbInput, setDbInput] = useState(DEFAULT_DB)
  const [playlists, setPlaylists] = useState([])
  const [selected, setSelected] = useState({})
  const [status, setStatus] = useState({ status: 'idle', progress: 0, message: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadPlaylists = useCallback((path) => {
    setLoading(true)
    setError(null)
    fetch(`/api/playlists?db=${encodeURIComponent(path)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
          setPlaylists([])
        } else {
          setPlaylists(data.playlists || [])
          setSelected({})
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load playlists. Is the server running?')
        setPlaylists([])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    loadPlaylists(dbPath)
  }, [loadPlaylists])

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

  const handleDbSubmit = (e) => {
    e.preventDefault()
    const trimmed = dbInput.trim()
    if (trimmed && trimmed !== dbPath) {
      setDbPath(trimmed)
      loadPlaylists(trimmed)
    }
  }

  const handleConvert = async () => {
    const names = playlists
      .filter(p => selected[p.id])
      .map(p => p.name)
    if (names.length === 0) return

    setStatus({ status: 'running', progress: 0, message: 'Starting...' })

    try {
      await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlists: names, db: dbPath }),
      })
      pollStatus()
    } catch (err) {
      setStatus({ status: 'error', progress: 0, message: err.message })
    }
  }

  const toggle = (id) => {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const selectAll = () => {
    const next = {}
    playlists.forEach(p => { next[p.id] = true })
    setSelected(next)
  }

  const selectNone = () => setSelected({})

  const selectedCount = Object.values(selected).filter(Boolean).length
  const isRunning = status.status === 'running'

  return (
    <main>
      <hgroup>
        <h1>Engine OS → Rekordbox</h1>
      </hgroup>

      <form onSubmit={handleDbSubmit}>
        <label htmlFor="db-path">Database path</label>
        <div className="db-input-row">
          <input
            id="db-path"
            type="text"
            value={dbInput}
            onChange={e => setDbInput(e.target.value)}
            disabled={isRunning}
            placeholder="/path/to/Engine Library/Database2/m.db"
          />
          <button type="submit" disabled={isRunning || !dbInput.trim()}>Load</button>
        </div>
      </form>

      {loading && <p className="loading">Loading playlists...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <>
          <nav className="toolbar">
            <button onClick={selectAll} disabled={isRunning}>Select All</button>
            <button onClick={selectNone} disabled={isRunning}>Select None</button>
            <span className="count">{selectedCount} of {playlists.length} selected</span>
          </nav>

          <ul className="playlist-list" role="listbox" aria-label="Playlists">
            {playlists.map(p => (
              <li key={p.id} className={selected[p.id] ? 'selected' : ''}>
                <label>
                  <input
                    type="checkbox"
                    checked={!!selected[p.id]}
                    onChange={() => toggle(p.id)}
                    disabled={isRunning}
                  />
                  <span className="name">{p.name}</span>
                  <small className="count">{p.track_count} tracks</small>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}

      <button
        className="convert-btn"
        onClick={handleConvert}
        disabled={selectedCount === 0 || isRunning}
      >
        {isRunning ? 'Converting...' : 'Convert'}
      </button>

      {status.status !== 'idle' && (
        <article className={`status ${status.status}`}>
          {status.status === 'running' && (
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${status.progress}%` }} />
            </div>
          )}
          <p>{status.message}</p>
          {status.status === 'done' && (
            <a href="/output/rekordbox.xml" download className="download-link" role="button">
              Download rekordbox.xml
            </a>
          )}
        </article>
      )}
    </main>
  )
}

export default App
