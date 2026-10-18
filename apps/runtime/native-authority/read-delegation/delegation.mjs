/** One run's read delegation (option B, Meri side). It holds a delegation REFERENCE and issues single-use per-call tokens through
 * Core; it never holds a user bearer after creation and never stores a token past its one request.
 *
 * Mode is decided from trusted facts, never from the request: an occurrence the schedule owner reports for this exact run binding
 * makes the run unattended; otherwise it is attended.
 *  - Attended: created from the user's LIVE session (relay), at most 30 minutes from issuance and never past the run deadline. It
 *    may outlive that session. A new delegation (superseding the old one) is created only from a live login; there is no extension.
 *  - Unattended: one delegation per occurrence under an active, in-scope consent: at most 15 minutes from the occurrence start,
 *    never past the consent or the run deadline, never renewed. A retried create for the same occurrence is the same row (Core).
 * Call slots are keyed by the Meri invocation id (`callKey`, the budget reservation's primary key); a `tool` token is requested only
 * after Meri's own UNKNOWN reservation exists, which Core verifies (dot 6246089074 #1). Stop is local first: the run is refused
 * here before anything else, in-flight requests are aborted, and the Core revoke is best-effort with bounded retries. */
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../../packages/contracts/validate.mjs';
import {nativeReadFault,nativeReadFailureCode} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {allocation as parseAllocation} from '../../../gateway/budget/tool-budget-binding.mjs';
import {READ_DELEGATION_LIMITS,READ_TOKEN_CEILINGS,READ_TOKEN_REISSUES,delegationRoute,operationsDigest,assertOccurrence,delegationBound,
 delegationCreateRequest,assertDelegationReceipt,tokenRequest,assertTokenReceipt,assertCallKey} from './contract.mjs';
import {responseLost,sha256,bodyBytes} from './core-client.mjs';

const refuse=code=>{throw nativeReadFault(code);};
const STOP_REASONS=new Set(['run_terminal','cancelled','fenced','superseded']);
/** The run's selected client: exactly one client scope. */
const selectedClient=scopes=>Array.isArray(scopes)&&scopes.length===1&&scopes[0]?.kind==='client'&&typeof scopes[0].resourceId==='string'?scopes[0].resourceId:null;

export function createRunReadDelegation(configuration){
 const c=own(configuration,['binding','scopes','allocationJson','runDeadlineMs','client','now'],['liveCredentialFor','readOccurrence','operations']);
 const binding=data(c.binding),scopes=data(c.scopes),now=c.now,a=parseAllocation(c.allocationJson),clientId=selectedClient(scopes);validateShape('RunBinding',binding);
 if(typeof now!=='function'||!Number.isSafeInteger(c.runDeadlineMs)||!c.client?.available||clientId===null||
  [c.liveCredentialFor,c.readOccurrence].some(f=>f!==undefined&&typeof f!=='function'))refuse('CONFIGURATION');
 const policyRevision=scopes[0].policyRevision,allocationSha256=hash(a),operations=data(c.operations??a.manifest.allowedOperations),operationsSha256=operationsDigest(operations);
 const runDeadlineMs=Math.min(c.runDeadlineMs,Date.parse(a.schedule.expiresAt)),maxSlots=a.budgets.maxToolCalls;
 const controller=new AbortController(),slots=new Map();
 let current=null,pending=null,stopped=null,mode=null;
 const hardExpiry=()=>current===null?0:Math.min(current.expiresAtMs,runDeadlineMs);
 const active=()=>{if(stopped!==null)refuse('UNAVAILABLE');};
 const lifetimeSignal=signal=>{nativeSignal(signal);return signal?AbortSignal.any([controller.signal,signal]):controller.signal;};
 async function create(signal,deadlineMs){
  const started=now(),occurrence=c.readOccurrence?await c.readOccurrence({binding,signal}):null;active();
  if(occurrence!==null){
   mode='unattended';
   // Never renewed: one delegation per occurrence; when it ends, the occurrence's reads end.
   if(current!==null)refuse('UNAVAILABLE');
   const facts=assertOccurrence(occurrence,{binding,clientId,operationsSha256,policyRevision,now});
   const request=delegationCreateRequest({mode,binding,clientId,policyRevision,allocationSha256,operationsSha256,occurrence:facts});
   const bound=delegationBound({mode,issuedAtMs:started,runDeadlineMs,occurrence:facts});if(bound<=now())refuse('UNAVAILABLE');
   return assertDelegationReceipt(await c.client.create({request,signal,deadlineMs}),{bound,started,now});
  }
  mode='attended';
  // Renewal requires a live login: no live session for this run and client means no new delegation.
  let liveCredential=null;
  if(c.liveCredentialFor)try{const live=data(own(await c.liveCredentialFor({binding,selectedClientId:clientId,signal}),['credential','expiresAtMs']));if(live.expiresAtMs>now())liveCredential=live.credential;}catch{liveCredential=null;}
  active();if(liveCredential===null)refuse('UNAVAILABLE');
  const request=delegationCreateRequest({mode,binding,clientId,policyRevision,allocationSha256,operationsSha256,supersedes:current?.delegationId??null});
  const bound=delegationBound({mode,issuedAtMs:started,runDeadlineMs});if(bound<=now())refuse('UNAVAILABLE');
  return assertDelegationReceipt(await c.client.create({request,liveCredential,signal,deadlineMs}),{bound,started,now});
 }
 /** The current delegation, creating (or, attended only, superseding) it when absent or expired. Single flight. */
 async function ensure({signal,deadlineMs}={}){
  active();if(current!==null&&now()<hardExpiry())return current;if(now()>=runDeadlineMs)refuse('UNAVAILABLE');
  if(!pending){const s=lifetimeSignal(signal),d=Math.min(deadlineMs??runDeadlineMs,runDeadlineMs);
   pending=create(s,d).then(receipt=>{if(stopped!==null){void revokeQuietly(receipt.delegationId,stopped);refuse('UNAVAILABLE');}current=receipt;return receipt;}).finally(()=>{pending=null;});}
  return pending;
 }
 /** One single-use token for one call slot. Meri refuses past the per-slot ceilings and past the run's call allowance first;
  * Core enforces the same against Meri's own reservation counts. A lost response is re-requested at most twice, as a retry of
  * the same request, which Core answers by superseding the unconsumed token (no new slot, no new allowance). */
 async function token({kind,callKey,path,body,bodySha256,operation=null,argumentsSha256=null,toolRequestSha256=null,referenceSha256=null,correlationSha256,signal,deadlineMs}){
  active();assertCallKey(callKey);const d=await ensure({signal,deadlineMs});active();
  // Unattended: pause, revoke or any scope change of the consent ends authority mid-occurrence too, before Core is asked.
  if(mode==='unattended'){const o=await c.readOccurrence({binding,signal:lifetimeSignal(signal)});active();if(o===null)refuse('ACCESS_DENIED');assertOccurrence(o,{binding,clientId,operationsSha256,policyRevision,now});}
  let slot=slots.get(callKey);
  if(!slot){if(slots.size>=maxSlots)refuse('RESOURCE_LIMIT');slot={counts:{current:0,tool:0,mode:0,reference:0},reissues:{current:0,tool:0,mode:0,reference:0}};slots.set(callKey,slot);}
  if(slot.counts[kind]>=READ_TOKEN_CEILINGS[kind])refuse('RESOURCE_LIMIT');
  const target=kind==='current'?delegationRoute(d.delegationId,'current'):path;
  const first=tokenRequest({kind,callKey,path:target,bodySha256:body===undefined?bodySha256:sha256(bodyBytes(body)),operation,argumentsSha256,toolRequestSha256,referenceSha256,correlationSha256}),firstSha256=hash(first);
  const s=lifetimeSignal(signal),cutoff=Math.min(deadlineMs,hardExpiry());
  for(let attempt=0;;attempt++){
   const started=now();
   try{
    const raw=await c.client.issueToken({delegationId:d.delegationId,request:attempt===0?first:{...first,retryOf:firstSha256},signal:s,deadlineMs:cutoff});active();
    if(current?.delegationId!==d.delegationId)refuse('ACCESS_DENIED');
    slot.counts[kind]++;return Object.freeze({...assertTokenReceipt(raw,{hardExpiryMs:hardExpiry(),started,now}),delegationId:d.delegationId,path:target});
   }catch(error){
    if(!responseLost(error)||attempt>=READ_TOKEN_REISSUES||slot.reissues[kind]>=READ_TOKEN_REISSUES||s.aborted||now()>=cutoff||stopped!==null)throw nativeReadFault(nativeReadFailureCode(error)??'UNAVAILABLE');
    slot.reissues[kind]++;
   }
  }
 }
 async function revokeQuietly(delegationId,reason){
  for(let attempt=0;attempt<READ_DELEGATION_LIMITS.revokeAttempts;attempt++){
   try{await c.client.revoke({delegationId,reason,deadlineMs:now()+READ_DELEGATION_LIMITS.maxRequestMs});return true;}catch{}
  }
  return false;
 }
 /** Stop order: (1) refuse locally, (2) abort in-flight token, current and target requests, (3) best-effort Core revoke. Steps 1
  * and 2 cannot fail; Core also reads the run's terminal state on every token issue, use and release, so authority ends even
  * when the revoke never arrives. */
 async function stop(reason='run_terminal'){
  if(!STOP_REASONS.has(reason))refuse('INVALID_ARGUMENTS');
  const first=stopped===null;if(first)stopped=reason;
  if(first)controller.abort(nativeReadFault('CANCELLED'));
  const id=current?.delegationId;current=null;
  return Object.freeze({stopped:true,revoked:first&&id!==undefined?await revokeQuietly(id,reason):false});
 }
 return Object.freeze({binding,clientId,policyRevision,
  get mode(){return mode;},get stopped(){return stopped!==null;},
  get delegationId(){return current?.delegationId??null;},
  /** min(delegation expiry, run deadline); 0 when there is no current delegation. */
  hardExpiry,
  /** Before any result leaves: not stopped, a current delegation, and inside its hard expiry. */
  assertReleasable(){active();if(current===null||now()>=hardExpiry())refuse('UNAVAILABLE');},
  signal:controller.signal,ensure,token,stop});
}
