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
 *  - `memoryComposition(context).commandSourceFor({binding, selectedClientId|scopes})`: the governed `memory.propose` command source
 *    for one run (`apps/control/memory/command-source.mjs`), for the trusted execution owner (lane X). It needs the live-session
 *    relay (`createMemoryFamilyWith({nativeCredentials: relay.port})`, cli.mjs); without it the run path is `null` and the surface
 *    still composes.
 *
 * Credentials (`native-authority/memory-credentials.mjs`): the member's own native bearer, bounded by its admission or live
 * session, plus the verified service identity (the declared secret file, re-read per call). No bearer is ever a file. */
import {randomUUID} from 'node:crypto';
import {isAbsolute} from 'node:path';
import {types} from 'node:util';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createMemoryApplication} from '../../control/memory/application.mjs';
import {createMemoryCommandSource} from '../../control/memory/command-source.mjs';
import {createMemoryCommandOptions} from '../../control/memory/command-options.mjs';
import {MEMORY_APPROVAL_METADATA_ROW_CLASS} from '../../control/memory/approval-metadata-retention-owner.mjs';
import {MEMORY_CANDIDATE_ROW_CLASS} from '../../control/memory/retention-payload-owner.mjs';
import {createCoreDecisions} from '../../control/memory/core-decisions.mjs';
import {createCoreMemoryTransport} from '../../control/memory/core-http.mjs';
import {createCoreMemoryReads} from '../../control/memory/core-memory.mjs';
import {createCoreReview} from '../../control/memory/core-review.mjs';
import {createPostgresMemoryJournal} from '../../control/memory/postgres-journal.mjs';
import {createMemoryProducer} from '../../control/memory/producer.mjs';
import {memoryUnavailable} from '../../control/memory/protocol.mjs';
import {createMemoryCredentialBroker} from '../native-authority/memory-credentials.mjs';
import {UUID} from '../../control/product-access/shape.mjs';
const fault=code=>Object.assign(new Error(code),{code});
const CONTEXT_KEYS=['configuration','pool','client','native','now','canonicalProductPorts'];
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const ordinary=fn=>typeof fn==='function'&&!types.isProxy(fn)&&!types.isAsyncFunction(fn)&&!types.isGeneratorFunction(fn);
/** Relations the composed family needs; a disabled family adds none (control.mjs readiness, as `intentTables`). */
export const MEMORY_TABLES=Object.freeze(['meri_memory.candidates']);
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
const commandRetentionBinders=new WeakMap();
/** These four durable payloads can expose the same proposal after a conversation is suppressed. */
export const MEMORY_COMMAND_RETENTION_CLASSES=Object.freeze([MEMORY_CANDIDATE_ROW_CLASS,MEMORY_APPROVAL_METADATA_ROW_CLASS,
 'meriMemoryCommandJournal','meriMemoryIntentPreparations']);
/** Assembly binds the same canonical gate used by conversation serving, after retentionGate exists. A missing gate keeps every
 * surface route unavailable and makes conversation-origin producer operations fail closed. The binding belongs to this exact
 * trusted product context; a second, different gate cannot silently replace it. */
export function bindMemoryRetention(context,gate){
 if(context===null||typeof context!=='object'||types.isProxy(context))throw fault('PRODUCT_PORTS_CONFIGURATION');
 const bind=retentionBinders.get(context);if(bind===undefined)return false;
 bind(gate);return true;
}
/** Separate activation after central retention has proven the four payload classes, target schema, grants and recovery. */
export function bindMemoryCommandRetention(context,owner){
 if(context===null||typeof context!=='object'||types.isProxy(context))throw fault('PRODUCT_PORTS_CONFIGURATION');
 const bind=commandRetentionBinders.get(context);if(bind===undefined)return false;
 bind(owner);return true;
}
function compose(context,owners){
 let c;try{c=own(context,CONTEXT_KEYS,['artifactRecovery']);}catch{throw fault('PRODUCT_PORTS_CONFIGURATION');}
 const memory=compileMemoryConfiguration(c.configuration),now=c.now;
 if(typeof now!=='function')throw fault('PRODUCT_PORTS_CONFIGURATION');
 const off=(state,reason)=>Object.freeze({state,reason,application:null,commandSourceFor:null,commandOptionsFor:null,tables:Object.freeze([])});
 if(!memory.enabled)return off('disabled','MEMORY_DISABLED');
 const limits=memoryLimits(c.configuration),gate=ownedValue(c.canonicalProductPorts,'conversationMembership');
 if(!gate)return off('unavailable','MEMBERSHIP_GATE_UNAVAILABLE');
 if(c.configuration.retention?.enabled!==true)return off('unavailable','RETENTION_GATE_UNAVAILABLE');
 if(!c.pool||typeof c.pool!=='object'||types.isProxy(c.pool)||typeof c.pool.connect!=='function')throw fault('PRODUCT_PORTS_CONFIGURATION');
 let boundRetention=null;
 let boundCommandRetention=null;
 const bindRetention=next=>{
  if(next===null||typeof next!=='object'||types.isProxy(next)||typeof next.assertServable!=='function'||types.isProxy(next.assertServable))throw fault('PRODUCT_PORTS_CONFIGURATION');
  if(boundRetention!==null&&boundRetention!==next)throw fault('PRODUCT_PORTS_CONFIGURATION');
  boundRetention=next;
 };
 const bindCommandRetention=next=>{
  if(next===null||typeof next!=='object'||types.isProxy(next)||!Array.isArray(next.classNames)||
   next.classNames.length!==MEMORY_COMMAND_RETENTION_CLASSES.length||
   MEMORY_COMMAND_RETENTION_CLASSES.some(name=>!next.classNames.includes(name))||
   ['registryReady','targetSchemaReady','grantsReady','recoveryReady','policyReady'].some(k=>next[k]!==true)||
   next.metadata?.className!==MEMORY_APPROVAL_METADATA_ROW_CLASS||
   ['inventoryPage','present','purgeInTransaction'].some(k=>typeof next.metadata[k]!=='function'||types.isProxy(next.metadata[k]))||
   boundCommandRetention!==null&&boundCommandRetention!==next)throw fault('PRODUCT_PORTS_CONFIGURATION');
  boundCommandRetention=next;
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
 /** The run's `memory.propose` command source, bound to that run's live session (null without the relay). */
 const commandSourceFor=broker.runAvailable?value=>{
  if(boundRetention===null||boundCommandRetention===null)return null;
  const v=own(value,['binding'],['selectedClientId','scopes']);
  const selected=v.selectedClientId===undefined?broker.selectedClientOf(v.scopes):v.selectedClientId;
  if(typeof selected!=='string'||!UUID.test(selected.toLowerCase()))throw fault('MEMORY_CONFIGURATION');
  const selectedClientId=selected.toLowerCase();
  if(v.scopes!==undefined&&(broker.selectedClientOf(v.scopes)!==selectedClientId||v.scopes.some(s=>s.tenantId!==v.binding?.tenantId)))throw fault('MEMORY_CONFIGURATION');
  return createMemoryCommandSource({producer:producerWith(broker.run({binding:v.binding,selectedClientId})),binding:v.binding,selectedClientId});
 }:null;
 /** The memory-specific immutable command owner for the same trusted run selection. The shared intent composer supplies its
  * current policy and a deferred executor; this family supplies the exact canonical retention gate and borrowed pool. */
 const commandOptionsFor=broker.runAvailable?value=>{
  if(boundRetention===null||boundCommandRetention===null)return null;
  const v=own(value,['binding','selectedClientId','preparePolicy','executor','limits']);
  if(typeof v.selectedClientId!=='string'||!UUID.test(v.selectedClientId.toLowerCase()))throw fault('MEMORY_CONFIGURATION');
  return createMemoryCommandOptions({pool:c.pool,commandContext:{binding:v.binding,conversationClientId:v.selectedClientId.toLowerCase()},
   preparePolicy:v.preparePolicy,retention,executor:v.executor,now,newId,limits:v.limits});
 }:null;
 retentionBinders.set(context,bindRetention);
 commandRetentionBinders.set(context,bindCommandRetention);
 return Object.freeze({state:'composed',reason:null,application:Object.freeze({handle:request=>boundRetention===null?memoryUnavailable():application.handle(request)}),commandSourceFor,commandOptionsFor,tables:MEMORY_TABLES,
  retentionBound:()=>boundRetention!==null,commandRetentionBound:()=>boundCommandRetention!==null});
}
function captureOwners(owners){
 let o;try{o=own(owners??{},[],['nativeCredentials','readSecret','fetchImpl','newId']);}catch{throw fault('MEMORY_CONFIGURATION');}
 for(const fn of [o.readSecret,o.fetchImpl,o.newId])if(fn!==undefined&&(typeof fn!=='function'||types.isProxy(fn)))throw fault('MEMORY_CONFIGURATION');
 if(o.nativeCredentials!==undefined&&(o.nativeCredentials===null||typeof o.nativeCredentials!=='object'||types.isProxy(o.nativeCredentials)||!ordinary(o.nativeCredentials.nativeCredentialFor)))throw fault('MEMORY_CONFIGURATION');
 return Object.freeze(o);
}
/** The memoized per-context memory composition: `{state:'disabled'|'unavailable'|'composed', reason, application, commandSourceFor,
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
