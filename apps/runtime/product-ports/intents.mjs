/** Conversation write-intent approvals family (lane 3) for the production product-port composer.
 *
 * `createIntentsFamily(context)` is an ordinary synchronous factory over the trusted control context
 * `{configuration,pool,client,native,now,canonicalProductPorts,artifactRecovery?}`. Construction is inert: it opens no connection,
 * reads no secret, runs no SQL and makes no native call. It composes `apps/control/intents/compose.mjs` only when
 * `configuration.intents.enabled === true` (absent ⇒ disabled) AND the canonical membership gate is supplied by the prepared
 * candidate. Otherwise it contributes NO `intentApplication` port: the fixed product mount then answers the two intent routes
 * `503 INTENTS_UNAVAILABLE / NOT_DISPATCHED` and product readiness reports `intents.application: unavailable`. A port that only
 * answered 503 would make readiness claim `composed`, so a disabled family deliberately supplies nothing.
 *
 * Enabling asserts that Core serves `approval/record` and `approval/decision` (P-INT-10) and that the `meri_intents` and
 * `meri_commands` migrations are applied. Execution (`issueExecution`, `commandOptionsFor`, `contextFor`) comes only from a
 * trusted execution owner (`native-authority/execution-composition.mjs`, `createIntentsFamilyWith({execution})`) whose
 * `state()` is `composed`; the shared decision ports are bound into it here, once. Without it (the production default) or while
 * it is not composed, those ports refuse with the typed `EXECUTION_OWNER_UNAVAILABLE` (`NOT_DISPATCHED`): an approval is
 * recorded by Core and nothing executes; history shows the decision with `execution:'unavailable'`.
 *
 * Shared approval store. One native decision adapter (`createNativeIntentApprovals`) exists per trusted context, memoized by the
 * context object (`assembleControl` passes the same frozen context to every family). `intentsComposition(context)` returns it:
 *  - `approvalStore` `{getCurrent}`: the approval guard input for any per-run command executor (task-update services, a future
 *    intent executor), so the executor rechecks the SAME Core decision the decide route recorded;
 *  - `readDecision(value)`: for the lifecycle's `approvals.readDecision` (see `lifecycle.mjs`);
 *  - `state`: `disabled` | `unavailable` | `composed` for the decide/list surface. Consumers that would claim readiness must
 *    require `state === 'composed'`; the adapter itself is inert and is built whenever `native.call` exists. */
import {types} from 'node:util';
import {isAbsolute} from 'node:path';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {compileExecutionTrust} from '../native-authority/execution-capability.mjs';
import {composeIntentApprovals} from '../../control/intents/compose.mjs';
import {createNativeIntentApprovals} from '../../control/intents/native-approvals.mjs';
import {createPostgresCommandJournal} from '../../control/commands/postgres-command-journal.mjs';
import {createPostgresCommandProposalReader} from '../../control/intents/postgres-journal.mjs';
import {ProductError} from '../../control/product-access/errors.mjs';
import {createReadCredentialRelay} from '../read-credential-relay.mjs';
import {routinesReservedSecretFiles} from '../native-authority/routines-configuration.mjs';
import {createRoutinesServiceSecret} from '../native-authority/routines-core-client.mjs';
import {createCoreApprovalForwarder,createReservedCredentialDigests,registerApprovalSessionBinder} from '../native-authority/approval-forwarder.mjs';
import {compilePreparedCandidateConfiguration} from '../prepared-candidate-config.mjs';
const fault=code=>Object.assign(new Error(code),{code});
/** The runtime secret reader, loaded on first use: `../config.mjs` imports this module for its configuration validator. */
const runtimeReadSecret=async path=>(await import('../config.mjs')).readSecret(path);
/** Bound for one Core decision receipt (the sessions owner uses the same fact bound). */
export const INTENT_FACT_BYTES=131072;
const CONTEXT_KEYS=['configuration','pool','client','native','now','canonicalProductPorts'];
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
/** Closed `intents` control configuration. Absent ⇒ `{enabled:false}`; present ⇒ `{enabled:boolean, core?, execution?}`.
 * `core` (only with `enabled:true`) names Core's P-INT-10 approval owner for the approval forwarder
 * (`native-authority/approval-forwarder.mjs`): `{origin, serviceSecretFile}`, the https origin of `POST /api/clio/approvals/native/
 * {record,decision}` and the file holding the internal service secret Core's ToolServiceSecretGuard verifies (read per call,
 * never a native candidate credential file). Without it the shared decision adapter stays over the provider RPC seam (which
 * serves no `approval/*` operation), so every decision read refuses at use and nothing claims Core.
 * `execution` (only with `enabled:true`) is the Core execution-capability trust for the execution owner
 * (`native-authority/execution-composition.mjs`): `{coreOrigin, issuer, keys:[pinned OKP Ed25519 JWK], serviceSecretFile}`.
 * Both are pure data: the keys are pinned here and never fetched; the secret files are read by the composer only on use. */
export function compileIntentsConfiguration(configuration){
 if(configuration===null||typeof configuration!=='object'||types.isProxy(configuration))throw fault('INTENTS_CONFIGURATION');
 const d=Object.getOwnPropertyDescriptor(configuration,'intents');
 if(d===undefined)return Object.freeze({enabled:false});
 if(!Object.hasOwn(d,'value'))throw fault('INTENTS_CONFIGURATION');
 let value;try{value=own(d.value,['enabled'],['core','execution']);}catch{throw fault('INTENTS_CONFIGURATION');}
 if(typeof value.enabled!=='boolean'||(value.execution!==undefined||value.core!==undefined)&&value.enabled!==true)throw fault('INTENTS_CONFIGURATION');
 const secretFile=file=>typeof file==='string'&&isAbsolute(file)&&!file.includes('/../')&&!file.includes('\\..\\')&&file.length<=4096;
 const httpsOrigin=raw=>{let origin;try{origin=new URL(raw);}catch{return false;}return origin.protocol==='https:'&&origin.origin===raw;};
 const reserved=routinesReservedSecretFiles(configuration);
 let core;
 if(value.core!==undefined){
  try{core=data(own(value.core,['origin','serviceSecretFile']));}catch{throw fault('INTENTS_CONFIGURATION');}
  if(!httpsOrigin(core.origin)||!secretFile(core.serviceSecretFile)||reserved.includes(core.serviceSecretFile))throw fault('INTENTS_CONFIGURATION');
 }
 if(value.execution===undefined)return Object.freeze({enabled:value.enabled,...(core===undefined?{}:{core})});
 let e;try{e=data(own(value.execution,['coreOrigin','issuer','keys','serviceSecretFile']));compileExecutionTrust({issuer:e.issuer,keys:e.keys});}catch{throw fault('INTENTS_CONFIGURATION');}
 if(!httpsOrigin(e.coreOrigin)||!secretFile(e.serviceSecretFile))throw fault('INTENTS_CONFIGURATION');
 return Object.freeze({enabled:true,...(core===undefined?{}:{core}),execution:e});
}
/** Route bounds derived from the validated control limits; never wider than the product HTTP owner's own ceilings. */
function intentLimits(configuration){
 const l=configuration.limits,n=configuration.native;
 if(!integer(l?.requestMs,1,30000)||!integer(l?.requestBytes,1,16777216)||!integer(n?.maxResponseBytes,1,16777216))throw fault('INTENTS_CONFIGURATION');
 return Object.freeze({maxRequestMs:Math.min(l.requestMs,30000),maxRequestBytes:Math.min(l.requestBytes,1048576),maxResponseBytes:n.maxResponseBytes,maxFactBytes:INTENT_FACT_BYTES});
}
/** Typed refusal for every execution-owner port until Core's conversation-intent execution broker exists. */
export const executionOwnerUnavailable=()=>Object.assign(new ProductError('EXECUTION_OWNER_UNAVAILABLE','NOT_DISPATCHED'),{code:'EXECUTION_OWNER_UNAVAILABLE'});
const unavailableExecution=Object.freeze({
 async contextFor(){throw executionOwnerUnavailable();},
 async commandOptionsFor(){throw executionOwnerUnavailable();},
 async issueExecution(){throw executionOwnerUnavailable();},
});
const ownedValue=(value,name)=>{const d=value!==null&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,name):undefined;return d&&Object.hasOwn(d,'value')?d.value:undefined;};
const compositions=new WeakMap();
/** The Core approval forwarder for this context (`intents.core` declared): its credential relay is late-bound to control's own
 * action-session owner by trusted assembly (`bindApprovalSessions(context, sessions)`); until then every Core call refuses
 * ACCESS_DENIED (no live approver session). The proposal custody reader needs the control pool. Inert at construction. */
function approvalForwarder(context,c,intents,now,transport){
 const core=intents.core;if(core===undefined)return null;
 if(!c.pool||typeof c.pool!=='object'||types.isProxy(c.pool)||typeof c.pool.connect!=='function')throw fault('PRODUCT_PORTS_CONFIGURATION');
 const readSecret=transport.readSecret??runtimeReadSecret,reserved=routinesReservedSecretFiles(c.configuration),relay=createReadCredentialRelay();
 const candidate=c.configuration.nativeCandidate===undefined?null:compilePreparedCandidateConfiguration(c.configuration.nativeCandidate,c.configuration.versions);
 const forwarder=createCoreApprovalForwarder({origin:core.origin,nativeCredentials:relay.port,
  getServiceSecret:createRoutinesServiceSecret({file:core.serviceSecretFile,reservedFiles:reserved,readSecret}),
  reservedCredentials:createReservedCredentialDigests({files:reserved,readSecret}),
  readProposal:createPostgresCommandProposalReader({pool:c.pool}).readProposal,
  ...(candidate===null?{}:{selectedClientId:candidate.identity.commandContext.clientResolution.clientId}),
  now,maxRequestMs:Math.min(c.configuration.limits?.requestMs??10000,30000),...(transport.fetchImpl===undefined?{}:{fetchImpl:transport.fetchImpl})});
 registerApprovalSessionBinder(context,sessions=>relay.bind(sessions));
 return Object.freeze({forwarder,relay});
}
function compose(context,execution,transport){
 let c;try{c=own(context,CONTEXT_KEYS,['artifactRecovery']);}catch{throw fault('PRODUCT_PORTS_CONFIGURATION');}
 const intents=compileIntentsConfiguration(c.configuration);
 // The trusted native client: the fenced startup client carries `call` as an own method; a prototype method is accepted too.
 const nativeCall=c.native!==null&&typeof c.native==='object'&&!types.isProxy(c.native)&&typeof c.native.call==='function'?c.native.call:undefined,now=c.now;
 if(typeof now!=='function')throw fault('PRODUCT_PORTS_CONFIGURATION');
 // With `intents.core` the approval operations go to Core P-INT-10 through the forwarder (the provider seam serves none of them).
 const core=intents.enabled?approvalForwarder(context,c,intents,now,transport):null;
 const call=core?(operation,input,options)=>core.forwarder.call(operation,input,options):typeof nativeCall==='function'?(operation,input,options)=>nativeCall.call(c.native,operation,input,options):undefined;
 // The one decision adapter for this control process. Inert: it holds the call and makes it only when a port is used.
 const decisions=typeof call==='function'?createNativeIntentApprovals({call,now,maxFactBytes:INTENT_FACT_BYTES}):null;
 const shared={decisions,
  approvalStore:decisions?Object.freeze({getCurrent:value=>decisions.getCurrent(value)}):null,
  readDecision:decisions?value=>decisions.readDecision(value):null,
  /** The forwarder's attended Core credentials (`{origin,getCredentials}`, the execution owner's `core` port) and its relay state. */
  core:core?Object.freeze({origin:core.forwarder.origin,getCredentials:value=>core.forwarder.getCredentials(value)}):null,
  approvalSessions:()=>core?core.relay.state():'absent'};
 if(!intents.enabled)return Object.freeze({...shared,state:'disabled',reason:'INTENTS_DISABLED',application:null,owner:null});
 const limits=intentLimits(c.configuration),gate=ownedValue(c.canonicalProductPorts,'conversationMembership');
 if(!decisions)return Object.freeze({...shared,state:'unavailable',reason:'NATIVE_UNAVAILABLE',application:null,owner:null});
 if(!gate)return Object.freeze({...shared,state:'unavailable',reason:'MEMBERSHIP_GATE_UNAVAILABLE',application:null,owner:null});
 if(!c.pool||typeof c.pool!=='object'||types.isProxy(c.pool)||typeof c.pool.connect!=='function')throw fault('PRODUCT_PORTS_CONFIGURATION');
 // The trusted execution owner receives the SAME decision ports (approval guard + current decision) the decide route uses.
 if(execution)execution.bindApprovals({approvalStore:shared.approvalStore,readDecision:shared.readDecision});
 const port=name=>execution?(...args)=>execution.state()==='composed'?execution[name](...args):unavailableExecution[name]():unavailableExecution[name];
 const composed=composeIntentApprovals({pool:c.pool,native:c.native,decisions,commandJournal:createPostgresCommandJournal({pool:c.pool}),
  contextFor:port('contextFor'),commandOptionsFor:port('commandOptionsFor'),issueExecution:port('issueExecution'),
  gate,now,limits,enabled:true});
 return Object.freeze({...shared,state:'composed',reason:null,application:composed.app,owner:composed.owner,executionState:()=>execution?execution.state():'unavailable'});
}
const EXECUTION_METHODS=['state','bindApprovals','contextFor','commandOptionsFor','issueExecution'];
function executionOwner(execution){
 if(execution===undefined)return undefined;
 if(execution===null||typeof execution!=='object'||types.isProxy(execution)||EXECUTION_METHODS.some(k=>typeof execution[k]!=='function'||types.isProxy(execution[k])))throw fault('PRODUCT_PORTS_CONFIGURATION');
 return execution;
}
/** `transport` ({fetchImpl, readSecret}) is a trusted test seam for the approval forwarder only; production uses global fetch
 * and the runtime secret reader. */
function captureTransport(transport){
 try{const t=own(transport??{},[],['fetchImpl','readSecret']);for(const fn of Object.values(t))if(typeof fn!=='function'||types.isProxy(fn))throw Error();return Object.freeze(t);}
 catch{throw fault('PRODUCT_PORTS_CONFIGURATION');}
}
/** The memoized per-context intents composition (shared approval store, decision reader and, when enabled, the application).
 * `execution` is accepted only by the intents family; a later call naming a different owner for the same context is refused. */
export function intentsComposition(context,{execution,transport}={}){
 if(context===null||typeof context!=='object'||types.isProxy(context))throw fault('PRODUCT_PORTS_CONFIGURATION');
 const owner=executionOwner(execution),seam=captureTransport(transport);let memo=compositions.get(context);
 if(memo===undefined){memo={value:compose(context,owner,seam),execution:owner};compositions.set(context,memo);}
 else if(owner!==undefined&&memo.execution!==owner)throw fault('PRODUCT_PORTS_CONFIGURATION');
 return memo.value;
}
/** An intents family over an optional trusted execution owner (`createIntentExecutionOwner`). */
export function createIntentsFamilyWith({execution,transport}={}){
 const owner=executionOwner(execution),seam=captureTransport(transport);
 return function createIntentsFamily(context){
  const shared=intentsComposition(context,{execution:owner,transport:seam});
  return {ports:shared.application?{intentApplication:shared.application}:{},shared};
 };
}
/** Family factory for `PRODUCT_FAMILIES`: `['intents', createIntentsFamily]` (no execution owner: approvals record, nothing executes). */
export const createIntentsFamily=createIntentsFamilyWith();
