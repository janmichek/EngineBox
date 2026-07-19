import unittest
from converter.golden_parser import (
    GoldenModel,
    Playlist,
    PositionMark,
    Tempo,
    Track,
    parse_golden_xml,
)
from converter.comparator import compare_models


class TestComparator(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model = parse_golden_xml("databases/rekordbox.xml")

    def test_identical_models_pass(self):
        result = compare_models(self.model, self.model)
        self.assertTrue(result.ok)
        self.assertEqual(result.summary(), "Models are identical.")

    def test_different_track_name_detected(self):
        other = parse_golden_xml("databases/rekordbox.xml")
        other.tracks[0].name = "WRONG NAME"
        result = compare_models(self.model, other)
        self.assertFalse(result.ok)
        self.assertIn("Name", result.mismatches[0])

    def test_different_track_total_time_detected(self):
        other = parse_golden_xml("databases/rekordbox.xml")
        other.tracks[0].total_time = 999.999
        result = compare_models(self.model, other)
        self.assertFalse(result.ok)
        self.assertIn("TotalTime", result.mismatches[0])

    def test_different_tempo_detected(self):
        other = parse_golden_xml("databases/rekordbox.xml")
        other.tracks[0].tempo.bpm = 999.0
        result = compare_models(self.model, other)
        self.assertFalse(result.ok)
        self.assertIn("Bpm", result.mismatches[0])

    def test_different_cue_start_detected(self):
        other = parse_golden_xml("databases/rekordbox.xml")
        other.tracks[0].position_marks[0].start = 999.0
        result = compare_models(self.model, other)
        self.assertFalse(result.ok)
        self.assertIn("Start", result.mismatches[0])

    def test_different_cue_color_detected(self):
        other = parse_golden_xml("databases/rekordbox.xml")
        other.tracks[0].position_marks[0].red = 0
        result = compare_models(self.model, other)
        self.assertFalse(result.ok)
        self.assertIn("Red", result.mismatches[0])

    def test_different_collection_count_detected(self):
        other = parse_golden_xml("databases/rekordbox.xml")
        other.collection_entries = 999
        result = compare_models(self.model, other)
        self.assertFalse(result.ok)
        self.assertIn("Entries", result.mismatches[0])

    def test_different_playlist_name_detected(self):
        other = parse_golden_xml("databases/rekordbox.xml")
        other.playlists[0].name = "WRONG PLAYLIST"
        result = compare_models(self.model, other)
        self.assertFalse(result.ok)
        self.assertIn("Name", result.mismatches[0])

    def test_different_playlist_entries_detected(self):
        other = parse_golden_xml("databases/rekordbox.xml")
        other.playlists[0].entries = 999
        result = compare_models(self.model, other)
        self.assertFalse(result.ok)
        self.assertIn("Entries", result.mismatches[0])

    def test_missing_tempo_detected(self):
        other = parse_golden_xml("databases/rekordbox.xml")
        other.tracks[0].tempo = None
        result = compare_models(self.model, other)
        self.assertFalse(result.ok)
        self.assertIn("missing TEMPO", result.mismatches[0])

    def test_multiple_mismatches_detected(self):
        other = parse_golden_xml("databases/rekordbox.xml")
        other.tracks[0].name = "WRONG"
        other.tracks[0].total_time = 0.0
        other.tracks[0].tempo.bpm = 1.0
        result = compare_models(self.model, other)
        self.assertGreater(len(result.mismatches), 2)
