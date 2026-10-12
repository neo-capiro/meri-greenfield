// Local source-data consistency only. Never imports/executes target Python.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const dir = 'docs/qualification/candidates/native-python-profile-20261012/author/';
const read = path => readFileSync(path, 'utf8');
const packet = JSON.parse(read(dir + 'profile-packet.json'));
const identities = JSON.parse(read(dir + 'source-identities.json'));
const results = [];
function check(name, body) { body(); results.push({ name, passed: true }); }
check('six original source identities', () => {
  assert.equal(identities.files.length, 6);
  for (const row of identities.files) {
    const raw = readFileSync(row.path);
    assert.equal(raw.length, row.bytes);
    assert.equal(createHash('sha256').update(raw).digest('hex'), row.sha256);
  }
});
check('ancestor identity, unchanged runtime and explicit bounds', () => {
  assert.equal(packet.nextAction.source.bytes, 6297);
  assert.equal(packet.nextAction.source.sha256, '9514b8e8ad0aff24e1eea7e782dd32178d856011fafcb750ce2c0f9a715c6efd');
  const source = read(packet.nextAction.source.path);
  for (const fragment of ['(3, 11, 15)', 'MAX_OUTPUT_BYTES = 32768', 'time.monotonic() + 10', 'drive_type != 3', 'os.lstat(parent)']) assert.ok(source.includes(fragment));
  assert.equal(packet.nextAction.externalSeconds, 15);
  assert.equal(packet.nextAction.sourceStdoutBytesMaximum, 32768);
  assert.equal(packet.nextAction.sourceStderrBytesMaximum, null);
});
check('broader metadata cap is separate', () => {
  assert.equal(packet.broaderMetadata.source.bytes, 9447);
  assert.equal(packet.broaderMetadata.source.sha256, '3780982e6906e6798232d9a7d7f1c5efa07f6dd7b9a25356976a2a73ed026bd3');
  assert.ok(read(packet.broaderMetadata.source.path).includes('MAX_OUTPUT_BYTES = 1024 * 1024'));
  assert.equal(packet.broaderMetadata.sourceStdoutBytesMaximum, 1048576);
  assert.equal(packet.broaderMetadata.automatic, false);
});
check('inventory bounds and build version stay distinct', () => {
  const source = read(packet.selectedInventory.source.path);
  for (const fragment of ['file_bytes: int = 16 * 1024 * 1024', 'total_bytes: int = 256 * 1024 * 1024', 'seconds: int = 60']) assert.ok(source.includes(fragment));
  assert.ok(read('scripts/qualification/worker_image_build.py').includes('sys.version_info[:3] == (3, 12, 14)'));
});
check('missing executable and supervisor identity remain missing', () => {
  for (const key of ['executableBytes', 'executableSha256', 'distributorBuildProvenance']) assert.equal(packet.candidate[key], null);
  assert.equal(packet.candidate.actualRuntimeIdentityVerified, false);
  assert.equal(packet.supervisor.sourceSha256, null);
  assert.equal(packet.supervisor.reviewed, false);
  assert.equal(packet.nextAction.argvComplete, false);
  assert.deepEqual(packet.nextAction.argv.slice(1, 4), ['-I', '-B', '-S']);
});
check('parent-only receipt and all execution authority remain false', () => {
  assert.equal(packet.receipt.bytes, 12009);
  assert.equal(packet.receipt.sha256, 'a5f05e1ae1087d9d36687a149f2e602c874ef61311f3352c64552eac79cc3ecd');
  assert.equal(packet.receipt.materialized, false); assert.equal(packet.receipt.libraryRetried, false);
  assert.ok(Object.values(packet.authority).every(value => value === false));
  assert.ok(Object.values(packet.acceptance).every(value => value === false));
});
check('published packet/report contain no personal Windows path', () => {
  const texts = [read(dir + 'profile-packet.json'), read(dir + 'parent-reported-candidate.json'),
    read('docs/coordination/reports/MERI-NATIVE-PYTHON-PROFILE-20261012.md'),
    read('docs/coordination/tasks/MERI-NATIVE-PYTHON-PROFILE-20261012.md')];
  for (const text of texts) assert.equal(/[A-Za-z]:[\\/]Users[\\/]/i.test(text), false);
});
console.log(JSON.stringify({ status: 'SOURCE_DATA_CHECKS_PASS', checks: results, targetModulesExecuted: false,
  targetInterpreterExecuted: false, privateZipMaterialized: false, executionAuthorized: false }, null, 2));
