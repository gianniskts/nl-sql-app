import type { DbSchemaSummary } from '../schema';
import type { Translator, Translation } from './index';

/**
 * OpenAI-based translator for NL→SQL conversion.
 * Uses OpenAI's Chat Completions API as a widely-recognized NL→SQL service.
 */
export function openAITranslator(): Translator {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for OpenAI translator');

  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  /**
   * Builds system prompt with schema context
   */
  function buildPrompt(schema: DbSchemaSummary): { system: string; schemaText: string } {
    const schemaText = schema.tables
      .map((t) => `Table: ${t.table}\nColumns: ${t.columns.join(', ')}`)
      .join('\n\n');

    const system = `You are a SQL query generator for SQLite databases.

RULES:
1. Generate ONLY valid SQLite SQL - no explanations, no markdown
2. Only SELECT or WITH queries allowed (read-only)
3. Use COUNT(*) AS count when counting rows
4. Dates are stored as TEXT in ISO format (YYYY-MM-DD)
5. For date comparisons use: date(column) BETWEEN date('YYYY-MM-DD') AND date('YYYY-MM-DD')
6. For text matching use LIKE with % wildcards
7. Use lower() for case-insensitive matching

DATABASE SCHEMA:
${schemaText}`;

    return { system, schemaText };
  }

  /**
   * Strips markdown code fences if present
   */
  function cleanSqlResponse(text: string): string {
    // Remove markdown code fences
    let cleaned = text.replace(/^```[a-zA-Z]*\n?/gm, '').replace(/```$/gm, '');
    // Remove "sql" prefix if present
    cleaned = cleaned.replace(/^sql\s+/i, '');
    // Trim whitespace
    return cleaned.trim();
  }

  /**
   * Calls OpenAI Chat Completions API
   */
  async function generateSql(prompt: string, schema: DbSchemaSummary): Promise<string> {
    const { system } = buildPrompt(schema);
    
    const messages = [
      { role: 'system' as const, content: system },
      { 
        role: 'user' as const, 
        content: `Generate SQL for this question: ${prompt}\n\nReturn ONLY the SQL query, nothing else.`
      }
    ];

    try {
      const response = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.choices?.[0]?.message?.content) {
        throw new Error('Invalid response from OpenAI API');
      }

      return cleanSqlResponse(data.choices[0].message.content);
    } catch (error) {
      console.error('OpenAI API call failed:', error);
      throw error;
    }
  }

  return {
    async translate(prompt: string, schema: DbSchemaSummary): Promise<Translation> {
      try {
        const sql = await generateSql(prompt, schema);
        
        // Validate it's a SELECT query
        const normalizedSql = sql.toLowerCase().trim();
        if (!normalizedSql.startsWith('select') && !normalizedSql.startsWith('with')) {
          throw new Error('Generated non-SELECT query');
        }

        return { 
          sql, 
          rationale: 'OpenAI Chat Completions API (gpt-4o-mini)' 
        };
      } catch (error) {
        // Re-throw to allow fallback in index.ts
        throw new Error(`OpenAI translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  };
}
