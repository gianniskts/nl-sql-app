"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_js_1 = require("./db.js");
(0, db_js_1.runMigrations)();
const insertContact = db_js_1.db.prepare('INSERT INTO contacts (first_name, last_name, created_at) VALUES (?, ?, ?)');
const insertCase = db_js_1.db.prepare('INSERT INTO cases (topic, created_at) VALUES (?, ?)');
const now = new Date();
db_js_1.db.transaction(() => {
    for (let i = 1; i <= 127; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        insertContact.run(`First${i}`, `Last${i}`, d.toISOString().slice(0, 10));
    }
    insertCase.run('Need help with billing', '2023-05-10');
    insertCase.run('Please help me login', '2024-11-20');
    insertCase.run('General inquiry', '2022-12-01');
    insertCase.run('Assistance required', '2026-01-01');
    insertCase.run('Bug report: crash on save', '2024-03-03');
})();
console.log('Seeded database.');
