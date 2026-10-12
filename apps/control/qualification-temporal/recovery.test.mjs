// Source checks only: actual workflow transpiled with deterministic Temporal stubs.
// No Temporal runtime, Worker/native core, database, task or provider is started.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createFixtureRecoveryActivities } from './recovery-activities.mjs';
import { liveFixture } from '../qualification-sdk-fixture/service/test/fixture.mjs';

const workflowSource = readFileSync(new URL('./recovery-workflow.ts', import.meta.url), 'utf8');
function workflow({ prepare = async () => ({ partial: true }), cancel = async () => ({ outcome: 'REVOKED' }) } = {}) {
  const events = [], options = [];
  class ApplicationFailure extends Error { constructor(type) { super(type); this.type = type; } }
  class ActivityFailure extends Error { constructor(cause) { super('activity'); this.cause = cause; } }
  const sdk = { ApplicationFailure, ActivityFailure, ActivityCancellationType: { WAIT_CANCELLATION_COMPLETED: 'WAIT' },
    CancellationScope: { nonCancellable: async fn => { events.push('noncancellable'); return fn(); } },
    proxyActivities: option => { options.push(option); return {
      prepareFixtureRecovery: async input => { events.push('prepare'); return prepare(input); },
      cancelFixtureRecovery: async input => { events.push('cancel'); return cancel(input); } }; } };
  const out = ts.transpileModule(workflowSource, { compilerOptions: { target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(out, { exports, require: name => { assert.equal(name, '@temporalio/workflow'); return sdk; } });
  return { run: exports.sdkFixtureRecoveryWorkflow, events, options, ApplicationFailure, ActivityFailure };
}

test('new actual workflow preserves source-only result and fixes all activities to one attempt', async () => {
  const h = workflow(); assert.deepEqual(await h.run({ runUuid: 'synthetic' }), { partial: true });
  assert.deepEqual(h.events, ['prepare']);
  assert.equal(h.options.length, 2);
  for (const option of h.options) assert.equal(option.retry.maximumAttempts, 1);
  assert.equal(h.options[0].cancellationType, 'WAIT');
  assert.equal(h.options[0].heartbeatTimeout, '5 seconds');
  assert.equal(h.options[0].activityId, 'prepare-fixture-recovery');
  assert.equal(h.options[1].activityId, 'cancel-fixture-recovery');
});
test('failed admission invokes explicit cleanup in a noncancellable scope and retains original error', async () => {
  const error = new Error('synthetic'); const h = workflow({ prepare: async () => { throw error; } });
  await assert.rejects(h.run({ runUuid: 'synthetic' }), e => e === error);
  assert.deepEqual(h.events, ['prepare', 'noncancellable', 'cancel']);
});
test('unknown replacement does not dispatch guessed cleanup or retry', async () => {
  let error; const h = workflow({ prepare: async () => { throw error; } });
  error = new h.ActivityFailure(new h.ApplicationFailure('FixtureRecoveryUncertain'));
  await assert.rejects(h.run({ runUuid: 'synthetic' }), e => e === error);
  assert.deepEqual(h.events, ['prepare']);
});
test('cleanup refusal remains visible instead of reporting a clean cancelled result', async () => {
  const h = workflow({ prepare: async () => { throw new Error('original'); }, cancel: async () => { throw new Error('liability'); } });
  await assert.rejects(h.run({ runUuid: 'synthetic' }), /liability/);
});
test('construction has no trusted effects and requires a retirement provider', () => {
  const f = liveFixture(); let effects = 0;
  const options = { producer: f.producer, current: f.current, reference: f.reference,
    producerPeer: { peerId: 'synthetic-a', credentialId: 'synthetic-a' },
    currentPeer: { peerId: 'synthetic-b', credentialId: 'synthetic-b' },
    control: { registry: { replaceRun: () => effects++, authorize: () => effects++, readPublication: () => effects++ }, stopRun: () => effects++ },
    execution: { namespace: 'synthetic', workflowId: 'synthetic', workflowRunId: 'synthetic', taskQueue: 'synthetic' },
    verifyRetirement: async () => effects++, transport: async () => effects++, phaseDeadlineMs: Date.now() + 1000 };
  assert.deepEqual(Object.keys(createFixtureRecoveryActivities(options)).sort(), ['cancelFixtureRecovery', 'prepareFixtureRecovery']);
  assert.equal(effects, 0);
  const without = { ...options }; delete without.verifyRetirement;
  assert.throws(() => createFixtureRecoveryActivities(without)); assert.equal(effects, 0);
});
test('effectful configuration is refused before capabilities', async () => {
  let effects = 0;
  const proxy = new Proxy({}, { getPrototypeOf() { effects++; throw new Error(); } });
  assert.throws(() => createFixtureRecoveryActivities(proxy)); assert.equal(effects, 0);
});
test('activity module imports supported JS APIs and no Worker/native driver', () => {
  const source = readFileSync(new URL('./recovery-activities.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /@temporalio\/worker|apps\/worker|runInterruptionPhase|\.connect\(|\.listen\(/);
  assert.match(source, /Context\.current\(\)/);
  const require = createRequire(import.meta.url);
  assert.match(readFileSync(require.resolve('@temporalio/activity').replace(/index\.js$/, 'index.d.ts'), 'utf8'), /readonly cancellationSignal: AbortSignal/);
});

test('compiled workflow reaches actual activity factory, canonical control/registry and verified checkpoint protocol', async () => {
  // Reuse a preserved source harness: actual owners, scripted SQL/fake S3 and
  // fake transport only. Its retirement result is explicitly synthetic.
  process.env.G1_OWNER_SOURCE_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
  const { fixture } = await import('../../../docs/qualification/candidates/g1-runtime-owner-20261012/review/control-harness.mjs');
  const { canonicalSha256 } = await import('../../../packages/contracts/validate.mjs');
  const { trustedBindingFromContext } = await import('../qualification-sdk-fixture/state/binding.mjs');
  const h = await fixture();
  try {
    await h.committed();
    h.f.current.identity.admittedAtMs = h.now() + 1; h.setNow(h.now() + 2);
    const execution = { namespace: 'synthetic', workflowId: 'synthetic-workflow',
      workflowRunId: 'synthetic-temporal-run', taskQueue: 'synthetic-trusted-queue' };
    const activity = createFixtureRecoveryActivities({ control: h.control,
      producer: h.f.producer, producerPeer: h.peerA, current: h.f.current, currentPeer: h.peerB,
      reference: h.f.reference, execution, now: h.now, phaseDeadlineMs: h.now() + 1000,
      activityContext: () => ({ info: { namespace: execution.namespace,
        workflowExecution: { workflowId: execution.workflowId, runId: execution.workflowRunId },
        workflowType: 'sdkFixtureRecoveryWorkflow', taskQueue: execution.taskQueue,
        activityId: 'prepare-fixture-recovery', activityType: 'prepareFixtureRecovery', attempt: 1, isLocal: false, heartbeatTimeoutMs: 5000 },
        cancellationSignal: new AbortController().signal, heartbeat() {} }),
      verifyRetirement: async ({ producer, binding }) => ({ taskArn: producer.identity.taskArn,
        bindingSha256: canonicalSha256(binding), stoppedAtMs: h.now() - 1, checkedAtMs: h.now() }),
      transport: async ({ operation, requestBytes }) => {
        const response = await h.send(operation, { request: JSON.parse(requestBytes), peer: 'b' }).promise;
        assert.equal(response.status, 200); return response.body;
      } });
    const compiled = workflow({ prepare: activity.prepareFixtureRecovery, cancel: activity.cancelFixtureRecovery });
    const result = await compiled.run({ runUuid: h.f.producer.runUuid });
    assert.equal(result.bindingSha256, canonicalSha256(trustedBindingFromContext(h.f.current, h.peerB)));
    assert.deepEqual(result.reference, h.f.reference);
    assert.equal(result.completeRecoveryCheckpoint, false); assert.equal(result.sessionStoreQualified, false);
    assert.equal(h.store.grants.get(h.f.producer.identity.grantId).state, 'REVOKED');
    assert.equal(h.store.grants.get(h.f.current.identity.grantId).state, 'ACTIVE');
    assert.equal(h.store.calls.filter(c => /^UPDATE .*runs SET current_attempt/.test(c.sql)).length, 1);
    assert.deepEqual(compiled.events, ['prepare']);
  } finally { await h.close(); }
});
