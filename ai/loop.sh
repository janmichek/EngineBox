#!/usr/bin/env bash
# Agent-agnostic loop runner.
# Usage: ./ai/loop.sh <iterations> <agent command that accepts prompt as final argument>
# Examples:
#   ./ai/loop.sh 5 cursor-agent -p
#   ./ai/loop.sh 3 claude -p
#   ./ai/loop.sh 1 codex exec
set -euo pipefail

ITERATIONS="${1:?usage: ./ai/loop.sh <iterations> <agent command...>}"
shift
[ "$#" -ge 1 ] || { echo "usage: ./ai/loop.sh <iterations> <agent command...>" >&2; exit 1; }

PROMPT='Read AGENTS.md, then ai/SPEC.md, ai/BACKLOG.md, and the last 3 entries of ai/PROGRESS.md. Execute exactly ONE iteration of the loop protocol in ai/LOOP.md, then stop.'
REFERENCES=(databases/m.db databases/rekordbox.xml)

git rev-parse --verify HEAD >/dev/null 2>&1 || {
  echo "error: create a baseline commit before running loops" >&2
  exit 1
}

[ -z "$(git status --porcelain)" ] || {
  echo "error: working tree must be clean before running loops" >&2
  exit 1
}

for reference in "${REFERENCES[@]}"; do
  [ -f "$reference" ] || {
    echo "error: missing immutable reference: $reference" >&2
    exit 1
  }
done

for i in $(seq 1 "$ITERATIONS"); do
  [ -z "$(git status --porcelain)" ] || {
    echo "error: iteration $i started with a dirty working tree" >&2
    exit 1
  }

  before_commit="$(git rev-parse HEAD)"
  before_hashes="$(shasum -a 256 "${REFERENCES[@]}")"

  echo "=== loop iteration $i/$ITERATIONS ==="
  "$@" "$PROMPT"

  after_hashes="$(shasum -a 256 "${REFERENCES[@]}")"
  [ "$before_hashes" = "$after_hashes" ] || {
    echo "error: an immutable reference changed; stopping immediately" >&2
    exit 1
  }

  [ -z "$(git status --porcelain)" ] || {
    echo "error: agent left a dirty working tree after iteration $i" >&2
    exit 1
  }

  after_commit="$(git rev-parse HEAD)"
  [ "$before_commit" != "$after_commit" ] || {
    echo "error: iteration $i created no commit; stopping" >&2
    exit 1
  }

  commit_count="$(git rev-list --count "$before_commit..$after_commit")"
  [ "$commit_count" = "1" ] || {
    echo "error: iteration $i must create exactly one commit" >&2
    exit 1
  }

  echo "=== iteration $i done ==="

  case "$(git log -1 --format=%s)" in
    "loop: blocked -"*)
      echo "=== loop blocked; stopping before next iteration ==="
      exit 2
      ;;
  esac
done
