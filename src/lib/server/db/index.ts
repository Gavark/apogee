import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema';

export function createDb(path: string) {
  // better-sqlite3 fails if the parent directory is missing (fresh checkout).
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('synchronous = NORMAL');
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

let _db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (_db) return _db;
  const path = process.env.DATABASE_PATH ?? './data/apogee.sqlite';
  _db = createDb(path);
  return _db;
}

export { schema };
