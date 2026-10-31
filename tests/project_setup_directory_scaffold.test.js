const assert = require('assert');
const { ProjectSetupDirectoryScaffold } = require('../src/features/project_setup_directory_scaffold');

// Automated Unit Test Suite for Day 1 (Project setup, directory scaffolding, and environment config)
async function runTests() {
  const instance = new ProjectSetupDirectoryScaffold();
  assert.strictEqual(instance.status, 'ready', 'Instance should be in ready state');
  const result = await instance.execute({ testRun: true });
  assert.strictEqual(result.success, true, 'Execution should return success: true');
  assert.strictEqual(result.day, 1, 'Result day should match');
  console.log('✅ [PASS] All tests passed for Day 1: Project setup, directory scaffolding, and environment config');
}

if (require.main === module) {
  runTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runTests };
