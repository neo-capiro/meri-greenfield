/** Explicit synthetic identity/current-policy ports for the disposable document fixture. */
import {randomUUID} from 'node:crypto';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createActionSessionOwner} from '../../action-host/session/owner.mjs';

export function createLocalDocumentPorts({binding,scopes,clientId,deadlineMs,now,state}) {
  const clone = value => structuredClone(value);
  const active = signal => {
    if (state.closed || state.revoked || signal?.aborted || now() >= deadlineMs) throw Error('SYNTHETIC_DOCUMENT_REFUSED');
  };
  const stamp = () => ({checkedAtMs: now(), expiresAtMs: deadlineMs});
  const nativeCredential = `fixture_identity_${randomUUID()}`;
  const sessions = createActionSessionOwner({mode: 'process-local', now,
    limits: {maxSessions: 8, maxRequestMs: 3000, maxTtlMs: 30000, maxFactBytes: 65536},
    async verifyIdentity({credential,signal}) {
      active(signal); if (credential !== nativeCredential) throw Error('SYNTHETIC_IDENTITY_REFUSED');
      return {principal: {tenantId: binding.tenantId,actorId: binding.actorId}, identityRevision: 'synthetic-identity-1', ...stamp()};
    },
    async resolveContext({identity,identitySha256,signal}) {
      active(signal);
      if (identitySha256 !== canonicalSha256(identity)) throw Error('SYNTHETIC_IDENTITY_REFUSED');
      return {identitySha256, binding: clone(binding), scopes: clone(scopes), selectedClientId: clientId,
        contextRevision: 'synthetic-document-context-1', ...stamp()};
    },
  });
  async function authorize(call) {
    active(call.signal); state.artifactChecks++;
    if (canonicalSha256(call.binding) !== canonicalSha256(binding) || canonicalSha256(call.scopes) !== canonicalSha256(scopes)) throw Error('SYNTHETIC_RESOURCE_REFUSED');
    return {receiptId: randomUUID(),decision: 'allow',action: call.action,binding: clone(binding),
      scopesSha256: canonicalSha256(scopes),resourceSha256: canonicalSha256(call.resource),
      requestSha256: call.requestSha256,expiresAtMs: Math.min(deadlineMs,call.deadlineMs)};
  }
  return {sessions,authorize,nativeCredential};
}
