/** Trusted contexts for existing passive projections; no source or policy lookup. */
import { canonicalSha256 } from '../../../packages/contracts/validate.mjs';
import { validateShape } from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import { deny } from './operation-result.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const keySet = keys => [...keys].sort().join(',');

export function assertProjectionConfiguration(defaultCongress) {
  if (defaultCongress === undefined) return;
  try { validateShape('EntityCandidatesContext', {defaultCongress}); }
  catch { deny('GATEWAY_CONFIGURATION'); }
}

export function prepareProjectionReadContext({entry, request, authority, defaultCongress, observedAtMs}) {
  if (!['bound-projection/1','client-documents/1'].includes(entry.contract.binding.dispatchProfile)) deny('GATEWAY_CONFIGURATION');
  const keys = keySet(entry.contract.binding.contextKeys);
  const client = current => {
    const subject = current.subject;
    if (subject.kind !== 'client' || subject.entityType !== 'client' ||
        subject.entityIds.length !== 1 || !UUID.test(subject.entityIds[0])) deny('ACCESS_DENIED');
    return subject.entityIds[0];
  };
  const asOf = new Date(observedAtMs).toISOString();
  const options = current => {
    if (canonicalSha256(current.binding) !== canonicalSha256(authority.binding) ||
        current.policyRevision !== authority.policyRevision) deny('ACCESS_DENIED');
    if (request.clientId != null && keys !== 'asOf,clientResolution') {
      if (typeof request.clientId !== 'string' || request.clientId.trim() !== client(current)) deny('ACCESS_DENIED');
    }
    if (keys === '') return {};
    if (keys === 'tenantId,userId') return {tenantId:current.binding.tenantId, userId:current.binding.actorId};
    if (keys === 'defaultCongress') {
      if (defaultCongress === undefined) deny('UNAVAILABLE');
      return {defaultCongress};
    }
    if (keys === 'asOf,clientResolution') {
      if (typeof request.clientId !== 'string') deny('INVALID_ARGUMENTS');
      return {asOf, clientResolution:{selector:request.clientId.trim().slice(0,80), clientId:client(current)}};
    }
    if (keys === 'binding,subject') {
      client(current);
      return {binding:current.binding, subject:current.subject};
    }
    deny('GATEWAY_CONFIGURATION');
  };
  options(authority);
  return Object.freeze({authority, options:(current=authority)=>options(current),
    observeAuthority(current) { options(current); }, async retain() {}});
}
