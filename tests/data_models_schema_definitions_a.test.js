const assert = require('assert');
const { DataModelsSchemaDefinitionsA } = require('../src/features/data_models_schema_definitions_a');

// Automated Unit Test Suite for Day 2 (Data models, schema definitions, and validation helpers)
async function runTests() {
  const instance = new DataModelsSchemaDefinitionsA();
  assert.strictEqual(instance.status, 'ready', 'Instance should be in ready state');
  const result = await instance.execute({ testRun: true });
  assert.strictEqual(result.success, true, 'Execution should return success: true');
  assert.strictEqual(result.day, 2, 'Result day should match');
  console.log('✅ [PASS] All tests passed for Day 2: Data models, schema definitions, and validation helpers');
}

if (require.main === module) {
  runTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runTests };
