/** One tool call coordinator, not an agent loop or source adapter. */
import { canonicalSha256 } from '../../../packages/contracts/validate.mjs';
import { createDispatchLifetime, markBudgetUncertain } from './dispatch-lifetime.mjs';
import { deny, exactKeys, parseRawJson, rejectArgumentAuthority, safeFailure } from './operation-result.mjs';
import { assertOperationArguments, prepareOperationContext } from './operation-context.mjs';
import { assertDispatchResult } from './read-result-envelope.mjs';
import { assertProjectionConfiguration } from './projection-read-context.mjs';
import {nativeReadGroup,nativeContextPortsFor} from './native-read-context.mjs';
import {signedRetainedSourceId,signedRetainedSourceOperation} from '../sources/retained-reads/signed-source-operations.mjs';

const sameBinding = (a, b) => canonicalSha256(a.binding) === canonicalSha256(b.binding) && a.policyRevision === b.policyRevision;
const subjectSelection = subject => {
  const { authorizationDecisionId: ignored, ...selection } = subject;
  return selection;
};
function sameAuthority(a, b) {
  return sameBinding(a, b) && canonicalSha256(subjectSelection(a.subject)) === canonicalSha256(subjectSelection(b.subject));
}

export function createToolDispatch({ catalog, authority, budget, limits, now, newId, sourceEnabled = false, memoryContextPorts, mailContextPorts, retainedContextPorts, nativeReadContextPorts, defaultCongress, invocationId }) {
  if (!catalog || typeof catalog.entry !== 'function' || typeof catalog.discoverable !== 'function' ||
      !authority || typeof authority.identify !== 'function' || typeof authority.check !== 'function' ||
      !budget || ['reserve', 'settle', 'markUncertain'].some(name => typeof budget[name] !== 'function') ||
      typeof now !== 'function' || typeof newId !== 'function' || !limits ||
      ['maxRequestBytes', 'maxResponseBytes', 'maxRequestMs', 'maxCleanupMs'].some(name =>
        !Number.isSafeInteger(limits[name]) || limits[name] < 1) || typeof sourceEnabled !== 'boolean') deny('GATEWAY_CONFIGURATION');
  if (limits.maxRequestBytes > 16*1024*1024 || limits.maxResponseBytes > 16*1024*1024 ||
      limits.maxRequestMs > 3600000 || limits.maxCleanupMs > 60000) deny('GATEWAY_CONFIGURATION');
  assertProjectionConfiguration(defaultCongress);
  if (invocationId !== undefined && (typeof invocationId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(invocationId))) deny('GATEWAY_CONFIGURATION');
  // Durable dispatch only: an invocation-aware native read context learns this call's trusted invocation id (option B's call slot).
  const nativePorts = nativeContextPortsFor(nativeReadContextPorts, invocationId);

  async function execute(requestJson, credential, signal) {
    const request = parseRawJson(requestJson, limits.maxRequestBytes);
    exactKeys(request, ['operation', 'arguments']); exactKeys(request.operation, ['id', 'version']);
    if (typeof request.operation.id !== 'string' || typeof request.operation.version !== 'string') deny('INVALID_ARGUMENTS');
    rejectArgumentAuthority(request.arguments);
    const entry = catalog.entry(request.operation);
    if (!sourceEnabled || entry === null) deny('UNAVAILABLE');
    if (canonicalSha256(entry.descriptor.operation) !== canonicalSha256(request.operation)) deny('GATEWAY_CONFIGURATION');
    const signedSource=signedRetainedSourceId(request.operation.id);
    if(signedSource&&(!signedRetainedSourceOperation(request.operation)||invocationId===undefined))deny('UNAVAILABLE');
    assertOperationArguments(entry, request.arguments);
    let deadlineMs = now()+limits.maxRequestMs;
    const ownedLifetime = createDispatchLifetime({ deadlineMs, now, signal });
    const lifetime = { ...ownedLifetime, limitDeadline(next) {
      ownedLifetime.limitDeadline(next); deadlineMs = Math.min(deadlineMs, next);
    } };
    let reservationId; let reservationAttempted = false; let settled = false;
    try {
      const identity = await lifetime.run(signal => authority.identify({ credential, signal, limitDeadline: lifetime.limitDeadline }));
      lifetime.limitDeadline(Math.min(identity.run.deadlineMs, Date.parse(identity.claims.expiresAt)));
      const authorize = input => lifetime.run(signal => authority.check({ credential, descriptor: entry.descriptor,
        input, signal, limitDeadline: lifetime.limitDeadline }));
      const context = await prepareOperationContext({ entry, request: request.arguments, identity, authorize,
        ports: memoryContextPorts, mailPorts: mailContextPorts, retainedPorts:retainedContextPorts, nativePorts, lifetime, readDeadline: () => deadlineMs,
        now, maxBytes: limits.maxResponseBytes, defaultCongress });
      let normalized;
      try { normalized = context.normalized ?? entry.contract.normalizeInput(request.arguments, context.options(context.authority)); }
      catch { deny('INVALID_ARGUMENTS'); }
      if (!normalized || canonicalSha256(normalized.input) !== normalized.argumentsSha256) deny('INVALID_ARGUMENTS');
      const inspect = () => authorize(normalized.input);
      const before = await inspect();
      if (!sameBinding(before, { binding: identity.claims.binding, policyRevision: identity.claims.policyRevision })) deny('ACCESS_DENIED');
      if (context.authority && !sameAuthority(context.authority, before)) deny('ACCESS_DENIED');
      if (now() >= before.deadlineMs) deny('DEADLINE');
      lifetime.limitDeadline(before.deadlineMs);
      await context.observeAuthority(before);
      reservationId = newId();
      if (typeof reservationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(reservationId)) deny('GATEWAY_CONFIGURATION');
      reservationAttempted = true;
      const reservation = parseRawJson(await lifetime.run(signal => budget.reserve({ reservationId, binding: before.binding,
        operation: entry.descriptor.operation, argumentsSha256: normalized.argumentsSha256,
        budgets: before.claims.budgets, deadlineMs: before.deadlineMs, signal })), limits.maxResponseBytes, 'BUDGET_UNCERTAIN');
      exactKeys(reservation, ['reservationId', 'decision'], 'BUDGET_UNCERTAIN');
      if (reservation.reservationId !== reservationId || reservation.decision !== 'reserved') deny('BUDGET_UNCERTAIN');
      const effect = await inspect();
      if (!sameAuthority(before, effect) || now() >= effect.deadlineMs) deny('ACCESS_DENIED');
      lifetime.limitDeadline(effect.deadlineMs);
      await context.observeAuthority(effect);
      let outputJson;
      const projection = ['bound-projection/1','client-documents/1'].includes(entry.contract.binding?.dispatchProfile);
      try { outputJson = await lifetime.run(signal => entry.execute({ input: normalized.input,
        request: normalized.request, authority: effect, argumentsSha256: normalized.argumentsSha256,
        ...(projection || context.handlerNormalization ? {normalizationContext:context.options(effect)} : {}),
        ...(signedSource?{invocationId}:{}),signal })); }
      catch (error) {
        const failure = safeFailure(error);
        if (['DEADLINE', 'CANCELLED'].includes(failure.message)) throw failure;
        if(failure.message==='UNAVAILABLE'&&(nativeReadGroup(entry)||['research-portfolio','florida-budget'].includes(entry.contract.binding?.group)))throw failure;
        deny('INVALID_RESULT');
      }
      const output = parseRawJson(outputJson, Math.min(limits.maxResponseBytes, effect.claims.budgets.maxOutputBytes), 'INVALID_RESULT');
      const result = assertDispatchResult({ entry, output, authority: effect, normalized, context });
      const release = await inspect();
      if (!sameAuthority(effect, release) || now() >= release.deadlineMs) deny('ACCESS_DENIED');
      lifetime.limitDeadline(release.deadlineMs);
      await context.observeAuthority(release);
      await context.retain({ current: release, normalized, result });
      const settlement = parseRawJson(await lifetime.run(signal => budget.settle({ reservationId, outcome: 'completed',
        outputBytes: Buffer.byteLength(outputJson, 'utf8'), resultSha256: canonicalSha256(output), signal })), limits.maxResponseBytes, 'BUDGET_UNCERTAIN');
      exactKeys(settlement, ['reservationId', 'decision'], 'BUDGET_UNCERTAIN');
      if (settlement.reservationId !== reservationId || settlement.decision !== 'settled') deny('BUDGET_UNCERTAIN');
      settled = true;
      const final = await inspect();
      if (!sameAuthority(effect, final) || now() >= final.deadlineMs) deny('ACCESS_DENIED');
      lifetime.limitDeadline(final.deadlineMs);
      await context.observeAuthority(final);
      lifetime.check();
      return outputJson;
    } catch (error) {
      if (reservationAttempted && !settled) await markBudgetUncertain(budget, reservationId, limits.maxCleanupMs);
      throw safeFailure(error);
    } finally { lifetime.close(); }
  }
  // No exposure until a separately qualified discovery grant contract exists.
  async function discover() { return []; }
  return Object.freeze({ execute, discover });
}
