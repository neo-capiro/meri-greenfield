/** Exact accepted catalog coupling, preserving unavailable source semantics. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const base = process.env.GATEWAY_FIXTURE_ROOT
  ? pathToFileURL(`${process.env.GATEWAY_FIXTURE_ROOT}/`) : new URL('../../../../', import.meta.url);
const load = relative => import(new URL(relative, base));
const catalog = JSON.parse(await readFile(new URL('packages/contracts/retrieval-0.2/catalog.json', base), 'utf8'));
const contracts = await load('packages/contracts/retrieval-0.2/validate.mjs');
const { createSourceDisabledGateway } = await load('apps/gateway/index.mjs');
const { createRuntimeCatalog } = await load('apps/gateway/catalog/runtime-catalog.mjs');
const { fixture, NOW, limits, uuid, operation } = await load('apps/gateway/test/fixtures.mjs');

test('accepted139 ledger and13 operation bindings compose without enabling source', async () => {
  assert.equal(catalog.originals.length, 139);
  const selected = catalog.originals.filter(row => row.disposition === 'selected');
  assert.equal(selected.length, 96);
  assert.equal(catalog.originals.filter(row => row.disposition === 'deferred').length, 43);
  assert.equal(selected.filter(row => row.replacement === null).length, 83);
  assert.equal(catalog.operations.length, 13);
  const f = fixture();
  const gateway = createSourceDisabledGateway({ authorityPorts: f.ports, budget: f.budget,
    limits, now: () => NOW, newId: () => uuid('7') });
  const view = createRuntimeCatalog({ catalogJson: JSON.stringify(catalog), contracts,
    handlers: new Map(catalog.operations.map(row => [`${row.operation.id}@${row.operation.version}`,
      { sourceSha256: 'f'.repeat(64), execute() { throw Error('must not run'); } }])) });
  for (const descriptor of catalog.operations) {
    const resolved = contracts.resolveOperationContract(descriptor.operation);
    assert.deepEqual(resolved.descriptor, descriptor);
    assert.equal(descriptor.availability, 'unimplemented'); assert.equal(descriptor.qualification, 'pending');
    assert.equal(descriptor.handler, null); assert.equal(descriptor.retry.maxRetries, 0);
    assert.equal(view.entry(descriptor.operation), null);
    await assert.rejects(gateway.execute(JSON.stringify({ operation: descriptor.operation, arguments: {} }), 'synthetic-opaque'), /^GatewayDenied: UNAVAILABLE$/);
  }
  const normalized = contracts.resolveOperationContract(operation).normalizeInput({}, { nowMs: NOW, actorId: f.binding.actorId });
  assert.deepEqual(normalized.input, { page: 1, limit: 10 });
  assert.equal(normalized.argumentsSha256, '20502c394fedad542399ec2d249e076c35f69d6b07838e9d17d02fe0f0bcca3b');
  assert.equal(gateway.sourceEnabled, false); assert.deepEqual(await gateway.discover(), []);
  assert.deepEqual(view.discoverable(), []); assert.deepEqual(f.calls, []);
});
