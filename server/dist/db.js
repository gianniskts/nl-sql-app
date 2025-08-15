"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.runMigrations = runMigrations;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const DB_PATH = node_path_1.default.join(process.cwd(), 'server', 'data', 'app.db');
node_fs_1.default.mkdirSync(node_path_1.default.dirname(DB_PATH), { recursive: true });
exports.db = new better_sqlite3_1.default(DB_PATH);
exports.db.pragma('journal_mode = WAL');
const migrations = [
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
function hasMigration(id) {
    try {
        const row = exports.db.prepare('SELECT id FROM _migrations WHERE id = ?').get(id);
        return !!row;
    }
    catch {
        return false;
    }
}
function runMigrations() {
    for (const m of migrations) {
        if (!hasMigration(m.id)) {
            exports.db.exec(m.sql);
            exports.db.prepare('INSERT OR IGNORE INTO _migrations (id) VALUES (?)').run(m.id);
        }
    }
}
