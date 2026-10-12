/** Selected-client resolution from current policy, never from a model scope hint. */
import { canonicalSha256 } from '../../../packages/contracts/validate.mjs';
import { deny } from './operation-result.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export function normalizeActionReadRequest({ entry, request, identity }) {
  if (typeof request.clientId !== 'string' || !UUID.test(request.clientId.trim())) deny('UNAVAILABLE');
  const reference = request.clientId.trim();
  // A UUID needs no name lookup. This only normalizes syntax; current business
  // policy must still authorize the normalized request and select the same client.
  try { return entry.contract.normalizeInput(request, { binding: identity.claims.binding,
    clientResolution: { reference, clientId: reference.toLowerCase() } }); }
  catch { deny('INVALID_ARGUMENTS'); }
}

export function prepareActionReadContext({ request, authority }) {
  // The complete family also describes names and unscoped lists. Connecting those
  // modes requires their own qualified resolution/policy; no implicit wall grant.
  if (typeof request.clientId !== 'string' || !UUID.test(request.clientId.trim())) deny('UNAVAILABLE');
  const reference = request.clientId.trim();
  const options = current => {
    const subject = current.subject;
    if (subject.kind !== 'client' || subject.entityType !== 'client' ||
        subject.entityIds.length !== 1 || !UUID.test(subject.entityIds[0]) ||
        reference.toLowerCase() !== subject.entityIds[0].toLowerCase() ||
        canonicalSha256(current.binding) !== canonicalSha256(authority.binding) ||
        current.policyRevision !== authority.policyRevision) deny('ACCESS_DENIED');
    return { binding: current.binding,
      clientResolution: { reference, clientId: subject.entityIds[0].toLowerCase() } };
  };
  options(authority);
  return Object.freeze({ authority, options: (current = authority) => options(current),
    observeAuthority(current) { options(current); }, async retain() {} });
}
