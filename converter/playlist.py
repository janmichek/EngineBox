from dataclasses import dataclass
from typing import List

from converter.source_reader import ReadOnlyDatabase


@dataclass
class PlaylistResult:
    name: str
    playlist_id: int
    track_ids: List[int]


def find_playlist_by_name(db: ReadOnlyDatabase, name: str) -> PlaylistResult:
    rows = db.query("SELECT id, title FROM Playlist WHERE title = ?", (name,))
    if not rows:
        raise ValueError(f"Playlist not found: {name}")
    playlist_id = rows[0][0]
    track_ids = _traverse_linked_list(db, playlist_id)
    return PlaylistResult(name=name, playlist_id=playlist_id, track_ids=track_ids)


def _traverse_linked_list(db: ReadOnlyDatabase, list_id: int) -> List[int]:
    all_ids = set(
        r[0]
        for r in db.query("SELECT id FROM PlaylistEntity WHERE listId = ?", (list_id,))
    )
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
