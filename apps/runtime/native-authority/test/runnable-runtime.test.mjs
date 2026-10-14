/** Real owned SQL and independent native process; ECS/authority/proxy remain scripted. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createRunnableNativeRuntime} from '../runnable-runtime.mjs';
import {createIndependentNativeTask} from '../independent-task.mjs';
import {fixture,sha,control} from './broker-pg-fixture.mjs';
import {listenFetch} from './task-verifier-fixture.mjs';
import {createNativeSdkSessionClient} from '../session-client.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
test('canonical claim → qualified ARN admission → independent native registration and runtime; close revokes and proves task retirement',async t=>{
 const cleanup=[];let app,server;const x=await fixture({after:fn=>cleanup.push(fn)},{leaseMs:45000});t.after(async()=>{try{await app?.close();}finally{try{await server?.close();}finally{for(const fn of cleanup.reverse())await fn();}}});await x.pool.query('TRUNCATE meri_product_budget.runs CASCADE');
 const clientId=x.config.supervisor?x.config.supervisor.identityContext:null;assert.ok(clientId);
 const grantId=x.facts.grantId,grantIntents=[{grantId,capabilitySha256:x.facts.capabilitySha256,expiresAtMs:x.expiry}],q=x.facts.qualificationBinding,commands=[];let task,physicalStopped=false,local;
 const clusterArn='arn:aws:ecs:us-east-1:967807252336:cluster/Synthetic',taskDefinitionArn='arn:aws:ecs:us-east-1:967807252336:task-definition/MeriSynthetic:1',taskArn=q.workerArn;
 const client={async send(command){commands.push(command.constructor.name);const input=command.input;
  if(command.constructor.name==='RunTaskCommand'){
   assert.equal((await x.pool.query('SELECT count(*) FROM meri_conversations.native_allocations')).rows[0].count,'1');assert.equal((await x.pool.query('SELECT count(*) FROM meri_product_budget.grants')).rows[0].count,'0');
   task={taskArn,clusterArn,taskDefinitionArn,startedBy:input.startedBy,group:input.group,tags:input.tags,createdAt:new Date(),lastStatus:'RUNNING',desiredStatus:'RUNNING',launchType:'FARGATE',platformFamily:'Linux',platformVersion:'1.4.0',enableExecuteCommand:false,attachments:[{type:'ElasticNetworkInterface',status:'ATTACHED',details:[{name:'subnetId',value:'subnet-aaaa'}]}],containers:[{name:'worker',containerArn:clusterArn.replace('cluster/','container/')+'/'+taskArn.split('/').at(-1)+'/11111111-1111-4111-8111-000000000001',image:'synthetic@'+x.runtime.versions.imageDigest,imageDigest:x.runtime.versions.imageDigest,lastStatus:'RUNNING'}]};return {tasks:[task]};
  }
  if(command.constructor.name==='DescribeTasksCommand')return {tasks:[task]};
  if(command.constructor.name==='ListTasksCommand')return {taskArns:input.desiredStatus==='STOPPED'?(physicalStopped?[taskArn]:[]):(physicalStopped?[]:[taskArn])};
  if(command.constructor.name==='StopTaskCommand'){physicalStopped=true;task={...task,lastStatus:'STOPPED',desiredStatus:'STOPPED',containers:task.containers.map(c=>({...c,lastStatus:'STOPPED',exitCode:0}))};return {task};}
  throw Error('unexpected command');
 }};
 const principal={tenantId:x.binding.tenantId,actorId:x.binding.actorId},selectedClientId='11111111-1111-4111-8111-000000000006';
 const identity={origin:'https://authority.synthetic.invalid',credential:'synthetic-existing-identity',commandContext:{binding:x.binding,clientResolution:{reference:selectedClientId,clientId:selectedClientId}},async fetchImpl(url,init){const body=JSON.parse(init.body),base={principal,identityRevision:'synthetic-identity',checkedAtMs:Date.now(),expiresAtMs:x.expiry+10000};return Response.json(url.endsWith('/identity')?base:{...base,identitySha256:body.identitySha256,conversationId:x.binding.conversationId,selectedClientId,contextRevision:'synthetic-context'});}};
 app=createRunnableNativeRuntime({pool:x.pool,client,identity,allocationJson:JSON.stringify(x.allocation),qualification:{attempt:q.attempt,policyRevision:q.policyRevision},grantIntents,grantId,operations:['load','runner/session/register','runner/session/load','runner/session/append','runner/session/list-subkeys'],taskCapability:x.f.credential,controlCapabilitySha256:sha(control),runtime:x.runtime,plan:x.config.plan,launchConfiguration:x.launchConfiguration,taskRequest:{cluster:clusterArn,taskDefinition:taskDefinitionArn,networkConfiguration:{awsvpcConfiguration:{subnets:['subnet-aaaa'],securityGroups:['sg-aaaa'],assignPublicIp:'DISABLED'}},overrides:{containerOverrides:[{name:'worker',command:['node','runner'],environment:[{name:'MERI_CONFIG_PATH',value:'/workspace/config'}]}]}},containerName:'worker',limits:{maxRequestMs:5000,maxFactBytes:131072},nativeFactory(value){local=createIndependentNativeTask({original:value.original,launchConfiguration:value.launchConfiguration});return local;},enabled:true});
 const started=await app.broker.start({binding:x.binding,executionKey:hash(x.binding)});assert.equal(started.executionId,hash(x.binding));assert.equal((await x.pool.query('SELECT record FROM meri_conversations.native_executions')).rows[0].record.native.taskId,taskArn);assert.equal(commands.filter(x=>x==='RunTaskCommand').length,1);
 server=await listenFetch(app.application);
 const sdk=createNativeSdkSessionClient({origin:'https://session.synthetic.invalid',binding:x.binding,credential:x.f.credential,fetchImpl:(url,init)=>fetch(server.origin+new URL(url).pathname,init),maxRequestMs:5000});
 const child=local.spawnClaudeCodeProcess({...x.launchConfiguration.launch,cwd:x.workspace});child.stdout.resume();child.stdin.write('emit\n');
 const registered=await sdk.register({key:x.key});assert.equal(registered.registered,true);
 const response=await fetch(server.origin+'/v1/runner/runtime',{method:'POST',headers:{authorization:'Bearer '+x.f.credential,'content-type':'application/json'},body:JSON.stringify({binding:x.binding,versions:x.runtime.versions})});assert.equal(response.status,200);assert.equal((await response.json()).deadlineMs,x.expiry);
 await app.close();assert.equal(physicalStopped,true);assert.equal(local.status().physicalStopProven,true);assert.equal((await x.pool.query('SELECT state FROM meri_product_budget.grants')).rows[0].state,'REVOKED');assert.equal((await x.pool.query('SELECT record FROM meri_conversations.native_allocations')).rows[0].record.state,'RETIRED');
 assert.equal((await fetch(server.origin+'/v1/runner/session/load',{method:'POST'})).status,503);
});
