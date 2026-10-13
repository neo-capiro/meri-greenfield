/** Mail source admission and correlation; current authorization remains in the dispatcher. */
import {types} from 'node:util';
import {canonicalSha256, validateShape as publicShape} from '../../../../packages/contracts/validate.mjs';
import {assertSubject, resolveOperationContract, validateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {assertResultLineage, deny} from '../../dispatch/operation-result.mjs';
import {frozenData, ownFields} from '../source-admission.mjs';
export {frozenData, ownFields} from '../source-admission.mjs';

const aborted = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted').get;
const same = (a, b) => canonicalSha256(a) === canonicalSha256(b);
const selections = Object.freeze({
  'mail.list_messages': 'MailListSelection',
  'mail.search_messages': 'MailSearchSelection',
  'mail.read_thread': 'MailThreadSelection',
});
export const operationIds = Object.freeze(Object.keys(selections));

export function mailContract(reference) {
  const operation = frozenData(reference);
  ownFields(operation, ['id', 'version']);
  if (!Object.hasOwn(selections, operation.id) || operation.version !== '0.2.0') deny('GATEWAY_CONFIGURATION');
  return {operation, contract: resolveOperationContract(operation)};
}

export function readContext(call, now) {
  const fields = ownFields(call, ['operation', 'input', 'request', 'authority'], ['signal']);
  const {operation, contract} = mailContract(fields.operation);
  const input = frozenData(fields.input), request = frozenData(fields.request), authority = frozenData(fields.authority);
  validateShape(selections[operation.id], input);
  publicShape('RunBinding', authority.binding); publicShape('CapabilityClaims', authority.claims);
  assertSubject(authority.subject, authority.binding);
  if (!same(authority.binding, authority.claims.binding) ||
      authority.policyRevision !== authority.subject.policyRevision || authority.policyRevision !== authority.claims.policyRevision ||
      !['personal', 'client'].includes(authority.subject.kind) || input.subject.kind !== authority.subject.kind ||
      (input.subject.kind === 'client' && input.subject.entityId !== authority.subject.entityIds[0]) ||
      !authority.subject.scopes.some(scope => scope.kind === 'mailbox') ||
      authority.subject.scopes.some(scope => !authority.claims.scopes.some(parent => same(scope, parent))) ||
      !Array.isArray(authority.sourceIds) || !same([...authority.sourceIds].sort(),
        [...new Set(contract.descriptor.sourceRequirements.map(source => source.sourceId))].sort())) deny('ACCESS_DENIED');
  const issued = Date.parse(authority.claims.issuedAt), expiry = Date.parse(authority.claims.expiresAt);
  if (!Number.isSafeInteger(issued) || !Number.isSafeInteger(expiry) || issued >= expiry ||
      !Number.isSafeInteger(authority.deadlineMs)) deny('DEADLINE');
  const signal = fields.signal, deadlineMs = Math.min(authority.deadlineMs, expiry);
  if (signal !== undefined) {
    if (types.isProxy(signal)) deny('INVALID_ARGUMENTS');
    try { aborted.call(signal); } catch { deny('INVALID_ARGUMENTS'); }
  }
  function active(cutoff = deadlineMs) {
    const stamp = now();
    if (signal !== undefined && aborted.call(signal)) deny('CANCELLED');
    if (!Number.isSafeInteger(stamp) || stamp < 0 || stamp < issued || stamp >= Math.min(deadlineMs, cutoff)) deny('DEADLINE');
    return stamp;
  }
  active();
  const normalized = contract.normalizeInput(request, {nowMs: active()});
  if (!same(normalized.input, input)) deny('INVALID_ARGUMENTS');
  const metadata = normalized.metadata;
  return {operation, contract, input, metadata, request, authority, signal, deadlineMs, active,
    argumentsSha256: normalized.argumentsSha256, requestSha256: canonicalSha256({input, metadata})};
}

export function assertMailPage(page, context, request) {
  const nowMs = context.active();
  try {
    validateShape(context.contract.binding.output, page);
    assertResultLineage(page, context.authority);
    if (!same(page.operation, context.operation) || page.argumentsSha256 !== context.argumentsSha256 ||
        !same(page.selection, context.input) || page.sources.length !== context.authority.sourceIds.length ||
        page.sources.some(source => !context.contract.descriptor.sourceRequirements.some(required =>
          source.sourceId === required.sourceId && source.authority === required.authority))) deny('INVALID_RESULT');
    // The canonical dispatcher has the retained previous page, which is deliberately
    // absent from transport/credential calls. It owns full continuation validation.
    if (context.operation.id === 'mail.read_thread' || context.input.offset === 0) {
      context.contract.assertOutput(page, {request: request ?? context.request, nowMs});
    }
  } catch { deny('INVALID_RESULT'); }
  context.active(); return page;
}
