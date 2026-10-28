/** Memory family (lane M, D016 #6: review-only, in scope) for the production product-port composer.
 *
 * `createMemoryFamily(context)` is an ordinary synchronous factory over the trusted control context
 * `{configuration,pool,client,native,now,canonicalProductPorts,artifactRecovery?}`: it opens no connection, reads no secret, runs
 * no SQL and calls Core only inside a request. It composes the memory application (`apps/control/memory/application.mjs`) only when
 * `configuration.memory.enabled === true` with Core's origin and the service-secret file declared (absent ⇒ disabled) AND the
 * canonical membership gate is supplied by the prepared candidate. Otherwise it contributes NO `memoryApplication` port: the fixed
 * product mount answers `/api/memory/*` with `503 MEMORY_UNAVAILABLE / NOT_DISPATCHED` and product readiness reports
 * `memory.producer: unavailable`. A port that only answered 503 would make readiness claim `composed`, so a disabled family supplies
 * nothing (as `intents.mjs`).
 *
 * What the composed port does, and only that:
 *  - the producer surface (`/api/memory/proposals/*`): own proposals and status. New surface-origin propose/correct returns
 *    MEMORY_RETENTION_SUBJECT_UNAVAILABLE until the actor/client retention subject has a central owner. Conversation-origin
 *    commands journal candidates in `meri_memory.candidates` (candidate migration `apps/control/memory/migrations/0001_memory_candidates.sql`, stage
 *    `integration`, centrally reserved for source authoring; readiness must require the table) and submitted to Core's W8 receiver
 *    (capiro-backend #84 `0304b0ef`); Core's existing owners decide. Nothing is committed inline at any scope.
 *  - the Meri review path (`/api/memory/review/*`): the proposer's own PENDING candidates (personal candidates never reach Core's
 *    shared inbox, D22) and the proposer's own approve/reject, forwarded to Core's owner-decision (additions) or version-candidate
 *    (corrections) routes. Reviewers of firm/client candidates use Core's inbox, not Meri.
 *  - Native conversation preparation submits a pending candidate using current execution/Core authority and the exact live session.
 *    It writes no task approval metadata. The ordinary intent delivery journal owns replay; Core owns review and publication.
 *
 * Credentials (`native-authority/memory-credentials.mjs`): the member's own native bearer, bounded by its admission or live
 * session, plus the verified service identity (the declared secret file, re-read per call). No bearer is ever a file. */
import {randomUUID} from 'node:crypto';
import {isAbsolute} from 'node:path';
import {types} from 'node:util';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createMemoryApplication} from '../../control/memory/application.mjs';
import {createMemoryCommandSource} from '../../control/memory/command-source.mjs';
import {createMemoryIntentPreparer} from '../../control/memory/command-options.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {createCoreDecisions} from '../../control/memory/core-decisions.mjs';
import {createCoreMemoryTransport} from '../../control/memory/core-http.mjs';
import {createCoreMemoryReads} from '../../control/memory/core-memory.mjs';
import {createCoreReview} from '../../control/memory/core-review.mjs';
import {createPostgresMemoryJournal} from '../../control/memory/postgres-journal.mjs';
import {createMemoryProducer} from '../../control/memory/producer.mjs';
import {memoryUnavailable} from '../../control/memory/protocol.mjs';
import {createMemoryCredentialBroker} from '../native-authority/memory-credentials.mjs';
const fault=code=>Object.assign(new Error(code),{code});
const CONTEXT_KEYS=['configuration','pool','client','native','now','canonicalProductPorts'];
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const ordinary=fn=>typeof fn==='function'&&!types.isProxy(fn)&&!types.isAsyncFunction(fn)&&!types.isGeneratorFunction(fn);
/** Relations the composed family needs; a disabled family adds none (control.mjs readiness, as `intentTables`). */
export {MEMORY_TABLES} from '../../control/memory/retention-readiness.mjs';
import {MEMORY_TABLES} from '../../control/memory/retention-readiness.mjs';
/** Closed control `memory` block. Absent ⇒ `{enabled:false}`; present ⇒ `{enabled:boolean, origin?, serviceSecretFile?}` where
 * `enabled:true` requires BOTH the Core https origin (the W8 receiver and decision routes live on Core's application origin) and
 * the absolute service-secret file, and `enabled:false` allows neither. Also the `config.mjs` validator for the key. */
export function compileMemoryConfiguration(configuration){
 if(configuration===null||typeof configuration!=='object'||types.isProxy(configuration))throw fault('MEMORY_CONFIGURATION');
 const d=Object.getOwnPropertyDescriptor(configuration,'memory');
 if(d===undefined)return Object.freeze({enabled:false});
 if(!Object.hasOwn(d,'value'))throw fault('MEMORY_CONFIGURATION');
 let m;try{m=data(own(d.value,['enabled'],['origin','serviceSecretFile']));}catch{throw fault('MEMORY_CONFIGURATION');}
 if(typeof m.enabled!=='boolean')throw fault('MEMORY_CONFIGURATION');
 if(!m.enabled){if(m.origin!==undefined||m.serviceSecretFile!==undefined)throw fault('MEMORY_CONFIGURATION');return Object.freeze({enabled:false});}
 let origin;try{origin=new URL(m.origin);}catch{throw fault('MEMORY_CONFIGURATION');}
 if(origin.protocol!=='https:'||origin.origin!==m.origin||typeof m.serviceSecretFile!=='string'||!isAbsolute(m.serviceSecretFile)||m.serviceSecretFile.includes('/../')||m.serviceSecretFile.length>4096)throw fault('MEMORY_CONFIGURATION');
 return Object.freeze({enabled:true,origin:m.origin,serviceSecretFile:m.serviceSecretFile});
}
/** Route bounds derived from the validated control limits; never wider than the product HTTP owner's own ceilings. */
function memoryLimits(configuration){
 const l=configuration.limits,n=configuration.native;
 if(!integer(l?.requestMs,1,30000)||!integer(l?.requestBytes,1,16777216)||!integer(n?.maxResponseBytes,1,16777216))throw fault('MEMORY_CONFIGURATION');
 return Object.freeze({maxRequestMs:l.requestMs,maxRequestBytes:l.requestBytes,maxResponseBytes:n.maxResponseBytes});
}
const ownedValue=(value,name)=>{const d=value!==null&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,name):undefined;return d&&Object.hasOwn(d,'value')?d.value:undefined;};
const compositions=new WeakMap();
const retentionBinders=new WeakMap();
/** Assembly binds the same canonical gate used by conversation serving, after retentionGate exists. A missing gate keeps every
 * surface route unavailable and makes conversation-origin producer operations fail closed. The binding belongs to this exact
 * trusted product context; a second, different gate cannot silently replace it. */
export function bindMemoryRetention(context,gate){
 if(context===null||typeof context!=='object'||types.isProxy(context))throw fault('PRODUCT_PORTS_CONFIGURATION');
 const bind=retentionBinders.get(context);if(bind===undefined)return false;
 bind(gate);return true;
}
function compose(context,owners){
 let c;try{c=own(context,CONTEXT_KEYS,['artifactRecovery']);}catch{throw fault('PRODUCT_PORTS_CONFIGURATION');}
 const memory=compileMemoryConfiguration(c.configuration),now=c.now;
 if(typeof now!=='function')throw fault('PRODUCT_PORTS_CONFIGURATION');
 const off=(state,reason)=>Object.freeze({state,reason,application:null,intentPreparersFor:null,tables:Object.freeze([])});
 if(!memory.enabled)return off('disabled','MEMORY_DISABLED');
 const limits=memoryLimits(c.configuration),gate=ownedValue(c.canonicalProductPorts,'conversationMembership');
 if(!gate)return off('unavailable','MEMBERSHIP_GATE_UNAVAILABLE');
 if(c.configuration.retention?.enabled!==true)return off('unavailable','RETENTION_GATE_UNAVAILABLE');
 if(!c.pool||typeof c.pool!=='object'||types.isProxy(c.pool)||typeof c.pool.connect!=='function')throw fault('PRODUCT_PORTS_CONFIGURATION');
 let boundRetention=null;
 const bindRetention=next=>{
  if(next===null||typeof next!=='object'||types.isProxy(next)||typeof next.assertServable!=='function'||types.isProxy(next.assertServable))throw fault('PRODUCT_PORTS_CONFIGURATION');
  if(boundRetention!==null&&boundRetention!==next)throw fault('PRODUCT_PORTS_CONFIGURATION');
  boundRetention=next;
 };
 const retention=Object.freeze({assertServable:subject=>{
  if(boundRetention===null)throw fault('RETENTION_READ_UNAVAILABLE');
  return boundRetention.assertServable(subject);
 }});
 // Inert: the broker validates paths only; the secret file is read inside a request (and the candidate digests once, on first use).
 const broker=createMemoryCredentialBroker({configuration:c.configuration,serviceSecretFile:memory.serviceSecretFile,now,
  ...(owners.readSecret===undefined?{}:{readSecret:owners.readSecret}),...(owners.nativeCredentials===undefined?{}:{nativeCredentials:owners.nativeCredentials})});
 const journal=createPostgresMemoryJournal({pool:c.pool,guardConversationRetention:true}),newId=owners.newId??randomUUID,fetchImpl=owners.fetchImpl??globalThis.fetch;
 /** One producer over one credential source: the Core client, the review/read/decision adapters and the shared journal. */
 function producerWith(getCredentials){
  const transport=createCoreMemoryTransport({origin:memory.origin,getCredentials,fetchImpl,now,maxRequestMs:Math.min(limits.maxRequestMs,10000),maxResponseBytes:Math.min(limits.maxResponseBytes,262144)});
  return createMemoryProducer({journal,review:createCoreReview({transport}),memory:createCoreMemoryReads({transport}),decisions:createCoreDecisions({transport}),retention,
   requireSurfaceRetentionSubject:true,newId,now});
 }
 const application=createMemoryApplication({gate,now,limits,
  producerFor:({principal,bearer})=>producerWith(broker.surface({tenantId:principal.tenantId,actorId:principal.actorId,credential:bearer.credential,expiresAtMs:bearer.expiresAtMs}))});

 /** One run borrows its live signed-in session. The existing Core membership owner supplies proposal permissions. */
 const intentPreparersFor=broker.runAvailable?value=>{
  if(boundRetention===null)return [];
  const v=own(value,['binding','scopes','selectedClientId','policyRevision','readCurrent','deadlineMs'],['signal']);
  const selected=data({binding:v.binding,scopes:v.scopes,selectedClientId:v.selectedClientId});
  assertNativeConversationScope(selected);
  const credentials=broker.run(selected);
  const producerFor=async({signal,deadlineMs,checkCurrent})=>{
   let principal=null;
   async function acquire(call){
    const credential=await credentials(call);
    const admitted=await gate.admit({credential:credential.bearerToken,signal:call.signal,deadlineMs:Math.min(call.deadlineMs,credential.expiresAtMs)});
    if(admitted.principal.tenantId!==selected.binding.tenantId||admitted.principal.actorId!==selected.binding.actorId||
     principal!==null&&canonicalSha256(principal)!==canonicalSha256(admitted.principal)||
     selected.selectedClientId!==null&&!admitted.principal.clientIds.includes(selected.selectedClientId))throw fault('ACCESS_DENIED');
    const current=await checkCurrent({signal:call.signal});
    await retention.assertServable({tenantId:selected.binding.tenantId,kind:'conversation',subjectId:selected.binding.conversationId});
    // Membership/current/retention can await. Borrow again after them so a replaced or revoked action session cannot submit.
    const live=await credentials(call);
    if(live.bearerToken!==credential.bearerToken)throw fault('ACCESS_DENIED');
    if(!Number.isSafeInteger(admitted.expiresAtMs)||admitted.expiresAtMs<=now())throw fault('ACCESS_DENIED');
    principal??=data(admitted.principal);
    return Object.freeze({...live,expiresAtMs:Math.min(credential.expiresAtMs,live.expiresAtMs,admitted.expiresAtMs,current.expiresAtMs)});
   }
   const recheck=({signal,deadlineMs})=>acquire({tenantId:selected.binding.tenantId,actorId:selected.binding.actorId,purpose:'memory.submit',signal,deadlineMs});
   const initial=await recheck({signal,deadlineMs});
   return Object.freeze({principal,expiresAtMs:initial.expiresAtMs,producer:producerWith(acquire),recheck});
  };
  const source=createMemoryCommandSource({...selected,policyRevision:v.policyRevision,readCurrent:v.readCurrent,producerFor,now,maxRequestMs:limits.maxRequestMs,deadlineMs:v.deadlineMs});
  return Object.freeze([createMemoryIntentPreparer({...selected,source,newId})]);
 }:null;
 retentionBinders.set(context,bindRetention);
 return Object.freeze({state:'composed',reason:null,application:Object.freeze({handle:request=>boundRetention===null?memoryUnavailable():application.handle(request)}),
  intentPreparersFor,tables:MEMORY_TABLES,retentionBound:()=>boundRetention!==null});
}
function captureOwners(owners){
 let o;try{o=own(owners??{},[],['nativeCredentials','readSecret','fetchImpl','newId']);}catch{throw fault('MEMORY_CONFIGURATION');}
 for(const fn of [o.readSecret,o.fetchImpl,o.newId])if(fn!==undefined&&(typeof fn!=='function'||types.isProxy(fn)))throw fault('MEMORY_CONFIGURATION');
 if(o.nativeCredentials!==undefined&&(o.nativeCredentials===null||typeof o.nativeCredentials!=='object'||types.isProxy(o.nativeCredentials)||!ordinary(o.nativeCredentials.nativeCredentialFor)))throw fault('MEMORY_CONFIGURATION');
 return Object.freeze(o);
}
/** The memoized per-context memory composition: `{state:'disabled'|'unavailable'|'composed', reason, application, intentPreparersFor,
 * tables}`. Owners are accepted only by the family (`createMemoryFamilyWith`); a later call naming other owners for the same context
 * is refused, so every consumer (the product mount, lane X's execution owner) sees one composition. */
export function memoryComposition(context,{owners}={}){
 if(context===null||typeof context!=='object'||types.isProxy(context))throw fault('PRODUCT_PORTS_CONFIGURATION');
 let memo=compositions.get(context);
 if(memo===undefined){memo={value:compose(context,owners??Object.freeze({})),owners:owners??null};compositions.set(context,memo);}
 else if(owners!==undefined&&memo.owners!==owners)throw fault('PRODUCT_PORTS_CONFIGURATION');
 return memo.value;
}
/** A memory family over optional trusted owners: the live-session relay port for the run path, and test seams. */
export function createMemoryFamilyWith(owners={}){
 const captured=captureOwners(owners);
 return function createMemoryFamily(context){
  const shared=memoryComposition(context,{owners:captured});
  return {ports:shared.application?{memoryApplication:shared.application}:{},shared};
 };
}
/** Family factory for `PRODUCT_FAMILIES`: `['memory', createMemoryFamily]` (no relay: the surface composes, the run path stays null). */
export const createMemoryFamily=createMemoryFamilyWith();

/** The native resolver supplies its current-execution/Core closure; configuration, relay and retention stay family-owned. */
export function memoryIntentPreparersFor(context,value){return memoryComposition(context).intentPreparersFor?.(value)??Object.freeze([]);}
