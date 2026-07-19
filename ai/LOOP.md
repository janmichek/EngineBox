# Loop Protocol

This is the prompt to give any agent, every iteration. It is agent-agnostic: no tool-specific features, only files and shell commands.

---

## The loop prompt (copy-paste this to your agent)

> Read `AGENTS.md`, then `ai/SPEC.md`, `ai/BACKLOG.md`, and the last 3 entries of `ai/PROGRESS.md`. Execute exactly ONE iteration of the loop protocol in `ai/LOOP.md`, then stop.

## One iteration

1. **Preflight** — Before changing anything:
   - Confirm `git rev-parse --verify HEAD` succeeds; a human-created baseline commit is required.
   - Confirm `git status --porcelain` is empty. Never absorb or commit pre-existing changes.
   - Record SHA-256 hashes of `databases/m.db` and `databases/rekordbox.xml`.
2. **Orient** — Read `ai/SPEC.md` (what to build), `ai/BACKLOG.md` (what's next), last entries of `ai/PROGRESS.md` (what just happened), and relevant findings in `ai/RESEARCH.md`.
3. **Pick** — Take the topmost unchecked task in `ai/BACKLOG.md`. If it is too big to finish in one iteration, split it in place and take only the first piece.
4. **Verify first** — Run `python3 -m unittest discover -s tests` before changing anything. If it fails, restoring the green baseline is the only task for this iteration. If tests do not exist yet, only the backlog task that creates them may proceed.
5. **Implement** — Do the task. Write or update tests that prove it works. Characterization tasks must turn golden-file observations into explicit assertions; do not guess or add tolerances.
6. **Verify after** —
   - `python3 -m unittest discover -s tests` must pass.
   - Run the exact semantic golden comparison when relevant.
   - Recompute both reference-file SHA-256 hashes and require exact equality with preflight.
   - Inspect `git diff` and `git status` for unrelated changes.
7. **Record** —
   - Check the task off in `ai/BACKLOG.md`; add any newly discovered tasks.
   - Append an entry to `ai/PROGRESS.md` (template below).
   - If you made a non-obvious irreversible choice, append it to `ai/DECISIONS.md`.
   - If you learned something new about the target convertor's behavior, update `ai/RESEARCH.md` and, if confirmed, `ai/SPEC.md`.
8. **Commit** — Stage only files changed for this task by explicit path. Inspect `git diff --cached`; then commit with `git commit -m "loop: <task summary>"`. Never use `git add -A` or `git add .`.
9. **Postflight** — Require a clean working tree and stop. Do not start the next task.

## PROGRESS.md entry template

```
## <ISO date+time> — <task summary>
- Did: <what changed, files touched>
- Verified: <how — test names, manual run output>
- Next: <topmost remaining backlog task>
- Blocked/Notes: <open questions, surprises, or "-">
```

## Failure rules

- If the task is blocked by missing evidence or verification cannot be made green, revert only implementation files changed in this iteration, leave the backlog task unchecked, append the evidence and blocker to `ai/PROGRESS.md`, and commit only that record as `loop: blocked - <reason>`. The runner treats this subject as a stop signal.
- Never use a repository-wide revert because unrelated user changes may exist.
- Never leave the loop with a red build.
- If either reference-file hash changes, stop immediately and report it. Do not commit or attempt an automatic repair.
