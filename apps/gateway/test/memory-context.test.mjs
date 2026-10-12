import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { canonicalSha256 } from '../../../packages/contracts/validate.mjs';
import { resolveOperationContract } from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import { fixture, NOW, uuid, limits } from './fixtures.mjs';
const dispatchModule = process.env.MEMORY_DISPATCH_MODULE
  ? pathToFileURL(process.env.MEMORY_DISPATCH_MODULE).href : new URL('../dispatch/tool-dispatch.mjs', import.meta.url).href;
const { createToolDispatch } = await import(dispatchModule);
const reference = { id: 'memory.list_own_proposals', version: '0.2.0' };
const request = argumentsData => JSON.stringify({ operation: reference, arguments: argumentsData });

function memoryFixture() {
  const f = fixture(); const contract = resolveOperationContract(reference); const records = new Map();
  Object.assign(f.binding, { tenantId: uuid('a'), actorId: uuid('b') });
  Object.assign(f.subject, { tenantId: f.binding.tenantId, actorId: f.binding.actorId, entityIds: [f.binding.actorId] });
  Object.assign(f.claims.scopes[0], { tenantId: f.binding.tenantId, kind: 'private-user', resourceId: f.binding.actorId });
  f.state.grants = ['tool.read'];
  f.entry.contract = contract; f.entry.descriptor = contract.descriptor;
  const business = f.ports.authorizeBusiness;
  f.ports.authorizeBusiness = async (...args) => {
    const result = JSON.parse(await business(...args)); result.decision.operation = `${reference.id}@${reference.version}`;
    return JSON.stringify(result);
  };
  f.ports.authorizeSources = async () => {
    f.calls.push('source-policy'); return JSON.stringify({ sourceIds: ['memory_proposals'], enabled: true,
      policyRevision: f.claims.policyRevision, checkedAtMs: f.state.now });
  };
  const row = { id: uuid('e'), status: 'pending', approvedFact: false, scope: 'personal', clientId: null,
    sourceKind: 'explicit_user', createdAt: '2026-01-02T00:00:00.000Z', restricted: false,
    title: 'Synthetic pending proposal', proposedText: 'Unapproved synthetic content', contentTruncated: false };
  const page = { tool: 'list_memory_proposals', enabled: true, authority: 'own_pending_proposals', claimsAreApprovedFacts: false,
    scope: { tenantId: f.binding.tenantId, userId: f.binding.actorId, clientId: null }, candidates: [row], nextCursor: null,
    coverage: { firstPage: true, complete: true, reason: 'own_pending_proposals_complete' } };
  f.entry.execute = async call => {
    f.calls.push('handler'); f.state.handlerCall = call;
    return JSON.stringify({ binding: call.authority.binding, subject: call.authority.subject,
      operation: reference, argumentsSha256: call.argumentsSha256, result: page });
  };
  const ports = {
    async loadPrevious({ key }) {
      f.calls.push('load-previous'); return JSON.stringify({ record: records.get(canonicalSha256(key)) ?? null, checkedAtMs: f.state.now });
    },
    async retain({ record }) {
      f.calls.push('retain'); records.set(canonicalSha256(record.key), structuredClone(record));
      return JSON.stringify({ decision: 'retained', keySha256: canonicalSha256(record.key),
        previousSha256: record.previousSha256, checkedAtMs: f.state.now });
    },
  };
  const create = changes => createToolDispatch({ catalog: { entry: () => f.entry, discoverable: () => [] },
    authority: f.authority, budget: f.budget, limits, now: () => f.state.now, newId: () => uuid('7'),
    sourceEnabled: true, memoryContextPorts: ports, ...changes });
  const partial = () => { page.nextCursor = 'synthetic-next'; page.coverage.complete = false;
    page.coverage.reason = 'unread_pages_restricted_or_truncated_content'; };
  return { ...f, page, row, records, contextPorts: ports, create, partial };
}

test('memory dispatch consumes canonical raw DTO inside current request/lineage wrapper', async () => {
  const f = memoryFixture(); const output = JSON.parse(await f.create().execute(request({}), 'synthetic-opaque'));
  assert.deepEqual(f.state.handlerCall.input, { clientId: null, cursor: null, limit: 5 });
  assert.deepEqual(output.result, f.page); assert.equal(output.result.claimsAreApprovedFacts, false);
  assert.equal(output.argumentsSha256, canonicalSha256(f.state.handlerCall.input));
  assert.equal(f.calls.filter(c => c === 'policy').length, 5);
  assert.equal(f.calls.includes('load-previous'), false); assert.equal(f.calls.includes('retain'), false);
});

test('memory shape rejects model supplied subject/previous and legacy context before business ports', async () => {
  for (const args of [{ subject: {} }, { previous: {} }, { previousPage: {} }, { actorId: uuid('c') }, { limit: '5' }]) {
    const f = memoryFixture(); await assert.rejects(f.create().execute(request(args), 'synthetic-opaque'), /INVALID_ARGUMENTS/);
    assert.deepEqual(f.calls, []);
  }
});

test('selected client comes from fresh server authority and model client substitution refuses', async () => {
  const f = memoryFixture(), client = uuid('c');
  Object.assign(f.subject, { kind: 'client', entityType: 'client', entityIds: [client] });
  Object.assign(f.claims.scopes[0], { kind: 'client', resourceId: client });
  f.page.scope.clientId = client;
  await f.create().execute(request({}), 'synthetic-opaque');
  assert.equal(f.state.handlerCall.input.clientId, client);
  await assert.rejects(f.create().execute(request({ clientId: uuid('d') }), 'synthetic-opaque'), /INVALID_ARGUMENTS/);
});

test('stable authority cannot drift between preflight and normalized authorization', async () => {
  const f = memoryFixture(); const business = f.ports.authorizeBusiness; let checks = 0;
  f.ports.authorizeBusiness = async (...args) => {
    if (++checks === 2) Object.assign(f.subject, { kind: 'client', entityType: 'client', entityIds: [uuid('c')] });
    return business(...args);
  };
  await assert.rejects(f.create().execute(request({}), 'synthetic-opaque'), /ACCESS_DENIED/);
  assert.equal(f.calls.includes('reserve'), false); assert.equal(f.calls.includes('handler'), false);
});

test('refreshed decision IDs do not change stable subject selection or prevent release', async () => {
  const f = memoryFixture(); const business = f.ports.authorizeBusiness; let checks = 0;
  f.ports.authorizeBusiness = async (...args) => {
    const row = JSON.parse(await business(...args)); const decisionId = uuid(String(++checks));
    row.decision.decisionId = decisionId; row.subject.authorizationDecisionId = decisionId; return JSON.stringify(row);
  };
  const output = JSON.parse(await f.create().execute(request({}), 'synthetic-opaque'));
  assert.equal(output.subject.authorizationDecisionId, uuid('3')); assert.equal(checks, 5);
});

test('trusted retained first page enables advancing continuation without model-supplied history', async () => {
  const f = memoryFixture(); f.partial();
  await f.create().execute(request({}), 'synthetic-opaque'); assert.equal(f.records.size, 1);
  const record = [...f.records.values()][0];
  assert.deepEqual(record.key.binding, f.binding); assert.deepEqual(record.key.operation, reference);
  assert.equal(Object.hasOwn(record.key.subject, 'authorizationDecisionId'), false);
  assert.equal(record.previousSha256, canonicalSha256(record.previous));
  f.row.id = uuid('d'); f.page.nextCursor = null; f.page.coverage.firstPage = false;
  const result = JSON.parse(await f.create().execute(request({ cursor: 'synthetic-next' }), 'synthetic-opaque'));
  assert.equal(result.result.candidates[0].id, uuid('d'));
  assert.equal(result.result.coverage.complete, false); assert.equal(f.calls.filter(c => c === 'load-previous').length, 1);
});

test('missing context ports and unknown cursor cannot execute or reserve', async () => {
  for (const changes of [{ memoryContextPorts: undefined }, {}]) {
    const f = memoryFixture(); await assert.rejects(f.create(changes).execute(request({ cursor: 'unknown' }), 'synthetic-opaque'), /GATEWAY_CONFIGURATION|ACCESS_DENIED/);
    assert.equal(f.calls.includes('handler'), false); assert.equal(f.calls.includes('reserve'), false);
  }
});

test('retained pages reject corrupt digest, wrong run fence/operation/subject and stale or future times', async () => {
  const changes = [r => { r.previous.page.candidates[0].title = 'substitution'; },
    r => { r.key.binding.writerFence++; }, r => { r.key.binding.runId = uuid('f'); },
    r => { r.key.operation.id = 'query_tasks'; }, r => { r.key.subject.actorId = uuid('c'); },
    r => { r.expiresAtMs = NOW; }, r => { r.expiresAtMs = NOW+10001; },
    r => { r.recordedAtMs = NOW+1; }];
  for (const mutate of changes) {
    const f = memoryFixture(); f.partial(); await f.create().execute(request({}), 'synthetic-opaque');
    const record = [...f.records.values()][0]; mutate(record);
    f.contextPorts.loadPrevious = async () => JSON.stringify({ record, checkedAtMs: NOW });
    const before = f.calls.filter(c => c === 'handler').length;
    await assert.rejects(f.create().execute(request({ cursor: 'synthetic-next' }), 'synthetic-opaque'), /ACCESS_DENIED/);
    assert.equal(f.calls.filter(c => c === 'handler').length, before);
  }
});

test('even correctly digested retained substitution must pass canonical limit/cursor/order validation', async () => {
  for (const changed of ['limit', 'cursor', 'order']) {
    const f = memoryFixture(); f.partial(); await f.create().execute(request({}), 'synthetic-opaque');
    const record = [...f.records.values()][0];
    if (changed === 'limit') record.previous.request.limit = 10;
    if (changed === 'cursor') record.previous.page.nextCursor = 'substituted';
    record.previousSha256 = canonicalSha256(record.previous);
    f.contextPorts.loadPrevious = async () => JSON.stringify({ record, checkedAtMs: NOW });
    f.page.nextCursor = null; f.page.coverage.firstPage = false;
    await assert.rejects(f.create().execute(request({ cursor: 'synthetic-next' }), 'synthetic-opaque'), /INVALID_ARGUMENTS|INVALID_RESULT/);
  }
});

test('result wrapper must bind exact operation/digest/lineage and preserve raw pending DTO semantics', async () => {
  for (const change of ['raw', 'operation', 'digest', 'subject', 'extra', 'fact']) {
    const f = memoryFixture(); const execute = f.entry.execute;
    f.entry.execute = async call => {
      const output = JSON.parse(await execute(call));
      if (change === 'raw') return JSON.stringify(output.result);
      if (change === 'operation') output.operation.id = 'query_tasks';
      if (change === 'digest') output.argumentsSha256 = '0'.repeat(64);
      if (change === 'subject') output.subject.actorId = uuid('c');
      if (change === 'extra') output.approved = true;
      if (change === 'fact') output.result.claimsAreApprovedFacts = true;
      return JSON.stringify(output);
    };
    await assert.rejects(f.create().execute(request({}), 'synthetic-opaque'), /INVALID_RESULT/);
    assert.equal(f.calls.includes('settle'), false); assert.equal(f.calls.filter(c => c === 'uncertain').length, 1);
  }
});

for (const port of ['loadPrevious', 'retain']) {
  test(`${port}: parked trusted context is bounded; late completion starts no further effect`, async () => {
    const f = memoryFixture(); f.partial();
    if (port === 'loadPrevious') await f.create().execute(request({}), 'synthetic-opaque');
    const original = f.contextPorts[port]; const parked = Promise.withResolvers(); let reply;
    f.contextPorts[port] = async call => { reply = await original(call); return parked.promise; };
    try {
      await assert.rejects(f.create({ limits: { ...limits, maxRequestMs: 20 } }).execute(
        request(port === 'loadPrevious' ? { cursor: 'synthetic-next' } : {}), 'synthetic-opaque'), /DEADLINE/);
      assert.equal(typeof reply, 'string'); const calls = [...f.calls];
      parked.resolve(reply); await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(f.calls, calls);
      assert.equal(f.calls.filter(c => c === 'uncertain').length, port === 'retain' ? 1 : 0);
    } finally { parked.resolve(reply); }
  });
}

test('revocation during retention cannot release a result after budget settlement', async () => {
  const f = memoryFixture(); f.partial(); const retain = f.contextPorts.retain;
  f.contextPorts.retain = async call => { const receipt = await retain(call); f.state.revoked = true; return receipt; };
  await assert.rejects(f.create().execute(request({}), 'synthetic-opaque'), /ACCESS_DENIED/);
  assert.equal(f.calls.includes('handler'), true);
  assert.equal(f.calls.includes('settle'), true); // final recheck denies release after acknowledged settlement
});
