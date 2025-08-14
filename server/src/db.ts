import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = path.join(process.cwd(), 'server', 'data', 'app.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

type Migration = { id: number; sql: string };

const migrations: Migration[] = [
  {
    id: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY
      );
    `,
  },
];

function hasMigration(id: number): boolean {
  try {
    const row = db.prepare('SELECT id FROM _migrations WHERE id = ?').get(id);
    return !!row;
  } catch {
    return false;
  }
}

export function runMigrations() {
  for (const m of migrations) {
    if (!hasMigration(m.id)) {
      db.exec(m.sql);
      db.prepare('INSERT OR IGNORE INTO _migrations (id) VALUES (?)').run(m.id);
    }
  }
}
