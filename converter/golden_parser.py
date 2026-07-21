import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class PositionMark:
    name: str
    mark_type: int
    start: float
    num: int
    red: int
    green: int
    blue: int
    end: Optional[float] = None


@dataclass
class Tempo:
    inizio: float
    bpm: float
    metro: str
    battito: int


@dataclass
class Track:
    track_id: int
    name: str
    artist: Optional[str]
    album: Optional[str]
    genre: Optional[str]
    kind: str
    location: str
    size: int
    total_time: float
    track_number: Optional[int]
    year: Optional[int]
    average_bpm: float
    bit_rate: Optional[int]
    comments: Optional[str]
    tonality: Optional[str]
    label: Optional[str]
    sample_rate: int
    position_marks: List[PositionMark] = field(default_factory=list)
    tempo: Optional[Tempo] = None


@dataclass
class Playlist:
    name: str
    entries: int
    track_keys: List[int] = field(default_factory=list)


@dataclass
class GoldenModel:
    product_name: str
    product_version: str
    product_company: str
    collection_entries: int
    tracks: List[Track] = field(default_factory=list)
    playlists: List[Playlist] = field(default_factory=list)


def parse_position_mark(elem: ET.Element) -> PositionMark:
    end = None
    if "End" in elem.attrib:
        end = float(elem.attrib["End"])
    return PositionMark(
        name=elem.attrib["Name"],
        mark_type=int(elem.attrib["Type"]),
        start=float(elem.attrib["Start"]),
        num=int(elem.attrib["Num"]),
        red=int(elem.attrib["Red"]),
        green=int(elem.attrib["Green"]),
        blue=int(elem.attrib["Blue"]),
        end=end,
    )


def parse_tempo(elem: ET.Element) -> Tempo:
    return Tempo(
        inizio=float(elem.attrib["Inizio"]),
        bpm=float(elem.attrib["Bpm"]),
        metro=elem.attrib["Metro"],
        battito=int(elem.attrib["Battito"]),
    )


def parse_track(elem: ET.Element) -> Track:
    position_marks = []
    tempo = None
    for child in elem:
        if child.tag == "POSITION_MARK":
            position_marks.append(parse_position_mark(child))
        elif child.tag == "TEMPO":
            tempo = parse_tempo(child)

    def get_optional_int(name: str) -> Optional[int]:
        val = elem.attrib.get(name)
        return int(val) if val is not None else None

    return Track(
        track_id=int(elem.attrib["TrackID"]),
        name=elem.attrib["Name"],
        artist=elem.attrib.get("Artist"),
        album=elem.attrib.get("Album"),
        genre=elem.attrib.get("Genre"),
        kind=elem.attrib["Kind"],
        location=elem.attrib["Location"],
        size=int(elem.attrib["Size"]),
        total_time=float(elem.attrib["TotalTime"]),
        track_number=get_optional_int("TrackNumber"),
        year=get_optional_int("Year"),
        average_bpm=float(elem.attrib["AverageBpm"]),
        bit_rate=get_optional_int("BitRate"),
        comments=elem.attrib.get("Comments"),
        tonality=elem.attrib.get("Tonality"),
        label=elem.attrib.get("Label"),
        sample_rate=int(elem.attrib["SampleRate"]),
        position_marks=position_marks,
        tempo=tempo,
    )


def parse_playlist(elem: ET.Element) -> Playlist:
    track_keys = [
        int(child.attrib["Key"]) for child in elem if child.tag == "TRACK"
    ]
    return Playlist(
        name=elem.attrib["Name"],
        entries=int(elem.attrib["Entries"]),
        track_keys=track_keys,
    )


def parse_golden_xml(path: str) -> GoldenModel:
    tree = ET.parse(path)
    root = tree.getroot()

    product = root.find("PRODUCT")
    product_name = product.attrib["Name"]
    product_version = product.attrib["Version"]
    product_company = product.attrib["Company"]

    collection = root.find("COLLECTION")
    collection_entries = int(collection.attrib["Entries"])

    tracks = [parse_track(track_elem) for track_elem in collection.findall("TRACK")]

    playlists = []
    playlists_elem = root.find("PLAYLISTS")
    if playlists_elem is not None:
        root_node = playlists_elem.find("NODE")
        if root_node is not None:
            for node in root_node.findall("NODE"):
                if node.attrib.get("Type") == "1":
                    playlists.append(parse_playlist(node))

    return GoldenModel(
        product_name=product_name,
        product_version=product_version,
        product_company=product_company,
        collection_entries=collection_entries,
        tracks=tracks,
        playlists=playlists,
    )
