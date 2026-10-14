/** Runnable controller/task/runner composition; cloud clients and credentials stay injected. */
import {types} from 'node:util';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
import {createNativeAllocationAdmission} from '../../gateway/budget/native-allocation-admission.mjs';
import {createPreallocationAuthority} from './preallocation-authority.mjs';
import {createNativeTaskAllocator} from './task-allocator.mjs';
import {createEcsPreparedTaskProof} from './ecs-prepared-task-proof.mjs';
import {createAdmittedTaskAuthority} from './admitted-task-authority.mjs';
import {compileNativeBrokerPlan} from './broker-stack.mjs';
import {createNativeContinuationRuntime} from './continuation-runtime.mjs';
import {createNativeCheckpointRestorer} from './native-restorer.mjs';
import {createDurableSdkSessionOwner} from './session-owner.mjs';
import {createNativeSdkSessionApplication} from './session-http.mjs';
import {createNativeExecutionApplication} from './execution-http.mjs';
import {createNativeCheckpointApplication} from './checkpoint-http.mjs';
import {executionFault,assertNativeExecution} from './execution-broker.mjs';
import {createPreparedNativeRuntime} from './prepared-runtime.mjs';
import {createNativePreparationApplication,createNativePreparationClient} from './preparation-http.mjs';
import {createRemoteNativeTaskApplication} from './remote-task-http.mjs';
import {createRemoteNativeTaskController} from './remote-task-client.mjs';
import {createIndependentNativeTask} from './independent-task.mjs';
import {createSupervisorWorkspace} from './supervisor-workspace.mjs';
import {createTaskCheckpointSource} from './task-checkpoint-source.mjs';
import {createNativeCheckpointCapture} from './checkpoint-capture.mjs';
import {createNativeCompletionCapture} from './completion-capture.mjs';
import {createRemoteRunnerQuery} from './runner-query.mjs';
import {sdkSessionOperations} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {capabilityDigest,matchesCapability,compileNativeTaskAccess} from './task-verifier.mjs';
import {exactOriginal} from './remote-task-boundary.mjs';
import {compileNativePreparationIntent,matchPreparedDescriptorShape} from './preparation-intent.mjs';
export function createRemoteNativeController(configuration){
 const {runtimeConfiguration,transport,objects}=own(configuration,['runtimeConfiguration','transport'],['objects']);
 const pinned=compileNativeBrokerPlan({runtime:runtimeConfiguration.runtime,plan:runtimeConfiguration.plan,preparationIntent:runtimeConfiguration.preparationIntent});exactOriginal(transport.original,pinned.original);if(!matchesCapability(transport.credential,runtimeConfiguration.controlCapabilitySha256))throw Error('REMOTE_CONTROL_BINDING_REFUSED');
 const remote=createRemoteNativeTaskController(transport),r={...runtimeConfiguration,...(objects&&!runtimeConfiguration.continuationObjects?{continuationObjects:objects}:{})},now=r.now??Date.now,enabled=r.enabled??false,maxRequestMs=r.maxRequestMs??3000,taskDigest=capabilityDigest(r.taskCapability);
 const restorer=r.continuationObjects?createNativeCheckpointRestorer({journal:r.store.restorations,objects:r.continuationObjects,workspace:r.preparationIntent.workspace,workspaceOwner:remote.workspace,expiresAtMs:pinned.original.expiresAtMs,now}):undefined;
 const continuation=r.continuation??createNativeContinuationRuntime({store:r.store,verifier:r.supervisor.taskVerifier,taskCapability:r.taskCapability,now,...(restorer?{restorer}:{})}),prepared=createPreparedNativeRuntime({...r,continuation,tasksFactory:()=>remote});
 const preparationApplication=createNativePreparationApplication({owner:prepared.preparationAuthorizer,taskCapabilitySha256:capabilityDigest(runtimeConfiguration.taskCapability),enabled:runtimeConfiguration.enabled??false,now:runtimeConfiguration.now??Date.now,maxRequestMs:runtimeConfiguration.maxRequestMs??3000});
 const checkpoint=objects?createNativeCheckpointCapture({store:runtimeConfiguration.store,objects,authority:runtimeConfiguration.supervisor.taskVerifier,taskCapability:runtimeConfiguration.taskCapability,original:prepared.original,taskCapture:remote,enabled:runtimeConfiguration.enabled??false,now:runtimeConfiguration.now??Date.now,maxRequestMs:runtimeConfiguration.maxRequestMs??3000}):undefined;
 const sessions=createNativeSdkSessionApplication({owner:createDurableSdkSessionOwner({admission:r.supervisor.admission,authority:r.supervisor.taskVerifier,registration:remote.registration,enabled,now,maxRequestMs}),snapshot:continuation,now,maxRequestMs});
 const completion=objects&&r.store.completions?createNativeCompletionCapture({store:r.store,objects,authority:r.supervisor.taskVerifier,taskCapability:r.taskCapability,original:prepared.original,taskCapture:remote,enabled,now,maxRequestMs}):undefined;
 const execution=createNativeExecutionApplication({broker:{start:value=>{if(!prepared.stack)throw executionFault('PREPARATION_REQUIRED');return prepared.stack.broker.start(value);},poll:value=>{if(!prepared.stack)throw executionFault('PREPARATION_REQUIRED');return prepared.stack.broker.poll(value);}},runtime:prepared.runtime,taskCapabilitySha256:taskDigest,controlCapabilitySha256:r.controlCapabilitySha256,enabled,now,maxRequestMs}),checkpoints=checkpoint?createNativeCheckpointApplication({owner:checkpoint,...(completion?{completion}:{}),taskCapabilitySha256:taskDigest,enabled,now,maxRequestMs}):null;
 const application={async handle(request){for(const app of [preparationApplication,execution,checkpoints])if(app){const reply=await app.handle(request);if(reply!==null)return reply;}if(new URL(request.url).pathname.startsWith('/v1/runner/session/'))return sessions.handle(request);return null;}};
 async function reconcile({signal}={}){const value=own(await remote.bindingRead({signal}),['original','taskArn','configDirectory','descriptorSha256','configTreeSha256','preparationId','native','configurationReadback']);exactOriginal(value.original,pinned.original);const native=assertNativeExecution(value.native,pinned.original);if(value.configurationReadback!==!native.physicalStopProven)throw executionFault('PREPARATION_REFUSED');const admitted=await prepared.prepareAllocation({signal});if(value.taskArn!==admitted.resource.taskArn)throw executionFault('PREPARATION_REFUSED');await prepared.reconcile({original:value.original,configDirectory:value.configDirectory,descriptorSha256:value.descriptorSha256,configTreeSha256:value.configTreeSha256,preparationId:value.preparationId,signal});return {original:pinned.original,taskArn:value.taskArn};}
 return Object.freeze({prepared,remote,checkpoint,application,continuation,restorer,runtime:prepared.runtime,reconcile,allocate:prepared.prepareAllocation,async close(){try{await prepared.close();}finally{await remote.close();}}});
}
export function createRemoteNativeWorker(configuration){
 const c=own(configuration,['original','preparationIntent','controlCapabilitySha256','taskCapabilitySha256','taskArn','native','processTransport'],['capture','session','enabled','now','limits']);
 exactOriginal(c.processTransport.original,c.original);if(!matchesCapability(c.processTransport.credential,c.taskCapabilitySha256))throw Error('REMOTE_TASK_BINDING_REFUSED');
 let nativeTask,activeQuery;const remoteQuery=createRemoteRunnerQuery({...c.processTransport,sdkOptionsSha256:c.preparationIntent.sdkOptionsSha256}),query=input=>{activeQuery=remoteQuery(input);return activeQuery;};
 const i=compileNativePreparationIntent(c.preparationIntent),workspace=createSupervisorWorkspace({binding:c.original.binding,workspace:i.workspace,expiresAtMs:c.original.expiresAtMs,now:c.now??Date.now});
 if(c.capture&&c.session)throw Error('REMOTE_CAPTURE_CONFIGURATION');
 const capture=c.session?createTaskCheckpointSource({original:c.original,workspace:i.workspace,session:c.session,native:{close:()=>nativeTask.close(),inspect:value=>nativeTask.inspect(value)},closeQuery:()=>activeQuery.close(),now:c.now??Date.now,maxRequestMs:c.limits?.maxRequestMs??8000}):c.capture;
 const application=createRemoteNativeTaskApplication({original:c.original,controlCapabilitySha256:c.controlCapabilitySha256,taskCapabilitySha256:c.taskCapabilitySha256,taskArn:c.taskArn,descriptorPolicy:{workspace:i.workspace,command:i.launchTemplate.command,configParentDirectory:i.configParentDirectory,secureStorageDirectory:i.secureStorageDirectory},preparationAuthorizer:createNativePreparationClient({native:c.native}),nativeFactory({original,descriptor}){
  // Task-side shape check only; the preparation authority verifies the exact issued credential before any launch.
  const d=matchPreparedDescriptorShape(descriptor,i),launchConfiguration={binding:original.binding,workspace:d.cwd,configDirectory:d.env.CLAUDE_CONFIG_DIR,secureStorageDirectory:i.secureStorageDirectory,versions:{sdk:original.versions.sdk,cli:original.versions.cli},expiresAtMs:original.expiresAtMs,executableSha256:i.executableSha256,launch:{command:d.command,args:d.args,env:d.env},enabled:c.enabled??false};
  nativeTask=createIndependentNativeTask({original,launchConfiguration,deferredSpawn:true});return {task:nativeTask,launchConfiguration};
 },parkedWorkspace:workspace,...(capture?{capture}:{}),enabled:c.enabled??false,now:c.now??Date.now,...(c.limits?{limits:c.limits}:{})});
 return Object.freeze({application,workspace,query,capture,close:()=>application.close()});
}

/** Concrete controller entry: durable RunTask/admission, then parked task authority. */
export async function allocateRemoteNativeController(configuration){
 const c=own(configuration,['pool','client','identity','allocationJson','qualification','grantIntents','grantId','operations','taskCapability','controlCapabilitySha256','runtime','plan','preparationIntent','taskRequest','containerName','limits','transportFactory'],['verifyTask','objects','continuation','continuationObjects','enabled','now']);
 const now=c.now??Date.now,enabled=c.enabled??false,compiled=compileNativeBrokerPlan({runtime:c.runtime,plan:c.plan,preparationIntent:c.preparationIntent}),{original}=compiled,store=createPostgresConversationStore({pool:c.pool});
 const identity=own(c.identity,['origin','credential','commandContext','fetchImpl']),intents=data(c.grantIntents),operations=compileNativeTaskAccess({identityCredential:identity.credential,taskCapabilitySha256:capabilityDigest(c.taskCapability),operations:c.operations});
 if(!operations.includes('load')||sdkSessionOperations.some(op=>!operations.includes('runner/session/'+op))||!intents.some(i=>i.grantId===c.grantId&&i.capabilitySha256===capabilityDigest(c.taskCapability))||intents.some(i=>i.capabilitySha256===c.controlCapabilitySha256||i.expiresAtMs<original.expiresAtMs)||typeof c.controlCapabilitySha256!=='string'||! /^[a-f0-9]{64}$/u.test(c.controlCapabilitySha256)||typeof c.transportFactory!=='function'||types.isProxy(c.transportFactory)||types.isAsyncFunction(c.transportFactory)||c.verifyTask!==undefined&&(typeof c.verifyTask!=='function'||types.isProxy(c.verifyTask)))throw executionFault('PREPARATION_CONFIGURATION');
 if(c.objects){storageMethod(c.objects,'get');storageMethod(c.objects,'put');}if(c.continuationObjects)storageMethod(c.continuationObjects,'get');if(c.continuation){storageMethod(c.continuation,'prepare');storageMethod(c.continuation,'readSnapshot');}
 const authority=createPreallocationAuthority({store,identity:c.identity,binding:original.binding,expiresAtMs:original.expiresAtMs,limits:c.limits,enabled,now});
 const admission=createNativeAllocationAdmission({pool:c.pool,allocationJson:c.allocationJson,qualification:c.qualification,grantIntents:c.grantIntents,binding:original.binding,limits:c.limits,now});
 const allocator=createNativeTaskAllocator({journal:store.allocations,authority,admission,client:c.client,original,taskRequest:c.taskRequest,qualification:c.qualification,grantIntents:c.grantIntents,allocationSha256:hash(JSON.parse(c.allocationJson)),containerName:c.containerName,enabled,now,maxRequestMs:c.limits.maxRequestMs});let supervisor,controller,mayOwnResource=false;
 try{
  const saved=await store.allocations.read({binding:original.binding,allocationKey:original.executionKey},()=>{});let admitted,recovered=false;
  if(saved.record?.state==='ADMITTED'&&saved.record.resource?.launchBinding?.state==='STARTED'){
   if(hash(Object.fromEntries(Object.entries(saved.record).filter(([k])=>!['state','resource'].includes(k))))!==hash(allocator.intent))throw executionFault('ALLOCATION_REPLAY_REFUSED');mayOwnResource=true;const current=await admission.read({taskArn:saved.record.resource.taskArn});if(current.state!=='ADMITTED'||hash(current.grantFactsJsons)!==hash(saved.record.resource.grantFactsJsons))throw executionFault('ALLOCATION_REPLAY_REFUSED');admitted={original,resource:saved.record.resource,currentAllocationJson:current.currentAllocationJson};recovered=true;
  }else {mayOwnResource=true;admitted=await allocator.allocate();}
  supervisor=createAdmittedTaskAuthority({pool:c.pool,allocationJson:c.allocationJson,grantFactsJsons:admitted.resource.grantFactsJsons,grantId:c.grantId,identity:c.identity,operations:c.operations,callerCapabilitySha256:c.controlCapabilitySha256,binding:original.binding,expiresAtMs:original.expiresAtMs,limits:c.limits,enabled,now});
  const verifyTask=c.verifyTask??createEcsPreparedTaskProof({client:c.client,original,metadata:admitted.resource,imageSha256:compiled.preparationIntent.imageSha256,runnerSha256:compiled.preparationIntent.runnerSha256,now,maxRequestMs:c.limits.maxRequestMs}).verifyTask;
  const transport=c.transportFactory({original,resource:admitted.resource});if(types.isPromise(transport)){Promise.prototype.then.call(transport,late=>{try{return storageMethod(late,'close')();}catch{}},()=>{}).catch(()=>{});throw executionFault('PREPARATION_UNKNOWN');}
  controller=createRemoteNativeController({runtimeConfiguration:{pool:c.pool,store,allocator:recovered?{allocate:async()=>admitted,stop:()=>allocator.stop()}:allocator,supervisor,runtime:c.runtime,plan:c.plan,preparationIntent:c.preparationIntent,taskCapability:c.taskCapability,controlCapabilitySha256:c.controlCapabilitySha256,verifyTask,enabled,now,maxRequestMs:c.limits.maxRequestMs,...(c.continuation?{continuation:c.continuation}:{}),...(c.continuationObjects?{continuationObjects:c.continuationObjects}:{})},transport,...(c.objects?{objects:c.objects}:{})});await controller.allocate();return Object.freeze({...controller,supervisor,resource:admitted.resource,async close(){try{await controller.close();}finally{await supervisor.close();}}});
 }catch(error){try{await controller?.close();}finally{try{await supervisor?.close();}finally{if(mayOwnResource)await allocator.stop();}}throw error;}
}
