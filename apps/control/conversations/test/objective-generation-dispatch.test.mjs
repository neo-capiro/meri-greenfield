import test from 'node:test';
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {Connection} from '@temporalio/client';
import {createObjectiveGenerationDispatcher,objectiveGenerationWorkflowId} from '../objective-generation-dispatch.mjs';
import {binding,id} from './application-fixture.mjs';

/** Installed Temporal 1.24 scope methods and generated gRPC bridge; only makeUnaryRequest is synthetic. */
function fixture({park=false}={}){
 const context=new AsyncLocalStorage(),calls=[],connection={callContextStorage:context,withDeadline:Connection.prototype.withDeadline,withAbortSignal:Connection.prototype.withAbortSignal};
 const rpc=Connection.generateRPCImplementation({serviceName:'temporal.api.workflowservice.v1.WorkflowService',client:{makeUnaryRequest(path,serialize,deserialize,request,metadata,options,callback){
  const call={path,options,context:context.getStore(),finished:false};calls.push(call);
  if(!park)queueMicrotask(()=>{call.finished=true;callback(null,Buffer.alloc(0));});
  return {cancel(){if(call.finished)return;call.finished=true;callback(Object.assign(Error('Synthetic RPC cancelled'),{code:1}));}};
 }},callContextStorage:context,interceptors:[],staticMetadata:{},apiKeyFnRef:{}});
 const send=method=>new Promise((resolve,reject)=>rpc({name:method},Buffer.alloc(0),(error,value)=>error?reject(error):resolve(value))),starts=[],signals=[];
 const client={connection,workflow:{async start(name,options){starts.push({name,options});await send('StartWorkflowExecution');},
  getHandle(workflowId){return {async signal(name){signals.push({workflowId,name});await send('SignalWorkflowExecution');}};}}};
 return {calls,starts,signals,dispatcher:createObjectiveGenerationDispatcher({client,taskQueue:'synthetic-only',maxRequestMs:1000})};
}
const source={generationJobId:id(900),binding,notAfterMs:Date.now()+3600000};

test('start uses one deduplicated workflow per tenant and generation job with only server-owned input',async()=>{
 const f=fixture(),deadlineMs=Date.now()+500,out=await f.dispatcher.start({source,deadlineMs});
 const expected=objectiveGenerationWorkflowId({tenantId:binding.tenantId,generationJobId:source.generationJobId});
 assert.deepEqual(out,{workflowId:expected});assert.equal(f.starts[0].name,'meriObjectiveGenerationWorkflow');
 assert.equal(f.starts[0].options.workflowIdReusePolicy,'REJECT_DUPLICATE');assert.equal(f.starts[0].options.workflowIdConflictPolicy,'USE_EXISTING');
 assert.deepEqual(f.starts[0].options.args,[source]);assert.equal(f.calls[0].options.deadline,deadlineMs);
});

test('start refuses malformed or extra input before any RPC',async()=>{
 const f=fixture();
 for(const bad of [{...source,prompt:'x'},{...source,generationJobId:'job'},{...source,notAfterMs:'soon'},{...source,binding:{...binding,writerFence:0}}])
  await assert.rejects(f.dispatcher.start({source:bad}));
 assert.equal(f.calls.length,0);
});

test('a lost start acknowledgement is TEMPORAL_DISPATCH_UNKNOWN and is not retried',async()=>{
 const f=fixture({park:true});
 await assert.rejects(f.dispatcher.start({source,deadlineMs:Date.now()+50}),e=>e.code==='TEMPORAL_DISPATCH_UNKNOWN');assert.equal(f.calls.length,1);
});

test('stop signals the same deterministic workflow',async()=>{
 const f=fixture();await f.dispatcher.stop({tenantId:binding.tenantId,generationJobId:source.generationJobId});
 assert.deepEqual(f.signals,[{workflowId:objectiveGenerationWorkflowId({tenantId:binding.tenantId,generationJobId:source.generationJobId}),name:'meriObjectiveGenerationStop'}]);
});
