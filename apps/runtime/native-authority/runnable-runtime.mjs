/** Compose original allocation/admission and canonical execution without allocating on import. */
import {types} from 'node:util';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
import {createNativeAllocationAdmission} from '../../gateway/budget/native-allocation-admission.mjs';
import {createPreallocationAuthority} from './preallocation-authority.mjs';
import {createNativeTaskAllocator} from './task-allocator.mjs';
import {createAllocatedNativeRuntime} from './allocated-runtime.mjs';
import {compileNativeBrokerPlan,createNativeBrokerStack} from './broker-stack.mjs';
import {createAdmittedSessionSupervisor} from './admitted-supervisor.mjs';
import {createAdmittedEcsTaskFactory} from './ecs-task-factory.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {sdkSessionOperations} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {capabilityDigest,compileNativeTaskAccess,matchesCapability} from './task-verifier.mjs';
import {executionFault} from './execution-broker.mjs';
export function createRunnableNativeRuntime(configuration){
 const c=own(configuration,['pool','client','identity','allocationJson','qualification','grantIntents','grantId','operations','taskCapability','controlCapabilitySha256','runtime','plan','launchConfiguration','taskRequest','containerName','limits','nativeFactory'],['continuationObjects','enabled','now']);
 const now=c.now??Date.now,enabled=c.enabled??false,compiled=compileNativeBrokerPlan({runtime:c.runtime,plan:c.plan,launchConfiguration:c.launchConfiguration}),original=compiled.original,limits=data(c.limits),taskDigest=capabilityDigest(c.taskCapability),intents=data(c.grantIntents),ownerPlan=data(c.plan),operations=data(c.operations),rawIdentity=own(c.identity,['origin','credential','commandContext','fetchImpl']),identity={...rawIdentity,commandContext:data(rawIdentity.commandContext)},objects=c.continuationObjects?{get:storageMethod(c.continuationObjects,'get')}:undefined;compileNativeTaskAccess({identityCredential:identity.credential,taskCapabilitySha256:taskDigest,operations});
 if(!matchesCapability(c.taskCapability,taskDigest)||!operations.includes('load')||sdkSessionOperations.some(op=>!operations.includes('runner/session/'+op))||typeof c.nativeFactory!=='function'||types.isProxy(c.nativeFactory)||types.isAsyncFunction(c.nativeFactory)||!intents.some(i=>i.grantId===c.grantId&&i.capabilitySha256===taskDigest)||intents.some(i=>i.capabilitySha256===c.controlCapabilitySha256)||intents.some(i=>i.expiresAtMs<original.expiresAtMs))throw executionFault('STACK_CONFIGURATION');
 const store=createPostgresConversationStore({pool:c.pool});
 const authority=createPreallocationAuthority({store,identity,binding:original.binding,expiresAtMs:original.expiresAtMs,limits,enabled,now});
 const admission=createNativeAllocationAdmission({pool:c.pool,allocationJson:c.allocationJson,qualification:c.qualification,grantIntents:intents,binding:original.binding,limits,now});
 const allocator=createNativeTaskAllocator({journal:store.allocations,authority,admission,client:c.client,original,taskRequest:c.taskRequest,qualification:c.qualification,grantIntents:intents,allocationSha256:hash(JSON.parse(c.allocationJson)),containerName:c.containerName,enabled,now,maxRequestMs:limits.maxRequestMs});
 const assembled=createAllocatedNativeRuntime({allocator,original,controlCapabilitySha256:c.controlCapabilitySha256,taskCapabilitySha256:taskDigest,enabled,now,maxRequestMs:limits.maxRequestMs,
  assemble(admitted){
   const {grantFactsJsons,...metadata}=admitted.resource;
   const supervisor=createAdmittedSessionSupervisor({pool:c.pool,allocationJson:c.allocationJson,grantFactsJsons,grantId:c.grantId,identity,operations,callerCapabilitySha256:c.controlCapabilitySha256,launchConfiguration:compiled.launchConfiguration,limits,enabled,now});
   let native,closeNative;
   try{native=c.nativeFactory({original,launchConfiguration:compiled.launchConfiguration,metadata});if(types.isPromise(native)){void Promise.prototype.then.call(native,late=>{try{return storageMethod(late,'close')();}catch{}},()=>{}).catch(()=>{});throw executionFault('STACK_CONFIGURATION');}closeNative=storageMethod(native,'close');
    const tasksFactory=createAdmittedEcsTaskFactory({client:c.client,native,metadata,allocationJson:c.allocationJson,grantFactsJsons,grantId:c.grantId,enabled,now,maxRequestMs:limits.maxRequestMs});
    const stack=createNativeBrokerStack({pool:c.pool,supervisor,runtime:compiled.runtime,plan:ownerPlan,launchConfiguration:compiled.launchConfiguration,taskCapability:c.taskCapability,controlCapabilitySha256:c.controlCapabilitySha256,tasksFactory,enabled,now,maxRequestMs:limits.maxRequestMs,...(objects?{continuationObjects:objects}:{})});
    if(hash(stack.original)!==hash(original))throw executionFault('STACK_CONFIGURATION');return {...stack,async close(){try{await stack.close();}finally{await closeNative();}}};
   }catch(error){void supervisor.close().catch(()=>{});if(closeNative)void Promise.resolve().then(closeNative).catch(()=>{});throw error;}
  }});
 return Object.freeze({...assembled,store,allocator,original});
}
