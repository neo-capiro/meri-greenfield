/** Actual application integration. Fixtures script only external SQL/Core/Temporal wire, never preparation or lifecycle behavior. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {applicationFixture,routineRequest,binding} from './application-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createRoutinesApplication,ROUTINE_PATHS} from '../application-http.mjs';

test('prepare persists exact canonical proposal and replays without reminting or provider mutation',async()=>{
 const f=await applicationFixture();try{
  const prepared=await f.prepare(),ids=f.state.ids;
  assert.equal(prepared.status,'approval_required');assert.equal(prepared.proposal.taskInstruction,'Summarize authorized activity.');assert.equal(f.preparations.state.rows.size,1);
  const row=[...f.preparations.state.rows.values()][0];assert.equal(row.state,'PREPARED');assert.equal(row.record.argumentsSha256,hash(routineRequest()));assert.deepEqual(row.outcome.result,prepared);
  assert.deepEqual(await f.prepare(),prepared);assert.equal(f.state.ids,ids);assert.equal(f.temporal.calls.create,0);assert.equal(f.sql.state.intents.size,0);
  await assert.rejects(f.prepare({...routineRequest(),taskInstruction:'Changed under same request identity'}));assert.equal(f.state.ids,ids);assert.equal(f.preparations.state.rows.size,1);
 }finally{f.close();}
});

test('explicit approval traverses real lifecycle and SDK once; ACK replay reads without another RPC',async()=>{
 const f=await applicationFixture();try{
  const prepared=await f.prepare(),ids=f.state.ids;
  const result=await f.approve(prepared);assert.equal(result.status,'acknowledged');assert.equal(f.temporal.calls.create,1);assert.equal(f.state.ids,ids);
  const saved=await f.owner.readIntent({tenantId:binding.tenantId,intentId:prepared.proposal.proposalId},()=>{});assert.equal(saved.state,'ACKNOWLEDGED');assert.equal(saved.intent.taskInstructionSha256,hash('Summarize authorized activity.'));
  const calls={...f.temporal.calls};assert.deepEqual(await f.approve(prepared),result);assert.deepEqual(f.temporal.calls,calls);assert.equal(f.state.ids,ids);
  assert.deepEqual(result.receipt.projection.owner,{tenantId:binding.tenantId,actorId:binding.actorId});assert.equal(result.receipt.physicalStopProven,false);
 }finally{f.close();}
});

for(const kind of ['request','digest','actor','revoked','decision'])test(`approval refuses ${kind} substitution before provider RPC`,async()=>{
 const f=await applicationFixture();try{
  const prepared=await f.prepare(),body={...f.body(prepared),decision:'approved'};
  if(kind==='request')body.request={...routineRequest(),taskInstruction:'Another instruction'};
  if(kind==='digest')body.intentSha256='0'.repeat(64);
  if(kind==='actor')f.state.actorId='another-actor';if(kind==='revoked')f.state.revoked=true;if(kind==='decision')body.decision='rejected';
  await assert.rejects(f.call('approve',body));assert.equal(f.temporal.calls.create,0);assert.equal(f.sql.state.intents.size,0);
 }finally{f.close();}
});

test('stored proposal belonging to a different actor cannot be approved under a current native session',async()=>{
 const f=await applicationFixture();try{
  const prepared=await f.prepare(),row=[...f.preparations.state.rows.values()][0];row.actor_id='another-actor';row.outcome.release.binding.actorId='another-actor';
  await assert.rejects(f.approve(prepared));assert.equal(f.temporal.calls.create,0);
 }finally{f.close();}
});

test('uncertain provider effect is never resent; exact real SDK readback reconciles it',async()=>{
 const f=await applicationFixture();try{
  const prepared=await f.prepare();f.state.loseCreateAck=true;
  await assert.rejects(f.approve(prepared),e=>e.outcome==='UNKNOWN');assert.equal(f.temporal.calls.create,1);
  const row=await f.owner.readIntent({tenantId:binding.tenantId,intentId:prepared.proposal.proposalId},()=>{});assert.equal(row.state,'UNKNOWN');
  await assert.rejects(f.approve(prepared),e=>e.outcome==='UNKNOWN');assert.equal(f.temporal.calls.create,1);
  const result=await f.call('reconcile',f.body(prepared));assert.equal(result.outcome,'ACKNOWLEDGED');assert.equal(result.reconciled,true);assert.equal(f.temporal.calls.create,1);
  assert.equal((await f.approve(prepared)).status,'acknowledged');assert.equal(f.temporal.calls.create,1);
 }finally{f.close();}
});

test('unobserved uncertain provider effect retains its barrier and never retries',async()=>{
 const f=await applicationFixture();try{
  const prepared=await f.prepare();f.state.failCreateBefore=true;
  await assert.rejects(f.approve(prepared),e=>e.outcome==='UNKNOWN');assert.equal(f.temporal.calls.create,0);
  const result=await f.call('reconcile',f.body(prepared));assert.equal(result.outcome,'UNRESOLVED');assert.equal(result.reconciled,false);
  f.state.failCreateBefore=false;await assert.rejects(f.approve(prepared),e=>e.outcome==='UNKNOWN');assert.equal(f.temporal.calls.create,0);
 }finally{f.close();}
});

test('lost canonical schedule COMMIT acknowledgement recovers the ACK without provider redispatch',async()=>{
 const f=await applicationFixture();try{
  const prepared=await f.prepare();f.state.loseScheduleCommit=true;
  await assert.rejects(f.approve(prepared),e=>e.outcome==='UNKNOWN');assert.equal(f.temporal.calls.create,1);
  assert.equal((await f.owner.readIntent({tenantId:binding.tenantId,intentId:prepared.proposal.proposalId},()=>{})).state,'ACKNOWLEDGED');
  assert.equal((await f.approve(prepared)).status,'acknowledged');assert.equal(f.temporal.calls.create,1);
 }finally{f.close();}
});

test('lost preparation settlement ACK retains custody and replays without another context identity',async()=>{
 const f=await applicationFixture();try{
  f.preparations.state.onQuery=text=>{if(text.startsWith('UPDATE meri_intents.preparations'))f.preparations.state.commitError=Error('synthetic lost journal COMMIT ACK');};
  await assert.rejects(f.prepare());const ids=f.state.ids;assert.equal([...f.preparations.state.rows.values()][0].state,'PREPARED');
  f.preparations.state.onQuery=null;const recovered=await f.prepare();assert.equal(recovered.status,'approval_required');assert.equal(f.state.ids,ids);assert.equal(f.temporal.calls.create,0);
 }finally{f.close();}
});

test('lost preparation claim acknowledgement keeps PENDING fenced without any context identity or retry',async()=>{
 const f=await applicationFixture();try{
  f.preparations.state.commitError=Error('synthetic lost claim COMMIT ACK');await assert.rejects(f.prepare());
  const ids=f.state.ids;assert.equal(ids,100);assert.equal([...f.preparations.state.rows.values()][0].state,'PENDING');
  await assert.rejects(f.prepare());assert.equal(f.state.ids,ids);assert.equal(f.sql.state.intents.size,0);assert.equal(f.temporal.calls.create,0);
 }finally{f.close();}
});

for(const kind of ['policy','native'])test(`known ${kind} context refusal after journal claim settles FAILED without a lifecycle effect`,async()=>{
 const f=await applicationFixture();try{
  if(kind==='policy')f.state.refusePhase='resolve';else f.state.policyHook=({selection})=>{if(selection.phase==='resolve')f.state.revoked=true;};
  await assert.rejects(f.prepare());const row=[...f.preparations.state.rows.values()][0];assert.equal(row.state,'FAILED');assert.equal(row.outcome.code,'REFUSED');
  const ids=f.state.ids;assert.equal(f.sql.state.intents.size,0);assert.equal(f.temporal.calls.create,0);
  f.state.refusePhase=null;f.state.policyHook=null;f.state.revoked=false;
  const session=await f.sessions.issue({identityCredential:'synthetic-native',deadlineMs:f.now()+4000});
  await assert.rejects(f.call('prepare',{requestId:'request-one',operation:'schedule_task',request:routineRequest()},session.credential));assert.equal(f.state.ids,ids);assert.equal(row.state,'FAILED');
 }finally{f.close();}
});

test('canonical cancel proposal reader supports explicit delete, cancelled ACK replay and truthful list',async()=>{
 const f=await applicationFixture();try{
  const prepared=await f.prepare();await f.approve(prepared);const scheduleId=prepared.proposal.projection.scheduleId;
  const request={scheduleId,mode:'delete',note:'Explicit delete',running:'leave',runs:[]},cancel=await f.prepare(request,'cancel_scheduled_task','request-cancel');
  const row=await f.config.proposalReader.readProposal({tenantId:binding.tenantId,proposalId:cancel.proposal.proposalId,intentSha256:cancel.proposal.intentSha256});assert.equal(row.outcome.result.proposal.cancel.mode,'delete');
  const result=await f.approve(cancel,request);assert.equal(result.receipt.projection.state,'cancelled');assert.equal(f.temporal.calls.delete,1);
  assert.deepEqual(await f.approve(cancel,request),result);assert.equal(f.temporal.calls.delete,1);
  const listed=await f.call('list',{});assert.equal(listed.status,'listed');assert.equal(listed.page.rows.length,1);assert.equal(listed.page.rows[0].projection.state,'cancelled');assert.equal(listed.page.rows[0].inspectionState,'unavailable');
 }finally{f.close();}
});

test('actual list SQL owner and SDK inspection preserve observed schedule and original owner',async()=>{
 const f=await applicationFixture();try{
  assert.equal((await f.call('list',{})).page.rows.length,0);const prepared=await f.prepare();await f.approve(prepared);
  const result=await f.call('list',{limit:1,historyLimit:0});assert.equal(result.page.rows.length,1);assert.equal(result.page.rows[0].inspectionState,'observed');
  assert.deepEqual(result.page.rows[0].projection.owner,{tenantId:binding.tenantId,actorId:binding.actorId});assert.equal(result.page.rows[0].projection.scheduleId,prepared.proposal.projection.scheduleId);
  assert.equal(result.page.originalRuns.executions.length,0);assert.equal(result.page.hasMore,false);
 }finally{f.close();}
});

test('revocation after acknowledged metadata withholds readback without another provider effect',async()=>{
 const f=await applicationFixture();try{
  const prepared=await f.prepare();await f.approve(prepared);let reads=0;
  f.state.policyHook=()=>{if(++reads===2)f.state.revoked=true;};
  await assert.rejects(f.approve(prepared),e=>e.outcome==='ACKNOWLEDGED_NOT_RELEASED');assert.equal(f.temporal.calls.create,1);
 }finally{f.close();}
});

test('revocation after reconciliation acknowledgement preserves known withheld disposition',async()=>{
 const f=await applicationFixture();try{
  const prepared=await f.prepare();f.state.loseCreateAck=true;await assert.rejects(f.approve(prepared),e=>e.outcome==='UNKNOWN');
  let acknowledged=false;f.state.scheduleQueryHook=text=>{
   if(text.startsWith("UPDATE meri_schedules.intents SET state='ACKNOWLEDGED'"))acknowledged=true;
   if(text==='COMMIT'&&acknowledged)f.state.revoked=true;
  };
  await assert.rejects(f.call('reconcile',f.body(prepared)),e=>e.outcome==='ACKNOWLEDGED_NOT_RELEASED');
  assert.equal(f.sql.state.intents.get(binding.tenantId+':'+prepared.proposal.proposalId).state,'ACKNOWLEDGED');assert.equal(f.temporal.calls.create,1);
 }finally{f.close();}
});

test('lost reconciliation COMMIT acknowledgement stays unresolved until exact stored readback',async()=>{
 const f=await applicationFixture();try{
  const prepared=await f.prepare();f.state.loseCreateAck=true;await assert.rejects(f.approve(prepared),e=>e.outcome==='UNKNOWN');
  f.state.loseScheduleCommit=true;await assert.rejects(f.call('reconcile',f.body(prepared)),e=>e.outcome==='UNRESOLVED');
  assert.equal(f.sql.state.intents.get(binding.tenantId+':'+prepared.proposal.proposalId).state,'ACKNOWLEDGED');
  const recovered=await f.call('reconcile',f.body(prepared));assert.equal(recovered.outcome,'ACKNOWLEDGED');assert.equal(recovered.reconciled,false);assert.equal(f.temporal.calls.create,1);
 }finally{f.close();}
});

test('actual HTTP and service reject malformed inputs for all four methods before authority or effects',async()=>{
 const f=await applicationFixture();try{
  const app=createRoutinesApplication({service:f.service,now:f.now,limits:{maxRequestMs:5000,maxRequestBytes:65536,maxResponseBytes:65536}}),baseline=f.state.fetches.length;
  const decision={operation:'schedule_task',request:routineRequest(),proposalId:'10000000-0000-4000-8000-000000000101',intentSha256:'a'.repeat(64)};
  const variants=[['prepare',{}],['prepare',{requestId:'request-invalid',operation:'schedule_task',request:routineRequest(),extra:true}],
   ['approve',{}],['approve',{...decision,decision:'approved',extra:true}],['list',{limit:0}],['list',{extra:true}],['reconcile',{}],['reconcile',{...decision,extra:true}]];
  for(const [method,body] of variants){
   const response=await app.handle(new Request('https://meri.synthetic.invalid'+ROUTINE_PATHS[method],{method:'POST',headers:{authorization:'Bearer '+f.session.credential,'content-type':'application/json'},body:JSON.stringify(body)}));
   assert.equal(response.status,400,method+': '+JSON.stringify(body));assert.deepEqual(await response.json(),{error:{code:'ROUTINES_INVALID_REQUEST',outcome:'NOT_DISPATCHED'}});
  }
  assert.equal(f.state.fetches.length,baseline);assert.equal(f.state.policies.length,0);assert.equal(f.preparations.state.connects,0);assert.equal(f.preparations.state.rows.size,0);
  assert.equal(f.state.scheduleQueries.length,0);assert.equal(f.sql.state.intents.size,0);assert.deepEqual(f.temporal.calls,{describe:0,create:0,update:0,patch:0,delete:0});assert.equal(f.state.ids,100);
 }finally{f.close();}
});
