import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with { type: 'json' };
import { canonicalSha256 } from '../../../packages/contracts/validate.mjs';
import { validateFederalMarketShape } from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import { createSourceDisabledGateway } from '../index.mjs';
import { createDispatchLifetime } from '../dispatch/dispatch-lifetime.mjs';
import { GatewayDenied, parseRawJson, safeFailure, assertResultLineage } from '../dispatch/operation-result.mjs';
import { fixture, NOW, uuid, limits, requestJson } from './fixtures.mjs';

test('production catalog exposes no tools, has no activation override, performs zero effects', async () => {
  const f = fixture(); const options = { authorityPorts: f.ports, budget: f.budget, limits, now: () => NOW, newId: () => uuid('7') };
  const gateway = createSourceDisabledGateway(options);
  assert.equal(gateway.sourceEnabled, false); assert.deepEqual(await gateway.discover(), []);
  for (const descriptor of catalog.operations) {
    assert.equal(descriptor.handler, null); assert.equal(descriptor.availability, 'unimplemented');
    await assert.rejects(gateway.execute(JSON.stringify({ operation: descriptor.operation, arguments: {} }), 'synthetic-opaque'), /UNAVAILABLE/);
  }
  assert.deepEqual(f.calls, []);
  assert.throws(() => createSourceDisabledGateway({ ...options, sourceEnabled: true }), /GATEWAY_CONFIGURATION/);
  assert.throws(() => createSourceDisabledGateway({ ...options, budget: null }), /GATEWAY_CONFIGURATION/);
  assert.deepEqual(f.calls, []);
});

test('external object/proxy/getter/toJSON and thrown proxy are never inspected', () => {
  let touched = 0;
  const proxy = new Proxy({}, { get() { touched++; throw Error('secret'); }, getPrototypeOf() { touched++; throw Error('secret'); } });
  assert.throws(() => parseRawJson(proxy, 100), /INVALID_ARGUMENTS/);
  assert.throws(() => parseRawJson(proxy, 100, 'INVALID_RESULT'), /INVALID_RESULT/);
  assert.equal(safeFailure(proxy).message, 'INTERNAL_ERROR');
  assert.throws(() => parseRawJson({ toJSON() { touched++; } }, 100), /INVALID_ARGUMENTS/);
  const owned = new GatewayDenied('ACCESS_DENIED');
  Object.defineProperty(owned, 'message', { get() { touched++; throw Error('private detail'); } });
  assert.equal(safeFailure(owned).message, 'ACCESS_DENIED');
  assert.equal(touched, 0);
});

test('invalid canonical domain arguments refuse before reservation or handler', async () => {
  const f = fixture();
  await assert.rejects(f.create().execute(JSON.stringify({ operation: f.descriptor.operation, arguments: { limit: 'ten' } }), 'synthetic-opaque'), /INVALID_ARGUMENTS/);
  assert.equal(f.calls.includes('reserve'), false); assert.equal(f.calls.includes('handler'), false);
});

test('raw authority injection is rejected before any trusted port or effect', async () => {
  const f = fixture();
  for (const key of ['tenantId', 'actorId', 'grantId', 'writerFence', 'binding']) {
    await assert.rejects(f.create().execute(JSON.stringify({ operation: f.descriptor.operation, arguments: { nested: { [key]: 'forged' } } }), 'synthetic-opaque'), /INVALID_ARGUMENTS/);
  }
  assert.deepEqual(f.calls, []);
});

test('a mismatched trusted catalog cannot dispatch a substituted or raw SQL operation', async () => {
  const f = fixture();
  await assert.rejects(f.create().execute(JSON.stringify({ operation: { id: 'raw_sql', version: '0.2.0' }, arguments: {} }), 'synthetic-opaque'), /GATEWAY_CONFIGURATION/);
  assert.deepEqual(f.calls, []);
});

test('actual federal defaults precede canonical digest and resource reservation', async () => {
  const f = fixture(); const result = JSON.parse(await f.create().execute(requestJson, 'synthetic-opaque'));
  assert.equal(result.data.total, 0);
  assert.deepEqual(f.state.handlerCall.input, { page: 1, limit: 10 });
  assert.equal(f.state.handlerCall.argumentsSha256, canonicalSha256({ page: 1, limit: 10 }));
  assert.notEqual(f.state.handlerCall.argumentsSha256, canonicalSha256({}));
  assert.ok(f.calls.indexOf('policy') < f.calls.indexOf('reserve'));
  assert.ok(f.calls.lastIndexOf('policy') > f.calls.indexOf('settle'));
  assert.equal(f.calls.filter(x => x === 'handler').length, 1);
  assert.equal(f.calls.includes('uncertain'), false);
});

test('canonical raw federal output without qualified lineage cannot be released', async () => {
  const f = fixture();
  f.contract.assertOutput = value => validateFederalMarketShape('SearchFederalContractAwardsOutput', value);
  f.entry.execute = async () => JSON.stringify(f.data);
  await assert.rejects(f.create().execute(requestJson, 'synthetic-opaque'), /INVALID_RESULT/);
  assert.equal(f.calls.includes('settle'), false); assert.equal(f.calls.includes('uncertain'), true);
});

test('the original run deadline stops parked business/source lookup before any reservation', async () => {
  for (const phase of ['authorizeBusiness', 'authorizeSources']) {
    const f = fixture(); let release;
    const current = f.ports.currentRun;
    f.ports.currentRun = async call => { const row = JSON.parse(await current(call)); row.deadlineMs = NOW+20; return JSON.stringify(row); };
    f.ports[phase] = () => new Promise(resolve => { release = resolve; });
    await assert.rejects(f.create().execute(requestJson, 'synthetic-opaque'), /DEADLINE/);
    assert.equal(f.calls.includes('reserve'), false); assert.equal(f.calls.includes('handler'), false);
    assert.equal(f.calls.includes('uncertain'), false);
    release('{}'); await new Promise(resolve => setImmediate(resolve));
  }
});

test('expiry, wrong audience, stale fence, missing grants and disabled source refuse', async () => {
  for (const scenario of ['expiry', 'audience', 'fence', 'grant', 'source']) {
    const f = fixture();
    if (scenario === 'expiry') f.claims.expiresAt = new Date(NOW).toISOString();
    if (scenario === 'audience') f.claims.audience = 'meri-broker';
    if (scenario === 'fence') f.state.fence = 2;
    if (scenario === 'grant') f.state.grants = [];
    if (scenario === 'source') f.state.sourceEnabled = false;
    await assert.rejects(f.create().execute(requestJson, 'synthetic-opaque'), /ACCESS_DENIED/);
    assert.equal(f.calls.includes('reserve'), false, scenario); assert.equal(f.calls.includes('handler'), false, scenario);
  }
});

test('revocation during reservation prevents handler and preserves uncertain reservation', async () => {
  const f = fixture(); const reserve = f.budget.reserve;
  f.budget.reserve = async call => { const receipt = await reserve(call); f.state.revoked = true; return receipt; };
  await assert.rejects(f.create().execute(requestJson, 'synthetic-opaque'), /ACCESS_DENIED/);
  assert.equal(f.calls.includes('handler'), false); assert.equal(f.calls.filter(x => x === 'uncertain').length, 1);
});

test('replacement during source-policy lookup is rejected by the final current-run read', async () => {
  const f = fixture(); const source = f.ports.authorizeSources;
  f.ports.authorizeSources = async call => { const receipt = await source(call); f.state.fence = 2; return receipt; };
  await assert.rejects(f.create().execute(requestJson, 'synthetic-opaque'), /ACCESS_DENIED/);
  assert.equal(f.calls.includes('reserve'), false); assert.equal(f.calls.includes('handler'), false);
});

test('revocation during handler or settlement never releases the result', async () => {
  for (const stage of ['handler', 'settle']) {
    const f = fixture();
    if (stage === 'handler') f.entry.execute = async () => { f.calls.push('handler'); f.state.revoked = true; return JSON.stringify(f.output); };
    else { const settle = f.budget.settle; f.budget.settle = async call => { const receipt = await settle(call); f.state.revoked = true; return receipt; }; }
    await assert.rejects(f.create().execute(requestJson, 'synthetic-opaque'), /ACCESS_DENIED/);
    assert.equal(f.calls.includes('uncertain'), stage === 'handler');
  }
});

test('malformed or oversized raw output and foreign lineage cannot escape', async () => {
  for (const value of [new Proxy({}, { get() { throw Error('private'); } }), '{', 'x'.repeat(65537), JSON.stringify({ ...fixture().output, tool: 'wrong' })]) {
    const f = fixture(); f.entry.execute = async () => value;
    await assert.rejects(f.create().execute(requestJson, 'synthetic-opaque'), /INVALID_RESULT/);
    assert.equal(f.calls.includes('settle'), false); assert.equal(f.calls.includes('uncertain'), true);
  }
  const f = fixture();
  assert.throws(() => assertResultLineage({ binding: { ...f.binding, tenantId: 'foreign' } }, { binding: f.binding }), /INVALID_RESULT/);
});

test('uncertain/malformed budget acknowledgements never dispatch or refund', async () => {
  const f = fixture(); f.budget.reserve = async () => 'false';
  await assert.rejects(f.create().execute(requestJson, 'synthetic-opaque'), /BUDGET_UNCERTAIN/);
  assert.equal(f.calls.includes('handler'), false); assert.equal(f.calls.includes('uncertain'), true);
});

test('deadline validates before allocation, shrinks absolutely and closes owned timer/listener', async () => {
  let scheduled = 0; let unscheduled = 0; let now = 100; let callback;
  assert.throws(() => createDispatchLifetime({ deadlineMs: 100, now: () => now, schedule() { scheduled++; } }), /DEADLINE/);
  assert.equal(scheduled, 0);
  const life = createDispatchLifetime({ deadlineMs: 200, now: () => now,
    schedule(fn) { scheduled++; callback = fn; return scheduled; }, unschedule() { unscheduled++; } });
  life.limitDeadline(150); life.limitDeadline(190); now = 150;
  assert.throws(() => life.check(), /DEADLINE/); life.close();
  assert.equal(scheduled, 2); assert.equal(unscheduled, 2); assert.equal(life.signal.aborted, true);
  void callback;
});

test('timeout suppresses late work without claiming physical stop or refund', async () => {
  const f = fixture(); let release;
  f.entry.execute = () => new Promise(resolve => { release = resolve; });
  await assert.rejects(f.create({ limits: { ...limits, maxRequestMs: 20 } }).execute(requestJson, 'synthetic-opaque'), /DEADLINE/);
  assert.equal(f.calls.includes('uncertain'), true); assert.equal(f.calls.includes('settle'), false);
  release(JSON.stringify(f.output)); await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.calls.includes('settle'), false);
});

test('configuration and import allocate no live resource', async () => {
  const f = fixture(); assert.throws(() => f.create({ budget: {} }), /GATEWAY_CONFIGURATION/);
  await import('../index.mjs'); assert.deepEqual(f.calls, []);
});

test('a deadline shortened during the handler bounds parked settlement and preserves uncertainty', async () => {
  const f = fixture(); let deadline = NOW+10000; let releaseSettlement;
  const run = f.ports.currentRun;
  f.ports.currentRun = async call => { const row = JSON.parse(await run(call)); row.deadlineMs = deadline; return JSON.stringify(row); };
  f.entry.execute = async () => { deadline = NOW+20; return JSON.stringify(f.output); };
  f.budget.settle = ({ reservationId }) => new Promise(resolve => {
    f.calls.push('settle'); releaseSettlement = () => resolve(JSON.stringify({ reservationId, decision: 'settled' }));
  });
  const outcome = f.create().execute(requestJson, 'synthetic-opaque');
  let timer;
  try {
    await assert.rejects(Promise.race([outcome, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('shortened deadline did not bound parked settlement')), 100);
    })]), /^GatewayDenied: DEADLINE$/);
    assert.equal(f.calls.filter(call => call === 'uncertain').length, 1);
    assert.equal(f.calls.filter(call => call === 'settle').length, 1);
  } finally { clearTimeout(timer); releaseSettlement?.(); await outcome.catch(() => {}); }
});
