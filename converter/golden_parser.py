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


def parse_float(value: str) -> float:
    return float(value)


def parse_int(value: str) -> int:
    return int(value)


def parse_position_mark(elem: ET.Element) -> PositionMark:
    end = None
    if "End" in elem.attrib:
        end = parse_float(elem.attrib["End"])
    return PositionMark(
        name=elem.attrib["Name"],
        mark_type=parse_int(elem.attrib["Type"]),
        start=parse_float(elem.attrib["Start"]),
        num=parse_int(elem.attrib["Num"]),
        red=parse_int(elem.attrib["Red"]),
        green=parse_int(elem.attrib["Green"]),
        blue=parse_int(elem.attrib["Blue"]),
        end=end,
    )


def parse_tempo(elem: ET.Element) -> Tempo:
    return Tempo(
        inizio=parse_float(elem.attrib["Inizio"]),
        bpm=parse_float(elem.attrib["Bpm"]),
        metro=elem.attrib["Metro"],
        battito=parse_int(elem.attrib["Battito"]),
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
        return parse_int(val) if val is not None else None

    def get_optional_str(name: str) -> Optional[str]:
        return elem.attrib.get(name)

    return Track(
        track_id=parse_int(elem.attrib["TrackID"]),
        name=elem.attrib["Name"],
        artist=get_optional_str("Artist"),
        album=get_optional_str("Album"),
        genre=get_optional_str("Genre"),
        kind=elem.attrib["Kind"],
        location=elem.attrib["Location"],
        size=parse_int(elem.attrib["Size"]),
        total_time=parse_float(elem.attrib["TotalTime"]),
        track_number=get_optional_int("TrackNumber"),
        year=get_optional_int("Year"),
        average_bpm=parse_float(elem.attrib["AverageBpm"]),
        bit_rate=get_optional_int("BitRate"),
        comments=get_optional_str("Comments"),
        tonality=get_optional_str("Tonality"),
        label=get_optional_str("Label"),
        sample_rate=parse_int(elem.attrib["SampleRate"]),
        position_marks=position_marks,
        tempo=tempo,
    )


def parse_playlist(elem: ET.Element) -> Playlist:
    track_keys = []
    for child in elem:
        if child.tag == "TRACK":
            track_keys.append(parse_int(child.attrib["Key"]))
    return Playlist(
        name=elem.attrib["Name"],
        entries=parse_int(elem.attrib["Entries"]),
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
    collection_entries = parse_int(collection.attrib["Entries"])

    tracks = []
    for track_elem in collection.findall("TRACK"):
        tracks.append(parse_track(track_elem))

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
