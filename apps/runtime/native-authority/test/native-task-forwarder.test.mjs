/** Attended native task transport over real sessions/history and a synthetic Core receiver. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoreApprovalForwarder,CORE_APPROVAL_ROUTES} from '../approval-forwarder.mjs';
import {currentNativeApprovalSession} from '../approval-session.mjs';
import {allocatedApplicationFixture,binding,id} from '../../../control/conversations/test/application-fixture.mjs';
import {initialInputFixture} from '../../../control/conversations/test/initial-input-fixture.mjs';
import {nativeTaskFixture} from '../../../control/intents/test/native-task-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
async function fixture(t,general){
 const task=nativeTaskFixture({action:'task.update',general}),p=structuredClone(task.proposal),now=Date.now;
 p.createdAt=new Date(now()-1000).toISOString();p.expiresAt=new Date(now()+60000).toISOString();
 const decision={...task.decision,decidedAt:new Date(now()).toISOString(),expiresAt:p.expiresAt};
 const outcome=structuredClone(task.outcome);outcome.execution.completedAt=new Date(now()).toISOString();outcome.execution.approvalDecisionSha256=hash(decision);outcome.result.updatedAt=outcome.execution.completedAt;
 const base=initialInputFixture(),pool={async connect(){const connection=await base.pool.connect();return {async query(sql,params=[]){
  const text=typeof sql==='string'?sql:sql.text,values=typeof sql==='string'?params:sql.values??[];
  if(text.startsWith('SELECT e.* FROM meri_conversations.events e JOIN')){
   const sequence=row=>(base.state.runs.get([row.event.binding.tenantId,row.event.binding.conversationId,row.event.binding.runId].join(':'))?.sequence_base??0)+row.sequence;
   const rows=[...base.state.events.values()].flat().filter(row=>row.event.binding.tenantId===values[0]&&row.event.binding.conversationId===values[1]&&sequence(row)>values[2]).sort((a,b)=>sequence(a)-sequence(b)).slice(0,values[3]);
   return {rows:rows.map(row=>({...structuredClone(row),tenant_id:row.event.binding.tenantId,conversation_id:row.event.binding.conversationId,run_id:row.event.binding.runId}))};
  }
  return connection.query(sql,params);
 },release:reason=>connection.release(reason)};}};
 const app=await allocatedApplicationFixture({pool,scopes:p.command.scopes,selectedClientId:general?null:p.command.scopes.find(s=>s.kind==='client').resourceId});t.after(app.close);
 assert.equal((await app.post('submit')).status,200);
 const state={requests:[],stored:null,loseAck:false,revoked:false,releaseRevoke:false,responseStatus:200,retentionChecks:0};
 const retention={async assertServable(){state.retentionChecks++;if(state.revoked)throw Error('suppressed');}};
 const forwarder=createCoreApprovalForwarder({origin:'https://core.invalid',nativeCredentials:app.sessions,now,getServiceSecret:async()=> 'synthetic-core-service',readProposal:async()=>p,
  async selectApprovalBinding({proposal,signal}){const selected=await currentNativeApprovalSession({store:app.store,sessions:app.sessions,retention,proposal,signal,now});return {binding:selected.binding,selectedClientId:selected.selectedClientId};},
  async fetchImpl(url,init){
   state.requests.push({url,body:JSON.parse(init.body),headers:init.headers});
   if(url.endsWith(CORE_APPROVAL_ROUTES.execute)){
    state.stored??=structuredClone(outcome);
    if(state.loseAck){state.loseAck=false;throw Error('lost synthetic response');}
    if(state.releaseRevoke)state.revoked=true;
    return Response.json({status:'observed',outcome:state.stored},{status:state.responseStatus});
   }
   assert(url.endsWith(CORE_APPROVAL_ROUTES.executionRead));if(Object.hasOwn(state,'readResult'))return Response.json(state.readResult);return Response.json(state.stored===null?null:{state:'OUTCOME',outcome:state.stored});
  }});
 const call={proposal:p,principal:task.principal,deliveryId:task.decideRequest.deliveryId,decision,deadlineMs:now()+10000};
 return {app,forwarder,call,state,outcome};
}
for(const general of [false,true])test(`native task ${general?'General':'client'} uses attended Core identity and original body; empty read never writes`,async t=>{
 const f=await fixture(t,general);
 assert.equal(await f.forwarder.readTaskExecution(f.call),null);assert.equal(f.state.stored,null);
 const result=await f.forwarder.executeTask(f.call);assert.deepEqual(result,{status:'observed',outcome:f.outcome});
 assert.deepEqual(f.state.requests.at(-1).body,{proposal:f.call.proposal,binding});
 assert.equal(f.state.requests.at(-1).headers.authorization,'Bearer synthetic-native');
 assert.deepEqual(await f.forwarder.readTaskExecution(f.call),{state:'OUTCOME',outcome:f.outcome});
 assert.equal(f.state.requests.filter(r=>r.url.endsWith(CORE_APPROVAL_ROUTES.execute)).length,1);
 assert(f.state.retentionChecks>=6);
});
test('native task lost execute ACK is read back without repeat mutation',async t=>{
 const f=await fixture(t,true);f.state.loseAck=true;
 await assert.rejects(f.forwarder.executeTask(f.call),e=>e.effect==='unknown');
 assert.deepEqual(await f.forwarder.readTaskExecution(f.call),{state:'OUTCOME',outcome:f.outcome});
 assert.equal(f.state.requests.filter(r=>r.url.endsWith(CORE_APPROVAL_ROUTES.execute)).length,1);
});

for(const status of [400,401,403,404,409,422,500])test(`native task post-send ${status} is unknown and recovers without a second execution`,async t=>{
 const f=await fixture(t,true);f.state.responseStatus=status;
 await assert.rejects(f.forwarder.executeTask(f.call),e=>e.effect==='unknown');
 assert.deepEqual(await f.forwarder.readTaskExecution(f.call),{state:'OUTCOME',outcome:f.outcome});
 assert.equal(f.state.requests.filter(r=>r.url.endsWith(CORE_APPROVAL_ROUTES.execute)).length,1);
});
test('current session or retained scope loss refuses before dispatch and revocation at release withholds result',async t=>{
 const f=await fixture(t,true);f.app.sessions.close();
 await assert.rejects(f.forwarder.executeTask(f.call));assert.equal(f.state.requests.length,0);
 const g=await fixture(t,true);g.state.releaseRevoke=true;
 await assert.rejects(g.forwarder.executeTask(g.call),e=>e.effect==='unknown');assert.equal(g.state.requests.length,1);assert(g.state.stored);
});
test('General cannot borrow another private actor scope or silently become a client conversation',async t=>{
 const f=await fixture(t,true),p=structuredClone(f.call.proposal);
 p.command.scopes[0].resourceId=id(999);p.commandSha256=hash(p.command);
 await assert.rejects(currentNativeApprovalSession({store:f.app.store,sessions:f.app.sessions,proposal:p,now:Date.now}));
 assert.equal(f.state.requests.length,0);
});

const absence=p=>({state:'NOT_EXECUTED',proposalId:p.proposalId,commandSha256:p.commandSha256,idempotencyKey:p.command.idempotencyKey,binding:p.command.binding,reason:'expired',checkedAt:p.expiresAt});
test('native terminal expiry read validates exact original custody without recording approval or dispatching',async t=>{
 const f=await fixture(t,true);f.call.proposal.expiresAt=new Date(Date.now()-1).toISOString();f.state.readResult=absence(f.call.proposal);
 assert.deepEqual(await f.forwarder.readTaskExecution(f.call),f.state.readResult);
 assert.equal(f.state.requests.length,1);assert(f.state.requests[0].url.endsWith(CORE_APPROVAL_ROUTES.executionRead));assert.equal(f.state.stored,null);
});
for(const [name,change]of Object.entries({proposal:r=>r.proposalId=id(999),digest:r=>r.commandSha256='f'.repeat(64),key:r=>r.idempotencyKey='other',binding:r=>r.binding.writerFence++,reason:r=>r.reason='cancelled',early:r=>r.checkedAt='2000-01-01T00:00:00.000Z',noncanonical:r=>r.checkedAt=r.checkedAt.replace('.000Z','Z'),extra:r=>r.outcome=null}))test('native terminal proof refuses '+name,async t=>{
 const f=await fixture(t,true);f.call.proposal.createdAt='2025-12-31T23:59:00.000Z';f.call.proposal.expiresAt='2026-01-01T00:00:00.000Z';f.state.readResult=structuredClone(absence(f.call.proposal));change(f.state.readResult);
 await assert.rejects(f.forwarder.readTaskExecution(f.call));assert.equal(f.state.requests.length,1);assert.equal(f.state.stored,null);
});
