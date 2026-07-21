# EngineBox

Convert Engine OS playlists to Rekordbox XML - locally, for free.

A weekend vibecode project done with AI Loops. Not a product. Not advice on how to build software.

## Converter

Reads an Engine OS 5.0.0 SQLite library (`m.db`) and writes Rekordbox 7.2.16-compatible XML with track metadata, cues, and playlist order.


## Motivation

I'm a musician and DJ. There's no one-size-fits-all setup for DJing - the field has strong players, and each one wants your library locked to their ecosystem. Moving between them is painful.

I've used Engine OS for years. In clubs, the standard is AlphaTheta and Rekordbox - great hardware, rough software. I was paying ~$10/month for a playlist converter and thought that was ridiculous.

Around the same time, two ideas clicked: SaaS feels increasingly replaceable by  AI tooling, and **AI loop-driven development** was starting to look real. I wanted to try it myself - not as a vibecoder, but as someone who normally prefers supervised, human-crafted coding with AI as a helper.

AI is excellent for prototyping, validating ideas, and **replicating existing software behavior**. That's exactly what this project is: take library A, produce library B, and let the loops reverse-engineer how.

## How it was built

1. **Fable** - bootstrapped the AI loop workflow (`ai/`), collected context, set up the spec and backlog.
2. **Codex** - planned the converter logic and business rules; asked clarifying questions along the way.
3. **Opus 4.8** - reviewed the plan and verified everything was ready for loop runs.
4. **Fable** - reverse-engineered the core conversion for the first playlists against a golden reference.
5. **OpenCode** - polished the remaining playlists that didn't convert cleanly.
6. **Composer 2.5** - built the simple UI on top.

The loop protocol lives in `ai/LOOP.md`. The target behavior is in `ai/SPEC.md`.

Validated against a golden reference exported by one of the paid converters for two playlists. Built on Node.js with better-sqlite3, fast-xml-parser, and xmlbuilder2.


## Quick start

**Download (macOS)**

Download `EngineBox-1.0.0-arm64.dmg` from `releases/`, open it, and drag EngineBox to Applications.

**CLI**

```bash
node convert.js
```

Output goes to `output/rekordbox.xml`.

**Tests**

```bash
npm test
```

**UI** (optional - React + local server)

```bash
npm install
npm run dev
```

Opens the UI at `http://localhost:8787`.

**Desktop app** (macOS)

```bash
npm run electron:dev
```

## Caveats

- Personal project, built for my own library paths and playlists.
- Replicates paid conversion behavior for a specific fixture - not a general-purpose Engine → Rekordbox tool.
- Beat-grid `TEMPO` data is not emitted (see `ai/SPEC.md` for why).
- Use at your own risk. Back up your library before importing anything into Rekordbox.

## License

Private / personal use. No warranty.
