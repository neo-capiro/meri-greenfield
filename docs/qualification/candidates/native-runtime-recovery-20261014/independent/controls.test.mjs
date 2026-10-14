import test from 'node:test';import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {DescribeTasksCommand,ListTasksCommand,StopTaskCommand}=createRequire(new URL('../../../../../apps/runtime/package.json',import.meta.url))('@aws-sdk/client-ecs');
import {createEcsNativeTaskOwner} from '../../../../../apps/runtime/native-authority/ecs-task-owner.mjs';
import {createAdmittedEcsTaskFactory,createAdmittedEcsExecutionRecovery} from '../../../../../apps/runtime/native-authority/ecs-task-factory.mjs';
import {createExecutionBinding} from '../../../../../apps/control/conversations/execution-boundary.mjs';
import {createNativeContinuationRuntime} from '../../../../../apps/runtime/native-authority/continuation-runtime.mjs';
import {createNativeRuntimeProvider} from '../../../../../apps/runtime/native-authority/runtime-provider.mjs';
import {createNativeExecutionApplication} from '../../../../../apps/runtime/native-authority/execution-http.mjs';
import {capabilityDigest} from '../../../../../apps/runtime/native-authority/task-verifier.mjs';
import {fixture as pgFixture} from '../../../../../apps/runtime/native-authority/test/broker-pg-fixture.mjs';
import {productFixture} from '../../../../../apps/gateway/budget/product-scripted-fixture.mjs';
import {continuationFixture,NOW,id} from '../../../../../apps/worker/conversation/continuation/test/fixtures.mjs';
import {versions} from '../../../../../apps/control/conversations/test/store-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
function ecs(original,taskArn,at=Date.now()){
 const prefix=taskArn.split('task/')[0],cluster=taskArn.split('/')[1];
 const metadata={clusterArn:prefix+'cluster/'+cluster,taskDefinitionArn:prefix+'task-definition/independent:4',taskArn,containerName:'worker',createdAtMs:at-100};
 const worker={name:'worker',taskArn,containerArn:prefix+'container/'+cluster+'/'+taskArn.split('/').at(-1)+'/22222222-2222-4222-8222-222222222222',image:'repo@'+original.versions.imageDigest,imageDigest:original.versions.imageDigest,lastStatus:'RUNNING'};
 const task={taskArn,clusterArn:metadata.clusterArn,taskDefinitionArn:metadata.taskDefinitionArn,startedBy:original.executionKey,group:'meri:'+original.executionId,launchType:'FARGATE',platformFamily:'Linux',platformVersion:'1.4.0',enableExecuteCommand:false,createdAt:new Date(metadata.createdAtMs),lastStatus:'RUNNING',desiredStatus:'RUNNING',containers:[worker],tags:[['meri:execution-id',original.executionId],['meri:binding-sha256',original.executionKey],['meri:plan-sha256',original.planSha256],['meri:expires-at-ms',String(original.expiresAtMs)]].map(([key,value])=>({key,value}))};
 let confirm=false,missing=false,reads=0;const commands=[];
 const client={async send(command){commands.push(command);if(command instanceof DescribeTasksCommand){reads++;return {tasks:missing?[]:[structuredClone(task)],failures:[]};}if(command instanceof ListTasksCommand)return {taskArns:[taskArn]};if(command instanceof StopTaskCommand){if(confirm){task.lastStatus=worker.lastStatus='STOPPED';task.desiredStatus='STOPPED';worker.exitCode=9;}return {task:{taskArn,lastStatus:'STOPPED'}};}throw Error('Allocation/API outside recovery scope');}};
 const native={async launch(){throw Error('No new native release in recovery controls');},async inspect(){return {binding:original.binding,executionId:original.executionId,planSha256:original.planSha256,expiresAtMs:original.expiresAtMs,versions:original.versions,taskId:'synthetic-original-transport',state:'executing',physicalStopProven:false};},async readiness(){},registration:{async read(value){return {binding:value.binding,key:value.key};}}};
 return {metadata,task,worker,client,native,commands,reads:()=>reads,confirm(){confirm=true;},hide(){missing=true;},owner:()=>createEcsNativeTaskOwner({client,native,binding:{...metadata,original,enabled:true}})};
}
test('factory refuses alternate admitted ARN and hostile original without SDK command effects',()=>{
 const f=productFixture(),facts=f.context(),original=createExecutionBinding({binding:facts.binding,versions,plan:{test:'independent'},expiresAtMs:Date.now()+20000}),e=ecs(original,facts.qualificationBinding.workerArn);
 const config={client:e.client,native:e.native,metadata:e.metadata,allocationJson:JSON.stringify(f.allocation),grantFactsJsons:[JSON.stringify(facts)],grantId:facts.grantId,enabled:true};
 assert.throws(()=>createAdmittedEcsTaskFactory({...config,metadata:{...e.metadata,taskArn:e.metadata.taskArn.replace(/.$/u,'f')}}));
 const factory=createAdmittedEcsTaskFactory(config);let traps=0;const hostile={...original,get binding(){traps++;return original.binding;}};assert.throws(()=>factory({original:hostile,launchConfiguration:null}));assert.equal(traps,0);assert.equal(e.commands.length,0);
});
test('changed original/persisted hint refuses before service access; no replacement command exists',async()=>{
 const f=productFixture(),original=createExecutionBinding({binding:f.invocation.binding,versions,plan:{test:'independent'},expiresAtMs:Date.now()+20000}),e=ecs(original,f.context().qualificationBinding.workerArn),owner=e.owner();
 await assert.rejects(owner.retire({...original,planSha256:'0'.repeat(64)}));await assert.rejects(owner.retire({...original,taskId:e.metadata.taskArn.replace(/.$/u,'f')}));assert.equal(e.commands.length,0);
});
test('stop acknowledgement and missing metadata preserve cleanup UNKNOWN; later fresh terminal read proves original retirement',async()=>{
 const f=productFixture(),original=createExecutionBinding({binding:f.invocation.binding,versions,plan:{test:'independent'},expiresAtMs:Date.now()+20000}),e=ecs(original,f.context().qualificationBinding.workerArn),owner=e.owner();
 await assert.rejects(owner.retire(original),/CLEANUP_UNKNOWN/);assert.equal(e.commands.filter(c=>c instanceof StopTaskCommand).length,1);assert.equal(e.task.lastStatus,'RUNNING');
 e.confirm();const retired=await owner.retire(original);assert.equal(retired.physicalStopProven,true);assert.equal(e.commands.at(-1) instanceof DescribeTasksCommand,true);
 const absent=ecs(original,e.metadata.taskArn);absent.hide();await assert.rejects(absent.owner().retire(original),/ECS_UNKNOWN/);assert.equal(absent.commands.some(c=>c instanceof StopTaskCommand),false);
});
test('native registration cannot survive original resource stopping during private owner read',async()=>{
 const f=productFixture(),original=createExecutionBinding({binding:f.invocation.binding,versions,plan:{test:'independent'},expiresAtMs:Date.now()+20000}),e=ecs(original,f.context().qualificationBinding.workerArn);
 e.native.registration.read=async value=>{e.task.lastStatus=e.worker.lastStatus='STOPPED';e.task.desiredStatus='STOPPED';e.worker.exitCode=0;return {binding:value.binding,key:value.key};};
 await assert.rejects(e.owner().registration.read({binding:original.binding,key:{projectKey:'independent',sessionId:id(99)}}));assert.equal(e.reads(),2);
});
test('runtime qualification failure refuses readiness but preserves original resource containment',async()=>{
 const f=productFixture(),original=createExecutionBinding({binding:f.invocation.binding,versions,plan:{test:'independent'},expiresAtMs:Date.now()+20000}),e=ecs(original,f.context().qualificationBinding.workerArn),owner=e.owner();e.worker.imageDigest='sha256:'+'0'.repeat(64);
 await assert.rejects(owner.readiness(),/ECS_NOT_READY/);e.confirm();const fact=await owner.retire(original);assert.equal(fact.physicalStopProven,true);assert.equal(e.commands.filter(c=>c instanceof StopTaskCommand).length,1);assert.equal(e.commands.find(c=>c instanceof StopTaskCommand).input.task,e.metadata.taskArn);
});
test('real independent PG retains original ARN hint through expired reconstruction and uncertain retirement',async t=>{
 assert.equal(process.env.MERI_BROKER_TEST_DATABASE,'meri_broker_independent');const f=await pgFixture(t),original=f.stack.broker.original,e=ecs(original,f.facts.qualificationBinding.workerArn);
 const {versions:ignored,...identity}=original;await f.stack.store.executions.claim(identity,()=>{});const fact={binding:f.binding,executionId:original.executionId,planSha256:original.planSha256,expiresAtMs:f.expiry,versions:f.runtime.versions,taskId:e.metadata.taskArn,state:'executing',physicalStopProven:false};await f.stack.store.executions.record({binding:f.binding,executionId:original.executionId,phase:'started',native:fact},()=>{});
 const factory=createAdmittedEcsTaskFactory({client:e.client,native:e.native,metadata:e.metadata,allocationJson:JSON.stringify(f.allocation),grantFactsJsons:[JSON.stringify(f.facts)],grantId:f.facts.grantId,enabled:true});let hint;
 const recovered=createAdmittedEcsExecutionRecovery({pool:f.pool,binding:f.binding,versions:f.runtime.versions,plan:f.stack.plan,expiresAtMs:f.expiry,verifier:f.config.supervisor.taskVerifier,taskCapability:f.f.credential,taskFactory:value=>{const owner=factory(value);return {...owner,retire(input){hint=input.taskId;return owner.retire(input);}};},enabled:true,now:()=>f.expiry+1});
 await assert.rejects(recovered.start({binding:f.binding,executionKey:original.executionKey}));await assert.rejects(recovered.stop(),/CLEANUP_UNKNOWN/);assert.equal(hint,e.metadata.taskArn);assert.equal((await f.stack.store.executions.read(f.binding,()=>{})).record.phase,'started');
 e.confirm();assert.equal((await recovered.stop()).record.phase,'retired');assert.equal((await f.pool.query('SELECT count(*) FROM meri_conversations.native_executions')).rows[0].count,'1');assert.equal(e.commands.some(c=>c.constructor.name==='RunTaskCommand'),false);
});
function continuation(mode='fork'){
 const f=continuationFixture(mode),target=f.target;let stored={continuation:f.continuation,sourceRequest:target.sourceRequest},restores=0,checks=0,onRestore=()=>{};
 const run={binding:target.binding,versions:target.versions,scopes:target.scopes,state:'queued'},store={async read(){return {run,request:target.request};},lifecycle:{async execution(){return stored;}}};
 const verifier={async verify(input){return {binding:input.binding,operation:input.operation,inputSha256:input.inputSha256,identityCredential:'independent-synthetic-identity',scopes:target.scopes,selectedClientId:target.scopes[0].resourceId,policyRevision:target.scopes[0].policyRevision,authorizationDecisionId:'independent',checkedAtMs:NOW,expiresAtMs:NOW+10000};}};
 const restored={restoreReceipt:{verificationId:id(88),binding:target.binding,checkpointId:f.continuation.checkpoint.checkpointId,checkpointSha256:f.continuation.checkpointSha256,workspaceSha256:f.continuation.checkpoint.workspaceSha256,opaqueSessionSha256:f.continuation.checkpoint.opaqueSession.sha256,scopes:target.scopes,contextSha256:f.continuation.contextSha256,sourceRequestSha256:f.continuation.sourceRequestSha256,checkedAtMs:NOW,expiresAtMs:NOW+5000},sdkSessionKey:{projectKey:'independent-target',sessionId:f.continuation.targetSessionId}};
 const restorer={async restore(){restores++;onRestore();return restored;},registration:{async read(){return null;}}};
 const digest=capabilityDigest('independent-task'),broker={taskCapabilitySha256:digest,async current(){checks++;return {run,record:{expiresAtMs:NOW+10000}};},async start(){},async poll(){}};
 const runtime={binding:target.binding,versions:target.versions,proxyUrl:'https://independent.invalid',proxyCredential:'independent-existing-proxy',model:'synthetic',deadlineMs:NOW+10000,maxTurns:1,maxCostMicroUSD:1,maxOutputBytes:10},admission={async currentAllocation(){return JSON.stringify({binding:target.binding,deadlineMs:NOW+10000,allocation:{budgets:{maxTurns:1,maxCostMicroUSD:1,maxOutputBytes:10}}});}};
 const provider=createNativeRuntimeProvider({broker,runtime,admission,taskCapabilitySha256:digest,continuation:createNativeContinuationRuntime({store,verifier,taskCapability:'independent-task',restorer,now:()=>NOW}),enabled:true});
 const app=createNativeExecutionApplication({broker,runtime:provider,taskCapabilitySha256:digest,controlCapabilitySha256:capabilityDigest('independent-control'),enabled:true,now:()=>NOW});
 const input={binding:target.binding,versions:target.versions,continuation:f.continuation,sourceRequest:target.sourceRequest,request:target.request,scopes:target.scopes};
 return {app,input,provider,restorer,restored,counts:()=>({restores,checks}),setStored:v=>{stored=v;},onRestore:f=>{onRestore=f;},run};
}
const http=(x,body=x.input,token='independent-task')=>x.app.handle(new Request('https://independent.invalid/v1/runner/runtime',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)}));
test('continuation HTTP joins canonical fork target while worker replay/body authority is refused',async()=>{
 const x=continuation();assert.equal((await http(x,x.input,'independent-control')).status,403);assert.equal((await http(x,{...x.input,scopes:[]})).status,503);assert.equal((await http(x,{...x.input,restoreReceipt:x.restored.restoreReceipt})).status,503);assert.equal(x.counts().restores,0);
 const response=await http(x);assert.equal(response.status,200);const body=await response.json();assert.deepEqual(body.restoreReceipt,x.restored.restoreReceipt);assert.equal(body.sdkSessionKey.sessionId,x.input.continuation.targetSessionId);assert.equal(x.counts().restores,1);
});
test('restore failure still rechecks native broker and fresh run keeps existing runtime behavior',async()=>{
 const x=continuation();x.onRestore(()=>{throw Error('independent unknown restore');});await assert.rejects(x.provider.runtime(x.input));assert.equal(x.counts().checks,2);
 const fresh=continuation();fresh.setStored(null);const body=await fresh.provider.runtime({binding:fresh.input.binding,versions:fresh.input.versions});assert.equal(body.sdkSessionKey,null);assert.equal('restoreReceipt'in body,false);assert.equal(fresh.counts().restores,0);
});
