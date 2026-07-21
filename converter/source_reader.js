import Database from 'better-sqlite3';
import { accessSync, constants } from 'node:fs';

export class DatabaseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ReadOnlyDatabase {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this._conn = null;
  }

  open() {
    try {
      accessSync(this.dbPath, constants.R_OK);
    } catch {
      throw new DatabaseError(`Database not found: ${this.dbPath}`);
    }
    try {
      this._conn = new Database(this.dbPath, { readonly: true, fileMustExist: true });
    } catch (e) {
      throw new DatabaseError(`Failed to open database: ${e.message}`);
    }
  }

  close() {
    if (this._conn) {
      this._conn.close();
      this._conn = null;
    }
  }

  validate() {
    if (!this._conn) {
      throw new DatabaseError('Database not open');
    }
    try {
      const row = this._conn.pragma('schema_version', { simple: true });
      if (row < 1) {
        throw new DatabaseError(`Invalid schema version: ${row}`);
      }
    } catch (e) {
      if (e instanceof DatabaseError) throw e;
      throw new DatabaseError(`Failed to validate database: ${e.message}`);
    }
  }

  query(sql, params) {
    if (!this._conn) {
      throw new DatabaseError('Database not open');
    }
    try {
      const stmt = this._conn.prepare(sql);
      return params ? stmt.all(...params) : stmt.all();
    } catch (e) {
      throw new DatabaseError(`Query failed: ${e.message}`);
    }
  }

  openSync() {
    this.open();
    this.validate();
    return this;
  }

  [Symbol.dispose]() {
    this.close();
  }
}
