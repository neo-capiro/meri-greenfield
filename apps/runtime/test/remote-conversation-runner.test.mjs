import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {runRemoteConversation} from '../remote-conversation-runner.mjs';import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';import {continuationFixture} from '../../worker/conversation/continuation/test/fixtures.mjs';import {capabilityDigest} from '../native-authority/task-verifier.mjs';
function fixture(t){const f=continuationFixture(),root=fs.mkdtempSync(join(tmpdir(),'meri-remote-runner-')),capabilityFile=join(root,'task-capability');fs.writeFileSync(capabilityFile,'synthetic-existing-task',{mode:0o600});t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const original=createExecutionBinding({binding:f.binding,versions:f.target.versions,plan:{synthetic:true},expiresAtMs:Date.now()+900000}),workspace=join(root,f.binding.conversationId),preparationIntent={workspace,configParentDirectory:root,secureStorageDirectory:join(root,'secure'),imageSha256:'b'.repeat(64),runnerSha256:'c'.repeat(64),authoritySha256:'f'.repeat(64)},http={hostname:'127.0.0.1',port:0,frontendOrigin:'http://127.0.0.1'},configuration={binding:f.binding,versions:f.target.versions,workspace,limits:{requestMs:25000,shutdownMs:1000},native:{origin:'https://canonical.synthetic.invalid',capabilityFile,maxResponseBytes:2097152},remoteTask:{original,preparationIntent,taskArn:'arn:aws:ecs:us-east-1:967807252336:task/meri/'+'1'.repeat(32),controlCapabilitySha256:'e'.repeat(64),processOrigin:'https://task.synthetic.invalid',http}};return {configuration};}

test('default task execution uses the pinned SDK Query directly, with the original native session factory',async t=>{
 const {sdkQuery}=await import('../../worker/conversation/activity.mjs'),{configuration}=fixture(t),order=[];const sessionFactory=async()=>assert.fail('execute owns the session lifetime');
 const result=await runRemoteConversation(configuration,{fetchImpl:()=>assert.fail('no HTTP before execute'),sessionFactory,
  async listen(c){order.push('listen');assert.equal((await c.application.handle(new Request('https://local.invalid/v1/native-task/start'))).status,404);return {async close(){order.push('listener-close');}};},
  async execute(c,v){order.push('execute');assert.equal(v.query,sdkQuery);assert.equal(v.sessionFactory,sessionFactory);assert.equal(c,configuration);assert.equal(Object.hasOwn(v,'spawnClaudeCodeProcess'),false);return 'scripted-completed';}});
 assert.equal(result,'scripted-completed');assert.deepEqual(order,['listen','execute','listener-close']);
});
test('execution failure closes the listener without a custom process or remote stop round trip',async t=>{
 const {configuration}=fixture(t),order=[];await assert.rejects(runRemoteConversation(configuration,{fetchImpl:()=>assert.fail('no HTTP'),listen:async()=>({async close(){order.push('closed');}}),execute:async()=>{throw Error('scripted execution failed');}}),/scripted execution failed/);assert.deepEqual(order,['closed']);
});
test('foreign original binding refuses before any task effect',async t=>{
 const {configuration}=fixture(t);configuration.remoteTask.original={...configuration.remoteTask.original,binding:{...configuration.binding,writerFence:300}};let effects=0;
 await assert.rejects(runRemoteConversation(configuration,{listen(){effects++;},execute(){effects++;}}));assert.equal(effects,0);
});
test('removed child-process factory cannot be supplied as a startup override',async t=>{
 const {configuration}=fixture(t);let effects=0;await assert.rejects(runRemoteConversation(configuration,{createWorker(){effects++;},listen(){effects++;},execute(){effects++;}}));assert.equal(effects,0);
});
test('uncertain listener cleanup never reports successful task completion',async t=>{
 const {configuration}=fixture(t);configuration.limits.shutdownMs=20;await assert.rejects(runRemoteConversation(configuration,{listen:async()=>({close:()=>new Promise(()=>{})}),execute:async()=> 'would-be-success'}),/REMOTE_RUNNER_CLEANUP_UNKNOWN/);
});
test('caller cancellation closes the task listener after execute settles',async t=>{
 const {configuration}=fixture(t),abort=new AbortController(),order=[];await assert.rejects(runRemoteConversation(configuration,{signal:abort.signal,listen:async()=>({async close(){order.push('listener-close');}}),execute:async(c,v)=>{abort.abort();assert.equal(v.signal.aborted,true);order.push('execute-stopped');throw Error('scripted cancellation');}}),/scripted cancellation/);assert.deepEqual(order,['execute-stopped','listener-close']);
});

for(const fails of [false,true])test(`prepared gate releases one direct query and closes its listener after ${fails?'execution failure':'completion'}`,async t=>{
 const {configuration}=fixture(t),control='synthetic-control',ready=Promise.withResolvers(),calls=[];let application,queries=0;
 configuration.remoteTask.preparedKickoff=true;configuration.remoteTask.controlCapabilitySha256=capabilityDigest(control);
 const run=runRemoteConversation(configuration,{
  fetchImpl:async(url,init)=>{assert.ok(url.endsWith('/runner/native/admitted'));assert.equal(init.headers.authorization,'Bearer synthetic-existing-task');return Response.json({original:configuration.remoteTask.original,taskArn:configuration.remoteTask.taskArn,checkedAtMs:Date.now(),expiresAtMs:configuration.remoteTask.original.expiresAtMs});},
  query(){queries++;return {close(){calls.push('query-close');}};},
  async listen(c){application=c.application;ready.resolve();return {async close(){calls.push('listener-close');}};},
  async execute(c,options){options.query({}).close();if(fails)throw Error('scripted query failure');return {state:'completed'};}
 });
 const settled=run.then(value=>({value}),error=>({error}));await Promise.race([ready.promise,settled.then(outcome=>{if(outcome.error)throw outcome.error;assert.fail('execution finished before its listener was ready');})]);assert.equal(queries,0);
 const release=token=>application.handle(new Request('https://runner.synthetic.invalid/v1/native-task/release',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({original:configuration.remoteTask.original,taskArn:configuration.remoteTask.taskArn})}));
 assert.equal((await release('synthetic-existing-task')).status,503);assert.equal(queries,0);
 assert.equal((await release(control)).status,200);const outcome=await settled;
 if(fails)assert.match(outcome.error.message,/scripted query failure/);else assert.deepEqual(outcome.value,{state:'completed'});
 assert.equal(queries,1);assert.deepEqual(calls,['query-close','listener-close']);
});
