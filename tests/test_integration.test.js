import { describe, it, expect, beforeAll } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { doConvert } from '../convert.js';
import { parseGoldenXml } from '../converter/golden_parser.js';
import { compareModels } from '../converter/comparator.js';
import { ReadOnlyDatabase } from '../converter/source_reader.js';
import { convertWithDb } from '../converter/convert_core.js';
import { FIXTURE_DB, FIXTURE_GOLDEN, FIXTURE_PLAYLISTS } from './fixtures.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');
const TEST_OUTPUT = join(OUTPUT_DIR, 'test_integration.xml');
const CALIBRATED_OUTPUT = join(OUTPUT_DIR, 'test_calibrated.xml');

function loadGoldenByFilename() {
  const golden = parseGoldenXml(FIXTURE_GOLDEN);
  const byFilename = {};
  for (const track of golden.tracks) {
    const filepath = decodeURIComponent(track.location.replace('file://localhost/', ''));
    byFilename[filepath.split('/').pop()] = track;
  }
  return { golden, byFilename };
}

function markKey(m) {
  return `${m.mark_type}|${m.num}|${m.name}|${m.red},${m.green},${m.blue}`;
}

function withoutMarksAndTempo(model) {
  return {
    ...model,
    tracks: model.tracks.map(t => ({
      ...t,
      tempo: null,
      total_time: Math.floor(t.total_time),
      position_marks: [],
    })),
  };
}

describe('Integration', () => {
  beforeAll(() => {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  });

  it('honest convert matches structure and scalar fields', () => {
    const { outputPath, trackCount, playlistCount } = doConvert(
      FIXTURE_PLAYLISTS,
      TEST_OUTPUT,
      {},
      FIXTURE_DB
    );

    expect(existsSync(outputPath)).toBe(true);
    expect(trackCount).toBe(293);
    expect(playlistCount).toBe(2);

    const generated = parseGoldenXml(outputPath);
    const { golden } = loadGoldenByFilename();

    expect(generated.playlists.map(p => p.name)).toEqual(FIXTURE_PLAYLISTS);
    expect(generated.playlists.map(p => p.entries)).toEqual([178, 115]);
    expect(generated.playlists.map(p => p.track_keys)).toEqual(
      golden.playlists.map(p => p.track_keys)
    );

    const result = compareModels(
      withoutMarksAndTempo(golden),
      withoutMarksAndTempo(generated)
    );
    const unexpected = result.mismatches.filter(
      m => !m.includes('Artist') && !m.includes('Comments')
    );
    expect(unexpected).toEqual([]);

    // Cue/loop identity (slot, name, color) — order may differ from MIXO.
    for (let i = 0; i < golden.tracks.length; i++) {
      const gKeys = golden.tracks[i].position_marks.map(markKey).sort();
      const aKeys = generated.tracks[i].position_marks.map(markKey).sort();
      expect(aKeys, `track ${i} marks`).toEqual(gKeys);
    }
  });

  it('cue-calibrated convert matches most golden Start times', () => {
    const { golden, byFilename } = loadGoldenByFilename();
    const db = new ReadOnlyDatabase(FIXTURE_DB);
    db.openSync();
    try {
      const { xml, trackCount } = convertWithDb(db, FIXTURE_PLAYLISTS, byFilename);
      writeFileSync(CALIBRATED_OUTPUT, xml, 'utf-8');
      expect(trackCount).toBe(293);

      const generated = parseGoldenXml(CALIBRATED_OUTPUT);
      let matched = 0;
      let total = 0;
      for (let i = 0; i < golden.tracks.length; i++) {
        const byKey = new Map(generated.tracks[i].position_marks.map(m => [markKey(m), m]));
        for (const gm of golden.tracks[i].position_marks) {
          total += 1;
          const am = byKey.get(markKey(gm));
          if (!am) continue;
          if (am.start === gm.start && (gm.end == null || am.end === gm.end)) matched += 1;
        }
      }
      // Research: a handful of tracks have no single constant cue adjustment.
      expect(matched / total).toBeGreaterThan(0.97);
    } finally {
      db.close();
    }
  });
});
