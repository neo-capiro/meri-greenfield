/** Dispatch composition selected by canonical binding metadata, not a tool registry. */
import { canonicalSha256 } from '../../../packages/contracts/validate.mjs';
import { validateShape } from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import { prepareMemoryReadContext } from './memory-read-context.mjs';
import { deny } from './operation-result.mjs';

export function assertOperationArguments(entry, request) {
  const profile = entry.contract.binding?.dispatchProfile;
  if (profile === undefined) return;
  if (profile !== 'memory-proposals/1') deny('GATEWAY_CONFIGURATION');
  try { validateShape(entry.contract.binding.input, request); } catch { deny('INVALID_ARGUMENTS'); }
}

export async function prepareOperationContext({ entry, request, identity, authorize, ports, lifetime, now, maxBytes }) {
  const profile = entry.contract.binding?.dispatchProfile;
  if (profile === undefined) return Object.freeze({ authority: null,
    options: () => ({ nowMs: now(), actorId: identity.claims.binding.actorId }),
    observeAuthority() {}, async retain() {},
  });
  if (profile !== 'memory-proposals/1') deny('GATEWAY_CONFIGURATION');
  const authority = await authorize(request);
  if (canonicalSha256(authority.binding) !== canonicalSha256(identity.claims.binding) ||
      authority.policyRevision !== identity.claims.policyRevision) deny('ACCESS_DENIED');
  return prepareMemoryReadContext({ ports, authority, operation: entry.descriptor.operation,
    identityDeadlineMs: Math.min(identity.run.deadlineMs, Date.parse(identity.claims.expiresAt)),
    request, lifetime, now, maxBytes });
}
