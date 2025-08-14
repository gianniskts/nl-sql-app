import { db, runMigrations } from './db.js';

runMigrations();

const insertContact = db.prepare('INSERT INTO contacts (first_name, last_name, created_at) VALUES (?, ?, ?)');
const insertCase = db.prepare('INSERT INTO cases (topic, created_at) VALUES (?, ?)');

const now = new Date();

db.transaction(() => {
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
