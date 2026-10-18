/** Delegated native credentials (option B) for the existing native credential owner (`native-read-credentials/owner.mjs`).
 * The owner's checks are unchanged: `assertNativeToolAuthority`, `assertNativeConversationAuthority`, the client-reference and
 * read-mode observation validators and every equality between them still run on what this adapter returns.
 *
 * Per call slot (the Meri invocation id), `getNativeCredential` returns an opaque per-call HANDLE, not a credential: it names the
 * slot, is known only to this process and is refused anywhere else. Each Core call the owner makes with it is a separate
 * single-use token for exactly that route and body:
 *  - readCurrent: `current` (the delegation-backed current-authority receipt; `clientIds` is the delegated client only);
 *  - readConversation: `current` with the conversation block (the BD context proof on the delegation's own conversation/client);
 *  - readClientReference: `current` / `reference` (check-ref) / `current`; the resolved client must be the delegated client;
 *  - readModeObservation: `current` / `mode` / `current`; the mode body's operation and request hash are the token's.
 * `toolCredential` exchanges the handle for the `tool` token bound to the transport's exact method, path and body bytes.
 *
 * Option A stays the attended fallback: when the run is attended and Core delegation is unavailable (never when it refused
 * access), the call uses the live-session bearer path unchanged. Unattended runs have no fallback. One call never mixes the two. */
import {randomUUID} from 'node:crypto';
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {nativeReadFault,nativeReadFailureCode} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {MODE_READ_OPERATIONS} from '../../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import {READ_DELEGATION_ROUTES,READ_TOKEN_SCHEME,toolRoute,assertCurrentReceipt,assertReadOnlyOperation,assertCallKey} from './contract.mjs';
import {sha256,bodyBytes} from './core-client.mjs';

const refuse=code=>{throw nativeReadFault(code);};
const SHA=/^[a-f0-9]{64}$/u,UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,MODES=new Set(['off','shadow','enforce']);
const MAX_HANDLES=4096;

export function composeDelegatedNativeCredentials(configuration){
 const c=own(configuration,['delegation','client','now'],['fallback']),delegation=c.delegation,client=c.client,now=c.now;
 if(typeof now!=='function'||!client?.available||typeof delegation?.token!=='function')refuse('CONFIGURATION');
 const fallback=c.fallback===undefined?null:own(c.fallback,['coreAuthority','getNativeCredential']);
 if(fallback&&(typeof fallback.getNativeCredential!=='function'||types.isProxy(fallback.getNativeCredential)||fallback.coreAuthority.origin!==client.origin))refuse('CONFIGURATION');
 const handles=new Map(),byCall=new Map(),choice=new Map();
 const prune=()=>{const at=now();for(const [handle,h] of handles)if(h.expiresAtMs<=at){handles.delete(handle);byCall.delete(h.callKey);}};
 const slotOf=credential=>{const h=typeof credential==='string'?handles.get(credential):undefined;if(!h)return null;if(h.expiresAtMs<=now())refuse('UNAVAILABLE');return h;};
 async function getNativeCredential(request){
  const callKey=request?.callKey;
  if(callKey===undefined||choice.get(callKey)==='fallback'){if(fallback&&delegation.mode!=='unattended')return fallback.getNativeCredential(request);refuse('UNAVAILABLE');}
  assertCallKey(callKey);
  try{await delegation.ensure({signal:request.signal,deadlineMs:request.deadlineMs});}
  catch(error){
   // Core delegation unavailable for an attended run: the live-session path, unchanged. Refusals never fall back.
   if(fallback&&delegation.mode==='attended'&&!delegation.stopped&&nativeReadFailureCode(error)==='UNAVAILABLE'&&!choice.has(callKey)){choice.set(callKey,'fallback');return fallback.getNativeCredential(request);}
   throw error;
  }
  if(choice.get(callKey)==='fallback')refuse('ACCESS_DENIED');choice.set(callKey,'delegated');
  let handle=byCall.get(callKey);
  if(handle===undefined){prune();if(handles.size>=MAX_HANDLES)refuse('RESOURCE_LIMIT');handle=`mrd.${randomUUID()}`;byCall.set(callKey,handle);}
  const expiresAtMs=delegation.hardExpiry();handles.set(handle,{callKey,expiresAtMs});
  return Object.freeze({credential:handle,expiresAtMs});
 }
 async function current(h,{conversation,signal,deadlineMs}){
  const body={schemaVersion:1,conversation},started=now(),issued=await delegation.token({kind:'current',callKey:h.callKey,body,signal,deadlineMs});
  const raw=await client.target({path:issued.path,body:bodyBytes(body),token:issued.token,signal,deadlineMs:Math.min(deadlineMs,issued.expiresAtMs)});
  const v=assertCurrentReceipt(raw,{delegationId:issued.delegationId,binding:delegation.binding,clientId:delegation.clientId,conversation,started,now});
  // A renewal between issue and use changes the delegation (and Core's identityRevision); the owner then refuses on drift.
  if(delegation.delegationId!==issued.delegationId)refuse('ACCESS_DENIED');
  return {...v,expiresAtMs:Math.min(v.expiresAtMs,delegation.hardExpiry(),deadlineMs)};
 }
 // Every outbound delegated call combines the caller's signal with the run's Stop signal, so Stop aborts it in flight.
 const call=(raw,keys)=>{let v;try{v=own(raw,keys,['signal']);nativeSignal(v.signal);}catch{refuse('INVALID_ARGUMENTS');}if(v.signal?.aborted||delegation.signal.aborted)refuse('CANCELLED');if(!Number.isSafeInteger(v.deadlineMs))refuse('INVALID_ARGUMENTS');
  return {...v,signal:v.signal===undefined?delegation.signal:AbortSignal.any([v.signal,delegation.signal])};};
 const identity=v=>({principal:v.principal,identityRevision:v.identityRevision});
 async function readCurrent(raw){
  const h=slotOf(raw?.credential);if(!h)return fallback?fallback.coreAuthority.readCurrent(raw):refuse('UNAVAILABLE');
  const v=call(raw,['credential','deadlineMs']),r=await current(h,{conversation:false,signal:v.signal,deadlineMs:v.deadlineMs});
  return {principal:r.principal,identityRevision:r.identityRevision,actorRole:r.actorRole,clientIds:r.clientIds,membershipRevision:r.membershipRevision,checkedAtMs:r.checkedAtMs,expiresAtMs:r.expiresAtMs};
 }
 async function readConversation(raw){
  const h=slotOf(raw?.credential);if(!h)return fallback?.coreAuthority.readConversation?fallback.coreAuthority.readConversation(raw):refuse('UNAVAILABLE');
  const v=call(raw,['credential','conversationId','clientId','deadlineMs']);
  // The BD context proof is only ever for the delegation's own conversation and client.
  if(v.conversationId!==delegation.binding.conversationId||v.clientId!==delegation.clientId)refuse('ACCESS_DENIED');
  const r=await current(h,{conversation:true,signal:v.signal,deadlineMs:v.deadlineMs});
  return {...identity(r),conversationId:r.conversation.conversationId,selectedClientId:r.conversation.selectedClientId,contextRevision:r.conversation.contextRevision,checkedAtMs:r.checkedAtMs,expiresAtMs:r.expiresAtMs};
 }
 async function readClientReference(raw){
  const h=slotOf(raw?.credential);if(!h)return fallback?.coreAuthority.readClientReference?fallback.coreAuthority.readClientReference(raw):refuse('UNAVAILABLE');
  const v=call(raw,['credential','reference','deadlineMs']);if(typeof v.reference!=='string'||!v.reference.trim()||v.reference.length>80)refuse('INVALID_ARGUMENTS');
  const started=now(),cutoff=Math.min(v.deadlineMs,started+3000),before=await current(h,{conversation:false,signal:v.signal,deadlineMs:cutoff});
  const body={ref:v.reference},issued=await delegation.token({kind:'reference',callKey:h.callKey,path:READ_DELEGATION_ROUTES.reference,body,referenceSha256:sha256(Buffer.from(v.reference,'utf8')),signal:v.signal,deadlineMs:cutoff});
  const result=await client.target({path:READ_DELEGATION_ROUTES.reference,body:bodyBytes(body),token:issued.token,signal:v.signal,deadlineMs:Math.min(cutoff,issued.expiresAtMs),maxResponseBytes:4096});
  if(result?.ok===false)refuse('UNAVAILABLE');let resolved;
  try{resolved=data(own(result,['ok','clientId']));}catch{refuse('INVALID_RESULT');}
  if(resolved.ok!==true||typeof resolved.clientId!=='string'||!UUID.test(resolved.clientId))refuse('INVALID_RESULT');
  // Result binding: a reference that resolves to any client but the delegated one is refused and never released.
  if(resolved.clientId!==delegation.clientId)refuse('ACCESS_DENIED');
  const after=await current(h,{conversation:false,signal:v.signal,deadlineMs:cutoff});
  if(hash(identity(before))!==hash(identity(after)))refuse('ACCESS_DENIED');
  return {...identity(after),reference:v.reference,clientId:resolved.clientId,checkedAtMs:Math.min(before.checkedAtMs,after.checkedAtMs),expiresAtMs:Math.min(cutoff,before.expiresAtMs,after.expiresAtMs)};
 }
 async function readModeObservation(raw){
  const h=slotOf(raw?.credential);if(!h)return fallback?.coreAuthority.readModeObservation?fallback.coreAuthority.readModeObservation(raw):refuse('UNAVAILABLE');
  const v=call(raw,['credential','serviceSecret','operation','requestSha256','deadlineMs']);
  const operation=data(own(v.operation,['id','version']));assertReadOnlyOperation(operation);
  if(!MODE_READ_OPERATIONS.includes(operation.id)||typeof v.requestSha256!=='string'||!SHA.test(v.requestSha256))refuse('INVALID_ARGUMENTS');
  const started=now(),cutoff=Math.min(v.deadlineMs,started+3000),before=await current(h,{conversation:false,signal:v.signal,deadlineMs:cutoff});
  const body={operation,requestSha256:v.requestSha256};
  const issued=await delegation.token({kind:'mode',callKey:h.callKey,path:READ_DELEGATION_ROUTES.mode,body,operation,toolRequestSha256:v.requestSha256,signal:v.signal,deadlineMs:cutoff});
  const result=await client.target({path:READ_DELEGATION_ROUTES.mode,body:bodyBytes(body),token:issued.token,serviceSecret:v.serviceSecret,signal:v.signal,deadlineMs:Math.min(cutoff,issued.expiresAtMs),maxResponseBytes:4096});
  let r;try{r=data(own(result,['operation','requestSha256','principal','surface','evidenceAccuracyMode']));}catch{refuse('INVALID_RESULT');}
  if(r.surface!=='chat'||!MODES.has(r.evidenceAccuracyMode))refuse('INVALID_RESULT');
  if(hash(r.operation)!==hash(operation)||r.requestSha256!==v.requestSha256||hash(r.principal)!==hash(before.principal))refuse('ACCESS_DENIED');
  const after=await current(h,{conversation:false,signal:v.signal,deadlineMs:cutoff});
  if(hash(identity(before))!==hash(identity(after)))refuse('ACCESS_DENIED');
  return {...identity(after),operation,requestSha256:v.requestSha256,evidenceAccuracyMode:r.evidenceAccuracyMode,checkedAtMs:Math.min(before.checkedAtMs,after.checkedAtMs),expiresAtMs:Math.min(v.deadlineMs,before.expiresAtMs,after.expiresAtMs)};
 }
 /** The `tool` token for the transport's exact request, or null for a non-delegated (option A) credential. Requested only after
  * the dispatch's reservation exists; Core verifies that UNKNOWN reservation for this call key, operation and arguments. */
 async function toolCredential(raw){
  const h=slotOf(raw?.credential);if(!h)return null;
  const v=call(raw,['credential','operation','argumentsSha256','target','deadlineMs']),operation=data(own(v.operation,['id','version']));assertReadOnlyOperation(operation);
  const target=data(own(v.target,['method','path','bodySha256']));
  if(target.method!=='POST'||target.path!==toolRoute(operation)||typeof target.bodySha256!=='string'||!SHA.test(target.bodySha256))refuse('ACCESS_DENIED');
  delegation.assertReleasable();
  const issued=await delegation.token({kind:'tool',callKey:h.callKey,path:target.path,bodySha256:target.bodySha256,operation,argumentsSha256:v.argumentsSha256,signal:v.signal,deadlineMs:v.deadlineMs});
  return Object.freeze({bearerToken:issued.token,authorizationScheme:READ_TOKEN_SCHEME,expiresAtMs:Math.min(issued.expiresAtMs,delegation.hardExpiry())});
 }
 /** Before a delegated result is released: the delegation is still current, unexpired and not stopped. */
 const assertReleasable=credential=>{if(slotOf(credential))delegation.assertReleasable();};
 const coreAuthority=Object.freeze({available:true,origin:client.origin,readCurrent,readConversation,readClientReference,readModeObservation});
 return Object.freeze({coreAuthority,getNativeCredential,toolCredential,assertReleasable,isDelegated:credential=>slotOf(credential)!==null});
}
