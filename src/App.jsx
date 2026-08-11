import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import './App.css'

const DEFAULT_DB = '/Users/yeahboi/Music/Engine Library/Database2/m.db'

const LIBRARY_HINTS = [
  ['Mac', '/Users/<username>/Music/Engine Library/Database2/m.db'],
  ['Win', 'C:\\Users\\<username>\\Music\\Engine Library\\Database2\\m.db'],
]

function selectionKey(playlists, selected) {
  return playlists
    .filter(p => selected[p.id])
    .map(p => p.id)
    .sort((a, b) => a - b)
    .join(',')
}

function selectedNames(playlists, selected) {
  return playlists.filter(p => selected[p.id]).map(p => p.name)
}

function App() {
  const [mode, setMode] = useState('detecting') // detecting | local | browser
  const [dbPath, setDbPath] = useState(DEFAULT_DB)
  const [dbInput, setDbInput] = useState(DEFAULT_DB)
  const [browserDb, setBrowserDb] = useState(null)
  const [libraryLoaded, setLibraryLoaded] = useState(false)
  const [playlists, setPlaylists] = useState([])
  const [selected, setSelected] = useState({})
  const [status, setStatus] = useState({ status: 'idle', progress: 0, message: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [xmlResult, setXmlResult] = useState(null)
  const [convertedSelection, setConvertedSelection] = useState(null)

  const pendingConvertedKey = useRef(null)
  const fileInputRef = useRef(null)
  const selectAllRef = useRef(null)

  const loadPlaylistsLocal = useCallback((path) => {
    setLoading(true)
    setError(null)
    fetch(`/api/playlists?db=${encodeURIComponent(path)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
          setPlaylists([])
          return
        }
        setPlaylists(data.playlists || [])
        setSelected({})
        setConvertedSelection(null)
        setXmlResult(null)
        setStatus({ status: 'idle', progress: 0, message: '' })
      })
      .catch(() => {
        setError('Failed to load playlists. Is the server running?')
        setPlaylists([])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/status')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(() => {
        if (cancelled) return
        setMode('local')
        loadPlaylistsLocal(DEFAULT_DB)
      })
      .catch(() => {
        if (cancelled) return
        setMode('browser')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [loadPlaylistsLocal])

  useEffect(() => () => browserDb?.close(), [browserDb])

  const pollStatus = useCallback(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(data => {
        setStatus(data)
        if (data.status === 'running') setTimeout(pollStatus, 500)
        else if (data.status === 'done') setConvertedSelection(pendingConvertedKey.current)
      })
      .catch(() => {})
  }, [])

  const handleDbSubmit = (e) => {
    e.preventDefault()
    const trimmed = dbInput.trim()
    if (trimmed && trimmed !== dbPath) {
      setDbPath(trimmed)
      loadPlaylistsLocal(trimmed)
    }
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError(null)
    setSelected({})
    setConvertedSelection(null)
    setXmlResult(null)
    setStatus({ status: 'idle', progress: 0, message: '' })

    try {
      browserDb?.close()
      const { openLibraryFromFile, listLibraryPlaylists } = await import('./browserConvert.js')
      const db = await openLibraryFromFile(file)
      setBrowserDb(db)
      setLibraryLoaded(true)
      setPlaylists(listLibraryPlaylists(db))
    } catch (err) {
      setBrowserDb(null)
      setLibraryLoaded(false)
      setPlaylists([])
      setError(err.message || 'Failed to open library file')
    } finally {
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleConvert = async () => {
    const names = selectedNames(playlists, selected)
    if (!names.length) return

    pendingConvertedKey.current = selectionKey(playlists, selected)
    setStatus({ status: 'running', progress: 10, message: 'Converting...' })

    if (mode === 'local') {
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
      return
    }

    if (!browserDb) return
    try {
      await new Promise(r => setTimeout(r, 30))
      const { convertLibrary } = await import('./browserConvert.js')
      const { xml, trackCount, playlistCount } = convertLibrary(browserDb, names)
      setXmlResult(xml)
      setConvertedSelection(pendingConvertedKey.current)
      setStatus({
        status: 'done',
        progress: 100,
        message: `Conversion complete! (${trackCount} tracks, ${playlistCount} playlists)`,
      })
    } catch (err) {
      setStatus({ status: 'error', progress: 0, message: err.message })
    }
  }

  const handleDownload = async () => {
    if (!xmlResult) return
    const { downloadXml } = await import('./browserConvert.js')
    downloadXml(xmlResult)
  }

  const toggle = (id) => setSelected(prev => ({ ...prev, [id]: !prev[id] }))

  const toggleAll = () => {
    if (allSelected) setSelected({})
    else setSelected(Object.fromEntries(playlists.map(p => [p.id, true])))
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

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected
  }, [someSelected])

  return (
    <div className="app">
      <header>
        <hgroup>
          <h1>
            <img src="/favicon.svg" alt="" className="app-icon" aria-hidden="true" />
            EngineBox
          </h1>
          <p>Engine OS to Rekordbox playlist converter</p>
        </hgroup>

        {mode === 'local' && (
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
        )}

        {mode === 'browser' && (
          <div className="library-picker">
            <input
              ref={fileInputRef}
              type="file"
              accept=".db,application/x-sqlite3,application/octet-stream"
              onChange={handleFileChange}
              disabled={isRunning}
              hidden
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isRunning}
            >
              Select your library
            </button>
            {!libraryLoaded && (
              <div className="file-hint">
                <ul className="file-hint-paths">
                  {LIBRARY_HINTS.map(([label, path]) => (
                    <li key={label}>
                      <span>{label}</span>
                      <code>{path}</code>
                    </li>
                  ))}
                </ul>
                <p className="file-hint-privacy">(your data is processed, not uploaded)</p>
              </div>
            )}
          </div>
        )}
      </header>

      <main>
        {mode === 'detecting' || loading ? (
          <p aria-busy="true">{mode === 'detecting' ? 'Starting...' : 'Loading playlists...'}</p>
        ) : error ? (
          <p role="alert">{error}</p>
        ) : (
          <>
            {playlists.length > 0 && (
              <label className={`select-all${selectedCount === 0 ? ' is-empty' : ''}`}>
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={isRunning}
                  aria-label="Select all playlists"
                />
                <span>{selectedCount} of {playlists.length} selected</span>
              </label>
            )}
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
          </>
        )}
      </main>

      <footer>
        <div className="footer-action">
          {isRunning ? (
            <>
              <button disabled>Converting...</button>
              <progress value={status.progress} max={100} />
            </>
          ) : showDownload ? (
            <>
              {mode === 'browser' ? (
                <button type="button" className="download" onClick={handleDownload}>
                  Download rekordbox.xml
                </button>
              ) : (
                <a href="/output/rekordbox.xml" download role="button" className="download">
                  Download rekordbox.xml
                </a>
              )}
              <p className="footer-info">{status.message}</p>
            </>
          ) : (
            <>
              <button onClick={handleConvert} disabled={selectedCount === 0 || mode === 'detecting'}>
                Convert
              </button>
              {status.status === 'error' && (
                <p className="footer-error" role="alert">{status.message}</p>
              )}
            </>
          )}
        </div>
      </footer>
    </div>
  )
}

export default App
