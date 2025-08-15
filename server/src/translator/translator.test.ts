import { ruleBasedTranslator } from './rulebased';
import type { DbSchemaSummary } from '../schema';

// Mock schema
const mockSchema: DbSchemaSummary = {
  dialect: 'sqlite',
  tables: [
    { table: 'contacts', columns: ['id', 'first_name', 'last_name', 'created_at'] },
    { table: 'cases', columns: ['id', 'topic', 'created_at'] },
  ],
};

async function runTests() {
  console.log('Running translator tests...\n');
  
  const translator = ruleBasedTranslator();
  let passed = 0;
  let failed = 0;

  // Test cases
  const tests = [
    {
      name: 'Example 1: Count contacts',
      prompt: 'How many contacts do I have in my database?',
      expectedSql: 'SELECT COUNT(*) AS count FROM contacts',
    },
    {
      name: 'Example 2: Count cases with help between dates',
      prompt: 'How many cases with topic containing \'help\' between 2023 and 2025?',
      expectedSql: `SELECT COUNT(*) AS count FROM cases WHERE lower(topic) LIKE '%help%' AND date(created_at) BETWEEN date('2023-01-01') AND date('2025-12-31')`,
    },
    {
      name: 'Variation: Count all cases',
      prompt: 'How many cases are there?',
      expectedSql: 'SELECT COUNT(*) AS count FROM cases',
    },
  ];

  for (const test of tests) {
    try {
      const result = await translator.translate(test.prompt, mockSchema);
      
      if (result.sql === test.expectedSql) {
        console.log(`✅ ${test.name}`);
        console.log(`   Prompt: "${test.prompt}"`);
        console.log(`   SQL: ${result.sql}`);
        console.log(`   Rationale: ${result.rationale}\n`);
        passed++;
      } else {
        console.log(`❌ ${test.name}`);
        console.log(`   Prompt: "${test.prompt}"`);
        console.log(`   Expected: ${test.expectedSql}`);
        console.log(`   Got: ${result.sql}\n`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name} - Error: ${error}\n`);
      failed++;
    }
  }

  console.log('---');
  console.log(`Tests: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}
