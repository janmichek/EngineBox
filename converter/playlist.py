from dataclasses import dataclass
from typing import List

from converter.source_reader import ReadOnlyDatabase


@dataclass
class PlaylistResult:
    name: str
    playlist_id: int
    track_ids: List[int]


def _playlist_track_count(db: ReadOnlyDatabase, playlist_id: int) -> int:
    rows = db.query(
        "SELECT COUNT(*) FROM PlaylistEntity WHERE listId = ?", (playlist_id,)
    )
    return rows[0][0] if rows else 0


def _pick_best_playlist(db: ReadOnlyDatabase, rows: List[tuple]) -> int:
    """When a title appears more than once, prefer the copy with the most tracks."""
    best_id = rows[0][0]
    best_count = _playlist_track_count(db, best_id)
    for playlist_id, _title in rows[1:]:
        count = _playlist_track_count(db, playlist_id)
        if count > best_count or (count == best_count and playlist_id < best_id):
            best_id = playlist_id
            best_count = count
    return best_id


def find_playlist_by_name(db: ReadOnlyDatabase, name: str) -> PlaylistResult:
    rows = db.query("SELECT id, title FROM Playlist WHERE title = ?", (name,))
    if not rows:
        raise ValueError(f"Playlist not found: {name}")
    playlist_id = _pick_best_playlist(db, rows)
    track_ids = _traverse_linked_list(db, playlist_id)
    return PlaylistResult(name=name, playlist_id=playlist_id, track_ids=track_ids)


def list_playlists(db: ReadOnlyDatabase) -> List[dict]:
    """Return one entry per playlist title, skipping empty duplicates."""
    rows = db.query(
        "SELECT id, title FROM Playlist WHERE title IS NOT NULL AND title != '' ORDER BY title"
    )
    best_by_name = {}
    for playlist_id, title in rows:
        track_count = _playlist_track_count(db, playlist_id)
        if track_count == 0:
            continue
        existing = best_by_name.get(title)
        if existing is None or track_count > existing["track_count"] or (
            track_count == existing["track_count"] and playlist_id < existing["id"]
        ):
            best_by_name[title] = {
                "id": playlist_id,
                "name": title,
                "track_count": track_count,
            }
    return sorted(best_by_name.values(), key=lambda p: p["name"].casefold())


def _traverse_linked_list(db: ReadOnlyDatabase, list_id: int) -> List[int]:
    all_ids = set(
        r[0]
        for r in db.query("SELECT id FROM PlaylistEntity WHERE listId = ?", (list_id,))
    )
    if not all_ids:
        return []
    all_next = set(
        r[0]
        for r in db.query(
            "SELECT nextEntityId FROM PlaylistEntity WHERE listId = ? AND nextEntityId != 0",
            (list_id,),
        )
    )
    unreferenced = all_ids - all_next
    if len(unreferenced) != 1:
        raise ValueError(
            f"Expected exactly one unreferenced entity for playlist {list_id}, found {len(unreferenced)}"
        )
    first_id = unreferenced.pop()
    track_ids = []
    current_id = first_id
    while True:
        rows = db.query(
            "SELECT trackId, nextEntityId FROM PlaylistEntity WHERE id = ?",
            (current_id,),
        )
        if not rows:
            raise ValueError(f"Entity {current_id} not found in playlist {list_id}")
        track_id, next_id = rows[0]
        track_ids.append(track_id)
        if next_id == 0:
            break
        current_id = next_id
    return track_ids


def load_playlists(db: ReadOnlyDatabase, names: List[str]) -> List[PlaylistResult]:
    results = []
    for name in names:
        results.append(find_playlist_by_name(db, name))
    return results
