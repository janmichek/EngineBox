export function findPlaylistByName(db, name) {
  const rows = db.query('SELECT id, title FROM Playlist WHERE title = ?', [name]);
  if (!rows.length) throw new Error(`Playlist not found: ${name}`);
  const playlistId = pickBestPlaylist(db, rows);
  return {
    name,
    playlist_id: playlistId,
    track_ids: traverseLinkedList(db, playlistId),
  };
}

function playlistTrackCount(db, playlistId) {
  const rows = db.query(
    'SELECT COUNT(*) as cnt FROM PlaylistEntity WHERE listId = ?',
    [playlistId]
  );
  return rows.length ? rows[0].cnt : 0;
}

function pickBestPlaylist(db, rows) {
  let bestId = rows[0].id;
  let bestCount = playlistTrackCount(db, bestId);
  for (let i = 1; i < rows.length; i++) {
    const count = playlistTrackCount(db, rows[i].id);
    if (count > bestCount || (count === bestCount && rows[i].id < bestId)) {
      bestId = rows[i].id;
      bestCount = count;
    }
  }
  return bestId;
}

function traverseLinkedList(db, listId) {
  const allRows = db.query(
    'SELECT id FROM PlaylistEntity WHERE listId = ?',
    [listId]
  );
  const allIds = new Set(allRows.map(r => r.id));
  if (!allIds.size) return [];

  const nextRows = db.query(
    'SELECT nextEntityId FROM PlaylistEntity WHERE listId = ? AND nextEntityId != 0',
    [listId]
  );
  const allNext = new Set(nextRows.map(r => r.nextEntityId));
  const unreferenced = [...allIds].filter(id => !allNext.has(id));
  if (unreferenced.length !== 1) {
    throw new Error(
      `Expected exactly one unreferenced entity for playlist ${listId}, found ${unreferenced.length}`
    );
  }

  const trackIds = [];
  let currentId = unreferenced[0];
  while (true) {
    const rows = db.query(
      'SELECT trackId, nextEntityId FROM PlaylistEntity WHERE id = ?',
      [currentId]
    );
    if (!rows.length) {
      throw new Error(`Entity ${currentId} not found in playlist ${listId}`);
    }
    const { trackId, nextEntityId } = rows[0];
    trackIds.push(trackId);
    if (nextEntityId === 0) break;
    currentId = nextEntityId;
  }
  return trackIds;
}

export function listPlaylists(db) {
  const rows = db.query(
    "SELECT id, title FROM Playlist WHERE title IS NOT NULL AND title != '' ORDER BY title"
  );
  const bestByName = {};
  for (const { id, title } of rows) {
    const trackCount = playlistTrackCount(db, id);
    if (trackCount === 0) continue;
    const existing = bestByName[title];
    if (
      !existing ||
      trackCount > existing.track_count ||
      (trackCount === existing.track_count && id < existing.id)
    ) {
      bestByName[title] = { id, name: title, track_count: trackCount };
    }
  }
  return Object.values(bestByName)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function loadPlaylists(db, names) {
  return names.map(name => findPlaylistByName(db, name));
}
