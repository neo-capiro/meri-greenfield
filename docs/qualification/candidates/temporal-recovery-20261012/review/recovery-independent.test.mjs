// Actual recovery owner + canonical control/registry/wire handlers; external
// storage/SQL/TLS and Temporal activity delivery are scripted. No native engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.env.TEMPORAL_RECOVERY_SOURCE_ROOT ?? '.');
process.env.G1_OWNER_SOURCE_ROOT = root;
const source = path => import(pathToFileURL(resolve(root, path)));
const { fixture, deferred } = await import('../../g1-runtime-owner-20261012/review/control-harness.mjs');
const { canonicalSha256 } = await source('packages/contracts/validate.mjs');
const { trustedBindingFromContext } = await source('apps/control/qualification-sdk-fixture/state/binding.mjs');
const { CommitUncertain } = await source('apps/control/qualification-sdk-fixture/state/errors.mjs');
let factory, loadError;
try { ({ createFixtureRecoveryActivities: factory } = await source('apps/control/qualification-temporal/recovery-activities.mjs')); }
catch (error) { loadError = error; }
const execution = { namespace: 'review-namespace', workflowId: 'review-workflow',
  workflowRunId: 'review-temporal-run', taskQueue: 'review-trusted-queue' };
const hold = error => error?.nonRetryable === true;

async function setup({ committed = true, override = {}, prepare = () => {} } = {}) {
  if (loadError) throw loadError;
  const h = await fixture();
  if (committed) await h.committed();
  h.f.current.identity.admittedAtMs = h.now() + 1; h.setNow(h.now() + 2);
  const controller = new AbortController(), events = [];
  const ctx = { info: { namespace: execution.namespace,
    workflowExecution: { workflowId: execution.workflowId, runId: execution.workflowRunId },
    taskQueue: execution.taskQueue, workflowType: 'sdkFixtureRecoveryWorkflow',
    activityId: 'prepare-fixture-recovery', activityType: 'prepareFixtureRecovery',
    attempt: 1, isLocal: false, heartbeatTimeoutMs: 1000 },
    cancellationSignal: controller.signal, heartbeat: value => events.push(['heartbeat', value]) };
  const receipt = () => ({ taskArn: h.f.producer.identity.taskArn,
    bindingSha256: canonicalSha256(trustedBindingFromContext(h.f.producer, h.peerA)),
    stoppedAtMs: h.now() - 1, checkedAtMs: h.now() });
  const options = { control: h.control, producer: h.f.producer, producerPeer: h.peerA,
    current: h.f.current, currentPeer: h.peerB, reference: h.f.reference, execution,
    verifyRetirement: async () => { events.push(['retirement']); return receipt(); },
    transport: async ({ operation, requestBytes }) => {
      events.push(['transport', operation]);
      const sent = await h.send(operation, { request: JSON.parse(Buffer.from(requestBytes).toString()), peer: 'b' }).promise;
      assert.equal(sent.status, 200); return sent.body;
    }, phaseDeadlineMs: h.now() + 1000, activityContext: () => ctx, now: h.now,
    ...override };
  prepare({ h, controller, ctx, events, receipt, options });
  const activity = factory(options);
  const input = { runUuid: h.f.producer.runUuid };
  const run = () => activity.prepareFixtureRecovery(input);
  const cancel = () => {
    ctx.info.activityId = 'cancel-fixture-recovery'; ctx.info.activityType = 'cancelFixtureRecovery';
    return activity.cancelFixtureRecovery(input);
  };
  return { h, controller, ctx, events, receipt, options, activity, input, run, cancel };
}
const replacementWrites = h => h.store.calls.filter(c => /^UPDATE .*runs SET current_attempt/.test(c.sql));

test('actual canonical pipeline retires A then atomically admits B and verifies the original checkpoint', async () => {
  const s = await setup(); const result = await s.run();
  assert.equal(result.runUuid, s.input.runUuid);
  assert.equal(result.bindingSha256, canonicalSha256(trustedBindingFromContext(s.h.f.current, s.h.peerB)));
  assert.deepEqual(result.reference, s.h.f.reference);
  assert.equal(result.completeRecoveryCheckpoint, false); assert.equal(result.sessionStoreQualified, false);
  assert.deepEqual(Object.keys(result).sort(), ['bindingSha256','completeRecoveryCheckpoint','reference','runUuid','sessionStoreQualified']);
  assert.equal(s.h.store.grants.get(s.h.f.producer.identity.grantId).state, 'REVOKED');
  assert.equal(s.h.store.grants.get(s.h.f.current.identity.grantId).state, 'ACTIVE');
  assert.equal(replacementWrites(s.h).length, 1);
  assert.deepEqual(s.events.filter(e => e[0] === 'transport').map(e => e[1]), ['loadFixtureCheckpoint','verifyFixtureCheckpoint']);
  await s.h.close();
});

for (const [field, change] of [
  ['namespace', i => { i.namespace = 'foreign'; }],
  ['workflowId', i => { i.workflowExecution.workflowId = 'foreign'; }],
  ['workflowRunId', i => { i.workflowExecution.runId = 'foreign'; }],
  ['taskQueue', i => { i.taskQueue = 'foreign'; }],
  ['workflowType', i => { i.workflowType = 'foreign'; }],
  ['activityId', i => { i.activityId = 'foreign'; }],
  ['activityType', i => { i.activityType = 'foreign'; }],
  ['retry-attempt', i => { i.attempt = 2; }],
  ['local-activity', i => { i.isLocal = true; }],
]) test(`foreign Temporal ${field} denies before retirement or replacement`, async () => {
  const s = await setup(); change(s.ctx.info);
  await assert.rejects(s.run(), hold); assert.equal(s.events.length, 0);
  assert.equal(replacementWrites(s.h).length, 0); await s.h.close();
});

test('worker-selected run UUID and extra authority fields refuse before any trusted call', async () => {
  for (const input of [{ runUuid: '00000000-0000-4000-9000-000000000099' },
    { runUuid: '00000000-0000-4000-9000-000000000001', approved: true }]) {
    const s = await setup(); await assert.rejects(s.activity.prepareFixtureRecovery(input), hold);
    assert.equal(s.events.length, 0); assert.equal(replacementWrites(s.h).length, 0); await s.h.close();
  }
});

test('effectful workflow input is rejected without invoking a getter or proxy trap', async () => {
  const s = await setup(); let calls = 0;
  const getter = Object.defineProperty({}, 'runUuid', { enumerable: true, get() { calls++; return s.input.runUuid; } });
  const proxy = new Proxy(s.input, { ownKeys() { calls++; return ['runUuid']; } });
  await assert.rejects(s.activity.prepareFixtureRecovery(getter), hold);
  await assert.rejects(s.activity.prepareFixtureRecovery(proxy), hold);
  assert.equal(calls, 0); assert.equal(s.events.length, 0); await s.h.close();
});

for (const [name, mutate] of [
  ['foreign-task', r => { r.taskArn += 'x'; }],
  ['foreign-binding', r => { r.bindingSha256 = '0'.repeat(64); }],
  ['future-observation', r => { r.checkedAtMs += 1; }],
  ['stale-observation', r => { r.checkedAtMs -= 5001; r.stoppedAtMs = r.checkedAtMs; }],
  ['future-stop', r => { r.stoppedAtMs = r.checkedAtMs + 1; }],
]) test(`retirement ${name} cannot mutate registry`, async () => {
  const s = await setup({ prepare: ({ options, receipt }) => {
    options.verifyRetirement = async () => { const r = receipt(); mutate(r); return r; };
  } });
  await assert.rejects(s.run(), hold); assert.equal(replacementWrites(s.h).length, 0); await s.h.close();
});

test('missing retirement capability fails construction before replacement', async () => {
  await assert.rejects(setup({ override: { verifyRetirement: undefined } }));
});

test('no committed checkpoint refuses canonical replacement and never loads data', async () => {
  const s = await setup({ committed: false }); await assert.rejects(s.run(), hold);
  assert.equal(replacementWrites(s.h).length, 0);
  assert.equal(s.events.filter(e => e[0] === 'transport').length, 0); await s.h.close();
});

test('wrong committed receipt refuses and cannot substitute another checkpoint', async () => {
  const s = await setup({ prepare: ({ options }) => { options.reference = { ...options.reference, receiptSha256: '0'.repeat(64) }; } });
  await assert.rejects(s.run(), hold);
  assert.ok(s.events.filter(e => e[0] === 'transport').length <= 1); await s.h.close();
});

test('duplicate delivery cannot dispatch a second replacement or load', async () => {
  const s = await setup(); await s.run(); const calls = s.h.store.calls.length;
  await assert.rejects(s.run(), hold); assert.equal(s.h.store.calls.length, calls);
  assert.equal(replacementWrites(s.h).length, 1); await s.h.close();
});

test('aborted retirement completion cannot dispatch replacement', async () => {
  const parked = deferred();
  const s = await setup({ prepare: ({ options }) => { options.verifyRetirement = () => parked.promise; } });
  const pending = s.run(); s.controller.abort(); parked.resolve(s.receipt());
  await assert.rejects(pending, hold); assert.equal(replacementWrites(s.h).length, 0); await s.h.close();
});

test('expired retirement completion cannot dispatch replacement or reset deadline', async () => {
  const parked = deferred();
  const s = await setup({ prepare: ({ options }) => { options.verifyRetirement = () => parked.promise; } });
  const pending = s.run(); s.h.setNow(s.options.phaseDeadlineMs); parked.resolve(s.receipt());
  await assert.rejects(pending, hold); assert.equal(replacementWrites(s.h).length, 0); await s.h.close();
});

test('uncertain replacement acknowledgement holds without retry, transport or guessed cancellation', async () => {
  const s = await setup();
  s.h.store.afterTransaction = async ({ queries }) => {
    if (queries.some(c => /^UPDATE .*runs SET current_attempt/.test(c.sql))) throw new CommitUncertain();
  };
  const error = await s.run().then(() => assert.fail('unknown success'), e => e);
  assert.equal(error.nonRetryable, true); assert.match(error.type ?? error.message, /UNCERTAIN|UNKNOWN|HOLD/i);
  assert.equal(replacementWrites(s.h).length, 1);
  assert.equal(s.events.filter(e => e[0] === 'transport').length, 0);
  const calls = s.h.store.calls.length;
  await assert.rejects(s.run(), hold); await assert.rejects(s.cancel(), hold);
  assert.equal(s.h.store.calls.length, calls); await s.h.close();
});

test('cancel known replaced B consumes actual stopRun and durably revokes B only', async () => {
  const s = await setup(); await s.run(); const result = await s.cancel();
  assert.equal(result.runUuid, s.input.runUuid); assert.equal(result.outcome, 'REVOKED');
  assert.equal(s.h.store.grants.get(s.h.f.current.identity.grantId).state, 'REVOKED');
  assert.equal(s.h.control.runStatus({ context: s.h.f.current, peer: s.h.peerB }).stopRequested, true);
  await s.h.close();
});
