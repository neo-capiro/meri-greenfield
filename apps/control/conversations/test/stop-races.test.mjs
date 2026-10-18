/** SYNTHETIC Stop races over the canonical lifecycle service, scripted SQL store and the installed Temporal 1.24 client error mapping.
 * No PostgreSQL, Temporal server or native task: these prove source behavior only, not physical stop. */
import test from 'node:test';import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {Client,Connection} from '@temporalio/client';
import {applicationFixture,binding,id} from './application-fixture.mjs';
import {createConversationLifecycleService} from '../lifecycle/service.mjs';
import {createTemporalConversationDispatcher,workflowId} from '../temporal-dispatch.mjs';
import {createOriginalReconciler} from '../../../runtime/original-stop.mjs';
import {hash} from '../boundary.mjs';
import {createConversationLifecycleApplication} from '../lifecycle/http.mjs';

const status=(n,state,reasonCode=null)=>({eventId:id(n),createdAt:new Date().toISOString(),type:'run.status',data:{state,reasonCode}});
const unavailable=()=>Object.assign(Error('TEMPORAL_DISPATCH_UNKNOWN'),{code:'TEMPORAL_DISPATCH_UNKNOWN'});

/** The production composition: lifecycle cancel over the basic service, with only the journal's cancel and the dispatcher's cancel observable. */
async function stopFixture({cancelJournal,cancelWorkflow,stopOriginal,maxRequestMs=3000}={}){
 const f=await applicationFixture({transitions:true,initialInput:true}),journal=f.store.lifecycle,calls={cancels:[],native:[]};let n=500;
 const store={...f.store,lifecycle:{...journal,cancel:(...args)=>cancelJournal?cancelJournal(journal,...args):journal.cancel(...args)}};
 const dispatcher={...f.dispatcher,async signal(){},async continued(){},async cancel(input){calls.cancels.push(input.binding.runId);return cancelWorkflow?cancelWorkflow(input):{workflow:'CANCEL_REQUESTED'};}};
 const native={async call(operation,input,{signal}){calls.native.push({operation,input});assert.equal(signal.aborted,false);assert.ok(['completed','failed','cancelled'].includes((await f.store.read(binding,{after:0,limit:1},()=>{})).run.state),'native cleanup follows the durable terminal fence');return stopOriginal?stopOriginal(input,signal):{...input,expiresAtMs:1};}};
 const make=()=>createConversationLifecycleService({service:f.service,store,dispatcher,reconcileOriginal:createOriginalReconciler({native,timeoutMs:maxRequestMs}),maxRequestMs,checkpoints:{async read(){throw Error('unused');}},sessions:f.sessions,newId:()=>id(n++)});
 const publish=state=>f.service.publish({credential:f.credential,binding,event:status(n++,state)});
 async function running(){await f.service.allocateInput({credential:f.credential,input:f.input});await f.service.submit({credential:f.credential,input:f.input});await publish('starting');await publish('running');}
 const read=async()=>{const saved=await f.store.read(binding,{after:0,limit:100},()=>{});return {state:saved.run.state,cancelled:saved.events.filter(e=>e.data?.reasonCode==='USER_CANCELLED').length};};
 return {f,calls,make,publish,running,read,stop:(service=make(),signal)=>service.cancel({credential:f.credential,signal})};
}

test('Stop racing a natural completion reports completed and writes no cancellation',async()=>{
 let x;x=await stopFixture({async cancelJournal(journal,...args){await x.publish('completed');return journal.cancel(...args);}});
 try{await x.running();assert.deepEqual(await x.stop(),{state:'completed'});assert.deepEqual(await x.read(),{state:'completed',cancelled:0});assert.deepEqual(x.calls.cancels,[binding.runId]);}finally{x.f.close();}
});

test('a committed cancellation behind a lost acknowledgement is reported once, not repeated',async()=>{
 const x=await stopFixture({async cancelJournal(journal,...args){await journal.cancel(...args);throw Error('synthetic lost COMMIT acknowledgement');}});
 try{await x.running();assert.deepEqual(await x.stop(),{state:'cancelled'});assert.deepEqual(await x.read(),{state:'cancelled',cancelled:1});}finally{x.f.close();}
});

test('a refused cancellation of a still-live run stays an error and writes nothing',async()=>{
 const x=await stopFixture({async cancelJournal(){throw Object.assign(Error('STORE_UNAVAILABLE'),{code:'STORE_UNAVAILABLE'});}});
 try{await x.running();await assert.rejects(x.stop(),/STORE_UNAVAILABLE/);assert.deepEqual(await x.read(),{state:'running',cancelled:0});assert.deepEqual(x.calls.cancels,[]);}finally{x.f.close();}
});

test('an unknown Temporal cancel keeps the durable fence; Stop after a control restart asks again without a second write',async()=>{
 let lost=true;const x=await stopFixture({async cancelWorkflow(){if(lost)throw unavailable();return {workflow:'CANCEL_REQUESTED'};}});
 try{await x.running();await assert.rejects(x.stop(),/LIFECYCLE_STOP_UNKNOWN/);assert.deepEqual(await x.read(),{state:'cancelled',cancelled:1});assert.equal(x.calls.native.length,1,'unknown Temporal cancellation still attempts native cleanup');
  lost=false;const restarted=x.make();
  assert.deepEqual(await x.stop(restarted),{state:'cancelled'});assert.deepEqual(await x.stop(restarted),{state:'cancelled'});
  assert.deepEqual(await x.read(),{state:'cancelled',cancelled:1});assert.deepEqual(x.calls.cancels,[binding.runId,binding.runId,binding.runId]);assert.equal(x.calls.native.length,3);
 }finally{x.f.close();}
});

test('Stop of a queued run whose workflow never started needs native reconciliation as well as Temporal NOT_FOUND',async()=>{
 const x=await stopFixture({async cancelWorkflow(){return {workflow:'NOT_FOUND'};}});
 try{await x.f.service.allocateInput({credential:x.f.credential,input:x.f.input});x.f.state.startUnknown=true;await assert.rejects(x.f.service.submit({credential:x.f.credential,input:x.f.input}));
  assert.equal((await x.read()).state,'queued');assert.deepEqual(await x.stop(),{state:'cancelled'});assert.deepEqual(await x.read(),{state:'cancelled',cancelled:1});assert.deepEqual(x.calls.native,[{operation:'execution/kickoff/stop',input:{binding,executionId:hash(binding)}}]);
  // A replayed submit after Stop never dispatches the cancelled run again.
  const starts=x.f.state.starts;x.f.state.startUnknown=false;await x.f.service.submit({credential:x.f.credential,input:x.f.input}).catch(()=>{});assert.equal(x.f.state.starts,starts);
 }finally{x.f.close();}
});

test('Stop of an already completed run whose workflow closed answers completed',async()=>{
 const x=await stopFixture({async cancelWorkflow(){return {workflow:'NOT_FOUND'};}});
 try{await x.running();await x.publish('completed');assert.deepEqual(await x.stop(),{state:'completed'});assert.deepEqual(await x.read(),{state:'completed',cancelled:0});assert.equal(x.calls.native.length,1);}finally{x.f.close();}
});

test('a lost cleanup acknowledgement is UNKNOWN; repeated Stop after restart reconciles the same execution without a second cancellation',async()=>{
 let lost=true;const x=await stopFixture({async cancelWorkflow(){return {workflow:'NOT_FOUND'};},async stopOriginal(input){if(lost)throw Error('lost retirement acknowledgement');return {...input,expiresAtMs:1};}});
 try{await x.running();const starts=x.f.state.starts;await assert.rejects(x.stop(),error=>error.code==='LIFECYCLE_STOP_UNKNOWN'&&error.outcome==='UNKNOWN');assert.deepEqual(await x.read(),{state:'cancelled',cancelled:1});
  lost=false;assert.deepEqual(await x.stop(x.make()),{state:'cancelled'});assert.deepEqual(await x.stop(),{state:'cancelled'});assert.equal(x.f.state.starts,starts);assert.equal(x.calls.cancels.length,3);assert.equal(x.calls.native.length,3);for(const call of x.calls.native)assert.deepEqual(call,{operation:'execution/kickoff/stop',input:{binding,executionId:hash(binding)}});assert.deepEqual(await x.read(),{state:'cancelled',cancelled:1});
 }finally{x.f.close();}
});

for(const mode of ['binding','execution','missing','revocation'])test(`Stop refuses ${mode} cleanup evidence even when the workflow is already closed`,async()=>{
 const x=await stopFixture({async cancelWorkflow(){return {workflow:'NOT_FOUND'};},async stopOriginal(input){if(mode==='revocation')throw Error('revocation UNKNOWN');if(mode==='missing')return undefined;return {...input,...(mode==='binding'?{binding:{...input.binding,writerFence:input.binding.writerFence+1}}:{executionId:'f'.repeat(64)}),expiresAtMs:1};}});
 try{await x.running();await x.publish('completed');await assert.rejects(x.stop(),error=>error.code==='LIFECYCLE_STOP_UNKNOWN'&&error.outcome==='UNKNOWN');assert.deepEqual(await x.read(),{state:'completed',cancelled:0});assert.equal(x.calls.cancels.length,1);assert.equal(x.calls.native.length,1);}finally{x.f.close();}
});

for(const blocked of ['temporal','native'])test(`both Stop owners are attempted when ${blocked} stalls`,async()=>{
 const stall=signal=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
 const x=await stopFixture({maxRequestMs:250,...(blocked==='temporal'?{cancelWorkflow:({signal})=>stall(signal)}:{stopOriginal:(_,signal)=>stall(signal)})});
 try{await x.running();await assert.rejects(x.stop(),/LIFECYCLE_STOP_UNKNOWN/);assert.equal(x.calls.cancels.length,1);assert.equal(x.calls.native.length,1);assert.deepEqual(await x.read(),{state:'cancelled',cancelled:1});}finally{x.f.close();}
});

test('a caller disconnect during Temporal cancellation still permits independent native cleanup',async()=>{
 const abort=new AbortController(),x=await stopFixture({async cancelWorkflow(){abort.abort();return {workflow:'CANCEL_REQUESTED'};}});
 try{await x.running();await assert.rejects(x.stop(x.make(),abort.signal));assert.equal(x.calls.cancels.length,1);assert.equal(x.calls.native.length,1);assert.deepEqual(await x.read(),{state:'cancelled',cancelled:1});}finally{x.f.close();}
});

for(const lost of [false,true])test(`disconnect immediately after the durable cancellation${lost?' with lost acknowledgement':''} cannot skip either stop owner`,async()=>{
 const abort=new AbortController(),x=await stopFixture({async cancelJournal(journal,...args){const receipt=await journal.cancel(...args);abort.abort();if(lost)throw Error('lost cancellation acknowledgement');return receipt;}});
 try{await x.running();await assert.rejects(x.stop(x.make(),abort.signal),error=>error.code==='LIFECYCLE_STOP_UNKNOWN'&&error.outcome==='UNKNOWN');assert.equal(x.calls.cancels.length,1);assert.equal(x.calls.native.length,1);assert.deepEqual(await x.read(),{state:'cancelled',cancelled:1});}finally{x.f.close();}
});

test('public HTTP Stop refuses success when native cleanup is UNKNOWN and preserves the durable fence',async()=>{
 const x=await stopFixture({async stopOriginal(){throw Error('revocation UNKNOWN');}});
 try{await x.running();const app=createConversationLifecycleApplication({service:x.make()}),response=await app.handle(new Request('https://meri.invalid/api/conversations/cancel',{method:'POST',headers:{authorization:`Bearer ${x.f.credential}`,'content-type':'application/json'},body:'{}'}));assert.equal(response.status,502);assert.deepEqual(await response.json(),{error:{code:'CONVERSATION_UNAVAILABLE'}});assert.equal(x.calls.cancels.length,1);assert.equal(x.calls.native.length,1);assert.deepEqual(await x.read(),{state:'cancelled',cancelled:1});}finally{x.f.close();}
});

test('revoked session refuses Stop before any fence or native effect',async()=>{
 const x=await stopFixture();try{await x.running();x.f.state.revoked=true;await assert.rejects(x.stop());assert.equal(x.calls.cancels.length,0);assert.equal(x.calls.native.length,0);assert.deepEqual(await x.read(),{state:'running',cancelled:0});}finally{x.f.close();}
});

test('revocation after an acknowledged terminal fence suppresses success but cannot skip stop-only cleanup',async()=>{
 let x;x=await stopFixture({async cancelJournal(journal,...args){const receipt=await journal.cancel(...args);x.f.state.revoked=true;return receipt;}});
 try{await x.running();await assert.rejects(x.stop(),error=>error.code==='LIFECYCLE_STOP_UNKNOWN'&&error.outcome==='UNKNOWN');assert.equal(x.calls.cancels.length,1);assert.equal(x.calls.native.length,1);assert.deepEqual(await x.read(),{state:'cancelled',cancelled:1});}finally{x.f.close();}
});

test('the lifecycle owner refuses composition without journal or dispatcher cancellation',async()=>{
 const f=await applicationFixture({transitions:true,initialInput:true});
 try{const base={service:f.service,checkpoints:{async read(){}},sessions:f.sessions,reconcileOriginal:async()=>({state:'reconciled'})};
  const journal={...f.store.lifecycle};delete journal.cancel;
  assert.throws(()=>createConversationLifecycleService({...base,store:{...f.store,lifecycle:journal},dispatcher:{...f.dispatcher,async signal(){}}}),/LIFECYCLE_CONFIGURATION/);
  assert.throws(()=>createConversationLifecycleService({...base,store:f.store,dispatcher:{async start(){},async signal(){}}}),/LIFECYCLE_CONFIGURATION/);
  assert.throws(()=>createConversationLifecycleService({...base,reconcileOriginal:undefined,store:f.store,dispatcher:{...f.dispatcher,async signal(){}}}),/LIFECYCLE_CONFIGURATION/);
 }finally{f.close();}
});

/** Installed Temporal 1.24 WorkflowClient over a substituted WorkflowService: gRPC NOT_FOUND becomes WorkflowNotFoundError in the client,
 * and the dispatcher maps only that to a definitive NOT_FOUND. */
function temporalClient(failure){
 const metadata={get:()=>[]},calls=[];
 const connection={callContextStorage:new AsyncLocalStorage(),withDeadline:Connection.prototype.withDeadline,withAbortSignal:Connection.prototype.withAbortSignal,withMetadata:Connection.prototype.withMetadata,operatorService:{},healthService:{},plugins:[],
  workflowService:{async requestCancelWorkflowExecution(request){calls.push(request.workflowExecution.workflowId);if(failure)throw Object.assign(Error(`${failure.code} ${failure.details}`),{...failure,metadata});return {};}}};
 return {calls,dispatcher:createTemporalConversationDispatcher({client:new Client({connection,namespace:'synthetic-only'}),taskQueue:'synthetic-only',lifecycle:true})};
}
test('Temporal cancel: requested, definitive NOT_FOUND, and every other failure UNKNOWN',async()=>{
 const ok=temporalClient();assert.deepEqual(await ok.dispatcher.cancel({binding}),{workflow:'CANCEL_REQUESTED'});assert.deepEqual(ok.calls,[workflowId(binding)]);
 const closed=temporalClient({code:5,details:'workflow execution already completed'});assert.deepEqual(await closed.dispatcher.cancel({binding}),{workflow:'NOT_FOUND'});
 for(const failure of [{code:14,details:'connection unavailable'},{code:4,details:'deadline exceeded'},{code:7,details:'permission denied'}])
  await assert.rejects(temporalClient(failure).dispatcher.cancel({binding}),/TEMPORAL_DISPATCH_UNKNOWN/);
});
