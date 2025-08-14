import { type DbSchemaSummary } from '../schema';
import { openAITranslator } from './openai';
import { ruleBasedTranslator } from './rulebased';

export type Translation = { sql: string; rationale?: string };

export interface Translator {
  translate(prompt: string, schema: DbSchemaSummary): Promise<Translation>;
}

export function chooseTranslator(): Translator {
  const fallback = ruleBasedTranslator();
  const force = (process.env.TRANSLATOR || '').toLowerCase();
  if (force === 'rulebased') return fallback;
  if (force === 'openai' || process.env.OPENAI_API_KEY) {
    const primary = openAITranslator();
    return {
      async translate(prompt, schema) {
        try {
          return await primary.translate(prompt, schema);
        } catch (e) {
          return fallback.translate(prompt, schema);
        }
      },
    };
  }
  return fallback;
}
