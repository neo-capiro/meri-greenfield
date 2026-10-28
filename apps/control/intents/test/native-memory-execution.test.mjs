/** Preparation + approval + receiving over synthetic Core; no database or live qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeMemoryFixture,id} from './native-memory-fixture.mjs';
import {createIntentApprovalOwner} from '../approval.mjs';
import {createNativeIntentApprovals} from '../native-approvals.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {nativeMemoryCandidateFromProposal} from '../../../../packages/contracts/commands-0.2/native-memory-result.mjs';
import {receiveIntentsResponse} from '../../../../packages/contracts/dist/intents-application.mjs';
async function fixture(general){
 const f=nativeMemoryFixture({general}),prepared=await f.port.prepare(f.call),p=prepared.proposal;
 const state={decision:null,outcome:null,submissions:0,reads:0,loseAck:false};
 const decisions=createNativeIntentApprovals({now:f.now,maxFactBytes:65536,async call(operation,input){
  if(operation==='approval/record')state.decision??={proposalId:p.proposalId,commandSha256:p.commandSha256,decision:input.decision,
   decidedAt:new Date(f.now()).toISOString(),expiresAt:p.expiresAt,approver:p.requiredApprover,policyRevision:'policy-1'};
  else assert.equal(operation,'approval/decision');
  return structuredClone({decision:state.decision,checkedAtMs:f.now(),revoked:false});
 }});
 const memory={async execute({proposal,decision}){
  assert.deepEqual(proposal,p);assert.equal(decision.decision,'approved');
  if(!state.outcome){state.submissions++;state.outcome={execution:{kind:'native-memory',proposalId:p.proposalId,commandSha256:p.commandSha256,
   idempotencyKey:p.command.idempotencyKey,binding:p.command.binding,completedAt:new Date(f.now()).toISOString(),approvalDecisionSha256:hash(decision)},
   result:{candidateId:p.proposalId,candidateSha256:hash(nativeMemoryCandidateFromProposal(p)),reviewId:id(600),review:{status:'pending',decidedAt:null,publishedMemoryId:null,checkedAt:new Date(f.now()).toISOString()}}};}
  if(state.loseAck)throw Error('Response lost');
  return {status:'observed',outcome:structuredClone(state.outcome)};
 },async read({proposal}){assert.deepEqual(proposal,p);state.reads++;return state.outcome?{state:'OUTCOME',outcome:structuredClone(state.outcome)}:null;}};
 const owner=createIntentApprovalOwner({journal:f.intentStore.port,decisions,memory,now:f.now,limits:{maxRequestMs:3000},enabled:true});
 const principal={tenantId:f.binding.tenantId,actorId:f.binding.actorId,clientIds:general?[]:[f.scopes[0].resourceId]},listRequest={conversationId:f.binding.conversationId};
 const request={...listRequest,deliveryId:f.call.deliveryId,proposalId:p.proposalId,commandSha256:p.commandSha256,decision:'approved'};
 return {f,p,state,owner,principal,listRequest,request,
  decide:()=>owner.decide({principal,request}),list:()=>owner.list({principal,request:listRequest})};
}
for(const general of [false,true])test(`native memory ${general?'General':'client'} reviews exact preparation and returns one pending candidate`,async()=>{
 const f=await fixture(general);assert.equal(f.state.submissions,0);assert.equal(f.f.journal.rows.size,0);
 const out=await f.decide();assert.equal(out.status,'executed');assert.equal(out.outcome.result.review.status,'pending');
 assert.deepEqual(await receiveIntentsResponse('decide',200,JSON.stringify(out),{request:f.request,proposal:f.p}),out);
 assert.deepEqual(await f.decide(),out);assert.equal(f.state.submissions,1);
 const history=await f.list();assert.equal(history.intents[0].phase,'completed');assert.equal(history.intents[0].execution.outcome.result.review.status,'pending');
 await receiveIntentsResponse('list',200,JSON.stringify(history),{request:f.listRequest});
});
test('lost memory submission response is read from the original outcome without submitting again',async()=>{
 const f=await fixture(true);f.state.loseAck=true;
 await assert.rejects(f.decide());assert.equal(f.state.submissions,1);
 const history=await f.list();assert.equal(history.intents[0].execution.outcome.result.candidateId,f.p.proposalId);
 assert.equal(f.state.submissions,1);assert.equal(f.state.reads,1);
});
for(const status of ['approved','rejected','withdrawn','not_found'])test(`public native memory readback distinguishes ${status} from pending`,async()=>{
 const f=await fixture(true);await f.decide();f.f.state.now+=1000;
 Object.assign(f.state.outcome.result.review,{status,checkedAt:new Date(f.f.now()).toISOString(),decidedAt:status==='not_found'?null:new Date(f.f.now()).toISOString(),publishedMemoryId:status==='approved'?`clio:${id(700)}`:null});
 const history=await f.list(),received=await receiveIntentsResponse('list',200,JSON.stringify(history),{request:f.listRequest});
 assert.equal(received.intents[0].execution.outcome.result.review.status,status);assert.equal(f.state.submissions,1);
});
for(const field of ['candidate','hash','binding','decision','pending-publication','approved-without-id','foreign-review-id','checked-before-submit'])test(`native memory receiver refuses mismatched ${field}`,async()=>{
 const f=await fixture(true),out=structuredClone(await f.decide()),r=out.outcome.result,e=out.outcome.execution;
 if(field==='candidate')r.candidateId=id(999);if(field==='hash')r.candidateSha256='f'.repeat(64);
 if(field==='binding')e.binding.actorId='other';if(field==='decision')e.approvalDecisionSha256='e'.repeat(64);
 if(field==='pending-publication')r.review.publishedMemoryId=`clio:${id(700)}`;
 if(field==='approved-without-id'){r.review.status='approved';r.review.decidedAt=r.review.checkedAt;}
 if(field==='foreign-review-id')r.reviewId='not-a-uuid';if(field==='checked-before-submit')r.review.checkedAt=new Date(f.f.now()-1).toISOString();
 await assert.rejects(receiveIntentsResponse('decide',200,JSON.stringify(out),{request:f.request,proposal:f.p}));
});
