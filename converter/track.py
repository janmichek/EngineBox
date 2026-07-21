import struct
import zlib
from typing import List, Optional
from urllib.parse import quote

from converter.golden_parser import PositionMark
from converter.source_reader import ReadOnlyDatabase

# Engine OS key ids 0..24 alternate major ("d") / minor ("m") per Camelot number.
KEY_MAP = {k: f"{k // 2 + 1}{'d' if k % 2 == 0 else 'm'}" for k in range(25)}

# Engine OS stores paths relative to the library folder; the golden reference
# was exported on this machine, so the prefix is fixed to match it exactly.
LIBRARY_PATH_PREFIX = "Users/yeahboi/"


def decode_beat_data(blob: bytes) -> float:
    decompressed = zlib.decompress(blob[4:])
    sample_rate = struct.unpack(">d", decompressed[:8])[0]
    total_samples = struct.unpack(">d", decompressed[8:16])[0]
    return total_samples / sample_rate


def map_location(path: str) -> str:
    mapped = path.replace("../../", LIBRARY_PATH_PREFIX)
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


_TRACK_COLUMNS = (
    "title", "artist", "album", "genre", "fileType", "path", "filename",
    "fileBytes", "length", "year", "bpmAnalyzed", "bitrate", "comment",
    "key", "label", "playOrder",
)


def load_track(db: ReadOnlyDatabase, track_id: int) -> dict:
    rows = db.query(
        f"SELECT {', '.join(_TRACK_COLUMNS)} FROM Track WHERE id = ?",
        (track_id,),
    )
    if not rows:
        raise ValueError(f"Track {track_id} not found")
    data = dict(zip(_TRACK_COLUMNS, rows[0]))
    data["title"] = data["title"] or data["filename"]
    return data


def load_performance_data(db: ReadOnlyDatabase, track_id: int) -> Optional[dict]:
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
) -> List[PositionMark]:
    """Decode quickCues and produce PositionMark list with adjusted Start times."""
    cues = decode_quick_cues(quick_cues_blob)
    td_sr = decode_track_data_sample_rate(track_data_blob)
    marks = []
    for idx, cue in enumerate(cues):
        raw_time = cue["position"] / td_sr
        start = round(raw_time + cue_adjustment, 3)
        marks.append(
            PositionMark(
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


def decode_loops(blob: bytes) -> List[dict]:
    """Decode the loops blob. Format: uint64 LE num_slots, then per slot:
    1-byte label_len, N-byte UTF-8 label, 8-byte LE float64 start (samples),
    8-byte LE float64 end (samples), 2-byte unknown, 4-byte BE ARGB color."""
    num_slots = struct.unpack("<Q", blob[:8])[0]
    offset = 8
    loops = []
    for _ in range(num_slots):
        label_len = blob[offset]
        offset += 1
        label = blob[offset : offset + label_len].decode("utf-8")
        offset += label_len
        start_samples = struct.unpack("<d", blob[offset : offset + 8])[0]
        offset += 8
        end_samples = struct.unpack("<d", blob[offset : offset + 8])[0]
        offset += 8
        _unknown = blob[offset : offset + 2]
        offset += 2
        argb = struct.unpack(">I", blob[offset : offset + 4])[0]
        offset += 4
        if label:
            loops.append(
                {
                    "label": label,
                    "start_samples": start_samples,
                    "end_samples": end_samples,
                    "red": (argb >> 16) & 0xFF,
                    "green": (argb >> 8) & 0xFF,
                    "blue": argb & 0xFF,
                }
            )
    return loops


def compute_loop_marks(
    loops_blob: bytes,
    track_data_blob: bytes,
    cue_adjustment: float,
    next_num: int,
) -> List[PositionMark]:
    """Decode loops and produce PositionMark list (Type 4) with adjusted times."""
    loops = decode_loops(loops_blob)
    td_sr = decode_track_data_sample_rate(track_data_blob)
    marks = []
    for idx, loop in enumerate(loops):
        start = round(loop["start_samples"] / td_sr + cue_adjustment, 3)
        end = round(loop["end_samples"] / td_sr + cue_adjustment, 3)
        marks.append(
            PositionMark(
                name=loop["label"],
                mark_type=4,
                start=start,
                num=next_num + idx,
                red=loop["red"],
                green=loop["green"],
                blue=loop["blue"],
                end=end,
            )
        )
    return marks
