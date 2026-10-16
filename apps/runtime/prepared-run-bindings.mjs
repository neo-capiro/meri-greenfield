/** Production composition of the three multi-run ports (S2): `runIssuance` (the canonical prepared-run issuance over the durable
 * issuer and a trusted fact producer), `issuanceIntent` (the next run's expiry from reviewed static bounds) and `admissionForBinding`
 * (the existing budget admission owner per target binding). Ports are built from startup-supplied owners; configuration names no
 * callback or module. Missing owners fail readiness. The raw proxy credential stays in trusted memory and never enters a receipt. */
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../packages/contracts/validate.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {createPreparedRunIssuance} from './prepared-run-issuance.mjs';
import {createPreparedRunIssuer} from './prepared-run-issuer.mjs';
import {createNativeAllocationAdmission} from '../gateway/budget/native-allocation-admission.mjs';
import {allocation} from '../gateway/budget/tool-budget-binding.mjs';
import {capabilityDigest} from './native-authority/task-verifier.mjs';
import {compilePreparedCandidateConfiguration} from './prepared-candidate-config.mjs';
import {issueRunModelGrant} from './run-model-grant.mjs';
import {createOriginalRunPreparation} from './original-run-preparation.mjs';
import {createNativeTaskAllocator} from './native-authority/task-allocator.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {assertNativeReadConfiguration,nativeReadOperations} from '../../packages/contracts/runtime-0.2/reads.mjs';
const fail=code=>{throw Object.assign(Error('PREPARED_RUN_BINDINGS_'+code),{code:'PREPARED_RUN_BINDINGS_'+code});};
export function createPreparedRunBindings(options){
 const o=own(options,['configuration','pool','store','credentials'],['issuanceStore','capabilityAuthority','modelGrants','now','limits','initialBindings']),now=o.now??Date.now,limits=o.limits??{maxRequestMs:3000,maxFactBytes:131072};
 const config=compilePreparedCandidateConfiguration(o.configuration.nativeCandidate,o.configuration.versions);if(config.multiRun===undefined)fail('NOT_CONFIGURED');
 if(!o.issuanceStore||!o.capabilityAuthority)fail('UNAVAILABLE');if(typeof o.pool?.connect!=='function'||typeof o.store?.allocations?.read!=='function'||typeof o.store?.readOptional!=='function'||typeof o.issuanceStore.read!=='function')fail('CONFIGURATION');
 if(typeof o.modelGrants?.issue!=='function')fail('MODEL_GRANT_UNAVAILABLE');
 const secrets=own(o.credentials,['control'],['proxy']);if(typeof secrets.control!=='string'||!/^\S{1,8192}$/u.test(secrets.control))fail('CONFIGURATION');
 const controlDigest=capabilityDigest(secrets.control),a=allocation(config.allocationJson),scheduleExpiresAtMs=Date.parse(a.schedule.expiresAt);
 const configuredBinding=config.runtime.binding,selectedClientId=config.identity.commandContext.clientResolution.clientId,readInitial=o.initialBindings===undefined?null:storageMethod(o.initialBindings,'read');
 // This digest describes the reviewed, retargetable workload. A new Core conversation supplies only its UUID and the journal's
 // writer-fenced binding; the startup UUID, fixed deadline and credential locations cannot decide a later run's identity.
 const {run:_,...allocationSemantics}=a,{binding:__,deadlineMs:___,...runtimeSemantics}=config.runtime;
 const {workspace,authoritySha256:____,...preparationSemantics}=config.preparationIntent;
 const workspaceMatch=/^(.*[\\/])([0-9a-f-]{36})$/u.exec(workspace);
 if(readInitial&&(!workspaceMatch||workspaceMatch[2]!==configuredBinding.conversationId))fail('WORKSPACE');
 const workspaceParent=workspaceMatch?.[1],configurationSha256=hash({schemaVersion:1,multiRun:config.multiRun,identity:{origin:config.identity.origin,clientResolution:config.identity.commandContext.clientResolution},runtime:runtimeSemantics,allocation:allocationSemantics,plan:config.plan,preparationIntent:readInitial?{...preparationSemantics,workspaceParent}:config.preparationIntent,qualification:config.qualification,grantIntents:config.grantIntents,grantId:config.grantId,operations:config.operations,approvedReads:config.approvedReads??null,taskRequest:config.taskRequest,containerName:config.containerName,taskOrigin:config.taskOrigin,taskHttp:config.taskHttp,objects:config.objects});
 const exactInitialScopes=(scopes,binding,policyRevision)=>Array.isArray(scopes)&&hash(scopes)===hash([{kind:'client',tenantId:binding.tenantId,resourceId:selectedClientId,policyRevision}]);
 const initialRecord=async(binding,check,cleanup=false)=>{
  validateShape('RunBinding',binding);if(!readInitial||binding.writerFence!==1||hash(binding)===hash(configuredBinding)||binding.tenantId!==configuredBinding.tenantId||binding.actorId!==configuredBinding.actorId)fail('INITIAL_BINDING_UNAVAILABLE');
  check();const raw=await readInitial({binding},check);check();if(raw===null)fail('INITIAL_BINDING_UNAVAILABLE');
  const r=data(own(raw,['schemaVersion','state','binding','selectedClientId','policyRevision','versions','configurationSha256','expiresAtMs','createdAtMs']));
  if(r.schemaVersion!==1||r.state!=='ADMITTED'||hash(r.binding)!==hash(binding)||r.selectedClientId!==selectedClientId||r.policyRevision!==config.qualification.policyRevision||hash(r.versions)!==hash(config.runtime.versions)||r.configurationSha256!==configurationSha256||!Number.isSafeInteger(r.createdAtMs)||r.createdAtMs<1||r.createdAtMs>now()||!Number.isSafeInteger(r.expiresAtMs)||!cleanup&&r.expiresAtMs<=now()||r.expiresAtMs<=r.createdAtMs||r.expiresAtMs>r.createdAtMs+config.multiRun.runWindowMs||r.expiresAtMs>scheduleExpiresAtMs)fail('INITIAL_BINDING_REFUSED');
  const saved=await o.store.readOptional(binding,{},check);check();if(!saved||hash(saved.run?.binding)!==hash(binding)||!cleanup&&!['queued','starting','running'].includes(saved.run.state)||hash(saved.run.versions)!==hash(r.versions)||saved.run.policyRevision!==r.policyRevision||!exactInitialScopes(saved.run.scopes,binding,r.policyRevision))fail('INITIAL_RUN_REFUSED');
  return {admission:r,saved};
 };
 const checkedInitial=async(binding,check)=>{const {admission}=await initialRecord(binding,check);return admission;};
 const retargetPreparation=(binding,scopes)=>{if(!readInitial||!workspaceParent)fail('WORKSPACE');return {...config.preparationIntent,workspace:workspaceParent+binding.conversationId,authoritySha256:hash({scopes,selectedClientId,policyRevision:config.qualification.policyRevision})};};
 /** The authoritative allocation for a target binding: the reviewed static allocation retargeted to exactly that run. Its hash is what
  * the issued facts and the retired record carry; a record naming a different allocation hash is refused rather than admitted. */
 const retarget=binding=>{const alloc=JSON.parse(config.allocationJson);alloc.run=Object.fromEntries(Object.keys(alloc.run).map(k=>[k,binding[k]]));return JSON.stringify(alloc);};
 const admissionFor=(binding,record)=>{const allocationJson=retarget(binding);if(record.allocationSha256!==undefined&&record.allocationSha256!==hash(allocation(allocationJson)))fail('ALLOCATION_MISMATCH');
  return createNativeAllocationAdmission({pool:o.pool,allocationJson,qualification:record?.qualification??config.qualification,grantIntents:record.grantIntents,binding,now,limits});};
 /** Existing admission owner per target binding; the next-run owner calls its `revoke` with the retired task ARN. */
 async function admissionForBinding({binding,record}){const r=data(own(record,['state','original','grantIntents','resource'],['qualification','allocationSha256','taskRequestSha256','allocationKey']));return admissionFor(binding,r);}
 /** Source retirement facade for the issuance owner: the allocation record read for a source is remembered by task ARN so that the
  * revocation goes through the admission of that exact source binding. */
 const sources=new Map();
 const sourceOwners={allocations:{async read(query,check){const saved=await o.store.allocations.read(query,check);if(saved?.record?.resource?.taskArn)sources.set(saved.record.resource.taskArn,{binding:query.binding,record:saved.record});return saved;}},
  admission:{async revoke({taskArn,signal}){const s=sources.get(taskArn);if(!s)fail('SOURCE_UNKNOWN');return admissionFor(s.binding,s.record).revoke({taskArn,signal});}}};
 /** Trusted fact producer: the reviewed static configuration retargeted to the intent's binding and the issued grant, bound to the
  * current durable run record (binding, versions, policy revision) when one exists; a later run must have one. The per-entry
  * transport contract is part of the facts. */
 const facts={async compile({intent,issuance,signal}){const c=structuredClone(config),check=()=>{if(signal?.aborted)fail('CANCELLED');};
  const approvedReads=c.approvedReads===undefined?undefined:assertNativeReadConfiguration(c.approvedReads),operations=[...new Set([...c.operations,...(approvedReads===undefined?[]:nativeReadOperations)])];
  const saved=await o.store.readOptional(intent.binding,{},check);
  if(saved){if(hash(saved.run.binding)!==hash(intent.binding)||hash(saved.run.versions)!==hash(c.runtime.versions)||saved.run.policyRevision!==c.qualification.policyRevision)fail('RUN_RECORD_MISMATCH');}
  else if(intent.binding.writerFence>1)fail('RUN_RECORD_REQUIRED');
  if(intent.binding.conversationId!==configuredBinding.conversationId&&!readInitial)fail('INITIAL_BINDING_UNAVAILABLE');
  if(intent.binding.writerFence===1&&hash(intent.binding)!==hash(configuredBinding)){const admitted=await checkedInitial(intent.binding,check);if(intent.expiresAtMs!==admitted.expiresAtMs||!saved||!exactInitialScopes(saved.run.scopes,intent.binding,admitted.policyRevision))fail('INITIAL_EXPIRY_MISMATCH');}
  if(approvedReads!==undefined&&(!saved||hash(saved.request)!==intent.requestSha256))fail('RUN_REQUEST_MISMATCH');
  const model=await issueRunModelGrant({owner:o.modelGrants,intent,taskGrant:issuance,controlSha256:controlDigest,now,signal});
  return {runtime:{...c.runtime,binding:intent.binding,deadlineMs:intent.expiresAtMs,proxyCredential:model.proxyCredential},plan:c.plan,preparationIntent:intent.binding.conversationId===configuredBinding.conversationId?c.preparationIntent:retargetPreparation(intent.binding,saved.run.scopes),allocationJson:retarget(intent.binding),qualification:c.qualification,grantIntents:[{grantId:issuance.grantId,capabilitySha256:issuance.capabilitySha256,expiresAtMs:intent.expiresAtMs},model.grantIntent],grantId:issuance.grantId,operations,...(approvedReads===undefined?{}:{approvedReads}),taskRequest:c.taskRequest,containerName:c.containerName,controlCapabilitySha256:controlDigest,transport:{origin:c.taskOrigin,http:c.taskHttp}};}};
 const issuer=createPreparedRunIssuer({store:o.issuanceStore,authority:o.capabilityAuthority,now,maxRequestMs:limits.maxRequestMs});
 const runIssuance=createPreparedRunIssuance({issuer,facts,sourceOwners,now,maxRequestMs:limits.maxRequestMs});
 const prepareOriginal=createOriginalRunPreparation({binding:config.runtime.binding,expiresAtMs:config.runtime.deadlineMs,store:o.store,issuer,runIssuance,now,maxRequestMs:limits.maxRequestMs});
 const prepareInitial=readInitial?async value=>{const {binding,signal}=own(value,['binding'],['signal']);nativeSignal(signal);const life=createOperationLifetime({now,signal,deadlineMs:now()+limits.maxRequestMs,errorFactory:()=>Object.assign(Error('PREPARED_RUN_BINDINGS_INITIAL_UNKNOWN'),{code:'PREPARED_RUN_BINDINGS_INITIAL_UNKNOWN'})});try{
  const b=data(binding),admitted=await life.run(()=>checkedInitial(b,life.check));life.limitDeadline(admitted.expiresAtMs);
  const issued=await life.run(signal=>createOriginalRunPreparation({binding:b,expiresAtMs:admitted.expiresAtMs,store:o.store,issuer,runIssuance,now,maxRequestMs:limits.maxRequestMs})({signal}));
  const current=await life.run(()=>checkedInitial(b,life.check));if(hash(current)!==hash(admitted))fail('INITIAL_BINDING_CHANGED');return issued;
 }finally{life.close();}}:undefined;
 /** Rebuild only the canonical allocator's stop from the immutable allocation and issuance rows. The model credential is not read,
  * and neither an issuance nor a task is created. An expired admission remains usable for cleanup, never fresh execution. */
 const retireInitial=readInitial?async value=>{const {binding,client,signal}=own(value,['binding','client'],['signal']);nativeSignal(signal);const life=createOperationLifetime({now,signal,deadlineMs:now()+limits.maxRequestMs,errorFactory:()=>Object.assign(Error('PREPARED_RUN_BINDINGS_INITIAL_STOP_UNKNOWN'),{code:'PREPARED_RUN_BINDINGS_INITIAL_STOP_UNKNOWN'})});try{
  const b=data(binding),{admission:admitted,saved}=await life.run(()=>initialRecord(b,life.check,true)),key={binding:b,allocationKey:hash(b)};
  const allocationSaved=await life.run(()=>o.store.allocations.read(key,life.check));life.check();const record=allocationSaved?.record;
  if(!record||record.state==='FORECLOSED'||hash(record.original?.binding)!==hash(b)||record.original.expiresAtMs!==admitted.expiresAtMs||hash(record.original.versions)!==hash(admitted.versions)||hash(record.qualification)!==hash(config.qualification)||!Array.isArray(record.grantIntents))fail('INITIAL_STOP_REFUSED');
  const issued=await life.run(()=>o.issuanceStore.read({issuanceKey:key.allocationKey}));life.check();
  if(issued?.state!=='ISSUED'||issued.issuanceKey!==key.allocationKey||hash(issued.binding)!==hash(b)||issued.expiresAtMs!==admitted.expiresAtMs||issued.requestSha256!==hash(saved.request)||typeof issued.factsSha256!=='string'||!/^[a-f0-9]{64}$/u.test(issued.factsSha256)||!record.grantIntents.some(g=>g.grantId===issued.grantId&&g.capabilitySha256===issued.capabilitySha256&&g.expiresAtMs===admitted.expiresAtMs))fail('INITIAL_STOP_REFUSED');
  // The issuer's immutable facts digest commits to the original plan and all dynamic grants without reopening a model credential.
  const approvedReads=config.approvedReads===undefined?undefined:assertNativeReadConfiguration(config.approvedReads),operations=[...new Set([...config.operations,...(approvedReads===undefined?[]:nativeReadOperations)])];
  const issuedFacts={original:record.original,allocationSha256:record.allocationSha256,taskRequestSha256:record.taskRequestSha256,qualification:record.qualification,grantIntents:record.grantIntents,grantId:issued.grantId,operations,controlCapabilitySha256:controlDigest,transport:{origin:config.taskOrigin,http:config.taskHttp},...(approvedReads===undefined?{}:{approvedReads})};
  if(hash(issuedFacts)!==issued.factsSha256)fail('INITIAL_STOP_FACTS_DRIFT');
  const allocationJson=retarget(b),admission=admissionFor(b,record),allocator=createNativeTaskAllocator({journal:o.store.allocations,authority:{async verify(){fail('INITIAL_STOP_REFUSED');}},admission,client,original:record.original,taskRequest:config.taskRequest,qualification:config.qualification,grantIntents:record.grantIntents,allocationSha256:hash(allocation(allocationJson)),containerName:config.containerName,enabled:true,now,maxRequestMs:limits.maxRequestMs});
  const {state:_,resource:__,...persistedIntent}=record;if(hash(persistedIntent)!==hash(allocator.intent))fail('INITIAL_STOP_CONFLICT');life.check();if(record.state==='RETIRED'&&record.resource?.physicalStopProven===true)return {physicalStopProven:true};return await life.run(()=>allocator.stop());
 }finally{life.close();}}:undefined;
 function proposeInitialExpiry({signal}={}){nativeSignal(signal);if(signal?.aborted)fail('CANCELLED');const expiresAtMs=Math.min(now()+config.multiRun.runWindowMs,scheduleExpiresAtMs);if(expiresAtMs<=now())fail('WINDOW_EXPIRED');return expiresAtMs;}
 /** The run's expiry. An issuance already recorded durably for this binding keeps its original expiry across process recreation
  * (the window is never recomputed from a later clock); otherwise the reviewed window, never beyond the allocation schedule, never
  * earlier than now. */
 async function issuanceIntent({binding,source,request,signal}){own(data({binding,source,request}),['binding','source','request']);
  const issuanceKey=hash(binding),existing=await o.issuanceStore.read({issuanceKey,signal});
  if(existing){if(existing.issuanceKey!==issuanceKey||hash(existing.binding)!==issuanceKey||!Number.isSafeInteger(existing.expiresAtMs))fail('ISSUANCE_RECORD_REFUSED');return {expiresAtMs:existing.expiresAtMs,persisted:true};}
  return {expiresAtMs:proposeInitialExpiry({signal}),persisted:false};}
 return Object.freeze({runIssuance,issuanceIntent,admissionForBinding,issuer,facts,prepareOriginal,...(prepareInitial?{prepareInitial,retireInitial,proposeInitialExpiry}:{}),runWindowMs:config.multiRun.runWindowMs,controlCapabilitySha256:controlDigest,configurationSha256});
}
