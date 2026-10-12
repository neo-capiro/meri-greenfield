import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../retrieval-0.2/catalog.json' with {type:'json'};
import {resolveOperationContract, assertCatalog} from '../retrieval-0.2/validate.mjs';
import {canonicalSha256} from '../validate.mjs';

const registry = () => resolveOperationContract({id: 'lookup_client_registry', version: '0.2.0'});
const value = () => ({existingClient: null, ldaExactMatch: null, ldaCandidates: [], guidance: 'Inert synthetic compatibility data.'});

test('canonical registry binding hashes the normalized name and preserves original arguments', () => {
  assertCatalog(catalog);
  const request = {name: '  Synthetic  '}, result = registry().normalizeInput(request);
  assert.deepEqual(result.request, request);
  assert.deepEqual(result.input, {name: 'Synthetic'});
  assert.equal(result.argumentsSha256, canonicalSha256({name: 'Synthetic'}));
  assert.notEqual(result.argumentsSha256, canonicalSha256(request));
  assert.equal(result.metadata, null); assert.ok(Object.isFrozen(result.input));
});

test('canonical registry output path requires a valid original request and closed result', () => {
  assert.deepEqual(registry().assertOutput(value(), {request: {name: 'Synthetic'}}), value());
  assert.throws(() => registry().assertOutput(value(), {}));
  assert.throws(() => registry().assertOutput(value(), {request: {name: 'Synthetic', tenantId: 'injected'}}));
  assert.throws(() => registry().assertOutput({...value(), created: true}, {request: {name: 'Synthetic'}}));
  let reads = 0;
  const hostile = {...value(), get guidance() {reads++; return 'execute';}};
  assert.throws(() => registry().assertOutput(hostile, {request: {name: 'Synthetic'}}));
  assert.equal(reads, 0);
});

test('registry mapping leaves creation deferred and cannot advertise an executable operation', () => {
  const descriptor = registry().descriptor;
  assert.equal(descriptor.handler, null); assert.equal(descriptor.availability, 'unimplemented');
  assert.equal(descriptor.qualification, 'pending'); assert.equal(descriptor.sideEffect, 'none');
  assert.equal(descriptor.approvalBoundary, 'none'); assert.equal(descriptor.retry.maxRetries, 0);
  const creation = catalog.originals.find(row => row.id === 'create_client');
  assert.equal(creation.disposition, 'deferred'); assert.equal(creation.replacement, null);
});
