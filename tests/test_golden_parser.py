import unittest
from converter.golden_parser import parse_golden_xml


class TestGoldenParser(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model = parse_golden_xml("databases/rekordbox.xml")

    def test_product_info(self):
        self.assertEqual(self.model.product_name, "MIXO")
        self.assertEqual(self.model.product_version, "0.0.1")
        self.assertEqual(self.model.product_company, "MIXO")

    def test_collection_entries(self):
        self.assertEqual(self.model.collection_entries, 293)

    def test_track_count(self):
        self.assertEqual(len(self.model.tracks), 293)

    def test_first_track(self):
        track = self.model.tracks[0]
        self.assertEqual(track.track_id, 0)
        self.assertEqual(track.name, "Finish Line (Original Mix)")
        self.assertEqual(track.artist, "wes mills")
        self.assertEqual(track.album, "Finish Line")
        self.assertEqual(track.genre, "House")
        self.assertEqual(track.kind, "mp3")
        self.assertIn("wes%20mills", track.location)
        self.assertEqual(track.size, 7389357)
        self.assertAlmostEqual(track.total_time, 141.176, places=3)
        self.assertEqual(track.track_number, 1)
        self.assertEqual(track.year, 2023)
        self.assertAlmostEqual(track.average_bpm, 136.000, places=3)
        self.assertEqual(track.bit_rate, 320)
        self.assertEqual(track.tonality, "5d")
        self.assertEqual(track.label, "bitbird")
        self.assertEqual(track.sample_rate, 44100)

    def test_first_track_position_marks(self):
        track = self.model.tracks[0]
        self.assertEqual(len(track.position_marks), 4)
        mark0 = track.position_marks[0]
        self.assertEqual(mark0.name, "Cue 1")
        self.assertEqual(mark0.mark_type, 0)
        self.assertAlmostEqual(mark0.start, 0.042, places=3)
        self.assertEqual(mark0.num, 0)
        self.assertEqual(mark0.red, 244)
        self.assertEqual(mark0.green, 211)
        self.assertEqual(mark0.blue, 56)
        self.assertIsNone(mark0.end)

    def test_first_track_tempo(self):
        track = self.model.tracks[0]
        self.assertIsNotNone(track.tempo)
        self.assertAlmostEqual(track.tempo.inizio, 0.037, places=3)
        self.assertAlmostEqual(track.tempo.bpm, 136.00, places=2)
        self.assertEqual(track.tempo.metro, "4/4")
        self.assertEqual(track.tempo.battito, 1)

    def test_track_with_loop(self):
        track_with_loop = None
        for track in self.model.tracks:
            for mark in track.position_marks:
                if mark.mark_type == 4:
                    track_with_loop = track
                    break
        self.assertIsNotNone(track_with_loop)
        loop_mark = None
        for mark in track_with_loop.position_marks:
            if mark.mark_type == 4:
                loop_mark = mark
                break
        self.assertEqual(loop_mark.name, "Loop 1")
        self.assertIsNotNone(loop_mark.end)

    def test_playlist_count(self):
        self.assertEqual(len(self.model.playlists), 2)

    def test_playlist_names(self):
        names = [p.name for p in self.model.playlists]
        self.assertEqual(names, ["KVIFF 2026", "DŇB"])

    def test_playlist_entries(self):
        kviff = self.model.playlists[0]
        self.assertEqual(kviff.entries, 178)
        self.assertEqual(len(kviff.track_keys), 178)

        dnb = self.model.playlists[1]
        self.assertEqual(dnb.entries, 115)
        self.assertEqual(len(dnb.track_keys), 115)

    def test_total_position_marks(self):
        total_marks = sum(len(t.position_marks) for t in self.model.tracks)
        self.assertEqual(total_marks, 1060)

    def test_all_tracks_have_tempo(self):
        for track in self.model.tracks:
            self.assertIsNotNone(track.tempo, f"Track {track.track_id} missing tempo")

    def test_all_tracks_have_location(self):
        for track in self.model.tracks:
            self.assertTrue(track.location.startswith("file://localhost/"))
