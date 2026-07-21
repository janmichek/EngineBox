from typing import List, Sequence, Tuple

from converter.golden_parser import GoldenModel, Playlist, PositionMark, Tempo, Track


class ComparisonResult:
    def __init__(self):
        self.mismatches: List[str] = []

    def add(self, message: str):
        self.mismatches.append(message)

    @property
    def ok(self) -> bool:
        return len(self.mismatches) == 0

    def summary(self) -> str:
        if self.ok:
            return "Models are identical."
        lines = [f"Found {len(self.mismatches)} mismatch(es):"]
        for m in self.mismatches:
            lines.append(f"  - {m}")
        return "\n".join(lines)


# (attribute name, XML label, format values with repr)
FieldSpec = Sequence[Tuple[str, str, bool]]

POSITION_MARK_FIELDS: FieldSpec = [
    ("name", "Name", True),
    ("mark_type", "Type", False),
    ("start", "Start", False),
    ("num", "Num", False),
    ("red", "Red", False),
    ("green", "Green", False),
    ("blue", "Blue", False),
    ("end", "End", False),
]

TEMPO_FIELDS: FieldSpec = [
    ("inizio", "Inizio", False),
    ("bpm", "Bpm", False),
    ("metro", "Metro", True),
    ("battito", "Battito", False),
]

TRACK_FIELDS: FieldSpec = [
    ("track_id", "TrackID", False),
    ("name", "Name", True),
    ("artist", "Artist", True),
    ("album", "Album", True),
    ("genre", "Genre", True),
    ("kind", "Kind", True),
    ("location", "Location", True),
    ("size", "Size", False),
    ("total_time", "TotalTime", False),
    ("track_number", "TrackNumber", False),
    ("year", "Year", False),
    ("average_bpm", "AverageBpm", False),
    ("bit_rate", "BitRate", False),
    ("comments", "Comments", True),
    ("tonality", "Tonality", True),
    ("label", "Label", True),
    ("sample_rate", "SampleRate", False),
]

PLAYLIST_FIELDS: FieldSpec = [
    ("name", "Name", True),
    ("entries", "Entries", False),
]


def compare_fields(a, b, spec: FieldSpec, path: str, result: ComparisonResult):
    for attr, label, use_repr in spec:
        va, vb = getattr(a, attr), getattr(b, attr)
        if va != vb:
            if use_repr:
                result.add(f"{path}.{label}: {va!r} != {vb!r}")
            else:
                result.add(f"{path}.{label}: {va} != {vb}")


def compare_position_marks(
    marks_a: List[PositionMark],
    marks_b: List[PositionMark],
    path: str,
    result: ComparisonResult,
):
    if len(marks_a) != len(marks_b):
        result.add(f"{path}: position mark count {len(marks_a)} != {len(marks_b)}")
        return
    for i, (a, b) in enumerate(zip(marks_a, marks_b)):
        compare_fields(a, b, POSITION_MARK_FIELDS, f"{path}.POSITION_MARK[{i}]", result)


def compare_tempos(a: Tempo, b: Tempo, path: str, result: ComparisonResult):
    compare_fields(a, b, TEMPO_FIELDS, f"{path}.TEMPO", result)


def compare_tracks(a: Track, b: Track, index: int, result: ComparisonResult):
    path = f"COLLECTION.TRACK[{index}]"
    compare_fields(a, b, TRACK_FIELDS, path, result)
    compare_position_marks(a.position_marks, b.position_marks, path, result)
    if a.tempo is None and b.tempo is not None:
        result.add(f"{path}: missing TEMPO in A")
    elif a.tempo is not None and b.tempo is None:
        result.add(f"{path}: missing TEMPO in B")
    elif a.tempo is not None and b.tempo is not None:
        compare_tempos(a.tempo, b.tempo, path, result)


def compare_playlists(a: Playlist, b: Playlist, index: int, result: ComparisonResult):
    path = f"PLAYLISTS.NODE[{index}]"
    compare_fields(a, b, PLAYLIST_FIELDS, path, result)
    if a.track_keys != b.track_keys:
        result.add(
            f"{path}.TRACK keys: length {len(a.track_keys)} != {len(b.track_keys)} "
            f"or content differs"
        )


def compare_models(a: GoldenModel, b: GoldenModel) -> ComparisonResult:
    result = ComparisonResult()

    if a.product_name != b.product_name:
        result.add(f"PRODUCT.Name: {a.product_name!r} != {b.product_name!r}")
    if a.product_version != b.product_version:
        result.add(f"PRODUCT.Version: {a.product_version!r} != {b.product_version!r}")
    if a.product_company != b.product_company:
        result.add(f"PRODUCT.Company: {a.product_company!r} != {b.product_company!r}")
    if a.collection_entries != b.collection_entries:
        result.add(
            f"COLLECTION.Entries: {a.collection_entries} != {b.collection_entries}"
        )

    if len(a.tracks) != len(b.tracks):
        result.add(f"COLLECTION track count: {len(a.tracks)} != {len(b.tracks)}")
    else:
        for i, (ta, tb) in enumerate(zip(a.tracks, b.tracks)):
            compare_tracks(ta, tb, i, result)

    if len(a.playlists) != len(b.playlists):
        result.add(f"PLAYLIST count: {len(a.playlists)} != {len(b.playlists)}")
    else:
        for i, (pa, pb) in enumerate(zip(a.playlists, b.playlists)):
            compare_playlists(pa, pb, i, result)

    return result
