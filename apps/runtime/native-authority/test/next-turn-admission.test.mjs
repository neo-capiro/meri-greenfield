// A second turn in the same conversation, after a first turn that completed through the real end-of-turn chain. Turn 1: control's
// completion capture over the real store (scripted SQL) captures through the task router, real TLS and the runner's capture source
// (capture-composition-fixture.mjs), and publishes. The next run is reserved and accepted through the real next-run owner and journal.
// Turn 2: the worker activity publishes its `starting` claim after load (worker/conversation/activity.mjs), then runner/runtime makes
// control's prepared runtime prepare the continuation: control's continuation runtime and checkpoint restorer, over the real
// restoration journal, read turn 1's checkpoint and write its workspace through the router into turn 2's runner receiver.
// Live 2026-10-21 05:58:53Z (candidate 8, conversation c80fce86): turn 2's runner/runtime answered 503 and the turn failed
// EXECUTION_FAILED at runtime-admission. The restoration journal refused its claim because the run was `starting`, not `queued`; no
// restoration row was written.
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {lifecycleFixture, allocateOriginal, recordRetired, binding, versions, scopes, id} from '../../../control/conversations/test/lifecycle-fixture.mjs';
import {createNextRunOwner} from '../../../control/conversations/next-run.mjs';
import {createNativeCompletionCapture} from '../completion-capture.mjs';
import {createNativeContinuationRuntime} from '../continuation-runtime.mjs';
import {createNativeCheckpointRestorer} from '../native-restorer.mjs';
import {composeCapture, taskToken} from './capture-composition-fixture.mjs';
import {sha} from './router-tls-fixture.mjs';

const check = () => {}, at = () => new Date().toISOString();
const status = (eventId, state) => ({eventId, createdAt: at(), type: 'run.status', data: {state, reasonCode: null}});
const authorityFor = b => ({async verify(v) {
  return {binding: b, operation: v.operation, inputSha256: v.inputSha256, identityCredential: 'synthetic-authority', scopes, selectedClientId: id(5), policyRevision: scopes[0].policyRevision, authorizationDecisionId: 'scripted-current', checkedAtMs: Date.now(), expiresAtMs: Date.now() + 600000};
}});

/** Turn 1 completed and retired, turn 2 accepted and loaded; `prepare()` is runner/runtime's continuation preparation for turn 2. */
async function secondTurn(t) {
  const f = await lifecycleFixture();
  t.after(() => f.close());
  // Turn 1: queued, allocated, starting, running, then the real end-of-turn completion.
  const first = await composeCapture(t, {binding, versions, sessionId: id(850), selfStop: true});
  first.release();
  await f.service.allocateInput({credential: f.credential, input: f.input}); await f.service.submit({credential: f.credential, input: f.input});
  const allocation = await allocateOriginal(f.store, binding);
  let n = 900;
  for (const state of ['starting', 'running']) await f.service.publish({credential: f.credential, binding, event: status(id(n++), state)});
  const blobs = new Map(), objects = {
    async put(v) { const ref = {objectId: v.objectId, versionId: 'immutable-v1', scopes: v.scopes, sha256: sha(v.bytes), bytes: v.bytes.length}; blobs.set(ref.objectId, Buffer.from(v.bytes)); return ref; },
    async get(ref) { return Buffer.from(blobs.get(ref.objectId)); }};
  const completion = createNativeCompletionCapture({store: f.store, objects, authority: authorityFor(binding), taskCapability: taskToken, original: first.original, taskCapture: first.controller, enabled: true, maxRequestMs: 20000});
  const firstRequest = (await f.store.read(binding, {}, check)).request;
  await completion.captureCompletion({binding, request: firstRequest, versions, scopes, sessionId: id(850), contextSha256: hash({window: firstRequest.window, skill: firstRequest.skill, scopes})});
  // The original retired and its grants revoked; the next run reserved and its prompt accepted.
  await recordRetired(f.store, allocation);
  const owner = createNextRunOwner({store: f.store, versions, newId: () => id(n++),
    retirement: {async verifyRetired() { return {physicalStopProven: true}; }},
    revocation: {async verifyRevoked({binding: b}) { return {grantIds: [id(240)], receiptSha256: hash({revoked: b.runId})}; }}});
  const second = (await owner.selectRun({principal: {tenantId: binding.tenantId, actorId: binding.actorId}, conversationId: binding.conversationId})).binding;
  const conversation = {conversationId: second.conversationId, owner: {tenantId: second.tenantId, actorId: second.actorId}, scopes, createdAt: at(), policyRevision: scopes[0].policyRevision};
  await f.store.nextRuns.accept({conversation, run: {binding: second, state: 'queued', scopes, createdAt: at(), policyRevision: scopes[0].policyRevision, versions},
    request: {requestId: id(n++), prompt: 'A second prompt about the first answer', skill: null, window: null, windowRequest: null},
    event: {contractVersion: '0.1.0', ...status(id(n++), 'queued'), binding: second, scopes, sequence: 1}}, check);
  // Turn 2's runner, with its task-resident workspace behind the receiver.
  const restored = [];
  const taskWorkspace = {
    async restore({signal: _signal, ...v}) { restored.push(v); return {binding: v.binding, restoreKey: v.restoreKey, workspaceSha256: v.workspaceSha256, checkedAtMs: Date.now(), expiresAtMs: next.original.expiresAtMs}; },
    async verify({signal: _signal, ...v}) { return {binding: v.binding, restoreKey: v.restoreKey, workspaceSha256: v.workspaceSha256, checkedAtMs: Date.now(), expiresAtMs: next.original.expiresAtMs}; }};
  const next = await composeCapture(t, {binding: second, versions, sessionId: id(851), selfStop: false, taskWorkspace});
  // runner/load hands the runner its lineage (the service reads it through the next-run journal); the activity then claims `starting`.
  const lineage = await f.store.nextRuns.execution({binding: second, scopes, selectedClientId: id(5)}, check), saved = await f.store.read(second, {}, check);
  const claim = state => f.store.append(second, status(id(n++), state), check);
  await claim('starting');
  // Control's continuation runtime and checkpoint restorer for turn 2 (remote-composition.mjs createRemoteNativeController).
  const restorer = createNativeCheckpointRestorer({journal: f.store.restorations, objects, workspace: '/workspace/' + second.conversationId, workspaceOwner: next.controller.workspace, expiresAtMs: next.original.expiresAtMs});
  const continuation = createNativeContinuationRuntime({store: f.store, verifier: authorityFor(second), taskCapability: taskToken, restorer});
  const prepare = () => continuation.prepare({binding: second, versions: saved.run.versions, nextTurn: lineage.nextTurn, sourceRequest: lineage.nextTurn.sourceRequest, request: saved.request, scopes: saved.run.scopes});
  return {f, second, lineage, restored, claim, prepare,
    restoration: async () => (await f.store.restorations.read({binding: second, restoreKey: hash({binding: second, versions: saved.run.versions, request: saved.request, sourceRequest: lineage.nextTurn.sourceRequest, scopes, nextTurn: lineage.nextTurn})}, check)).record};
}

test('a second turn claimed `starting` restores the first turn\'s checkpoint through the router and is admitted', async t => {
  const r = await secondTurn(t);
  const prepared = await r.prepare();
  assert.equal(prepared.sdkSessionKey.sessionId, id(850), 'the SDK resumes the first turn\'s session');
  assert.equal(prepared.restoreReceipt.checkpointSha256, r.lineage.nextTurn.checkpointSha256);
  assert.equal((await r.restoration()).state, 'RESTORED');
  // The first turn's workspace reached the second turn's runner through the router.
  assert.equal(r.restored.length, 1);
  assert.deepEqual(r.restored[0].files.map(file => Buffer.from(file.base64, 'base64').toString()), ['captured']);
});

test('a restoration is still refused once the turn is running, and nothing is restored', async t => {
  const r = await secondTurn(t);
  await r.claim('running');
  await assert.rejects(r.prepare(), /NATIVE_PREPARATION_STATE_REFUSED/);
  assert.equal(await r.restoration(), null);
  assert.equal(r.restored.length, 0);
});
