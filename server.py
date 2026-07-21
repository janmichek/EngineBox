#!/usr/bin/env python3
"""HTTP API server and static UI host for the converter."""

import json
import os
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

from convert import DATABASE, do_convert
from converter.playlist import list_playlists
from converter.source_reader import ReadOnlyDatabase

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PORT = 8787

conversion_state = {
    "status": "idle",
    "progress": 0,
    "message": "",
    "output_path": "",
    "error": None,
}


def get_all_playlists(db):
    return list_playlists(db)


def run_conversion(selected_playlist_names, db_path=DATABASE):
    global conversion_state
    conversion_state = {
        "status": "running",
        "progress": 10,
        "message": "Converting...",
        "output_path": "",
        "error": None,
    }

    try:
        output_path, track_count, pl_count = do_convert(
            selected_playlist_names, db_path=db_path
        )
        conversion_state = {
            "status": "done",
            "progress": 100,
            "message": (
                f"Conversion complete! {output_path} "
                f"({track_count} tracks, {pl_count} playlists)"
            ),
            "output_path": output_path,
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
            self._json_response(200, conversion_state)
        elif parsed.path.startswith("/output/"):
            self._serve_file(parsed.path)
        else:
            self._serve_react_app(parsed.path)

    def do_POST(self):
        if urlparse(self.path).path == "/api/convert":
            self._handle_convert()
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _handle_playlists(self):
        try:
            params = parse_qs(urlparse(self.path).query)
            db_path = params.get("db", [DATABASE])[0]
            with ReadOnlyDatabase(db_path) as db:
                playlists = get_all_playlists(db)
            self._json_response(200, {"playlists": playlists})
        except Exception as e:
            self._json_response(500, {"error": str(e)})

    def _handle_convert(self):
        content_length = int(self.headers.get("Content-Length", 0))
        data = json.loads(self.rfile.read(content_length))
        selected = list(dict.fromkeys(data.get("playlists", [])))
        db_path = data.get("db", DATABASE)

        if not selected:
            self._json_response(400, {"error": "No playlists selected"})
            return

        if conversion_state["status"] == "running":
            self._json_response(409, {"error": "Conversion already in progress"})
            return

        threading.Thread(
            target=run_conversion, args=(selected, db_path), daemon=True
        ).start()
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
        ui_dir = os.path.join(BASE_DIR, "dist")
        if path in ("/", ""):
            path = "/index.html"

        file_path = os.path.join(ui_dir, path.lstrip("/"))
        if os.path.isfile(file_path):
            self._send_file(file_path)
        else:
            index = os.path.join(ui_dir, "index.html")
            if os.path.isfile(index):
                self._send_file(index)
            else:
                self.send_error(404, "UI not built. Run: npm run ui:build")

    def _serve_file(self, path):
        file_path = os.path.join(BASE_DIR, path.lstrip("/"))
        if os.path.isfile(file_path):
            self._send_file(file_path)
        else:
            self.send_error(404)

    def _send_file(self, file_path):
        content_types = {
            ".html": "text/html",
            ".js": "application/javascript",
            ".css": "text/css",
            ".json": "application/json",
            ".png": "image/png",
            ".svg": "image/svg+xml",
            ".ico": "image/x-icon",
            ".xml": "application/xml",
        }
        ext = os.path.splitext(file_path)[1]
        with open(file_path, "rb") as f:
            data = f.read()

        self.send_response(200)
        self.send_header(
            "Content-Type", content_types.get(ext, "application/octet-stream")
        )
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format, *args):
        if "/api/" in (args[0] if args else ""):
            super().log_message(format, *args)


def main():
    server = HTTPServer(("localhost", PORT), APIHandler)
    print(f"EngineBox running at http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()


if __name__ == "__main__":
    main()
