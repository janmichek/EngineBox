from dataclasses import fields
from typing import Any, List, Tuple

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
        p = f"{path}.POSITION_MARK[{i}]"
        if a.name != b.name:
            result.add(f"{p}.Name: {a.name!r} != {b.name!r}")
        if a.mark_type != b.mark_type:
            result.add(f"{p}.Type: {a.mark_type} != {b.mark_type}")
        if a.start != b.start:
            result.add(f"{p}.Start: {a.start} != {b.start}")
        if a.num != b.num:
            result.add(f"{p}.Num: {a.num} != {b.num}")
        if a.red != b.red:
            result.add(f"{p}.Red: {a.red} != {b.red}")
        if a.green != b.green:
            result.add(f"{p}.Green: {a.green} != {b.green}")
        if a.blue != b.blue:
            result.add(f"{p}.Blue: {a.blue} != {b.blue}")
        if a.end != b.end:
            result.add(f"{p}.End: {a.end} != {b.end}")


def compare_tempos(a: Tempo, b: Tempo, path: str, result: ComparisonResult):
    if a.inizio != b.inizio:
        result.add(f"{path}.TEMPO.Inizio: {a.inizio} != {b.inizio}")
    if a.bpm != b.bpm:
        result.add(f"{path}.TEMPO.Bpm: {a.bpm} != {b.bpm}")
    if a.metro != b.metro:
        result.add(f"{path}.TEMPO.Metro: {a.metro!r} != {b.metro!r}")
    if a.battito != b.battito:
        result.add(f"{path}.TEMPO.Battito: {a.battito} != {b.battito}")


def compare_tracks(a: Track, b: Track, index: int, result: ComparisonResult):
    path = f"COLLECTION.TRACK[{index}]"
    if a.track_id != b.track_id:
        result.add(f"{path}.TrackID: {a.track_id} != {b.track_id}")
    if a.name != b.name:
        result.add(f"{path}.Name: {a.name!r} != {b.name!r}")
    if a.artist != b.artist:
        result.add(f"{path}.Artist: {a.artist!r} != {b.artist!r}")
    if a.album != b.album:
        result.add(f"{path}.Album: {a.album!r} != {b.album!r}")
    if a.genre != b.genre:
        result.add(f"{path}.Genre: {a.genre!r} != {b.genre!r}")
    if a.kind != b.kind:
        result.add(f"{path}.Kind: {a.kind!r} != {b.kind!r}")
    if a.location != b.location:
        result.add(f"{path}.Location: {a.location!r} != {b.location!r}")
    if a.size != b.size:
        result.add(f"{path}.Size: {a.size} != {b.size}")
    if a.total_time != b.total_time:
        result.add(f"{path}.TotalTime: {a.total_time} != {b.total_time}")
    if a.track_number != b.track_number:
        result.add(f"{path}.TrackNumber: {a.track_number} != {b.track_number}")
    if a.year != b.year:
        result.add(f"{path}.Year: {a.year} != {b.year}")
    if a.average_bpm != b.average_bpm:
        result.add(f"{path}.AverageBpm: {a.average_bpm} != {b.average_bpm}")
    if a.bit_rate != b.bit_rate:
        result.add(f"{path}.BitRate: {a.bit_rate} != {b.bit_rate}")
    if a.comments != b.comments:
        result.add(f"{path}.Comments: {a.comments!r} != {b.comments!r}")
    if a.tonality != b.tonality:
        result.add(f"{path}.Tonality: {a.tonality!r} != {b.tonality!r}")
    if a.label != b.label:
        result.add(f"{path}.Label: {a.label!r} != {b.label!r}")
    if a.sample_rate != b.sample_rate:
        result.add(f"{path}.SampleRate: {a.sample_rate} != {b.sample_rate}")
    compare_position_marks(a.position_marks, b.position_marks, path, result)
    if a.tempo is None and b.tempo is not None:
        result.add(f"{path}: missing TEMPO in A")
    elif a.tempo is not None and b.tempo is None:
        result.add(f"{path}: missing TEMPO in B")
    elif a.tempo is not None and b.tempo is not None:
        compare_tempos(a.tempo, b.tempo, path, result)


def compare_playlists(a: Playlist, b: Playlist, index: int, result: ComparisonResult):
    path = f"PLAYLISTS.NODE[{index}]"
    if a.name != b.name:
        result.add(f"{path}.Name: {a.name!r} != {b.name!r}")
    if a.entries != b.entries:
        result.add(f"{path}.Entries: {a.entries} != {b.entries}")
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
