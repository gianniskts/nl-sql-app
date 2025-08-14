"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chooseTranslator = chooseTranslator;
const openai_1 = require("./openai");
const rulebased_1 = require("./rulebased");
function chooseTranslator() {
    if (process.env.OPENAI_API_KEY)
        return (0, openai_1.openAITranslator)();
    return (0, rulebased_1.ruleBasedTranslator)();
}
