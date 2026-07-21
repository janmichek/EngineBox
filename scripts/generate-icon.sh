#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SVG="$ROOT/public/favicon.svg"
OUT="$ROOT/electron/icon.icns"
TMP="$(mktemp -d)"
ICONSET="$TMP/icon.iconset"

cleanup() {
  rm -rf "$TMP"
}
trap cleanup EXIT

mkdir -p "$ICONSET"

npx --yes @resvg/resvg-js-cli --fit-width 1024 --fit-height 1024 "$SVG" "$TMP/icon-1024.png" >/dev/null

for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$TMP/icon-1024.png" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  sips -z "$((size * 2))" "$((size * 2))" "$TMP/icon-1024.png" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done

iconutil -c icns "$ICONSET" -o "$OUT"
echo "Generated $OUT from $SVG"
