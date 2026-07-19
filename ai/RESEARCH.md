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
- [ ] Which Engine beat-grid marker becomes the single MIXO `TEMPO` element?
- [ ] How does MIXO apply the exact per-track timing adjustment to cue, loop, and tempo positions?
- [ ] Does every selected track use the same Engine 3.0.2 blob layout?

## Experiments

<!-- Append entries; never rewrite old ones.

## <date> — <experiment title>
- Input: <what you fed it>
- Observed: <output, exact messages>
- Conclusion: <confirmed / refuted / inconclusive>
- Promoted to SPEC: yes/no
-->

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
