// A conversation through the real end-of-turn chain, shared by the next-turn admission tests. Turn 1: control's completion capture over
// the real store (scripted SQL) captures through the task router, real TLS and the runner's capture source (capture-composition-fixture.mjs),
// and publishes. Each next run is reserved and accepted through the real next-run owner and journal. A next turn's runner: the worker
// activity publishes its `starting` claim after load (worker/conversation/activity.mjs), then runner/runtime makes control's prepared
// runtime prepare the continuation: control's continuation runtime and checkpoint restorer, over the real restoration journal, read the
// lineage checkpoint and write its workspace through the router into the turn's runner receiver.
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {lifecycleFixture, allocateOriginal, recordRetired, binding, versions, scopes, id} from '../../../control/conversations/test/lifecycle-fixture.mjs';
import {createNextRunOwner} from '../../../control/conversations/next-run.mjs';
import {createNativeCompletionCapture} from '../completion-capture.mjs';
import {createNativeContinuationRuntime} from '../continuation-runtime.mjs';
import {createNativeCheckpointRestorer} from '../native-restorer.mjs';
import {composeCapture, taskToken} from './capture-composition-fixture.mjs';
import {sha} from './router-tls-fixture.mjs';

export {binding, id};
const check = () => {}, at = () => new Date().toISOString();
const status = (eventId, state, reasonCode = null) => ({eventId, createdAt: at(), type: 'run.status', data: {state, reasonCode}});
const authorityFor = b => ({async verify(v) {
  return {binding: b, operation: v.operation, inputSha256: v.inputSha256, identityCredential: 'synthetic-authority', scopes, selectedClientId: id(5), policyRevision: scopes[0].policyRevision, authorizationDecisionId: 'scripted-current', checkedAtMs: Date.now(), expiresAtMs: Date.now() + 600000};
}});

export async function conversation(t) {
  const f = await lifecycleFixture();
  t.after(() => f.close());
  let n = 900;
  const next = () => id(n++);
  const blobs = new Map(), objects = {
    async put(v) { const ref = {objectId: v.objectId, versionId: 'immutable-v1', scopes: v.scopes, sha256: sha(v.bytes), bytes: v.bytes.length}; blobs.set(ref.objectId, Buffer.from(v.bytes)); return ref; },
    async get(ref) { return Buffer.from(blobs.get(ref.objectId)); }};
  const owner = createNextRunOwner({store: f.store, versions, newId: next,
    retirement: {async verifyRetired() { return {physicalStopProven: true}; }},
    revocation: {async verifyRevoked({binding: b}) { return {grantIds: [id(240)], receiptSha256: hash({revoked: b.runId})}; }}});

  /** Turn 1: queued, allocated, starting, running, then the real end-of-turn completion; its original retired and grants revoked. */
  async function firstCompleted() {
    const first = await composeCapture(t, {binding, versions, sessionId: id(850), selfStop: true});
    first.release();
    await f.service.allocateInput({credential: f.credential, input: f.input}); await f.service.submit({credential: f.credential, input: f.input});
    const allocation = await allocateOriginal(f.store, binding);
    for (const state of ['starting', 'running']) await f.service.publish({credential: f.credential, binding, event: status(next(), state)});
    const completion = createNativeCompletionCapture({store: f.store, objects, authority: authorityFor(binding), taskCapability: taskToken, original: first.original, taskCapture: first.controller, enabled: true, maxRequestMs: 20000});
    const request = (await f.store.read(binding, {}, check)).request;
    await completion.captureCompletion({binding, request, versions, scopes, sessionId: id(850), contextSha256: hash({window: request.window, skill: request.skill, scopes})});
    await recordRetired(f.store, allocation);
    return {binding, request};
  }

  /** The next run, reserved by the owner after the latest run, with its prompt accepted. */
  async function acceptNext(prompt) {
    const target = (await owner.selectRun({principal: {tenantId: binding.tenantId, actorId: binding.actorId}, conversationId: binding.conversationId})).binding;
    const conversation = {conversationId: target.conversationId, owner: {tenantId: target.tenantId, actorId: target.actorId}, scopes, createdAt: at(), policyRevision: scopes[0].policyRevision};
    await f.store.nextRuns.accept({conversation, run: {binding: target, state: 'queued', scopes, createdAt: at(), policyRevision: scopes[0].policyRevision, versions},
      request: {requestId: next(), prompt, skill: null, window: null, windowRequest: null},
      event: {contractVersion: '0.1.0', ...status(next(), 'queued'), binding: target, scopes, sequence: 1}}, check);
    return target;
  }

  /** A turn that claimed its allocation, ran and ended failed or cancelled; its original retired and grants revoked. */
  async function endTurn(b, state, reasonCode) {
    const allocation = await allocateOriginal(f.store, b);
    for (const s of ['starting', 'running']) await f.store.append(b, status(next(), s), check);
    await f.store.append(b, status(next(), state, reasonCode), check);
    await recordRetired(f.store, allocation);
  }

  /** The turn's runner with its task-resident workspace behind the receiver; `prepare()` is runner/runtime's continuation preparation. */
  async function runner(target, sessionId) {
    const restored = [];
    const taskWorkspace = {
      async restore({signal: _signal, ...v}) { restored.push(v); return {binding: v.binding, restoreKey: v.restoreKey, workspaceSha256: v.workspaceSha256, checkedAtMs: Date.now(), expiresAtMs: composed.original.expiresAtMs}; },
      async verify({signal: _signal, ...v}) { return {binding: v.binding, restoreKey: v.restoreKey, workspaceSha256: v.workspaceSha256, checkedAtMs: Date.now(), expiresAtMs: composed.original.expiresAtMs}; }};
    const composed = await composeCapture(t, {binding: target, versions, sessionId, selfStop: false, taskWorkspace});
    // runner/load hands the runner its lineage (the service reads it through the next-run journal); the activity then claims `starting`.
    const lineage = await f.store.nextRuns.execution({binding: target, scopes, selectedClientId: id(5)}, check), saved = await f.store.read(target, {}, check);
    const claim = state => f.store.append(target, status(next(), state), check);
    await claim('starting');
    // Control's continuation runtime and checkpoint restorer for the turn (remote-composition.mjs createRemoteNativeController).
    const restorer = createNativeCheckpointRestorer({journal: f.store.restorations, objects, workspace: '/workspace/' + target.conversationId, workspaceOwner: composed.controller.workspace, expiresAtMs: composed.original.expiresAtMs});
    const continuation = createNativeContinuationRuntime({store: f.store, verifier: authorityFor(target), taskCapability: taskToken, restorer});
    const prepare = () => continuation.prepare({binding: target, versions: saved.run.versions, nextTurn: lineage?.nextTurn, sourceRequest: lineage?.nextTurn.sourceRequest, request: saved.request, scopes: saved.run.scopes});
    return {lineage, restored, claim, prepare,
      restoration: async () => (await f.store.restorations.read({binding: target, restoreKey: hash({binding: target, versions: saved.run.versions, request: saved.request, sourceRequest: lineage.nextTurn.sourceRequest, scopes, nextTurn: lineage.nextTurn})}, check)).record};
  }

  return {firstCompleted, acceptNext, endTurn, runner};
}
