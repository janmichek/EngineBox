# Agent Instructions — convertor

This project is built via **AI loop-driven development**: any coding agent (Cursor, Claude Code, Codex, Aider, ...) is run repeatedly with the same loop prompt, making one small verified increment per iteration.

Goal: replicate the in-scope behavior of MIXO's Engine OS to Rekordbox XML conversion. The target behavior is documented in `ai/SPEC.md`, fed by findings in `ai/RESEARCH.md`.

## How to work in this repo

1. Read `ai/LOOP.md` — it is the loop protocol. Follow it every iteration.
2. Source of truth for *what* to build: `ai/SPEC.md`. Never invent requirements; if the spec is unclear, add a question to `ai/RESEARCH.md` instead of guessing.
3. Source of truth for *what's next*: `ai/BACKLOG.md`. Work strictly top-down, one task per iteration.
4. Record every iteration in `ai/PROGRESS.md` (append-only). Record irreversible choices in `ai/DECISIONS.md`.

## Rules

- One task per loop iteration. Small, complete, verified.
- Start only from a clean working tree with an existing baseline commit. If either condition is false, stop without changing files.
- Every change must leave the repo in a working state (`npm test` passes).
- Do not rewrite or reorder other tasks in the backlog beyond marking yours done and adding newly discovered tasks at the appropriate priority.
- Do not edit past entries in `ai/PROGRESS.md` or `ai/DECISIONS.md`.
- Commit at the end of each iteration with message: `loop: <task summary>`.
- Treat `databases/` as immutable input. Never edit, overwrite, stage, or commit anything in it.
- Open `databases/m.db` using SQLite read-only URI mode. Generated files belong in `output/`.
- Never use `git add -A` or `git add .`; stage only files intentionally changed by the current loop.
- Select the two playlists by their exact hardcoded names, not by fixture-specific database IDs.
- Golden comparison is exact for all information, including cue, duration, and tempo values. XML formatting alone may differ; numeric tolerances are forbidden.

## Project conventions

- Runtime: Node.js standard library unless a backlog task explicitly justifies a dependency.
- Conversion helper: `convert.js`. HTTP server + UI: `server.js`.
- Tests: `npm test`.
- Full golden comparison: run integration tests when local reference files exist.
