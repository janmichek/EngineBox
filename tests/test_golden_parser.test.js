import { describe, it, expect, beforeAll } from 'vitest';
import { parseGoldenXml } from '../converter/golden_parser.js';

describe('Golden XML parser', () => {
  let model;

  beforeAll(() => {
    model = parseGoldenXml('databases/rekordbox.xml');
  });

  it('product info', () => {
    expect(model.product_name).toBe('MIXO');
    expect(model.product_version).toBe('0.0.1');
    expect(model.product_company).toBe('MIXO');
  });

  it('collection entries', () => {
    expect(model.collection_entries).toBe(293);
  });

  it('track count', () => {
    expect(model.tracks.length).toBe(293);
  });

  it('first track', () => {
    const track = model.tracks[0];
    expect(track.track_id).toBe(0);
    expect(track.name).toBe('Finish Line (Original Mix)');
    expect(track.artist).toBe('wes mills');
    expect(track.album).toBe('Finish Line');
    expect(track.genre).toBe('House');
    expect(track.kind).toBe('mp3');
    expect(track.location).toContain('wes%20mills');
    expect(track.size).toBe(7389357);
    expect(track.total_time).toBeCloseTo(141.176, 3);
    expect(track.track_number).toBe(1);
    expect(track.year).toBe(2023);
    expect(track.average_bpm).toBeCloseTo(136.000, 3);
    expect(track.bit_rate).toBe(320);
    expect(track.tonality).toBe('5d');
    expect(track.label).toBe('bitbird');
    expect(track.sample_rate).toBe(44100);
  });

  it('first track position marks', () => {
    const track = model.tracks[0];
    expect(track.position_marks.length).toBe(4);
    const mark0 = track.position_marks[0];
    expect(mark0.name).toBe('Cue 1');
    expect(mark0.mark_type).toBe(0);
    expect(mark0.start).toBeCloseTo(0.042, 3);
    expect(mark0.num).toBe(0);
    expect(mark0.red).toBe(244);
    expect(mark0.green).toBe(211);
    expect(mark0.blue).toBe(56);
    expect(mark0.end).toBeNull();
  });

  it('first track tempo', () => {
    const track = model.tracks[0];
    expect(track.tempo).not.toBeNull();
    expect(track.tempo.inizio).toBeCloseTo(0.037, 3);
    expect(track.tempo.bpm).toBeCloseTo(136.00, 2);
    expect(track.tempo.metro).toBe('4/4');
    expect(track.tempo.battito).toBe(1);
  });

  it('track with loop', () => {
    let trackWithLoop = null;
    for (const track of model.tracks) {
      for (const mark of track.position_marks) {
        if (mark.mark_type === 4) {
          trackWithLoop = track;
          break;
        }
      }
      if (trackWithLoop) break;
    }
    expect(trackWithLoop).not.toBeNull();
    const loopMark = trackWithLoop.position_marks.find(m => m.mark_type === 4);
    expect(loopMark.name).toBe('Loop 1');
    expect(loopMark.end).not.toBeNull();
  });

  it('playlist count', () => {
    expect(model.playlists.length).toBe(2);
  });

  it('playlist names', () => {
    const names = model.playlists.map(p => p.name);
    expect(names).toEqual(['KVIFF 2026', 'DŇB']);
  });

  it('playlist entries', () => {
    const kviff = model.playlists[0];
    expect(kviff.entries).toBe(178);
    expect(kviff.track_keys.length).toBe(178);

    const dnb = model.playlists[1];
    expect(dnb.entries).toBe(115);
    expect(dnb.track_keys.length).toBe(115);
  });

  it('total position marks', () => {
    const totalMarks = model.tracks.reduce((sum, t) => sum + t.position_marks.length, 0);
    expect(totalMarks).toBe(1060);
  });

  it('all tracks have tempo', () => {
    for (const track of model.tracks) {
      expect(track.tempo).not.toBeNull();
    }
  });

  it('all tracks have location starting with file://localhost/', () => {
    for (const track of model.tracks) {
      expect(track.location).toMatch(/^file:\/\//);
    }
  });
});
