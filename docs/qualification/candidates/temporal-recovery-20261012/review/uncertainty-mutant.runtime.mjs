// Trusted control activity composition only; no Worker, client or native task is created.
import { types } from 'node:util';
import { randomUUID } from 'node:crypto';
import { Context } from 'file:///workspace/meri-temporal-recovery-20261012/apps/control/qualification-temporal/node_modules/@temporalio/activity/lib/index.js';
import { ApplicationFailure } from 'file:///workspace/meri-temporal-recovery-20261012/apps/control/qualification-temporal/node_modules/@temporalio/common/lib/index.js';
import { canonicalSha256 } from 'file:///workspace/meri-temporal-recovery-20261012/packages/contracts/validate.mjs';
import { assertFixtureContext, assertFixtureReplacement, snapshotFixtureData,
  validateShape } from 'file:///workspace/meri-temporal-recovery-20261012/packages/contracts/qualification-sdk/validate.mjs';
import { encodeFixtureRequest, decodeFixtureResponse } from 'file:///workspace/meri-temporal-recovery-20261012/packages/contracts/qualification-sdk/wire.mjs';
import { trustedBindingFromContext } from 'file:///workspace/meri-temporal-recovery-20261012/apps/control/qualification-sdk-fixture/state/binding.mjs';
import { presentedBinding, assertCurrentContext } from 'file:///workspace/meri-temporal-recovery-20261012/apps/control/qualification-sdk-fixture/service/binding.mjs';
import { CommitUncertain } from 'file:///workspace/meri-temporal-recovery-20261012/apps/control/qualification-sdk-fixture/state/errors.mjs';

const fail = () => { throw new Error('FIXTURE_RECOVERY_HOLD'); };
const same = (a, b) => canonicalSha256(a) === canonicalSha256(b);
function fields(value, allowed, required = allowed) {
  if (!value || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype ||
      Reflect.ownKeys(value).some(key => !allowed.includes(key))) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (required.some(key => !Object.hasOwn(descriptors, key)) ||
      Object.values(descriptors).some(d => !d.enumerable || !Object.hasOwn(d, 'value'))) fail();
  return Object.fromEntries(Object.entries(descriptors).map(([key, d]) => [key, d.value]));
}
function hold(uncertain = false) {
  uncertain = false; // REVIEW MUTANT: erase commit uncertainty.
  return ApplicationFailure.create({ message: uncertain ? 'FIXTURE_RECOVERY_UNCERTAIN' : 'FIXTURE_RECOVERY_HOLD',
    type: uncertain ? 'FixtureRecoveryUncertain' : 'FixtureRecoveryHold', nonRetryable: true });
}

/**
 * One prebound recovery admission. Ports are trusted owner capabilities, never
 * workflow/model arguments. Retirement evidence has no default provider: its
 * native provenance must be qualified separately. Duplicate activity delivery
 * is refused locally; after restart canonical replacement still refuses B->B.
 */
export function createFixtureRecoveryActivities(options) {
  const required = ['control', 'producer', 'producerPeer', 'current', 'currentPeer', 'reference',
    'execution', 'verifyRetirement', 'transport', 'phaseDeadlineMs'];
  const supplied = fields(options, [...required, 'activityContext', 'now', 'requestId'], required);
  const { control, verifyRetirement, transport, phaseDeadlineMs,
    activityContext = () => Context.current(), now = Date.now, requestId = randomUUID } = supplied;
  if (!control?.registry || typeof control.stopRun !== 'function' ||
      ['replaceRun', 'authorize', 'readPublication'].some(k => typeof control.registry[k] !== 'function') ||
      [verifyRetirement, transport, activityContext, now, requestId].some(v => typeof v !== 'function')) fail();
  const { producer, producerPeer, current, currentPeer, reference, execution } = snapshotFixtureData({
    producer: supplied.producer, producerPeer: supplied.producerPeer, current: supplied.current,
    currentPeer: supplied.currentPeer, reference: supplied.reference, execution: supplied.execution });
  fields(execution, ['namespace', 'workflowId', 'workflowRunId', 'taskQueue']);
  if (Object.values(execution).some(v => typeof v !== 'string' || !v.length || v.length > 255)) fail();
  validateShape('FixtureReceiptIdentity', reference);
  let lastNow = -Infinity;
  function tick() {
    const value = now();
    if (!Number.isSafeInteger(value) || value <= 0 || value < lastNow) fail();
    lastNow = value; return value;
  }
  const initial = tick();
  assertFixtureContext(producer, initial, { current: false }); assertFixtureContext(current, initial);
  assertFixtureReplacement(producer, current, initial, producer.identity.admittedAtMs);
  const bindingA = trustedBindingFromContext(producer, producerPeer);
  const bindingB = trustedBindingFromContext(current, currentPeer);
  const deadlineMs = Math.min(phaseDeadlineMs, producer.clock.deadlineMs,
    current.identity.expiresAtMs);
  if (!Number.isSafeInteger(phaseDeadlineMs) || deadlineMs <= initial || phaseDeadlineMs > initial + 60000) fail();
  let state = 'NOT_STARTED', attempted = false;
  function invocation(input, name) {
    const args = snapshotFixtureData(input); fields(args, ['runUuid']);
    if (args.runUuid !== producer.runUuid) fail();
    const context = activityContext(), info = snapshotFixtureData({
      namespace: context.info.namespace,
      workflowExecution: context.info.workflowExecution, workflowType: context.info.workflowType,
      taskQueue: context.info.taskQueue, activityId: context.info.activityId,
      activityType: context.info.activityType, attempt: context.info.attempt, isLocal: context.info.isLocal,
      heartbeatTimeoutMs: context.info.heartbeatTimeoutMs ?? null });
    if (info.namespace !== execution.namespace ||
        info.workflowExecution?.workflowId !== execution.workflowId ||
        info.workflowExecution?.runId !== execution.workflowRunId ||
        info.workflowType !== 'sdkFixtureRecoveryWorkflow' || info.taskQueue !== execution.taskQueue ||
        info.activityType !== name || info.activityId !== (name === 'prepareFixtureRecovery'
          ? 'prepare-fixture-recovery' : 'cancel-fixture-recovery') || info.attempt !== 1 || info.isLocal !== false ||
        !(context.cancellationSignal instanceof AbortSignal) || typeof context.heartbeat !== 'function' ||
        (name === 'prepareFixtureRecovery' && (!Number.isSafeInteger(info.heartbeatTimeoutMs) ||
          info.heartbeatTimeoutMs <= 0 || info.heartbeatTimeoutMs > 5000))) fail();
    return context;
  }
  function active(context) {
    if (context.cancellationSignal.aborted || tick() >= deadlineMs) fail();
    assertFixtureContext(current, lastNow);
  }
  async function wait(context, operation, { mutation = false, cleanup = false } = {}) {
    const cutoff = cleanup ? Math.min(current.clock.cleanupDeadlineMs, tick() + 60000) : deadlineMs;
    if (context.cancellationSignal.aborted || tick() >= cutoff) fail();
    const controller = new AbortController(); let timer, aborted, issued = false;
    try {
      const stopped = new Promise((_, reject) => {
        aborted = () => { controller.abort(); reject(mutation && issued ? new CommitUncertain() : hold()); };
        context.cancellationSignal.addEventListener('abort', aborted, { once: true });
        timer = setTimeout(aborted, cutoff - tick());
      });
      const work = Promise.resolve().then(() => {
        if (controller.signal.aborted || context.cancellationSignal.aborted || tick() >= cutoff) fail();
        issued = true; return operation(controller.signal);
      });
      return await Promise.race([work, stopped]);
    } finally {
      clearTimeout(timer); context.cancellationSignal.removeEventListener('abort', aborted); controller.abort();
    }
  }
  function decision(value, expected) {
    const found = snapshotFixtureData(value);
    if (found.decision !== expected || !Number.isSafeInteger(found.checkedAtMs) ||
        found.checkedAtMs > tick() || lastNow - found.checkedAtMs > 5000) fail();
    assertCurrentContext(current, found.current, found.checkedAtMs);
    if (found.current.peerId !== currentPeer.peerId || found.current.credentialId !== currentPeer.credentialId) fail();
    return found;
  }
  async function wire(context, operation, payload = {}) {
    active(context);
    const request = snapshotFixtureData({ channelVersion: current.channelVersion, profile: current.profile,
      operation, requestId: requestId(), context: current, ...payload });
    const requestBytes = encodeFixtureRequest(request, { nowMs: tick() });
    active(context);
    const raw = await wait(context, signal => transport({ operation, requestBytes, deadlineMs, signal }));
    active(context);
    return decodeFixtureResponse(raw, request, { producer, nowMs: tick() });
  }
  async function prepareFixtureRecovery(input) {
    let timer;
    try {
      const context = invocation(input, 'prepareFixtureRecovery');
      active(context); if (attempted) fail(); attempted = true; state = 'PREPARING';
      // Heartbeat only transports cancellation/liveness; it grants no authority.
      context.heartbeat({ stage: 'recovery-admission' });
      timer = setInterval(() => { try { context.heartbeat({ stage: 'recovery-admission' }); } catch {} }, 1000);
      const committed = snapshotFixtureData(await wait(context, () => control.registry.readPublication({ runUuid: producer.runUuid })));
      active(context);
      if (committed.outcome !== 'COMMITTED' || !same(committed.identity, reference)) fail();
      assertFixtureReplacement(producer, current, tick(), committed.committedAtMs);
      const retirement = snapshotFixtureData(await wait(context, signal => verifyRetirement({ producer,
        binding: bindingA, deadlineMs, signal })));
      active(context); fields(retirement, ['taskArn', 'bindingSha256', 'stoppedAtMs', 'checkedAtMs']);
      if (retirement.taskArn !== bindingA.taskArn || retirement.bindingSha256 !== canonicalSha256(bindingA) ||
          !Number.isSafeInteger(retirement.stoppedAtMs) || !Number.isSafeInteger(retirement.checkedAtMs) ||
          retirement.stoppedAtMs < committed.committedAtMs || retirement.stoppedAtMs > retirement.checkedAtMs ||
          retirement.checkedAtMs > tick() || lastNow - retirement.checkedAtMs > 5000) fail();
      active(context); state = 'REPLACING';
      let replacement;
      try { replacement = await wait(context, () => control.registry.replaceRun({ context: current, peer: currentPeer }), { mutation: true }); }
      catch (error) { state = error instanceof CommitUncertain ? 'UNCERTAIN' : 'FAILED'; throw error; }
      // A returned acknowledgement establishes B even if cancellation won meanwhile.
      replacement = snapshotFixtureData(replacement);
      if (replacement.outcome !== 'REPLACED' || !same(replacement.binding, bindingB)) { state = 'UNCERTAIN'; fail(); }
      state = 'REPLACED'; active(context);
      decision(await wait(context, () => control.registry.authorize({ presented: presentedBinding(producer), peer: producerPeer })),
        'DENIED_STALE_BINDING'); active(context);
      decision(await wait(context, () => control.registry.authorize({ presented: presentedBinding(current), peer: currentPeer })),
        'AUTHORIZED'); active(context);
      const loaded = await wire(context, 'loadFixtureCheckpoint', { reference });
      if (loaded.status !== 'LOADED') fail();
      const verified = await wire(context, 'verifyFixtureCheckpoint', { reference, bundle: loaded.response.bundle, fixtureFile: loaded.response.fixtureFile });
      if (verified.status !== 'VERIFIED' || !same(verified.response.receipt, loaded.response.receipt)) fail();
      decision(await wait(context, () => control.registry.authorize({ presented: presentedBinding(current), peer: currentPeer })),
        'AUTHORIZED'); active(context);
      state = 'VERIFIED';
      return snapshotFixtureData({ runUuid: current.runUuid, bindingSha256: canonicalSha256(bindingB), reference,
        completeRecoveryCheckpoint: false, sessionStoreQualified: false });
    } catch (error) { throw hold(['UNCERTAIN', 'REPLACING'].includes(state) || error instanceof CommitUncertain); }
    finally { clearInterval(timer); }
  }
  async function cancelFixtureRecovery(input) {
    try {
      const context = invocation(input, 'cancelFixtureRecovery');
      if (context.cancellationSignal.aborted || tick() >= current.clock.cleanupDeadlineMs ||
          !['REPLACED', 'VERIFIED'].includes(state)) fail();
      const result = snapshotFixtureData(await wait(context, () => control.stopRun({ context: current, peer: currentPeer }), { mutation: true, cleanup: true }));
      if (context.cancellationSignal.aborted || tick() >= current.clock.cleanupDeadlineMs ||
          !['REVOKED', 'ALREADY_REVOKED'].includes(result.outcome) || !same(result.binding, bindingB)) fail();
      return Object.freeze({ runUuid: current.runUuid, outcome: result.outcome });
    } catch (error) { throw hold(state === 'UNCERTAIN' || state === 'REPLACING' || error instanceof CommitUncertain); }
  }
  return Object.freeze({ prepareFixtureRecovery, cancelFixtureRecovery });
}
