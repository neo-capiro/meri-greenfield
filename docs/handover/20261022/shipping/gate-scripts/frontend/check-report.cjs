const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const [reportPath, frontend] = process.argv.slice(2);
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const packet = JSON.parse(fs.readFileSync(path.join(frontend,
  'docs/a1-settings/work-browser-fixture-correction-20261022/SKIPPED-TESTS.json'), 'utf8'));
const joined = packet.skippedFiles.flatMap(file => file.tests.map(test => test.name));
const generic = ['comments', 'comment create', 'comment update', 'comment delete',
  'comment suggestion', 'checks', 'lock status', 'lock acquire', 'lock heartbeat',
  'lock release', 'lock request', 'lock take-over', 'anonymization'];
const typed = ['workspace.comments', 'workspace.comment.create', 'workspace.comment.resolve'];
const adjacent = ['documents list', 'quality fix', 'version list', 'version create', 'version restore'];
const expected = [
  ...generic.map(name => "generic '" + name + "' preserves an opaque refusal and forwards only trusted authority"),
  ...typed.map(name => "typed '" + name + "' preserves an opaque refusal and forwards only trusted authority"),
  ...adjacent.map(name => "generic '" + name + "' preserves opaque upstream 404"),
  ...joined,
].sort();
const cases = report.testResults.flatMap(file => file.assertionResults);
assert.equal(joined.length, 36);
assert.equal(expected.length, 57);
assert.equal(new Set(expected).size, 57);
assert.equal(report.success, true);
assert.equal(report.numTotalTests, 57);
assert.equal(report.numPassedTests, 57);
assert.equal(report.numFailedTests, 0);
assert.equal(report.numPendingTests, 0);
assert.equal(report.numTodoTests ?? 0, 0);
assert.equal(cases.length, 57);
assert(cases.every(test => test.status === 'passed'));
assert.deepEqual(cases.map(test => test.fullName).sort(), expected);
console.log(JSON.stringify({ total: 57, standalone: 21, joined: 36,
  failed: 0, skipped: 0, names: expected }, null, 2));
