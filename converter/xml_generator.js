import { create } from 'xmlbuilder2';

/** Match MIXO/Python float formatting: integers as "1.0". */
function numStr(val) {
  if (typeof val === 'number' && Number.isInteger(val)) return val + '.0';
  return String(val);
}

function addAttrs(elem, attrs) {
  for (const [name, value] of Object.entries(attrs)) {
    if (value !== null && value !== undefined) elem.att(name, value);
  }
  return elem;
}

function buildPositionMarkXml(parent, mark) {
  const attrs = {
    Name: mark.name,
    Type: String(mark.mark_type),
    Start: numStr(mark.start),
    Num: String(mark.num),
    Red: String(mark.red),
    Green: String(mark.green),
    Blue: String(mark.blue),
  };
  if (mark.end != null) attrs.End = numStr(mark.end);
  addAttrs(parent.ele('POSITION_MARK'), attrs);
}

function buildTrackXml(parent, track) {
  const elem = addAttrs(parent.ele('TRACK'), {
    TrackID: String(track.track_id),
    Name: track.name,
    Kind: track.kind,
    Location: track.location,
    Size: String(track.size),
    TotalTime: numStr(track.total_time),
    AverageBpm: numStr(track.average_bpm),
    SampleRate: String(track.sample_rate),
    Artist: track.artist,
    Album: track.album,
    Genre: track.genre,
    TrackNumber: track.track_number != null ? String(track.track_number) : null,
    Year: track.year != null ? String(track.year) : null,
    BitRate: track.bit_rate != null ? String(track.bit_rate) : null,
    Comments: track.comments,
    Tonality: track.tonality,
    Label: track.label,
  });

  for (const mark of track.position_marks) {
    buildPositionMarkXml(elem, mark);
  }
  if (track.tempo) {
    addAttrs(elem.ele('TEMPO'), {
      Inizio: numStr(track.tempo.inizio),
      Bpm: numStr(track.tempo.bpm),
      Metro: track.tempo.metro,
      Battito: String(track.tempo.battito),
    });
  }
}

function buildPlaylistXml(parent, playlist) {
  const node = addAttrs(parent.ele('NODE'), {
    Name: playlist.name,
    Type: '1',
    KeyType: '0',
    Entries: String(playlist.entries),
  });
  for (const key of playlist.track_keys) {
    addAttrs(node.ele('TRACK'), { Key: String(key) });
  }
}

export function generateXml(model) {
  const root = addAttrs(
    create({ version: '1.0', encoding: 'UTF-8' }).ele('DJ_PLAYLISTS'),
    { Version: '1.0.0' }
  );

  addAttrs(root.ele('PRODUCT'), {
    Name: model.product_name,
    Version: model.product_version,
    Company: model.product_company,
  });

  const collection = addAttrs(root.ele('COLLECTION'), {
    Entries: String(model.collection_entries),
  });
  for (const track of model.tracks) {
    buildTrackXml(collection, track);
  }

  const playlists = root.ele('PLAYLISTS');
  const rootNode = addAttrs(playlists.ele('NODE'), {
    Type: '0',
    Name: 'ROOT',
    Count: String(model.playlists.length),
  });
  for (const playlist of model.playlists) {
    buildPlaylistXml(rootNode, playlist);
  }

  return root;
}
