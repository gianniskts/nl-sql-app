import { db, runMigrations } from './db';
import { getSchemaSummary } from './schema';
import { chooseTranslator } from './translator';

/**
 * Integration test to verify the complete pipeline works correctly
 * for the required example prompts.
 */
async function runIntegrationTests() {
  console.log('🧪 Running Integration Tests\n');
  console.log('=' .repeat(50));
  
  // Initialize database
  console.log('\n📦 Setting up database...');
  runMigrations();
  
  // Clear and seed data
  db.prepare('DELETE FROM contacts').run();
  db.prepare('DELETE FROM cases').run();
  
  // Seed exactly 127 contacts
  const insertContact = db.prepare('INSERT INTO contacts (first_name, last_name, created_at) VALUES (?, ?, ?)');
  const now = new Date();
  
  db.transaction(() => {
    for (let i = 1; i <= 127; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      insertContact.run(`First${i}`, `Last${i}`, d.toISOString().slice(0, 10));
    }
  })();
  
  // Seed cases with exactly 2 matching 'help' between 2023-2025
  const insertCase = db.prepare('INSERT INTO cases (topic, created_at) VALUES (?, ?)');
  db.transaction(() => {
    insertCase.run('Need help with billing', '2023-05-10');
    insertCase.run('Please help me login', '2024-11-20');
    insertCase.run('General inquiry', '2022-12-01');
    insertCase.run('Assistance required', '2026-01-01');
    insertCase.run('Bug report: crash on save', '2024-03-03');
  })();
  
  console.log('✅ Database seeded');
  console.log('   - 127 contacts');
  console.log('   - 5 cases (2 with "help" between 2023-2025)');
  
  // Get schema and translator
  const schema = getSchemaSummary(db);
  const translator = chooseTranslator();
  
  console.log('\n🔄 Using translator:', process.env.OPENAI_API_KEY ? 'OpenAI' : 'Rule-based');
  console.log('\n' + '=' .repeat(50));
  
  // Test cases
  const tests = [
    {
      name: 'Example 1: Count contacts',
      prompt: 'How many contacts do I have in my database?',
      expectedCount: 127,
      expectedSummary: '127 contacts',
    },
    {
      name: 'Example 2: Count cases with help',
      prompt: 'How many cases with topic containing \'help\' between 2023 and 2025?',
      expectedCount: 2,
      expectedSummary: '2 cases',
    },
  ];
  
  let allPassed = true;
  
  for (const test of tests) {
    console.log(`\n📝 Test: ${test.name}`);
    console.log(`   Prompt: "${test.prompt}"`);
    
    try {
      // Translate to SQL
      const { sql, rationale } = await translator.translate(test.prompt, schema);
      console.log(`   SQL: ${sql}`);
      console.log(`   Translator: ${rationale}`);
      
      // Validate it's a SELECT query
      if (!sql.toLowerCase().trim().startsWith('select') && 
          !sql.toLowerCase().trim().startsWith('with')) {
        throw new Error('Generated non-SELECT query');
      }
      
      // Execute query
      const stmt = db.prepare(sql);
      const rows = stmt.all();
      
      // Extract count from result
      const firstRow = rows[0] as any;
      const count = firstRow?.count ?? firstRow?.COUNT ?? firstRow?.c ?? 0;
      
      // Validate result
      if (Number(count) === test.expectedCount) {
        console.log(`   ✅ Result: ${count} (expected ${test.expectedCount})`);
      } else {
        console.log(`   ❌ Result: ${count} (expected ${test.expectedCount})`);
        allPassed = false;
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error}`);
      allPassed = false;
    }
  }
  
  console.log('\n' + '=' .repeat(50));
  
  if (allPassed) {
    console.log('\n✅ All integration tests passed!\n');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed\n');
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runIntegrationTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
