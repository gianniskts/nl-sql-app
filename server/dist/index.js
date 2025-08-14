"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const db_1 = require("./db");
const schema_1 = require("./schema");
const translator_1 = require("./translator");
const zod_1 = require("zod");
const PORT = Number(process.env.PORT || 3001);
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'], credentials: false }));
app.use(express_1.default.json());
(0, db_1.runMigrations)();
// Seed data if empty
(function seedIfNeeded() {
    const contactCount = db_1.db.prepare('SELECT COUNT(*) as c FROM contacts').get();
    if (contactCount.c === 0) {
        const insertContact = db_1.db.prepare('INSERT INTO contacts (first_name, last_name, created_at) VALUES (?, ?, ?)');
        const now = new Date();
        db_1.db.transaction(() => {
            for (let i = 1; i <= 127; i++) {
                const d = new Date(now);
                d.setDate(now.getDate() - i);
                insertContact.run(`First${i}`, `Last${i}`, d.toISOString().slice(0, 10));
            }
        })();
    }
    const caseCount = db_1.db.prepare('SELECT COUNT(*) as c FROM cases').get();
    if (caseCount.c === 0) {
        const insertCase = db_1.db.prepare('INSERT INTO cases (topic, created_at) VALUES (?, ?)');
        db_1.db.transaction(() => {
            // Two that match: contain 'help' between 2023 and 2025
            insertCase.run('Need help with billing', '2023-05-10');
            insertCase.run('Please help me login', '2024-11-20');
            // Non-matching
            insertCase.run('General inquiry', '2022-12-01');
            insertCase.run('Assistance required', '2026-01-01');
            insertCase.run('Bug report: crash on save', '2024-03-03');
        })();
    }
})();
app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
});
const QueryBody = zod_1.z.object({ prompt: zod_1.z.string().min(1) });
app.post('/api/query', async (req, res) => {
    const parsed = QueryBody.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    }
    const { prompt } = parsed.data;
    try {
        const schema = (0, schema_1.getSchemaSummary)(db_1.db);
        const translator = (0, translator_1.chooseTranslator)();
        const { sql, rationale } = await translator.translate(prompt, schema);
        // Guardrails: SELECT only
        const firstToken = sql.trim().toLowerCase().split(/\s+/)[0];
        if (firstToken !== 'select' && !sql.trim().toLowerCase().startsWith('with')) {
            return res.status(400).json({ error: 'Only SELECT queries are allowed', sql });
        }
        const stmt = db_1.db.prepare(sql);
        const rows = stmt.all();
        // Create a simple summary if it's a count
        let summary;
        const lower = prompt.toLowerCase();
        if (/how many|count/.test(lower)) {
            const aliasRow = rows[0];
            const countVal = aliasRow ? (aliasRow.count ?? aliasRow.c ?? Object.values(aliasRow)[0]) : undefined;
            const n = typeof countVal === 'number' ? countVal : Number(countVal);
            const subject = lower.includes('contact') ? 'contacts' : lower.includes('case') ? 'cases' : 'rows';
            if (!Number.isNaN(n))
                summary = `${n} ${subject}`;
        }
        console.log('--- NL Prompt ---');
        console.log(prompt);
        console.log('--- Generated SQL ---');
        console.log(sql);
        console.log('--- Result ---');
        console.log(summary ?? rows);
        res.json({ sql, rows, summary, rationale });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to process query', details: err?.message ?? String(err) });
    }
});
app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
