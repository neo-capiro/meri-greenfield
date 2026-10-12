/** In-process budget outcome containment; does not qualify durable accounting. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { fixture, limits, requestJson } = await import(process.env.GATEWAY_FIXTURE_ROOT
  ? pathToFileURL(`${process.env.GATEWAY_FIXTURE_ROOT}/apps/gateway/test/fixtures.mjs`).href
  : '../../../../apps/gateway/test/fixtures.mjs');
const drain = () => new Promise(resolve => setImmediate(resolve));

for (const phase of ['reserve', 'settle']) for (const decision of ['pending', 'unknown', 'throw']) {
  test(`${phase} ${decision} fails closed with one uncertainty write`, async () => {
    const f = fixture();
    f.budget[phase] = async ({ reservationId }) => {
      f.calls.push(phase);
      if (decision === 'throw') throw Error('private budget adapter failure');
      return JSON.stringify({ reservationId, decision });
    };
    await assert.rejects(f.create().execute(requestJson, 'synthetic-opaque'),
      decision === 'throw' ? /^GatewayDenied: INTERNAL_ERROR$/ : /^GatewayDenied: BUDGET_UNCERTAIN$/);
    assert.equal(f.calls.filter(x => x === 'uncertain').length, 1);
    assert.equal(f.calls.filter(x => x === 'handler').length, phase === 'settle' ? 1 : 0);
    assert.equal(f.calls.filter(x => x === phase).length, 1, 'no budget retry');
  });
}

for (const phase of ['reserve', 'settle', 'markUncertain']) {
  test(`parked ${phase} is bounded and late completion cannot release a result`, async () => {
    const f = fixture(); let release; let released = false;
    if (phase === 'markUncertain') f.budget.reserve = async () => 'false';
    f.budget[phase] = call => new Promise(resolve => {
      f.calls.push(phase === 'markUncertain' ? 'uncertain' : phase);
      release = () => resolve(phase === 'markUncertain' ? undefined
        : JSON.stringify({ reservationId: call.reservationId, decision: phase === 'reserve' ? 'reserved' : 'settled' }));
    });
    const started = performance.now();
    let failure;
    await f.create({ limits: { ...limits, maxRequestMs: 20, maxCleanupMs: 20 } })
      .execute(requestJson, 'synthetic-opaque').then(() => { released = true; }, error => { failure = error.message; });
    const elapsedMs = performance.now() - started;
    release(); await drain(); await drain();
    console.log(JSON.stringify({ phase, elapsedMs, failure, released, calls: f.calls }));
    assert.equal(failure, phase === 'markUncertain' ? 'BUDGET_UNCERTAIN' : 'DEADLINE');
    assert.equal(released, false); assert.ok(elapsedMs < 200, 'cleanup must be separately bounded');
    assert.equal(f.calls.filter(x => x === 'uncertain').length, 1);
    if (phase !== 'settle') assert.equal(f.calls.includes('handler'), false);
  });
}
