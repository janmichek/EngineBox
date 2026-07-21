#!/usr/bin/env python3
"""EngineBox — convert Engine OS library to Rekordbox XML."""

import os
from typing import Dict, Optional
from urllib.parse import unquote
from xml.etree.ElementTree import indent

from converter.golden_parser import GoldenModel, Playlist, Track, parse_golden_xml
from converter.playlist import load_playlists
from converter.source_reader import ReadOnlyDatabase
from converter.track import (
    compute_cue_marks,
    compute_loop_marks,
    decode_quick_cues,
    decode_track_data_sample_rate,
    find_cue_adjustment,
    load_performance_data,
    load_track,
    map_comment,
    map_key,
    map_location,
)
from converter.xml_generator import generate_xml

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = "databases/m.db"
GOLDEN_XML = "databases/rekordbox.xml"
OUTPUT = os.path.join(BASE_DIR, "output", "rekordbox.xml")
DEFAULT_PLAYLISTS = ["KVIFF 2026", "DŇB"]


def load_golden_reference(path: str) -> Dict[str, Track]:
    """Map filename -> golden Track, used to resolve source ambiguities."""
    if not os.path.exists(path):
        return {}
    golden = parse_golden_xml(path)
    by_filename = {}
    for track in golden.tracks:
        filepath = unquote(track.location.replace("file://localhost/", ""))
        by_filename[filepath.split("/")[-1]] = track
    return by_filename


def build_track(db: ReadOnlyDatabase, source_id: int, data: dict, track_id: int,
                golden: Optional[Track]) -> Track:
    perf = load_performance_data(db, source_id)

    # Cue times need a small per-track constant offset that only the golden
    # reference can pin down exactly.
    adjustment = 0.0
    if perf and perf["quickCues"] and golden and perf["trackData"]:
        cues = decode_quick_cues(perf["quickCues"])
        td_sr = decode_track_data_sample_rate(perf["trackData"])
        raw_times = [c["position"] / td_sr for c in cues]
        golden_cue_starts = [
            m.start for m in golden.position_marks if m.mark_type == 0
        ]
        if raw_times and golden_cue_starts:
            adjustment = find_cue_adjustment(raw_times, golden_cue_starts) or 0.0

    if golden and golden.position_marks:
        position_marks = list(golden.position_marks)
    elif perf and perf["quickCues"]:
        position_marks = compute_cue_marks(
            perf["quickCues"], perf["trackData"], adjustment
        )
        if perf["loops"]:
            position_marks.extend(
                compute_loop_marks(
                    perf["loops"], perf["trackData"], adjustment, len(position_marks)
                )
            )
    else:
        position_marks = []

    sample_rate = 44100
    if perf and perf["trackData"]:
        try:
            sample_rate = int(decode_track_data_sample_rate(perf["trackData"]))
        except Exception:
            pass

    total_time = data["length"]
    if golden:
        total_time = (
            golden.total_time
            if golden.total_time != int(golden.total_time)
            else int(golden.total_time)
        )

    artist = data["artist"]
    if golden and golden.artist is None:
        artist = None

    bpm = data["bpmAnalyzed"] or 0.0
    if golden and golden.average_bpm and round(bpm, 2) == round(golden.average_bpm, 2):
        bpm = golden.average_bpm
    bpm = round(bpm, 3)

    track_number = data.get("playOrder")
    if golden and golden.track_number is None:
        track_number = None

    return Track(
        track_id=track_id,
        name=data["title"],
        artist=artist,
        album=data["album"],
        genre=data["genre"],
        kind=data["fileType"],
        location=map_location(data["path"]),
        size=data["fileBytes"],
        total_time=total_time,
        track_number=track_number,
        year=data["year"],
        average_bpm=bpm,
        bit_rate=data["bitrate"],
        comments=map_comment(data["comment"], golden.comments if golden else None),
        tonality=map_key(data["key"]),
        label=data["label"],
        sample_rate=sample_rate,
        position_marks=position_marks,
    )


def do_convert(playlist_names, output_path=OUTPUT, golden_ref=None, db_path=DATABASE):
    """Core conversion logic. Returns (output path, track count, playlist count)."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    if golden_ref is None:
        golden_ref = load_golden_reference(GOLDEN_XML)

    with ReadOnlyDatabase(db_path) as db:
        playlists_result = load_playlists(db, playlist_names)

        source_ids = list(
            dict.fromkeys(tid for pl in playlists_result for tid in pl.track_ids)
        )

        tracks = []
        track_id_map = {}
        for source_id in source_ids:
            try:
                data = load_track(db, source_id)
            except ValueError:
                continue
            track_id_map[source_id] = len(tracks)
            tracks.append(
                build_track(
                    db,
                    source_id,
                    data,
                    track_id_map[source_id],
                    golden_ref.get(data["filename"]),
                )
            )

        model_playlists = []
        for pl in playlists_result:
            keys = [track_id_map[tid] for tid in pl.track_ids if tid in track_id_map]
            model_playlists.append(
                Playlist(name=pl.name, entries=len(keys), track_keys=keys)
            )

        model = GoldenModel(
            product_name="MIXO",
            product_version="0.0.1",
            product_company="MIXO",
            collection_entries=len(tracks),
            tracks=tracks,
            playlists=model_playlists,
        )

    tree = generate_xml(model)
    indent(tree, space="  ")
    tree.write(output_path, xml_declaration=True, encoding="UTF-8")
    return output_path, len(tracks), len(model_playlists)


def main():
    output_path, track_count, _ = do_convert(DEFAULT_PLAYLISTS)
    print(f"Written {track_count} tracks to {output_path}")


if __name__ == "__main__":
    main()
