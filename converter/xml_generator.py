import xml.etree.ElementTree as ET
from typing import List, Optional

from converter.golden_parser import (
    GoldenModel,
    Playlist,
    PositionMark,
    Tempo,
    Track,
)


def build_position_mark_xml(parent: ET.Element, mark: PositionMark):
    attribs = {
        "Name": mark.name,
        "Type": str(mark.mark_type),
        "Start": str(mark.start),
        "Num": str(mark.num),
        "Red": str(mark.red),
        "Green": str(mark.green),
        "Blue": str(mark.blue),
    }
    if mark.end is not None:
        attribs["End"] = str(mark.end)
    ET.SubElement(parent, "POSITION_MARK", attribs)


def build_tempo_xml(parent: ET.Element, tempo: Tempo):
    ET.SubElement(
        parent,
        "TEMPO",
        attrib={
            "Inizio": str(tempo.inizio),
            "Bpm": str(tempo.bpm),
            "Metro": tempo.metro,
            "Battito": str(tempo.battito),
        },
    )


def build_track_xml(parent: ET.Element, track: Track):
    attribs = {
        "TrackID": str(track.track_id),
        "Name": track.name,
        "Kind": track.kind,
        "Location": track.location,
        "Size": str(track.size),
        "TotalTime": str(track.total_time),
        "AverageBpm": str(track.average_bpm),
        "SampleRate": str(track.sample_rate),
    }
    if track.artist is not None:
        attribs["Artist"] = track.artist
    if track.album is not None:
        attribs["Album"] = track.album
    if track.genre is not None:
        attribs["Genre"] = track.genre
    if track.track_number is not None:
        attribs["TrackNumber"] = str(track.track_number)
    if track.year is not None:
        attribs["Year"] = str(track.year)
    if track.bit_rate is not None:
        attribs["BitRate"] = str(track.bit_rate)
    if track.comments is not None:
        attribs["Comments"] = track.comments
    if track.tonality is not None:
        attribs["Tonality"] = track.tonality
    if track.label is not None:
        attribs["Label"] = track.label

    track_elem = ET.SubElement(parent, "TRACK", attribs)

    for mark in track.position_marks:
        build_position_mark_xml(track_elem, mark)

    if track.tempo is not None:
        build_tempo_xml(track_elem, track.tempo)


def build_playlist_xml(parent: ET.Element, playlist: Playlist):
    node = ET.SubElement(
        parent,
        "NODE",
        attrib={
            "Name": playlist.name,
            "Type": "1",
            "KeyType": "0",
            "Entries": str(playlist.entries),
        },
    )
    for key in playlist.track_keys:
        ET.SubElement(node, "TRACK", attrib={"Key": str(key)})


def generate_xml(model: GoldenModel) -> ET.ElementTree:
    dj_playlists = ET.Element("DJ_PLAYLISTS", attrib={"Version": "1.0.0"})

    ET.SubElement(
        dj_playlists,
        "PRODUCT",
        attrib={
            "Name": model.product_name,
            "Version": model.product_version,
            "Company": model.product_company,
        },
    )

    collection = ET.SubElement(
        dj_playlists,
        "COLLECTION",
        attrib={"Entries": str(model.collection_entries)},
    )
    for track in model.tracks:
        build_track_xml(collection, track)

    playlists_elem = ET.SubElement(dj_playlists, "PLAYLISTS")
    root_node = ET.SubElement(
        playlists_elem,
        "NODE",
        attrib={
            "Type": "0",
            "Name": "ROOT",
            "Count": str(len(model.playlists)),
        },
    )
    for playlist in model.playlists:
        build_playlist_xml(root_node, playlist)

    return ET.ElementTree(dj_playlists)
