import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import './App.css'

const DEFAULT_DB = '/Users/yeahboi/Music/Engine Library/Database2/m.db'

function selectionKey(playlists, selected) {
  return playlists
    .filter(p => selected[p.id])
    .map(p => p.id)
    .sort((a, b) => a - b)
    .join(',')
}

function App() {
  const [dbPath, setDbPath] = useState(DEFAULT_DB)
  const [dbInput, setDbInput] = useState(DEFAULT_DB)
  const [playlists, setPlaylists] = useState([])
  const [selected, setSelected] = useState({})
  const [status, setStatus] = useState({ status: 'idle', progress: 0, message: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [convertedSelection, setConvertedSelection] = useState(null)

  const pendingConvertedKey = useRef(null)

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
          setConvertedSelection(null)
          setStatus({ status: 'idle', progress: 0, message: '' })
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
    loadPlaylists(DEFAULT_DB)
  }, [loadPlaylists])

  const pollStatus = useCallback(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(data => {
        setStatus(data)
        if (data.status === 'running') {
          setTimeout(pollStatus, 500)
        } else if (data.status === 'done') {
          setConvertedSelection(pendingConvertedKey.current)
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

    pendingConvertedKey.current = selectionKey(playlists, selected)
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

  const toggleAll = () => {
    if (allSelected) {
      setSelected({})
    } else {
      const next = {}
      playlists.forEach(p => { next[p.id] = true })
      setSelected(next)
    }
  }

  const selectedCount = Object.values(selected).filter(Boolean).length
  const allSelected = playlists.length > 0 && selectedCount === playlists.length
  const someSelected = selectedCount > 0 && !allSelected
  const isRunning = status.status === 'running'
  const currentSelection = useMemo(
    () => selectionKey(playlists, selected),
    [playlists, selected],
  )
  const showDownload =
    status.status === 'done' &&
    convertedSelection !== null &&
    convertedSelection === currentSelection &&
    currentSelection !== ''

  const selectAllRef = useRef(null)
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected
    }
  }, [someSelected, selectedCount])

  return (
    <div className="app">
      <header>
        <hgroup>
          <h1>📦 EngineBox</h1>
          <p>Engine OS to Rekordbox playlist converter</p>
        </hgroup>
        <form onSubmit={handleDbSubmit}>
          <label>
            Library path
            <input
              type="text"
              value={dbInput}
              onChange={e => setDbInput(e.target.value)}
              disabled={isRunning}
              placeholder="/Users/you/Music/Engine Library/Database2/m.db"
            />
          </label>
          <button type="submit" disabled={isRunning || !dbInput.trim()}>Load</button>
        </form>
      </header>

      <main>
        {!loading && !error && (
          <label className="select-all">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              disabled={isRunning || playlists.length === 0}
              aria-label="Select all playlists"
            />
            <span>{selectedCount} of {playlists.length} selected</span>
          </label>
        )}

        {loading && <p aria-busy="true">Loading playlists...</p>}
        {error && <p role="alert">{error}</p>}

        {!loading && !error && (
          <ul role="listbox" aria-label="Playlists">
            {playlists.map(p => (
              <li key={p.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={!!selected[p.id]}
                    onChange={() => toggle(p.id)}
                    disabled={isRunning}
                  />
                  <span>{p.name}</span>
                  <small>{p.track_count} tracks</small>
                </label>
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer>
        {isRunning ? (
          <div className="footer-action">
            <button disabled>Converting...</button>
            <progress value={status.progress} max={100} />
          </div>
        ) : showDownload ? (
          <div className="footer-action">
            <a href="/output/rekordbox.xml" download role="button" className="download">
              Download rekordbox.xml
            </a>
            <p className="footer-info">{status.message}</p>
          </div>
        ) : (
          <div className="footer-action">
            <button
              onClick={handleConvert}
              disabled={selectedCount === 0}
            >
              Convert
            </button>
            {status.status === 'error' && (
              <p className="footer-error" role="alert">{status.message}</p>
            )}
          </div>
        )}
      </footer>
    </div>
  )
}

export default App
