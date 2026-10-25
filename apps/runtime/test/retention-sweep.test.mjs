import test from 'node:test';
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createRequire} from 'node:module';
import {conversationRetentionSchedule,createRetentionSweepActivity} from '../retention-sweep.mjs';
import {RETENTION_SWEEP_BUDGET} from '../../../packages/runtime/retention-sweep-budget.mjs';
test('fixed schedule uses the existing queue and one workflow, without startup-side schedule writes',()=>{
 const schedule=conversationRetentionSchedule({taskQueue:'existing-meri-queue'});
 assert.deepEqual(schedule,{scheduleId:'meri-conversation-trash-expiry',spec:{intervals:[{every:'1 hour'}]},policies:{overlap:'SKIP',catchupWindow:'1 hour'},
  action:{type:'startWorkflow',workflowType:'meriConversationRetentionWorkflow',taskQueue:'existing-meri-queue',args:[]}});
});
test('activity forwards only its cursor on the existing control channel and bounds the call',async()=>{
 const signal=new AbortController().signal,calls=[];let beats=0;
 const activity=createRetentionSweepActivity({now:()=>1000,context:()=>({cancellationSignal:signal,heartbeat(){beats++;}}),native:{async call(...args){calls.push(args);return {after:'tenant:conversation:id',more:false,outcome:'unknown'};}}});
 assert.equal((await activity({after:null})).outcome,'unknown');assert.equal(beats,2);
 assert.deepEqual(calls,[['retention/sweep',{after:null},{signal,deadlineMs:1000+RETENTION_SWEEP_BUDGET.nativeMs,maxRequestMs:RETENTION_SWEEP_BUDGET.nativeMs}]]);
 await assert.rejects(activity({after:null,tenantId:'injected'}));assert.equal(calls.length,1);
});

test('actual Temporal workflow schedules the retention activity with outer margins and unchanged retry count',async()=>{
 // Upstream isolate with synthetic activations, matching the existing recovery
 // workflow tests. This verifies emitted command options, not live durability.
 globalThis.AsyncLocalStorage=AsyncLocalStorage;
 const require=createRequire(import.meta.url),{Activator}=require('@temporalio/workflow/lib/internals'),{setActivator}=require('@temporalio/workflow/lib/global-attributes'),{defaultPayloadConverter}=require('@temporalio/common');
 const {meriConversationRetentionWorkflow}=await import('../../control/retention/workflow.ts');
 const a=new Activator({info:{workflowType:'meriConversationRetentionWorkflow',workflowId:'synthetic',runId:'00000000-0000-4000-8000-000000000001',taskQueue:'synthetic',unsafe:{isReplaying:false},historyLength:1,historySize:0},now:0,randomnessSeed:new Uint8Array([1]),registeredActivityNames:new Set(['sweepConversationRetention']),getTimeOfDay:()=>0,stackTracesEnabled:false,showStackTraceSources:false});
 setActivator(a);try{
  const result=meriConversationRetentionWorkflow({after:null});for(let i=0;i<12;i++)await Promise.resolve();
  const scheduled=a.commands.filter(c=>c.scheduleActivity).map(c=>c.scheduleActivity);assert.equal(scheduled.length,1);const command=scheduled[0];
  const ms=d=>Number(d?.seconds??0)*1000+Number(d?.nanos??0)/1e6;
  assert.equal(command.activityType,'sweepConversationRetention');assert.deepEqual(defaultPayloadConverter.fromPayload(command.arguments[0]),{after:null});
  assert.equal(ms(command.startToCloseTimeout),75000);assert.equal(ms(command.heartbeatTimeout),75000);assert.equal(command.retryPolicy.maximumAttempts,3);
  assert.deepEqual(Object.values(RETENTION_SWEEP_BUDGET),[60000,65000,70000,75000]);
  a.resolveActivity({seq:command.seq,result:{completed:{result:defaultPayloadConverter.toPayload({after:'canonical',more:false,outcome:'executed'})}}});
  assert.deepEqual(await result,{visited:1,executed:1,blocked:0,unknown:0,more:false});
 }finally{setActivator(undefined);}
});
