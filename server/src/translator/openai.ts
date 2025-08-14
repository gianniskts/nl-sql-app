import type { DbSchemaSummary } from '../schema';
import type { Translator, Translation } from './index';

// Uses OpenAI responses API if OPENAI_API_KEY is set. Otherwise do not export this translator.
export function openAITranslator(): Translator {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for OpenAI translator');

  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  function buildSystem(schema: DbSchemaSummary) {
    const schemaText = schema.tables.map((t) => `${t.table}(${t.columns.join(', ')})`).join('\n');
    return {
      system: `You are a strict SQL generator for SQLite. Return ONLY SQL (no prose). Only SELECT or WITH queries. Use the provided schema. Use COUNT(*) AS count for counts. Dates are ISO (YYYY-MM-DD).`,
      schemaText,
    };
  }

  function stripFences(s: string) {
    return s.replace(/^```[a-zA-Z]*\n?|```$/g, '').trim();
  }

  function extractFromResponses(json: any): string | undefined {
    if (!json) return undefined;
    if (typeof json.output_text === 'string') return json.output_text;
    if (json.response?.output_text) return json.response.output_text;
    // Some responses produce an array of content blocks
    const blocks = json.output || json.content || json.response?.content;
    if (Array.isArray(blocks)) {
      for (const b of blocks) {
        // Claude-style blocks
        if (typeof b?.text === 'string') return b.text;
        if (Array.isArray(b?.content)) {
          const textPart = b.content.find((c: any) => c.type === 'output_text' || c.type === 'text' || typeof c?.text === 'string');
          if (textPart) return textPart.text ?? textPart;
        }
      }
    }
    // Fallback to OpenAI-like choices
    const choice = json.choices?.[0];
    const content = choice?.message?.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) return content.map((p: any) => (p.text ?? p)).join('');
    return undefined;
  }

  async function callResponses(prompt: string, schema: DbSchemaSummary): Promise<string> {
    const { system, schemaText } = buildSystem(schema);
    const user = `${system}\n\nSchema:\n${schemaText}\n\nUser question:\n${prompt}\n\nReturn the SQL only.`;
    const res = await fetch(`${baseURL}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, input: [{ role: 'user', content: user }] }),
    });
    if (!res.ok) throw new Error(`OpenAI responses ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const text = extractFromResponses(json);
    if (!text) throw new Error('No text in OpenAI response');
    return stripFences(text);
  }

  async function callChat(prompt: string, schema: DbSchemaSummary): Promise<string> {
    const { system, schemaText } = buildSystem(schema);
    const messages = [
      { role: 'system', content: system + '\n\nSchema:\n' + schemaText },
      { role: 'user', content: `User question:\n${prompt}\n\nReturn the SQL only.` },
    ];
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, temperature: 0 }),
    });
    if (!res.ok) throw new Error(`OpenAI chat ${res.status}: ${await res.text()}`);
    const json: any = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error('No text in chat response');
    return stripFences(typeof content === 'string' ? content : String(content));
  }

  async function call(prompt: string, schema: DbSchemaSummary): Promise<string> {
    try {
      return await callResponses(prompt, schema);
    } catch {
      // Falling back to chat if Responses API shape or access fails
      return await callChat(prompt, schema);
    }
  }

  return {
    async translate(prompt: string, schema: DbSchemaSummary): Promise<Translation> {
  const sql = await call(prompt, schema);
      return { sql, rationale: 'OpenAI responses API' };
    },
  };
}
