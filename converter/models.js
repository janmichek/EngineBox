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
