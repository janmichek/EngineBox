# PROGRESS (append-only)

Newest entry last. Never edit past entries.

## 2026-07-19 — Loop template setup
- Did: created `AGENTS.md` and `ai/` docs (LOOP, SPEC, RESEARCH, BACKLOG, PROGRESS, DECISIONS).
- Verified: n/a (docs only).
- Next: fill in SPEC target — identify the original convertor.
- Blocked/Notes: SPEC is empty until the human names the convertor being replicated.

## 2026-07-19 — Define converter plan and safety boundary
- Did: defined the MIXO Engine OS 3.0.2 to Rekordbox XML target, two-playlist scope, Python conventions, semantic acceptance test, immutable database rules, and ordered implementation backlog.
- Verified: read-only inspection found playlist IDs 708 and 11 with 178 + 115 distinct tracks; the golden XML has the same 293-track collection and matching playlist order.
- Next: scaffold Python tests, then implement the read-only source inspector.
- Blocked/Notes: source path rewriting may temporarily use `/Users/yeahboi`; keep it isolated until comparison proves whether it is required.

## 2026-07-19 — Revalidate exact-match loop plan
- Did: changed acceptance to exact semantic values with no timing tolerances; fixed playlist names as product scope while removing fixture IDs from selection logic; moved golden parser/comparator before implementation; split raw blob decoding from exact MIXO timing derivation; added the observed Type 4 loop; hardened loop preflight, reference hashing, one-commit enforcement, and blocked-stop behavior.
- Verified: the golden XML has 1,060 position marks including one Type 4 loop; configuration consistently requires exact values and read-only references.
- Next: create a human-approved baseline commit, then scaffold Python tests as loop iteration 1.
- Blocked/Notes: autonomous loops intentionally cannot start while the repository has no baseline commit or has staged/uncommitted setup files.

## 2026-07-19 — Scaffold tests/ and Python smoke test
- Did: created `tests/__init__.py` and `tests/test_smoke.py` with three smoke tests (standard library imports, database read-only access, golden XML parse).
- Verified: `python3 -m unittest discover -s tests` passes (3 tests); reference file hashes unchanged.
- Next: build a golden XML parser that normalizes the reference document into collection tracks, cue/tempo data, and ordered playlists.
- Blocked/Notes: SQLite PRAGMA schema_version returns 2, not 30002; the "3.0.2" is the Engine DJ schema version, not the SQLite internal version.

## 2026-07-19 — Build golden XML parser
- Did: created `converter/golden_parser.py` with dataclasses for Track, PositionMark, Tempo, Playlist, GoldenModel; parses all 293 tracks, 1060 position marks, 2 playlists.
- Verified: 16 unit tests pass; BitRate is optional (106 tracks missing it); reference file hashes unchanged.
- Next: implement an exact semantic comparator with focused mismatch output.
- Blocked/Notes: 106 of 293 tracks have no BitRate attribute in golden XML.

## 2026-07-19 — Implement exact semantic comparator
- Did: created `converter/comparator.py` with compare_models function and ComparisonResult class; compares product info, collection, tracks (all scalar fields, position marks, tempos), and playlists with focused mismatch messages.
- Verified: 11 unit tests pass including identical model equality and detection of name, timing, tempo, cue, color, collection count, and playlist mismatches; reference file hashes unchanged.
- Next: build a read-only source reader that opens an Engine SQLite path with mode=ro, validates schema 3.0.2, and rejects missing or incompatible databases.
- Blocked/Notes: comparator uses exact value matching with no tolerances as required.

## 2026-07-19 — Build read-only source reader
- Did: created `converter/source_reader.py` with ReadOnlyDatabase class supporting context manager, read-only mode, and validation; 7 unit tests covering open, validate, query, missing database, and read-only enforcement.
- Verified: 34 tests pass; reference file hashes unchanged.
- Next: implement linked-list playlist traversal selected by hardcoded exact names `KVIFF 2026` and `DŇB`.
- Blocked/Notes: database has 10 tables; Track table confirmed queryable.

## 2026-07-19 — Implement linked-list playlist traversal
- Did: created `converter/playlist.py` with find_playlist_by_name, _traverse_linked_list, and load_playlists functions; finds unreferenced entity, follows nextEntityId chain to 0.
- Verified: 7 unit tests pass; KVIFF 2026 has 178 tracks (first: "Finish Line (Original Mix)"), DŇB has 115 tracks; reference file hashes unchanged.
- Next: characterize every scalar TRACK attribute across all 293 source/golden pairs.
- Blocked/Notes: linked list is reverse (nextEntityId points to previous entity); unreferenced entity is first.

## 2026-07-19 — Characterize scalar TRACK attributes
- Did: matched all 293 source tracks to golden XML by filename; documented exact mappings for all scalar attributes including title, artist, album, genre, kind, location, size, duration, year, BPM, bitrate, comments, key, label, sample rate.
- Verified: location mapping confirmed (../../ → Users/yeahboi/); key mapping confirmed (even→d, odd→m); comment handling documented (12 tracks get MIXO-added 'Purchased at Beatport', long comments truncated to 247 chars).
- Next: decode and test trackData; derive exact sample rate and TotalTime mapping.
- Blocked/Notes: 58 tracks have decimal TotalTime from trackData blob (source length is integer); 106 tracks missing BitRate; sample rate is always 44100.

## 2026-07-19 — Decode trackData and beatData blobs
- Did: decoded trackData and beatData blobs (4-byte BE prefix + zlib); confirmed sample rate 44100.0 from first 8 bytes; derived TotalTime = total_samples / sample_rate from beatData.
- Verified: 235 tracks match Track.length exactly (integer); 9 decimal tracks match beatData computation; 49 decimal tracks have small per-track offset (0.025–0.052s) matching the known timing adjustment.
- Next: implement the scalar track model and metadata mappings.
- Blocked/Notes: the 49 tracks with offset need the same per-track timing adjustment as cues/loops/tempo.
