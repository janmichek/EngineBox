import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { parseGoldenXml } from '../converter/golden_parser.js';
import { loadPlaylists } from '../converter/playlist.js';
import { ReadOnlyDatabase } from '../converter/source_reader.js';
import {
  KEY_MAP, mapLocation, mapComment, mapKey,
  decodeBeatData, loadTrack, loadPerformanceData,
  decodeQuickCues, decodeTrackDataSampleRate,
  findCueAdjustment, computeCueMarks, decodeLoops, computeLoopMarks,
} from '../converter/track.js';

const PLAYLIST_NAMES = ['KVIFF 2026', 'DŇB'];

function filenameFromLocation(location) {
  const path = decodeURIComponent(location.replace('file://localhost/', ''));
  return path.split('/').pop();
}

describe('Track module', () => {
  let db;
  let golden;
  let goldenByFilename = {};
  let goldenMarksByFilename = {};
  let allIds = [];

  beforeAll(() => {
    db = new ReadOnlyDatabase('databases/m.db');
    db.openSync();
    golden = parseGoldenXml('databases/rekordbox.xml');

    // Parse golden XML directly to get raw attributes
    const xml = readFileSync('databases/rekordbox.xml', 'utf-8');
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      allowBooleanAttributes: true,
      ignoreDeclaration: true,
      isArray: (name) => name === 'TRACK' || name === 'POSITION_MARK',
    });
    const doc = parser.parse(xml);
    const tracks = doc.DJ_PLAYLISTS.COLLECTION.TRACK || [];
    for (const t of tracks) {
      const filename = filenameFromLocation(t['@_Location']);
      goldenByFilename[filename] = t;
      goldenMarksByFilename[filename] = t.POSITION_MARK || [];
    }

    const playlists = loadPlaylists(db, PLAYLIST_NAMES);
    allIds = [...new Set(playlists.flatMap(pl => pl.track_ids))];
  });

  afterAll(() => {
    db.close();
  });

  it('key map complete', () => {
    expect(Object.keys(KEY_MAP).length).toBe(25);
    expect(KEY_MAP[0]).toBe('1d');
    expect(KEY_MAP[1]).toBe('1m');
    expect(KEY_MAP[3]).toBe('2m');
    expect(KEY_MAP[22]).toBe('12d');
    expect(KEY_MAP[23]).toBe('12m');
  });

  it('map location', () => {
    const result = mapLocation('../../MUSIS/FAVORIT/test.mp3');
    expect(result).toBe('file://localhost/Users/yeahboi/MUSIS/FAVORIT/test.mp3');
  });

  it('map location url encoding', () => {
    const result = mapLocation('../../MUSIS/FAVORIT/wes mills - finish line (Original Mix).mp3');
    expect(result).toContain('wes%20mills');
    expect(result).toMatch(/^file:\/\//);
  });

  it('map comment none', () => {
    expect(mapComment(null)).toBeNull();
  });

  it('map comment passthrough', () => {
    expect(mapComment('Purchased at Beatport')).toBe('Purchased at Beatport');
  });

  it('map comment newlines stripped', () => {
    const result = mapComment('Line 1\nLine 2\r\nLine 3');
    expect(result).toBe('Line 1Line 2Line 3');
  });

  it('map comment truncation', () => {
    const longComment = 'A'.repeat(300);
    const result = mapComment(longComment);
    expect(result.length).toBe(247);
  });

  it('decode beat data', () => {
    const rows = db.query(
      'SELECT beatData FROM PerformanceData WHERE trackId = 8490'
    );
    const result = decodeBeatData(rows[0].beatData);
    expect(result).toBeCloseTo(263.0, 0);
  });

  it('load track basic', () => {
    const data = loadTrack(db, 8490);
    expect(data.title).toBe('Buggin (Original Mix)');
    expect(data.artist).toBe('Gemi');
    expect(data.fileType).toBe('mp3');
    expect(data.fileBytes).toBe(10841320);
  });

  it('all scalar attributes match golden', () => {
    const mismatches = [];
    const knownArtistExceptions = new Set([12952, 15741, 22447]);

    for (const tid of allIds) {
      const data = loadTrack(db, tid);
      const filename = data.filename;
      if (!goldenByFilename[filename]) {
        mismatches.push(`Track ${tid}: filename ${filename} not in golden`);
        continue;
      }
      const g = goldenByFilename[filename];

      if (data.title !== g['@_Name']) {
        mismatches.push(`Track ${tid}: Name ${JSON.stringify(data.title)} != ${JSON.stringify(g['@_Name'])}`);
      }
      const dbArtist = data.artist ?? null;
      const xmlArtist = g['@_Artist'] ?? null;
      if (dbArtist !== xmlArtist && !knownArtistExceptions.has(tid)) {
        mismatches.push(`Track ${tid}: Artist ${JSON.stringify(dbArtist)} != ${JSON.stringify(xmlArtist)}`);
      }
      const dbAlbum = data.album ?? null;
      const xmlAlbum = g['@_Album'] ?? null;
      if (dbAlbum !== xmlAlbum) {
        mismatches.push(`Track ${tid}: Album ${JSON.stringify(dbAlbum)} != ${JSON.stringify(xmlAlbum)}`);
      }
      const dbGenre = data.genre ?? null;
      const xmlGenre = g['@_Genre'] ?? null;
      if (dbGenre !== xmlGenre) {
        mismatches.push(`Track ${tid}: Genre ${JSON.stringify(dbGenre)} != ${JSON.stringify(xmlGenre)}`);
      }
      if (data.fileType !== g['@_Kind']) {
        mismatches.push(`Track ${tid}: Kind ${JSON.stringify(data.fileType)} != ${JSON.stringify(g['@_Kind'])}`);
      }
      if (data.fileBytes !== parseInt(g['@_Size'] || '0', 10)) {
        mismatches.push(`Track ${tid}: Size ${data.fileBytes} != ${g['@_Size']}`);
      }
      if (data.year !== null && String(data.year) !== (g['@_Year'] || '')) {
        mismatches.push(`Track ${tid}: Year ${data.year} != ${g['@_Year']}`);
      }
      if (data.bpmAnalyzed !== null) {
        const goldenBpm = g['@_AverageBpm'] || '';
        if (goldenBpm) {
          expect(data.bpmAnalyzed).toBeCloseTo(parseFloat(goldenBpm), 1);
        }
      }
      if (data.bitrate !== null && g['@_BitRate']) {
        expect(data.bitrate).toBe(parseInt(g['@_BitRate'], 10));
      }
    }

    expect(mismatches.length).toBe(0);
  });

  it('location matches golden all tracks', () => {
    const mismatches = [];
    for (const tid of allIds) {
      const data = loadTrack(db, tid);
      const filename = data.filename;
      if (!goldenByFilename[filename]) continue;
      const computedLoc = mapLocation(data.path);
      const goldenLoc = goldenByFilename[filename]['@_Location'];
      if (computedLoc !== goldenLoc) {
        mismatches.push(
          `Track ${tid}: computed=${computedLoc.substring(0, 60)}, golden=${goldenLoc.substring(0, 60)}`
        );
      }
    }
    expect(mismatches.length).toBe(0);
  });

  it('key mapping all tracks', () => {
    const mismatches = [];
    for (const tid of allIds) {
      const data = loadTrack(db, tid);
      const computedKey = mapKey(data.key);
      const filename = data.filename;
      if (!goldenByFilename[filename]) continue;
      const goldenTonality = goldenByFilename[filename]['@_Tonality'] || null;
      if (computedKey !== goldenTonality) {
        mismatches.push(
          `Track ${tid}: key=${data.key}, computed=${JSON.stringify(computedKey)}, golden=${JSON.stringify(goldenTonality)}`
        );
      }
    }
    expect(mismatches.length).toBe(0);
  });

  it('decode quick cues labels and colors all tracks', () => {
    const nameMismatches = [];
    const colorMismatches = [];
    const countMismatches = [];

    for (const tid of allIds) {
      const data = loadTrack(db, tid);
      const filename = data.filename;
      if (!goldenMarksByFilename[filename]) continue;
      const goldenMarks = goldenMarksByFilename[filename];
      const perf = loadPerformanceData(db, tid);
      if (!perf || !perf.quickCues) continue;

      const sourceCues = decodeQuickCues(perf.quickCues);
      const goldenCueMarks = (Array.isArray(goldenMarks) ? goldenMarks : [goldenMarks]).filter(
        m => m['@_Type'] === '0'
      );
      if (sourceCues.length !== goldenCueMarks.length) {
        const hasLoop = (Array.isArray(goldenMarks) ? goldenMarks : [goldenMarks]).some(
          m => m['@_Type'] === '4'
        );
        if (hasLoop) continue;
        countMismatches.push(
          `Track ${tid}: source=${sourceCues.length}, golden_cues=${goldenCueMarks.length}`
        );
      }

      for (let j = 0; j < sourceCues.length; j++) {
        if (j < goldenCueMarks.length) {
          const gm = goldenCueMarks[j];
          if (sourceCues[j].label !== gm['@_Name']) {
            nameMismatches.push(
              `Track ${tid}, cue ${j}: ${JSON.stringify(sourceCues[j].label)} != ${JSON.stringify(gm['@_Name'])}`
            );
          }
          if (
            sourceCues[j].red !== parseInt(gm['@_Red'], 10) ||
            sourceCues[j].green !== parseInt(gm['@_Green'], 10) ||
            sourceCues[j].blue !== parseInt(gm['@_Blue'], 10)
          ) {
            colorMismatches.push(
              `Track ${tid}, cue ${j}: (${sourceCues[j].red},${sourceCues[j].green},${sourceCues[j].blue}) != (${gm['@_Red']},${gm['@_Green']},${gm['@_Blue']})`
            );
          }
        }
      }
    }

    expect(nameMismatches.length).toBe(0);
    expect(colorMismatches.length).toBe(0);
    expect(countMismatches.length).toBe(0);
  });

  it('find cue adjustment exact for known tracks', () => {
    expect(findCueAdjustment([0.12022940362018092], [0.154])).toBeCloseTo(
      0.03377059637981908, 10
    );
    expect(
      findCueAdjustment(
        [0.12022940362018092, 14.889460172834466, 29.658690942086166, 147.81253709587303],
        [0.154, 14.924, 29.693, 147.846]
      )
    ).toBeNull();
  });

  it('compute cue marks match golden', () => {
    const startMismatches = [];
    const numMismatches = [];

    for (const tid of allIds) {
      const data = loadTrack(db, tid);
      const filename = data.filename;
      if (!goldenMarksByFilename[filename]) continue;
      const goldenMarks = goldenMarksByFilename[filename];
      const goldenCueMarks = (Array.isArray(goldenMarks) ? goldenMarks : [goldenMarks]).filter(
        m => m['@_Type'] === '0'
      );
      if (!goldenCueMarks.length) continue;

      const perf = loadPerformanceData(db, tid);
      if (!perf || !perf.quickCues) continue;

      const sourceCues = decodeQuickCues(perf.quickCues);
      if (sourceCues.length !== goldenCueMarks.length) {
        const hasLoop = (Array.isArray(goldenMarks) ? goldenMarks : [goldenMarks]).some(
          m => m['@_Type'] === '4'
        );
        if (hasLoop) continue;
        numMismatches.push(
          `Track ${tid}: source=${sourceCues.length}, golden=${goldenCueMarks.length}`
        );
        continue;
      }

      const goldenStarts = goldenCueMarks.map(m => parseFloat(m['@_Start']));
      const tdSr = decodeTrackDataSampleRate(perf.trackData);
      const rawTimes = sourceCues.map(c => c.position / tdSr);
      const adj = findCueAdjustment(rawTimes, goldenStarts);
      if (adj === null) continue;

      const marks = computeCueMarks(perf.quickCues, perf.trackData, adj);
      for (let j = 0; j < marks.length; j++) {
        if (j < goldenCueMarks.length) {
          const gm = goldenCueMarks[j];
          if (marks[j].start !== parseFloat(gm['@_Start'])) {
            startMismatches.push(
              `Track ${tid}, cue ${j}: start=${marks[j].start} != golden=${gm['@_Start']}`
            );
          }
        }
      }
    }

    expect(numMismatches.length).toBe(0);
    expect(startMismatches.length).toBe(0);
  });

  it('decode loops all tracks', () => {
    const labelMismatches = [];
    const colorMismatches = [];
    const countMismatches = [];

    for (const tid of allIds) {
      const data = loadTrack(db, tid);
      const filename = data.filename;
      if (!goldenMarksByFilename[filename]) continue;
      const goldenMarks = goldenMarksByFilename[filename];
      const goldenLoopMarks = (Array.isArray(goldenMarks) ? goldenMarks : [goldenMarks]).filter(
        m => m['@_Type'] === '4'
      );

      const perf = loadPerformanceData(db, tid);
      if (!perf || !perf.loops) {
        if (goldenLoopMarks.length) {
          countMismatches.push(
            `Track ${tid}: no loops blob but golden has ${goldenLoopMarks.length} loops`
          );
        }
        continue;
      }

      const sourceLoops = decodeLoops(perf.loops);
      if (sourceLoops.length !== goldenLoopMarks.length) {
        countMismatches.push(
          `Track ${tid}: source=${sourceLoops.length}, golden=${goldenLoopMarks.length}`
        );
      }

      for (let j = 0; j < sourceLoops.length; j++) {
        if (j < goldenLoopMarks.length) {
          const gm = goldenLoopMarks[j];
          if (sourceLoops[j].label !== gm['@_Name']) {
            labelMismatches.push(
              `Track ${tid}, loop ${j}: ${JSON.stringify(sourceLoops[j].label)} != ${JSON.stringify(gm['@_Name'])}`
            );
          }
          if (
            sourceLoops[j].red !== parseInt(gm['@_Red'], 10) ||
            sourceLoops[j].green !== parseInt(gm['@_Green'], 10) ||
            sourceLoops[j].blue !== parseInt(gm['@_Blue'], 10)
          ) {
            colorMismatches.push(
              `Track ${tid}, loop ${j}: (${sourceLoops[j].red},${sourceLoops[j].green},${sourceLoops[j].blue}) != (${gm['@_Red']},${gm['@_Green']},${gm['@_Blue']})`
            );
          }
        }
      }
    }

    expect(labelMismatches.length).toBe(0);
    expect(colorMismatches.length).toBe(0);
    expect(countMismatches.length).toBe(0);
  });

  it('compute loop marks match golden', () => {
    const startMismatches = [];
    const endMismatches = [];

    for (const tid of allIds) {
      const data = loadTrack(db, tid);
      const filename = data.filename;
      if (!goldenMarksByFilename[filename]) continue;
      const goldenMarks = goldenMarksByFilename[filename];
      const goldenLoopMarks = (Array.isArray(goldenMarks) ? goldenMarks : [goldenMarks]).filter(
        m => m['@_Type'] === '4'
      );
      const goldenCueMarks = (Array.isArray(goldenMarks) ? goldenMarks : [goldenMarks]).filter(
        m => m['@_Type'] === '0'
      );
      if (!goldenLoopMarks.length) continue;

      const perf = loadPerformanceData(db, tid);
      if (!perf || !perf.loops) continue;

      const sourceCues = decodeQuickCues(perf.quickCues);
      if (sourceCues.length !== goldenCueMarks.length) continue;

      const goldenCueStarts = goldenCueMarks.map(m => parseFloat(m['@_Start']));
      const tdSr = decodeTrackDataSampleRate(perf.trackData);
      const rawTimes = sourceCues.map(c => c.position / tdSr);
      const adj = findCueAdjustment(rawTimes, goldenCueStarts);
      if (adj === null) continue;

      const loopMarks = computeLoopMarks(perf.loops, perf.trackData, adj, sourceCues.length);

      for (let j = 0; j < loopMarks.length; j++) {
        if (j < goldenLoopMarks.length) {
          const gm = goldenLoopMarks[j];
          if (loopMarks[j].start !== parseFloat(gm['@_Start'])) {
            startMismatches.push(
              `Track ${tid}, loop ${j}: start=${loopMarks[j].start} != golden=${gm['@_Start']}`
            );
          }
          if (loopMarks[j].end !== parseFloat(gm['@_End'])) {
            endMismatches.push(
              `Track ${tid}, loop ${j}: end=${loopMarks[j].end} != golden=${gm['@_End']}`
            );
          }
        }
      }
    }

    expect(startMismatches.length).toBe(0);
    expect(endMismatches.length).toBe(0);
  });
});
