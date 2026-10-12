import test from 'node:test';
import assert from 'node:assert/strict';
import { createResumeAdmissionVerifier } from './resume-admission.mjs';
import { fixture, NOW } from '../../../../packages/contracts/test/sdk-fixture-wire.test.mjs';

const requestId = '00000000-0000-4000-9000-000000000777';
function setup() {
  const f = fixture(), calls = [];
  const scenario = { runUuid: f.producer.runUuid, sessionId: f.producer.namespace.sessionId,
    ...f.producer.clock, phaseDeadlineMs: NOW + 10000 };
  const admission = { producer: f.producer, current: f.current, requestId: () => requestId,
    staleWorkerChallenge: { verify: async input => {
      calls.push(input);
      return { ...input.request, status: 'DENIED_STALE_BINDING', decisionId: requestId,
        checkedAtMs: NOW, currentContext: structuredClone(f.current) };
    } } };
  return { f, scenario, admission, calls };
}
const make = f => createResumeAdmissionVerifier({ admission: f.admission, scenario: f.scenario, now: () => NOW });

test('inert public-metadata composition supplies the exact correlated canonical A request to the owner', async () => {
  const f = setup(), verifier = make(f);
  assert.equal(f.calls.length, 0);
  assert.equal(await verifier.verify(), true);
  assert.equal(f.calls.length, 1);
  const call = f.calls[0];
  assert.deepEqual(call.request.context, f.f.producer);
  assert.deepEqual(call.current, f.f.current);
  assert.equal(call.request.requestId, requestId);
  assert.equal(call.request.operation, 'authorizeFixturePhase');
  assert.equal(call.deadlineMs, f.scenario.phaseDeadlineMs);
  assert.equal(Object.isFrozen(call.request.context), true);
  assert.equal(call.signal.aborted, true, 'only the owned operation signal is released');
  await assert.rejects(verifier.verify(), /RESUME_ADMISSION_REFUSED/);
});
test('missing, accessor or unknown admission members allocate no owner call', () => {
  for (const value of [undefined, {}, { transport: () => {} }]) {
    const f = setup(); f.admission = value;
    assert.throws(() => make(f), /RESUME_ADMISSION_COMPOSITION/);
    assert.equal(f.calls.length, 0);
  }
  const f = setup(); let reads = 0;
  Object.defineProperty(f.admission, 'producer', { enumerable: true, get() { reads++; return f.f.producer; } });
  assert.throws(() => make(f), /RESUME_ADMISSION_COMPOSITION/);
  assert.equal(reads, 0);
  const invalidFactory = setup(); invalidFactory.admission.requestId = null;
  assert.throws(() => make(invalidFactory), /RESUME_ADMISSION_COMPOSITION/);
});
test('malformed request correlation is refused before owner dispatch or bulk snapshot', async () => {
  const f = setup();
  f.admission.requestId = () => ({ ignored: 'not an admitted UUID' });
  await assert.rejects(make(f).verify()); assert.equal(f.calls.length, 0);
});
test('full producer/current snapshots must match the original scenario and are immutable after construction', async () => {
  for (const change of ['run', 'session', 'clock', 'fence']) {
    const f = setup();
    if (change === 'run') f.admission.producer.runUuid = '00000000-0000-4000-9000-000000000888';
    if (change === 'session') f.admission.current.namespace.sessionId = '00000000-0000-4000-9000-000000000888';
    if (change === 'clock') f.admission.current.clock.t0Ms++;
    if (change === 'fence') { f.admission.current.identity.fence = 3; f.admission.current.identity.canonical.writerFence = 3; }
    assert.throws(() => make(f)); assert.equal(f.calls.length, 0);
  }
  const f = setup(), verifier = make(f), expected = structuredClone(f.f.current);
  f.admission.current.identity.grantId = '00000000-0000-4000-9000-000000000888';
  f.admission.staleWorkerChallenge.verify = async () => { throw new Error('later mutable port'); };
  // The borrowed method and contexts are fixed; response must still name exact B.
  await assert.rejects(verifier.verify(), /STALE_FENCE_NOT_DENIED/);
  assert.deepEqual(f.calls[0].current, expected);
});
test('canonical full replacement rules refuse foreign tenant/namespace/pins or reused identity before owner invocation', () => {
  for (const change of ['tenant', 'namespace', 'pins', 'identity']) {
    const f = setup();
    if (change === 'tenant') f.admission.current.identity.canonical.tenantId = 'foreign-tenant';
    if (change === 'namespace') f.admission.current.namespace.sessionId = '00000000-0000-4000-9000-000000000888';
    if (change === 'pins') f.admission.current.pins.sourceCommit = 'e'.repeat(40);
    if (change === 'identity') f.admission.current.identity.taskArn = f.admission.producer.identity.taskArn;
    assert.throws(() => make(f));
    assert.equal(f.calls.length, 0);
  }
});
test('authorized, unknown, foreign, stale and uncorrelated responses cannot support admission', async () => {
  for (const change of ['authorized', 'unknown', 'foreign', 'stale', 'correlation', 'missing']) {
    const f = setup(), original = f.admission.staleWorkerChallenge.verify;
    f.admission.staleWorkerChallenge.verify = async input => {
      const result = await original(input);
      if (change === 'missing') return undefined;
      if (change === 'authorized') { delete result.currentContext; result.status = 'AUTHORIZED'; }
      if (change === 'unknown') result.status = 'UNKNOWN';
      if (change === 'foreign') result.currentContext.identity.grantId = '00000000-0000-4000-9000-000000000888';
      if (change === 'stale') result.checkedAtMs = NOW - 30001;
      if (change === 'correlation') result.requestId = '00000000-0000-4000-9000-000000000888';
      return result;
    };
    await assert.rejects(make(f).verify()); assert.equal(f.calls.length, 1);
  }
});
test('concurrent verify calls cannot each invoke the owner', async () => {
  const f = setup(), original = f.admission.staleWorkerChallenge.verify;
  let release;
  f.admission.staleWorkerChallenge.verify = async input => { await new Promise(resolve => { release = resolve; }); return original(input); };
  const verifier = make(f), pending = verifier.verify();
  await assert.rejects(verifier.verify(), /RESUME_ADMISSION_REFUSED/);
  await Promise.resolve(); release();
  assert.equal(await pending, true); assert.equal(f.calls.length, 1);
});
test('cancellation and an uncertain owner response remain one-shot and bounded', async () => {
  const f = setup(), controller = new AbortController(); let received;
  f.admission.staleWorkerChallenge.verify = input => { received = input.signal; return new Promise(() => {}); };
  const verifier = make(f), pending = verifier.verify({ signal: controller.signal });
  await Promise.resolve(); controller.abort();
  await assert.rejects(pending, /RESUME_ADMISSION_REFUSED/);
  assert.equal(received.aborted, true);
  await assert.rejects(verifier.verify(), /RESUME_ADMISSION_REFUSED/);
});
test('deadline bounds pending owner work and refuses before dispatch when already expired', async () => {
  const f = setup(); f.scenario.phaseDeadlineMs = NOW + 10;
  let ownedSignal;
  f.admission.staleWorkerChallenge.verify = input => { ownedSignal = input.signal; return new Promise(() => {}); };
  const verifier = make(f);
  await assert.rejects(verifier.verify(), /RESUME_ADMISSION_DEADLINE/);
  assert.equal(ownedSignal.aborted, true);
  const expired = setup(); expired.scenario.phaseDeadlineMs = NOW;
  assert.throws(() => make(expired), /RESUME_ADMISSION_DEADLINE/);
  assert.equal(expired.calls.length, 0);
});
test('invalid or regressed timer clock cannot schedule owner work when the clock later recovers', async () => {
  for (const failedReading of [NaN, NOW - 1]) {
    const f = setup(); let reads = 0;
    const now = () => ++reads === 3 ? failedReading : NOW;
    const verifier = createResumeAdmissionVerifier({ admission: f.admission, scenario: f.scenario, now });
    await assert.rejects(verifier.verify(), /RESUME_ADMISSION_CLOCK/);
    await Promise.resolve(); await Promise.resolve();
    assert.equal(f.calls.length, 0);
    await assert.rejects(verifier.verify(), /RESUME_ADMISSION_REFUSED/);
    assert.equal(f.calls.length, 0);
  }
});
