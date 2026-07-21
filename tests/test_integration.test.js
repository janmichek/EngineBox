import { describe, it, expect, beforeAll } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import { doConvert } from '../convert.js';
import { parseGoldenXml, GoldenModel, Playlist } from '../converter/golden_parser.js';
import { compareModels } from '../converter/comparator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');
const TEST_OUTPUT = join(OUTPUT_DIR, 'test_integration.xml');

describe('Integration', () => {
  beforeAll(() => {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  });

  it('convert produces valid output matching golden reference', () => {
    const { outputPath, trackCount, playlistCount } = doConvert(
      ['KVIFF 2026', 'DŇB'],
      TEST_OUTPUT,
      null,
      'databases/m.db'
    );

    expect(existsSync(outputPath)).toBe(true);
    expect(trackCount).toBe(293);
    expect(playlistCount).toBe(2);

    const generated = parseGoldenXml(outputPath);
    const golden = parseGoldenXml('databases/rekordbox.xml');

    const result = compareModels(golden, generated);
    expect(result.ok).toBe(true);
  });
});
