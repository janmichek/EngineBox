# DECISIONS (append-only)

Irreversible or hard-to-reverse choices, with rationale. Never edit past entries.

## 2026-07-19 — Node.js + plain JS
- Decision: build in Node.js with plain JavaScript, tests via built-in `node --test`.
- Why: matches existing scaffold (`package.json`, `index.js`); zero extra deps until a conversion requires one.
- Revisit if: a target format needs a library only available elsewhere.

## 2026-07-19 — Supersede Node.js with Python
- Decision: implement the converter in Python 3, initially using `sqlite3`, `zlib`, `struct`, `urllib.parse`, and `xml.etree.ElementTree` from the standard library.
- Why: Python is approved for this local script and supports SQLite, binary decoding, XML generation, and semantic test comparison without dependencies.
- Revisit if: verified Engine 3.0.2 performance blobs cannot be decoded reliably with the documented formats.
- Status: **Superseded** — reverted to Node.js + plain JS on 2026-07-19 (see first decision above).

## 2026-07-19 — Immutable local golden fixtures
- Decision: keep `databases/m.db` and `databases/rekordbox.xml` as untracked, immutable local references; write generated files to `output/`.
- Why: the source database must never be touched, and its size and personal library metadata make it unsuitable for version control.
- Revisit if: sanitized, minimal fixtures are created later.

## 2026-07-19 — Semantic XML equivalence
- Decision: compare parsed normalized XML models rather than serialized bytes.
- Why: XML indentation, attribute order, escaping, and equivalent number representations do not change Rekordbox information.
- Revisit if: Rekordbox is found to depend on a serialization detail.

## 2026-07-19 — Exact semantic values, no tolerances
- Decision: normalized XML syntax may differ, but every metadata, path, duration, cue, loop, and tempo value must equal the MIXO golden output exactly. Numeric tolerances are prohibited.
- Why: cue and beat-grid placement is the core conversion behavior and small timing differences can be meaningful in Rekordbox.
- Revisit if: never; this is a user-confirmed acceptance requirement.

## 2026-07-19 — Fixed playlist names
- Decision: convert exactly `KVIFF 2026` and `DŇB`, selected by exact title. Do not expose playlist selection in the CLI and do not select by fixture-specific IDs.
- Why: the requested product is intentionally limited to these two playlists while remaining independent of SQLite row IDs.
- Revisit if: the user later expands scope.

## 2026-07-19 — Skip TEMPO output
- Decision: do not emit `TEMPO` elements in the generated XML. The converter will produce tracks, cues, loops, and playlists but no beat-grid markers.
- Why: `Inizio` (beat grid offset) cannot be exactly derived from beatData markers; only 4/293 tracks match within 0.0005s. The exact-match rule prohibits approximate values, and MIXO's derivation relies on proprietary audio DSP not available from the database alone.
- Revisit if: the exact `Inizio` formula is reverse-engineered, or the acceptance criteria are relaxed to allow approximate beat-grid offsets.
