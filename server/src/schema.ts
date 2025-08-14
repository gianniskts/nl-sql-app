import type BetterSqlite3 from 'better-sqlite3';

export type TableSchema = {
  table: string;
  columns: string[];
};

export type DbSchemaSummary = {
  dialect: 'sqlite';
  tables: TableSchema[];
};

export function getSchemaSummary(db: BetterSqlite3.Database): DbSchemaSummary {
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_migrations'`).all() as { name: string }[];
  const result: TableSchema[] = [];
  for (const t of tables) {
    const pragma = db.prepare(`PRAGMA table_info(${t.name})`).all() as { name: string }[];
    result.push({ table: t.name, columns: pragma.map((p) => p.name) });
  }
  return { dialect: 'sqlite', tables: result };
}
