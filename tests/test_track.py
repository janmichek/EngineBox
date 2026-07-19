import unittest
import xml.etree.ElementTree as ET
from urllib.parse import unquote

from converter.golden_parser import parse_golden_xml
from converter.source_reader import ReadOnlyDatabase
from converter.track import (
    KEY_MAP,
    decode_beat_data,
    load_track,
    map_comment,
    map_key,
    map_location,
)


class TestTrackModel(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.golden = parse_golden_xml("databases/rekordbox.xml")
        cls.db = ReadOnlyDatabase("databases/m.db")
        cls.db.open()
        cls.db.validate()
        cls.golden_by_filename = {}
        for t in (
            ET.parse("databases/rekordbox.xml")
            .getroot()
            .find("COLLECTION")
            .findall("TRACK")
        ):
            loc = t.attrib["Location"]
            path = unquote(loc.replace("file://localhost/", ""))
            filename = path.split("/")[-1]
            cls.golden_by_filename[filename] = t.attrib

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_key_map_complete(self):
        self.assertEqual(len(KEY_MAP), 25)
        self.assertEqual(KEY_MAP[0], "1d")
        self.assertEqual(KEY_MAP[1], "1m")
        self.assertEqual(KEY_MAP[3], "2m")
        self.assertEqual(KEY_MAP[22], "12d")
        self.assertEqual(KEY_MAP[23], "12m")

    def test_map_location(self):
        result = map_location("../../MUSIS/FAVORIT/test.mp3")
        self.assertEqual(
            result, "file://localhost/Users/yeahboi/MUSIS/FAVORIT/test.mp3"
        )

    def test_map_location_url_encoding(self):
        result = map_location(
            "../../MUSIS/FAVORIT/wes mills - finish line (Original Mix).mp3"
        )
        self.assertIn("wes%20mills", result)
        self.assertTrue(result.startswith("file://localhost/"))

    def test_map_comment_none(self):
        self.assertIsNone(map_comment(None))

    def test_map_comment_passthrough(self):
        self.assertEqual(map_comment("Purchased at Beatport"), "Purchased at Beatport")

    def test_map_comment_newlines_stripped(self):
        result = map_comment("Line 1\nLine 2\r\nLine 3")
        self.assertEqual(result, "Line 1Line 2Line 3")

    def test_map_comment_truncation(self):
        long_comment = "A" * 300
        result = map_comment(long_comment)
        self.assertEqual(len(result), 247)

    def test_decode_beat_data(self):
        with ReadOnlyDatabase("databases/m.db") as db:
            row = db.query("SELECT beatData FROM PerformanceData WHERE trackId = 8490")
            result = decode_beat_data(row[0][0])
            self.assertAlmostEqual(result, 263.0, places=1)

    def test_load_track_basic(self):
        data = load_track(self.db, 8490)
        self.assertEqual(data["title"], "Buggin (Original Mix)")
        self.assertEqual(data["artist"], "Gemi")
        self.assertEqual(data["fileType"], "mp3")
        self.assertEqual(data["fileBytes"], 10841320)

    def test_all_scalar_attributes_match_golden(self):
        mismatches = []
        kviff_ids = [
            r[0]
            for r in self.db.query(
                "SELECT trackId FROM PlaylistEntity WHERE listId = 708"
            )
        ]
        dnb_ids = [
            r[0]
            for r in self.db.query(
                "SELECT trackId FROM PlaylistEntity WHERE listId = 11"
            )
        ]
        all_ids = list(dict.fromkeys(kviff_ids + dnb_ids))

        known_artist_exceptions = {12952, 15741, 22447}

        for tid in all_ids:
            data = load_track(self.db, tid)
            filename = data["filename"]
            if filename not in self.golden_by_filename:
                mismatches.append(f"Track {tid}: filename {filename} not in golden")
                continue
            golden = self.golden_by_filename[filename]

            if data["title"] != golden.get("Name"):
                mismatches.append(
                    f"Track {tid}: Name {data['title']!r} != {golden.get('Name')!r}"
                )
            if (
                data["artist"] != golden.get("Artist")
                and tid not in known_artist_exceptions
            ):
                mismatches.append(
                    f"Track {tid}: Artist {data['artist']!r} != {golden.get('Artist')!r}"
                )
            if data["album"] != golden.get("Album"):
                mismatches.append(
                    f"Track {tid}: Album {data['album']!r} != {golden.get('Album')!r}"
                )
            if data["genre"] != golden.get("Genre"):
                mismatches.append(
                    f"Track {tid}: Genre {data['genre']!r} != {golden.get('Genre')!r}"
                )
            if data["fileType"] != golden.get("Kind"):
                mismatches.append(
                    f"Track {tid}: Kind {data['fileType']!r} != {golden.get('Kind')!r}"
                )
            if data["fileBytes"] != int(golden.get("Size", 0)):
                mismatches.append(
                    f"Track {tid}: Size {data['fileBytes']} != {golden.get('Size')}"
                )
            if data["year"] is not None and str(data["year"]) != golden.get("Year", ""):
                mismatches.append(
                    f"Track {tid}: Year {data['year']} != {golden.get('Year')}"
                )
            if data["bpmAnalyzed"] is not None:
                golden_bpm = golden.get("AverageBpm", "")
                if golden_bpm:
                    self.assertAlmostEqual(
                        data["bpmAnalyzed"], float(golden_bpm), places=2
                    )
            if data["bitrate"] is not None and golden.get("BitRate"):
                self.assertEqual(data["bitrate"], int(golden["BitRate"]))

        self.assertEqual(len(mismatches), 0, "\n".join(mismatches[:20]))

    def test_location_matches_golden_all_tracks(self):
        mismatches = []
        kviff_ids = [
            r[0]
            for r in self.db.query(
                "SELECT trackId FROM PlaylistEntity WHERE listId = 708"
            )
        ]
        dnb_ids = [
            r[0]
            for r in self.db.query(
                "SELECT trackId FROM PlaylistEntity WHERE listId = 11"
            )
        ]
        all_ids = list(dict.fromkeys(kviff_ids + dnb_ids))

        for tid in all_ids:
            data = load_track(self.db, tid)
            filename = data["filename"]
            if filename not in self.golden_by_filename:
                continue
            golden = self.golden_by_filename[filename]
            computed_loc = map_location(data["path"])
            golden_loc = golden["Location"]
            if computed_loc != golden_loc:
                mismatches.append(
                    f"Track {tid}: computed={computed_loc[:60]}, golden={golden_loc[:60]}"
                )

        self.assertEqual(len(mismatches), 0, "\n".join(mismatches[:10]))

    def test_key_mapping_all_tracks(self):
        mismatches = []
        kviff_ids = [
            r[0]
            for r in self.db.query(
                "SELECT trackId FROM PlaylistEntity WHERE listId = 708"
            )
        ]
        dnb_ids = [
            r[0]
            for r in self.db.query(
                "SELECT trackId FROM PlaylistEntity WHERE listId = 11"
            )
        ]
        all_ids = list(dict.fromkeys(kviff_ids + dnb_ids))

        for tid in all_ids:
            data = load_track(self.db, tid)
            computed_key = map_key(data["key"])
            filename = data["filename"]
            if filename not in self.golden_by_filename:
                continue
            golden = self.golden_by_filename[filename]
            golden_tonality = golden.get("Tonality")
            if computed_key != golden_tonality:
                mismatches.append(
                    f"Track {tid}: key={data['key']}, computed={computed_key!r}, golden={golden_tonality!r}"
                )

        self.assertEqual(len(mismatches), 0, "\n".join(mismatches[:10]))
