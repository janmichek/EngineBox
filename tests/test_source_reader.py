import unittest
from pathlib import Path
from converter.source_reader import DatabaseError, ReadOnlyDatabase


class TestSourceReader(unittest.TestCase):
    def test_open_valid_database(self):
        with ReadOnlyDatabase("databases/m.db") as db:
            result = db.query("PRAGMA schema_version")
            self.assertGreater(result[0][0], 0)

    def test_missing_database_raises_error(self):
        with self.assertRaises(DatabaseError):
            with ReadOnlyDatabase("databases/nonexistent.db") as db:
                pass

    def test_validate_after_open(self):
        db = ReadOnlyDatabase("databases/m.db")
        db.open()
        db.validate()
        db.close()

    def test_query_without_open_raises_error(self):
        db = ReadOnlyDatabase("databases/m.db")
        with self.assertRaises(DatabaseError):
            db.query("SELECT 1")

    def test_query_returns_results(self):
        with ReadOnlyDatabase("databases/m.db") as db:
            result = db.query("SELECT COUNT(*) FROM Track")
            self.assertGreater(result[0][0], 0)

    def test_context_manager_closes_connection(self):
        db = ReadOnlyDatabase("databases/m.db")
        with db:
            pass
        self.assertIsNone(db._conn)

    def test_read_only_mode(self):
        with ReadOnlyDatabase("databases/m.db") as db:
            with self.assertRaises(DatabaseError):
                db.query("CREATE TABLE test_write (id INTEGER)")
