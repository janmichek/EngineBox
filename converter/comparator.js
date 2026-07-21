export class ComparisonResult {
  constructor() {
    this.mismatches = [];
  }

  add(message) {
    this.mismatches.push(message);
  }

  get ok() {
    return this.mismatches.length === 0;
  }

  summary() {
    if (this.ok) return 'Models are identical.';
    const lines = [`Found ${this.mismatches.length} mismatch(es):`];
    for (const m of this.mismatches) {
      lines.push(`  - ${m}`);
    }
    return lines.join('\n');
  }
}

const POSITION_MARK_FIELDS = [
  ['name', 'Name', true],
  ['mark_type', 'Type', false],
  ['start', 'Start', false],
  ['num', 'Num', false],
  ['red', 'Red', false],
  ['green', 'Green', false],
  ['blue', 'Blue', false],
  ['end', 'End', false],
];

const TEMPO_FIELDS = [
  ['inizio', 'Inizio', false],
  ['bpm', 'Bpm', false],
  ['metro', 'Metro', true],
  ['battito', 'Battito', false],
];

const TRACK_FIELDS = [
  ['track_id', 'TrackID', false],
  ['name', 'Name', true],
  ['artist', 'Artist', true],
  ['album', 'Album', true],
  ['genre', 'Genre', true],
  ['kind', 'Kind', true],
  ['location', 'Location', true],
  ['size', 'Size', false],
  ['total_time', 'TotalTime', false],
  ['track_number', 'TrackNumber', false],
  ['year', 'Year', false],
  ['average_bpm', 'AverageBpm', false],
  ['bit_rate', 'BitRate', false],
  ['comments', 'Comments', true],
  ['tonality', 'Tonality', true],
  ['label', 'Label', true],
  ['sample_rate', 'SampleRate', false],
];

const PLAYLIST_FIELDS = [
  ['name', 'Name', true],
  ['entries', 'Entries', false],
];

function compareFields(a, b, spec, path, result) {
  for (const [attr, label, useRepr] of spec) {
    const va = a[attr];
    const vb = b[attr];
    if (va !== vb) {
      if (useRepr) {
        result.add(`${path}.${label}: ${JSON.stringify(va)} != ${JSON.stringify(vb)}`);
      } else {
        result.add(`${path}.${label}: ${va} != ${vb}`);
      }
    }
  }
}

function comparePositionMarks(marksA, marksB, path, result) {
  if (marksA.length !== marksB.length) {
    result.add(`${path}: position mark count ${marksA.length} != ${marksB.length}`);
    return;
  }
  for (let i = 0; i < marksA.length; i++) {
    compareFields(marksA[i], marksB[i], POSITION_MARK_FIELDS, `${path}.POSITION_MARK[${i}]`, result);
  }
}

function compareTempos(a, b, path, result) {
  compareFields(a, b, TEMPO_FIELDS, `${path}.TEMPO`, result);
}

function compareTracks(a, b, index, result) {
  const path = `COLLECTION.TRACK[${index}]`;
  compareFields(a, b, TRACK_FIELDS, path, result);
  comparePositionMarks(a.position_marks, b.position_marks, path, result);
  if (!a.tempo && b.tempo) {
    result.add(`${path}: missing TEMPO in A`);
  } else if (a.tempo && !b.tempo) {
    result.add(`${path}: missing TEMPO in B`);
  } else if (a.tempo && b.tempo) {
    compareTempos(a.tempo, b.tempo, path, result);
  }
}

function comparePlaylists(a, b, index, result) {
  const path = `PLAYLISTS.NODE[${index}]`;
  compareFields(a, b, PLAYLIST_FIELDS, path, result);
  if (JSON.stringify(a.track_keys) !== JSON.stringify(b.track_keys)) {
    result.add(
      `${path}.TRACK keys: length ${a.track_keys.length} != ${b.track_keys.length} or content differs`
    );
  }
}

export function compareModels(a, b) {
  const result = new ComparisonResult();

  if (a.product_name !== b.product_name) {
    result.add(`PRODUCT.Name: ${JSON.stringify(a.product_name)} != ${JSON.stringify(b.product_name)}`);
  }
  if (a.product_version !== b.product_version) {
    result.add(`PRODUCT.Version: ${JSON.stringify(a.product_version)} != ${JSON.stringify(b.product_version)}`);
  }
  if (a.product_company !== b.product_company) {
    result.add(`PRODUCT.Company: ${JSON.stringify(a.product_company)} != ${JSON.stringify(b.product_company)}`);
  }
  if (a.collection_entries !== b.collection_entries) {
    result.add(`COLLECTION.Entries: ${a.collection_entries} != ${b.collection_entries}`);
  }

  if (a.tracks.length !== b.tracks.length) {
    result.add(`COLLECTION track count: ${a.tracks.length} != ${b.tracks.length}`);
  } else {
    for (let i = 0; i < a.tracks.length; i++) {
      compareTracks(a.tracks[i], b.tracks[i], i, result);
    }
  }

  if (a.playlists.length !== b.playlists.length) {
    result.add(`PLAYLIST count: ${a.playlists.length} != ${b.playlists.length}`);
  } else {
    for (let i = 0; i < a.playlists.length; i++) {
      comparePlaylists(a.playlists[i], b.playlists[i], i, result);
    }
  }

  return result;
}
