import { describe, it, expect } from 'vitest';
import { ReadOnlyDatabase } from '../converter/source_reader.js';
import { convertWithDb } from '../converter/convert_core.js';
import { parseGoldenXml } from '../converter/golden_parser.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

describe('convert_core', () => {
  it('produces valid XML without golden reference', () => {
    const db = new ReadOnlyDatabase('databases/m.db');
    db.openSync();
    try {
      const { xml, trackCount, playlistCount } = convertWithDb(
        db,
        ['KVIFF 2026', 'DŇB'],
        {}
      );
      expect(trackCount).toBe(293);
      expect(playlistCount).toBe(2);
      expect(xml).toContain('<DJ_PLAYLISTS');
      expect(xml).toContain('Name="KVIFF 2026"');
      expect(xml).toContain('Name="DŇB"');
      expect(xml).not.toContain('<TEMPO');

      mkdirSync('output', { recursive: true });
      const path = join('output', 'test_core.xml');
      writeFileSync(path, xml);
      const model = parseGoldenXml(path);
      expect(model.tracks.length).toBe(293);
      expect(model.tracks.every(t => t.tempo === null)).toBe(true);
      expect(model.tracks[0].position_marks.length).toBeGreaterThan(0);
    } finally {
      db.close();
    }
  });
});
