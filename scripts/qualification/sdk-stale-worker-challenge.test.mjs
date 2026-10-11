import test from 'node:test';
import assert from 'node:assert/strict';
import canonicalize from 'canonicalize';
import { createStaleWorkerChallenge } from './sdk-stale-worker-challenge.mjs';
import { fixture, requestFor, NOW } from '../../apps/control/qualification-sdk-fixture/ingress/test/fixture-data.mjs';

function setup() {
  const f = fixture(), calls = [], controller = new AbortController();
  const options = { producer: f.producer, current: f.current, phaseDeadlineMs: NOW + 10000, now: () => NOW,
    transport: async call => {
      calls.push(call);
      const request = JSON.parse(call.requestBytes);
      return Buffer.from(canonicalize({ ...request, status: 'DENIED_STALE_BINDING',
        decisionId: request.requestId, checkedAtMs: NOW, currentContext: f.current }));
    } };
  const input = { request: requestFor(f, 'authorizeFixturePhase'), current: f.current,
    deadlineMs: NOW + 10000, signal: controller.signal };
  return { f, calls, controller, options, input };
}
test('owner sends exactly A authorization through its borrowed transport and returns the actual decoded response', async () => {
  const f = setup(), port = createStaleWorkerChallenge(f.options);
  assert.equal(f.calls.length, 0);
  const result = await port.verify(f.input);
  assert.equal(f.calls.length, 1);
  assert.deepEqual(JSON.parse(f.calls[0].requestBytes), f.input.request);
  assert.equal(f.calls[0].operation, 'authorizeFixturePhase');
  assert.deepEqual(result.currentContext, f.f.current);
  assert.equal(result.status, 'DENIED_STALE_BINDING');
  assert.equal(Object.isFrozen(result.currentContext.identity), true);
  assert.equal(f.controller.signal.aborted, false, 'borrowed signal is not disposed');
  await assert.rejects(port.verify(f.input), /STALE_WORKER_CHALLENGE_REFUSED/);
});
test('foreign bindings, operations, budgets, accessors and cancellation cause zero dispatch', async () => {
  for (const change of ['producer', 'current', 'operation', 'deadline', 'accessor', 'cancel']) {
    const f = setup(), port = createStaleWorkerChallenge(f.options);
    if (change === 'producer') f.input.request.context = structuredClone(f.f.current);
    if (change === 'current') { f.input.current = structuredClone(f.f.current); f.input.current.identity.grantId = '00000000-0000-4000-9000-000000000888'; }
    if (change === 'operation') f.input.request = requestFor(f.f, 'loadFixtureCheckpoint');
    if (change === 'deadline') f.input.deadlineMs++;
    if (change === 'accessor') Object.defineProperty(f.input, 'request', { enumerable: true, get() { throw new Error('ACCESSOR_READ'); } });
    if (change === 'cancel') f.controller.abort();
    await assert.rejects(port.verify(f.input)); assert.equal(f.calls.length, 0);
  }
});
test('owner composition rejects foreign tenant/namespace/pins and reused current identity before transport', () => {
  for (const change of ['tenant', 'namespace', 'pins', 'identity']) {
    const f = setup();
    if (change === 'tenant') f.options.current.identity.canonical.tenantId = 'foreign-tenant';
    if (change === 'namespace') f.options.current.namespace.sessionId = '00000000-0000-4000-9000-000000000888';
    if (change === 'pins') f.options.current.pins.sourceCommit = 'e'.repeat(40);
    if (change === 'identity') f.options.current.identity.taskArn = f.options.producer.identity.taskArn;
    assert.throws(() => createStaleWorkerChallenge(f.options));
    assert.equal(f.calls.length, 0);
  }
});
test('noncanonical/authorized/foreign/uncertain replies remain quarantined without retry', async () => {
  for (const change of ['noncanonical', 'authorized', 'foreign', 'uncertain']) {
    const f = setup(), original = f.options.transport;
    f.options.transport = async call => {
      const raw = await original(call);
      if (change === 'uncertain') throw new Error('LOST_REPLY');
      if (change === 'noncanonical') return Buffer.concat([raw, Buffer.from('\n')]);
      const response = JSON.parse(raw);
      if (change === 'authorized') { response.status = 'AUTHORIZED'; delete response.currentContext; }
      if (change === 'foreign') response.currentContext.identity.grantId = '00000000-0000-4000-9000-000000000888';
      return Buffer.from(canonicalize(response));
    };
    const port = createStaleWorkerChallenge(f.options);
    await assert.rejects(port.verify(f.input));
    await assert.rejects(port.verify(f.input), /STALE_WORKER_CHALLENGE_REFUSED/);
    assert.equal(f.calls.length, 1);
  }
});
test('the owner reserves the attempt before awaiting its A transport', async () => {
  const f = setup(), original = f.options.transport; let release;
  f.options.transport = async call => { await new Promise(resolve => { release = resolve; }); return original(call); };
  const port = createStaleWorkerChallenge(f.options), pending = port.verify(f.input);
  await assert.rejects(port.verify(f.input), /STALE_WORKER_CHALLENGE_REFUSED/);
  release(); await pending; assert.equal(f.calls.length, 1);
});
