/** Actual initial binding, conversation store, opaque sessions and routines service over scripted SQL/Core/Temporal edges. */
import test from 'node:test';import assert from 'node:assert/strict';
import {applicationFixture,routineRequest,binding,clientId} from '../../control/schedules/test/application-fixture.mjs';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
import {createActionSessionOwner} from '../../control/action-host/session/owner.mjs';
import {createNativeRoutinesContextOwner} from '../native-authority/routines-owner-composition.mjs';
import {createRoutinesService} from '../../control/schedules/application.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
const versions={imageDigest:'sha256:'+'a'.repeat(64),sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'};
async function fixture(t,general=false){
 const f=await applicationFixture();t.after(()=>f.close());const state={rows:[],queries:[],started:false,policy:2000000};
 const pool={async connect(){return {async query(sql,p=[]){state.queries.push(sql);let rows=[];
  if(sql==='BEGIN'||sql.startsWith('BEGIN ISOLATION')||sql==='COMMIT'||sql==='ROLLBACK'||sql.startsWith('SET LOCAL')||sql.startsWith('SELECT pg_advisory')){}
  else if(sql.startsWith('SELECT * FROM meri_conversations.initial_run_bindings')){const row=p.length===3?state.rows.find(row=>row.run_id===p[2]):state.rows.at(-1);if(row)rows=[row];}
  else if(sql.startsWith('INSERT INTO meri_conversations.initial_run_bindings')){const row={tenant_id:p[0],conversation_id:p[1],run_id:p[2],record:structuredClone(p[3]),record_sha256:p[4],generation:p[5]};state.rows.push(row);rows=[row];}
  else if(sql.startsWith('SELECT monthly_cap_micro_usd'))rows=[{monthly_cap_micro_usd:100000000,sdk_max_turns:20,sdk_max_budget_micro_usd:state.policy}];
  else if(sql.startsWith('SELECT 1 FROM meri_conversations.native_allocations')){if(state.started)rows=[{present:1}];}
  else if(sql.startsWith('SELECT')&&['meri_conversations.runs','meri_conversations.initial_inputs','meri_conversations.next_runs'].some(table=>sql.includes(table))){}
  else assert.fail('Unexpected initial SQL: '+sql);
  return {rows:structuredClone(rows),rowCount:rows.length};},release(){}};}};
 const store=createPostgresConversationStore({pool,now:f.now}),selectedClientId=general?null:clientId;
 const initial={principal:{tenantId:binding.tenantId,actorId:binding.actorId},conversationId:binding.conversationId,selectedClientId,policyRevision:'p1',versions,configurationSha256:'c'.repeat(64),proposedExpiresAtMs:f.now()+5000};
 let selected=(await store.initialBindings.claim(initial,()=>{})).record.binding;
 const scopes=()=>[{tenantId:binding.tenantId,kind:general?'private-user':'client',resourceId:selectedClientId??binding.actorId,policyRevision:'p1'}];
 const live=()=>{if(f.state.revoked)throw Error('revoked');};
 const sessions=createActionSessionOwner({mode:'process-local',now:f.now,refusals(){},limits:{maxSessions:8,maxRequestMs:5000,maxTtlMs:60000,maxFactBytes:65536},
  async verifyIdentity(){live();return {principal:initial.principal,identityRevision:'i1',checkedAtMs:f.now(),expiresAtMs:f.now()+60000};},
  async resolveContext({identitySha256}){live();return {identitySha256,binding:selected,scopes:scopes(),selectedClientId,contextRevision:'c1',checkedAtMs:f.now(),expiresAtMs:f.now()+60000};}});
 t.after(()=>sessions.close());let session;const reconnect=async()=>session=await sessions.issue({identityCredential:'synthetic-native',hints:{conversationId:binding.conversationId,clientId:selectedClientId},deadlineMs:f.now()+4000});await reconnect();
 const {template,workflow,limits}=f.contextConfiguration;
 const policy={async check({selection,selectionSha256}){const mutation=!['list_scheduled_tasks','cancel_scheduled_task'].includes(selection.operation);return {authorized:f.state.allowed,selectionSha256,binding:selected,scopes:scopes(),selectedClientId,destinationResolution:mutation?{reference:selection.request.destinationReference,destinationId:'meri-inbox'}:null,limits:mutation?{maxCostMicrousd:2000,maxRuntimeSeconds:90,retryLimit:0}:null,checkedAtMs:f.now(),expiresAtMs:f.now()+10000};}};
 const contextOwner=createNativeRoutinesContextOwner({base:{template,workflow,limits,policy,versions,maxRuntimeSeconds:900},sessions,scheduleOwner:f.owner,store,now:f.now,newId:f.newId});
 const service=createRoutinesService({...f.config,contextOwner,retention:{async assertServable(){if(f.state.suppressed)throw Error('suppressed');}}});
 const call=(method,request)=>service[method]({credential:session.credential,request,deadlineMs:f.now()+4500});
 return {...f,state: f.state,initialState:state,store,call,scopes,reconnect,current:()=>selected,async rebind(){selected=(await store.initialBindings.rebind({...initial,proposedExpiresAtMs:f.now()+60000},()=>{})).record.binding;return reconnect();}};
}
for(const general of [false,true])test(`first-use ${general?'General':'client'} list and prepare need no chat turn; exact replay survives expired original generation`,async t=>{
 const f=await fixture(t,general),request={requestId:'first-use',operation:'schedule_task',request:routineRequest()};
 assert.equal((await f.call('list',{})).page.rows.length,0);
 const prepared=await f.call('prepare',request),ids=f.state.ids,original=f.current();assert.equal(f.temporal.calls.create,0);
 f.state.now+=6000;await assert.rejects(f.call('prepare',request));await f.rebind();assert.notEqual(f.current().runId,original.runId);
 assert.deepEqual(await f.call('prepare',request),prepared);assert.equal(f.state.ids,ids);
 await assert.rejects(f.call('prepare',{...request,request:{...request.request,taskInstruction:'Changed'}}));
 const body={operation:'schedule_task',request:request.request,proposalId:prepared.proposal.proposalId,intentSha256:prepared.proposal.intentSha256,decision:'approved'};
 assert.equal((await f.call('approve',body)).status,'acknowledged');assert.equal((await f.call('approve',body)).status,'acknowledged');assert.equal(f.temporal.calls.create,1);
 assert.equal((await f.call('list',{})).page.rows.length,1);
 assert.equal(f.initialState.queries.some(sql=>/^INSERT|^UPDATE|^DELETE/u.test(sql)&&!sql.startsWith('INSERT INTO meri_conversations.initial_run_bindings')),false,'no fake run/input/allocation accepted');
 assert.equal(f.initialState.rows.length,2);assert.deepEqual(prepared.proposal.projection.scopes,f.scopes());
});
for(const refusal of ['started','corrupt','policy','suppressed'])test(`first-use routines refuse ${refusal} before preparation or Temporal`,async t=>{
 const f=await fixture(t);
 if(refusal==='started')f.initialState.started=true;else if(refusal==='corrupt')f.initialState.rows[0].record_sha256='0'.repeat(64);else if(refusal==='policy')f.initialState.policy=0;else f.state.suppressed=true;
 await assert.rejects(f.call('prepare',{requestId:'refused',operation:'schedule_task',request:routineRequest()}));assert.equal(f.temporal.calls.create,0);assert.equal(f.preparations.state.rows.size,0);
});
for(const retained of ['PENDING','UNKNOWN'])test(`first-use ${retained} after reconnect stays fenced without preparing again`,async t=>{
 const f=await fixture(t),request={requestId:'pending',operation:'schedule_task',request:routineRequest()};
 f.preparations.state.onQuery=sql=>{if(sql.startsWith('INSERT INTO meri_intents.preparations'))f.preparations.state.commitError=Error('lost ACK');};
 await assert.rejects(f.call('prepare',request));f.preparations.state.onQuery=null;
 const row=[...f.preparations.state.rows.values()][0];assert.equal(row.state,'PENDING');if(retained==='UNKNOWN'){row.state='UNKNOWN';row.outcome=null;}
 f.state.now+=6000;await f.rebind();const ids=f.state.ids;await assert.rejects(f.call('prepare',request),{code:'ROUTINES_UNKNOWN',outcome:'UNKNOWN'});assert.equal(f.state.ids,ids);assert.equal(f.temporal.calls.create,0);assert.equal(f.preparations.state.rows.size,1);
});
