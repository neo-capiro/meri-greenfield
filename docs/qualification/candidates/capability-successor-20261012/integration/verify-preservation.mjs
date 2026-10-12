/** Local source preservation check. No runtime, service or connector access. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {assertCatalog} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {CATALOG_OPERATION_BINDINGS} from '../../../../../packages/contracts/retrieval-0.2/catalog-validation.mjs';

const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const base = '2f06feccca731d6cd388612cd568185ecc29668f';
const git = (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();
const json = path => JSON.parse(readFileSync(new URL(`../../../../../${path}`, import.meta.url)));
const catalogPath = 'packages/contracts/retrieval-0.2/catalog.json';
const original = JSON.parse(git('show', `${base}:${catalogPath}`));
const catalog = assertCatalog(json(catalogPath));
assert.deepEqual(catalog.originals, original.originals, 'all 139 native rows preserved');
assert.equal(catalog.originals.length, 139);
assert.equal(catalog.originals.filter(row => row.disposition === 'selected').length, 96);
assert.equal(catalog.originals.filter(row => row.disposition === 'deferred').length, 43);
assert.equal(catalog.originals.filter(row => row.state === 'mapped').length, 14);
assert.equal(catalog.originals.filter(row => row.disposition === 'selected' && row.state === 'pending').length, 82);
assert.equal(catalog.operations.length, 15);
assert.equal(CATALOG_OPERATION_BINDINGS.length, 15);
for (const previous of original.operations) {
  assert.deepEqual(catalog.operations.find(row => row.operation.id === previous.operation.id), previous);
}
for (const row of catalog.operations) {
  assert.equal(row.handler, null); assert.equal(row.availability, 'unimplemented');
  assert.equal(row.qualification, 'pending'); assert.equal(row.retry.maxRetries, 0);
  assert.deepEqual(row.retry.retryableCodes, []);
}
const action = catalog.originals.find(row => row.id === 'query_action_items');
assert.equal(action.state, 'pending'); assert.equal(action.replacement, null);
assert.deepEqual(catalog.operations.find(row => row.operation.id === action.id).aliases, []);
assert.equal(CATALOG_OPERATION_BINDINGS.find(row => row.id === action.id).nativeCoverage, 'partial');
assert.deepEqual(CATALOG_OPERATION_BINDINGS.filter(row => row.dispatchProfile === 'mail-candidates/1').map(row => row.id),
  ['mail.list_messages', 'mail.search_messages']);

const inventory = json('docs/coordination/r2/capabilities.json');
assert.deepEqual(inventory.records.map(row => row.fields.ID), catalog.originals.map(row => row.id));
for (const [index, row] of inventory.records.entries()) {
  assert.equal(row.acceptedScope.disposition, catalog.originals[index].disposition);
  assert.equal(row.acceptedScope.boundary, catalog.originals[index].boundary);
}
const unchanged = ['apps/proxy', 'apps/worker', 'apps/control', 'scripts', 'infra',
  'package.json', 'package-lock.json', 'packages/contracts/package.json', 'packages/contracts/package-lock.json',
  'packages/contracts/dist', 'packages/contracts/meri.schema.json', 'packages/contracts/validate.mjs',
  'packages/contracts/retrieval-0.2/validate.mjs', 'packages/contracts/retrieval-0.2/operation-contracts.mjs',
  'packages/contracts/retrieval-0.2/*schema.json', 'packages/contracts/retrieval-0.2/*-validation.mjs',
  ':!packages/contracts/retrieval-0.2/catalog-validation.mjs',
  'docs/CAPABILITIES.json', 'docs/CAPABILITY-SCOPE.md', 'docs/coordination/r2', 'docs/plans'];
assert.equal(git('diff', '--name-only', base, '--', ...unchanged), '', 'protected source/runtime/public boundaries');
assert.equal(git('rev-parse', 'release/meri-rc1-20261012'), base);
assert.equal(git('rev-parse', 'meri-rc1-20261012^{}'), base);
assert.equal(git('rev-parse', 'task/meri-native-helper-integration-20261012'), base);
assert.equal(git('rev-parse', 'main'), '8b123bea4c90794dc2d766814b6ddbdbfe0928bc');
const planSha256 = createHash('sha256').update(readFileSync(new URL('../../../../../docs/plans/MERI-DEPLOYMENT.md', import.meta.url))).digest('hex');
assert.equal(planSha256, inventory.planSha256);
console.log(JSON.stringify({status: 'PASS_SOURCE_PRESERVATION_ONLY', sourceHead: git('rev-parse', 'HEAD'), base,
  planSha256, workbookSha256: inventory.workbookSha256,
  ledger: {originals:139, selected:96, deferred:43, mappedUnavailable:14, unmappedSelected:82,
    typedUnavailableOperations:15, partialBindingsWithinUnmapped:['query_action_items']},
  originalDescriptorsSha256:canonicalSha256(original.operations), originalRowsSha256:canonicalSha256(original.originals),
  runtime:'UNRUN_SEPARATE_OWNER', sourceConnectivity:false, gate:'G1_OPEN_G2_G7_UNENTERED'}, null, 2));
