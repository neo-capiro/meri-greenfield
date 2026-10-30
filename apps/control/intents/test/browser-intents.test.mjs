/** Control browser-action intents: real approval owner over an in-memory journal and a synthetic Core
 * browser port. The public list/decide answers are validated with the REAL generated receiver. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {receiveIntentsResponse} from '../../../../packages/contracts/dist/intents-application.mjs';
import {createIntentApprovalOwner} from '../approval.mjs';
import {browserProposalFromEntry} from '../browser-proposals.mjs';

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
function entry(state='PREPARED'){return {deliveryId,createdAt:new Date(NOW).toISOString(),
 record:{operation:{id:'browser_approval_preparation',version:'0.2.0'},argumentsSha256:'9'.repeat(64)},
 state,outcome:state==='PREPARED'?{result:structuredClone(result),
  release:{binding,scopes,expiresAtMs:NOW+600000}}:null};}

function statusDoc({proposalId,subjectSha256,decision,completed}){return {
 schema:'meri-browser-approval-status/1',proposalId,subjectSha256,toolUseId:'toolu_01HZX',
 permissive:false,unknown:false,
 consumption:completed?{state:'COMPLETED',consumedAtMs:NOW+2000,
  result:{outcome:'ok',result:{reference:'downloads/r-1'}}}:null,
 ...(decision===null?{}:{decision:{proposalId,commandSha256:subjectSha256,decision,
  decidedAt:new Date(NOW+1000).toISOString(),expiresAt:new Date(NOW+600000).toISOString(),
  approver:{tenantId,actorId},policyRevision:'p1'}})};}

function core({loseAck=false,decision='approved'}={}){
 const state={records:0,statusReads:0,committed:false,completed:false};
 return {state,
  record:async({proposalId,subjectSha256,decision:choice='approved'})=>{
   state.records++;
   if(loseAck)throw Object.assign(Error('synthetic lost ACK'),{effect:'unknown'});
   state.committed=true;state.choice=choice;
   return statusDoc({proposalId,subjectSha256,decision:choice});},
  status:async({proposalId,subjectSha256})=>{
   state.statusReads++;
   return statusDoc({proposalId,subjectSha256,decision:state.committed?state.choice:null,
    completed:state.completed});}};
}

function setup({state='PREPARED',coreOptions,principalActorId=actorId}={}){
 const e=entry(state),clock=()=>NOW,browser=core(coreOptions);
 const journal={read:async({key})=>key.deliveryId===deliveryId?e:null,
  list:async()=>({entries:[e],next:null})};
 const port={record:browser.record,status:browser.status};
 const owner=createIntentApprovalOwner({journal,browser:port,now:clock,limits:{maxRequestMs:5000},enabled:true});
 const principal={tenantId,actorId:principalActorId,role:'member',permissions:[],clientIds:[],
  membershipRevision:'m1'};
 const list=extra=>owner.list({principal,request:{conversationId,...extra}});
 const decide=(extra={},who=principal)=>owner.decide({principal:who,request:{conversationId,deliveryId,
  proposalId,subjectSha256,decision:'approved',...extra}});
 return {e,browser,port,owner,principal,list,decide};
}

test('a retained browser preparation lists as a bounded proposal and decides through Core record',async()=>{
 const s=setup();
 const page=await s.list();
 assert.equal(page.intents.length,1);
 const item=page.intents[0];
 assert.equal(item.kind,'browser_action');
 assert.equal(item.state,'prepared');
 assert.equal(item.proposal.display.tool,'browser_click');
 assert.equal(item.proposal.display.pageOrigin,'https://app.capiro.example');
 assert.equal(Object.hasOwn(item.proposal.display,'rawInput'),false);
 assert.equal(item.decision,null);
 assert.equal(item.phase,'awaiting_approval');
 // The REAL public receiver admits the owner's own answer.
 const admitted=await receiveIntentsResponse('list',200,JSON.stringify(page),
  {request:{conversationId,after:null,limit:20}});
 assert.equal(admitted.intents[0].kind,'browser_action');

 const answer=await s.decide();
 assert.equal(answer.status,'browser_decision_recorded');
 assert.equal(answer.decision.decision,'approved');
 assert.equal(s.browser.state.records,1,'exactly one Core record call');
 assert.equal(Object.hasOwn(s.port,'consume'),false,'the public path holds no consume port at all');
 const receiver=await receiveIntentsResponse('decide',200,JSON.stringify(answer),
  {request:{conversationId,deliveryId,proposalId,subjectSha256,decision:'approved'},
   proposal:item.proposal});
 assert.equal(receiver.status,'browser_decision_recorded');
});

test('rejection is recorded, still not an execution',async()=>{
 const s=setup();
 const answer=await s.decide({decision:'rejected'});
 assert.equal(answer.status,'browser_rejected');
 assert.equal(answer.decision.decision,'rejected');
 assert.equal(Object.hasOwn(answer,'outcome'),false);
 assert.equal(s.browser.state.records,1);
});

test('a lost ACK stays UNKNOWN and reload reads the SAME identity',async()=>{
 const s=setup({coreOptions:{loseAck:true}});
 await assert.rejects(()=>s.decide(),/INTENT_EXECUTION_UNKNOWN|APPROVAL_DECISION_UNKNOWN/u);
 assert.equal(Object.hasOwn(s.port,'consume'),false);
 const page=await s.list();
 assert.equal(page.intents[0].proposal.proposalId,proposalId);
 assert.ok(page.intents[0].decision===null||page.intents[0].decision==='unavailable'||
  page.intents[0].decision.decision==='approved','reload keeps the SAME proposal identity');
 assert.equal(s.browser.state.records,1,'a lost ACK never triggers a second record call');
});

test('foreign subject, approver, expiry and scopes are refused before any Core call',async()=>{
 const s=setup();
 await assert.rejects(()=>s.decide({subjectSha256:'0'.repeat(64)}),/INTENT_MISMATCH/u);
 await assert.rejects(()=>s.decide({}, {tenantId,actorId:id(9),clientIds:[]}),/APPROVER_REFUSED/u);
 await assert.rejects(()=>s.decide({deliveryId:'browser:'+'1'.repeat(64)}),/INTENT_NOT_FOUND|INTENT_NOT_PREPARED/u);
 assert.equal(s.browser.state.records,0,'no Core call before a refusal');
 const expired=entry();
 expired.outcome.result.record={...record,request:{...preparation,expiresAtMs:NOW-1}};
 expired.outcome.result.recordSha256=hash(expired.outcome.result.record);
 const clock=()=>NOW,journal={read:async()=>expired,list:async()=>({entries:[expired],next:null})};
 const raw=core();const owner=createIntentApprovalOwner({journal,browser:{record:raw.record,status:raw.status},now:clock,limits:{maxRequestMs:5000},enabled:true});
 const principal={tenantId,actorId,role:'member',permissions:[],clientIds:[],membershipRevision:'m1'};
 await assert.rejects(()=>owner.decide({principal,request:{conversationId,deliveryId,proposalId,subjectSha256,
  decision:'approved'}}),/INTENT_NOT_APPROVABLE|INTENT_EXPIRED/u);
});

test('a completed consumption is the ONLY source of an executed outcome',async()=>{
 const s=setup();
 await s.decide();
 let page=await s.list();
 assert.equal(page.intents[0].execution,null,'a recorded decision is not an execution');
 s.browser.state.completed=true;
 page=await s.list();
 assert.equal(page.intents[0].execution.state,'completed');
 assert.equal(page.intents[0].execution.outcome,'ok');
 assert.equal(page.intents[0].execution.reference,'downloads/r-1');
 assert.equal(s.browser.state.records,1,'reading does not record again');
});
