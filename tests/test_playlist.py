import unittest
from converter.source_reader import ReadOnlyDatabase
from converter.playlist import find_playlist_by_name, list_playlists, load_playlists


class TestPlaylist(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = ReadOnlyDatabase("databases/m.db")
        cls.db.open()
        cls.db.validate()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_find_kviff_2026(self):
        playlist = find_playlist_by_name(self.db, "KVIFF 2026")
        self.assertEqual(playlist.name, "KVIFF 2026")
        self.assertEqual(playlist.playlist_id, 708)
        self.assertEqual(len(playlist.track_ids), 178)

    def test_find_dnb(self):
        playlist = find_playlist_by_name(self.db, "DŇB")
        self.assertEqual(playlist.name, "DŇB")
        self.assertEqual(playlist.playlist_id, 11)
        self.assertEqual(len(playlist.track_ids), 115)

    def test_missing_playlist_raises_error(self):
        with self.assertRaises(ValueError):
            find_playlist_by_name(self.db, "NONEXISTENT PLAYLIST")

    def test_load_playlists(self):
        playlists = load_playlists(self.db, ["KVIFF 2026", "DŇB"])
        self.assertEqual(len(playlists), 2)
        self.assertEqual(playlists[0].name, "KVIFF 2026")
        self.assertEqual(playlists[1].name, "DŇB")
        self.assertEqual(len(playlists[0].track_ids), 178)
        self.assertEqual(len(playlists[1].track_ids), 115)

    def test_track_ids_are_unique_within_playlist(self):
        playlist = find_playlist_by_name(self.db, "KVIFF 2026")
        self.assertEqual(len(playlist.track_ids), len(set(playlist.track_ids)))

    def test_track_ids_are_valid(self):
        playlist = find_playlist_by_name(self.db, "KVIFF 2026")
        for tid in playlist.track_ids:
            rows = self.db.query("SELECT id FROM Track WHERE id = ?", (tid,))
            self.assertEqual(len(rows), 1, f"Track {tid} not found")

    def test_first_track_name_matches_golden(self):
        playlist = find_playlist_by_name(self.db, "KVIFF 2026")
        rows = self.db.query(
            "SELECT title FROM Track WHERE id = ?", (playlist.track_ids[0],)
        )
        self.assertEqual(rows[0][0], "Finish Line (Original Mix)")

    def test_list_playlists_skips_empty_duplicates(self):
        playlists = list_playlists(self.db)
        names = [p["name"] for p in playlists]
        self.assertEqual(len(names), len(set(names)))
        self.assertTrue(all(p["track_count"] > 0 for p in playlists))
        self.assertNotIn(0, [p["track_count"] for p in playlists])

        solid = [p for p in playlists if p["name"] == "SOLID"]
        self.assertEqual(len(solid), 1)
        self.assertEqual(solid[0]["track_count"], 1077)

        river = [p for p in playlists if p["name"] == "RIVER"]
        self.assertEqual(len(river), 1)
        self.assertEqual(river[0]["track_count"], 451)

    def test_find_playlist_prefers_populated_duplicate(self):
        playlist = find_playlist_by_name(self.db, "SOLID")
        self.assertEqual(playlist.playlist_id, 13)
        self.assertEqual(len(playlist.track_ids), 1077)
