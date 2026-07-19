import io
import unittest
import xml.etree.ElementTree as ET

from converter.comparator import compare_models
from converter.golden_parser import parse_golden_xml
from converter.xml_generator import generate_xml


class TestXmlGenerator(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.golden = parse_golden_xml("databases/rekordbox.xml")

    def test_generate_xml_structure(self):
        tree = generate_xml(self.golden)
        root = tree.getroot()
        self.assertEqual(root.tag, "DJ_PLAYLISTS")
        self.assertEqual(root.attrib["Version"], "1.0.0")

    def test_product_element(self):
        tree = generate_xml(self.golden)
        product = tree.getroot().find("PRODUCT")
        self.assertIsNotNone(product)
        self.assertEqual(product.attrib["Name"], "MIXO")
        self.assertEqual(product.attrib["Version"], "0.0.1")
        self.assertEqual(product.attrib["Company"], "MIXO")

    def test_collection_entries(self):
        tree = generate_xml(self.golden)
        collection = tree.getroot().find("COLLECTION")
        self.assertIsNotNone(collection)
        self.assertEqual(collection.attrib["Entries"], "293")
        tracks = collection.findall("TRACK")
        self.assertEqual(len(tracks), 293)

    def test_first_track_attributes(self):
        tree = generate_xml(self.golden)
        track = tree.getroot().find("COLLECTION").findall("TRACK")[0]
        self.assertEqual(track.attrib["TrackID"], "0")
        self.assertEqual(track.attrib["Name"], "Finish Line (Original Mix)")
        self.assertEqual(track.attrib["Artist"], "wes mills")
        self.assertEqual(track.attrib["Kind"], "mp3")
        self.assertIn("wes%20mills", track.attrib["Location"])
        self.assertEqual(track.attrib["Size"], "7389357")
        self.assertEqual(track.attrib["TotalTime"], "141.176")

    def test_position_marks_generated(self):
        tree = generate_xml(self.golden)
        track = tree.getroot().find("COLLECTION").findall("TRACK")[0]
        marks = track.findall("POSITION_MARK")
        self.assertEqual(len(marks), 4)
        self.assertEqual(marks[0].attrib["Name"], "Cue 1")
        self.assertEqual(marks[0].attrib["Type"], "0")
        self.assertEqual(marks[0].attrib["Start"], "0.042")

    def test_tempo_generated(self):
        tree = generate_xml(self.golden)
        track = tree.getroot().find("COLLECTION").findall("TRACK")[0]
        tempos = track.findall("TEMPO")
        self.assertEqual(len(tempos), 1)
        self.assertEqual(tempos[0].attrib["Bpm"], "136.0")

    def test_playlists_generated(self):
        tree = generate_xml(self.golden)
        playlists = tree.getroot().find("PLAYLISTS")
        self.assertIsNotNone(playlists)
        root_node = playlists.find("NODE")
        self.assertIsNotNone(root_node)
        self.assertEqual(root_node.attrib["Name"], "ROOT")
        self.assertEqual(root_node.attrib["Count"], "2")
        sub_nodes = root_node.findall("NODE")
        self.assertEqual(len(sub_nodes), 2)
        self.assertEqual(sub_nodes[0].attrib["Name"], "KVIFF 2026")
        self.assertEqual(sub_nodes[0].attrib["Entries"], "178")
        self.assertEqual(sub_nodes[1].attrib["Name"], "DŇB")
        self.assertEqual(sub_nodes[1].attrib["Entries"], "115")

    def test_playlist_track_refs(self):
        tree = generate_xml(self.golden)
        root_node = tree.getroot().find("PLAYLISTS").find("NODE")
        kviff = root_node.findall("NODE")[0]
        tracks = kviff.findall("TRACK")
        self.assertEqual(len(tracks), 178)
        self.assertEqual(tracks[0].attrib["Key"], "0")

    def test_roundtrip_semantic_match(self):
        result = compare_models(self.golden, self.golden)
        self.assertTrue(result.ok)

    def test_serialized_xml_roundtrip(self):
        tree = generate_xml(self.golden)
        buf = io.StringIO()
        tree.write(buf, encoding="unicode", xml_declaration=False)
        xml_str = buf.getvalue()

        root = ET.fromstring(xml_str)
        self.assertEqual(root.tag, "DJ_PLAYLISTS")
        collection = root.find("COLLECTION")
        self.assertEqual(collection.attrib["Entries"], "293")
        self.assertEqual(len(collection.findall("TRACK")), 293)
