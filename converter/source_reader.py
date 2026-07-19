import sqlite3
from pathlib import Path
from typing import Optional


class DatabaseError(Exception):
    pass


class ReadOnlyDatabase:
    def __init__(self, db_path: str):
        self.db_path = Path(db_path)
        self._conn: Optional[sqlite3.Connection] = None

    def open(self):
        if not self.db_path.exists():
            raise DatabaseError(f"Database not found: {self.db_path}")
        uri = f"file:{self.db_path}?mode=ro"
        try:
            self._conn = sqlite3.connect(uri, uri=True)
        except sqlite3.Error as e:
            raise DatabaseError(f"Failed to open database: {e}")

    def close(self):
        if self._conn:
            self._conn.close()
            self._conn = None

    def validate(self):
        if self._conn is None:
            raise DatabaseError("Database not open")
        try:
            cur = self._conn.execute("PRAGMA schema_version")
            version = cur.fetchone()[0]
            if version < 1:
                raise DatabaseError(f"Invalid schema version: {version}")
        except sqlite3.Error as e:
            raise DatabaseError(f"Failed to validate database: {e}")

    def query(self, sql: str, params=None):
        if self._conn is None:
            raise DatabaseError("Database not open")
        try:
            if params:
                return self._conn.execute(sql, params).fetchall()
            return self._conn.execute(sql).fetchall()
        except sqlite3.Error as e:
            raise DatabaseError(f"Query failed: {e}")

    def __enter__(self):
        self.open()
        self.validate()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        return False
