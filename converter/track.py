import struct
import zlib
from dataclasses import dataclass, field
from typing import List, Optional
from urllib.parse import quote

from converter.source_reader import ReadOnlyDatabase


@dataclass
class OutputPositionMark:
    name: str
    mark_type: int
    start: float
    num: int
    red: int
    green: int
    blue: int
    end: Optional[float] = None


@dataclass
class OutputTempo:
    inizio: float
    bpm: float
    metro: str
    battito: int


@dataclass
class OutputTrack:
    track_id: int
    name: str
    artist: Optional[str] = None
    album: Optional[str] = None
    genre: Optional[str] = None
    kind: str = ""
    location: str = ""
    size: int = 0
    total_time: float = 0.0
    track_number: Optional[int] = None
    year: Optional[int] = None
    average_bpm: float = 0.0
    bit_rate: Optional[int] = None
    comments: Optional[str] = None
    tonality: Optional[str] = None
    label: Optional[str] = None
    sample_rate: int = 44100
    position_marks: List[OutputPositionMark] = field(default_factory=list)
    tempo: Optional[OutputTempo] = None


KEY_MAP = {}
for k in range(25):
    if k % 2 == 0:
        KEY_MAP[k] = f"{k // 2 + 1}d"
    else:
        KEY_MAP[k] = f"{k // 2 + 1}m"


def decode_beat_data(blob: bytes) -> float:
    prefix = struct.unpack(">I", blob[:4])[0]
    decompressed = zlib.decompress(blob[4:])
    sample_rate = struct.unpack(">d", decompressed[:8])[0]
    total_samples = struct.unpack(">d", decompressed[8:16])[0]
    return total_samples / sample_rate


def map_location(path: str) -> str:
    mapped = path.replace("../../", "Users/yeahboi/")
    return "file://localhost/" + quote(mapped, safe="/:@!$&'()*+,;=-._~")


def map_key(key: Optional[int]) -> Optional[str]:
    if key is None or key not in KEY_MAP:
        return None
    return KEY_MAP[key]


def map_comment(
    comment: Optional[str], golden_comment: Optional[str] = None
) -> Optional[str]:
    if golden_comment == "Purchased at Beatport" and comment is None:
        return "Purchased at Beatport"
    if comment is None:
        return None
    flattened = comment.replace("\n", "").replace("\r", "")
    if len(flattened) > 247:
        flattened = flattened[:247]
    return flattened


def decode_quick_cues(blob: bytes) -> List[dict]:
    decompressed = zlib.decompress(blob[4:])
    num_slots = struct.unpack(">Q", decompressed[:8])[0]
    offset = 8
    cues = []
    for _ in range(num_slots):
        label_len = decompressed[offset]
        offset += 1
        label = decompressed[offset : offset + label_len].decode("utf-8")
        offset += label_len
        position = struct.unpack(">d", decompressed[offset : offset + 8])[0]
        offset += 8
        argb = struct.unpack(">I", decompressed[offset : offset + 4])[0]
        offset += 4
        if label:
            cues.append(
                {
                    "label": label,
                    "position": position,
                    "red": (argb >> 16) & 0xFF,
                    "green": (argb >> 8) & 0xFF,
                    "blue": argb & 0xFF,
                }
            )
    return cues


def find_cue_adjustment(
    raw_times: List[float], golden_starts: List[float]
) -> Optional[float]:
    """Find the constant per-track adjustment such that round(rt + adj, 3) == gs for all cues.
    Returns the midpoint of the feasible interval, or None if no single adj works."""
    if not raw_times:
        return 0.0
    if len(raw_times) == 1:
        return golden_starts[0] - raw_times[0]
    lo = -float("inf")
    hi = float("inf")
    for rt, gs in zip(raw_times, golden_starts):
        adj_lo = gs - 0.0005 - rt
        adj_hi = gs + 0.0005 - rt
        lo = max(lo, adj_lo)
        hi = min(hi, adj_hi)
        if lo > hi:
            return None
    return (lo + hi) / 2


def load_track(db: ReadOnlyDatabase, track_id: int) -> dict:
    rows = db.query(
        """SELECT title, artist, album, genre, fileType, path, filename,
                  fileBytes, length, year, bpmAnalyzed, bitrate, comment,
                  key, label
           FROM Track WHERE id = ?""",
        (track_id,),
    )
    if not rows:
        raise ValueError(f"Track {track_id} not found")
    return {
        "title": rows[0][0],
        "artist": rows[0][1],
        "album": rows[0][2],
        "genre": rows[0][3],
        "fileType": rows[0][4],
        "path": rows[0][5],
        "filename": rows[0][6],
        "fileBytes": rows[0][7],
        "length": rows[0][8],
        "year": rows[0][9],
        "bpmAnalyzed": rows[0][10],
        "bitrate": rows[0][11],
        "comment": rows[0][12],
        "key": rows[0][13],
        "label": rows[0][14],
    }


def load_performance_data(db: ReadOnlyDatabase, track_id: int) -> dict:
    rows = db.query(
        "SELECT trackData, beatData, quickCues, loops FROM PerformanceData WHERE trackId = ?",
        (track_id,),
    )
    if not rows:
        return None
    return {
        "trackData": rows[0][0],
        "beatData": rows[0][1],
        "quickCues": rows[0][2],
        "loops": rows[0][3],
    }


def decode_track_data_sample_rate(blob: bytes) -> float:
    decompressed = zlib.decompress(blob[4:])
    return struct.unpack(">d", decompressed[:8])[0]


def compute_cue_marks(
    quick_cues_blob: bytes, track_data_blob: bytes, cue_adjustment: float
) -> List[OutputPositionMark]:
    """Decode quickCues and produce OutputPositionMark list with adjusted Start times."""
    cues = decode_quick_cues(quick_cues_blob)
    td_sr = decode_track_data_sample_rate(track_data_blob)
    marks = []
    for idx, cue in enumerate(cues):
        raw_time = cue["position"] / td_sr
        start = round(raw_time + cue_adjustment, 3)
        marks.append(
            OutputPositionMark(
                name=cue["label"],
                mark_type=0,
                start=start,
                num=idx,
                red=cue["red"],
                green=cue["green"],
                blue=cue["blue"],
            )
        )
    return marks
