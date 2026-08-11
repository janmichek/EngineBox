import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url'
import { SqlJsDatabase } from '../converter/sqljs_database.js'
import { listPlaylists } from '../converter/playlist.js'
import { convertWithDb } from '../converter/convert_core.js'

let sqlPromise

async function getSql() {
  if (!sqlPromise) {
    // Load CJS build via Vite prebundle (see optimizeDeps.include).
    // Namespace import avoids "no export named default" in native ESM.
    const mod = await import('sql.js/dist/sql-wasm-browser.js')
    const initSqlJs = typeof mod === 'function' ? mod : (mod.default ?? mod)
    sqlPromise = initSqlJs({ locateFile: () => wasmUrl })
  }
  return sqlPromise
}

export async function openLibraryFromFile(file) {
  const SQL = await getSql()
  const db = new SqlJsDatabase(SQL, new Uint8Array(await file.arrayBuffer()))
  db.openSync()
  return db
}

export function listLibraryPlaylists(db) {
  return listPlaylists(db)
}

export function convertLibrary(db, playlistNames) {
  return convertWithDb(db, playlistNames, {})
}

export function downloadXml(xml, filename = 'rekordbox.xml') {
  const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
