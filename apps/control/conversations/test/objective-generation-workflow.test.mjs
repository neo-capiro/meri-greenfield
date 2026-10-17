// Upstream workflow isolate Activator, synthetic activations only; no Temporal server, durability or Core claim.
import test from 'node:test';import assert from 'node:assert/strict';import {AsyncLocalStorage} from 'node:async_hooks';import {createRequire} from 'node:module';
globalThis.AsyncLocalStorage=AsyncLocalStorage;
const require=createRequire(import.meta.url),{Activator}=require('@temporalio/workflow/lib/internals'),{setActivator}=require('@temporalio/workflow/lib/global-attributes'),{tryUnblockConditions}=require('@temporalio/workflow/lib/worker-interface'),{defaultPayloadConverter}=require('@temporalio/common');
const {meriObjectiveGenerationWorkflow}=await import('../objective-generation-workflow.ts');
const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-000000000000`,binding={tenantId:'synthetic',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const turn=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const names=['objectiveGenerationSource','objectiveGenerationStartRun','objectiveGenerationReadRun','objectiveGenerationComplete'];
function fixture(){
 const a=new Activator({info:{workflowType:'meriObjectiveGenerationWorkflow',workflowId:'meri:objective-generation:synthetic',runId:id(8),taskQueue:'synthetic',unsafe:{isReplaying:false},historyLength:1,historySize:0},
  now:0,randomnessSeed:new Uint8Array([1]),registeredActivityNames:new Set(names),getTimeOfDay:()=>0,stackTracesEnabled:false,showStackTraceSources:false});
 setActivator(a);const input={generationJobId:id(21),binding,notAfterMs:Date.now()+3600000};
 let settled=false;const result=meriObjectiveGenerationWorkflow(input);result.then(()=>settled=true,()=>settled=true);let seen=0;
 const next=()=>{const commands=a.commands.filter(c=>c.scheduleActivity||c.startTimer),command=commands[seen++];assert.ok(command,'expected a command');return command;};
 return {a,input,result,settled:()=>settled,query:()=>a.queryHandlers.get('meriObjectiveGenerationState').handler(),
  async resolve(type,value){await turn();const c=next();assert.equal(c.scheduleActivity?.activityType,type);assert.equal(c.scheduleActivity.retryPolicy.maximumAttempts,1);
   a.resolveActivity({seq:c.scheduleActivity.seq,result:{completed:{result:defaultPayloadConverter.toPayload(value)}}});await turn();return defaultPayloadConverter.fromPayload(c.scheduleActivity.arguments[0]);},
  async timer(seconds){await turn();const c=next();assert.ok(c.startTimer,'expected a durable wait');assert.equal(Number(c.startTimer.startToFireTimeout.seconds),seconds);a.fireTimer({seq:c.startTimer.seq});await turn();tryUnblockConditions();await turn();},
  async signal(name){a.signalWorkflow({signalName:name,input:[],headers:{}});await turn();tryUnblockConditions();await turn();}};
}
const ready=()=>({kind:'ready',sourceAdmissionSha256:'a'.repeat(64),requestSha256:'b'.repeat(64),effectExpiresAtMs:Date.now()+600000});

test('the workflow drives admission, one run start, durable observation and Core completion',async()=>{
 const f=fixture();try{
  assert.deepEqual(await f.resolve('objectiveGenerationSource',ready()),f.input);
  const start=await f.resolve('objectiveGenerationStartRun',{kind:'started'});assert.equal(start.mode,'effect');assert.equal(start.requestSha256,'b'.repeat(64));
  await f.resolve('objectiveGenerationReadRun',{kind:'state',state:'running'});assert.equal(f.query().phase,'running');
  await f.timer(30);
  await f.resolve('objectiveGenerationReadRun',{kind:'state',state:'completed'});
  const done=await f.resolve('objectiveGenerationComplete',{kind:'completed',strategyId:id(30),strategyVersionId:id(31),objectiveReceiptSha256:'c'.repeat(64)});
  assert.equal(done.sourceAdmissionSha256,'a'.repeat(64));
  const out=await f.result;assert.equal(out.phase,'completed');assert.equal(out.result.strategyId,id(30));
 }finally{setActivator(undefined);}
});

test('a lost start activity is reconciled by read-back after a durable settle wait, never restarted',async()=>{
 const f=fixture();try{
  await f.resolve('objectiveGenerationSource',ready());
  await turn();const c=f.a.commands.filter(x=>x.scheduleActivity)[1];
  f.a.resolveActivity({seq:c.scheduleActivity.seq,result:{failed:{failure:{message:'synthetic timeout',applicationFailureInfo:{type:'Synthetic',nonRetryable:false}}}}});
  // Skip the consumed start command in the fixture's cursor.
  await turn();const commands=()=>f.a.commands.filter(x=>x.scheduleActivity||x.startTimer);assert.ok(commands().at(-1).startTimer);
  assert.equal(f.query().phase,'run_unconfirmed');assert.equal(f.query().runStartAttempted,true);
 }finally{setActivator(undefined);}
});

test('stop before a run start ends the workflow without starting a run',async()=>{
 const f=fixture();try{
  await f.signal('meriObjectiveGenerationStop');
  await f.resolve('objectiveGenerationSource',{kind:'unconfirmed'});
  const out=await f.result;assert.equal(out.phase,'stopped');
  assert.equal(f.a.commands.filter(c=>c.scheduleActivity).length,1);
 }finally{setActivator(undefined);}
});

test('workflow cancellation propagates instead of being treated as an unconfirmed activity',async()=>{
 const f=fixture();try{
  await f.resolve('objectiveGenerationSource',ready());await turn();
  f.a.cancelWorkflow({});await turn();
  const pending=f.a.commands.filter(c=>c.scheduleActivity).at(-1);
  if(pending)f.a.resolveActivity({seq:pending.scheduleActivity.seq,result:{cancelled:{failure:{message:'cancelled',canceledFailureInfo:{}}}}});
  await turn();await assert.rejects(f.result,/cancel/i);
  assert.equal(f.query().phase,'starting_run','cancellation is not recorded as an unconfirmed start');
  assert.equal(f.a.commands.filter(c=>c.scheduleActivity&&c.scheduleActivity.activityType==='objectiveGenerationStartRun').length,1);
 }finally{setActivator(undefined);}
});
