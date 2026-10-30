/** Control browser-action intents over the REAL browser-approval adapter.
 *
 * The browser port is `createBrowserApprovalOperations` over an inert lowest transport (no HTTP, SQL, socket or
 * credential). Only the transport's post/proposal/selected boundaries are synthetic; the adapter's Core04
 * envelopes, lifetime and identity rules are the production ones.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {receiveIntentsResponse} from '../../../../packages/contracts/dist/intents-application.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {createBrowserApprovalOperations} from '../../../runtime/native-authority/browser-approvals.mjs';
import {createIntentApprovalOwner} from '../approval.mjs';

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const NOW=1700000000000,conversationId=id(1),proposalId=id(2),tenantId='tenant',actorId='actor';
const subjectSha256='a'.repeat(64),inputSha256='b'.repeat(64),policySha256='c'.repeat(64);
const binding={tenantId,actorId,conversationId,runId:id(3),attemptId:id(4),workerId:id(5),writerFence:1};
const scopes=[{tenantId,kind:'private-user',resourceId:actorId,policyRevision:'p1'}];
const subject={schema:'meri-browser-action/1',binding,server:'capiov2-browser',tool:'browser_click',
 toolUseId:'toolu_01HZX',inputSha256,pageOrigin:'https://app.capiro.example',policySha256};
const preparation={schema:'meri-browser-approval-preparation/1',subject,subjectSha256,input:{tool:'browser_click',
 arguments:{selector:'#confirm'}},requestedAtMs:NOW-1000,expiresAtMs:NOW+600000};
const record={operation:{id:'browser_action',version:'0.2.0'},action:'browser.action',binding,
 request:preparation,inputSha256:'d'.repeat(64),commandId:id(7),idempotencyKey:id(8),proposalId,scopes,
 createdAt:new Date(NOW).toISOString(),expiresAt:new Date(NOW+600000).toISOString(),
 requiredApprover:{tenantId,actorId},checkedAtMs:NOW,resolved:false};
const deliveryId='browser:'+'e'.repeat(64);
const result={proposalId,subjectSha256,requestSha256:'f'.repeat(64),record,recordSha256:hash(record)};
const entry=()=>({deliveryId,createdAt:new Date(NOW).toISOString(),
 record:{operation:{id:'browser_approval_preparation',version:'0.2.0'},argumentsSha256:'9'.repeat(64)},
 state:'PREPARED',outcome:{result:structuredClone(result),release:{binding,scopes,expiresAtMs:NOW+600000}}});

function statusDoc({decision,completed,revoked=false,proposal=proposalId,subject=subjectSha256}={}){
 return {schema:'meri-browser-approval-status/1',proposalId:proposal,subjectSha256:subject,
  toolUseId:'toolu_01HZX',permissive:false,unknown:false,
  ...(revoked?{revoked:true}:{}),
  consumption:completed?{state:'COMPLETED',consumedAtMs:NOW+2000,
   result:{outcome:'ok',result:{reference:'downloads/r-1'}}}:null,
  ...(decision===null||decision===undefined?{}:{decision:{proposalId:proposal,commandSha256:subject,
   decision,decidedAt:new Date(NOW).toISOString(),expiresAt:new Date(NOW+600000).toISOString(),
   approver:{tenantId,actorId},policyRevision:'p1'}})};
}

/** The inert lowest transport; only these four calls exist. */
function joined({loseAck=false}={}){
 const state={committed:false,completed:false,revoked:false,records:0,statuses:0,forbidden:0,choice:null};
 const calls=[];
 const transport={
  lifetime:(signal,deadlineMs)=>createOperationLifetime({deadlineMs:Math.min(deadlineMs??NOW+5000,NOW+5000),
   now:()=>NOW,errorFactory:code=>Object.assign(Error(code),{code})}),
  proposal:async()=>({schemaVersion:1,metadata:{record},run:{policyRevision:'p1'}}),
  selected:async()=>({}),
  post:async(_life,route,{body})=>{
   calls.push(route);
   if(route.endsWith('/consume')||route.endsWith('/result')){state.forbidden++;
    throw Error('public path must not consume or report an outcome');}
   if(route.endsWith('/record')){
    state.records++;state.committed=true;state.choice=body.decision;
    const d=statusDoc({decision:body.decision}).decision;
    if(loseAck)throw Object.assign(Error('synthetic lost ACK'),{effect:'unknown'});
    return {value:{decision:d,checkedAtMs:NOW,revoked:false},sessionExpiresAtMs:NOW+50000};
   }
   state.statuses++;
   return {value:statusDoc({decision:state.committed?state.choice:null,completed:state.completed,
    revoked:state.revoked}),sessionExpiresAtMs:NOW+50000};
  }};
 const ops=createBrowserApprovalOperations({transport,now:()=>NOW});
 return {state,calls,ops,port:{record:ops.record,status:ops.status}};
}

function setup({now=NOW,adaptorOptions}={}){
 const e=entry(),joinedPort=joined(adaptorOptions);
 const principal={tenantId,actorId,role:'member',permissions:[],clientIds:[],membershipRevision:'m1'};
 const owner=createIntentApprovalOwner({journal:{read:async()=>e,list:async()=>({entries:[e],next:null})},
  browser:joinedPort.port,now:()=>now,limits:{maxRequestMs:5000},enabled:true});
 return {e,...joinedPort,owner,principal,
  list:extra=>owner.list({principal,request:{conversationId,...extra}}),
  decide:(extra={},who=principal)=>owner.decide({principal:who,request:{conversationId,deliveryId,
   proposalId,subjectSha256,decision:'approved',...extra}})};
}

test('the REAL adapter record envelope becomes a recorded decision on both choices',async()=>{
 const s=setup();
 const page=await s.list();
 assert.equal(page.intents[0].phase,'awaiting_approval');
 assert.equal(page.intents[0].decision,null);
 const approved=await s.decide();
 assert.equal(approved.status,'browser_decision_recorded');
 assert.equal(approved.decision.decision,'approved');
 assert.equal(Object.hasOwn(approved,'outcome'),false);
 assert.equal(s.state.records,1);
 assert.equal(s.state.forbidden,0,'no consume and no result write from the public path');
 const admitted=await receiveIntentsResponse('list',200,JSON.stringify(page),
  {request:{conversationId,after:null,limit:20}});
 assert.equal(admitted.intents[0].kind,'browser_action');
});

test('rejection is recorded without execution evidence',async()=>{
 const s=setup();
 const answer=await s.decide({decision:'rejected'});
 assert.equal(answer.status,'browser_rejected');
 assert.equal(answer.decision.decision,'rejected');
 assert.equal(s.state.forbidden,0);
});

test('status evidence before and after a COMPLETED observation',async()=>{
 const s=setup();
 await s.decide();
 let page=await s.list();
 assert.equal(page.intents[0].decision.decision,'approved');
 assert.equal(page.intents[0].execution,null,'a recorded decision is not an execution');
 s.state.completed=true;
 page=await s.list();
 assert.equal(page.intents[0].execution.state,'completed');
 assert.equal(page.intents[0].execution.outcome,'ok');
 assert.equal(page.intents[0].execution.reference,'downloads/r-1');
 assert.equal(s.state.records,1,'reading never records again');
 assert.equal(s.state.forbidden,0);
});

test('a lost ACK stays UNKNOWN and reload recovers the SAME identity read-only',async()=>{
 const s=setup({adaptorOptions:{loseAck:true}});
 await assert.rejects(()=>s.decide(),/INTENT_EXECUTION_UNKNOWN|APPROVAL_DECISION_UNKNOWN/u);
 assert.equal(s.state.forbidden,0);
 const before=s.state.records;
 const page=await s.list();
 assert.equal(page.intents[0].proposal.proposalId,proposalId);
 assert.equal(page.intents[0].decision.decision,'approved');
 assert.equal(s.state.records,before,'no second record call on reload');
});

test('revoked, foreign identity and hash mismatches are refused or shown truthfully',async()=>{
 // Revoked approval: shown as no longer usable, never approved.
 const revoked=setup();
 await revoked.decide();
 revoked.state.revoked=true;
 const page=await revoked.list();
 assert.equal(page.intents[0].decision,null);
 assert.equal(page.intents[0].phase,'expired');

 // Mismatched retained preparation (adapter's own identity check).
 const s=setup();
 const bad={...s.ops};
 await assert.rejects(()=>createBrowserApprovalOperations({transport:{
  lifetime:()=>createOperationLifetime({deadlineMs:NOW+5000,now:()=>NOW,errorFactory:c=>Object.assign(Error(c),{code:c})}),
  proposal:async()=>({schemaVersion:1,metadata:{record:{...record,proposalId:id(9)}},run:{policyRevision:'p1'}}),
  selected:async()=>({}),
  post:async()=>{throw Error('must not post');}},now:()=>NOW}).record({proposalId,subjectSha256,
   decision:'approved',approver:{tenantId,actorId},binding}),/ACCESS_DENIED/u);

 await assert.rejects(()=>s.decide({subjectSha256:'0'.repeat(64)}),/INTENT_MISMATCH/u);
 await assert.rejects(()=>s.decide({proposalId:id(999)}),/INTENT_MISMATCH/u);
 await assert.rejects(()=>s.decide({}, {tenantId,actorId:id(9),clientIds:[]}),/INTENT_MISMATCH|APPROVER_REFUSED/u);
 assert.equal(s.state.records,0,'refusals happen before any Core call');
});

test('an expired proposal refuses and a browser delivery cursor is accepted',async()=>{
 const expired=setup({now:NOW+600001});
 await assert.rejects(()=>expired.decide(),/INTENT_EXPIRED/u);
 assert.equal(expired.state.records,0);
 const s=setup();
 await s.list({after:deliveryId});
 const admitted=await receiveIntentsResponse('list',200,
  JSON.stringify({conversationId,intents:[],next:null}),
  {request:{conversationId,after:deliveryId,limit:20}});
 assert.equal(admitted.next,null);
});
