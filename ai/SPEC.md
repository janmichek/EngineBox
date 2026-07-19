# SPEC — Engine OS to Rekordbox XML

Source of truth for what to build. Only confirmed behavior belongs here; hypotheses stay in `ai/RESEARCH.md` until verified.

## Target

- Replicate the relevant behavior of MIXO's Engine DJ to Rekordbox XML converter.
- Input: the local Engine OS 3.0.2 SQLite library at `databases/m.db`.
- Output: a Rekordbox-compatible XML file produced by a local Python CLI.
- Golden reference: `databases/rekordbox.xml`, previously exported by MIXO.
- Scope: exactly the hardcoded root playlist names `KVIFF 2026` and `DŇB`.
- Environment: this local macOS project only.

## Safety invariants

- Treat every file under `databases/` as immutable, read-only reference data.
- Open SQLite with read-only mode (`mode=ro`) and never execute a mutating statement.
- Never write generated output under `databases/`.
- Never stage or commit `databases/`.
- Default generated output path: `output/rekordbox.xml`.

## Confirmed source facts

- `m.db` uses Engine database schema version 3.0.2.
- In this fixture, playlist IDs are `708` (`KVIFF 2026`, 178 entries) and `11` (`DŇB`, 115 entries). The converter selects by exact name, not database ID.
- The selected playlists contain 293 entries and 293 distinct tracks.
- Playlist order is represented by `PlaylistEntity.nextEntityId`.
- All selected source paths begin with `../../`.

## Required output

- A `DJ_PLAYLISTS` Rekordbox XML document with one collection of 293 tracks.
- Root playlist node containing `KVIFF 2026` followed by `DŇB`.
- Playlist entries preserve Engine playlist order and reference the correct collection tracks.
- Collection tracks are emitted once per playlist occurrence; do not add deduplication logic.
- Track metadata, paths, cues, cue colors, cue times, duration, and tempo/beat-grid information are semantically identical to `databases/rekordbox.xml`.
- Cue, duration, BPM, and tempo values must match the golden values exactly after numeric normalization. No timing tolerance is allowed.
- XML whitespace, indentation, attribute order, and equivalent representations of the same numeric value do not need to match.
- Output locations must equal the golden XML locations. The fixture appears to map leading `../../` to `/Users/yeahboi/`; keep this rule isolated and prove it across all 293 tracks before promoting it to a general mapping.

## Metadata in scope

- Collection and playlist membership/order.
- Track title, artist, album, genre, file type, location, file size, duration, track number, year, BPM, bitrate, comments, musical key, label, and sample rate when present.
- Hot-cue name, slot, position, and RGB color.
- Rekordbox tempo marker fields represented by the golden XML.

## Non-goals

- Any playlist other than `KVIFF 2026` and `DŇB`.
- Writing or repairing Engine OS databases.
- Rekordbox database writes or direct sync.
- A web interface, cross-platform packaging, batch database conversion, or generalized support for other Engine schema versions.
- Byte-identical XML serialization.

## Acceptance

The required integration check runs the converter against `databases/m.db`, writes a fresh file outside `databases/`, parses both generated and golden XML, and compares normalized semantic models. It must verify:

1. product/document structure;
2. collection count and every in-scope track field;
3. cue and tempo data;
4. playlist names, order, counts, and track references; and
5. no input file under `databases/` changed during the run.

The comparator may normalize XML syntax and numeric representation, but it must not use value tolerances.
