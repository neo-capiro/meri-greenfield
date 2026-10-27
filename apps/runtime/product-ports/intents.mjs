import {createWatchCoreClient} from '../native-authority/watch-client.mjs';
import {createLegislativeDocumentCoreClient} from '../native-authority/legislative-document-client.mjs';
import {createClientRecordCoreClient} from '../native-authority/client-record-client.mjs';
import {createLegiwatchCoreClient} from '../native-authority/legiwatch-client.mjs';
import {createBizdevCoreClient} from '../native-authority/bizdev-client.mjs';
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
 * Tasks execute and recover through the attended Core native receiver; documents use their existing delivery owner.
 * Both preserve original proposal custody and current session/retention access.
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
import {composeIntentApprovals} from '../../control/intents/compose.mjs';
import {createNativeIntentApprovals} from '../../control/intents/native-approvals.mjs';
import {createPostgresCommandProposalReader} from '../../control/intents/postgres-journal.mjs';
import {ProductError} from '../../control/product-access/errors.mjs';
import {createReadCredentialRelay} from '../read-credential-relay.mjs';
import {routinesReservedSecretFiles} from '../native-authority/routines-configuration.mjs';
import {createRoutinesServiceSecret} from '../native-authority/routines-core-client.mjs';
import {createCoreApprovalForwarder,createReservedCredentialDigests,registerApprovalSessionBinder} from '../native-authority/approval-forwarder.mjs';
import {compilePreparedCandidateConfiguration} from '../prepared-candidate-config.mjs';
import {documentApprovalOwnerFor,filingApprovalOwnerFor} from '../artifacts/intent-binding.mjs';
import {createCoreFilingClient} from '../artifacts/core-filing-client.mjs';
import {currentNativeApprovalSession,currentAttendedSession} from '../native-authority/approval-session.mjs';
import {createResearchSharingCoreClient} from '../native-authority/research-sharing-client.mjs';
import {researchShareValidators,legiwatchValidators,watchValidators,bizdevValidators,legislativeDocumentValidators,clientRecordValidators} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
const fault=code=>Object.assign(new Error(code),{code});
/** The runtime secret reader, loaded on first use: `../config.mjs` imports this module for its configuration validator. */
const runtimeReadSecret=async path=>(await import('../config.mjs')).readSecret(path);
/** Bound for one Core decision receipt (the sessions owner uses the same fact bound). */
export const INTENT_FACT_BYTES=131072;
const CONTEXT_KEYS=['configuration','pool','client','native','now','canonicalProductPorts'];
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
/** Closed `intents` control configuration. Absent ⇒ `{enabled:false}`; present ⇒ `{enabled:boolean, core?}`.
 * `core` (only with `enabled:true`) names Core's P-INT-10 approval owner for the approval forwarder
 * (`native-authority/approval-forwarder.mjs`): `{origin, serviceSecretFile}`, the https origin of `POST /api/clio/approvals/native/
 * {record,decision}` and the file holding the internal service secret Core's ToolServiceSecretGuard verifies (read per call,
 * never a native candidate credential file). Without it the shared decision adapter stays over the provider RPC seam (which
 * serves no `approval/*` operation), so every decision read refuses at use and nothing claims Core.
 * The service secret is read by the composer only on use. */
export function compileIntentsConfiguration(configuration){
 if(configuration===null||typeof configuration!=='object'||types.isProxy(configuration))throw fault('INTENTS_CONFIGURATION');
 const d=Object.getOwnPropertyDescriptor(configuration,'intents');
 if(d===undefined)return Object.freeze({enabled:false});
 if(!Object.hasOwn(d,'value'))throw fault('INTENTS_CONFIGURATION');
 let value;try{value=own(d.value,['enabled'],['core']);}catch{throw fault('INTENTS_CONFIGURATION');}
 if(typeof value.enabled!=='boolean'||value.core!==undefined&&value.enabled!==true)throw fault('INTENTS_CONFIGURATION');
 const secretFile=file=>typeof file==='string'&&isAbsolute(file)&&!file.includes('/../')&&!file.includes('\\..\\')&&file.length<=4096;
 const httpsOrigin=raw=>{let origin;try{origin=new URL(raw);}catch{return false;}return origin.protocol==='https:'&&origin.origin===raw;};
 const reserved=routinesReservedSecretFiles(configuration);
 let core;
 if(value.core!==undefined){
  try{core=data(own(value.core,['origin','serviceSecretFile']));}catch{throw fault('INTENTS_CONFIGURATION');}
  if(!httpsOrigin(core.origin)||!secretFile(core.serviceSecretFile)||reserved.includes(core.serviceSecretFile))throw fault('INTENTS_CONFIGURATION');
 }
 return Object.freeze({enabled:value.enabled,...(core===undefined?{}:{core})});
}
/** Route bounds derived from the validated control limits; never wider than the product HTTP owner's own ceilings. */
function intentLimits(configuration){
 const l=configuration.limits,n=configuration.native;
 if(!integer(l?.requestMs,1,30000)||!integer(l?.requestBytes,1,16777216)||!integer(n?.maxResponseBytes,1,16777216))throw fault('INTENTS_CONFIGURATION');
 return Object.freeze({maxRequestMs:Math.min(l.requestMs,30000),maxRequestBytes:Math.min(l.requestBytes,1048576),maxResponseBytes:n.maxResponseBytes,maxFactBytes:INTENT_FACT_BYTES});
}
/** Typed refusal for every execution-owner port until Core's conversation-intent execution broker exists. */
export const executionOwnerUnavailable=()=>Object.assign(new ProductError('EXECUTION_OWNER_UNAVAILABLE','NOT_DISPATCHED'),{code:'EXECUTION_OWNER_UNAVAILABLE'});
const ownedValue=(value,name)=>{const d=value!==null&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,name):undefined;return d&&Object.hasOwn(d,'value')?d.value:undefined;};
const compositions=new WeakMap();
/** The Core approval forwarder for this context (`intents.core` declared): its credential relay is late-bound to control's own
 * action-session owner by trusted assembly (`bindApprovalSessions(context, sessions)`); until then every Core call refuses
 * ACCESS_DENIED (no live approver session). The proposal custody reader needs the control pool. Inert at construction. */
function approvalForwarder(context,c,intents,now,transport){
 const core=intents.core;if(core===undefined)return null;
 if(!c.pool||typeof c.pool!=='object'||types.isProxy(c.pool)||typeof c.pool.connect!=='function')throw fault('PRODUCT_PORTS_CONFIGURATION');
 const readSecret=transport.readSecret??runtimeReadSecret,reserved=routinesReservedSecretFiles(c.configuration),relay=createReadCredentialRelay();
 let attended=null;
 const candidate=c.configuration.nativeCandidate===undefined?null:compilePreparedCandidateConfiguration(c.configuration.nativeCandidate,c.configuration.versions);
 const forwarder=createCoreApprovalForwarder({origin:core.origin,nativeCredentials:relay.port,
  getServiceSecret:createRoutinesServiceSecret({file:core.serviceSecretFile,reservedFiles:reserved,readSecret}),
  reservedCredentials:createReservedCredentialDigests({files:reserved,readSecret}),
  readProposal:createPostgresCommandProposalReader({pool:c.pool}).readProposal,
  async selectApprovalBinding({proposal,signal,deadlineMs}){
   if(!attended)throw executionOwnerUnavailable();
   const check=()=>{signal?.throwIfAborted();if(now()>=deadlineMs)throw fault('DEADLINE');};
   const current=await currentNativeApprovalSession({...attended,now,proposal,signal,check});
   return {binding:current.binding,selectedClientId:current.selectedClientId};
  },
  ...(candidate===null?{}:{selectedClientId:candidate.identity.commandContext.clientResolution.clientId}),
  now,maxRequestMs:Math.min(c.configuration.limits?.requestMs??10000,30000),...(transport.fetchImpl===undefined?{}:{fetchImpl:transport.fetchImpl})});
 const sharing=createResearchSharingCoreClient({origin:core.origin,now,maxRequestMs:Math.min(c.configuration.limits?.requestMs??10000,30000),...(transport.fetchImpl?{fetchImpl:transport.fetchImpl}:{}),
  getServiceSecret:createRoutinesServiceSecret({file:core.serviceSecretFile,reservedFiles:reserved,readSecret}),reservedCredentials:createReservedCredentialDigests({files:reserved,readSecret}),
  async getCredentials({proposal,signal,deadlineMs}){
   researchShareValidators.assertProposal(proposal);if(!attended)throw executionOwnerUnavailable();
   const selectedClientId=proposal.scopes[0].kind==='client'?proposal.scopes[0].resourceId:null;
   const current=await currentAttendedSession({...attended,now,binding:proposal.binding,scopes:proposal.scopes,selectedClientId,signal,check(){signal?.throwIfAborted();if(now()>=deadlineMs)throw fault('DEADLINE');}});
   return relay.port.nativeCredentialFor({binding:current.binding,selectedClientId,signal});
  }});
 const legiwatch=createLegiwatchCoreClient({origin:core.origin,now,maxRequestMs:Math.min(c.configuration.limits?.requestMs??10000,30000),...(transport.fetchImpl?{fetchImpl:transport.fetchImpl}:{}),
  getServiceSecret:createRoutinesServiceSecret({file:core.serviceSecretFile,reservedFiles:reserved,readSecret}),reservedCredentials:createReservedCredentialDigests({files:reserved,readSecret}),
  async getCredentials({proposal,signal,deadlineMs}){
   legiwatchValidators.assertProposal(proposal);if(!attended)throw executionOwnerUnavailable();
   const selectedClientId=proposal.context.selectedClientId;
   const current=await currentAttendedSession({...attended,now,binding:proposal.binding,scopes:proposal.scopes,selectedClientId,signal,check(){signal?.throwIfAborted();if(now()>=deadlineMs)throw fault('DEADLINE');}});
   return relay.port.nativeCredentialFor({binding:current.binding,selectedClientId,signal});
  }});
 const watch=createWatchCoreClient({origin:core.origin,now,maxRequestMs:Math.min(c.configuration.limits?.requestMs??10000,30000),...(transport.fetchImpl?{fetchImpl:transport.fetchImpl}:{}),
  getServiceSecret:createRoutinesServiceSecret({file:core.serviceSecretFile,reservedFiles:reserved,readSecret}),reservedCredentials:createReservedCredentialDigests({files:reserved,readSecret}),
  async getCredentials({proposal,signal,deadlineMs}){
   watchValidators.assertProposal(proposal);if(!attended)throw executionOwnerUnavailable();
   const selectedClientId=proposal.context.selectedClientId;
   const current=await currentAttendedSession({...attended,now,binding:proposal.binding,scopes:proposal.scopes,selectedClientId,signal,check(){signal?.throwIfAborted();if(now()>=deadlineMs)throw fault('DEADLINE');}});
   return relay.port.nativeCredentialFor({binding:current.binding,selectedClientId,signal});
  }});
 const clientRecord=createClientRecordCoreClient({origin:core.origin,now,maxRequestMs:Math.min(c.configuration.limits?.requestMs??10000,30000),...(transport.fetchImpl?{fetchImpl:transport.fetchImpl}:{}),
  getServiceSecret:createRoutinesServiceSecret({file:core.serviceSecretFile,reservedFiles:reserved,readSecret}),reservedCredentials:createReservedCredentialDigests({files:reserved,readSecret}),
  async getCredentials({proposal,signal,deadlineMs}){
   clientRecordValidators.assertProposal(proposal);if(!attended)throw executionOwnerUnavailable();
   const selectedClientId=proposal.context.selectedClientId;
   const current=await currentAttendedSession({...attended,now,binding:proposal.binding,scopes:proposal.scopes,selectedClientId,signal,check(){signal?.throwIfAborted();if(now()>=deadlineMs)throw fault('DEADLINE');}});
   return relay.port.nativeCredentialFor({binding:current.binding,selectedClientId,signal});
  }});
 const bizdev=createBizdevCoreClient({origin:core.origin,now,maxRequestMs:Math.min(c.configuration.limits?.requestMs??10000,30000),...(transport.fetchImpl?{fetchImpl:transport.fetchImpl}:{}),
  getServiceSecret:createRoutinesServiceSecret({file:core.serviceSecretFile,reservedFiles:reserved,readSecret}),reservedCredentials:createReservedCredentialDigests({files:reserved,readSecret}),
  async getCredentials({proposal,signal,deadlineMs}){
   bizdevValidators.assertProposal(proposal);if(!attended)throw executionOwnerUnavailable();
   // The attendance session is scoped to the prospect's own scope: its linked client when linked, otherwise the actor's private scope.
   const selectedClientId=proposal.context.linkedClientId;
   const current=await currentAttendedSession({...attended,now,binding:proposal.binding,scopes:proposal.scopes,selectedClientId,signal,check(){signal?.throwIfAborted();if(now()>=deadlineMs)throw fault('DEADLINE');}});
   return relay.port.nativeCredentialFor({binding:current.binding,selectedClientId,signal});
  }});
 const legislativeDocument=createLegislativeDocumentCoreClient({origin:core.origin,now,maxRequestMs:Math.min(c.configuration.limits?.requestMs??10000,30000),...(transport.fetchImpl?{fetchImpl:transport.fetchImpl}:{}),
  getServiceSecret:createRoutinesServiceSecret({file:core.serviceSecretFile,reservedFiles:reserved,readSecret}),reservedCredentials:createReservedCredentialDigests({files:reserved,readSecret}),
  async getCredentials({proposal,signal,deadlineMs}){
   legislativeDocumentValidators.assertProposal(proposal);if(!attended)throw executionOwnerUnavailable();
   const selectedClientId=proposal.context.selectedClientId;
   const current=await currentAttendedSession({...attended,now,binding:proposal.binding,scopes:proposal.scopes,selectedClientId,signal,check(){signal?.throwIfAborted();if(now()>=deadlineMs)throw fault('DEADLINE');}});
   return relay.port.nativeCredentialFor({binding:current.binding,selectedClientId,signal});
  }});
 return Object.freeze({forwarder,sharing,legiwatch,watch,clientRecord,bizdev,legislativeDocument,relay,bind(sessions,retention,store){relay.bind(sessions);attended={sessions,retention,store};}});
}
function compose(context,transport){
 let c;try{c=own(context,CONTEXT_KEYS,['artifactRecovery']);}catch{throw fault('PRODUCT_PORTS_CONFIGURATION');}
 const intents=compileIntentsConfiguration(c.configuration);
 // The trusted native client: the fenced startup client carries `call` as an own method; a prototype method is accepted too.
 const nativeCall=c.native!==null&&typeof c.native==='object'&&!types.isProxy(c.native)&&typeof c.native.call==='function'?c.native.call:undefined,now=c.now;
 if(typeof now!=='function')throw fault('PRODUCT_PORTS_CONFIGURATION');
 // With `intents.core` the approval operations go to Core P-INT-10 through the forwarder (the provider seam serves none of them).
 const core=intents.enabled?approvalForwarder(context,c,intents,now,transport):null;
 let serving=null;
 if(intents.enabled)registerApprovalSessionBinder(context,(sessions,retention,store)=>{core?.bind(sessions,retention,store);serving=retention;});
 const retention=Object.freeze({withRelease(...args){if(typeof serving?.withRelease!=='function')throw new ProductError('PRODUCT_UNAVAILABLE');return serving.withRelease(...args);}});
 const call=core?(operation,input,options)=>core.forwarder.call(operation,input,options):typeof nativeCall==='function'?(operation,input,options)=>nativeCall.call(c.native,operation,input,options):undefined;
 // The one decision adapter for this control process. Inert: it holds the call and makes it only when a port is used.
 const decisions=typeof call==='function'?createNativeIntentApprovals({call,now,maxFactBytes:INTENT_FACT_BYTES}):null;
 const shared={decisions,
  approvalStore:decisions?Object.freeze({getCurrent:value=>decisions.getCurrent(value)}):null,
  readDecision:decisions?value=>decisions.readDecision(value):null,
  /** The approver's own revocation of a recorded approval (`approval/revoke`, lane RD); attended only, never automatic. */
  revokeDecision:decisions?value=>decisions.revoke(value):null,
  /** Original proposal plus current attended session; Core owns task mutation and durable replay. */
  tasks:core?Object.freeze({execute:value=>core.forwarder.executeTask(value),read:value=>core.forwarder.readTaskExecution(value)}):null,
  mail:core?Object.freeze({execute:value=>core.forwarder.executeMail(value),read:value=>core.forwarder.readMailExecution(value)}):null,
  filingSource:core?createCoreFilingClient({origin:core.forwarder.origin,credentials:{getCredentials:value=>core.forwarder.filingCredentials(value)},now,
   maxRequestMs:Math.min(c.configuration.limits.requestMs,30000),...(transport.fetchImpl?{fetchImpl:transport.fetchImpl}:{})}):null,
  approvalSessions:()=>core?core.relay.state():'absent'};
 if(!intents.enabled)return Object.freeze({...shared,state:'disabled',reason:'INTENTS_DISABLED',application:null,owner:null});
 const limits=intentLimits(c.configuration),gate=ownedValue(c.canonicalProductPorts,'conversationMembership');
 if(!decisions)return Object.freeze({...shared,state:'unavailable',reason:'NATIVE_UNAVAILABLE',application:null,owner:null});
 if(!gate)return Object.freeze({...shared,state:'unavailable',reason:'MEMBERSHIP_GATE_UNAVAILABLE',application:null,owner:null});
 if(!c.pool||typeof c.pool!=='object'||types.isProxy(c.pool)||typeof c.pool.connect!=='function')throw fault('PRODUCT_PORTS_CONFIGURATION');
 const composed=composeIntentApprovals({pool:c.pool,native:c.native,decisions,
  documents:{execute:value=>{const owner=documentApprovalOwnerFor(context);if(!owner)throw executionOwnerUnavailable();return owner.execute(value);},read:value=>{const owner=documentApprovalOwnerFor(context);if(!owner)throw executionOwnerUnavailable();return owner.read(value);}},
  filing:{execute:value=>{const owner=filingApprovalOwnerFor(context);if(!owner)throw executionOwnerUnavailable();return owner.execute(value);},read:value=>{const owner=filingApprovalOwnerFor(context);if(!owner)throw executionOwnerUnavailable();return owner.read(value);}},
  ...(core?{watch:{read:value=>core.watch.read(value),decide:value=>core.watch.decide(value)},legislativeDocument:{read:value=>core.legislativeDocument.read(value),decide:value=>core.legislativeDocument.decide(value)},bizdev:{read:value=>core.bizdev.read(value),decide:value=>core.bizdev.decide(value)},mail:{execute:value=>core.forwarder.executeMail(value),read:value=>core.forwarder.readMailExecution(value)},tasks:{execute:value=>core.forwarder.executeTask(value),read:value=>core.forwarder.readTaskExecution(value)},sharing:{read:value=>core.sharing.read(value),decide:value=>core.sharing.decide(value)},legiwatch:{read:value=>core.legiwatch.read(value),decide:value=>core.legiwatch.decide(value)},clientRecord:{read:value=>core.clientRecord.read(value),decide:value=>core.clientRecord.decide(value)}}:{}),
  gate,now,limits,retention,enabled:true});
 return Object.freeze({...shared,state:'composed',reason:null,application:composed.app,owner:composed.owner});
}
/** `transport` ({fetchImpl, readSecret}) is a trusted test seam for the approval forwarder only; production uses global fetch
 * and the runtime secret reader. */
function captureTransport(transport){
 try{const t=own(transport??{},[],['fetchImpl','readSecret']);for(const fn of Object.values(t))if(typeof fn!=='function'||types.isProxy(fn))throw Error();return Object.freeze(t);}
 catch{throw fault('PRODUCT_PORTS_CONFIGURATION');}
}
/** The memoized native decision, task, document and intent application owners. */
export function intentsComposition(context,options={}){
 if(context===null||typeof context!=='object'||types.isProxy(context))throw fault('PRODUCT_PORTS_CONFIGURATION');
 let transport;try{({transport}=own(options,[],['transport']));}catch{throw fault('PRODUCT_PORTS_CONFIGURATION');}
 const seam=captureTransport(transport);let memo=compositions.get(context);
 if(memo===undefined){memo={value:compose(context,seam)};compositions.set(context,memo);}
 return memo.value;
}
/** Optional transport is a trusted testing seam; native execution remains with Core's receiver. */
export function createIntentsFamilyWith(options={}){
 let transport;try{({transport}=own(options,[],['transport']));}catch{throw fault('PRODUCT_PORTS_CONFIGURATION');}
 const seam=captureTransport(transport);
 return function createIntentsFamily(context){
  const shared=intentsComposition(context,{transport:seam});
  return {ports:shared.application?{intentApplication:shared.application}:{},shared};
 };
}
/** Native family factory for `PRODUCT_FAMILIES`. */
export const createIntentsFamily=createIntentsFamilyWith();
