/** Terminal settlement over the real control service/store (scripted SQL), with the run owner's append wrapped to model
 * recording latency, lost acknowledgements and the remote runner's code-independent refusals (NATIVE_UNAVAILABLE). */
import test from 'node:test';import assert from 'node:assert/strict';import {createConversationActivity,TERMINAL_ATTEMPT_MS} from '../activity.mjs';import {applicationFixture,binding,versions,id} from '../../../control/conversations/test/application-fixture.mjs';
const runtime=()=>({binding,versions,cwd:`/workspace/conversations/${binding.conversationId}`,proxyUrl:'https://trusted-proxy.invalid',proxyCredential:'synthetic-task-capability',model:'qualified-model-pin',sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+1000,maxTurns:2,maxCostMicroUSD:1000,maxOutputBytes:2});
const frames=[{type:'assistant',parent_tool_use_id:null,message:{id:'msg_1',content:[{type:'text',text:'Too long for the limit'}]}},{type:'result',subtype:'success',is_error:false}];
const terminal=event=>event.type==='run.status'&&['failed','cancelled'].includes(event.data.state);
const unavailable=()=>Object.assign(Error('NATIVE_UNAVAILABLE'),{code:'NATIVE_UNAVAILABLE'});
const wait=(ms,signal)=>new Promise((resolve,reject)=>{const t=setTimeout(resolve,ms);signal?.addEventListener('abort',()=>{clearTimeout(t);reject(signal.reason);},{once:true});});
async function setup(append,options={}){const f=await applicationFixture();await f.service.submit({credential:f.credential,input:f.input});let n=300;const attempts=[];
 const runOwner={...f.runOwner,async append(args){if(!terminal(args.event))return f.runOwner.append(args);attempts.push(args.event);return append(args,()=>f.runOwner.append(args).catch(()=>{throw unavailable();}));}};
 const execute=createConversationActivity({runOwner,prepareRuntime:async()=>runtime(),query:()=>({async *[Symbol.asyncIterator](){yield* frames;},close(){}}),newId:()=>id(n++),...options});
 return {f,attempts,execute,state:async()=>(await f.service.history({credential:f.credential})).run.state,terminals:async()=>(await f.service.history({credential:f.credential})).events.filter(terminal)};}
test('the per-attempt acknowledgement bound is the control service request bound, not 30 ms',()=>{assert.equal(TERMINAL_ATTEMPT_MS,3000);assert.throws(()=>createConversationActivity({runOwner:{load(){},append(){}},prepareRuntime(){},terminalAttemptMs:30001}),/ACTIVITY_CONFIGURATION/);});
test('terminal recording slower than 30 ms is acknowledged on the first attempt',async()=>{const s=await setup(async({signal},write)=>{await wait(45,signal);return write();});try{
 await assert.rejects(s.execute({binding}),/EXECUTION_FAILED/);assert.equal(await s.state(),'failed');assert.equal(s.attempts.length,1);assert.deepEqual((await s.terminals()).map(e=>e.data.reasonCode),['EXECUTION_FAILED']);}finally{s.f.close();}});
test('a lost acknowledgement is read back by replaying the same event ID; no second terminal event',async()=>{let lost=false;const s=await setup(async(args,write)=>{const r=await write();if(!lost){lost=true;throw unavailable();}return r;});try{
 await assert.rejects(s.execute({binding}),/EXECUTION_FAILED/);assert.deepEqual(s.attempts.map(e=>e.data.reasonCode),['EXECUTION_FAILED','HOLD_CHECKPOINT_FAILED','EXECUTION_FAILED']);assert.equal(s.attempts[2].eventId,s.attempts[0].eventId);
 const t=await s.terminals();assert.equal(t.length,1);assert.equal(t[0].eventId,s.attempts[0].eventId);}finally{s.f.close();}});
test('never acknowledged: settlement is finite (two rounds over two fixed event IDs) and leaves the run nonterminal for the reconciler',async()=>{const s=await setup(({signal})=>wait(60000,signal),{terminalAttemptMs:20});try{
 const started=Date.now();await assert.rejects(s.execute({binding}),/EXECUTION_FAILED/);assert.ok(Date.now()-started<2000);
 assert.equal(s.attempts.length,4);assert.equal(new Set(s.attempts.map(e=>e.eventId)).size,2);assert.equal(await s.state(),'running');assert.equal((await s.terminals()).length,0);}finally{s.f.close();}});
