import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ReadOnlyDatabase } from '../converter/source_reader.js';
import { findPlaylistByName, listPlaylists, loadPlaylists } from '../converter/playlist.js';
import { FIXTURE_DB, FIXTURE_PLAYLISTS } from './fixtures.js';

describe('Playlist', () => {
  let db;

  beforeAll(() => {
    db = new ReadOnlyDatabase(FIXTURE_DB);
    db.openSync();
  });

  afterAll(() => {
    db.close();
  });

  it('find KVIFF 2026', () => {
    const playlist = findPlaylistByName(db, 'KVIFF 2026');
    expect(playlist.name).toBe('KVIFF 2026');
    expect(playlist.playlist_id).toBe(708);
    expect(playlist.track_ids.length).toBe(178);
  });

  it('find DŇB', () => {
    const playlist = findPlaylistByName(db, 'DŇB');
    expect(playlist.name).toBe('DŇB');
    expect(playlist.playlist_id).toBe(11);
    expect(playlist.track_ids.length).toBe(115);
  });

  it('missing playlist raises error', () => {
    expect(() => findPlaylistByName(db, 'NONEXISTENT PLAYLIST')).toThrow('Playlist not found');
  });

  it('load playlists', () => {
    const playlists = loadPlaylists(db, FIXTURE_PLAYLISTS);
    expect(playlists.length).toBe(2);
    expect(playlists[0].name).toBe(FIXTURE_PLAYLISTS[0]);
    expect(playlists[1].name).toBe(FIXTURE_PLAYLISTS[1]);
    expect(playlists[0].track_ids.length).toBe(178);
    expect(playlists[1].track_ids.length).toBe(115);
  });

  it('track ids are unique within playlist', () => {
    const playlist = findPlaylistByName(db, 'KVIFF 2026');
    expect(new Set(playlist.track_ids).size).toBe(playlist.track_ids.length);
  });

  it('track ids are valid', () => {
    const playlist = findPlaylistByName(db, 'KVIFF 2026');
    for (const tid of playlist.track_ids) {
      const rows = db.query('SELECT id FROM Track WHERE id = ?', [tid]);
      expect(rows.length).toBe(1);
    }
  });

  it('first track name matches golden', () => {
    const playlist = findPlaylistByName(db, 'KVIFF 2026');
    const rows = db.query('SELECT title FROM Track WHERE id = ?', [playlist.track_ids[0]]);
    expect(rows[0].title).toBe('Finish Line (Original Mix)');
  });

  it('list playlists skips empty duplicates', () => {
    const playlists = listPlaylists(db);
    const names = playlists.map(p => p.name);
    expect(new Set(names).size).toBe(names.length);
    expect(playlists.every(p => p.track_count > 0)).toBe(true);

    const solid = playlists.filter(p => p.name === 'SOLID');
    expect(solid.length).toBe(1);
    expect(solid[0].track_count).toBe(1077);

    const river = playlists.filter(p => p.name === 'RIVER');
    expect(river.length).toBe(1);
    expect(river[0].track_count).toBe(451);
  });

  it('find playlist prefers populated duplicate', () => {
    const playlist = findPlaylistByName(db, 'SOLID');
    expect(playlist.playlist_id).toBe(13);
    expect(playlist.track_ids.length).toBe(1077);
  });
});
