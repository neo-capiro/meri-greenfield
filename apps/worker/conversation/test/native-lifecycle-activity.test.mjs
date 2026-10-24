import test from 'node:test';import assert from 'node:assert/strict';
import {createConversationActivity} from '../activity.mjs';
import {binding,scopes,versions,id} from '../../../control/conversations/test/store-fixture.mjs';
import {SDK_MODEL_CONFIGURATION} from '../../../control/conversations/usage.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
function fixture({action='pause',fault,waitDrain,waitFlush}={}){
 const request={requestId:id(100),prompt:'Synthetic native pause',window:null,windowRequest:null,skill:null},sessionId=id(101),controlId=id(102),abort=new AbortController(),events=[],order=[];
 const command={controlId,action,binding,contextSha256:hash({window:null,skill:null,scopes}),...(action==='waitForApproval'?{proposalId:id(103),proposalSha256:'a'.repeat(64)}:{})},entry={controlSequence:1,command,commandSha256:hash(command)};
 const started=Promise.withResolvers(),stop=Promise.withResolvers();let delivered=false,calls=0,records=0,closed=0;
 const runOwner={load:async()=>({run:{binding,scopes,versions,state:'queued',createdAt:new Date().toISOString(),policyRevision:'policy1'},request}),append:async({event})=>events.push(event),
  nextControls:async()=>{await started.promise;if(delivered)return [];delivered=true;return [entry];},claimControl:async()=>({claimed:true,control:entry}),ackControl:async({input})=>order.push('ack:'+input.outcome),
  recordCheckpoint:async({input})=>{records++;order.push('record');assert.deepEqual(input,{controlId,sessionId});if(fault==='record')throw Error('synthetic lost commit');
   return {controlId,intent:action==='pause'?'pause':'approval.wait',sourceBinding:binding,inputSha256:hash(command),state:'APPLIED',checkpointId:fault==='receipt'?id(199):binding.runId,targetBinding:null,admissionReceiptId:null,retirementReceiptId:null,replayed:false};}};
 const query=()=>{calls++;return {async *[Symbol.asyncIterator](){yield {type:'system',subtype:'init',session_id:sessionId};started.resolve();await stop.promise;},
  interrupt:async()=>{order.push('interrupt');if(fault==='interrupt')throw Error('synthetic interrupt');return {still_queued:[]};},close(){closed++;order.push('close');stop.resolve();},
  async return(){order.push('draining');if(waitDrain)await waitDrain;if(fault==='drain')throw Error('synthetic drain');order.push('drained');return {done:true};}};};
 const captureCheckpoint=async()=>{assert.ok(order.includes('drained'));order.push('flushing');if(waitFlush)await waitFlush;if(fault==='flush')throw Error('synthetic flush');order.push('flushed');};
 const execute=createConversationActivity({runOwner,query,cleanupAttemptMs:20,terminalAttemptMs:20,
  prepareRuntime:async()=>({binding,versions,...SDK_MODEL_CONFIGURATION,providerEnvironment:{},cwd:`/workspace/conversations/${binding.conversationId}`,sessionStore:{load:async()=>null,append:async()=>{}},deadlineMs:Date.now()+2000,maxTurns:20,maxCostMicroUSD:2000000,maxOutputBytes:4096}),
  lifecycle:{captureCheckpoint,captureOwnsClose:true,pollMs:5}});
 return {abort,order,events,run:()=>execute({binding,signal:abort.signal}),counts:()=>({calls,records,closed})};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
for(const action of ['pause','waitForApproval'])test(`${action} records only after actual SDK return and SessionStore flush`,async()=>{const drain=Promise.withResolvers(),flush=Promise.withResolvers(),f=fixture({action,waitDrain:drain.promise,waitFlush:flush.promise}),run=f.run();
 while(!f.order.includes('draining'))await tick();assert.equal(f.counts().records,0);drain.resolve();while(!f.order.includes('flushing'))await tick();assert.equal(f.counts().records,0);flush.resolve();
 assert.deepEqual(await run,{state:action==='pause'?'paused':'waiting-for-approval'});assert.deepEqual(f.order,['interrupt','close','draining','drained','flushing','flushed','record']);assert.deepEqual(f.counts(),{calls:1,records:1,closed:1});
 assert.deepEqual(f.events.filter(e=>e.type==='run.status').map(e=>e.data.state),['starting','running']);
});
for(const fault of ['interrupt','drain','flush','record','receipt'])test(`${fault} failure never reports a held capture or replays the model`,async()=>{const f=fixture({fault});await assert.rejects(f.run());assert.equal(f.counts().calls,1);assert.equal(f.counts().records,['record','receipt'].includes(fault)?1:0);
 assert.ok(!f.events.some(e=>e.data?.state==='completed'));assert.ok(f.order.includes('ack:UNKNOWN'));assert.equal(f.counts().closed,1);
});
for(const phase of ['draining','flushing'])test(`cancellation during ${phase} leaves no captured receipt`,async()=>{const wait=Promise.withResolvers(),f=fixture(phase==='draining'?{waitDrain:wait.promise}:{waitFlush:wait.promise}),run=f.run(),rejected=assert.rejects(run);
 while(!f.order.includes(phase))await tick();f.abort.abort();await rejected;assert.equal(f.counts().records,0);wait.resolve();await tick();assert.equal(f.counts().records,0);assert.equal(f.counts().calls,1);
});
