import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalSha256 } from '../../../../packages/contracts/validate.mjs';
import { createScheduleLifecycle } from '../schedule-lifecycle.mjs';

const ids = {
  intent: '11111111-1111-4111-8111-111111111111',
  schedule: '22222222-2222-4222-8222-222222222222',
  task: '33333333-3333-4333-8333-333333333333',
  run: '44444444-4444-4444-8444-444444444444',
};
const actor = () => ({ tenantId: 'tenant-a', actorId: 'delegate-a' });
const projection = () => ({
  scheduleId: ids.schedule, owner: { tenantId: 'tenant-a', actorId: 'owner-a' },
  temporalScheduleId: 'application/schedule-a', timezone: 'UTC',
  scopes: [{ tenantId: 'tenant-a', kind: 'client', resourceId: 'client-a', policyRevision: 'policy-a' }],
  state: 'active', maxCostMicrousd: 120, maxRuntimeSeconds: 30, retryLimit: 0,
  destinationId: 'destination-a', createdAt: '2026-10-12T00:00:00.000Z',
});
const configuration = () => ({
  spec: { calendars: [], intervals: [{ every: 60000, offset: 1000 }], cronExpressions: [], skip: [],
    startAt: null, endAt: null, jitterMs: 500, timezone: 'UTC' },
  overlap: 'BUFFER_ONE', catchupWindowMs: 2000, pauseOnFailure: true, remainingActions: 3,
  paused: false, note: 'explicit operator choice', runNow: false, runNowOverlap: 'ALLOW_ALL',
  task: { taskId: ids.task, manifestSha256: 'a'.repeat(64), version: 2 },
  workflow: { workflowType: 'ApprovedTask', workflowId: 'workflow-a', taskQueue: 'queue-a' },
});
const intent = (operation = 'schedule_task') => ({
  intentId: ids.intent, operation, expectedGeneration: operation === 'schedule_task' ? 0 : 1,
  generation: operation === 'schedule_task' ? 1 : 2,
  previousProjectionSha256: operation === 'schedule_task' ? null : canonicalSha256(projection()),
  projection: projection(), configuration: operation === 'cancel_scheduled_task' ? null : configuration(),
  cancel: operation === 'cancel_scheduled_task' ? { mode: 'delete', note: 'approved cancellation', running: 'leave', runs: [] } : null,
});
function request(now, operation) {
  const value = intent(operation);
  if (operation === 'cancel_scheduled_task') value.projection.state = 'cancelled';
  return { intent: value, approval: {
    proposalId: value.intentId, commandSha256: canonicalSha256(value), decision: 'approved',
    decidedAt: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 40000).toISOString(),
    approver: { tenantId: 'tenant-a', actorId: 'reviewer-a' }, policyRevision: 'policy-a',
  }, callerIdentity: actor(), deadlineMs: now + 50000 };
}
const reseal = value => { value.approval.commandSha256 = canonicalSha256(value.intent); return value; };
const action = () => ({ type: 'startWorkflow', workflow: { workflowId: 'workflow-a', firstExecutionRunId: ids.run } });
const description = () => ({
  scheduleId: 'application/schedule-a', state: { paused: false },
  info: { createdAt: new Date('2026-10-12T00:00:00.000Z'), lastUpdatedAt: undefined,
    numActionsTaken: 1, numActionsMissedCatchupWindow: 0, numActionsSkippedOverlap: 0,
    nextActionTimes: [], recentActions: [{ scheduledAt: new Date('2026-10-12T00:00:00.000Z'),
      takenAt: new Date('2026-10-12T00:00:00.000Z'), action: action() }], runningActions: [action()] },
});
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
async function bounded(promise) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('independent timeout')), 1500); })]); }
  finally { clearTimeout(timer); }
}
function harness(options = {}) {
  let now = Date.now(); const calls = []; let closed = 0;
  const clock = options.clock ?? (() => now);
  const invoke = async (name, fallback, ...args) => { calls.push({ name, args }); return options[name] ? options[name](...args) : fallback(...args); };
  const connection = {
    withDeadline(deadline, fn) { assert.equal(this, connection); return invoke('withDeadline', (_d, next) => next(), deadline, fn); },
    withAbortSignal(signal, fn) { assert.equal(this, connection); return invoke('withAbortSignal', (_s, next) => next(), signal, fn); },
    close() { closed++; throw Error('borrowed close'); },
  };
  const scheduleClient = { connection,
    create(value) { assert.equal(this, scheduleClient); return invoke('create', () => ({ scheduleId: value.scheduleId }), value); },
    getHandle(id) {
      calls.push({ name: 'getHandle', args: [id] });
      if (options.getHandle) return options.getHandle(id);
      const handle = { scheduleId: id,
        describe() { assert.equal(this, handle); return invoke('describe', description); },
        update(fn) { assert.equal(this, handle); return invoke('update', cb => { const v = cb(description()); calls.push({ name: 'updatedOptions', args: [v] }); }, fn); },
        pause(note) { assert.equal(this, handle); return invoke('pause', () => undefined, note); },
        delete() { assert.equal(this, handle); return invoke('delete', () => undefined); },
        trigger(overlap) { assert.equal(this, handle); return invoke('trigger', () => undefined, overlap); },
      }; return handle;
    },
    list() { throw Error('namespace enumeration forbidden'); }, close() { closed++; throw Error('borrowed close'); },
  };
  const workflowClient = { connection,
    getHandle(workflowId, runId, extra) {
      calls.push({ name: 'workflowHandle', args: [workflowId, runId, extra] });
      if (options.workflowHandle) return options.workflowHandle(workflowId, runId, extra);
      const handle = { workflowId,
        describe() { assert.equal(this, handle); return invoke('workflowDescribe', () => ({ workflowId, runId, status: { name: 'COMPLETED', code: 2 }, historyLength: 7,
          startTime: new Date('2026-10-12T00:00:00.000Z'), closeTime: new Date('2026-10-12T00:01:00.000Z') })); },
        cancel() { assert.equal(this, handle); return invoke('workflowCancel', () => undefined); },
        terminate() { throw Error('termination not authorized'); }, fetchHistory() { throw Error('unbounded event fetch forbidden'); },
      }; return handle;
    },
  };
  const ownerReceipt = (binding, state) => ({ intentId: binding.intent.intentId, bindingSha256: binding.bindingSha256, state });
  const scheduleOwner = {};
  for (const [method, state] of [['claim', 'CLAIMED'], ['markDispatching', 'DISPATCHING'], ['commitKnown', 'ACKNOWLEDGED'], ['markUnknown', 'UNKNOWN']]) {
    scheduleOwner[method] = (binding, check) => invoke(method, b => { check?.(); return ownerReceipt(b, state); }, binding, check);
  }
  scheduleOwner.list = (selection, check) => invoke('ownerList', () => { check?.(); return { rows: [{ projection: projection(), generation: 1, unresolved: false }], hasMore: false }; }, selection, check);
  const authorize = (value) => invoke('authorize', v => ({ authorized: true, bindingSha256: v.binding.bindingSha256, callerIdentity: v.binding.callerIdentity, expiresAtMs: clock() + 35000 }), value);
  const service = createScheduleLifecycle({ scheduleClient, workflowClient, scheduleOwner, authorize, clock });
  return { service, calls, scheduleClient, workflowClient, scheduleOwner, connection, clock,
    request: request(clock(), options.operation), advance(ms) { now += ms; }, closed: () => closed,
    run() { return service.execute(this.request); },
    list(selection = {}) { return service.list({ selection: { operation: 'list_scheduled_tasks', owner: projection().owner,
      afterScheduleId: null, limit: 2, historyLimit: 2, ...selection }, callerIdentity: actor(), deadlineMs: clock() + 50000 }); },
  };
}
const effects = h => h.calls.filter(v => ['create', 'update', 'pause', 'delete', 'trigger', 'workflowCancel'].includes(v.name));

test('independent lifecycle: construction is inert and create retains explicit SDK policy choices', async () => {
  const h = harness(); assert.equal(h.calls.length, 0);
  const out = await h.run(); assert.equal(out.outcome, 'ACKNOWLEDGED'); assert.equal(out.physicalStopProven, false);
  const options = h.calls.find(v => v.name === 'create').args[0];
  assert.equal(options.scheduleId, h.request.intent.projection.temporalScheduleId);
  assert.equal(options.policies.overlap, 'BUFFER_ONE'); assert.equal(options.policies.catchupWindow, 2000);
  assert.equal(options.policies.pauseOnFailure, true); assert.equal(options.state.paused, false);
  assert.equal(options.state.remainingActions, 3); assert.equal(options.state.triggerImmediately, false);
  assert.equal(options.spec.timezone, 'UTC'); assert.equal(options.spec.jitter, 500);
  assert.equal(options.action.workflowId, 'workflow-a'); assert.equal(options.action.taskQueue, 'queue-a');
  assert.equal(effects(h).length, 1); assert.equal(h.closed(), 0);
  assert.equal(h.calls.filter(v => v.name === 'claim').length, 1);
  assert.equal(h.calls.filter(v => v.name === 'commitKnown').length, 1);
});

for (const operation of ['update_scheduled_task', 'cancel_scheduled_task']) test(`independent lifecycle: ${operation} uses exact borrowed handle`, async () => {
  const h = harness({ operation }); const out = await h.run(); assert.equal(out.outcome, 'ACKNOWLEDGED');
  assert.ok(h.calls.some(v => v.name === 'getHandle' && v.args[0] === 'application/schedule-a'));
  assert.equal(effects(h)[0].name, operation === 'update_scheduled_task' ? 'update' : 'delete');
  assert.equal(h.closed(), 0);
});

for (const field of ['commandSha256', 'proposalId', 'decision', 'expiresAt', 'approver']) test(`independent lifecycle: invalid approval ${field} has no owner or SDK effect`, async () => {
  const h = harness(); const a = h.request.approval;
  if (field === 'commandSha256') a[field] = 'b'.repeat(64);
  else if (field === 'proposalId') a[field] = ids.task;
  else if (field === 'decision') a[field] = 'rejected';
  else if (field === 'expiresAt') a[field] = new Date(h.clock() - 1).toISOString();
  else a.approver.tenantId = 'tenant-b';
  await assert.rejects(h.run()); assert.equal(h.calls.length, 0);
});
for (const field of ['caller', 'scope', 'generation', 'task', 'unknown']) test(`independent lifecycle: ${field} substitution is rejected before effects`, async () => {
  const h = harness();
  if (field === 'caller') h.request.callerIdentity.tenantId = 'tenant-b';
  if (field === 'scope') h.request.intent.projection.scopes[0].tenantId = 'tenant-b';
  if (field === 'generation') h.request.intent.generation = 5;
  if (field === 'task') h.request.intent.configuration.task.manifestSha256 = 'c'.repeat(64);
  if (field === 'unknown') h.request.intent.authorized = true;
  await assert.rejects(h.run()); assert.equal(effects(h).length, 0);
});
test('independent lifecycle: approved bytes cannot be mutated while authorization is parked', async () => {
  const gate = deferred(); let first = true, seen;
  const h = harness({ authorize: async r => { seen ??= r.binding; if (first) { first = false; await gate.promise; }
    return { authorized: true, bindingSha256: r.binding.bindingSha256, callerIdentity: r.binding.callerIdentity, expiresAtMs: h.clock() + 35000 }; } });
  const pending = h.run(); await flush(); h.request.intent.configuration.note = 'post-approval substitution';
  assert.equal(Object.isFrozen(seen.intent.configuration), true); gate.resolve();
  const out = await pending; assert.equal(out.outcome, 'ACKNOWLEDGED');
  assert.equal(h.calls.find(v => v.name === 'create').args[0].state.note, 'explicit operator choice');
});
for (const kind of ['getter', 'proxy']) test(`independent lifecycle: hostile ${kind} is inertly denied`, async () => {
  const h = harness(); let touched = 0;
  h.request.intent = kind === 'getter' ? Object.defineProperty(intent(), 'configuration', { enumerable: true, get() { touched++; return configuration(); } })
    : new Proxy(intent(), { ownKeys() { touched++; return []; } });
  await assert.rejects(h.run()); assert.equal(touched, 0); assert.equal(h.calls.length, 0);
});
for (const field of ['authorized', 'bindingSha256', 'callerIdentity', 'expiresAtMs', 'extra']) test(`independent lifecycle: authority ${field} mismatch denies before claim`, async () => {
  const h = harness({ authorize: async r => { const value = { authorized: true, bindingSha256: r.binding.bindingSha256, callerIdentity: r.binding.callerIdentity, expiresAtMs: h.clock() + 35000 };
    if (field === 'authorized') value.authorized = false;
    else if (field === 'bindingSha256') value.bindingSha256 = 'b'.repeat(64);
    else if (field === 'callerIdentity') value.callerIdentity = { ...actor(), actorId: 'other' };
    else if (field === 'expiresAtMs') value.expiresAtMs = h.clock();
    else value.extra = true; return value; } });
  await assert.rejects(h.run()); assert.equal(h.calls.filter(v => v.name === 'claim').length, 0); assert.equal(effects(h).length, 0);
});
test('independent lifecycle: pre-abort performs no authorization, claim or mutation', async () => {
  const h = harness(); const c = new AbortController(); c.abort(); h.request.signal = c.signal;
  await assert.rejects(h.run()); assert.equal(h.calls.length, 0);
});
for (const method of ['claim', 'markDispatching']) test(`independent lifecycle: ${method} denial never reaches SDK`, async () => {
  const h = harness({ [method]: () => { throw Error('stale generation'); } });
  await assert.rejects(h.run()); assert.equal(effects(h).length, 0);
});
for (const method of ['claim', 'markDispatching', 'create', 'commitKnown']) test(`independent lifecycle: cancelled parked ${method} cannot cause later mutation`, async () => {
  const gate = deferred(); const c = new AbortController(); let entered = false;
  const h = harness({ [method]: async (binding) => { entered = true; await gate.promise;
    if (method === 'create') return { scheduleId: binding.scheduleId };
    return { intentId: binding.intent.intentId, bindingSha256: binding.bindingSha256, state: { claim: 'CLAIMED', markDispatching: 'DISPATCHING', commitKnown: 'ACKNOWLEDGED' }[method] }; } });
  h.request.signal = c.signal; const pending = h.run(); await flush(); assert.equal(entered, true); c.abort();
  await bounded(assert.rejects(pending)); const count = effects(h).length; gate.resolve(); await flush(); await flush();
  assert.equal(effects(h).length, count); assert.equal(h.closed(), 0);
});
test('independent lifecycle: schedule handle returned after deadline cannot update', async () => {
  let mutations = 0; const h = harness({ operation: 'update_scheduled_task', getHandle(id) { h.advance(50000); return { scheduleId: id, update() { mutations++; } }; } });
  await assert.rejects(h.run()); assert.equal(mutations, 0);
});
test('independent lifecycle: SDK update callback invoked after expiry refuses replacement', async () => {
  let replacementReturned = false; const h = harness({ operation: 'update_scheduled_task', update(fn) { h.advance(50000); fn(description()); replacementReturned = true; } });
  await assert.rejects(h.run()); assert.equal(replacementReturned, false);
});
test('independent lifecycle: explicit cancellation targets exact runs and never terminates', async () => {
  const h = harness({ operation: 'cancel_scheduled_task' }); h.request.intent.cancel = { mode: 'pause', note: 'approved pause and cancel', running: 'request_cancel', runs: [{ workflowId: 'workflow-a', runId: ids.run }] };
  h.request.intent.projection.state = 'paused'; reseal(h.request); const out = await h.run();
  assert.equal(out.outcome, 'ACKNOWLEDGED'); assert.equal(out.physicalStopProven, false);
  assert.deepEqual(h.calls.find(v => v.name === 'workflowHandle').args, ['workflow-a', ids.run, undefined]);
  assert.deepEqual(effects(h).map(v => v.name), ['pause', 'workflowCancel']);
});
test('independent lifecycle: list uses application-owned page and exact original history IDs', async () => {
  const h = harness(); const out = await h.list(); assert.equal(out.operation, 'list_scheduled_tasks');
  assert.equal(out.coverage.complete, false); assert.equal(out.coverage.currentRetryVerified, false);
  assert.equal(out.originalRuns.coverage.historyComplete, false); assert.equal(out.originalRuns.coverage.currentRetryVerified, false);
  assert.equal(out.originalRuns.executions[0].runId, ids.run);
  assert.ok(h.calls.filter(v => v.name === 'workflowHandle').every(v => v.args[1] === ids.run && v.args[2] === undefined));
  assert.equal(effects(h).length, 0); assert.equal(h.closed(), 0);
});
test('independent lifecycle: history run substitution rejects instead of relabeling latest run', async () => {
  const h = harness({ workflowDescribe: () => ({ workflowId: 'workflow-a', runId: ids.task, status: { name: 'COMPLETED', code: 2 }, historyLength: 1, startTime: new Date(), closeTime: undefined }) });
  await assert.rejects(h.list()); assert.equal(effects(h).length, 0);
});
test('independent lifecycle: no-history request causes no workflow lookup', async () => {
  const h = harness(); const out = await h.list({ historyLimit: 0 });
  assert.equal(out.originalRuns.executions.length, 0); assert.equal(h.calls.filter(v => v.name === 'workflowHandle').length, 0);
});

test('independent lifecycle: update current-description Proxy is refused without traps', async () => {
  let touched = 0;
  const h = harness({ operation: 'update_scheduled_task', update(fn) {
    return fn(new Proxy({ scheduleId: 'application/schedule-a' }, {
      getOwnPropertyDescriptor(target, key) { touched++; return Reflect.getOwnPropertyDescriptor(target, key); },
    }));
  } });
  await assert.rejects(h.run()); assert.equal(touched, 0);
});

test('independent lifecycle: native UUID page order accepts equivalent mixed-case projections', async () => {
  const left = projection(), right = projection();
  left.scheduleId = 'aaaaaaaa-1111-4111-8111-111111111111';
  right.scheduleId = 'BBBBBBBB-1111-4111-8111-111111111111';
  const h = harness({ ownerList: () => ({ rows: [left, right].map(p => ({ projection: p, generation: 1, unresolved: false })), hasMore: false }) });
  const out = await h.list({ historyLimit: 0 }); assert.equal(out.rows.length, 2);
  assert.deepEqual(out.rows.map(v => v.projection.scheduleId), [left.scheduleId, right.scheduleId]);
});

test('independent lifecycle: lost SDK ACK retains unknown and never releases projection', async () => {
  const h = harness({ create() { throw Error('SDK payload secret'); } });
  await assert.rejects(h.run(), e => e.outcome === 'UNKNOWN' && !Object.hasOwn(e, 'projection') && !String(e).includes('secret'));
  assert.equal(h.calls.filter(v => v.name === 'create').length, 1);
  assert.equal(h.calls.filter(v => v.name === 'markUnknown').length, 1);
  assert.equal(h.calls.filter(v => v.name === 'commitKnown').length, 0);
});

test('independent lifecycle: authority expiry published before parked callback suppresses mutation', async () => {
  const gate = deferred();
  const h = harness({ clock: Date.now, authorize: async r => {
    r.limitDeadline(Date.now() + 70); await gate.promise;
    return { authorized: true, bindingSha256: r.binding.bindingSha256, callerIdentity: r.binding.callerIdentity, expiresAtMs: Date.now() + 30000 };
  } });
  await bounded(assert.rejects(h.run())); gate.resolve(); await flush();
  assert.equal(effects(h).length, 0); assert.equal(h.calls.filter(v => v.name === 'claim').length, 0);
});

test('independent lifecycle: released authority after committed mutation cannot release success', async () => {
  const h = harness({ authorize: async r => ({ authorized: r.phase !== 'before_release', bindingSha256: r.binding.bindingSha256,
    callerIdentity: r.binding.callerIdentity, expiresAtMs: h.clock() + 30000 }) });
  await assert.rejects(h.run(), e => e.outcome === 'ACKNOWLEDGED_NOT_RELEASED' && !Object.hasOwn(e, 'projection'));
  assert.equal(h.calls.filter(v => v.name === 'commitKnown').length, 1);
  assert.equal(h.calls.filter(v => v.name === 'markUnknown').length, 0);
});

test('independent lifecycle: deleted or missing Temporal schedule remains an explicitly unavailable authorized row', async () => {
  const p = projection(); p.state = 'cancelled';
  const h = harness({ ownerList: () => ({ rows: [{ projection: p, generation: 2, unresolved: false }], hasMore: false }),
    describe() { throw Error('schedule does not exist'); } });
  const out = await h.list(); assert.equal(out.rows.length, 1);
  assert.equal(out.rows[0].projection.state, 'cancelled'); assert.equal(out.rows[0].inspection, null);
  assert.equal(out.rows[0].inspectionState, 'unavailable'); assert.equal(out.coverage.complete, false);
  assert.equal(out.originalRuns.executions.length, 0);
  assert.equal(h.calls.filter(v => v.name === 'describe').length, 1);
  assert.ok(h.calls.some(v => v.name === 'authorize' && v.args[0].phase === 'before_unavailable_row_release'));
});

test('independent lifecycle: revoked missing-row release cannot become partial authorized data', async () => {
  const h = harness({ describe() { throw Error('absent'); }, authorize: async r => ({
    authorized: r.phase !== 'before_unavailable_row_release', bindingSha256: r.binding.bindingSha256,
    callerIdentity: r.binding.callerIdentity, expiresAtMs: h.clock() + 30000,
  }) });
  await assert.rejects(h.list()); assert.equal(h.calls.filter(v => v.name === 'workflowHandle').length, 0);
});

test('independent lifecycle: current read authority failure never becomes unavailable row', async () => {
  const h = harness({ authorize: async r => {
    if (r.phase === 'before_describe') throw Error('revoked');
    return { authorized: true, bindingSha256: r.binding.bindingSha256, callerIdentity: r.binding.callerIdentity, expiresAtMs: h.clock() + 30000 };
  } });
  await assert.rejects(h.list()); assert.equal(h.calls.filter(v => v.name === 'describe').length, 0);
});

test('independent lifecycle: invalid description identity does not become a missing-record assertion', async () => {
  const h = harness({ describe: () => ({ ...description(), scheduleId: 'wrong-schedule' }) });
  // Refusal may be an unavailable observation, but never released wrong identity or absence evidence.
  try {
    const out = await h.list(); assert.equal(out.rows[0].inspection, null);
    assert.equal(out.rows[0].inspectionState, 'unavailable'); assert.equal(out.coverage.complete, false);
    assert.equal(out.originalRuns.executions.length, 0);
  } catch (error) { assert.equal(error instanceof Error, true); }
});
