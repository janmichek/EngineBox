#!/usr/bin/env python3
"""Simple HTTP API server for the converter."""

import json
import os
import sys
import threading
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from converter.source_reader import ReadOnlyDatabase
from converter.playlist import load_playlists

DATABASE = "databases/m.db"
DEFAULT_DB = "/Users/yeahboi/Music/Engine Library/Database2/m.db"
PORT = 8787

conversion_state = {
    "status": "idle",
    "progress": 0,
    "message": "",
    "output_path": "",
    "error": None,
}


def get_all_playlists(db):
    rows = db.query(
        "SELECT id, title FROM Playlist WHERE title IS NOT NULL AND title != '' ORDER BY title"
    )
    return [{"id": r[0], "name": r[1]} for r in rows]


def get_playlist_track_count(db, playlist_id):
    rows = db.query(
        "SELECT COUNT(*) FROM PlaylistEntity WHERE listId = ?", (playlist_id,)
    )
    return rows[0][0] if rows else 0


def run_conversion(selected_playlist_names, db_path=DATABASE):
    global conversion_state
    conversion_state = {
        "status": "running",
        "progress": 0,
        "message": "Starting conversion...",
        "output_path": "",
        "error": None,
    }

    try:
        from convert import convert_with_playlists

        conversion_state["progress"] = 10
        conversion_state["message"] = "Loading database..."
        output = convert_with_playlists(selected_playlist_names, db_path=db_path)
        conversion_state = {
            "status": "done",
            "progress": 100,
            "message": f"Conversion complete! {output}",
            "output_path": output,
            "error": None,
        }
    except Exception as e:
        conversion_state = {
            "status": "error",
            "progress": 0,
            "message": str(e),
            "output_path": "",
            "error": str(e),
        }


class APIHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/playlists":
            self._handle_playlists()
        elif parsed.path == "/api/status":
            self._handle_status()
        elif parsed.path.startswith("/output/"):
            self._serve_file(parsed.path)
        else:
            self._serve_react_app(parsed.path)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/convert":
            self._handle_convert()
        else:
            self.send_error(404)

    def _handle_playlists(self):
        try:
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)
            db_path = params.get("db", [DATABASE])[0]
            with ReadOnlyDatabase(db_path) as db:
                playlists = get_all_playlists(db)
                for p in playlists:
                    p["track_count"] = get_playlist_track_count(db, p["id"])
            self._json_response(200, {"playlists": playlists})
        except Exception as e:
            self._json_response(500, {"error": str(e)})

    def _handle_status(self):
        self._json_response(200, conversion_state)

    def _handle_convert(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        data = json.loads(body)
        selected = list(dict.fromkeys(data.get("playlists", [])))
        db_path = data.get("db", DATABASE)

        if not selected:
            self._json_response(400, {"error": "No playlists selected"})
            return

        if conversion_state["status"] == "running":
            self._json_response(409, {"error": "Conversion already in progress"})
            return

        thread = threading.Thread(
            target=run_conversion, args=(selected, db_path), daemon=True
        )
        thread.start()
        self._json_response(200, {"message": "Conversion started"})

    def _json_response(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _serve_react_app(self, path):
        ui_dir = os.path.join(BASE_DIR, "ui", "dist")
        if path == "/" or path == "":
            path = "/index.html"

        file_path = os.path.join(ui_dir, path.lstrip("/"))
        if os.path.isfile(file_path):
            self.send_file(file_path)
        else:
            index = os.path.join(ui_dir, "index.html")
            if os.path.isfile(index):
                self.send_file(index)
            else:
                self.send_error(404, "UI not built. Run: npm run ui:build")

    def _serve_file(self, path):
        file_path = os.path.join(BASE_DIR, path.lstrip("/"))
        if os.path.isfile(file_path):
            self.send_file(file_path)
        else:
            self.send_error(404)

    def send_file(self, file_path):
        ext = os.path.splitext(file_path)[1]
        content_types = {
            ".html": "text/html",
            ".js": "application/javascript",
            ".css": "text/css",
            ".json": "application/json",
            ".png": "image/png",
            ".svg": "image/svg+xml",
            ".ico": "image/x-icon",
        }
        content_type = content_types.get(ext, "application/octet-stream")

        with open(file_path, "rb") as f:
            data = f.read()

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def log_message(self, format, *args):
        if "/api/" in (args[0] if args else ""):
            super().log_message(format, *args)


def main():
    server = HTTPServer(("localhost", PORT), APIHandler)
    print(f"Converter server running at http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()


if __name__ == "__main__":
    main()
