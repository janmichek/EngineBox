import { create } from 'xmlbuilder2';

function pythonStr(val) {
  if (typeof val === 'number' && Number.isInteger(val)) {
    return val + '.0';
  }
  return String(val);
}

function buildPositionMarkXml(parent, mark) {
  const elem = ele(parent, 'POSITION_MARK');
  attr(elem, 'Name', mark.name);
  attr(elem, 'Type', String(mark.mark_type));
  attr(elem, 'Start', pythonStr(mark.start));
  attr(elem, 'Num', String(mark.num));
  attr(elem, 'Red', String(mark.red));
  attr(elem, 'Green', String(mark.green));
  attr(elem, 'Blue', String(mark.blue));
  if (mark.end !== null && mark.end !== undefined) {
    attr(elem, 'End', pythonStr(mark.end));
  }
}

function buildTempoXml(parent, tempo) {
  const elem = ele(parent, 'TEMPO');
  attr(elem, 'Inizio', pythonStr(tempo.inizio));
  attr(elem, 'Bpm', pythonStr(tempo.bpm));
  attr(elem, 'Metro', tempo.metro);
  attr(elem, 'Battito', String(tempo.battito));
}

function ele(parent, name) {
  return parent.ele(name);
}

function attr(elem, name, value) {
  return elem.att(name, value);
}

function buildTrackXml(parent, track) {
  const elem = ele(parent, 'TRACK');
  attr(elem, 'TrackID', String(track.track_id));
  attr(elem, 'Name', track.name);
  attr(elem, 'Kind', track.kind);
  attr(elem, 'Location', track.location);
  attr(elem, 'Size', String(track.size));
  attr(elem, 'TotalTime', pythonStr(track.total_time));
  attr(elem, 'AverageBpm', pythonStr(track.average_bpm));
  attr(elem, 'SampleRate', String(track.sample_rate));

  if (track.artist !== null && track.artist !== undefined) attr(elem, 'Artist', track.artist);
  if (track.album !== null && track.album !== undefined) attr(elem, 'Album', track.album);
  if (track.genre !== null && track.genre !== undefined) attr(elem, 'Genre', track.genre);
  if (track.track_number !== null && track.track_number !== undefined) attr(elem, 'TrackNumber', String(track.track_number));
  if (track.year !== null && track.year !== undefined) attr(elem, 'Year', String(track.year));
  if (track.bit_rate !== null && track.bit_rate !== undefined) attr(elem, 'BitRate', String(track.bit_rate));
  if (track.comments !== null && track.comments !== undefined) attr(elem, 'Comments', track.comments);
  if (track.tonality !== null && track.tonality !== undefined) attr(elem, 'Tonality', track.tonality);
  if (track.label !== null && track.label !== undefined) attr(elem, 'Label', track.label);

  for (const mark of track.position_marks) {
    buildPositionMarkXml(elem, mark);
  }

  if (track.tempo) {
    buildTempoXml(elem, track.tempo);
  }
}

function buildPlaylistXml(parent, playlist) {
  const node = ele(parent, 'NODE');
  attr(node, 'Name', playlist.name);
  attr(node, 'Type', '1');
  attr(node, 'KeyType', '0');
  attr(node, 'Entries', String(playlist.entries));
  for (const key of playlist.track_keys) {
    const t = ele(node, 'TRACK');
    attr(t, 'Key', String(key));
  }
}

export function generateXml(model) {
  const djPlaylists = create({ version: '1.0', encoding: 'UTF-8' }).ele('DJ_PLAYLISTS');
  attr(djPlaylists, 'Version', '1.0.0');

  const product = ele(djPlaylists, 'PRODUCT');
  attr(product, 'Name', model.product_name);
  attr(product, 'Version', model.product_version);
  attr(product, 'Company', model.product_company);

  const collection = ele(djPlaylists, 'COLLECTION');
  attr(collection, 'Entries', String(model.collection_entries));
  for (const track of model.tracks) {
    buildTrackXml(collection, track);
  }

  const playlistsElem = ele(djPlaylists, 'PLAYLISTS');
  const rootNode = ele(playlistsElem, 'NODE');
  attr(rootNode, 'Type', '0');
  attr(rootNode, 'Name', 'ROOT');
  attr(rootNode, 'Count', String(model.playlists.length));
  for (const playlist of model.playlists) {
    buildPlaylistXml(rootNode, playlist);
  }

  return djPlaylists;
}
