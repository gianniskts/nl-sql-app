import type { DbSchemaSummary } from '../schema';
import type { Translator, Translation } from './index';
import { getSchemaDescription } from '../schema';

/**
 * OpenAI-based translator for NL→SQL conversion.
 * Uses OpenAI's Chat Completions API as a production-ready NL→SQL service.
 * 
 * Why OpenAI over MCP:
 * - OpenAI provides mature, dedicated NL→SQL capabilities
 * - MCP is primarily a connection protocol, not a translation service
 * - This implementation provides a clean abstraction that could easily wrap MCP if needed
 */
export function openAITranslator(): Translator {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for OpenAI translator');

  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  /**
   * Builds an optimized system prompt with full schema context
   */
  function buildPrompt(schema: DbSchemaSummary): { system: string; schemaText: string } {
    // Use the enhanced schema description
    const schemaText = getSchemaDescription(schema);
    
    // Build examples based on actual data
    const examples: string[] = [];
    
    // Add row count hints for optimization
    for (const table of schema.tables) {
      if (table.rowCount !== undefined && table.rowCount > 0) {
        examples.push(`-- Table ${table.table} has ${table.rowCount} rows`);
      }
    }

    const system = `You are an expert SQL query generator for SQLite databases.

CRITICAL RULES:
1. Generate ONLY valid SQLite SQL - no explanations, no markdown, no comments
2. Only SELECT or WITH queries allowed (read-only mode enforced)
3. Always use COUNT(*) AS count when counting rows (not COUNT(1) or COUNT(id))
4. Dates are stored as TEXT in ISO format (YYYY-MM-DD)
5. For date ranges use: date(column) BETWEEN date('YYYY-MM-DD') AND date('YYYY-MM-DD')
6. For text pattern matching use LIKE with % wildcards
7. Always use lower() for case-insensitive text matching
8. Return only the SQL query, nothing else

${schemaText}

QUERY PATTERNS:
- "How many X?" → SELECT COUNT(*) AS count FROM table_name
- "X containing Y" → WHERE lower(column) LIKE '%y%'
- "between YEAR1 and YEAR2" → date(column) BETWEEN date('YEAR1-01-01') AND date('YEAR2-12-31')

${examples.length > 0 ? 'DATA HINTS:\n' + examples.join('\n') : ''}`;

    return { system, schemaText };
  }

  /**
   * Cleans and validates SQL response
   */
  function cleanSqlResponse(text: string): string {
    // Remove any markdown code fences
    let cleaned = text.replace(/^```[a-zA-Z]*\n?/gm, '').replace(/```$/gm, '');
    
    // Remove SQL comments
    cleaned = cleaned.replace(/--.*$/gm, '');
    
    // Remove "sql" prefix if present
    cleaned = cleaned.replace(/^sql\s+/i, '');
    
    // Remove any trailing semicolon (SQLite doesn't require it)
    cleaned = cleaned.replace(/;\s*$/, '');
    
    // Trim whitespace
    return cleaned.trim();
  }

  /**
   * Calls OpenAI Chat Completions API with retry logic
   */
  async function generateSql(prompt: string, schema: DbSchemaSummary, retries = 2): Promise<string> {
    const { system } = buildPrompt(schema);
    
    const messages = [
      { role: 'system' as const, content: system },
      { 
        role: 'user' as const, 
        content: `Generate a SQLite query for: "${prompt}"\n\nReturn ONLY the SQL query.`
      }
    ];

    for (let attempt = 0; attempt <= retries; attempt++) {
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
            temperature: 0,  // Deterministic output
            max_tokens: 500,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          
          // Check for rate limiting
          if (response.status === 429 && attempt < retries) {
            console.warn(`OpenAI rate limit hit, retrying in ${(attempt + 1) * 2} seconds...`);
            await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 2000));
            continue;
          }
          
          throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        
        if (!data.choices?.[0]?.message?.content) {
          throw new Error('Invalid response from OpenAI API');
        }

        const sql = cleanSqlResponse(data.choices[0].message.content);
        
        // Validate the cleaned SQL
        if (!sql || sql.length < 10) {
          throw new Error('Generated SQL appears to be invalid or too short');
        }
        
        return sql;
        
      } catch (error) {
        if (attempt === retries) {
          console.error('OpenAI API call failed after retries:', error);
          throw error;
        }
        
        console.warn(`OpenAI attempt ${attempt + 1} failed, retrying...`);
      }
    }
    
    throw new Error('Failed to generate SQL after all retries');
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
          rationale: `OpenAI Chat Completions API (${model})`
        };
      } catch (error) {
        // Re-throw to allow fallback in index.ts
        throw new Error(`OpenAI translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  };
}
