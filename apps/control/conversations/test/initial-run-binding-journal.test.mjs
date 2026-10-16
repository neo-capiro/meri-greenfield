import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialRunBindingJournal} from '../initial-run-binding-journal.mjs';
import {hash} from '../boundary.mjs';
import {id,scopes,versions} from './store-fixture.mjs';

const copy=value=>structuredClone(value);
function fixture(){
 const state={bindings:new Map(),runs:new Map(),inputs:new Map(),next:new Map(),inserts:0,ackLost:false,calls:[]};
 let tail=Promise.resolve(),clock=1800000000000;
 const key=p=>p.slice(0,2).join(':');
 const pool={async connect(){let release;const prior=tail;tail=new Promise(resolve=>release=resolve);await prior;let snapshot;
  return {async query(sql,p=[]){state.calls.push(sql);let rows=[];
   if(sql==='BEGIN ISOLATION LEVEL READ COMMITTED'){snapshot=copy({bindings:state.bindings,runs:state.runs,inputs:state.inputs,next:state.next,inserts:state.inserts});}
   else if(sql==='ROLLBACK'){Object.assign(state,snapshot);}
   else if(sql==='COMMIT'){if(state.ackLost){state.ackLost=false;throw Error('synthetic lost commit acknowledgment');}}
   else if(sql.startsWith('SET LOCAL')||sql.startsWith('SELECT pg_advisory')){}
   else if(sql.startsWith('SELECT * FROM meri_conversations.initial_run_bindings')){const found=state.bindings.get(key(p));if(found)rows=[found];}
   else if(sql.startsWith('INSERT INTO meri_conversations.initial_run_bindings')){if(!state.bindings.has(key(p))){const row={tenant_id:p[0],conversation_id:p[1],run_id:p[2],record:copy(p[3]),record_sha256:p[4]};state.bindings.set(key(p),row);state.inserts++;rows=[row];}}
   else if(sql.startsWith('SELECT projection,projection_sha256 FROM meri_conversations.runs')){const found=state.runs.get(key(p));if(found)rows=[found];}
   else if(sql.startsWith('SELECT * FROM meri_conversations.initial_inputs')){const found=state.inputs.get(key(p));if(found)rows=[found];}
   else if(sql.startsWith('SELECT reservation,reservation_sha256 FROM meri_conversations.next_runs')){const found=state.next.get(key(p));if(found&&found.reservation.source.runId===p[2])rows=[found];}
   else if(sql.startsWith('SELECT 1 FROM meri_conversations.next_runs')){if(state.next.has(key(p)))rows=[{present:1}];}
   else throw Error(`unexpected SQL: ${sql}`);
   return {rows:copy(rows),rowCount:rows.length};
  },release(){release();}};
 }};
 const input={principal:{tenantId:'tenant-a',actorId:'actor-a'},conversationId:id(1),selectedClientId:id(5),policyRevision:'policy1',versions,configurationSha256:'c'.repeat(64),proposedExpiresAtMs:clock+60000};
 return {state,pool,input,now:()=>clock,advance:ms=>clock+=ms,key:()=>key([input.principal.tenantId,input.conversationId]),journal:()=>createInitialRunBindingJournal({pool,now:()=>clock})};
}
const check=()=>{};

test('first verified Core conversation gets one durable full original binding; retry recovers it and its original expiry',async()=>{
 const f=fixture(),j=f.journal();
 const first=await j.claim(f.input,check);
 assert.equal(first.created,true);assert.equal(first.record.binding.writerFence,1);assert.equal(first.record.binding.conversationId,f.input.conversationId);
 assert.equal(first.record.binding.actorId,f.input.principal.actorId);assert.equal(first.record.selectedClientId,f.input.selectedClientId);
 assert.equal(new Set([first.record.binding.conversationId,first.record.binding.runId,first.record.binding.attemptId,first.record.binding.workerId]).size,4);
 const replay=await j.claim({...f.input,proposedExpiresAtMs:f.input.proposedExpiresAtMs+30000},check);
 assert.deepEqual(replay,{record:first.record,created:false});assert.equal(f.state.inserts,1);
 assert.deepEqual(await j.read({binding:first.record.binding},check),first.record);
 assert.deepEqual(await j.readConversation({principal:f.input.principal,conversationId:f.input.conversationId,selectedClientId:f.input.selectedClientId},check),first.record);
});

test('unclaimed conversation reads return null and do not allocate',async()=>{
 const f=fixture(),j=f.journal(),candidate={...f.input.principal,conversationId:f.input.conversationId,runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
 assert.equal(await j.read({binding:candidate},check),null);
 assert.equal(await j.readConversation({principal:f.input.principal,conversationId:f.input.conversationId,selectedClientId:f.input.selectedClientId},check),null);
 assert.equal(f.state.inserts,0);
});

test('actor, selected client, policy, runtime pins and configuration are immutable on replay',async()=>{
 const f=fixture(),j=f.journal();await j.claim(f.input,check);
 const edits=[
  {principal:{...f.input.principal,actorId:'actor-b'}},
  {selectedClientId:id(8)},
  {policyRevision:'policy2'},
  {versions:{...versions,sdk:'0.3.296'}},
  {configurationSha256:'d'.repeat(64)}
 ];
 for(const edit of edits)await assert.rejects(j.claim({...f.input,...edit},check),{code:'INITIAL_RUN_BINDING_CONFLICT'});
 await assert.rejects(j.readConversation({principal:{...f.input.principal,actorId:'actor-b'},conversationId:f.input.conversationId,selectedClientId:f.input.selectedClientId},check),{code:'INITIAL_RUN_BINDING_CONFLICT'});
 await assert.rejects(j.readConversation({principal:f.input.principal,conversationId:f.input.conversationId,selectedClientId:id(8)},check),{code:'INITIAL_RUN_BINDING_CONFLICT'});
 assert.equal(f.state.inserts,1);
});

test('expired admission refuses another claim but remains readable for fail-closed selection',async()=>{
 const f=fixture(),j=f.journal(),first=await j.claim(f.input,check);f.advance(60000);
 await assert.rejects(j.claim({...f.input,proposedExpiresAtMs:f.input.proposedExpiresAtMs+100000},check),{code:'INITIAL_RUN_BINDING_EXPIRED'});
 assert.deepEqual(await j.read({binding:first.record.binding},check),first.record);
 assert.deepEqual(await j.readConversation({principal:f.input.principal,conversationId:f.input.conversationId,selectedClientId:f.input.selectedClientId},check),first.record);
 assert.equal(f.state.inserts,1);
});

test('preexisting runs, original input or successor state refuses a new original binding',async()=>{
 for(const kind of ['runs','inputs','next']){
  const f=fixture(),j=f.journal(),key=f.key();
  if(kind==='runs')f.state.runs.set(key,{projection:{binding:{tenantId:'tenant-a',actorId:'actor-a',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1}}});
  if(kind==='inputs')f.state.inputs.set(key,{allocation:{binding:{tenantId:'tenant-a',conversationId:id(1)}}});
  if(kind==='next')f.state.next.set(key,{reservation:{source:{runId:id(9)}}});
  await assert.rejects(j.claim(f.input,check),{code:'INITIAL_RUN_BINDING_ALREADY_EXISTS'});
  assert.equal(f.state.bindings.size,0,kind);
 }
});

test('replay checks an accepted first run and input allocation without replacing binding',async()=>{
 const f=fixture(),j=f.journal(),first=await j.claim(f.input,check),b=first.record.binding,k=f.key();
 const run={binding:b,state:'queued',scopes,versions,createdAt:new Date(first.record.createdAtMs).toISOString(),policyRevision:'policy1'};f.state.runs.set(k,{projection:run,projection_sha256:hash(run)});
 const allocation={binding:b,scopes,versions,selectedClientId:id(5),requestId:id(50),inputSha256:'a'.repeat(64),requestSha256:'b'.repeat(64),allocatedAtMs:first.record.createdAtMs,expiresAtMs:first.record.expiresAtMs};f.state.inputs.set(k,{tenant_id:b.tenantId,conversation_id:b.conversationId,run_id:b.runId,request_id:allocation.requestId,allocation,allocation_sha256:hash(allocation),state:'ACCEPTED',accepted_request_sha256:allocation.requestSha256});
 const reservation={source:b,target:{...b,runId:id(40),attemptId:id(41),workerId:id(42),writerFence:2}};f.state.next.set(k,{reservation,reservation_sha256:hash(reservation)});
 assert.deepEqual(await j.claim(f.input,check),{record:first.record,created:false});
 assert.deepEqual(await j.readConversation({principal:f.input.principal,conversationId:f.input.conversationId,selectedClientId:f.input.selectedClientId},check),first.record);
 f.state.inputs.get(k).allocation={...allocation,selectedClientId:id(6)};
 await assert.rejects(j.claim(f.input,check),{code:'INITIAL_RUN_BINDING_CONFLICT'});
});

test('replay refuses extra client scopes in either the first run or original input allocation',async()=>{
 for(const changed of ['run','input']){
  const f=fixture(),j=f.journal(),first=await j.claim(f.input,check),b=first.record.binding,k=f.key();
  const extra={tenantId:b.tenantId,kind:'client',resourceId:id(6),policyRevision:f.input.policyRevision};
  const run={binding:b,state:'queued',scopes:changed==='run'?[...scopes,extra]:scopes,versions,createdAt:new Date(first.record.createdAtMs).toISOString(),policyRevision:f.input.policyRevision};
  f.state.runs.set(k,{projection:run,projection_sha256:hash(run)});
  const allocation={binding:b,scopes:changed==='input'?[...scopes,extra]:scopes,versions,selectedClientId:f.input.selectedClientId,requestId:id(50),inputSha256:'a'.repeat(64),requestSha256:'b'.repeat(64),allocatedAtMs:first.record.createdAtMs,expiresAtMs:first.record.expiresAtMs};
  f.state.inputs.set(k,{tenant_id:b.tenantId,conversation_id:b.conversationId,run_id:b.runId,request_id:allocation.requestId,allocation,allocation_sha256:hash(allocation),state:'ACCEPTED',accepted_request_sha256:allocation.requestSha256});
  await assert.rejects(j.claim(f.input,check),{code:'INITIAL_RUN_BINDING_CONFLICT'},changed);
 }
});

test('reserved original input without a run can replay; accepted input without its run is refused',async()=>{
 const f=fixture(),j=f.journal(),first=await j.claim(f.input,check),b=first.record.binding,k=f.key();
 const allocation={binding:b,scopes,versions,selectedClientId:id(5),requestId:id(50),inputSha256:'a'.repeat(64),requestSha256:'b'.repeat(64),allocatedAtMs:first.record.createdAtMs,expiresAtMs:first.record.expiresAtMs};
 const input={tenant_id:b.tenantId,conversation_id:b.conversationId,run_id:b.runId,request_id:allocation.requestId,allocation,allocation_sha256:hash(allocation),state:'RESERVED',accepted_request_sha256:null};
 f.state.inputs.set(k,input);assert.deepEqual(await j.claim(f.input,check),{record:first.record,created:false});
 f.state.inputs.get(k).state='ACCEPTED';f.state.inputs.get(k).accepted_request_sha256=allocation.requestSha256;
 await assert.rejects(j.claim(f.input,check),{code:'INITIAL_RUN_BINDING_CONFLICT'});
});

test('lost commit acknowledgment recovers the same persisted record and never allocates twice',async()=>{
 const f=fixture(),j=f.journal();f.state.ackLost=true;
 await assert.rejects(j.claim(f.input,check),{code:'INITIAL_RUN_BINDING_COMMIT_UNKNOWN'});
 assert.equal(f.state.bindings.size,1);
 const saved=copy(f.state.bindings.get(f.key()).record),replay=await j.claim(f.input,check);
 assert.deepEqual(replay,{record:saved,created:false});assert.equal(f.state.inserts,1);
});

test('corrupt stored hash or mismatched exact binding is never released',async()=>{
 const f=fixture(),j=f.journal(),first=await j.claim(f.input,check);
 await assert.rejects(j.read({binding:{...first.record.binding,runId:id(99)}},check),{code:'INITIAL_RUN_BINDING_CONFLICT'});
 f.state.bindings.get(f.key()).record.selectedClientId=id(99);
 await assert.rejects(j.readConversation({principal:f.input.principal,conversationId:f.input.conversationId,selectedClientId:f.input.selectedClientId},check),{code:'INITIAL_RUN_BINDING_CORRUPT'});
});

test('two concurrent first claims serialize and return the same binding',async()=>{
 const f=fixture(),j=f.journal();const [a,b]=await Promise.all([j.claim(f.input,check),j.claim(f.input,check)]);
 assert.equal(a.created!==b.created,true);assert.deepEqual(a.record,b.record);assert.equal(f.state.inserts,1);
});
