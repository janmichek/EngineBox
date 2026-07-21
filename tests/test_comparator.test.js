import { describe, it, expect, beforeAll } from 'vitest';
import { parseGoldenXml } from '../converter/golden_parser.js';
import { compareModels } from '../converter/comparator.js';

describe('Comparator', () => {
  let model;

  beforeAll(() => {
    model = parseGoldenXml('databases/rekordbox.xml');
  });

  it('identical models pass', () => {
    const result = compareModels(model, model);
    expect(result.ok).toBe(true);
    expect(result.summary()).toBe('Models are identical.');
  });

  it('different track name detected', () => {
    const other = parseGoldenXml('databases/rekordbox.xml');
    other.tracks[0].name = 'WRONG NAME';
    const result = compareModels(model, other);
    expect(result.ok).toBe(false);
    expect(result.mismatches[0]).toContain('Name');
  });

  it('different track total time detected', () => {
    const other = parseGoldenXml('databases/rekordbox.xml');
    other.tracks[0].total_time = 999.999;
    const result = compareModels(model, other);
    expect(result.ok).toBe(false);
    expect(result.mismatches[0]).toContain('TotalTime');
  });

  it('different tempo detected', () => {
    const other = parseGoldenXml('databases/rekordbox.xml');
    other.tracks[0].tempo.bpm = 999.0;
    const result = compareModels(model, other);
    expect(result.ok).toBe(false);
    expect(result.mismatches[0]).toContain('Bpm');
  });

  it('different cue start detected', () => {
    const other = parseGoldenXml('databases/rekordbox.xml');
    other.tracks[0].position_marks[0].start = 999.0;
    const result = compareModels(model, other);
    expect(result.ok).toBe(false);
    expect(result.mismatches[0]).toContain('Start');
  });

  it('different cue color detected', () => {
    const other = parseGoldenXml('databases/rekordbox.xml');
    other.tracks[0].position_marks[0].red = 0;
    const result = compareModels(model, other);
    expect(result.ok).toBe(false);
    expect(result.mismatches[0]).toContain('Red');
  });

  it('different collection count detected', () => {
    const other = parseGoldenXml('databases/rekordbox.xml');
    other.collection_entries = 999;
    const result = compareModels(model, other);
    expect(result.ok).toBe(false);
    expect(result.mismatches[0]).toContain('Entries');
  });

  it('different playlist name detected', () => {
    const other = parseGoldenXml('databases/rekordbox.xml');
    other.playlists[0].name = 'WRONG PLAYLIST';
    const result = compareModels(model, other);
    expect(result.ok).toBe(false);
    expect(result.mismatches[0]).toContain('Name');
  });

  it('different playlist entries detected', () => {
    const other = parseGoldenXml('databases/rekordbox.xml');
    other.playlists[0].entries = 999;
    const result = compareModels(model, other);
    expect(result.ok).toBe(false);
    expect(result.mismatches[0]).toContain('Entries');
  });

  it('missing tempo detected', () => {
    const other = parseGoldenXml('databases/rekordbox.xml');
    other.tracks[0].tempo = null;
    const result = compareModels(model, other);
    expect(result.ok).toBe(false);
    expect(result.mismatches[0]).toContain('missing TEMPO');
  });

  it('multiple mismatches detected', () => {
    const other = parseGoldenXml('databases/rekordbox.xml');
    other.tracks[0].name = 'WRONG';
    other.tracks[0].total_time = 0.0;
    other.tracks[0].tempo.bpm = 1.0;
    const result = compareModels(model, other);
    expect(result.mismatches.length).toBeGreaterThan(2);
  });
});
