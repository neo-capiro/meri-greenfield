// The end of a turn across the real composed exchange (capture-composition-fixture.mjs) while the worker's executeConversation
// activity (temporal-worker.mjs) polls the original. The runner's checkpoint/complete runs control's completion capture over the real
// store (scripted SQL); its capture reaches the runner through the task router, where the capture's query close stops the original
// through the same router (fencing it) and closeNative stops the native process, all before the completion publishes. The worker polls
// execution/poll through control's execution route, the broker and its journal, and control's controller over that router.
// Live 2026-10-21 02:05:22Z (candidate 7): after the capture's self-stop the next poll's inspect was refused (the original was
// stopping), the activity's cleanup stopped the original and revoked its authority, the completion's next authority read failed, the
// runner's checkpoint/complete answered 503 and the turn ended ATTEMPT_LOST after the reply had streamed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {lifecycleFixture, allocateOriginal, binding, versions, scopes, id} from '../../../control/conversations/test/lifecycle-fixture.mjs';
import {createNativeCompletionCapture} from '../completion-capture.mjs';
import {createNativeExecutionBroker} from '../execution-broker.mjs';
import {createNativeExecutionApplication} from '../execution-http.mjs';
import {createBrokerActivity} from '../../temporal-worker.mjs';
import {composeCapture, taskToken} from './capture-composition-fixture.mjs';
import {sha} from './router-tls-fixture.mjs';

const workerToken = 'synthetic-worker-only', check = () => {}, sessionId = id(850);

/** A running turn whose native task the broker started, the worker activity polling it, and control's completion capture.
 * As live, no poll is in flight across the capture (`pollsAcrossCapture` lets them be): the capture waits for the polls in flight, and
 * a poll started after it runs while the completion publishes. The first object write waits for that poll's answer (or the activity's
 * cleanup); `holdPublication({revoke})` then decides it. */
async function turn(t, {holdPublication = async () => {}, pollsAcrossCapture = false} = {}) {
  const x = await composeCapture(t, {binding, versions, sessionId, selfStop: true});
  x.release();
  const f = await lifecycleFixture();
  t.after(() => f.close());
  // The run as the prepared kickoff leaves it: queued, its execution claimed and started, then starting and running.
  await f.service.allocateInput({credential: f.credential, input: f.input}); await f.service.submit({credential: f.credential, input: f.input});
  f.state.allocation = await allocateOriginal(f.store, binding);
  const {versions: _versions, ...identity} = x.original, {executionKey: _key, ...execution} = x.original;
  await f.store.executions.claim(identity, check);
  await f.store.executions.record({binding, executionId: x.original.executionId, phase: 'started', native: {...execution, taskId: 'scripted-native', state: 'executing', physicalStopProven: false}}, check);
  let n = 900;
  for (const state of ['starting', 'running']) await f.service.publish({credential: f.credential, binding, event: {eventId: id(n++), createdAt: new Date().toISOString(), type: 'run.status', data: {state, reasonCode: null}}});
  // The admitted task authority: the activity's cleanup closes it (supervisor close, allocation revocation).
  let revoked = false;
  const authority = {async verify(v) {
    if (revoked) throw Error('scripted revocation');
    return {binding, operation: v.operation, inputSha256: v.inputSha256, identityCredential: 'synthetic-authority', scopes, selectedClientId: id(5), policyRevision: scopes[0].policyRevision, authorizationDecisionId: 'scripted-current', checkedAtMs: Date.now(), expiresAtMs: x.original.expiresAtMs};
  }};
  const revoke = () => { revoked = true; x.revoke(); };
  const broker = createNativeExecutionBroker({binding, versions, plan: x.plan, expiresAtMs: x.original.expiresAtMs, journal: f.store.executions, tasks: x.controller, verifier: authority, taskCapability: taskToken, enabled: true, maxRequestMs: 10000});
  const executionRoutes = createNativeExecutionApplication({broker, runtime: {taskCapabilitySha256: sha(taskToken), runtime() { throw Error('unused'); }}, controlCapabilitySha256: sha(workerToken), taskCapabilitySha256: sha(taskToken), enabled: true, maxRequestMs: 10000});
  const opened = Promise.withResolvers(), publishing = Promise.withResolvers(), polling = Promise.withResolvers(), polls = [];
  let captureBegun = false, pollsInFlight = 0, stops = 0;
  const receipt = {binding, executionId: hash(binding), expiresAtMs: x.original.expiresAtMs};
  const native = {async call(operation, input, {signal} = {}) {
    if (operation === 'execution/kickoff') return receipt;
    if (operation === 'execution/kickoff/status') return {...receipt, state: 'executing'};
    // The prepared kickoff's close: control's own stop of the original, its supervisor closed and its allocation revoked.
    if (operation === 'execution/kickoff/stop') { stops++; revoke(); opened.resolve(); await x.controller.close().catch(() => {}); return receipt; }
    const after = captureBegun;
    if (after && !pollsAcrossCapture) await publishing.promise;
    pollsInFlight++;
    const response = await executionRoutes.handle(new Request('https://control.invalid/v1/execution/poll', {method: 'POST', headers: {authorization: 'Bearer ' + workerToken, 'content-type': 'application/json'}, body: JSON.stringify(input), signal})).finally(() => { pollsInFlight--; });
    const value = await response.json();
    polls.push({after, outcome: response.status === 200 ? value.state : value.error.code});
    if (response.status !== 200) throw Object.assign(Error(value.error.code), {code: value.error.code});
    polling.resolve();
    if (after && value.state === 'executing') opened.resolve();
    return value;
  }};
  const activity = createBrokerActivity({native, pollMs: 20, context: () => ({cancellationSignal: new AbortController().signal, heartbeat() {}})})({binding});
  activity.catch(() => {});
  const bytes = new Map();
  let puts = 0;
  const objects = {
    async put(v) { if (++puts === 1) { publishing.resolve(); await opened.promise; await holdPublication({revoke}); } const ref = {objectId: v.objectId, versionId: 'immutable-v1', scopes: v.scopes, sha256: sha(v.bytes), bytes: v.bytes.length}; bytes.set(ref.objectId, Buffer.from(v.bytes)); return ref; },
    async get(ref) { return Buffer.from(bytes.get(ref.objectId)); }};
  const completion = createNativeCompletionCapture({store: f.store, objects, authority, taskCapability: taskToken, original: x.original, taskCapture: {async capture(v) {
    captureBegun = true;
    while (!pollsAcrossCapture && pollsInFlight) await new Promise(resolve => setImmediate(resolve));
    return x.controller.capture(v);
  }}, enabled: true, maxRequestMs: 20000});
  const request = (await f.store.read(binding, {}, check)).request;
  const input = {binding, request, versions, scopes, sessionId, contextSha256: hash({window: request.window, skill: request.skill, scopes})};
  await polling.promise;
  return {f, x, activity, polls, stops: () => stops, complete: () => completion.captureCompletion(input),
    completionState: async () => (await f.store.completions.read({binding, scopes, selectedClientId: id(5)}, check))?.state};
}

test('the worker\'s poll leaves the end of the turn to the completion capture that stopped the original; the turn completes', async t => {
  const r = await turn(t);
  const receipt = await r.complete().catch(error => assert.fail(`${error.message} ${JSON.stringify(r.x.routerLog)} ${JSON.stringify(r.polls)}`));
  assert.equal(receipt.sessionId, sessionId);
  assert.equal((await r.f.store.read(binding, {}, check)).run.state, 'completed');
  assert.ok(r.polls.some(p => p.after && p.outcome === 'executing'), JSON.stringify(r.polls));
  assert.ok(!r.x.routerLog.some(line => line.operation === 'inspect' || line.operation === 'retire'), JSON.stringify(r.x.routerLog));
  // The published completion carries the stop it proved: the activity ends the turn completed, then stops the original once.
  assert.deepEqual(await r.activity, {state: 'completed'});
  assert.equal(r.stops(), 1);
  assert.ok(r.polls.every(p => p.outcome === 'executing' || p.outcome === 'completed'), JSON.stringify(r.polls));
});

test('a poll whose observation was in flight when the completion began defers to it once the capture\'s stop cuts it short', async t => {
  const r = await turn(t, {pollsAcrossCapture: true});
  // The next router exchange is this poll's inspect: parked in its ENI read until the capture's self-stop cancels it.
  r.x.holdNextObserve(); await r.x.inFlight(1);
  const receipt = await r.complete();
  assert.equal(receipt.sessionId, sessionId);
  assert.deepEqual(await r.activity, {state: 'completed'});
  assert.ok(r.x.routerLog.some(line => line.operation === 'inspect' && line.outcome === 'refused' && line.category === 'CANCELLED'), JSON.stringify(r.x.routerLog));
  assert.ok(r.polls.every(p => p.outcome === 'executing' || p.outcome === 'completed'), JSON.stringify(r.polls));
});

test('a completion capture given up ends the turn: the next poll observes the stopped original and the activity cleans it up', async t => {
  const r = await turn(t, {holdPublication: async () => { throw Error('scripted object store refusal'); }});
  await assert.rejects(r.complete());
  assert.equal(await r.completionState(), 'UNKNOWN');
  await assert.rejects(r.activity, {code: 'NATIVE_EXECUTION_UNAVAILABLE'});
  assert.equal(r.stops(), 1);
  assert.equal((await r.f.store.read(binding, {}, check)).run.state, 'running');
});

test('revocation while the completion capture holds the run is not held: the poll stops the original and the completion fails', async t => {
  const r = await turn(t, {holdPublication: async ({revoke}) => { revoke(); }});
  await assert.rejects(r.complete());
  await assert.rejects(r.activity, {code: 'NATIVE_EXECUTION_UNAVAILABLE'});
  assert.equal(r.stops(), 1);
  assert.notEqual((await r.f.store.read(binding, {}, check)).run.state, 'completed');
});
