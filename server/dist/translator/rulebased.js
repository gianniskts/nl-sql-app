"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ruleBasedTranslator = ruleBasedTranslator;
/**
 * Rule-based fallback translator for the two required example prompts.
 * Ensures the demo works without external API dependencies.
 */
function ruleBasedTranslator() {
    return {
        async translate(prompt, _schema) {
            const normalizedPrompt = prompt.toLowerCase().trim();
            // Example 1: "How many contacts do I have in my database?"
            if (normalizedPrompt.includes('how many') && normalizedPrompt.includes('contact')) {
                return {
                    sql: 'SELECT COUNT(*) AS count FROM contacts',
                    rationale: 'Rule-based: counting contacts',
                };
            }
            // Example 2: "How many cases with topic containing 'help' between 2023 and 2025?"
            if (normalizedPrompt.includes('how many') &&
                normalizedPrompt.includes('case') &&
                normalizedPrompt.includes('help')) {
                // Check if date range is mentioned
                const has2023 = normalizedPrompt.includes('2023');
                const has2025 = normalizedPrompt.includes('2025');
                if (has2023 && has2025) {
                    return {
                        sql: `SELECT COUNT(*) AS count FROM cases WHERE lower(topic) LIKE '%help%' AND date(created_at) BETWEEN date('2023-01-01') AND date('2025-12-31')`,
                        rationale: 'Rule-based: counting cases with help in topic between 2023-2025',
                    };
                }
                // Without date range, just count cases with 'help'
                return {
                    sql: `SELECT COUNT(*) AS count FROM cases WHERE lower(topic) LIKE '%help%'`,
                    rationale: 'Rule-based: counting cases with help in topic',
                };
            }
            // Handle other count queries
            if (normalizedPrompt.includes('count') || normalizedPrompt.includes('how many')) {
                if (normalizedPrompt.includes('contact')) {
                    return {
                        sql: 'SELECT COUNT(*) AS count FROM contacts',
                        rationale: 'Rule-based: counting contacts',
                    };
                }
                if (normalizedPrompt.includes('case')) {
                    return {
                        sql: 'SELECT COUNT(*) AS count FROM cases',
                        rationale: 'Rule-based: counting cases',
                    };
                }
            }
            // Try to select from mentioned table
            if (normalizedPrompt.includes('contact')) {
                return {
                    sql: 'SELECT * FROM contacts LIMIT 50',
                    rationale: 'Rule-based: selecting contacts'
                };
            }
            if (normalizedPrompt.includes('case')) {
                return {
                    sql: 'SELECT * FROM cases LIMIT 50',
                    rationale: 'Rule-based: selecting cases'
                };
            }
            // Last resort - safe no-op query
            return {
                sql: 'SELECT 1 as result',
                rationale: 'Rule-based: no pattern matched'
            };
        },
    };
}
