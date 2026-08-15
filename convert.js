import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ReadOnlyDatabase } from './converter/source_reader.js';
import { convertWithDb } from './converter/convert_core.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE = 'databases/m.db';
const OUTPUT = join(__dirname, 'output', 'rekordbox.xml');

export function doConvert(playlistNames, outputPath = OUTPUT, goldenRef = {}, dbPath = DATABASE) {
  mkdirSync(dirname(outputPath), { recursive: true });

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
