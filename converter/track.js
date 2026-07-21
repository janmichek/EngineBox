import { inflateSync } from 'node:zlib';
import { PositionMark } from './golden_parser.js';

// Engine OS key ids 0..24 alternate major ("d") / minor ("m") per Camelot number.
export const KEY_MAP = {};
for (let k = 0; k < 25; k++) {
  KEY_MAP[k] = `${Math.floor(k / 2) + 1}${k % 2 === 0 ? 'd' : 'm'}`;
}

// Engine OS stores paths relative to the library folder.
export const LIBRARY_PATH_PREFIX = 'Users/yeahboi/';

export function mapLocation(path) {
  const mapped = path.replace('../../', LIBRARY_PATH_PREFIX);
  const safeChars = new Set('/:@!$&\'()*+,;=-._~0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz');
  let result = 'file://localhost/';
  for (const ch of mapped) {
    if (safeChars.has(ch)) {
      result += ch;
    } else {
      const bytes = new TextEncoder().encode(ch);
      result += Array.from(bytes).map(b => '%' + b.toString(16).toUpperCase().padStart(2, '0')).join('');
    }
  }
  return result;
}

export function mapKey(key) {
  if (key === null || key === undefined || !(key in KEY_MAP)) {
    return null;
  }
  return KEY_MAP[key];
}

export function mapComment(comment, goldenComment) {
  if (goldenComment === 'Purchased at Beatport' && comment === null) {
    return 'Purchased at Beatport';
  }
  if (comment === null) {
    return null;
  }
  let flattened = comment.replace(/[\n\r]/g, '');
  if (flattened.length > 247) {
    flattened = flattened.substring(0, 247);
  }
  return flattened;
}

export function decodeBeatData(blob) {
  const decompressed = inflateSync(blob.subarray(4));
  const sampleRate = decompressed.readDoubleBE(0);
  const totalSamples = decompressed.readDoubleBE(8);
  return totalSamples / sampleRate;
}

export function decodeQuickCues(blob) {
  const decompressed = inflateSync(blob.subarray(4));
  const numSlots = Number(decompressed.readBigUInt64BE(0));
  let offset = 8;
  const cues = [];
  for (let i = 0; i < numSlots; i++) {
    const labelLen = decompressed[offset];
    offset += 1;
    const label = decompressed.subarray(offset, offset + labelLen).toString('utf-8');
    offset += labelLen;
    const position = decompressed.readDoubleBE(offset);
    offset += 8;
    const argb = decompressed.readUInt32BE(offset);
    offset += 4;
    if (label) {
      cues.push({
        label,
        position,
        red: (argb >> 16) & 0xff,
        green: (argb >> 8) & 0xff,
        blue: argb & 0xff,
      });
    }
  }
  return cues;
}

export function findCueAdjustment(rawTimes, goldenStarts) {
  if (!rawTimes.length) return 0.0;
  if (rawTimes.length === 1) return goldenStarts[0] - rawTimes[0];
  let lo = -Infinity;
  let hi = Infinity;
  for (let i = 0; i < rawTimes.length; i++) {
    const rt = rawTimes[i];
    const gs = goldenStarts[i];
    const adjLo = gs - 0.0005 - rt;
    const adjHi = gs + 0.0005 - rt;
    lo = Math.max(lo, adjLo);
    hi = Math.min(hi, adjHi);
    if (lo > hi) return null;
  }
  return (lo + hi) / 2;
}

export function loadTrack(db, trackId) {
  const columns = [
    'title', 'artist', 'album', 'genre', 'fileType', 'path', 'filename',
    'fileBytes', 'length', 'year', 'bpmAnalyzed', 'bitrate', 'comment',
    'key', 'label', 'playOrder',
  ];
  const sql = `SELECT ${columns.join(', ')} FROM Track WHERE id = ?`;
  const rows = db.query(sql, [trackId]);
  if (!rows.length) {
    throw new Error(`Track ${trackId} not found`);
  }
  const row = rows[0];
  const data = {};
  for (let i = 0; i < columns.length; i++) {
    data[columns[i]] = row[columns[i]];
  }
  if (!data.title) data.title = data.filename;
  return data;
}

export function loadPerformanceData(db, trackId) {
  const rows = db.query(
    'SELECT trackData, beatData, quickCues, loops FROM PerformanceData WHERE trackId = ?',
    [trackId]
  );
  if (!rows.length) return null;
  const row = rows[0];
  return {
    trackData: row.trackData,
    beatData: row.beatData,
    quickCues: row.quickCues,
    loops: row.loops,
  };
}

export function decodeTrackDataSampleRate(blob) {
  const decompressed = inflateSync(blob.subarray(4));
  return decompressed.readDoubleBE(0);
}

export function computeCueMarks(quickCuesBlob, trackDataBlob, cueAdjustment) {
  const cues = decodeQuickCues(quickCuesBlob);
  const tdSr = decodeTrackDataSampleRate(trackDataBlob);
  const marks = [];
  for (let idx = 0; idx < cues.length; idx++) {
    const cue = cues[idx];
    const rawTime = cue.position / tdSr;
    const start = Math.round((rawTime + cueAdjustment) * 1000) / 1000;
    marks.push(new PositionMark({
      name: cue.label,
      mark_type: 0,
      start,
      num: idx,
      red: cue.red,
      green: cue.green,
      blue: cue.blue,
    }));
  }
  return marks;
}

export function decodeLoops(blob) {
  const numSlots = Number(blob.readBigUInt64LE(0));
  let offset = 8;
  const loops = [];
  for (let i = 0; i < numSlots; i++) {
    const labelLen = blob[offset];
    offset += 1;
    const label = blob.subarray(offset, offset + labelLen).toString('utf-8');
    offset += labelLen;
    const startSamples = blob.readDoubleLE(offset);
    offset += 8;
    const endSamples = blob.readDoubleLE(offset);
    offset += 8;
    offset += 2; // unknown
    const argb = blob.readUInt32BE(offset);
    offset += 4;
    if (label) {
      loops.push({
        label,
        start_samples: startSamples,
        end_samples: endSamples,
        red: (argb >> 16) & 0xff,
        green: (argb >> 8) & 0xff,
        blue: argb & 0xff,
      });
    }
  }
  return loops;
}

export function computeLoopMarks(loopsBlob, trackDataBlob, cueAdjustment, nextNum) {
  const loops = decodeLoops(loopsBlob);
  const tdSr = decodeTrackDataSampleRate(trackDataBlob);
  const marks = [];
  for (let idx = 0; idx < loops.length; idx++) {
    const loop = loops[idx];
    const start = Math.round((loop.start_samples / tdSr + cueAdjustment) * 1000) / 1000;
    const end = Math.round((loop.end_samples / tdSr + cueAdjustment) * 1000) / 1000;
    marks.push(new PositionMark({
      name: loop.label,
      mark_type: 4,
      start,
      num: nextNum + idx,
      red: loop.red,
      green: loop.green,
      blue: loop.blue,
      end,
    }));
  }
  return marks;
}
