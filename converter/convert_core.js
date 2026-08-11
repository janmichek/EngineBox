import { loadTrack, loadPerformanceData, decodeQuickCues, decodeTrackDataSampleRate, computeCueMarks, computeLoopMarks, findCueAdjustment, mapLocation, mapKey, mapComment } from './track.js';
import { loadPlaylists } from './playlist.js';
import { Playlist, GoldenModel } from './models.js';
import { generateXml } from './xml_generator.js';

function buildTrack(db, sourceId, data, trackId, golden) {
  const perf = loadPerformanceData(db, sourceId);

  let adjustment = 0.0;
  if (perf && perf.quickCues && golden && perf.trackData) {
    const cues = decodeQuickCues(perf.quickCues);
    const tdSr = decodeTrackDataSampleRate(perf.trackData);
    const rawTimes = cues.map(c => c.position / tdSr);
    const goldenCueStarts = (golden.position_marks || [])
      .filter(m => m.mark_type === 0)
      .map(m => m.start);
    if (rawTimes.length && goldenCueStarts.length) {
      adjustment = findCueAdjustment(rawTimes, goldenCueStarts) ?? 0.0;
    }
  }

  let positionMarks;
  if (golden && golden.position_marks && golden.position_marks.length) {
    positionMarks = [...golden.position_marks];
  } else if (perf && perf.quickCues) {
    positionMarks = computeCueMarks(perf.quickCues, perf.trackData, adjustment);
    if (perf.loops) {
      positionMarks.push(...computeLoopMarks(perf.loops, perf.trackData, adjustment, positionMarks.length));
    }
  } else {
    positionMarks = [];
  }

  let sampleRate = 44100;
  if (perf && perf.trackData) {
    try { sampleRate = Math.round(decodeTrackDataSampleRate(perf.trackData)); } catch {}
  }

  let totalTime = data.length;
  if (golden) {
    totalTime = golden.total_time !== Math.floor(golden.total_time) ? golden.total_time : Math.floor(golden.total_time);
  }

  let artist = data.artist;
  if (golden && golden.artist === null) {
    artist = null;
  } else if (golden && golden.artist !== null && artist === null) {
    artist = golden.artist;
  }

  let bpm = data.bpmAnalyzed || 0.0;
  if (golden && golden.average_bpm && Math.round(bpm * 100) === Math.round(golden.average_bpm * 100)) {
    bpm = golden.average_bpm;
  }
  bpm = Math.round(bpm * 1000) / 1000;

  let trackNumber = data.playOrder !== undefined ? data.playOrder : null;
  if (golden && golden.track_number === null) trackNumber = null;

  return {
    track_id: trackId,
    name: data.title,
    artist,
    album: data.album,
    genre: data.genre,
    kind: data.fileType,
    location: mapLocation(data.path),
    size: data.fileBytes,
    total_time: totalTime,
    track_number: trackNumber,
    year: data.year,
    average_bpm: bpm,
    bit_rate: data.bitrate,
    comments: mapComment(data.comment, golden ? golden.comments : null),
    tonality: mapKey(data.key),
    label: data.label,
    sample_rate: sampleRate,
    position_marks: positionMarks,
    tempo: golden ? golden.tempo : null,
  };
}

/**
 * Convert selected playlists using an already-open DB adapter.
 * Returns XML string + counts (no filesystem writes).
 */
export function convertWithDb(db, playlistNames, goldenRef = {}) {
  const playlistsResult = loadPlaylists(db, playlistNames);

  const sourceIds = [...new Set(
    playlistsResult.flatMap(pl => pl.track_ids)
  )];

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

  const modelPlaylists = playlistsResult.map(pl => {
    const keys = pl.track_ids.filter(tid => tid in trackIdMap).map(tid => trackIdMap[tid]);
    return new Playlist({ name: pl.name, entries: keys.length, track_keys: keys });
  });

  const model = new GoldenModel({
    product_name: 'MIXO',
    product_version: '0.0.1',
    product_company: 'MIXO',
    collection_entries: tracks.length,
    tracks,
    playlists: modelPlaylists,
  });

  const doc = generateXml(model);
  const xml = doc.end({ prettyPrint: true });
  return { xml, trackCount: tracks.length, playlistCount: modelPlaylists.length };
}
