/** VQA-032: actual SDK intent preparation -> retained proposal -> public routine approval/reconciliation.
 * Existing owners and the in-memory MCP client run over synthetic Core, SQL and Temporal boundaries only.
 * No model query, live session, provider call, database, worker or historical incident is resumed here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntimeRoutinesFeature} from '../routines.mjs';
import {createPostgresIntentJournalStore} from '../../control/intents/postgres-journal.mjs';
import {mount} from '../../control/intents/test/fixture.mjs';
import {applicationFixture,binding,clientId} from '../../control/schedules/test/application-fixture.mjs';
import {ROUTINE_PATHS} from '../../control/schedules/application-http.mjs';
import {mountIntents} from '../../worker/conversation/intents/test/fixture.mjs';
import {bindScheduleTask} from '../../worker/conversation/intents/schema.mjs';
import {LEGACY_SCHEDULE_OPERATION_VERSION} from '../../../packages/contracts/schedule-operation-family.mjs';

const argumentsForRoutine={taskInstruction:'Summarize new committee activity for the selected client.',cadence:'weekly',day:'monday',time:'09:00',timezone:'America/New_York'};
const text=result=>result.content.filter(value=>value.type==='text').map(value=>value.text).join('\n');

async function composedFixture(){
 const f=await applicationFixture();let sdk;
 try{
  const {commandContext,allocationJson,template,workflow,policy,limits}=f.contextConfiguration;
  const feature=createRuntimeRoutinesFeature({enabled:true,pool:f.pool,client:f.client,
   context:{commandContext,allocationJson,template,workflow,policy,limits},now:f.now,newId:f.newId,
   limits:{maxRequestMs:5000,maxRequestBytes:131072,maxResponseBytes:131072}});
  const application=feature.create({sessions:f.sessions,retention:{async assertServable(){}}});
  assert.equal(feature.state(),'composed');
  const journal=mount({binding,scopes:f.scopes(),preparers:feature.intentPreparersFor({binding,selectedClientId:clientId}),
   store:{port:createPostgresIntentJournalStore({pool:f.pool})},now:f.now});
  sdk=await mountIntents({binding,scopes:f.scopes(),now:f.now,deadlineMs:f.now()+60000,port:journal.mount});
  async function send(path,body){
   const response=await application.handle(new Request('https://synthetic.invalid'+path,{method:'POST',
    headers:{authorization:'Bearer '+f.session.credential,'content-type':'application/json'},body:JSON.stringify(body)}));
   return {status:response.status,body:await response.json()};
  }
  async function prepare(){
   const result=await sdk.call('propose_schedule',{operation:'schedule_task',arguments:argumentsForRoutine},{toolUseId:'toolu_vqa032_routine'});
   assert.equal(result.isError,undefined,text(result));
   assert.equal(result.content[0].type,'text');
   const prepared=JSON.parse(result.content[0].text);
   assert.equal(prepared.status,'approval_required');
   assert.equal(f.temporal.calls.create,0);
   const rows=[...f.preparations.state.rows.values()];
   assert.equal(rows.length,1);assert.equal(rows[0].state,'PREPARED');
   assert.deepEqual(rows[0].record.operation,{id:'schedule_task',version:LEGACY_SCHEDULE_OPERATION_VERSION});
   const request=bindScheduleTask(argumentsForRoutine);
   return {prepared,body:f.body(prepared,request)};
  }
  return {f,sdk,send,prepare,async close(){await sdk.close();f.close();}};
 }catch(error){await sdk?.close();f.close();throw error;}
}

test('SDK cadence input produces a retained proposal that the public approval route applies exactly once',async()=>{
 const s=await composedFixture();try{
  const {prepared,body}=await s.prepare();
  const approved=await s.send(ROUTINE_PATHS.approve,{...body,decision:'approved'});
  assert.equal(approved.status,200,JSON.stringify(approved.body));assert.equal(approved.body.status,'acknowledged');
  assert.equal(s.f.temporal.calls.create,1);
  const retained=await s.f.owner.readIntent({tenantId:binding.tenantId,intentId:prepared.proposal.proposalId},()=>{});
  assert.equal(retained.state,'ACKNOWLEDGED');assert.equal(retained.intentSha256,prepared.proposal.intentSha256);
  const repeated=await s.send(ROUTINE_PATHS.approve,{...body,decision:'approved'});
  assert.equal(repeated.status,200,JSON.stringify(repeated.body));assert.equal(repeated.body.status,'acknowledged');
  assert.equal(s.f.temporal.calls.create,1);
 }finally{await s.close();}
});

test('SDK-prepared routine with a lost provider acknowledgement reconciles through the public route without redispatch',async()=>{
 const s=await composedFixture();try{
  const {prepared,body}=await s.prepare();s.f.state.loseCreateAck=true;
  const uncertain=await s.send(ROUTINE_PATHS.approve,{...body,decision:'approved'});
  assert.notEqual(uncertain.status,200);assert.equal(uncertain.body.error.outcome,'UNKNOWN');
  assert.equal(s.f.temporal.calls.create,1);
  assert.equal((await s.f.owner.readIntent({tenantId:binding.tenantId,intentId:prepared.proposal.proposalId},()=>{})).state,'UNKNOWN');
  const repeated=await s.send(ROUTINE_PATHS.approve,{...body,decision:'approved'});
  assert.notEqual(repeated.status,200);assert.equal(repeated.body.error.outcome,'UNKNOWN');assert.equal(s.f.temporal.calls.create,1);
  const recovered=await s.send(ROUTINE_PATHS.reconcile,body);
  assert.equal(recovered.status,200,JSON.stringify(recovered.body));assert.equal(recovered.body.outcome,'ACKNOWLEDGED');
  assert.equal(recovered.body.reconciled,true);assert.equal(s.f.temporal.calls.create,1);
  assert.equal((await s.f.owner.readIntent({tenantId:binding.tenantId,intentId:prepared.proposal.proposalId},()=>{})).state,'ACKNOWLEDGED');
  const afterRecovery=await s.send(ROUTINE_PATHS.approve,{...body,decision:'approved'});
  assert.equal(afterRecovery.status,200);assert.equal(afterRecovery.body.status,'acknowledged');assert.equal(s.f.temporal.calls.create,1);
 }finally{await s.close();}
});

for(const changed of ['request','digest','actor','revoked'])test(`SDK-prepared routine refuses ${changed==='revoked'?'a revoked session':'a changed '+changed} at public approval before any provider effect`,async()=>{
 const s=await composedFixture();try{
  const {body}=await s.prepare();
  if(changed==='request')body.request={...body.request,taskInstruction:'Different work from the reviewed proposal.'};
  if(changed==='digest')body.intentSha256='0'.repeat(64);
  if(changed==='actor')s.f.state.actorId='another-actor';
  if(changed==='revoked')s.f.state.revoked=true;
  const denied=await s.send(ROUTINE_PATHS.approve,{...body,decision:'approved'});
  assert.notEqual(denied.status,200);
  // A mismatched digest or unavailable current actor cannot authorize reading a prior effect; keep that outcome unknown.
  assert.equal(denied.body.error.outcome,changed==='request'?'NOT_DISPATCHED':'UNKNOWN',JSON.stringify(denied.body));
  assert.equal(s.f.temporal.calls.create,0);assert.equal(s.f.sql.state.intents.size,0);
 }finally{await s.close();}
});
