"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chooseTranslator = chooseTranslator;
const openai_1 = require("./openai");
const rulebased_1 = require("./rulebased");
/**
 * Factory function to choose the appropriate translator.
 * Prioritizes OpenAI if configured, falls back to rule-based.
 */
function chooseTranslator() {
    const fallback = (0, rulebased_1.ruleBasedTranslator)();
    // Check if we should force a specific translator
    const forcedTranslator = process.env.TRANSLATOR?.toLowerCase();
    if (forcedTranslator === 'rulebased') {
        console.log('Using rule-based translator (forced)');
        return fallback;
    }
    // Try to use OpenAI if API key is available
    if (process.env.OPENAI_API_KEY) {
        console.log('Using OpenAI translator with fallback');
        try {
            const primary = (0, openai_1.openAITranslator)();
            // Return a wrapper that falls back on error
            return {
                async translate(prompt, schema) {
                    try {
                        const result = await primary.translate(prompt, schema);
                        return result;
                    }
                    catch (error) {
                        console.warn('OpenAI translation failed, using fallback:', error);
                        const fallbackResult = await fallback.translate(prompt, schema);
                        return {
                            ...fallbackResult,
                            rationale: `${fallbackResult.rationale} (OpenAI unavailable)`
                        };
                    }
                },
            };
        }
        catch (error) {
            console.warn('Failed to initialize OpenAI translator:', error);
        }
    }
    // Default to rule-based translator
    console.log('Using rule-based translator (no API key)');
    return fallback;
}
