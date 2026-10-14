/** Real task-owned PG/local supervisor, scripted ECS wire; no AWS/Fargate acceptance. */
import test from 'node:test';import assert from 'node:assert/strict';
import {DescribeTasksCommand,ListTasksCommand,StopTaskCommand} from '@aws-sdk/client-ecs';
import {fixture} from './broker-pg-fixture.mjs';
import {createIndependentNativeTask} from '../independent-task.mjs';
import {createEcsNativeTaskOwner} from '../ecs-task-owner.mjs';
import {createAdmittedEcsTaskFactory,createAdmittedEcsExecutionRecovery} from '../ecs-task-factory.mjs';
import {productFixture} from '../../../gateway/budget/product-scripted-fixture.mjs';
function factory(t){let client,native,metadata,original,stops=0;const taskArn=productFixture().context().qualificationBinding.workerArn,clusterName=taskArn.split('/')[1],prefix=taskArn.split('task/')[0];
 const tasksFactory=config=>{original=config.original;native=createIndependentNativeTask(config);const createdAtMs=Date.now(),clusterArn=prefix+'cluster/'+clusterName,taskDefinitionArn=prefix+'task-definition/meri:1';metadata={clusterArn,taskDefinitionArn,taskArn,containerName:'worker',createdAtMs};let stopped=false;
  client={async send(command){if(command instanceof ListTasksCommand)return {taskArns:command.input.desiredStatus==='STOPPED'&&!stopped?[]:[taskArn]};if(command instanceof StopTaskCommand){stops++;await native.retire(original);stopped=true;return {};}
   if(command instanceof DescribeTasksCommand)return {failures:[],tasks:[{taskArn,clusterArn,taskDefinitionArn,startedBy:original.executionKey,group:'meri:'+original.executionId,launchType:'FARGATE',platformFamily:'Linux',platformVersion:'1.4.0',enableExecuteCommand:false,createdAt:new Date(createdAtMs),lastStatus:stopped?'STOPPED':'RUNNING',desiredStatus:stopped?'STOPPED':'RUNNING',tags:[{key:'meri:execution-id',value:original.executionId},{key:'meri:binding-sha256',value:original.executionKey},{key:'meri:plan-sha256',value:original.planSha256},{key:'meri:expires-at-ms',value:String(original.expiresAtMs)}],containers:[{name:'worker',taskArn,containerArn:prefix+'container/'+clusterName+'/'+taskArn.split('/').at(-1)+'/11111111-1111-4111-8111-111111111111',image:'repository@'+original.versions.imageDigest,imageDigest:original.versions.imageDigest,lastStatus:stopped?'STOPPED':'RUNNING',...(stopped?{exitCode:0}:{})}]}]};throw Error('Unexpected command');}};
  return createEcsNativeTaskOwner({client,native,binding:{...metadata,original,enabled:true,maxRequestMs:3000}});
 };return {tasksFactory,get:()=>({client,native,metadata,original,stops})};}
test('reconstructed broker consumes persisted original ARN and contains real local owner after expired lease',async t=>{
 const adapter=factory(t),f=await fixture(t,{tasksFactory:adapter.tasksFactory});await f.start();const a=adapter.get(),before=await f.stack.store.executions.read(f.binding,()=>{});assert.equal(before.record.native.taskId,a.metadata.taskArn);
 const taskFactory=createAdmittedEcsTaskFactory({client:a.client,native:a.native,metadata:a.metadata,allocationJson:JSON.stringify(f.allocation),grantFactsJsons:[JSON.stringify(f.facts)],grantId:f.facts.grantId,enabled:true});
 const recovered=createAdmittedEcsExecutionRecovery({pool:f.pool,binding:f.binding,versions:f.runtime.versions,plan:f.stack.plan,expiresAtMs:f.expiry,verifier:f.config.supervisor.taskVerifier,taskCapability:f.f.credential,taskFactory,enabled:true,now:()=>f.expiry+1,maxRequestMs:3000});
 await assert.rejects(recovered.start({binding:f.binding,executionKey:a.original.executionKey}));const out=await recovered.stop();assert.equal(out.record.phase,'retired');assert.equal(out.record.native.physicalStopProven,true);assert.equal(adapter.get().stops,1);assert.equal(a.native.status().physicalStopProven,true);assert.equal((await f.pool.query('SELECT count(*) FROM meri_conversations.native_executions')).rows[0].count,'1');
});
