import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { parseGoldenXml } from '../converter/golden_parser.js';

describe('Smoke tests', () => {
  it('can open database read-only', () => {
    const db = new Database('databases/m.db', { readonly: true, fileMustExist: true });
    const row = db.pragma('schema_version', { simple: true });
    expect(row).toBeGreaterThan(0);
    db.close();
  });

  it('can parse golden XML', () => {
    const model = parseGoldenXml('databases/rekordbox.xml');
    expect(model.product_name).toBe('MIXO');
    expect(model.tracks.length).toBeGreaterThan(0);
  });
});
