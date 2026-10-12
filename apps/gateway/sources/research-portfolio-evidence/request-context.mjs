/** Trusted dispatch context admission; the canonical authority authenticates it. */
import { types } from 'node:util';
import { canonicalSha256, validateShape as publicShape } from '../../../../packages/contracts/validate.mjs';
import { normalizeResearchPortfolioEvidenceInput } from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import { ownFields, frozenData } from '../source-admission.mjs';
import { deny } from '../../dispatch/operation-result.mjs';

export const operation = Object.freeze({id:'get_research_evidence',version:'0.2.0'});
export function evidenceContext(call, now) {
  const fields = ownFields(call, ['input','authority'], ['signal']);
  const input = frozenData(fields.input), authority = frozenData(fields.authority);
  publicShape('RunBinding', authority.binding); publicShape('CapabilityClaims', authority.claims);
  const request = {origin:input.origin, ...(input.recordId === undefined ? {} : {recordId:input.recordId})};
  const {input:expected} = normalizeResearchPortfolioEvidenceInput(operation.id, request,
    {binding:authority.binding, subject:authority.subject});
  if (canonicalSha256(input) !== canonicalSha256(expected) ||
      canonicalSha256(authority.claims.binding) !== canonicalSha256(authority.binding) ||
      authority.policyRevision !== authority.subject.policyRevision) deny('ACCESS_DENIED');
  const expires = Date.parse(authority.claims.expiresAt), deadlineMs = Math.min(authority.deadlineMs, expires);
  if (!Number.isSafeInteger(authority.deadlineMs) || !Number.isSafeInteger(expires) ||
      !Number.isSafeInteger(now()) || deadlineMs <= now()) deny('DEADLINE');
  if (fields.signal !== undefined) {
    if (types.isProxy(fields.signal)) deny('INVALID_ARGUMENTS');
    try { Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get.call(fields.signal); }
    catch { deny('INVALID_ARGUMENTS'); }
    if (fields.signal.aborted) deny('CANCELLED');
  }
  return {input, authority, request, signal:fields.signal, deadlineMs};
}
