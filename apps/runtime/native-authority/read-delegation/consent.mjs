/** Unattended read consent (D016-A 5): the routine owner's signed-in approval, at most 30 days, renewable only by a live login.
 * Approving and resuming widen authority, so both carry the user's LIVE session; pausing and revoking only narrow it and carry
 * the service identity. A paused, revoked, superseded or expired consent issues no occurrence delegation (Core), and Meri refuses
 * it before asking (`assertOccurrence`). Read consent never authorizes a write: any write intent still needs attended approval. */
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {nativeReadFault} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {READ_DELEGATION_LIMITS,consentCreateRequest,assertConsentReceipt,operationsDigest,assertReadOnlyOperation} from './contract.mjs';

const refuse=code=>{throw nativeReadFault(code);};

export function createReadDelegationConsents(configuration){
 const c=own(configuration,['client','now']),client=c.client,now=c.now;
 if(typeof now!=='function'||!client?.available)refuse('CONFIGURATION');
 const deadline=deadlineMs=>Math.min(deadlineMs??Infinity,now()+READ_DELEGATION_LIMITS.maxRequestMs);
 return Object.freeze({
  /** The signed-in owner approves the routine's reads for at most 30 days. */
  async approve({liveCredential,scheduleId,clientId,operations,policyRevision,scheduleProjectionSha256,requestedExpiresAtMs,signal,deadlineMs}){
   for(const operation of operations)assertReadOnlyOperation(operation);
   const request=consentCreateRequest({scheduleId,clientId,operationsSha256:operationsDigest(operations),policyRevision,scheduleProjectionSha256,requestedExpiresAtMs,now}),started=now();
   return assertConsentReceipt(await client.createConsent({request,liveCredential,signal,deadlineMs:deadline(deadlineMs)}),{requestedExpiresAtMs,started,now});
  },
  /** Pause or revoke (routine paused or deleted, membership or scope change): authority ends; no user session needed. */
  async narrow({consentId,state,signal,deadlineMs}){
   if(!['paused','revoked'].includes(state))refuse('INVALID_ARGUMENTS');
   return client.setConsentState({consentId,state,signal,deadlineMs:deadline(deadlineMs)});
  },
  /** Resume only from a live login. */
  async resume({consentId,liveCredential,signal,deadlineMs}){return client.setConsentState({consentId,state:'active',liveCredential,signal,deadlineMs:deadline(deadlineMs)});},
 });
}
