import {
  loadTrack,
  loadPerformanceData,
  decodeQuickCues,
  decodeTrackDataSampleRate,
  computeCueMarks,
  computeLoopMarks,
  findCueAdjustment,
  mapLocation,
  mapKey,
  mapComment,
} from './track.js';
import { loadPlaylists } from './playlist.js';
import { generateXml } from './xml_generator.js';

/**
 * Optional goldenRef (filename → golden track) is only used to calibrate cue
 * timing against a MIXO export. Production / browser conversion passes {}.
 */
function cueAdjustment(perf, golden) {
  if (!perf?.quickCues || !perf?.trackData || !golden?.position_marks?.length) {
    return 0;
  }
  const cues = decodeQuickCues(perf.quickCues);
  if (!cues.length) return 0;
  const tdSr = decodeTrackDataSampleRate(perf.trackData);
  const rawTimes = cues.map(c => c.position / tdSr);
  const goldenStarts = golden.position_marks
    .filter(m => m.mark_type === 0)
    .map(m => m.start);
  if (!goldenStarts.length) return 0;
  return findCueAdjustment(rawTimes, goldenStarts) ?? 0;
}

function positionMarks(perf, adjustment) {
  if (!perf?.quickCues || !perf?.trackData) return [];
  const marks = computeCueMarks(perf.quickCues, perf.trackData, adjustment);
  if (perf.loops) {
    marks.push(...computeLoopMarks(perf.loops, perf.trackData, adjustment));
  }
  return marks;
}

function sampleRate(perf) {
  if (!perf?.trackData) return 44100;
  try {
    return Math.round(decodeTrackDataSampleRate(perf.trackData));
  } catch {
    return 44100;
  }
}

function buildTrack(db, sourceId, data, trackId, golden) {
  const perf = loadPerformanceData(db, sourceId);
  const adjustment = cueAdjustment(perf, golden);
  const bpm = Math.round((data.bpmAnalyzed || 0) * 1000) / 1000;

  return {
    track_id: trackId,
    name: data.title,
    artist: data.artist,
    album: data.album,
    genre: data.genre,
    kind: data.fileType,
    location: mapLocation(data.path),
    size: data.fileBytes,
    total_time: data.length,
    track_number: data.playOrder ?? null,
    year: data.year,
    average_bpm: bpm,
    bit_rate: data.bitrate,
    comments: mapComment(data.comment),
    tonality: mapKey(data.key),
    label: data.label,
    sample_rate: sampleRate(perf),
    position_marks: positionMarks(perf, adjustment),
    tempo: null,
  };
}

/** Convert selected playlists. Returns XML string + counts (no filesystem writes). */
export function convertWithDb(db, playlistNames, goldenRef = {}) {
  const playlistsResult = loadPlaylists(db, playlistNames);
  const sourceIds = [...new Set(playlistsResult.flatMap(pl => pl.track_ids))];

  const tracks = [];
  const trackIdMap = {};
  for (const sourceId of sourceIds) {
    let data;
    try {
      data = loadTrack(db, sourceId);
    } catch {
      continue;
    }
    trackIdMap[sourceId] = tracks.length;
    tracks.push(
      buildTrack(db, sourceId, data, trackIdMap[sourceId], goldenRef[data.filename] || null)
    );
  }

  const playlists = playlistsResult.map(pl => {
    const keys = pl.track_ids.filter(tid => tid in trackIdMap).map(tid => trackIdMap[tid]);
    return { name: pl.name, entries: keys.length, track_keys: keys };
  });

  const model = {
    product_name: 'MIXO',
    product_version: '0.0.1',
    product_company: 'MIXO',
    collection_entries: tracks.length,
    tracks,
    playlists,
  };

  const xml = generateXml(model).end({ prettyPrint: true });
  return { xml, trackCount: tracks.length, playlistCount: playlists.length };
}
