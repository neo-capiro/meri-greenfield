import test from 'node:test';
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {Connection} from '@temporalio/client';
import {createTemporalConversationDispatcher,workflowId} from '../temporal-dispatch.mjs';
import {binding,id} from './application-fixture.mjs';

/** Exercise installed Temporal 1.24 scope methods AND its generated gRPC bridge.
 * Only makeUnaryRequest is substituted; there is no server or network channel. */
function fixture({park=false,ignoreCancellation=false,now=Date.now,maxRequestMs=1000}={}){
 const context=new AsyncLocalStorage(),calls=[],state={cancelled:0,acks:0},connection={callContextStorage:context,withDeadline:Connection.prototype.withDeadline,withAbortSignal:Connection.prototype.withAbortSignal};
 const rpc=Connection.generateRPCImplementation({serviceName:'temporal.api.workflowservice.v1.WorkflowService',client:{makeUnaryRequest(path,serialize,deserialize,request,metadata,options,callback){
  const call={path,options,context:context.getStore(),callback,finished:false,ack(){if(call.finished)return;call.finished=true;state.acks++;callback(null,Buffer.alloc(0));}};calls.push(call);
  if(!park)queueMicrotask(()=>call.ack());return {cancel(){if(call.finished)return;state.cancelled++;if(ignoreCancellation)return;call.finished=true;callback(Object.assign(Error('Synthetic RPC cancelled'),{code:1}));}};
 }},callContextStorage:context,interceptors:[],staticMetadata:{},apiKeyFnRef:{}});
 const send=method=>new Promise((resolve,reject)=>rpc({name:method},Buffer.alloc(0),(error,value)=>error?reject(error):resolve(value))),starts=[];
 const client={connection,workflow:{async start(name,options){starts.push({name,options});await send('StartWorkflowExecution');},getHandle(value){assert.equal(value,workflowId(binding));return {async signal(name,input){await send(name);},async cancel(){await send('RequestCancelWorkflowExecution');}};}}};
 return {client,calls,state,starts,dispatcher:createTemporalConversationDispatcher({client,taskQueue:'synthetic-only',lifecycle:true,now,maxRequestMs})};
}
const input={controlId:id(800),sourceRunId:binding.runId,targetRunId:id(801),admissionReceiptId:id(802),retirementReceiptId:id(803)};
const untilRpc=async f=>{for(let i=0;i<50&&!f.calls.length;i++)await new Promise(resolve=>setImmediate(resolve));assert.equal(f.calls.length,1);};
test('installed SDK scopes reach start RPC with exact verified deadline and native cancellation signal',async()=>{
 const f=fixture(),signal=new AbortController().signal,deadlineMs=Date.now()+500;await f.dispatcher.start({binding,signal,deadlineMs});
 assert.equal(f.calls[0].options.deadline,deadlineMs);assert.ok(f.calls[0].context.abortSignal instanceof AbortSignal);assert.equal(f.starts[0].options.workflowId,workflowId(binding));assert.equal(f.starts[0].options.workflowIdReusePolicy,'REJECT_DUPLICATE');assert.equal(f.starts[0].options.workflowIdConflictPolicy,'USE_EXISTING');assert.equal(f.calls.length,1);
});
for(const operation of ['start','continued'])test(operation+' parked RPC is cancelled by verified deadline with one dispatch and no late ACK success',async()=>{
 const f=fixture({park:true,ignoreCancellation:true}),deadlineMs=Date.now()+40,work=operation==='start'?f.dispatcher.start({binding,deadlineMs}):f.dispatcher.continued({binding,input,deadlineMs});let outcome='pending';work.then(()=>{outcome='succeeded';},()=>{outcome='unknown';});
 const rejected=assert.rejects(work,/TEMPORAL_DISPATCH_UNKNOWN/);await untilRpc(f);assert.equal(f.calls[0].options.deadline,deadlineMs);await rejected;assert.equal(f.state.cancelled,1);f.calls[0].ack();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.state.acks,1);assert.equal(outcome,'unknown');assert.equal(f.calls.length,1);
});
for(const operation of ['start','continued'])test(operation+' caller cancellation reaches actual SDK call.cancel before late acknowledgement',async()=>{
 const f=fixture({park:true}),abort=new AbortController(),deadlineMs=Date.now()+1000,work=operation==='start'?f.dispatcher.start({binding,signal:abort.signal,deadlineMs}):f.dispatcher.continued({binding,input,signal:abort.signal,deadlineMs});
 const rejected=assert.rejects(work);await untilRpc(f);abort.abort();await rejected;assert.equal(f.state.cancelled,1);assert.equal(f.calls.length,1);f.calls[0].ack();assert.equal(f.state.acks,0);
});
test('legacy start/cancel without explicit deadline still scopes bounded RPCs',async()=>{
 const at=Date.now(),f=fixture({now:()=>at,maxRequestMs:100});await f.dispatcher.start({binding});await f.dispatcher.cancel({binding});assert.equal(f.calls.length,2);assert.deepEqual(f.calls.map(c=>c.options.deadline),[at+100,at+100]);
});
test('explicit late deadline is capped by configured dispatch bound',async()=>{
 const at=Date.now(),f=fixture({now:()=>at,maxRequestMs:100});await f.dispatcher.continued({binding,input,deadlineMs:at+1000});assert.equal(f.calls[0].options.deadline,at+100);
});
test('transport missing either supported SDK scope refuses before workflow invocation',async()=>{
 for(const missing of ['withDeadline','withAbortSignal']){const f=fixture();delete f.client.connection[missing];await assert.rejects(f.dispatcher.start({binding,deadlineMs:Date.now()+100}),/TEMPORAL_TRANSPORT_UNAVAILABLE/);await assert.rejects(f.dispatcher.continued({binding,input,deadlineMs:Date.now()+100}),/TEMPORAL_TRANSPORT_UNAVAILABLE/);assert.equal(f.calls.length,0);assert.equal(f.starts.length,0);}
});
test('expired/invalid deadlines and aborted signals cannot dispatch',async()=>{
 const f=fixture();for(const deadlineMs of [Date.now()-1,NaN,Infinity,1.5])await assert.rejects(f.dispatcher.start({binding,deadlineMs}));await assert.rejects(f.dispatcher.continued({binding,input,signal:AbortSignal.abort(),deadlineMs:Date.now()+100}));assert.equal(f.calls.length,0);
});
test('post-RPC expiry refuses success and never invokes a second operation',async()=>{
 const at=Date.now();let observed=at;const f=fixture({now:()=>observed}),start=f.client.workflow.start;f.client.workflow.start=async(...args)=>{await start(...args);observed=at+100;};await assert.rejects(f.dispatcher.start({binding,deadlineMs:at+50}),/TEMPORAL_DISPATCH_UNKNOWN/);assert.equal(f.calls.length,1);assert.equal(f.state.acks,1);
});
test('wake-only signal keeps control text out of Temporal argument payload',async()=>{
 const f=fixture();await f.dispatcher.signal({binding,command:{controlId:id(804),action:'steer',binding,contextSha256:'a'.repeat(64),prompt:'private synthetic text'},deadlineMs:Date.now()+100});assert.equal(f.calls[0].path.endsWith('/meriControlsAvailable'),true);
});
