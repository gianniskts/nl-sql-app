"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const db_1 = require("./db");
const schema_1 = require("./schema");
const translator_1 = require("./translator");
const zod_1 = require("zod");
(() => {
    const distDir = __dirname; // server/dist in prod, server/src in dev
    const serverEnv = node_path_1.default.join(distDir, '..', '.env');
    const rootEnv = node_path_1.default.join(distDir, '..', '..', '.env');
    if (node_fs_1.default.existsSync(serverEnv)) {
        dotenv_1.default.config({ path: serverEnv });
    }
    else if (node_fs_1.default.existsSync(rootEnv)) {
        dotenv_1.default.config({ path: rootEnv });
    }
    else {
        dotenv_1.default.config();
    }
})();
const PORT = Number(process.env.PORT || 3001);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const app = (0, express_1.default)();
// CORS configuration
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173', 'http://localhost:3001'],
    credentials: false
}));
app.use(express_1.default.json());
// Initialize database
console.log('Initializing database...');
(0, db_1.runMigrations)();
// Seed data if needed
(function seedIfNeeded() {
    const contactCount = db_1.db.prepare('SELECT COUNT(*) as c FROM contacts').get();
    if (contactCount.c === 0) {
        console.log('Seeding contacts...');
        const insertContact = db_1.db.prepare('INSERT INTO contacts (first_name, last_name, created_at) VALUES (?, ?, ?)');
        const now = new Date();
        db_1.db.transaction(() => {
            for (let i = 1; i <= 127; i++) {
                const d = new Date(now);
                d.setDate(now.getDate() - i);
                insertContact.run(`First${i}`, `Last${i}`, d.toISOString().slice(0, 10));
            }
        })();
        console.log('Seeded 127 contacts');
    }
    const caseCount = db_1.db.prepare('SELECT COUNT(*) as c FROM cases').get();
    if (caseCount.c === 0) {
        console.log('Seeding cases...');
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
        console.log('Seeded 5 cases (2 matching "help" between 2023-2025)');
    }
})();
// Health check endpoint
app.get('/api/health', (_req, res) => {
    res.json({
        ok: true,
        translator: process.env.OPENAI_API_KEY ? 'openai' : 'rulebased',
        database: 'sqlite',
        tables: (0, schema_1.getSchemaSummary)(db_1.db).tables.map(t => t.table)
    });
});
// Main query endpoint
const QueryBody = zod_1.z.object({
    prompt: zod_1.z.string().min(1).max(1000)
});
app.post('/api/query', async (req, res) => {
    const parsed = QueryBody.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            error: 'Invalid request',
            details: parsed.error.flatten()
        });
    }
    const { prompt } = parsed.data;
    try {
        // Get schema and translator
        const schema = (0, schema_1.getSchemaSummary)(db_1.db);
        const translator = (0, translator_1.chooseTranslator)();
        // Translate to SQL
        console.log('\n--- NL Prompt ---');
        console.log(prompt);
        const { sql, rationale } = await translator.translate(prompt, schema);
        console.log('--- Generated SQL ---');
        console.log(sql);
        console.log(`--- Translator: ${rationale} ---`);
        // Safety check: SELECT-only queries
        const normalizedSql = sql.trim().toLowerCase();
        if (!normalizedSql.startsWith('select') && !normalizedSql.startsWith('with')) {
            console.log('--- BLOCKED: Non-SELECT query ---');
            return res.status(400).json({
                error: 'Only SELECT queries are allowed for safety',
                sql
            });
        }
        // Execute query
        const stmt = db_1.db.prepare(sql);
        const rows = stmt.all();
        // Generate summary for count queries
        let summary;
        const lowerPrompt = prompt.toLowerCase();
        if (lowerPrompt.includes('how many') || lowerPrompt.includes('count')) {
            const firstRow = rows[0];
            if (firstRow) {
                // Try common count aliases
                const countValue = firstRow.count ?? firstRow.COUNT ?? firstRow.c ?? Object.values(firstRow)[0];
                const count = Number(countValue);
                if (!Number.isNaN(count)) {
                    // Determine subject from prompt
                    let subject = 'results';
                    if (lowerPrompt.includes('contact')) {
                        subject = count === 1 ? 'contact' : 'contacts';
                    }
                    else if (lowerPrompt.includes('case')) {
                        subject = count === 1 ? 'case' : 'cases';
                    }
                    summary = `${count} ${subject}`;
                }
            }
        }
        console.log('--- Result ---');
        console.log(summary || `${rows.length} rows returned`);
        if (rows.length > 0 && rows.length <= 5) {
            console.table(rows);
        }
        // Return response
        res.json({
            sql,
            rows,
            summary,
            rationale
        });
    }
    catch (error) {
        console.error('--- Error ---');
        console.error(error);
        res.status(500).json({
            error: 'Failed to process query',
            details: error?.message ?? String(error)
        });
    }
});
// Serve static files in production
if (IS_PRODUCTION) {
    const clientPath = node_path_1.default.join(__dirname, '../../client/dist');
    app.use(express_1.default.static(clientPath));
    // Fallback to index.html for client-side routing
    app.get('*', (_req, res) => {
        res.sendFile(node_path_1.default.join(clientPath, 'index.html'));
    });
}
// Start server
app.listen(PORT, () => {
    console.log(`\n✅ Server ready`);
    console.log(`   API: http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    if (!IS_PRODUCTION) {
        console.log(`   Frontend: http://localhost:5173 (run separately)`);
    }
    console.log(`   Translator: ${process.env.OPENAI_API_KEY ? 'OpenAI with fallback' : 'Rule-based'}`);
});
