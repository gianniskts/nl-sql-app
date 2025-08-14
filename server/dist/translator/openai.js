"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openAITranslator = openAITranslator;
// Uses OpenAI responses API if OPENAI_API_KEY is set. Otherwise do not export this translator.
function openAITranslator() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
        throw new Error('OPENAI_API_KEY is required for OpenAI translator');
    const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    async function call(prompt, schema) {
        const system = `You are a strict SQL generator for SQLite. Return ONLY SQL in a fenced block not needed, just plain SQL string, no prose. Only SELECT or WITH queries. Use the provided schema. Use COUNT(*) AS count when counting. Dates are stored as ISO strings.`;
        const schemaText = schema.tables
            .map((t) => `${t.table}(${t.columns.join(', ')})`)
            .join('\n');
        const content = `${system}\n\nSchema:\n${schemaText}\n\nUser question:\n${prompt}\n\nReturn the SQL only.`;
        // Use Responses API
        const res = await fetch(`${baseURL}/responses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                input: [{ role: 'user', content }],
            }),
        });
        if (!res.ok) {
            const t = await res.text();
            throw new Error(`OpenAI error: ${res.status} ${t}`);
        }
        const json = await res.json();
        // Extract text content; structure differs by SDK version; try common paths
        const text = json.output_text ?? json.response?.output_text ?? json.content?.[0]?.text ?? json.choices?.[0]?.message?.content;
        if (!text)
            throw new Error('No text in OpenAI response');
        return text.trim().replace(/^```[a-z]*\n?|```$/g, '');
    }
    return {
        async translate(prompt, schema) {
            const sql = await call(prompt, schema);
            return { sql, rationale: 'OpenAI responses API' };
        },
    };
}
