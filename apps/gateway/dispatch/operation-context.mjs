/** Dispatch composition selected by canonical binding metadata, not a tool registry. */
import { canonicalSha256 } from '../../../packages/contracts/validate.mjs';
import { validateShape } from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import { prepareMemoryReadContext } from './memory-read-context.mjs';
import { prepareMailReadContext } from './mail-read-context.mjs';
import { normalizeActionReadRequest, prepareActionReadContext } from './action-read-context.mjs';
import { deny } from './operation-result.mjs';

export function assertOperationArguments(entry, request) {
  const profile = entry.contract.binding?.dispatchProfile;
  if (profile === undefined) return;
  if (!['memory-proposals/1', 'mail-candidates/1', 'dataset-metadata/1', 'portfolio-evidence/1', 'actions-complete/1'].includes(profile)) deny('GATEWAY_CONFIGURATION');
  try { validateShape(entry.contract.binding.input, request); } catch { deny('INVALID_ARGUMENTS'); }
}

export async function prepareOperationContext({ entry, request, identity, authorize, ports, mailPorts, lifetime, readDeadline, now, maxBytes }) {
  const profile = entry.contract.binding?.dispatchProfile;
  if (profile === undefined) return Object.freeze({ authority: null,
    options: () => ({ nowMs: now(), actorId: identity.claims.binding.actorId }),
    observeAuthority() {}, async retain() {},
  });
  if (!['memory-proposals/1', 'mail-candidates/1', 'dataset-metadata/1', 'portfolio-evidence/1', 'actions-complete/1'].includes(profile)) deny('GATEWAY_CONFIGURATION');
  if (profile === 'dataset-metadata/1') return Object.freeze({ authority: null,
    options: () => ({}), observeAuthority() {}, async retain() {},
  });
  let normalized;
  if (profile === 'mail-candidates/1') {
    try { normalized = entry.contract.normalizeInput(request, { nowMs: now(), actorId: identity.claims.binding.actorId }); }
    catch { deny('INVALID_ARGUMENTS'); }
    if (!normalized || canonicalSha256(normalized.input) !== normalized.argumentsSha256) deny('INVALID_ARGUMENTS');
  }
  if (profile === 'actions-complete/1') normalized = normalizeActionReadRequest({ entry, request, identity });
  const authority = await authorize(normalized?.input ?? request);
  if (canonicalSha256(authority.binding) !== canonicalSha256(identity.claims.binding) ||
      authority.policyRevision !== identity.claims.policyRevision) deny('ACCESS_DENIED');
  if (profile === 'actions-complete/1') return Object.freeze({
    ...prepareActionReadContext({ request, authority }), normalized });
  if (profile === 'portfolio-evidence/1') return Object.freeze({ authority,
    options: (current = authority) => ({binding:current.binding, subject:current.subject}),
    observeAuthority() {}, async retain() {},
  });
  if (profile === 'mail-candidates/1') return prepareMailReadContext({ ports: mailPorts, authority,
    operation: entry.descriptor.operation, normalized, lifetime, readDeadline, now, maxBytes });
  return prepareMemoryReadContext({ ports, authority, operation: entry.descriptor.operation,
    identityDeadlineMs: Math.min(identity.run.deadlineMs, Date.parse(identity.claims.expiresAt)),
    request, lifetime, now, maxBytes });
}
