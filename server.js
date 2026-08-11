import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ReadOnlyDatabase } from './converter/source_reader.js';
import { listPlaylists } from './converter/playlist.js';
import { doConvert } from './convert.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 8787;
const DATABASE = 'databases/m.db';

const CONTENT_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml',
};

let conversionState = {
  status: 'idle',
  progress: 0,
  message: '',
  output_path: '',
  error: null,
};

function runConversion(selectedPlaylistNames, dbPath = DATABASE) {
  conversionState = {
    status: 'running',
    progress: 10,
    message: 'Converting...',
    output_path: '',
    error: null,
  };

  try {
    const { outputPath, trackCount, playlistCount } = doConvert(
      selectedPlaylistNames, undefined, {}, dbPath
    );
    conversionState = {
      status: 'done',
      progress: 100,
      message: `Conversion complete! ${outputPath} (${trackCount} tracks, ${playlistCount} playlists)`,
      output_path: outputPath,
      error: null,
    };
  } catch (e) {
    conversionState = {
      status: 'error',
      progress: 0,
      message: e.message,
      output_path: '',
      error: e.message,
    };
  }
}

function jsonResponse(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function sendFile(res, filePath) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const data = readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': CONTENT_TYPES[extname(filePath)] || 'application/octet-stream',
    'Content-Length': data.length,
  });
  res.end(data);
}

function serveReactApp(res, path) {
  const uiDir = join(__dirname, 'dist');
  const reqPath = path === '/' || path === '' ? '/index.html' : path;
  const filePath = join(uiDir, reqPath.replace(/^\//, ''));
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    sendFile(res, filePath);
    return;
  }
  const index = join(uiDir, 'index.html');
  if (existsSync(index)) {
    sendFile(res, index);
  } else {
    res.writeHead(404);
    res.end('UI not built. Run: npm run ui:build');
  }
}

function serveFile(res, path) {
  const filePath = join(__dirname, path.replace(/^\//, ''));
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    sendFile(res, filePath);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
}

function handlePlaylists(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const dbPath = url.searchParams.get('db') || DATABASE;
  try {
    const db = new ReadOnlyDatabase(dbPath);
    db.openSync();
    try {
      jsonResponse(res, 200, { playlists: listPlaylists(db) });
    } finally {
      db.close();
    }
  } catch (e) {
    jsonResponse(res, 500, { error: e.message });
  }
}

function handleConvert(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      jsonResponse(res, 400, { error: 'Invalid JSON' });
      return;
    }
    const selected = [...new Set(data.playlists || [])];
    const dbPath = data.db || DATABASE;

    if (!selected.length) {
      jsonResponse(res, 400, { error: 'No playlists selected' });
      return;
    }
    if (conversionState.status === 'running') {
      jsonResponse(res, 409, { error: 'Conversion already in progress' });
      return;
    }

    setImmediate(() => runConversion(selected, dbPath));
    jsonResponse(res, 200, { message: 'Conversion started' });
  });
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (req.method === 'GET') {
    if (path === '/api/playlists') handlePlaylists(req, res);
    else if (path === '/api/status') jsonResponse(res, 200, conversionState);
    else if (path.startsWith('/output/')) serveFile(res, path);
    else serveReactApp(res, path);
  } else if (req.method === 'POST' && path === '/api/convert') {
    handleConvert(req, res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const isMain = process.argv[1] && (
  process.argv[1].endsWith('server.js') ||
  process.argv[1].endsWith('server')
);
if (isMain) {
  server.listen(PORT, () => {
    console.log(`EngineBox running at http://localhost:${PORT}`);
  });
}

export { server };
