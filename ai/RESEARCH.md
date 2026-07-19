# RESEARCH — Reverse-engineering notes

Working notes on the original convertor. Hypotheses live here; once confirmed, promote them to `ai/SPEC.md`.

## Method

1. Query `databases/m.db` in SQLite read-only URI mode.
2. Parse `databases/rekordbox.xml` as the MIXO golden output.
3. Match source tracks to output tracks and vary one field or decoder assumption at a time.
4. Record each experiment below; promote only confirmed findings to SPEC.
5. Never alter either reference file while experimenting.

## Open questions

- [x] Which exact source columns map to each optional Rekordbox `TRACK` attribute?
- [ ] How does MIXO derive exact decimal `TotalTime` values?
- [x] Is `/Users/yeahboi` path-root rewriting required, or can the correct root be derived?
- [x] Which Engine beat-grid marker becomes the single MIXO `TEMPO` element?
- [x] How does MIXO apply the exact per-track timing adjustment to cue, loop, and tempo positions?
- [x] How does MIXO derive the exact `Inizio` value from the beatData markers? (Answer: it does not — evidence indicates MIXO re-analyzes beatgrids with its own DSP during import, so the exact `Inizio` phase is not derivable from the Engine database. See 2026-07-19 experiment below.)
- [ ] Does every selected track use the same Engine 3.0.2 blob layout?

## Experiments

<!-- Append entries; never rewrite old ones.

## <date> — <experiment title>
- Input: <what you fed it>
- Observed: <output, exact messages>
- Conclusion: <confirmed / refuted / inconclusive>
- Promoted to SPEC: yes/no
-->

## 2026-07-19 — Inizio is not derivable from the Engine database (systematic exclusion)

- Input: all 293 source/golden pairs; per-track feasible intervals for the timing adjustment derived from rounded golden cue `Start` values (width typically < 1 ms); every plausible Engine-side anchor for the beat-grid phase.
- Observed:
  - Joint feasibility test: only 35/293 tracks have a single per-track adjustment satisfying both cues and `Inizio`; the `Inizio` residual (typically 1–5 ms, range −53 ms to +10 ms) exceeds the sub-millisecond cue interval width, so `TEMPO` is not "cues' adjustment applied to beat 0".
  - Anchors excluded: beat 0 by linear extrapolation (exact and rounded-BPM samples-per-beat), first marker treated as beat −4, last marker stepped back with rounded golden BPM (accumulated-rounding hypothesis: correlation of residual with accumulated error is 0.04), first golden cue snapped back an integer number of beats (rounded and raw variants: 13–16/283 matches), and the `quickCues` footer double (it equals the beat-0/main-cue sample position; same residual).
  - Constant offsets excluded: per-file-type interval intersection is empty (mp3 n=251 and wav n=31 both infeasible); residual is not a multiple of beat length, not correlated with marker count, track length, bitrate, or LAME encoder delay (most files have no LAME/Xing tag; where present, delay does not equal the cue adjustment either).
  - Linear rescaling excluded: best fit `Inizio ≈ 1.00708 × engine_inizio − 0.0024` still leaves only 105/283 tracks within 0.6 ms; residual stdev 3.8 ms.
  - `trackData` fully decoded (sample rate double, uint64 length, 0xFFFFFFFF, 3–6 loudness doubles) — no phase value. No other table in `m.db` stores beat-grid data. `Track.lastEditTime` shows only 1 of 293 tracks edited after the golden export date, so post-export grid edits do not explain the mismatch.
  - MIXO's own documentation states track import runs "Track Analysis" which "analyzes beatgrids for all tracks during the import" (mixo.dj Engine DJ to Rekordbox guide); the observed few-millisecond per-track phase noise is consistent with an independent DSP phase estimate that preserves Engine's BPM.
- Conclusion: confirmed negative result — golden `Inizio` values are the product of MIXO's own audio analysis, not a pure database transformation. Exact reproduction from `m.db` alone is impossible; reproducing MIXO's proprietary DSP bit-exactly is out of reach. `Bpm` (from markers), `Metro` (always `4/4`), and `Battito` (always `1`) remain exactly derivable.
- Promoted to SPEC: yes (Inizio limitation documented as a known deviation requiring user decision).

## Findings (confirmed)

- The reference converter is MIXO, converting Engine DJ/Engine OS library data to Rekordbox XML.
- The source is an Engine schema 3.0.2 SQLite database.
- SQLite PRAGMA schema_version returns 2, not 30002; the "3.0.2" is the Engine DJ schema version, not the SQLite internal version.
- 106 of 293 tracks in golden XML have no BitRate attribute; the field is optional.
- Scope is exactly `KVIFF 2026` (playlist ID 708, 178 tracks) and `DŇB` (playlist ID 11, 115 tracks).
- Playlist names are hardcoded product scope; fixture IDs are observations, not selection logic.
- The playlists have 293 distinct tracks, matching the golden XML collection count.
- `PlaylistEntity.nextEntityId` is a forward linked list. Its unreferenced entity is first and `nextEntityId = 0` terminates the list.
- The golden XML preserves that linked-list order.
- Engine performance blobs other than `loops` have a four-byte big-endian uncompressed-length prefix followed by zlib data.
- Engine key values map without conflicts across all 293 tracks: even `k` maps to `{k/2+1}d`, odd `k` maps to `{floor(k/2)+1}m`.
- Inspected BPM mappings use `Track.bpmAnalyzed`; `Track.bpm` can differ from the golden value.
- A decoded `quickCues` sample confirmed eight slots with UTF-8 labels, big-endian sample positions, and ARGB colors that match the golden XML exactly.
- Raw cue samples require an additional exact per-track timing adjustment before matching MIXO; tolerances are not acceptable.
- The golden XML contains 1,060 `POSITION_MARK` elements, including one Type `4` loop with `Start` and `End`, plus `TEMPO` markers and two root playlist nodes.
- Confirmed scalar TRACK attribute mappings across all 293 tracks:
  - `Track.title` → `Name` (exact match)
  - `Track.artist` → `Artist` (None → omit attribute)
  - `Track.album` → `Album` (None → omit attribute)
  - `Track.genre` → `Genre` (None → omit attribute)
  - `Track.fileType` → `Kind` (exact match)
  - `Track.path + Track.filename` → `Location` (replace `../../` with `Users/yeahboi/`, URL-encode, prefix `file://localhost/`)
  - `Track.fileBytes` → `Size` (exact match)
  - `Track.length` → `TotalTime` (integer match for 235 tracks; 58 tracks have decimal TotalTime from trackData blob)
  - `Track.year` → `Year` (None → omit attribute)
  - `Track.bpmAnalyzed` → `AverageBpm` (formatted to 3 decimal places)
  - `Track.bitrate` → `BitRate` (None → omit attribute; 106 tracks missing)
  - `Track.comment` → `Comments` (None → omit attribute; MIXO adds 'Purchased at Beatport' to 12 tracks; long comments truncated to 247 chars with newlines stripped)
  - `Track.key` → `Tonality` (even k → `{k/2+1}d`, odd k → `{floor(k/2)+1}m`)
  - `Track.label` → `Label` (None → omit attribute)
  - `Track.sampleRate` → `SampleRate` (hardcoded 44100 for all tracks)
- 3 tracks have `artist=None` in source but MIXO extracts artist from filename (e.g., "Honey T - Sunchain.wav" → Artist="Honey T").
- `PerformanceData.trackData` blob structure: 4-byte BE prefix (uncompressed length) + zlib data. Decompressed trackData starts with 8-byte BE double (sample rate, always 44100.0), followed by additional fields.
- `PerformanceData.beatData` blob structure: same 4-byte BE prefix + zlib. Decompressed beatData starts with 8-byte BE double (sample rate) + 8-byte BE double (total samples). `TotalTime = total_samples / sample_rate` for exact-match tracks.
- For 235 of 293 tracks, golden `TotalTime` equals `Track.length` (integer).
- For 58 tracks, golden `TotalTime` has decimal places. Of these, 9 match `total_samples / sample_rate` exactly, but 49 have a small per-track offset (typically 0.025–0.052 seconds), suggesting the same per-track timing adjustment applies to TotalTime as to cue/loop/tempo positions.
- `PerformanceData.quickCues` blob structure: 4-byte BE prefix + zlib. Decompressed format: 8-byte uint64 num_slots, then 8 fixed-size slots. Each slot: 1-byte label_len, N-byte UTF-8 label, 8-byte BE double (position in samples at 44100 Hz), 4-byte BE uint32 ARGB color. A 17-byte footer follows (double + double + byte). Active cues are filtered by non-empty label (not by position >= 0, since some cues have negative positions that become positive after timing adjustment).
- quickCues blob always contains exactly 8 slots. Empty slots have label_len=0, position=-1.0, ARGB=0x00000000. Active cue labels are "Cue 1" through "Cue 8"; slot order maps to golden XML `Num` index.
- Across all 293 tracks, 1056 active cue labels and RGB values match golden XML exactly. The only count mismatch is track 12868 which has a Type 4 loop (from the `loops` blob) interleaved with cues in golden.
- `loops` blob format: NOT zlib-compressed. Raw binary with uint64 LE header (num_slots), then per slot: 1-byte label_len, N-byte UTF-8 label, 8-byte LE float64 start (samples at trackData sample rate), 8-byte LE float64 end (samples), 2-byte unknown, 4-byte BE uint32 ARGB color. Empty slots have label_len=0. All 293 selected tracks have 8 loop slots. Only 1 track (12868) has a non-empty loop ("Loop 1") matching golden exactly.
- Loop positions use the same per-track timing adjustment as cues (interval-based `find_cue_adjustment`). With that adjustment, Start and End match golden XML exactly.
- `beatData` blob structure (confirmed via Mixxx wiki): 4-byte BE prefix + zlib. Decompressed: 8B sample_rate (BE double), 8B track_length_samples (BE double), 1B is_beat_data_set (always 1), 8B default_marker_count (BE uint64), N default markers (each 24B: 8B sample_offset LE double, 8B beat_number LE int64, 4B beats_to_next LE uint32, 4B unknown LE uint32), then 8B adjusted_marker_count (BE uint64), then N adjusted markers (same format). 9 trailing zero bytes follow.
- BPM computed from markers matches golden `TEMPO/@Bpm` exactly for all 293 tracks.
- `Inizio` (beat grid offset) computed from markers does NOT exactly match golden for most tracks (only 4/293 within 0.0005s). The derivation of `Inizio` from the beatData markers remains an open question — it is not simply the time of beat 0 via linear interpolation.
- 36/293 tracks have adjusted beatgrid markers different from default markers.
