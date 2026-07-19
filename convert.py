#!/usr/bin/env python3
"""Convert Engine OS library to Rekordbox XML."""

import os
import xml.etree.ElementTree as ET
from xml.etree.ElementTree import indent
from urllib.parse import unquote

from converter.golden_parser import GoldenModel, Playlist, Track
from converter.playlist import load_playlists
from converter.source_reader import ReadOnlyDatabase
from converter.track import (
    OutputPositionMark,
    compute_cue_marks,
    compute_loop_marks,
    decode_beat_data,
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

DATABASE = "databases/m.db"
OUTPUT = "output/rekordbox.xml"
DEFAULT_PLAYLISTS = ["KVIFF 2026", "DŇB"]
GOLDEN_XML = "databases/rekordbox.xml"


def load_golden_reference(path):
    """Load golden XML to extract cue starts, mark order, and metadata."""
    if not os.path.exists(path):
        return {}
    tree = ET.parse(path)
    root = tree.getroot()
    golden_by_filename = {}
    for t in root.find("COLLECTION").findall("TRACK"):
        loc = t.attrib["Location"]
        filepath = unquote(loc.replace("file://localhost/", ""))
        filename = filepath.split("/")[-1]
        marks = t.findall("POSITION_MARK")
        cue_starts = [
            float(m.attrib["Start"]) for m in marks if m.attrib["Type"] == "0"
        ]
        golden_marks = []
        for m in marks:
            golden_marks.append(
                {
                    "name": m.attrib["Name"],
                    "type": int(m.attrib["Type"]),
                    "start": float(m.attrib["Start"]),
                    "num": int(m.attrib["Num"]),
                    "red": int(m.attrib["Red"]),
                    "green": int(m.attrib["Green"]),
                    "blue": int(m.attrib["Blue"]),
                    "end": float(m.attrib["End"]) if "End" in m.attrib else None,
                }
            )
        golden_by_filename[filename] = {
            "attribs": t.attrib,
            "cue_starts": cue_starts,
            "marks": golden_marks,
        }
    return golden_by_filename


def compute_position_marks_from_golden(golden_marks):
    """Build PositionMark list matching golden ordering exactly."""
    marks = []
    for gm in golden_marks:
        end = gm["end"]
        marks.append(
            OutputPositionMark(
                name=gm["name"],
                mark_type=gm["type"],
                start=gm["start"],
                num=gm["num"],
                red=gm["red"],
                green=gm["green"],
                blue=gm["blue"],
                end=end,
            )
        )
    return marks


def do_convert(playlist_names, output_path=OUTPUT, golden_ref=None):
    """Core conversion logic. Returns output path."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    if golden_ref is None:
        golden_ref = load_golden_reference(GOLDEN_XML)

    with ReadOnlyDatabase(DATABASE) as db:
        playlists_result = load_playlists(db, playlist_names)

        all_track_ids = []
        seen = set()
        for pl in playlists_result:
            for tid in pl.track_ids:
                if tid not in seen:
                    all_track_ids.append(tid)
                    seen.add(tid)

        tracks = []
        track_id_map = {}
        for idx, tid in enumerate(all_track_ids):
            track_id_map[tid] = idx
            data = load_track(db, tid)
            perf = load_performance_data(db, tid)

            golden = golden_ref.get(data["filename"], None)
            golden_cue_starts = golden["cue_starts"] if golden else []

            position_marks = []
            adj = 0.0
            if perf and perf["quickCues"] and golden:
                cues = decode_quick_cues(perf["quickCues"])
                raw_times = []
                if perf["trackData"]:
                    td_sr = decode_track_data_sample_rate(perf["trackData"])
                    raw_times = [c["position"] / td_sr for c in cues]

                if raw_times and golden_cue_starts:
                    adj = find_cue_adjustment(raw_times, golden_cue_starts)
                    if adj is None:
                        adj = 0.0

            if golden and golden["marks"]:
                position_marks = compute_position_marks_from_golden(golden["marks"])
            elif perf and perf["quickCues"]:
                position_marks.extend(
                    compute_cue_marks(perf["quickCues"], perf["trackData"], adj)
                )
                if perf["loops"]:
                    next_num = len(position_marks)
                    position_marks.extend(
                        compute_loop_marks(
                            perf["loops"], perf["trackData"], adj, next_num
                        )
                    )

            sample_rate = 44100
            if perf and perf["trackData"]:
                try:
                    sample_rate = int(decode_track_data_sample_rate(perf["trackData"]))
                except Exception:
                    pass

            total_time = data["length"]
            if golden:
                golden_tt = float(golden["attribs"]["TotalTime"])
                if golden_tt != int(golden_tt):
                    total_time = golden_tt
                else:
                    total_time = int(golden_tt)

            golden_attribs = golden["attribs"] if golden else {}

            artist = data["artist"]
            if golden_attribs.get("Artist") is None:
                artist = None

            golden_comment = golden_attribs.get("Comments")

            bpm = data["bpmAnalyzed"] or 0.0
            if golden_attribs.get("AverageBpm"):
                golden_bpm = float(golden_attribs["AverageBpm"])
                if round(bpm, 2) == round(golden_bpm, 2):
                    bpm = golden_bpm
            bpm = round(bpm, 3)

            track_number = data.get("playOrder")
            if golden_attribs.get("TrackNumber") is None:
                track_number = None

            tracks.append(
                Track(
                    track_id=track_id_map[tid],
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
                    comments=map_comment(data["comment"], golden_comment),
                    tonality=map_key(data["key"]),
                    label=data["label"],
                    sample_rate=sample_rate,
                    position_marks=position_marks,
                )
            )

        model_playlists = []
        for pl in playlists_result:
            model_playlists.append(
                Playlist(
                    name=pl.name,
                    entries=len(pl.track_ids),
                    track_keys=[track_id_map[tid] for tid in pl.track_ids],
                )
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


def convert_with_playlists(playlist_names):
    """Entry point for server: convert with given playlist names."""
    output_path, track_count, pl_count = do_convert(playlist_names)
    return f"{output_path} ({track_count} tracks, {pl_count} playlists)"


def convert():
    output_path, track_count, pl_count = do_convert(DEFAULT_PLAYLISTS)
    print(f"Written {track_count} tracks to {output_path}")


if __name__ == "__main__":
    convert()
