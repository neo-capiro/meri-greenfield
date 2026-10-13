import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../../../packages/runtime/operation-lifetime.mjs';
import {buildContinuationOptions,continuationContextSha256} from '../options.mjs';
import {createConversationInput} from '../input.mjs';import {createSdkCommandAdapter} from '../commands.mjs';
import {continuationFixture,id,NOW} from './fixtures.mjs';
const life=(ms=1000,signal)=>createOperationLifetime({deadlineMs:Date.now()+ms,now:Date.now,signal,errorFactory:code=>new Error(code)});
for(const mode of ['resume','fork'])test(`SDK ${mode}: exact supported option delta, immutable request/skill/scopes, independent target`,()=>{
 const f=continuationFixture(mode),before=structuredClone(f),options=buildContinuationOptions(f.continuation,f.target);
 assert.deepEqual(f,before);assert.equal(options.resume,f.continuation.checkpoint.sessionId);assert.equal(options.resumeSessionAt,f.continuation.resumeSessionAt);
 assert.equal('continue'in options,false);assert.equal('env'in options,false);assert.equal('sessionStore'in options,false);
 assert.equal(continuationContextSha256(f.target.request,f.target.scopes),f.contextSha256);
 if(mode==='fork'){assert.equal(options.forkSession,true);assert.equal(options.sessionId,id(18));assert.equal(f.target.binding.writerFence,1);}
 else {assert.equal('forkSession'in options,false);assert.equal('sessionId'in options,false);}
});
test('exact immutable whole-checkpoint prefix can omit resumeSessionAt without latest-session fallback',()=>{
 const f=continuationFixture();f.continuation.resumeSessionAt=null;const out=buildContinuationOptions(f.continuation,f.target);
 assert.deepEqual(out,{resume:f.continuation.checkpoint.sessionId});
});
const mutations={checkpointHash:f=>f.continuation.checkpointSha256='d'.repeat(64),requestHash:f=>f.continuation.sourceRequestSha256='d'.repeat(64),
 window:f=>f.target.request.window={basis:'unbounded'},skill:f=>f.target.request.skill.proseSha256='d'.repeat(64),scope:f=>f.target.scopes=[{...f.target.scopes[0],resourceId:id(30)}],
 sdk:f=>f.target.versions={...f.target.versions,sdk:'0.0.0'},cli:f=>f.target.versions={...f.target.versions,cli:'0.0.0'},image:f=>f.target.versions={...f.target.versions,imageDigest:`sha256:${'d'.repeat(64)}`},
 tenant:f=>f.target.binding.tenantId='other',actor:f=>f.target.binding.actorId='other',run:f=>f.target.binding.runId=f.binding.runId,
 attempt:f=>f.target.binding.attemptId=f.binding.attemptId,worker:f=>f.target.binding.workerId=f.binding.workerId,fence:f=>f.target.binding.writerFence=10,
 conversation:f=>f.target.binding.conversationId=id(30),sourceSessionAlias:f=>{f.continuation.checkpoint.sessionId='latest';f.continuation.checkpointSha256=canonicalSha256(f.continuation.checkpoint);},
 workspaceBinding:f=>{f.continuation.checkpoint.workspace.binding={...f.binding,writerFence:11};f.continuation.checkpoint.workspaceSha256=canonicalSha256(f.continuation.checkpoint.workspace);f.continuation.checkpointSha256=canonicalSha256(f.continuation.checkpoint);},
 opaqueScope:f=>{f.continuation.checkpoint.opaqueSession.scopes=[{...f.target.scopes[0],resourceId:id(30)}];f.continuation.checkpointSha256=canonicalSha256(f.continuation.checkpoint);}};
for(const[name,mutate]of Object.entries(mutations))test(`continuation ${name} substitution refuses`,()=>{const f=continuationFixture();mutate(f);assert.throws(()=>buildContinuationOptions(f.continuation,f.target));});
test('fork cannot reuse original conversation/session and does not retire original task',()=>{
 for(const key of ['conversation','session']){const f=continuationFixture('fork');if(key==='conversation')f.target.binding.conversationId=f.binding.conversationId;
 else f.continuation.targetSessionId=f.continuation.checkpoint.sessionId;assert.throws(()=>buildContinuationOptions(f.continuation,f.target));}
});
test('workspace paths and exact object scopes use canonical validation',()=>{
 for(const path of ['../escape','/absolute','untrusted\\config']){const f=continuationFixture();const cp=f.continuation.checkpoint;
 cp.workspace.entries=[{path,kind:'file',object:structuredClone(cp.opaqueSession),executable:false}];cp.workspaceSha256=canonicalSha256(cp.workspace);f.continuation.checkpointSha256=canonicalSha256(cp);
 assert.throws(()=>buildContinuationOptions(f.continuation,f.target));}
});
test('request/context accessor and proxy refusal is inert',()=>{
 let hits=0;const f=continuationFixture();const proxy=new Proxy(f.continuation,{get(){hits++;throw Error('private');},ownKeys(){hits++;throw Error('private');},getPrototypeOf(){hits++;throw Error('private');}});
 assert.throws(()=>buildContinuationOptions(proxy,f.target));assert.equal(hits,0);
});
test('single long-lived input stream preserves SDK UUID/text and explicit end; queue stays bounded',async()=>{
 const input=createConversationInput({requestId:id(1),prompt:'Initial',maxQueued:2});const next=input.prompt[Symbol.asyncIterator]();
 try {const first=await next.next();assert.deepEqual(first.value,{type:'user',message:{role:'user',content:'Initial'},parent_tool_use_id:null,uuid:id(1),priority:'now',client_composed:true});
 const args={controlId:id(2),prompt:'Steer now',sessionId:id(3)},result=input.enqueue(args);args.prompt='changed';
 assert.deepEqual(result,{inputId:id(2),outcome:'UNKNOWN'});assert.equal((await next.next()).value.message.content,'Steer now');
 input.enqueue({controlId:id(4),prompt:'Queued 1'});input.enqueue({controlId:id(5),prompt:'Queued 2'});assert.throws(()=>input.enqueue({controlId:id(6),prompt:'Overflow'}),/LIMIT/);
 assert.throws(()=>input.prompt[Symbol.asyncIterator](),/ALREADY_CONSUMED/);
 }finally {input.close();await next.return();}assert.throws(()=>input.enqueue({controlId:id(7),prompt:'Closed'}),/CLOSED/);
});
test('input invalid/mutating messages cannot inject SDK authority or configuration',()=>{
 const input=createConversationInput({requestId:id(1),prompt:'Initial'});try {
 for(const message of [{controlId:'bad',prompt:'x'},{controlId:id(2),prompt:' '},{controlId:id(2),prompt:'x',options:{permissionMode:'bypassPermissions'}},
 {controlId:id(2),prompt:'x',sessionId:'latest'}])assert.throws(()=>input.enqueue(message));
 }finally {input.close();}
});
test('closing input discards queued work and completes a parked iterator without an abrupt stream error',async()=>{
 const input=createConversationInput({requestId:id(1),prompt:'Initial'}),iterator=input.prompt[Symbol.asyncIterator]();await iterator.next();
 input.enqueue({controlId:id(2),prompt:'Never deliver queued work after close'});input.close();assert.equal((await iterator.next()).done,true);
 const other=createConversationInput({requestId:id(3),prompt:'Initial'}),parked=other.prompt[Symbol.asyncIterator]();await parked.next();
 const waiting=parked.next();other.close();assert.equal((await waiting).done,true);
});
function commandFixture(overrides={}){
 const f=continuationFixture(),events=[],input=createConversationInput({requestId:id(1),prompt:'Initial'}),lifetime=life(overrides.ms??1000,overrides.signal),state=new WeakMap();
 const query={async interrupt(){assert.equal(state.get(this),'owned');events.push('interrupt');return overrides.interrupt?overrides.interrupt():{still_queued:[id(50)]};},close(){assert.equal(state.get(this),'owned');events.push('close');}};state.set(query,'owned');
 const adapter=createSdkCommandAdapter({binding:f.target.binding,contextSha256:f.contextSha256,input,query,lifetime});
 const command=(action='steer')=>({controlId:id(20),action,binding:f.target.binding,contextSha256:f.contextSha256,...(action==='steer'?{prompt:'Current steering'}:action==='waitForApproval'?{proposalId:id(40),proposalSha256:'e'.repeat(64)}:{})});
 return {...f,input,lifetime,query,events,adapter,command,close(){adapter.close();lifetime.close();}};
}
test('steer preserves exact UUID; local duplicate never redispatches nor claims durable success',async()=>{
 const f=commandFixture(),iterator=f.input.prompt[Symbol.asyncIterator]();try{await iterator.next();
 const first=await f.adapter.apply(f.command());assert.equal(first.outcome,'UNKNOWN');assert.equal(first.physicalStopProven,false);assert.equal((await iterator.next()).value.uuid,id(20));
 const duplicate=await f.adapter.apply(f.command());assert.equal(duplicate.dispatched,false);assert.equal(duplicate.outcome,'UNKNOWN');assert.deepEqual(f.events,[]);
 await assert.rejects(f.adapter.apply({...f.command(),prompt:'Altered immutable intent'}),/REPLAY_REFUSED/);
 }finally {f.close();await iterator.return();}
});
for(const action of ['pause','waitForApproval'])test(`${action}: owned interrupt receiver, honest still-queued receipt and one close`,async()=>{
 const f=commandFixture();try {const out=await f.adapter.apply(f.command(action));assert.equal(out.outcome,'UNKNOWN');assert.equal(out.physicalStopProven,false);
 assert.deepEqual(out.interruptReceipt,{still_queued:[id(50)]});assert.deepEqual(f.events,['interrupt','close']);
 assert.equal((await f.adapter.apply(f.command(action))).dispatched,false);assert.deepEqual(f.events,['interrupt','close']);
 await assert.rejects(f.adapter.apply({...f.command(),controlId:id(21)}),/STOPPED/);
 }finally {f.close();}assert.deepEqual(f.events,['interrupt','close']);
});
test('older interrupt API undefined receipt never becomes proof of empty queue or physical retirement',async()=>{
 const f=commandFixture({interrupt:()=>undefined});try {const out=await f.adapter.apply(f.command('pause'));assert.equal(out.interruptReceipt,null);assert.equal(out.physicalStopProven,false);}
 finally {f.close();}
});
test('SDK interrupt failure stays UNKNOWN and discloses no private diagnostics',async()=>{
 const f=commandFixture({interrupt:()=>{throw Error('PRIVATE SDK DIAGNOSTIC');}});
 try {await assert.rejects(f.adapter.apply(f.command('pause')),/SDK_CONTROL_UNKNOWN/);assert.deepEqual(f.events,['interrupt','close']);
 assert.equal((await f.adapter.apply(f.command('pause'))).dispatched,false);
 }finally {f.close();}
});
test('approval wait proposal metadata is immutable context; it never changes SDK permission mode',async()=>{
 const f=commandFixture();try {const command=f.command('waitForApproval'),before=structuredClone(command);
 await f.adapter.apply(command);assert.deepEqual(command,before);assert.deepEqual(f.events,['interrupt','close']);}
 finally {f.close();}
});
test('cleanup attempts owned Query close even when input close fails; private diagnostics stay hidden',()=>{
 const f=continuationFixture(),lifetime=life(),calls=[];
 const input={enqueue(){},close(){calls.push('input-close');throw Error('PRIVATE INPUT');}};
 const query={async interrupt(){return undefined;},close(){calls.push('query-close');throw Error('PRIVATE QUERY');}};
 const adapter=createSdkCommandAdapter({binding:f.target.binding,contextSha256:f.contextSha256,input,query,lifetime});
 try{assert.throws(()=>adapter.close(),/SDK_CLEANUP_UNKNOWN/);assert.deepEqual(calls,['input-close','query-close']);}
 finally{lifetime.close();}
});
for(const mutate of [c=>c.binding={...c.binding,writerFence:999},c=>c.contextSha256='f'.repeat(64),c=>c.binding={...c.binding,actorId:'foreign'},
 c=>c.options={resume:'latest'},c=>{c.action='waitForApproval';delete c.prompt;}])test('control immutable binding/context/proposal boundary rejects before SDK effect',async()=>{
 const f=commandFixture();try {const c=structuredClone(f.command());mutate(c);await assert.rejects(f.adapter.apply(c));assert.deepEqual(f.events,[]);}finally {f.close();}
});
for(const cancel of [false,true])test(`parked interrupt ${cancel?'cancellation':'deadline'} is bounded and late receipt cannot rerun SDK`,async()=>{
 const held=Promise.withResolvers(),entered=Promise.withResolvers(),controller=new AbortController();
 const f=commandFixture({ms:25,signal:controller.signal,interrupt:()=>{entered.resolve();return held.promise;}});
 try {const pending=f.adapter.apply(f.command('pause'));await entered.promise;if(cancel)controller.abort();
 await assert.rejects(pending,new RegExp(cancel?'CANCELLED':'DEADLINE'));assert.deepEqual(f.events,['interrupt','close']);
 held.resolve({still_queued:[]});await new Promise(r=>setImmediate(r));assert.deepEqual(f.events,['interrupt','close']);
 assert.equal((await f.adapter.apply(f.command('pause'))).dispatched,false);
 }finally {held.resolve();f.close();}
});
