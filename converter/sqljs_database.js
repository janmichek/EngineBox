import { Buffer } from 'buffer';
import { DatabaseError } from './errors.js';

function normalizeValue(value) {
  if (value instanceof Uint8Array) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }
  return value;
}

function rowFromColumns(columns, values) {
  const row = {};
  for (let i = 0; i < columns.length; i++) {
    row[columns[i]] = normalizeValue(values[i]);
  }
  return row;
}

/** Read-only sql.js adapter matching ReadOnlyDatabase.query(). */
export class SqlJsDatabase {
  constructor(SQL, data) {
    this._SQL = SQL;
    this._data = data;
    this._conn = null;
  }

  open() {
    try {
      this._conn = new this._SQL.Database(this._data);
    } catch (e) {
      throw new DatabaseError(`Failed to open database: ${e.message}`);
    }
  }

  close() {
    this._conn?.close();
    this._conn = null;
  }

  validate() {
    if (!this._conn) throw new DatabaseError('Database not open');
    try {
      const rows = this._conn.exec('PRAGMA schema_version');
      const version = rows?.[0]?.values?.[0]?.[0] ?? 0;
      if (version < 1) throw new DatabaseError(`Invalid schema version: ${version}`);
    } catch (e) {
      if (e instanceof DatabaseError) throw e;
      throw new DatabaseError(`Failed to validate database: ${e.message}`);
    }
  }

  query(sql, params) {
    if (!this._conn) throw new DatabaseError('Database not open');
    try {
      const stmt = this._conn.prepare(sql);
      try {
        if (params?.length) stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
          rows.push(rowFromColumns(stmt.getColumnNames(), stmt.get()));
        }
        return rows;
      } finally {
        stmt.free();
      }
    } catch (e) {
      throw new DatabaseError(`Query failed: ${e.message}`);
    }
  }

  openSync() {
    this.open();
    this.validate();
    return this;
  }
}
