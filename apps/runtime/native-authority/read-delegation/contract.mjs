/** RC1 option B (D016-A 4): run-bound Core read delegation, Meri side. Bounds, closed wire shapes and per-slot token ceilings
 * that Meri enforces on its own, independently of Core (FABLE-RUN-BOUND-READ-DELEGATION-20261018.md). Nothing here mints,
 * stores or logs a credential: a delegation id is a reference, a read token is a single-use value held only for one request.
 *
 * Neo's corrections (PR #121 6247327210), each enforced here and again by Core:
 *  - attended delegation: at most 30 minutes TOTAL from issuance, never past the run deadline; it may outlive the creating Clerk
 *    session; renewal is a new delegation created from a live login, never an extension;
 *  - unattended: at most 15 minutes per occurrence, under an explicit signed-in consent of at most 30 days;
 *  - pause or revoke of the consent, or a Stop of the run, ends authority;
 *  - read delegation never authorizes a write: only `sideEffect:'none'`, `approvalBoundary:'none'` operations get a token. */
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../../packages/contracts/validate.mjs';
import {resolveOperationContract,validateShape as readShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {assertCorePrincipal} from '../../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {nativeReadFault} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {MODE_READ_OPERATIONS} from '../../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import {signedRetainedSourceId,signedRetainedSourceOperation} from '../../../gateway/sources/retained-reads/signed-source-operations.mjs';

const refuse=code=>{throw nativeReadFault(code);};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,SHA=/^[a-f0-9]{64}$/u,CALL_KEY=/^[A-Za-z0-9_-]{1,128}$/u;
const TOKEN=/^[\x21-\x7e]{1,8192}$/u,ROLES=new Set(['standard_user','user_admin','capiro_admin']);
const MINUTE=60000,DAY=86400000;
export const READ_DELEGATION_LIMITS=Object.freeze({attendedMaxMs:30*MINUTE,occurrenceMaxMs:15*MINUTE,consentMaxMs:30*DAY,tokenMaxMs:MINUTE,
 clockSkewMs:5000,maxRequestMs:3000,maxBodyBytes:16384,maxResponseBytes:16384,maxTokenRetries:2,revokeAttempts:3});
export const READ_TOKEN_SCHEME='CapiroMeriRead';
export const READ_TOKEN_KINDS=Object.freeze(['current','tool','mode','reference']);
const BASE='/api/clio/application-authority';
export const READ_DELEGATION_ROUTES=Object.freeze({create:`${BASE}/read-delegations`,consents:`${BASE}/read-delegation-consents`,
 mode:`${BASE}/read-mode-observation`,reference:'/api/clio/clients/check-ref'});
export const delegationRoute=(delegationId,leaf)=>{if(!UUID.test(delegationId)||!['tokens','current','revocations'].includes(leaf))refuse('INVALID_ARGUMENTS');return `${BASE}/read-delegations/${delegationId}/${leaf}`;};
export const consentRoute=consentId=>{if(!UUID.test(consentId))refuse('INVALID_ARGUMENTS');return `${BASE}/read-delegation-consents/${consentId}/state`;};
export const toolRoute=operation=>`/api/clio/tools/${operation.id}`;

/** Observations one dispatched read makes through the native credential owner: the tool dispatch observes the current context
 * five times (prepare, before, effect after the reservation, release, final) and the source transport twice (credentials before
 * and after the service secret); client-registry result authorization adds two. */
export const DISPATCH_OBSERVATIONS=5,CREDENTIAL_OBSERVATIONS=2,RESULT_OBSERVATIONS=2;
/** Core calls one owner observation makes, per class (owner.mjs `observe`; each delegated reader mirrors option A's
 * identity / route / identity with `current` in place of identity). */
export const OBSERVATION_CALLS=Object.freeze({
 plain:Object.freeze({current:1}),
 conversation:Object.freeze({current:2}),
 reference:Object.freeze({current:4,reference:1}),
 mode:Object.freeze({current:5,mode:1}),
});
/** Per call slot maxima: observations × calls per observation, maximised over classes; `tool` is the one dispatch, after Meri's
 * own UNKNOWN reservation. Derived from the admitted call, never from `allocation.schedule.operations` (dot 6246081306). */
export function readTokenCeilings(){
 const observations=DISPATCH_OBSERVATIONS+CREDENTIAL_OBSERVATIONS,ceiling={tool:1,current:0,mode:0,reference:0};
 for(const calls of Object.values(OBSERVATION_CALLS))for(const [kind,n] of Object.entries(calls))ceiling[kind]=Math.max(ceiling[kind],n*observations);
 ceiling.current=Math.max(ceiling.current,(observations+RESULT_OBSERVATIONS)*OBSERVATION_CALLS.plain.current);
 return Object.freeze(ceiling);
}
export const READ_TOKEN_CEILINGS=readTokenCeilings();
/** Lost-response re-issues per (slot, kind); never adds a slot or allowance. */
export const READ_TOKEN_REISSUES=READ_DELEGATION_LIMITS.maxTokenRetries;

export const operationsDigest=operations=>hash([...data(operations)].map(op=>{readShape('OperationRef',op);return {id:op.id,version:op.version};}).sort((a,b)=>`${a.id}@${a.version}`.localeCompare(`${b.id}@${b.version}`)));
/** A read token is only ever requested for a read-only, approval-free catalog operation. */
export function assertReadOnlyOperation(operation){
 readShape('OperationRef',operation);let contract;try{contract=resolveOperationContract(operation);}catch{refuse('ACCESS_DENIED');}
 if(contract.descriptor.sideEffect!=='none'||contract.descriptor.approvalBoundary!=='none')refuse('ACCESS_DENIED');return contract;
}
export const assertCallKey=value=>{if(typeof value!=='string'||!CALL_KEY.test(value))refuse('INVALID_ARGUMENTS');return value;};
export const isReadToken=value=>typeof value==='string'&&TOKEN.test(value);

/** Meri's own upper bound on a delegation's expiry; a Core receipt beyond it is refused. */
export function delegationBound({mode,issuedAtMs,runDeadlineMs,occurrence}){
 if(!Number.isSafeInteger(issuedAtMs)||!Number.isSafeInteger(runDeadlineMs))refuse('CONFIGURATION');
 if(mode==='attended')return Math.min(issuedAtMs+READ_DELEGATION_LIMITS.attendedMaxMs,runDeadlineMs);
 if(mode!=='unattended'||!occurrence)refuse('CONFIGURATION');
 return Math.min(occurrence.startedAtMs+READ_DELEGATION_LIMITS.occurrenceMaxMs,runDeadlineMs,occurrence.consentExpiresAtMs);
}
/** Trusted occurrence facts for an unattended run (schedule owner); the consent must be active, unexpired and in scope. */
export function assertOccurrence(raw,{binding,clientId,operationsSha256,policyRevision,now}){
 const v=data(own(raw,['consentId','consentState','consentExpiresAtMs','consentCreatedAtMs','scheduleId','occurrenceKey','startedAtMs','clientId','operationsDigest','policyRevision','runBinding']));
 if(!UUID.test(v.consentId)||!UUID.test(v.scheduleId)||!SHA.test(v.occurrenceKey)||!Number.isSafeInteger(v.startedAtMs)||!Number.isSafeInteger(v.consentExpiresAtMs)||!Number.isSafeInteger(v.consentCreatedAtMs))refuse('UNAVAILABLE');
 // Pause, revoke, supersession or expiry of the consent ends authority; so does any change of client, operations or policy.
 if(v.consentState!=='active'||v.consentExpiresAtMs<=now()||v.consentExpiresAtMs>v.consentCreatedAtMs+READ_DELEGATION_LIMITS.consentMaxMs)refuse('UNAVAILABLE');
 if(v.clientId!==clientId||v.operationsDigest!==operationsSha256||v.policyRevision!==policyRevision||hash(v.runBinding)!==hash(binding))refuse('ACCESS_DENIED');
 if(v.startedAtMs>now()+READ_DELEGATION_LIMITS.clockSkewMs)refuse('ACCESS_DENIED');
 return v;
}

/** Create request. Attended carries no consent; unattended carries the consent and occurrence it runs under. */
export function delegationCreateRequest({mode,binding,clientId,policyRevision,allocationSha256,operationsSha256,supersedes=null,occurrence}){
 validateShape('RunBinding',binding);if(!UUID.test(clientId)||!SHA.test(policyRevision)||!SHA.test(allocationSha256)||!SHA.test(operationsSha256)||supersedes!==null&&!UUID.test(supersedes))refuse('CONFIGURATION');
 const base={schemaVersion:1,mode,binding:{tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId,attemptId:binding.attemptId,writerFence:binding.writerFence},
  clientId,policyRevision,allocationSha256,operationsDigest:operationsSha256,supersedes};
 if(mode==='attended')return data(base);
 if(mode!=='unattended'||supersedes!==null)refuse('CONFIGURATION');
 return data({...base,consentId:occurrence.consentId,scheduleId:occurrence.scheduleId,occurrenceKey:occurrence.occurrenceKey});
}
/** Create receipt: a reference, not a credential. Its expiry must stay inside Meri's own bound. */
export function assertDelegationReceipt(raw,{bound,started,now}){
 const v=data(own(raw,['schemaVersion','delegationId','expiresAtMs','checkedAtMs'])),at=now();
 if(v.schemaVersion!==1||!UUID.test(v.delegationId)||!Number.isSafeInteger(v.checkedAtMs)||v.checkedAtMs<started-READ_DELEGATION_LIMITS.clockSkewMs||v.checkedAtMs>at+READ_DELEGATION_LIMITS.clockSkewMs||
  !Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<=at||v.expiresAtMs>bound+READ_DELEGATION_LIMITS.clockSkewMs)refuse('ACCESS_DENIED');
 return Object.freeze({...v,expiresAtMs:Math.min(v.expiresAtMs,bound)});
}
export function tokenRequest({kind,callKey,method='POST',path,bodySha256,operation=null,argumentsSha256=null,toolRequestSha256=null,referenceSha256=null,correlationSha256,retryOf=null}){
 if(!READ_TOKEN_KINDS.includes(kind)||method!=='POST'||typeof path!=='string'||!path.startsWith('/api/clio/')||!SHA.test(bodySha256)||retryOf!==null&&!SHA.test(retryOf))refuse('INVALID_ARGUMENTS');
 assertCallKey(callKey);
 if(kind!=='tool'&&(argumentsSha256!==null||correlationSha256!==undefined))refuse('INVALID_ARGUMENTS');
 // `tool`: Core admits it only against Meri's UNKNOWN reservation for this call key with this operation and arguments hash.
 if(kind==='tool'){
  assertReadOnlyOperation(operation);
  const signed=signedRetainedSourceId(operation.id);
  if(path!==toolRoute(operation)||!SHA.test(argumentsSha256)||toolRequestSha256!==null||referenceSha256!==null||
    (signed?(!signedRetainedSourceOperation(operation)||!SHA.test(correlationSha256)):correlationSha256!==undefined))refuse('INVALID_ARGUMENTS');
 }
 else if(kind==='mode'){assertReadOnlyOperation(operation);if(!MODE_READ_OPERATIONS.includes(operation.id)||path!==READ_DELEGATION_ROUTES.mode||!SHA.test(toolRequestSha256)||referenceSha256!==null)refuse('INVALID_ARGUMENTS');}
 else if(kind==='reference'){if(operation!==null||path!==READ_DELEGATION_ROUTES.reference||!SHA.test(referenceSha256)||toolRequestSha256!==null)refuse('INVALID_ARGUMENTS');}
 else if(operation!==null||toolRequestSha256!==null||referenceSha256!==null||!/\/read-delegations\/[a-f0-9-]{36}\/current$/u.test(path))refuse('INVALID_ARGUMENTS');
 return data({schemaVersion:1,kind,callKey,method,path,bodySha256,operation:operation===null?null:{id:operation.id,version:operation.version},argumentsSha256,toolRequestSha256,referenceSha256,
  ...(correlationSha256===undefined?{}:{correlationSha256}),retryOf});
}
/** Token receipt: at most 60 s, and never past the delegation's hard expiry. */
export function assertTokenReceipt(raw,{hardExpiryMs,started,now}){
 const v=data(own(raw,['schemaVersion','token','expiresAtMs'])),at=now();
 if(v.schemaVersion!==1||!isReadToken(v.token)||!Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<=at||
  v.expiresAtMs>started+READ_DELEGATION_LIMITS.tokenMaxMs+READ_DELEGATION_LIMITS.clockSkewMs)refuse('ACCESS_DENIED');
 return Object.freeze({token:v.token,expiresAtMs:Math.min(v.expiresAtMs,hardExpiryMs,started+READ_DELEGATION_LIMITS.tokenMaxMs)});
}
/** Delegation-backed current-authority receipt (§3). `clientIds` must be exactly the delegated client: never a roster. */
export function assertCurrentReceipt(raw,{delegationId,binding,clientId,conversation,started,now}){
 const v=data(own(raw,['schemaVersion','delegationId','principal','identityRevision','actorRole','membershipRevision','clientIds','checkedAtMs','expiresAtMs'],['conversation'])),at=now();
 assertCorePrincipal(v.principal);
 if(v.schemaVersion!==1||v.delegationId!==delegationId||v.principal.tenantId!==binding.tenantId||v.principal.actorId!==binding.actorId||!SHA.test(v.identityRevision)||!SHA.test(v.membershipRevision)||!ROLES.has(v.actorRole)||
  !Array.isArray(v.clientIds)||v.clientIds.length!==1||v.clientIds[0]!==clientId||!Number.isSafeInteger(v.checkedAtMs)||v.checkedAtMs<started||v.checkedAtMs>at||!Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<=at)refuse('ACCESS_DENIED');
 if(conversation!==Object.hasOwn(v,'conversation'))refuse('ACCESS_DENIED');
 if(conversation){const c=data(own(v.conversation,['conversationId','selectedClientId','contextRevision']));
  if(c.conversationId!==binding.conversationId||c.selectedClientId!==clientId||typeof c.contextRevision!=='string'||!c.contextRevision.length||c.contextRevision.length>256)refuse('ACCESS_DENIED');}
 return v;
}
export function consentCreateRequest({scheduleId,clientId,operationsSha256,policyRevision,scheduleProjectionSha256,requestedExpiresAtMs,now}){
 if(!UUID.test(scheduleId)||!UUID.test(clientId)||!SHA.test(operationsSha256)||!SHA.test(policyRevision)||!SHA.test(scheduleProjectionSha256)||!Number.isSafeInteger(requestedExpiresAtMs))refuse('INVALID_ARGUMENTS');
 if(requestedExpiresAtMs<=now()||requestedExpiresAtMs>now()+READ_DELEGATION_LIMITS.consentMaxMs)refuse('INVALID_ARGUMENTS');
 return data({schemaVersion:1,scheduleId,clientId,operationsDigest:operationsSha256,policyRevision,scheduleProjectionSha256,requestedExpiresAtMs});
}
export function assertConsentReceipt(raw,{requestedExpiresAtMs,started,now}){
 const v=data(own(raw,['schemaVersion','consentId','state','createdAtMs','expiresAtMs'])),at=now();
 if(v.schemaVersion!==1||!UUID.test(v.consentId)||!['active','paused','revoked','superseded','expired'].includes(v.state)||!Number.isSafeInteger(v.createdAtMs)||v.createdAtMs<started-READ_DELEGATION_LIMITS.clockSkewMs||v.createdAtMs>at+READ_DELEGATION_LIMITS.clockSkewMs||
  !Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs>requestedExpiresAtMs||v.expiresAtMs>v.createdAtMs+READ_DELEGATION_LIMITS.consentMaxMs)refuse('ACCESS_DENIED');
 return v;
}
