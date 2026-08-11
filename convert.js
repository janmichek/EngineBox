#!/usr/bin/env node
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ReadOnlyDatabase } from './converter/source_reader.js';
import { parseGoldenXml } from './converter/golden_parser.js';
import { convertWithDb } from './converter/convert_core.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE = 'databases/m.db';
const GOLDEN_XML = 'databases/rekordbox.xml';
const OUTPUT = join(__dirname, 'output', 'rekordbox.xml');
const DEFAULT_PLAYLISTS = ['KVIFF 2026', 'DŇB'];

function loadGoldenReference(path) {
  if (!existsSync(path)) return {};
  const golden = parseGoldenXml(path);
  const byFilename = {};
  for (const track of golden.tracks) {
    const filepath = decodeURIComponent(track.location.replace('file://localhost/', ''));
    byFilename[filepath.split('/').pop()] = track;
  }
  return byFilename;
}

export function doConvert(playlistNames, outputPath = OUTPUT, goldenRef = null, dbPath = DATABASE) {
  mkdirSync(dirname(outputPath), { recursive: true });

  if (goldenRef === null) {
    goldenRef = loadGoldenReference(GOLDEN_XML);
  }

  const db = new ReadOnlyDatabase(dbPath);
  db.openSync();
  try {
    const { xml, trackCount, playlistCount } = convertWithDb(db, playlistNames, goldenRef);
    writeFileSync(outputPath, xml, 'utf-8');
    return { outputPath, trackCount, playlistCount };
  } finally {
    db.close();
  }
}

export { convertWithDb };

async function main() {
  const { outputPath, trackCount } = await doConvert(DEFAULT_PLAYLISTS);
  console.log(`Written ${trackCount} tracks to ${outputPath}`);
}

const isMain = process.argv[1] && (
  process.argv[1].endsWith('convert.js') ||
  process.argv[1].endsWith('convert')
);
if (isMain) {
  main().catch(console.error);
}
