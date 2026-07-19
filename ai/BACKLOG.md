# BACKLOG

Strictly ordered. Agents take the topmost unchecked task, one per iteration. Add new tasks where they belong by priority; never delete history — check things off.

## Before running autonomous loops

A human must create a baseline commit containing the intended project setup, then ensure `git status --porcelain` is empty. `ai/loop.sh` intentionally refuses to start without both conditions.

## Now

- [x] Add repository safety ignores for `databases/`, `output/`, `.DS_Store`, Python caches, and virtual environments; verify neither reference file can be staged.
- [x] Scaffold `tests/` and a Python smoke test so `python3 -m unittest discover -s tests` is green without reading the full database.
- [x] Build a golden XML parser that normalizes the reference document into collection tracks, cue/tempo data, and ordered playlists.
- [x] Implement an exact semantic comparator with focused mismatch output; prove it ignores XML formatting and equivalent numeric representation but rejects every changed value and uses no tolerances.
- [x] Build a read-only source reader that opens an Engine SQLite path with `mode=ro`, validates schema 3.0.2, and rejects missing or incompatible databases.
- [x] Implement linked-list playlist traversal selected by the hardcoded exact names `KVIFF 2026` and `DŇB`; assert fixture IDs/counts/order without using IDs for selection.

## Next

- [x] Characterize every scalar `TRACK` attribute across all 293 source/golden pairs, including sequential occurrence-based `TrackID`, missing-field rules, BPM, key, duration, and numeric representation; record only exact mappings.
- [x] Decode and test `trackData`; derive exact sample rate and `TotalTime` mapping for every selected track with no tolerance.
- [x] Implement the scalar track model and metadata mappings; unit-test all 293 tracks against the golden model.
- [x] Characterize and implement exact Engine path-to-Rekordbox `Location` mapping across all 293 tracks, isolating the `/Users/yeahboi` fixture root.
- [x] Generate the document header and scalar-only `COLLECTION`; pass exact comparison for structure and scalar track attributes.
- [x] Decode `quickCues` into raw slot labels, sample positions, and ARGB colors; verify blob structure across all selected tracks.
- [x] Derive the exact MIXO cue-time adjustment and emit Type `0` `POSITION_MARK` elements; every `Start`, name, slot, and RGB value must match.
- [x] Decode `loops` and reproduce the golden Type `4` `POSITION_MARK`, including exact `Start` and `End`; verify no other loop output is missing.
- [x] ~~Decode `beatData`, derive the exact MIXO beat-grid adjustment, and emit `TEMPO`; every `Inizio`, BPM, meter, and beat value must match.~~ SKIPPED — `Inizio` cannot be derived exactly from beatData; human decision to skip TEMPO output entirely.
- [x] Generate the two playlist nodes and occurrence-based collection references; pass the complete exact semantic comparison.

## Later

- [ ] Add `convert.py` CLI with read-only database input, output defaulting to `output/rekordbox.xml`, and no playlist-selection options.
- [ ] Add an integration test that snapshots hashes/metadata of both reference files, runs conversion, compares generated XML semantically, and proves the references were unchanged.
- [ ] Exercise corrupt database, missing playlist, duplicate playlist title, and unwritable output errors without modifying the source.
- [ ] Document the local command, expected output, golden verification command, and known Engine 3.0.2 limitation.
- [ ] Run the full acceptance check from a clean working tree and record the result.

## Done

- [x] Add HTTP API server and React UI with playlist selector, convert button, and progress display.
- [x] Set up AI loop template (`AGENTS.md`, `ai/` docs).
- [x] Define target as MIXO Engine OS 3.0.2 to Rekordbox XML for `KVIFF 2026` and `DŇB`.
- [x] Inspect source schema, selected playlist counts/order, and golden XML structure without modifying reference files.
