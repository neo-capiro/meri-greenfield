/** Control composition of existing task admission, run ownership and SDK SessionStore APIs. */
import {assertHistoricalStopFacts,matchHistoricalStopAllocation} from './historical-stop-facts.mjs';
import {types} from 'node:util';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
import {createNativeAllocationAdmission} from '../../gateway/budget/native-allocation-admission.mjs';
import {createPreallocationAuthority} from './preallocation-authority.mjs';
import {createNativeTaskAllocator,compileNativeTaskPlan} from './task-allocator.mjs';
import {createEcsPreparedTaskProof} from './ecs-prepared-task-proof.mjs';
import {createAdmittedTaskAuthority} from './admitted-task-authority.mjs';
import {createNativeContinuationRuntime} from './continuation-runtime.mjs';
import {createDurableSdkSessionOwner} from './session-owner.mjs';
import {createNativeSdkSessionApplication} from './session-http.mjs';
import {createNativeExecutionApplication} from './execution-http.mjs';
import {executionFault} from './remote-task-boundary.mjs';
import {createPreparedNativeRuntime} from './prepared-runtime.mjs';
import {createNativePreparationApplication} from './preparation-http.mjs';
import {sdkSessionOperations} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {capabilityDigest,matchesCapability,compileNativeTaskAccess} from './task-verifier.mjs';
import {exactOriginal} from './remote-task-boundary.mjs';
import {createPreparedNativeReads,captureReadRuntimeOptions} from './prepared-reads.mjs';
export function createRemoteNativeController(configuration){
 const {runtimeConfiguration:r,transport}=own(configuration,['runtimeConfiguration','transport'],['objects']);
 const pinned=compileNativeTaskPlan({runtime:r.runtime,plan:r.plan,preparationIntent:r.preparationIntent});exactOriginal(transport.original,pinned.original);if(!matchesCapability(transport.credential,r.controlCapabilitySha256))throw Error('REMOTE_CONTROL_BINDING_REFUSED');
 const now=r.now??Date.now,enabled=r.enabled??false,maxRequestMs=r.maxRequestMs??3000,taskDigest=capabilityDigest(r.taskCapability);
 // Native next turns read the reserved SDK session under target authority; legacy workspace restoration is not installed.
 const continuation=r.continuation??createNativeContinuationRuntime({store:r.store,verifier:r.supervisor.taskVerifier,taskCapability:r.taskCapability,now});
 const prepared=createPreparedNativeRuntime({store:r.store,allocator:r.allocator,supervisor:r.supervisor,runtime:r.runtime,plan:r.plan,preparationIntent:r.preparationIntent,taskCapability:r.taskCapability,verifyTask:r.verifyTask,continuation,enabled,now,maxRequestMs});
 const preparationApplication=createNativePreparationApplication({owner:prepared.preparationAuthorizer,taskCapabilitySha256:taskDigest,enabled,now,maxRequestMs});
 const sdkSessionOwner=createDurableSdkSessionOwner({admission:r.supervisor.admission,authority:r.supervisor.taskVerifier,enabled,now,maxRequestMs});
 const sessions=createNativeSdkSessionApplication({owner:sdkSessionOwner,snapshot:continuation,now,maxRequestMs});
 const reads=createPreparedNativeReads({binding:pinned.original.binding,...(r.approvedReads===undefined?{}:{approvedReads:r.approvedReads}),...(r.readCurrentEntry===undefined?{}:{allocationJson:r.allocationJson,grantFactsJsons:r.grantFactsJsons,grantId:r.grantId,taskArn:r.taskArn,issuanceFactsSha256:r.issuanceFactsSha256,runRequestSha256:r.runRequestSha256,scopes:r.scopes,currentOwner:r.supervisor.admission,readCurrentEntry:r.readCurrentEntry,expiresAtMs:pinned.original.expiresAtMs}),...(r.generalReads?{gateway:r.generalReads}:{}),...(r.createReadsRuntime?{createReadsRuntime:r.createReadsRuntime,taskCapability:r.taskCapability}:{}),enabled:enabled&&r.sourceEnabled===true,now,...(r.supervisor.signal?{signal:r.supervisor.signal}:{})});
 const execution=createNativeExecutionApplication({runtime:prepared.runtime,taskCapabilitySha256:taskDigest,controlCapabilitySha256:r.controlCapabilitySha256,enabled,now,maxRequestMs});
 const application={async handle(request){const path=new URL(request.url).pathname;if(path.startsWith('/v1/runner/reads/'))return reads.application.handle(request);for(const app of [preparationApplication,execution]){const reply=await app.handle(request);if(reply!==null)return reply;}if(path.startsWith('/v1/runner/session/'))return sessions.handle(request);return null;}};
 return Object.freeze({prepared,application,readsOwner:reads.owner,continuation,runtime:prepared.runtime,productPorts:Object.freeze({sdkSessionOwner,sdkSessionSnapshot:continuation}),allocate:prepared.prepareAllocation,close:prepared.close});
}
/** The canonical original allocator and its budget admission over exact allocation facts; shared by allocation and stop-only retirement. */
function originalAllocator({store,pool,client,original,allocationJson,qualification,grantIntents,taskRequest,containerName,limits,authority,admission,enabled,now,retirementFacts}){
 const owner=admission??createNativeAllocationAdmission({pool,allocationJson,qualification,grantIntents,binding:original.binding,limits,now});
 return {admission:owner,allocator:createNativeTaskAllocator({journal:store.allocations,authority,admission:owner,client,original,taskRequest,qualification,grantIntents,allocationSha256:hash(JSON.parse(allocationJson)),containerName,enabled,now,maxRequestMs:limits.maxRequestMs,...(retirementFacts===undefined?{}:{retirementFacts})})};
}
/** Stop-only retirement of an original this process holds no controller for (for example after a hard control restart), rebuilt from the
 * exact durable allocation facts. It exposes only the canonical allocator's stop: grant revocation, ECS containment, then RETIRED with the
 * physical-stop proof. It never allocates, dispatches, resumes or releases: allocate is not exposed and its pre-allocation authority
 * refuses. A journal record that differs from the rebuilt intent is refused; an uncertain step stays UNKNOWN (nothing is recorded). Each
 * stop is a fresh bounded attempt over durable state, so a later reconciliation can resume after an earlier one gave up. */
export function createOriginalRetirement(configuration){
 const historical=configuration?.retirementFacts!==undefined;
 const c=own(configuration,['store','pool','client','limits',...(historical?['retirementFacts']:['allocationJson','qualification','grantIntents','runtime','plan','preparationIntent','taskRequest','containerName'])],['admission','now']),now=c.now??Date.now;
 const facts=historical?assertHistoricalStopFacts(c.retirementFacts):c;
 if(historical&&facts.schemaVersion!==2)throw executionFault('ALLOCATION_REPLAY_REFUSED');
 const original=historical?facts.original:compileNativeTaskPlan({runtime:c.runtime,plan:c.plan,preparationIntent:c.preparationIntent}).original,key={binding:original.binding,allocationKey:original.executionKey},read=storageMethod(c.store.allocations,'read');
 const {allocator}=originalAllocator({store:c.store,pool:c.pool,client:c.client,original,allocationJson:facts.allocationJson,qualification:facts.qualification,grantIntents:facts.grantIntents,taskRequest:facts.taskRequest,containerName:facts.containerName,limits:c.limits,authority:{async verify(){throw executionFault('ALLOCATION_REFUSED');}},...(historical?{retirementFacts:facts}:{}),...(c.admission?{admission:c.admission}:{}),enabled:true,now});
 async function stop(){const record=(await read(key,()=>{})).record;if(!record||record.state==='FORECLOSED')throw executionFault('ALLOCATION_UNKNOWN');
  if(historical)matchHistoricalStopAllocation(facts,record);
  if(hash(Object.fromEntries(Object.entries(record).filter(([k])=>!['state','resource'].includes(k))))!==hash(allocator.intent))throw executionFault('ALLOCATION_REPLAY_REFUSED');
  if(record.state==='RETIRED'&&record.resource?.physicalStopProven===true)return {physicalStopProven:true};return allocator.stop();}
 return Object.freeze({original,stop});
}
/** Concrete controller entry: durable RunTask/admission, then parked task authority. */
export async function allocateRemoteNativeController(configuration){
 const c=own(configuration,['pool','client','identity','allocationJson','qualification','grantIntents','grantId','operations','taskCapability','controlCapabilitySha256','runtime','plan','preparationIntent','taskRequest','containerName','limits','transportFactory'],['verifyTask','objects','continuation','continuationObjects','enabled','now','approvedReads','readCurrentEntry','runRequestSha256','issuanceFactsSha256','scopes','generalReads','createReadsRuntime','sourceEnabled','retirementFacts']);
 captureReadRuntimeOptions(Object.fromEntries(['createReadsRuntime','generalReads'].filter(k=>c[k]!==undefined).map(k=>[k,c[k]])));
 const now=c.now??Date.now,enabled=c.enabled??false,compiled=compileNativeTaskPlan({runtime:c.runtime,plan:c.plan,preparationIntent:c.preparationIntent}),{original}=compiled,store=createPostgresConversationStore({pool:c.pool});
 const identity=own(c.identity,['origin','credential','commandContext','fetchImpl']),intents=data(c.grantIntents),operations=compileNativeTaskAccess({identityCredential:identity.credential,taskCapabilitySha256:capabilityDigest(c.taskCapability),operations:c.operations});
 if(!operations.includes('load')||sdkSessionOperations.some(op=>!operations.includes('runner/session/'+op))||!intents.some(i=>i.grantId===c.grantId&&i.capabilitySha256===capabilityDigest(c.taskCapability))||intents.some(i=>i.capabilitySha256===c.controlCapabilitySha256||i.expiresAtMs<original.expiresAtMs)||typeof c.controlCapabilitySha256!=='string'||! /^[a-f0-9]{64}$/u.test(c.controlCapabilitySha256)||typeof c.transportFactory!=='function'||types.isProxy(c.transportFactory)||types.isAsyncFunction(c.transportFactory)||c.verifyTask!==undefined&&(typeof c.verifyTask!=='function'||types.isProxy(c.verifyTask)))throw executionFault('PREPARATION_CONFIGURATION');
 if(c.objects){storageMethod(c.objects,'get');storageMethod(c.objects,'put');}if(c.continuationObjects)storageMethod(c.continuationObjects,'get');if(c.continuation){storageMethod(c.continuation,'prepare');storageMethod(c.continuation,'readSnapshot');}
 const authority=createPreallocationAuthority({store,identity:c.identity,binding:original.binding,expiresAtMs:original.expiresAtMs,limits:c.limits,enabled,now});
 const {admission,allocator}=originalAllocator({store,pool:c.pool,client:c.client,original,allocationJson:c.allocationJson,qualification:c.qualification,grantIntents:c.grantIntents,taskRequest:c.taskRequest,containerName:c.containerName,limits:c.limits,authority,enabled,now,...(c.retirementFacts===undefined?{}:{retirementFacts:c.retirementFacts})});let supervisor,controller,mayOwnResource=false;
 try{
  const saved=await store.allocations.read({binding:original.binding,allocationKey:original.executionKey},()=>{});let admitted,recovered=false;
  if(saved.record?.state==='ADMITTED'){
   if(hash(Object.fromEntries(Object.entries(saved.record).filter(([k])=>!['state','resource'].includes(k))))!==hash(allocator.intent))throw executionFault('ALLOCATION_REPLAY_REFUSED');mayOwnResource=true;const current=await admission.read({taskArn:saved.record.resource.taskArn});if(current.state!=='ADMITTED'||hash(current.grantFactsJsons)!==hash(saved.record.resource.grantFactsJsons))throw executionFault('ALLOCATION_REPLAY_REFUSED');admitted={original,resource:saved.record.resource,currentAllocationJson:current.currentAllocationJson};recovered=true;
  }else {mayOwnResource=true;admitted=await allocator.allocate();}
  supervisor=createAdmittedTaskAuthority({pool:c.pool,allocationJson:c.allocationJson,grantFactsJsons:admitted.resource.grantFactsJsons,grantId:c.grantId,identity:c.identity,operations:c.operations,callerCapabilitySha256:c.controlCapabilitySha256,binding:original.binding,expiresAtMs:original.expiresAtMs,limits:c.limits,enabled,now});
  const verifyTask=c.verifyTask??createEcsPreparedTaskProof({client:c.client,original,metadata:admitted.resource,imageSha256:compiled.preparationIntent.imageSha256,runnerSha256:compiled.preparationIntent.runnerSha256,now,maxRequestMs:c.limits.maxRequestMs}).verifyTask;
  const transport=c.transportFactory({original,resource:admitted.resource});if(types.isPromise(transport)){Promise.prototype.then.call(transport,late=>{try{return storageMethod(late,'close')();}catch{}},()=>{}).catch(()=>{});throw executionFault('PREPARATION_UNKNOWN');}
  // The canonical READS verifier is created inside prepared-reads, after this actual admission. Only CONTROL sees its task cap.
  const createReadsRuntime=c.createReadsRuntime===undefined?undefined:tuple=>c.createReadsRuntime(Object.freeze({pool:c.pool,binding:original.binding,original,allocationJson:c.allocationJson,grantFactsJsons:Object.freeze([...admitted.resource.grantFactsJsons]),grantId:c.grantId,taskArn:admitted.resource.taskArn,issuanceFactsSha256:c.issuanceFactsSha256,runRequestSha256:c.runRequestSha256,scopes:data(c.scopes),readCurrentEntry:c.readCurrentEntry,currentOwner:supervisor.admission,sourceEnabled:c.sourceEnabled===true,limits:data(c.limits),now,...(supervisor.signal?{signal:supervisor.signal}:{}),...tuple}));
  controller=createRemoteNativeController({runtimeConfiguration:{pool:c.pool,store,allocator:recovered?{allocate:async()=>admitted,stop:()=>allocator.stop()}:allocator,supervisor,runtime:c.runtime,plan:c.plan,preparationIntent:c.preparationIntent,taskCapability:c.taskCapability,controlCapabilitySha256:c.controlCapabilitySha256,verifyTask,enabled,now,maxRequestMs:c.limits.maxRequestMs,...Object.fromEntries(['approvedReads','readCurrentEntry','runRequestSha256','issuanceFactsSha256','scopes','generalReads','sourceEnabled'].filter(k=>c[k]!==undefined).map(k=>[k,c[k]])),...(createReadsRuntime?{createReadsRuntime}:{}),allocationJson:c.allocationJson,grantFactsJsons:admitted.resource.grantFactsJsons,grantId:c.grantId,taskArn:admitted.resource.taskArn,...(c.continuation?{continuation:c.continuation}:{}),...(c.continuationObjects?{continuationObjects:c.continuationObjects}:{})},transport,...(c.objects?{objects:c.objects}:{})});await controller.allocate();return Object.freeze({...controller,supervisor,resource:admitted.resource,observe:allocator.observe,async close(){try{await controller.close();}finally{await supervisor.close();}}});
 }catch(error){try{await controller?.close();}finally{try{await supervisor?.close();}finally{if(mayOwnResource)await allocator.stop();}}throw error;}
}
