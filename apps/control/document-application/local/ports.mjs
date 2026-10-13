/** Explicit synthetic identity/current-policy ports for the disposable document fixture. */
import {randomUUID} from 'node:crypto';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createCurrentToolAuthority} from '../../../gateway/authorization/current-tool-authority.mjs';
import {createActionSessionOwner} from '../../action-host/session/owner.mjs';

export function createLocalDocumentPorts({ledger,descriptor,binding,scopes,clientId,deadlineMs,now,state}) {
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
  const authority = createCurrentToolAuthority({now,maxFactBytes: 65536,ports: {
    async verifyCapability(credential,{signal}) {
      active(signal); if (credential !== ledger.credential) throw Error('SYNTHETIC_CAPABILITY_REFUSED');
      return JSON.stringify(ledger.f.claims);
    },
    async currentRun(_binding,{signal}) {
      active(signal); return JSON.stringify({binding,policyRevision: ledger.f.claims.policyRevision,deadlineMs,checkedAtMs: now()});
    },
    async authorizeBusiness({operation,requiredGrants,signal}) {
      active(signal);
      if (canonicalSha256(operation) !== canonicalSha256(descriptor.operation) || canonicalSha256(requiredGrants) !== canonicalSha256(descriptor.requiredGrants)) throw Error('SYNTHETIC_OPERATION_REFUSED');
      const decisionId = randomUUID();
      return JSON.stringify({decision: {decisionId,actor: {tenantId: binding.tenantId,actorId: binding.actorId},
        operation: `${operation.id}@${operation.version}`,scopes,policyRevision: ledger.f.claims.policyRevision,
        evaluatedAt: new Date(now()).toISOString(),decision: 'allowed',reasonCode: 'SYNTHETIC_DOCUMENT_ONLY'},
      subject: {...clone(ledger.f.subject),authorizationDecisionId: decisionId},grants: clone(descriptor.requiredGrants)});
    },
    async authorizeSources({sourceRequirements,signal}) {
      active(signal);
      if (canonicalSha256(sourceRequirements) !== canonicalSha256(descriptor.sourceRequirements)) throw Error('SYNTHETIC_SOURCE_REFUSED');
      return JSON.stringify({sourceIds: descriptor.sourceRequirements.map(s => s.sourceId),enabled: true,
        policyRevision: ledger.f.claims.policyRevision,checkedAtMs: now()});
    },
  }});
  async function authorize(call) {
    active(call.signal); state.artifactChecks++;
    if (canonicalSha256(call.binding) !== canonicalSha256(binding) || canonicalSha256(call.scopes) !== canonicalSha256(scopes)) throw Error('SYNTHETIC_RESOURCE_REFUSED');
    return {receiptId: randomUUID(),decision: 'allow',action: call.action,binding: clone(binding),
      scopesSha256: canonicalSha256(scopes),resourceSha256: canonicalSha256(call.resource),
      requestSha256: call.requestSha256,expiresAtMs: Math.min(deadlineMs,call.deadlineMs)};
  }
  return {sessions,authority,authorize,nativeCredential};
}
