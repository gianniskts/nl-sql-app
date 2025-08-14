"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ruleBasedTranslator = ruleBasedTranslator;
// A tiny fallback to support the two example prompts without external APIs.
function ruleBasedTranslator() {
    return {
        async translate(prompt, _schema) {
            const p = prompt.toLowerCase();
            if (p.includes('how many') && p.includes('contact')) {
                return {
                    sql: 'SELECT COUNT(*) AS count FROM contacts',
                    rationale: 'Rule-based: count rows in contacts',
                };
            }
            if (p.includes('how many') && p.includes('case') && p.includes('help')) {
                // between 2023 and 2025 inclusive
                return {
                    sql: `SELECT COUNT(*) AS count FROM cases WHERE lower(topic) LIKE '%help%' AND date(created_at) BETWEEN date('2023-01-01') AND date('2025-12-31')`,
                    rationale: 'Rule-based: count cases with topic like help within date range',
                };
            }
            // naive default: try to select all from a table mentioned
            const table = ['contacts', 'cases'].find((t) => p.includes(t));
            if (table) {
                return { sql: `SELECT * FROM ${table} LIMIT 50`, rationale: 'Rule-based default select' };
            }
            // last resort
            return { sql: 'SELECT 1 as noop LIMIT 1', rationale: 'No rule matched' };
        },
    };
}
