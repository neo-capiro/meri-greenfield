/** The routines application's read-consent port (option B, lane RD): the composer's `readDelegation.consents` (consent.mjs)
 * bound to control's action-session owner and to the routine template's read operations (the sealed allocation manifest, the
 * same operations `delegation.mjs` digests for an occurrence). `approve` and `resume` widen authority, so each carries the
 * owner's LIVE native bearer, resolved per call from the approving request's own run and selected client (`attended`, the
 * request's resolved session selection, never request data) and never cached past the call; `narrow` carries only the service
 * identity. Consent expiry is min(now + 30 days, the schedule's end). Nothing here stores a token or decides authority. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape} from '../../../../packages/contracts/validate.mjs';
import {nativeReadFault} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {allocation as parseAllocation} from '../../../gateway/budget/tool-budget-binding.mjs';
import {READ_DELEGATION_LIMITS,operationsDigest} from './contract.mjs';
const refuse=code=>{throw nativeReadFault(code);};
const TOKEN=/^[\x21-\x7e]{1,8192}$/u,UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const ordinary=fn=>typeof fn==='function'&&!types.isProxy(fn);
export function createRoutineReadConsents(configuration){
 let c,port,nativeCredentialFor;
 try{
  c=own(configuration,['consents','nativeCredentials','allocationJson','now']);port=own(c.consents,['approve','narrow','resume']);
  if(!ordinary(c.now)||Object.values(port).some(fn=>!ordinary(fn))||types.isProxy(c.consents)||!c.nativeCredentials||typeof c.nativeCredentials!=='object'||types.isProxy(c.nativeCredentials))throw Error();
  // Only the owner's own `nativeCredentialFor` is borrowed (the action-session owner or the read-credential relay port).
  const method=Object.getOwnPropertyDescriptor(c.nativeCredentials,'nativeCredentialFor');if(!method||!Object.hasOwn(method,'value')||!ordinary(method.value))throw Error();nativeCredentialFor=method.value;
 }catch{refuse('CONFIGURATION');}
 const now=c.now,operations=data(parseAllocation(c.allocationJson).manifest.allowedOperations),digest=operationsDigest(operations);
 /** One live-session lookup for the approving request's exact run and selected client: a well-formed, unexpired token. */
 function bearer(attended,signal){
  let a;try{a=data(own(attended,['binding','selectedClientId']));validateShape('RunBinding',a.binding);}catch{refuse('ACCESS_DENIED');}
  if(typeof a.selectedClientId!=='string'||!UUID.test(a.selectedClientId))refuse('ACCESS_DENIED');
  let issued;try{issued=data(own(Reflect.apply(nativeCredentialFor,c.nativeCredentials,[{binding:a.binding,selectedClientId:a.selectedClientId,...(signal===undefined?{}:{signal})}]),['credential','expiresAtMs']));}catch{refuse('ACCESS_DENIED');}
  if(typeof issued.credential!=='string'||!TOKEN.test(issued.credential)||!Number.isSafeInteger(issued.expiresAtMs)||issued.expiresAtMs<=now())refuse('ACCESS_DENIED');
  return issued;
 }
 const bound=(deadlineMs,live)=>Math.min(deadlineMs??Infinity,live.expiresAtMs);
 /** A state change receipt: Core may echo the consent; a state other than the requested one is refused. */
 function changed(raw,consentId,state){
  const v=data(raw);
  if(v!==null&&typeof v==='object'&&(Object.hasOwn(v,'state')&&v.state!==state||Object.hasOwn(v,'consentId')&&v.consentId!==consentId))refuse('ACCESS_DENIED');
  return Object.freeze({consentId,state});
 }
 return Object.freeze({operations:Object.freeze(operations.map(op=>Object.freeze({...op}))),operationsDigest:digest,
  /** The signed-in owner approves the routine's reads for min(30 days, the schedule's end). */
  async approve({attended,scheduleId,clientId,policyRevision,scheduleProjectionSha256,scheduleEndsAtMs=null,signal,deadlineMs}){
   nativeSignal(signal);if(scheduleEndsAtMs!==null&&!Number.isSafeInteger(scheduleEndsAtMs))refuse('INVALID_ARGUMENTS');
   const at=now(),requestedExpiresAtMs=Math.min(at+READ_DELEGATION_LIMITS.consentMaxMs,scheduleEndsAtMs??Infinity);
   if(requestedExpiresAtMs<=at)refuse('INVALID_ARGUMENTS');
   const live=bearer(attended,signal);
   const receipt=await port.approve({liveCredential:live.credential,scheduleId,clientId,operations,policyRevision,scheduleProjectionSha256,requestedExpiresAtMs,...(signal===undefined?{}:{signal}),deadlineMs:bound(deadlineMs,live)});
   return Object.freeze({consentId:receipt.consentId,state:receipt.state,createdAtMs:receipt.createdAtMs,expiresAtMs:receipt.expiresAtMs,operationsDigest:digest});
  },
  /** Pause or revoke: the service identity alone. */
  async narrow({consentId,state,signal,deadlineMs}){
   nativeSignal(signal);if(!UUID.test(consentId??'')||!['paused','revoked'].includes(state))refuse('INVALID_ARGUMENTS');
   return changed(await port.narrow({consentId,state,...(signal===undefined?{}:{signal}),...(deadlineMs===undefined?{}:{deadlineMs})}),consentId,state);
  },
  /** Resume only from the owner's live login. */
  async resume({attended,consentId,signal,deadlineMs}){
   nativeSignal(signal);if(!UUID.test(consentId??''))refuse('INVALID_ARGUMENTS');
   const live=bearer(attended,signal);
   return changed(await port.resume({consentId,liveCredential:live.credential,...(signal===undefined?{}:{signal}),deadlineMs:bound(deadlineMs,live)}),consentId,'active');
  },
 });
}
