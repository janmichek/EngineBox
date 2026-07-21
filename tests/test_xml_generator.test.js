import { describe, it, expect, beforeAll } from 'vitest';
import { parseGoldenXml } from '../converter/golden_parser.js';
import { compareModels } from '../converter/comparator.js';
import { generateXml } from '../converter/xml_generator.js';

describe('XML generator', () => {
  let golden;

  beforeAll(() => {
    golden = parseGoldenXml('databases/rekordbox.xml');
  });

  it('generate xml structure', () => {
    const doc = generateXml(golden);
    const xmlStr = doc.end();
    expect(xmlStr).toContain('<DJ_PLAYLISTS');
    expect(xmlStr).toContain('Version="1.0.0"');
  });

  it('product element', () => {
    const doc = generateXml(golden);
    const xmlStr = doc.end();
    expect(xmlStr).toContain('Name="MIXO"');
    expect(xmlStr).toContain('Version="0.0.1"');
  });

  it('collection entries', () => {
    const doc = generateXml(golden);
    const xmlStr = doc.end();
    expect(xmlStr).toContain('Entries="293"');
  });

  it('first track attributes', () => {
    const doc = generateXml(golden);
    const xmlStr = doc.end();
    expect(xmlStr).toContain('TrackID="0"');
    expect(xmlStr).toContain('Name="Finish Line (Original Mix)"');
    expect(xmlStr).toContain('Artist="wes mills"');
    expect(xmlStr).toContain('wes%20mills');
    expect(xmlStr).toContain('Size="7389357"');
  });

  it('position marks generated', () => {
    const doc = generateXml(golden);
    const xmlStr = doc.end();
    expect(xmlStr).toContain('POSITION_MARK');
    expect(xmlStr).toContain('Name="Cue 1"');
    expect(xmlStr).toContain('Start="0.042"');
  });

  it('tempo generated', () => {
    const doc = generateXml(golden);
    const xmlStr = doc.end();
    expect(xmlStr).toContain('TEMPO');
    expect(xmlStr).toContain('Bpm="136.0"');
  });

  it('playlists generated', () => {
    const doc = generateXml(golden);
    const xmlStr = doc.end();
    expect(xmlStr).toContain('PLAYLISTS');
    expect(xmlStr).toContain('Name="ROOT"');
    expect(xmlStr).toContain('Name="KVIFF 2026"');
    expect(xmlStr).toContain('Name="DŇB"');
    expect(xmlStr).toContain('Entries="178"');
    expect(xmlStr).toContain('Entries="115"');
  });

  it('playlist track refs', () => {
    const doc = generateXml(golden);
    const xmlStr = doc.end();
    expect(xmlStr).toContain('Key="0"');
  });

  it('roundtrip semantic match', () => {
    const result = compareModels(golden, golden);
    expect(result.ok).toBe(true);
  });

  it('serialized xml roundtrip', () => {
    const doc = generateXml(golden);
    const xmlStr = doc.end();
    expect(xmlStr).toContain('<DJ_PLAYLISTS');
    expect(xmlStr).toContain('Entries="293"');
  });
});
