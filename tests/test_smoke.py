import sqlite3
import struct
import unittest
import urllib.parse
import xml.etree.ElementTree as ET
import zlib


class TestSmoke(unittest.TestCase):
    def test_standard_library_imports(self):
        self.assertIsNotNone(sqlite3)
        self.assertIsNotNone(struct)
        self.assertIsNotNone(urllib.parse)
        self.assertIsNotNone(ET)
        self.assertIsNotNone(zlib)

    def test_can_open_database_read_only(self):
        uri = "file:databases/m.db?mode=ro"
        conn = sqlite3.connect(uri, uri=True)
        try:
            cur = conn.execute("PRAGMA schema_version")
            version = cur.fetchone()[0]
            self.assertIsInstance(version, int)
            self.assertGreater(version, 0)
        finally:
            conn.close()

    def test_can_parse_golden_xml(self):
        tree = ET.parse("databases/rekordbox.xml")
        root = tree.getroot()
        self.assertEqual(root.tag, "DJ_PLAYLISTS")
