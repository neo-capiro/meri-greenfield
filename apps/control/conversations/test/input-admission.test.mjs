/** SYNTHETIC scripted SQL and current-session controls. No service, database or provider is started. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createConversationService} from '../service.mjs';
import {createPostgresConversationStore} from '../postgres-store.mjs';
import {storeFixture,binding,scopes,versions,id} from './store-fixture.mjs';
import {applicationFixture} from './application-fixture.mjs';
import {createTemporalConversationDispatcher,workflowId} from '../temporal-dispatch.mjs';
import {createNextRunOwner} from '../next-run.mjs';
import {hash} from '../boundary.mjs';
const input={requestId:id(6),prompt:'Hello'},check=()=>{};
function fixture({wrapStore=s=>s,retention,dispatcher}={}){
 const f=storeFixture(),state=Object.assign(f.state,{time:Date.parse('2026-10-16T12:00:00.000Z'),context:structuredClone({binding,scopes,selectedClientId:id(5)}),revoked:false,starts:[],authReads:0});let serial=100;
 const sessions={async authenticateSession(){state.authReads++;await state.onAuthenticate?.();if(state.revoked)throw Object.assign(Error('SESSION_REFUSED'),{code:'SESSION_REFUSED'});return {principal:{tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId},checkedAtMs:state.time,expiresAtMs:state.time+30000};},async readCurrentState({authentication}){await state.onCurrent?.();return {authenticationSha256:hash(authentication),...structuredClone(state.context),checkedAtMs:state.time,expiresAtMs:state.time+30000};}};
 const store=wrapStore(createPostgresConversationStore({pool:f.pool}),state),service=createConversationService({sessions,store,versions,now:()=>state.time,newId:()=>id(serial++),retention,dispatcher:dispatcher??{async start(value){state.starts.push(value.binding);},async cancel(){}}});
 const admit=(i=input)=>service.admitInput({credential:'synthetic',input:i}),submit=(i=input)=>service.submit({credential:'synthetic',input:i}),history=()=>service.history({credential:'synthetic'});
 return {...f,state,store,service,admit,submit,history};
}
const queuedEvents=f=>[...f.state.events.values()].flat().filter(e=>e.event.type==='run.status'&&e.event.data.state==='queued');

test('admission stores one full immutable request and queued event with zero dispatches; exact replay uses canonical rows',async()=>{
 const f=fixture(),first=await f.admit(),replay=await f.admit();assert.deepEqual(Object.keys(first).sort(),['lastSequence','replayed','request','run']);assert.equal(first.replayed,false);assert.equal(replay.replayed,true);assert.deepEqual(first.request,{...input,skill:null,window:null,windowRequest:null});assert.deepEqual(replay.request,first.request);assert.equal(f.state.starts.length,0);assert.equal(f.state.runs.size,1);assert.equal(queuedEvents(f).length,1);assert.deepEqual((await f.history()).request,first.request);
});

test('admit then submit and exact replays preserve existing submit wire and a single upstream Temporal workflow identity',async()=>{
 const workflows=new Set(),starts=[];const dispatcher=createTemporalConversationDispatcher({taskQueue:'synthetic',client:{connection:{async withDeadline(_,run){return run();},async withAbortSignal(_,run){return run();}},workflow:{async start(_,options){starts.push(options);workflows.add(options.workflowId);},getHandle(){return {async cancel(){}};}}}});
 const f=fixture({dispatcher}),receipt=await f.admit(),submitted=await f.submit(),again=await f.submit();assert.deepEqual(Object.keys(submitted).sort(),['lastSequence','replayed','requestId','run']);assert.equal(submitted.requestId,receipt.request.requestId);assert.equal(submitted.replayed,true);assert.equal(again.replayed,true);assert.equal(starts.length,2);assert.deepEqual([...workflows],[workflowId(binding)]);assert.ok(starts.every(s=>s.workflowIdReusePolicy==='REJECT_DUPLICATE'&&s.workflowIdConflictPolicy==='USE_EXISTING'));assert.equal(queuedEvents(f).length,1);
});

test('lost admission commit acknowledgement recovers positively from existing history and replays exact input',async()=>{
 const f=fixture({wrapStore:(store,state)=>({...store,async accept(...args){state.commitUnknown=true;return store.accept(...args);}})});await assert.rejects(f.admit(),/STORE_COMMIT_UNKNOWN/);f.state.commitUnknown=false;const recovered=await f.history();assert.deepEqual(recovered.request,{...input,skill:null,window:null,windowRequest:null});assert.equal(f.state.starts.length,0);assert.equal((await f.admit()).replayed,true);await f.submit();assert.equal(f.state.starts.length,1);assert.equal(f.state.runs.size,1);assert.equal(queuedEvents(f).length,1);
});

test('lost start acknowledgement after admission retries the same fixed workflow and never adds another queued event',async()=>{
 const workflows=new Set(),attempts=[];let unknown=true;const dispatcher=createTemporalConversationDispatcher({taskQueue:'synthetic',client:{connection:{async withDeadline(_,run){return run();},async withAbortSignal(_,run){return run();}},workflow:{async start(_,options){attempts.push(options.workflowId);workflows.add(options.workflowId);if(unknown)throw Error('ack lost');},getHandle(){return {async cancel(){}};}}}});
 const f=fixture({dispatcher});await f.admit();await assert.rejects(f.submit(),/TEMPORAL_DISPATCH_UNKNOWN/);assert.equal((await f.history()).request.requestId,input.requestId);unknown=false;await f.submit();assert.deepEqual(attempts,[workflowId(binding),workflowId(binding)]);assert.equal(workflows.size,1);assert.equal(queuedEvents(f).length,1);
});

test('concurrent identical admission and submit race creates at most one request/event and keeps the accepted normalization',async()=>{
 const f=fixture(),i={...input,windowRequest:{basis:'calendar-week',offset:-1,timezone:'America/New_York',weekStartsOn:'monday'}};
 const result=await Promise.all([f.admit(i),f.admit(i),f.submit(i),f.admit(i)]);assert.equal(result.filter(r=>!r.replayed).length,1);assert.equal(f.state.runs.size,1);assert.equal(queuedEvents(f).length,1);const saved=await f.history();for(const r of result)if(r.request)assert.deepEqual(r.request,saved.request);assert.deepEqual(saved.request.windowRequest,i.windowRequest);assert.equal(f.state.starts.length,1);
});

test('concurrent different bodies under one identity conflict without another event or dispatch',async()=>{
 const f=fixture(),result=await Promise.allSettled([f.admit(),f.admit({...input,prompt:'different'})]);assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.match(result.find(r=>r.status==='rejected').reason.message,/REQUEST_REPLAY_REFUSED/);assert.equal(f.state.runs.size,1);assert.equal(queuedEvents(f).length,1);assert.equal(f.state.starts.length,0);
});

test('a different request ID cannot replace accepted input on the same run',async()=>{
 const f=fixture();await f.admit();await assert.rejects(f.admit({...input,requestId:id(7)}),/REQUEST_REPLAY_REFUSED/);assert.equal(queuedEvents(f).length,1);assert.equal(f.state.starts.length,0);
});

test('relative-window replay finds canonical request before normalization after clock/calendar rollover',async()=>{
 const f=fixture(),i={...input,windowRequest:{basis:'calendar-week',offset:-1,timezone:'America/New_York',weekStartsOn:'monday'}},receipt=await f.admit(i);f.state.time+=8*86400000;const replay=await f.admit(i);assert.deepEqual(replay.request,receipt.request);assert.equal(replay.run.createdAt,receipt.run.createdAt);await f.submit(i);assert.deepEqual((await f.history()).request,receipt.request);assert.equal(queuedEvents(f).length,1);
});

test('current revocation after reservation lookup prevents acceptance persistence',async()=>{
 const f=fixture({wrapStore:(store,state)=>({...store,nextRuns:{...store.nextRuns,async readTarget(...args){const r=await store.nextRuns.readTarget(...args);state.revoked=true;return r;}}})});await assert.rejects(f.admit(),/SESSION_REFUSED/);assert.equal(f.state.runs.size,0);assert.equal(f.state.events.size,0);assert.equal(f.state.starts.length,0);
});

for(const[name,change]of [['revocation',s=>{s.revoked=true;}],['expiry',s=>{s.time+=30001;}],['binding drift',s=>{s.context.binding.writerFence++;}],['scope drift',s=>{s.context.scopes[0].policyRevision='changed';}]])test(`${name} after commit withholds receipt; accepted input stays durable without dispatch`,async()=>{
 const f=fixture({wrapStore:(store,state)=>({...store,async accept(...args){const saved=await store.accept(...args);change(state);return saved;}})});await assert.rejects(f.admit());assert.equal(f.state.runs.size,1);assert.equal(queuedEvents(f).length,1);assert.equal(f.state.starts.length,0);
});

test('the final current-auth check can withhold an exact replay without another event or dispatch',async()=>{
 const f=fixture();await f.admit();let calls=0;f.state.onAuthenticate=()=>{if(++calls===4)f.state.revoked=true;};await assert.rejects(f.admit(),/SESSION_REFUSED/);assert.equal(calls,4);assert.equal(queuedEvents(f).length,1);assert.equal(f.state.starts.length,0);
});

test('retention suppression at persistence completion prevents receipt release and positive recovery until reopened',async()=>{
 let suppressed=false;const f=fixture({retention:{async assertServable(){if(suppressed)throw Object.assign(Error('RETENTION_SUPPRESSED'),{code:'RETENTION_SUPPRESSED'});}},wrapStore:store=>({...store,async accept(...args){const saved=await store.accept(...args);suppressed=true;return saved;}})});await assert.rejects(f.admit(),/RETENTION_SUPPRESSED/);await assert.rejects(f.history(),/RETENTION_SUPPRESSED/);suppressed=false;assert.deepEqual((await f.history()).request.prompt,input.prompt);assert.equal(f.state.starts.length,0);
});

test('terminal admission recovery returns original target and delayed old submit does not dispatch terminal work',async()=>{
 const f=await applicationFixture();try{await f.service.admitInput({credential:f.credential,input:f.input});await f.service.cancel({credential:f.credential});const recovered=await f.service.admitInput({credential:f.credential,input:f.input});assert.equal(recovered.run.state,'cancelled');assert.deepEqual(recovered.run.binding,binding);assert.deepEqual(recovered.request.requestId,f.input.requestId);await f.service.submit({credential:f.credential,input:f.input});assert.equal(f.state.starts,0);assert.equal(queuedEvents(f).length,1);}finally{f.close();}
});

test('reserved next run uses canonical nextRuns.accept, never restores older prompt; stale old session cannot retarget',async()=>{
 const f=await applicationFixture();try{await f.service.admitInput({credential:f.credential,input:f.input});await f.service.cancel({credential:f.credential});let serial=900;const owner=createNextRunOwner({store:f.store,versions,newId:()=>id(serial++),retirement:{async verifyRetired(){throw Error('unexpected authority');}},revocation:{async verifyRevoked(){throw Error('unexpected authority');}}}),selected=await owner.selectRun({principal:{tenantId:binding.tenantId,actorId:binding.actorId},conversationId:binding.conversationId});assert.equal(selected.reserved,true);f.state.context.binding=selected.binding;const next=await f.sessions.issue({identityCredential:'synthetic-native'}),i={requestId:id(950),prompt:'new input'};
  assert.equal((await f.store.nextRuns.readTarget(selected.binding,check)).state,'RESERVED');assert.equal(f.state.starts,0);await assert.rejects(f.service.history({credential:next.credential}));assert.equal(f.state.starts,0);
  const receipt=await f.service.admitInput({credential:next.credential,input:i});assert.deepEqual(receipt.run.binding,selected.binding);assert.deepEqual(receipt.request,{...i,skill:null,window:null,windowRequest:null});assert.equal((await f.store.nextRuns.readTarget(selected.binding,check)).state,'ACCEPTED');assert.equal(f.state.starts,0);assert.equal(queuedEvents(f).length,2);
  await assert.rejects(f.service.submit({credential:f.credential,input:f.input}));await assert.rejects(f.service.submit({credential:next.credential,input:f.input}));assert.equal(f.state.starts,0);await f.service.submit({credential:next.credential,input:i});assert.equal(f.state.starts,1);assert.equal(queuedEvents(f).length,2);
 }finally{f.close();}
});

test('empty or unavailable recovery is no dispatch and supplies no synthesized input identity',async()=>{
 const f=fixture();await assert.rejects(f.history());assert.equal(f.state.runs.size,0);assert.equal(f.state.starts.length,0);assert.equal(f.state.events.size,0);
});

for(const[name,change]of [['binding',r=>{r.run.binding.actorId='foreign';}],['scope',r=>{r.run.scopes[0].resourceId=id(90);}],['request ID',r=>{r.request.requestId=id(91);}],['prompt',r=>{r.request.prompt='substituted';}]])test(`a structurally valid store response with substituted ${name} cannot release an admission receipt`,async()=>{
 const f=fixture({wrapStore:store=>({...store,async accept(...args){const saved=structuredClone(await store.accept(...args));change(saved);return saved;}})});await assert.rejects(f.admit());assert.equal(f.state.starts.length,0);assert.equal(queuedEvents(f).length,1);assert.equal((await f.history()).request.prompt,input.prompt);
});
