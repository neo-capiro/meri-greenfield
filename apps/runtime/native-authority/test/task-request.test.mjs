import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {versions} from '../../../control/conversations/test/store-fixture.mjs';
import {compileNativeTaskRequest} from '../task-request.mjs';
import {DescribeTasksCommand,StopTaskCommand} from '@aws-sdk/client-ecs';
import {createNativeTaskAllocator,CONTAINMENT_SETTLE_MS} from '../task-allocator.mjs';

function fixture(){
 const binding={tenantId:'synthetic-tenant',actorId:'synthetic-actor',conversationId:'11111111-1111-4111-8111-111111111111',runId:'22222222-2222-4222-8222-222222222222',attemptId:'33333333-3333-4333-8333-333333333333',workerId:'44444444-4444-4444-8444-444444444444',writerFence:7};
 const original={binding,executionKey:hash(binding),executionId:hash(binding),planSha256:'d'.repeat(64),expiresAtMs:1890000000000,versions};
 const taskRequest={cluster:'arn:aws:ecs:us-east-1:967807252336:cluster/Synthetic',taskDefinition:'arn:aws:ecs:us-east-1:967807252336:task-definition/Synthetic:9',networkConfiguration:{awsvpcConfiguration:{subnets:['subnet-12345678'],securityGroups:['sg-12345678','sg-87654321'],assignPublicIp:'DISABLED'}},overrides:{containerOverrides:[{name:'worker',command:['start'],environment:[{name:'MERI_PRODUCT_PREVIEW_REQUIRED',value:'1'}]}]}};
 return {original,taskRequest,containerName:'worker'};
}

test('canonical extraction preserves the complete launch request and allocator intent hash without IO',()=>{
 const f=fixture(),compiled=compileNativeTaskRequest(f),key=hash(f.original.binding);
 const expected={...f.taskRequest,count:1,launchType:'FARGATE',platformVersion:'1.4.0',enableExecuteCommand:false,enableECSManagedTags:false,clientToken:key,startedBy:key,group:'meri:'+key,tags:[{key:'meri:execution-id',value:key},{key:'meri:binding-sha256',value:key},{key:'meri:plan-sha256',value:'d'.repeat(64)},{key:'meri:expires-at-ms',value:'1890000000000'}]};
 assert.equal(JSON.stringify(compiled.spec),JSON.stringify(expected));
 assert.equal(compiled.taskRequestSha256,hash(expected));
 const noEffect=()=>assert.fail('compilation must not call an owner');
 const allocator=createNativeTaskAllocator({maxRequestMs:30000,startupMs:180000,...f,journal:{claim:noEffect,read:noEffect,record:noEffect},authority:{verify:noEffect},admission:{admit:noEffect,read:noEffect,revoke:noEffect},client:{send:noEffect},qualification:{attempt:1,policyRevision:'a'.repeat(64)},grantIntents:[],allocationSha256:'b'.repeat(64)});
 assert.equal(allocator.intent.taskRequestSha256,compiled.taskRequestSha256);
 assert.ok(Object.isFrozen(compiled.spec.tags[0]));
 f.taskRequest.networkConfiguration.awsvpcConfiguration.subnets[0]='subnet-ffffffff';
 assert.equal(compiled.spec.networkConfiguration.awsvpcConfiguration.subnets[0],'subnet-12345678');
});

test('requested placement, container and secret-bearing override denials remain closed',()=>{
 const changes=[f=>f.taskRequest.networkConfiguration.awsvpcConfiguration.assignPublicIp='ENABLED',f=>f.taskRequest.networkConfiguration.awsvpcConfiguration.subnets.push('subnet-87654321'),f=>f.taskRequest.networkConfiguration.awsvpcConfiguration.securityGroups.push('sg-12345678'),f=>f.taskRequest.overrides.containerOverrides[0].environment.push({name:'MERI_PROXY_CREDENTIAL',value:'synthetic'}),f=>f.containerName='other',f=>f.original.executionKey='0'.repeat(64),f=>f.original.executionId='0'.repeat(64),f=>f.original.binding.writerFence=0,f=>f.taskRequest.startedBy='caller-value'];
 for(const change of changes){const f=fixture();change(f);assert.throws(()=>compileNativeTaskRequest(f));}
 let calls=0;const f=fixture();Object.defineProperty(f.taskRequest,'cluster',{enumerable:true,get(){calls++;return 'caller';}});assert.throws(()=>compileNativeTaskRequest(f));assert.equal(calls,0);
});

/** stop() over an admitted original: ECS answers StopTask, then reports the task through its stopping states before STOPPED. */
function stopFixture({stoppedAfterDescribes,clockStepMs=0}){
 const f=fixture(),{original}=f,cluster='arn:aws:ecs:us-east-1:967807252336:cluster/Synthetic',taskId='a'.repeat(32),taskArn=`arn:aws:ecs:us-east-1:967807252336:task/Synthetic/${taskId}`;
 const resource={taskArn,createdAtMs:1800000000000,clusterArn:cluster,taskDefinitionArn:f.taskRequest.taskDefinition,containerName:'worker'},grantIntents=[{grantId:'55555555-5555-4555-8555-555555555555'}];
 const state={stopRequests:0,describesAfterStop:0,records:[]};let clock=1800000100000;
 const task=()=>{const stopped=state.stopRequests>0&&state.describesAfterStop>stoppedAfterDescribes,status=state.stopRequests===0?'RUNNING':stopped?'STOPPED':'DEPROVISIONING';
  return {taskArn,clusterArn:cluster,taskDefinitionArn:resource.taskDefinitionArn,startedBy:original.executionKey,group:'meri:'+original.executionId,createdAt:new Date(resource.createdAtMs),
   tags:[['meri:execution-id',original.executionId],['meri:binding-sha256',hash(original.binding)],['meri:plan-sha256',original.planSha256],['meri:expires-at-ms',String(original.expiresAtMs)]].map(([key,value])=>({key,value})),
   lastStatus:status,desiredStatus:state.stopRequests?'STOPPED':'RUNNING',containers:[{name:'worker',containerArn:`arn:aws:ecs:us-east-1:967807252336:container/Synthetic/${taskId}/66666666-6666-4666-8666-666666666666`,lastStatus:stopped?'STOPPED':'RUNNING',...(stopped?{exitCode:0}:{})}]};};
 const client={async send(command){clock+=clockStepMs;
  if(command instanceof StopTaskCommand){state.stopRequests++;return {task:task()};}
  if(command instanceof DescribeTasksCommand){if(state.stopRequests)state.describesAfterStop++;return {tasks:[task()],failures:[]};}
  throw Error('unexpected ECS command');}};
 const saved={state:'ADMITTED',resource};
 const allocator=createNativeTaskAllocator({maxRequestMs:30000,startupMs:180000,...f,now:()=>clock,enabled:true,client,grantIntents,qualification:{attempt:1,policyRevision:'a'.repeat(64)},allocationSha256:'b'.repeat(64),
  journal:{claim:()=>assert.fail('stop never claims'),async read(){return {record:{...saved}};},async record(value){state.records.push(value);}},authority:{verify:()=>assert.fail('stop needs no task authority')},
  admission:{admit:()=>assert.fail('no admission'),read:()=>assert.fail('no admission'),async revoke(){return {state:'REVOKED',revocationProven:true,grantIds:grantIntents.map(g=>g.grantId),taskArn};}}});
 return {allocator,state,taskArn};
}
test('stop waits for ECS to report STOPPED after StopTask and only then records the proven retirement',async()=>{
 const f=stopFixture({stoppedAfterDescribes:2});
 assert.deepEqual(await f.allocator.stop(),{physicalStopProven:true});
 assert.equal(f.state.stopRequests,1,'one StopTask');assert.ok(f.state.describesAfterStop>=3,'re-described until STOPPED');
 assert.deepEqual(f.state.records.map(r=>[r.state,r.resource.physicalStopProven]),[['RETIRED',true]]);
});
test('a task that never reaches STOPPED leaves the stop unproven within the settle bound and records nothing',async()=>{
 const f=stopFixture({stoppedAfterDescribes:Infinity,clockStepMs:5000});
 await assert.rejects(f.allocator.stop(),{code:'NATIVE_EXECUTION_ALLOCATION_CLEANUP_UNKNOWN'});
 assert.equal(f.state.stopRequests,1);assert.ok(f.state.describesAfterStop<=CONTAINMENT_SETTLE_MS/5000+2,`bounded re-describes (${f.state.describesAfterStop})`);
 assert.equal(f.state.records.length,0,'no retirement without a proven stop');
});
