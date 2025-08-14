"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSchemaSummary = getSchemaSummary;
function getSchemaSummary(db) {
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_migrations'`).all();
    const result = [];
    for (const t of tables) {
        const pragma = db.prepare(`PRAGMA table_info(${t.name})`).all();
        result.push({ table: t.name, columns: pragma.map((p) => p.name) });
    }
    return { dialect: 'sqlite', tables: result };
}
