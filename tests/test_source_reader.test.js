import { describe, it, expect, afterAll } from 'vitest';
import { ReadOnlyDatabase, DatabaseError } from '../converter/source_reader.js';

describe('ReadOnlyDatabase', () => {
  it('opens a valid database', () => {
    const db = new ReadOnlyDatabase('databases/m.db');
    db.openSync();
    const result = db.query('PRAGMA schema_version');
    expect(result[0].schema_version).toBeGreaterThan(0);
    db.close();
  });

  it('throws on missing database', () => {
    expect(() => {
      const db = new ReadOnlyDatabase('databases/nonexistent.db');
      db.open();
    }).toThrow(DatabaseError);
  });

  it('validates after open', () => {
    const db = new ReadOnlyDatabase('databases/m.db');
    db.open();
    db.validate();
    db.close();
  });

  it('throws on query without open', () => {
    const db = new ReadOnlyDatabase('databases/m.db');
    expect(() => db.query('SELECT 1')).toThrow(DatabaseError);
  });

  it('query returns results', () => {
    const db = new ReadOnlyDatabase('databases/m.db');
    db.openSync();
    const result = db.query('SELECT COUNT(*) as cnt FROM Track');
    expect(result[0].cnt).toBeGreaterThan(0);
    db.close();
  });

  it('context manager closes connection', () => {
    const db = new ReadOnlyDatabase('databases/m.db');
    db.openSync();
    db.close();
    expect(db._conn).toBeNull();
  });

  it('read-only mode rejects writes', () => {
    const db = new ReadOnlyDatabase('databases/m.db');
    db.openSync();
    expect(() => db.query('CREATE TABLE test_write (id INTEGER)')).toThrow(DatabaseError);
    db.close();
  });
});
