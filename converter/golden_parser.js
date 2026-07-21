import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';

export class PositionMark {
  constructor({ name, mark_type, start, num, red, green, blue, end = null }) {
    this.name = name;
    this.mark_type = mark_type;
    this.start = start;
    this.num = num;
    this.red = red;
    this.green = green;
    this.blue = blue;
    this.end = end;
  }
}

export class Tempo {
  constructor({ inizio, bpm, metro, battito }) {
    this.inizio = inizio;
    this.bpm = bpm;
    this.metro = metro;
    this.battito = battito;
  }
}

export class Track {
  constructor({
    track_id, name, artist = null, album = null, genre = null,
    kind, location, size, total_time, track_number = null,
    year = null, average_bpm, bit_rate = null, comments = null,
    tonality = null, label = null, sample_rate,
    position_marks = [], tempo = null,
  }) {
    this.track_id = track_id;
    this.name = name;
    this.artist = artist;
    this.album = album;
    this.genre = genre;
    this.kind = kind;
    this.location = location;
    this.size = size;
    this.total_time = total_time;
    this.track_number = track_number;
    this.year = year;
    this.average_bpm = average_bpm;
    this.bit_rate = bit_rate;
    this.comments = comments;
    this.tonality = tonality;
    this.label = label;
    this.sample_rate = sample_rate;
    this.position_marks = position_marks;
    this.tempo = tempo;
  }
}

export class Playlist {
  constructor({ name, entries, track_keys = [] }) {
    this.name = name;
    this.entries = entries;
    this.track_keys = track_keys;
  }
}

export class GoldenModel {
  constructor({
    product_name, product_version, product_company,
    collection_entries, tracks = [], playlists = [],
  }) {
    this.product_name = product_name;
    this.product_version = product_version;
    this.product_company = product_company;
    this.collection_entries = collection_entries;
    this.tracks = tracks;
    this.playlists = playlists;
  }
}

function parsePositionMark(elem) {
  return new PositionMark({
    name: elem['@_Name'],
    mark_type: parseInt(elem['@_Type'], 10),
    start: parseFloat(elem['@_Start']),
    num: parseInt(elem['@_Num'], 10),
    red: parseInt(elem['@_Red'], 10),
    green: parseInt(elem['@_Green'], 10),
    blue: parseInt(elem['@_Blue'], 10),
    end: elem['@_End'] !== undefined ? parseFloat(elem['@_End']) : null,
  });
}

function parseTempo(elem) {
  return new Tempo({
    inizio: parseFloat(elem['@_Inizio']),
    bpm: parseFloat(elem['@_Bpm']),
    metro: elem['@_Metro'],
    battito: parseInt(elem['@_Battito'], 10),
  });
}

function parseIntOr(val) {
  return val !== undefined ? parseInt(val, 10) : null;
}

function parseTrack(elem) {
  const positionMarks = [];
  let tempo = null;

  const pos = elem.POSITION_MARK;
  if (pos) {
    const arr = Array.isArray(pos) ? pos : [pos];
    for (const p of arr) {
      positionMarks.push(parsePositionMark(p));
    }
  }

  const te = elem.TEMPO;
  if (te) {
    const arr = Array.isArray(te) ? te : [te];
    tempo = parseTempo(arr[0]);
  }

  return new Track({
    track_id: parseInt(elem['@_TrackID'], 10),
    name: elem['@_Name'],
    artist: elem['@_Artist'] || null,
    album: elem['@_Album'] || null,
    genre: elem['@_Genre'] || null,
    kind: elem['@_Kind'],
    location: elem['@_Location'],
    size: parseInt(elem['@_Size'], 10),
    total_time: parseFloat(elem['@_TotalTime']),
    track_number: parseIntOr(elem['@_TrackNumber']),
    year: parseIntOr(elem['@_Year']),
    average_bpm: parseFloat(elem['@_AverageBpm']),
    bit_rate: parseIntOr(elem['@_BitRate']),
    comments: elem['@_Comments'] || null,
    tonality: elem['@_Tonality'] || null,
    label: elem['@_Label'] || null,
    sample_rate: parseInt(elem['@_SampleRate'], 10),
    position_marks: positionMarks,
    tempo,
  });
}

function parsePlaylist(elem) {
  const trackKeys = [];
  if (elem.TRACK) {
    const arr = Array.isArray(elem.TRACK) ? elem.TRACK : [elem.TRACK];
    for (const t of arr) {
      trackKeys.push(parseInt(t['@_Key'], 10));
    }
  }
  return new Playlist({
    name: elem['@_Name'],
    entries: parseInt(elem['@_Entries'], 10),
    track_keys: trackKeys,
  });
}

export function parseGoldenXml(path) {
  const xml = readFileSync(path, 'utf-8');

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
    ignoreDeclaration: true,
    isArray: (name) =>
      name === 'TRACK' || name === 'POSITION_MARK' || name === 'NODE' || name === 'TEMPO',
  });

  const doc = parser.parse(xml);
  const root = doc.DJ_PLAYLISTS;

  const product = root.PRODUCT;
  const productName = product['@_Name'];
  const productVersion = product['@_Version'];
  const productCompany = product['@_Company'];

  const collection = root.COLLECTION;
  const collectionEntries = parseInt(collection['@_Entries'], 10);

  const rawTracks = collection.TRACK || [];
  const tracks = rawTracks.map(parseTrack);

  const playlists = [];
  const playlistsElem = root.PLAYLISTS;
  if (playlistsElem) {
    const rootNodeArr = playlistsElem.NODE;
    if (rootNodeArr) {
      const nodes = Array.isArray(rootNodeArr) ? rootNodeArr : [rootNodeArr];
      for (const node of nodes) {
        if (Array.isArray(node.NODE)) {
          for (const child of node.NODE) {
            if (child['@_Type'] === '1') {
              playlists.push(parsePlaylist(child));
            }
          }
        }
      }
    }
  }

  return new GoldenModel({
    product_name: productName,
    product_version: productVersion,
    product_company: productCompany,
    collection_entries: collectionEntries,
    tracks,
    playlists,
  });
}
