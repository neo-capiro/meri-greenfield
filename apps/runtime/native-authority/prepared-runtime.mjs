/** Parked admitted-task runtime, then exact descriptor latch and canonical broker dispatch. */
import {randomUUID} from 'node:crypto';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {assertWorkerAuthorization} from '../../../packages/contracts/runtime-0.2/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {compileNativeBrokerPlan,createNativeBrokerStack} from './broker-stack.mjs';
import {matchPreparedDescriptor} from './preparation-intent.mjs';
import {executionFault} from './execution-broker.mjs';
import {capabilityDigest} from './task-verifier.mjs';
import {preparationAck} from './remote-task-boundary.mjs';
export function createPreparedNativeRuntime(configuration){
 const c=own(configuration,['pool','store','allocator','supervisor','runtime','plan','preparationIntent','taskCapability','controlCapabilitySha256','tasksFactory','verifyTask'],['continuation','continuationObjects','enabled','now','maxRequestMs']);
 const now=c.now??Date.now,enabled=c.enabled??false,maxRequestMs=c.maxRequestMs??3000,compiled=compileNativeBrokerPlan({runtime:c.runtime,plan:c.plan,preparationIntent:c.preparationIntent}),{original,runtime,preparationIntent}=compiled;
 const allocate=storageMethod(c.allocator,'allocate'),retire=storageMethod(c.allocator,'stop'),journal=c.store.allocations,read=storageMethod(journal,'read'),prepareLaunch=storageMethod(journal,'prepareLaunch'),consumeLaunch=storageMethod(journal,'consumeLaunch'),recordLaunch=storageMethod(journal,'recordLaunch'),verify=storageMethod(c.supervisor.taskVerifier,'verify'),allocation=storageMethod(c.supervisor.admission,'currentAllocation');
 if(typeof enabled!=='boolean'||typeof now!=='function'||typeof c.verifyTask!=='function'||typeof c.tasksFactory!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)throw executionFault('PREPARATION_CONFIGURATION');
 const key={binding:original.binding,allocationKey:original.executionKey};let admitted,allocating,stack,closed=false;
 const same=(a,b)=>hash(a)===hash(b),check=signal=>{if(!enabled||closed||signal?.aborted||now()>=original.expiresAtMs)throw executionFault('PREPARATION_REFUSED');};
 async function operation(signal,body){nativeSignal(signal);const life=createOperationLifetime({now,signal,deadlineMs:Math.min(now()+maxRequestMs,original.expiresAtMs),errorFactory:()=>executionFault('PREPARATION_UNKNOWN')});try{check(signal);return await body(life);}finally{life.close();}}
 async function current(life){
  const started=now(),receipt=assertWorkerAuthorization(await life.run(signal=>verify({capability:c.taskCapability,binding:original.binding,operation:'load',inputSha256:hash({binding:original.binding}),signal})),{binding:original.binding,operation:'load',inputSha256:hash({binding:original.binding}),started,now});
  if(receipt.expiresAtMs<original.expiresAtMs||hash({scopes:receipt.scopes,selectedClientId:receipt.selectedClientId,policyRevision:receipt.policyRevision})!==preparationIntent.authoritySha256)throw executionFault('PREPARATION_REFUSED');
  const saved=await life.run(()=>read(key,life.check));if(saved.record?.state!=='ADMITTED'||!same(saved.record.original,original)||!admitted||saved.record.resource.taskArn!==admitted.resource.taskArn)throw executionFault('PREPARATION_REFUSED');
  const began=now(),proof=data(own(await life.run(signal=>c.verifyTask({original,resource:saved.record.resource,signal})),['taskArn','imageSha256','runnerSha256','checkedAtMs','expiresAtMs']));
  if(proof.taskArn!==saved.record.resource.taskArn||proof.imageSha256!==preparationIntent.imageSha256||proof.runnerSha256!==preparationIntent.runnerSha256||!Number.isSafeInteger(proof.checkedAtMs)||proof.checkedAtMs<began||proof.checkedAtMs>now()||!Number.isSafeInteger(proof.expiresAtMs)||proof.expiresAtMs<original.expiresAtMs)throw executionFault('PREPARATION_REFUSED');
  life.check();check(life.signal);return {saved,receipt};
 }
 const request=(value,descriptor=false)=>{const v=own(value,['original','descriptorSha256','configTreeSha256',...(descriptor?['descriptor']:['preparationId'])],['signal']);if(!same(v.original,original)||![v.descriptorSha256,v.configTreeSha256].every(x=>typeof x==='string'&&/^[a-f0-9]{64}$/u.test(x)))throw executionFault('PREPARATION_REFUSED');return v;};
 const pins=v=>({...key,descriptorSha256:v.descriptorSha256,configTreeSha256:v.configTreeSha256,preparationId:v.preparationId});
 const ack=(v,id)=>({original,descriptorSha256:v.descriptorSha256,configTreeSha256:v.configTreeSha256,preparationId:id,taskArn:admitted.resource.taskArn,checkedAtMs:now(),expiresAtMs:original.expiresAtMs});
 function buildStack(descriptor){if(stack)return;const launchConfiguration={binding:original.binding,versions:{sdk:original.versions.sdk,cli:original.versions.cli},expiresAtMs:original.expiresAtMs,workspace:descriptor.cwd,configDirectory:descriptor.env.CLAUDE_CONFIG_DIR,secureStorageDirectory:preparationIntent.secureStorageDirectory,executableSha256:preparationIntent.executableSha256,launch:{command:descriptor.command,args:descriptor.args,env:descriptor.env},enabled};
   const made=createNativeBrokerStack({pool:c.pool,supervisor:c.supervisor,runtime,plan:c.plan,preparationIntent,launchConfiguration,taskCapability:c.taskCapability,controlCapabilitySha256:c.controlCapabilitySha256,tasksFactory:c.tasksFactory,enabled,now,maxRequestMs,...(c.continuationObjects?{continuationObjects:c.continuationObjects}:{})});
   if(!same(made.original,original))throw executionFault('PREPARATION_REFUSED');stack=made;
  }
 async function prepare(value){const v=request(value,true),descriptor=matchPreparedDescriptor(v.descriptor,preparationIntent,runtime.proxyCredential);if(hash(descriptor)!==v.descriptorSha256)throw executionFault('PREPARATION_REFUSED');return operation(v.signal,async life=>{
  await current(life);const existing=(await life.run(()=>read(key,life.check))).record.resource.launchBinding;
  const id=existing?.preparationId??randomUUID();await life.run(()=>prepareLaunch(pins({...v,preparationId:id}),life.check));await current(life);
  buildStack(descriptor);return preparationAck(ack(v,id),{...v,taskArn:admitted.resource.taskArn,now});
 });}
 async function reconcile(value){const v=own(value,['original','configDirectory','descriptorSha256','configTreeSha256','preparationId'],['signal']);if(!same(v.original,original))throw executionFault('PREPARATION_REFUSED');const descriptor=matchPreparedDescriptor({cwd:preparationIntent.workspace,...preparationIntent.launchTemplate,env:{...preparationIntent.launchTemplate.env,CLAUDE_CONFIG_DIR:v.configDirectory,ANTHROPIC_AUTH_TOKEN:runtime.proxyCredential}},preparationIntent,runtime.proxyCredential);if(hash(descriptor)!==v.descriptorSha256)throw executionFault('PREPARATION_REFUSED');return operation(v.signal,async life=>{const {saved}=await current(life),bound=saved.record.resource.launchBinding;if(bound?.state!=='STARTED'||!same({preparationId:bound.preparationId,descriptorSha256:bound.descriptorSha256,configTreeSha256:bound.configTreeSha256},{preparationId:v.preparationId,descriptorSha256:v.descriptorSha256,configTreeSha256:v.configTreeSha256}))throw executionFault('PREPARATION_REFUSED');buildStack(descriptor);await current(life);return ack(v,v.preparationId);});}
 async function verifyPrepared(value){const v=request(value);return operation(v.signal,async life=>{const {saved}=await current(life),bound=saved.record.resource.launchBinding;if(!bound||!same({preparationId:bound.preparationId,descriptorSha256:bound.descriptorSha256,configTreeSha256:bound.configTreeSha256},{preparationId:v.preparationId,descriptorSha256:v.descriptorSha256,configTreeSha256:v.configTreeSha256}))throw executionFault('PREPARATION_REFUSED');return ack(v,v.preparationId);});}
 async function start(value){const v=request(value);return operation(v.signal,async life=>{await current(life);if(!stack)throw executionFault('PREPARATION_REFUSED');const consumed=await life.run(()=>consumeLaunch(pins(v),life.check));if(!consumed.dispatch)return {...ack(v,v.preparationId),dispatch:false};
  try{await life.run(signal=>stack.broker.start({binding:original.binding,executionKey:original.executionKey,signal}));await current(life);return {...ack(v,v.preparationId),dispatch:true};}
  catch(error){try{await recordLaunch({...pins(v),state:'UNKNOWN'},()=>{});}catch{}throw error;}
 });}
 async function started(value){const v=request(value);return operation(v.signal,async life=>{await current(life);await life.run(signal=>stack.broker.current({binding:original.binding,executionId:original.executionId,signal}));await life.run(()=>recordLaunch({...pins(v),state:'STARTED'},life.check));await current(life);return ack(v,v.preparationId);});}
 async function prepareAllocation({signal}={}){if(allocating||closed)throw executionFault('PREPARATION_REFUSED');if(admitted)return admitted;allocating=true;try{admitted=await allocate({signal});return admitted;}finally{allocating=false;}}
 async function parkedRuntime(value){const v=own(value,['binding','versions'],['signal','continuation','sourceRequest','request','scopes']);if(!same(v.binding,original.binding)||!same(v.versions,runtime.versions))throw executionFault('PREPARATION_REFUSED');return operation(v.signal,async life=>{
  const {saved}=await current(life),phase=saved.record.resource.launchBinding?.state;
  if(phase==='CLAIMED'||phase==='UNKNOWN')throw executionFault('PREPARATION_REFUSED');
  if(phase==='STARTED'){if(!stack)throw executionFault('PREPARATION_REFUSED');const active=await life.run(signal=>stack.runtime.runtime({...v,signal}));await current(life);return active;}
  const row=data(JSON.parse(await life.run(signal=>allocation(original.binding,{signal})))),budgets=row.allocation.budgets;
  if(!same(row.binding,original.binding)||row.deadlineMs<runtime.deadlineMs||['maxTurns','maxCostMicroUSD','maxOutputBytes'].some(k=>runtime[k]>budgets[k]))throw executionFault('RUNTIME_BUDGET_REFUSED');
  const hints=['continuation','sourceRequest','request','scopes'];if(!c.continuation&&hints.some(k=>Object.hasOwn(v,k)))throw executionFault('CONTINUATION_REFUSED');const restored=c.continuation?await life.run(signal=>c.continuation.prepare({...v,signal})):null;
  await current(life);return data({...runtime,...(restored??{sdkSessionKey:runtime.sdkSessionKey??null})});
 });}
 return Object.freeze({original,plan:compiled.plan,prepareAllocation,runtime:{runtime:parkedRuntime,taskCapabilitySha256:capabilityDigest(c.taskCapability)},reconcile,preparationAuthorizer:Object.freeze({prepare,verify:verifyPrepared,start,started,async admitted(value){const v=own(value,['original'],['signal']);if(!same(v.original,original))throw executionFault('PREPARATION_REFUSED');return operation(v.signal,async life=>{await current(life);return {original,taskArn:admitted.resource.taskArn,checkedAtMs:now(),expiresAtMs:original.expiresAtMs};});}}),get stack(){return stack;},async close(){closed=true;try{await stack?.close();}finally{await retire();}}});
}
