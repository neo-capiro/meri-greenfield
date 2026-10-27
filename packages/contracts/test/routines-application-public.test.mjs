import test from 'node:test';import assert from 'node:assert/strict';
import {receiveRoutinesRequest as request,receiveRoutinesResponse as receive,routinesPaths} from '../dist/intents-application.mjs';
import {routinesPublicFixture,routinesPublicExamples} from './routines-application-fixture.mjs';
import {id,binding} from '../../../apps/control/schedules/test/application-fixture.mjs';
import {workflowId} from '../../../apps/control/conversations/temporal-dispatch.mjs';
import {routineManagementSessionPath,receiveRoutineManagementSessionRequest as managementRequest,receiveRoutineManagementSessionReceipt as managementReceipt} from '../dist/intents-application.mjs';
import {receiveConversationSessionReceipt} from '../dist/conversation-session.mjs';
test('cold routine session receiver binds explicit client or General without any conversation or execution authority',()=>{
 for(const clientId of [null,id(12)]){
  assert.deepEqual(managementRequest(JSON.stringify({clientId})),{clientId});
  const context={tenantId:'synthetic-tenant',actorId:'synthetic-actor',selectedClientId:clientId};
  const receipt={kind:'routine-management',credential:'routine_session_'+'A'.repeat(43),expiresAtMs:2000,context};
  const received=managementReceipt(JSON.stringify(receipt),context,1000);
  assert.deepEqual(received,receipt);assert(Object.isFrozen(received));assert(Object.isFrozen(received.context));
  const ordinaryContext={...context,conversationId:id(1),runId:id(2)};
  assert.throws(()=>receiveConversationSessionReceipt(new TextEncoder().encode(JSON.stringify(receipt)),new TextEncoder().encode(JSON.stringify({...ordinaryContext,scopeKind:clientId===null?'general':'client'})),1000));
  assert.throws(()=>managementReceipt(JSON.stringify({credential:'action_session_'+'A'.repeat(43),expiresAtMs:2000,context:ordinaryContext}),context,1000));
 }
 assert.equal(routineManagementSessionPath,'/api/routines/session');
});
test('management receiver rejects authority selectors, foreign context, expired or substituted receipt and oversized lifetime',()=>{
 const context={tenantId:'synthetic-tenant',actorId:'synthetic-actor',selectedClientId:null};
 const receipt={kind:'routine-management',credential:'routine_session_'+'A'.repeat(43),expiresAtMs:2000,context};
 for(const value of [{},{clientId:'bad'},{clientId:null,runId:id(1)},{clientId:null,conversationId:id(2)},{clientId:null,policyRevision:'chosen'},{clientId:null,versions:{}},{clientId:null,executionLimits:{}}])assert.throws(()=>managementRequest(JSON.stringify(value)));
 for(const expected of [{...context,tenantId:'other'},{...context,actorId:'other'},{...context,selectedClientId:id(3)},{...context,runId:id(2)}])assert.throws(()=>managementReceipt(JSON.stringify(receipt),expected,1000));
 for(const value of [{...receipt,kind:'conversation'},{...receipt,credential:'action_session_'+'A'.repeat(43)},{...receipt,expiresAtMs:1000},{...receipt,expiresAtMs:301001},{...receipt,context:{...context,runId:id(2)}},{...receipt,binding}])assert.throws(()=>managementReceipt(JSON.stringify(value),context,1000));
 for(const at of [-1,NaN,Infinity,1000.5])assert.throws(()=>managementReceipt(JSON.stringify(receipt),context,at));
});
test('all four actual HTTP outputs pass browser receiving boundary, including before/after reconciliation',async()=>{
 const examples=await routinesPublicExamples(),proposal=examples.prepare.json.proposal;
 for(const key of Object.keys(examples)){const route=key.startsWith('reconcile')?'reconcile':key,e=examples[key];await request(route,JSON.stringify(e.request));
  const received=await receive(route,e.status,e.text,{request:e.request,...(['approve','reconcile'].includes(route)?{proposal}:{})});assert.deepEqual(received,e.json);assert(Object.isFrozen(received));}
 assert.equal(examples.reconcileBefore.json.error.outcome,'UNRESOLVED');assert.equal(examples.reconcileAfter.json.outcome,'ACKNOWLEDGED');assert.equal(examples.list.json.page.rows.length,1);
});
test('browser refuses substituted reviewed proposal, approval receipt and list order/cursor',async()=>{
 const e=await routinesPublicExamples(),proposal=e.prepare.json.proposal;
 for(const change of [v=>v.proposal.taskInstruction='foreign',v=>v.proposal.projection.maxCostMicrousd=99999999,v=>v.proposal.policy.paused=true]){const value=structuredClone(e.prepare.json);change(value);await assert.rejects(receive('prepare',200,JSON.stringify(value),{request:e.prepare.request}));}
 const wrong=structuredClone(e.approve.json);wrong.receipt.intentId=id(999);await assert.rejects(receive('approve',200,JSON.stringify(wrong),{request:e.approve.request,proposal}));
 const list=structuredClone(e.list.json);list.page.nextAfterScheduleId=id(999);await assert.rejects(receive('list',200,JSON.stringify(list),{request:{}}));
 await assert.rejects(receive('approve',200,e.approve.text,{request:e.approve.request}));
 await assert.rejects(request('execute','{}'));assert.equal(routinesPaths.prepare,'/api/routines/prepare');
});
test('actual transport and policy failures use the shared canonical HTTP status',async()=>{
 const f=await routinesPublicFixture();try{
  for(const options of [{method:'GET'},{credential:null},{headers:{'content-type':'text/plain'}},{headers:{'content-length':'9007199254740992'}}]){const r=await f.exchange('list',{},options);assert.notEqual(r.status,200);assert.deepEqual(await receive('list',r.status,r.text,{request:{}}),r.json);await assert.rejects(receive('list',200,r.text,{request:{}}));}
  f.state.allowed=false;const r=await f.exchange('list',{});assert.notEqual(r.status,200);assert.deepEqual(await receive('list',r.status,r.text,{request:{}}),r.json);
 }finally{f.close();}
});
test('canonical cancellation expansion is reviewable while caller-supplied running targets remain refused',async()=>{
 const observed=[{workflowId:workflowId({...binding,runId:id(901)}),runId:id(902)}];
 const f=await routinesPublicFixture({runCancellation:{async prepare(){return observed;},async cancel(){}}});try{
  const p=await f.prepare();await f.approve(p);
  const body={requestId:'cancel',operation:'cancel_scheduled_task',request:{scheduleId:p.proposal.projection.scheduleId,mode:'pause',running:'request_cancel',runs:[],note:'Reviewed pause'}};
  const r=await f.exchange('prepare',body),accepted=await receive('prepare',r.status,r.text,{request:body});assert.deepEqual(accepted.proposal.cancel.runs,observed);
  await assert.rejects(receive('prepare',r.status,r.text,{request:{...body,request:{...body.request,runs:observed}}}));
 }finally{f.close();}
});
