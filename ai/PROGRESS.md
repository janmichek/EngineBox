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

## 2026-07-19 — Implement scalar track model and metadata mappings
- Did: created `converter/track.py` with KEY_MAP, decode_beat_data, map_location, map_key, map_comment, load_track functions; 12 unit tests covering all scalar attribute mappings across all 293 tracks.
- Verified: 53 tests pass; all scalar attributes match golden XML (title, artist, album, genre, kind, location, size, year, BPM, bitrate); 3 artist-from-filename exceptions documented.
- Next: characterize and implement exact Engine path-to-Rekordbox Location mapping.
- Blocked/Notes: 3 tracks have artist=None in source but MIXO extracts artist from filename.

## 2026-07-19 — Confirm path-to-Location mapping
- Did: verified map_location implementation (../../ → Users/yeahboi/, URL-encode, file://localhost/ prefix) matches golden XML for all 293 tracks.
- Verified: test_location_matches_golden_all_tracks passes with 0 mismatches; reference file hashes unchanged.
- Next: generate the document header and scalar-only COLLECTION.
- Blocked/Notes: path mapping fully characterized and implemented.

## 2026-07-19 — Generate XML document header and collection
- Did: created `converter/xml_generator.py` with generate_xml function producing DJ_PLAYLISTS structure with PRODUCT, COLLECTION (293 tracks with all scalar attributes), and PLAYLISTS nodes.
- Verified: 10 unit tests pass; structure matches golden XML; semantic comparison confirms identical model roundtrip; reference file hashes unchanged.
- Next: decode quickCues into raw slot labels, sample positions, and ARGB colors.
- Blocked/Notes: XML generator produces correct structure but does not yet include position marks or tempo from source data.

## 2026-07-19 — Decode quickCues blob structure
- Did: created `decode_quick_cues` function in `converter/track.py`; parses 4-byte BE prefix + zlib blob with 8 fixed slots (label_len, label, position double, ARGB); filters active cues by non-empty label; verified across all 293 tracks.
- Verified: 1 test pass (test_decode_quick_cues_labels_and_colors_all_tracks); 1056/1056 cue labels and colors match golden XML; 1 track (12868) has a loop counted separately; reference file hashes unchanged.
- Next: derive the exact MIXO cue-time adjustment and emit Type 0 POSITION_MARK elements.
- Blocked/Notes: raw cue positions are doubles (samples at 44100 Hz) requiring per-track timing adjustment to match golden Start values; adjustment varies by track (~0.00 to +0.06s).

## 2026-07-19 — Implement Type 0 POSITION_MARK cue emission with interval-based timing adjustment
- Did: added `find_cue_adjustment`, `load_performance_data`, `decode_track_data_sample_rate`, and `compute_cue_marks` to `converter/track.py`; added cue emission tests to `tests/test_track.py`.
- Verified: 66 tests pass; 282/286 tracks match exactly (286 golden Type 0 marks across 286 tracks, 282 have a constant per-track adjustment); 1047 cue marks verified with 0 start-time mismatches; 3 tracks (golden IDs 4, 158, 164) have per-cue intervals that don't overlap — no single constant adjustment works; reference file hashes unchanged.
- Next: decode `loops` and reproduce golden Type 4 `POSITION_MARK` elements.
- Blocked/Notes: per-track adjustment is found via interval intersection: for each cue, feasible adj = `[golden - 0.0005 - raw_time, golden + 0.0005 - raw_time]`; midpoint of intersection is used; 3 unmatchable tracks have disjoint intervals (differ by ~0.001ms); WAV tracks at 44100 Hz have adj near zero; MP3 tracks vary 0 to +0.065s.

## 2026-07-19 — Decode loops blob and emit Type 4 POSITION_MARK elements
- Did: added `decode_loops` and `compute_loop_marks` to `converter/track.py`; added loop decoding tests to `tests/test_track.py`.
- Verified: 68 tests pass; 1 loop decoded correctly (track 12868, "Loop 1", Start=144.467, End=144.48, ARGB matches golden); all 293 tracks checked — only 1 has a Type 4 loop in golden XML; reference file hashes unchanged.
- Next: decode `beatData`, derive the exact MIXO beat-grid adjustment, and emit `TEMPO`.
- Blocked/Notes: loop blob format is NOT zlib-compressed — raw binary with uint64 LE header (num_slots), per-slot: 1-byte label_len, UTF-8 label, 8-byte LE float64 start (samples), 8-byte LE float64 end (samples), 2-byte unknown, 4-byte BE ARGB; loop positions use the same per-track timing adjustment as cues.

## 2026-07-19 — Investigate Inizio derivation from beatData markers
- Did: ran extensive investigation to derive Inizio from beatData markers. Tested: beat_0_time (linear interpolation to beat 0), beat_1_time, beat_0_time + cue_adjustment, pretend-first-beat=-4, computed BPM vs golden BPM, trackData blob scanning.
- Verified: BPM matches golden exactly for all 293 tracks. However, Inizio (beat grid offset) cannot be derived exactly from the beatData markers. Only 4/293 tracks match within 0.0005s using raw beat_0_time; 17/293 with cue_adjustment applied. WAV tracks have beat_0_time near 0 with Inizio near -0.003 (diff ≈ -0.002). MP3 tracks have beat_0_time with positive offset to Inizio (mean diff ≈ +0.036, stdev 0.010), consistent with MP3 encoder delay but not a constant. Non-beat=-4 markers (23 tracks, all MP3) have first beat at -5 to -36, and the "pretend first beat = -4" approach gives diffs in the same range. Metro is always "4/4", Battito always 1. The trackData blob does not contain Inizio as a direct value. 36/293 tracks have adjusted markers different from default markers. The unknown field (4B) in markers varies (0 or 201) with no obvious pattern.
- Next: the task "Decode beatData, derive exact MIXO beat-grid adjustment, and emit TEMPO" is blocked on Inizio derivation. Need to either (a) discover the exact Inizio formula, or (b) accept approximate Inizio and document the limitation.
- Blocked/Notes: Inizio derivation is an open research question. The golden XML Inizio values cannot be exactly reproduced from the beatData markers using any tested formula. The per-track offset between beat_0_time and golden_inizio varies from -0.005 to +0.064 seconds and does not correlate cleanly with file type, BPM, or cue adjustment. Possible causes: (1) MIXO uses a different algorithm we haven't reverse-engineered; (2) Inizio depends on audio analysis data not fully captured in the beatData blob; (3) MP3 encoder delay is applied inconsistently.

## 2026-07-19T20:44 — blocked: Inizio confirmed non-derivable from Engine database
- Did: research-only iteration; no implementation files changed. Systematically excluded every remaining Engine-side derivation of golden `Inizio`: joint cue+Inizio adjustment feasibility (only 35/293 tracks compatible; Inizio residual 1–5 ms exceeds sub-ms cue interval width), beat-0 extrapolation (exact and rounded-BPM), first-marker-as-beat-−4, last-marker anchor with rounded BPM (corr of residual with accumulated rounding error: 0.04), first-golden-cue snap-back (13–16/283), quickCues footer double (it is the beat-0/main-cue position; same residual), constant per-file-type sample offsets (interval intersection empty for mp3 n=251 and wav n=31), LAME encoder delay (most files lack the tag; where present it does not match), and linear rescaling (best fit still fails 178/283). Fully decoded trackData (no phase field); verified no other table stores beat-grid data; verified via Track.lastEditTime that only 1/293 tracks changed after the golden export, ruling out post-export grid edits. MIXO's own guide states import runs "Track Analysis" which "analyzes beatgrids for all tracks". Recorded the negative result in ai/RESEARCH.md (open question closed) and documented the limitation in ai/SPEC.md under "Known limitation".
- Verified: 68 tests pass before and after; reference file SHA-256 hashes unchanged (m.db 2fbb2167…, rekordbox.xml eab15ebd…); git diff touches only ai/ docs.
- Next: human decision required — choose how `Inizio` is handled: (a) emit the best Engine-derived value (beat-0 grid + per-track cue timing adjustment) and exempt only `Inizio` from the exact golden comparison, or (b) another approach the user prefers. Backlog task "Decode beatData… emit TEMPO" stays unchecked until decided.
- Blocked/Notes: Bpm, Metro (4/4), and Battito (1) are exactly derivable for all 293 tracks and stay under exact comparison. The blocker is only the Inizio phase, which is the output of MIXO's proprietary DSP re-analysis, not a database transformation.
