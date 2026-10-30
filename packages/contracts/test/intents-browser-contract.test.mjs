/** Public intents receiver: browser-action proposal, list and decision variants.
 *
 * Uses the REAL generated receiver (`receiveIntentsRequest` / `receiveIntentsResponse`) and the real
 * semantics. A recorded approval is AWAITING EXECUTION; nothing here executes or consumes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {receiveIntentsRequest,receiveIntentsResponse,IntentsResponseError}
 from '../dist/intents-application.mjs';

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const conversationId=id(1),proposalId=id(2),subjectSha256='a'.repeat(64),inputSha256='b'.repeat(64),
 policySha256='c'.repeat(64);
const binding={tenantId:'tenant',actorId:'actor',conversationId,runId:id(3),attemptId:id(4),workerId:id(5),
 writerFence:1};
const scopes=[{tenantId:'tenant',kind:'client',resourceId:id(6),policyRevision:'p1'}];
const deliveryId='browser:'+'d'.repeat(64);
const proposal=()=>({kind:'browser_action',proposalId,subjectSha256,
 operation:{id:'browser_action',version:'0.2.0'},binding,scopes,
 display:{tool:'browser_click',pageOrigin:'https://app.capiro.example',server:'capiov2-browser',
  inputSha256,policySha256},
 requiredApprover:{tenantId:'tenant',actorId:'actor'},requestedAtMs:1700000000000,expiresAtMs:1700003600000,
 createdAt:new Date(1700000000000).toISOString()});
const item=()=>({deliveryId,createdAt:new Date(1700000000000).toISOString(),
 operation:{id:'browser_action',version:'0.2.0'},state:'prepared',kind:'browser_action',
 proposal:proposal(),decision:null,execution:null,phase:'awaiting_approval'});
const listRequest=()=>({conversationId,after:null,limit:20});
const listBody=()=>({conversationId,intents:[item()],next:null});
const decideRequest=()=>({conversationId,deliveryId,proposalId,subjectSha256,decision:'approved'});
const decision=()=>({proposalId,subjectSha256,decision:'approved',
 decidedAt:new Date(1700000100000).toISOString(),approver:{tenantId:'tenant',actorId:'actor'},
 policyRevision:'p1'});
const decideBody=()=>({status:'browser_decision_recorded',deliveryId,proposalId,decision:decision()});

async function list(json){
 const request=await receiveIntentsRequest('list',JSON.stringify(listRequest()));
 return receiveIntentsResponse('list',200,JSON.stringify(json),{request});
}
async function decide(body,request=decideRequest(),retained=proposal()){
 const admitted=await receiveIntentsRequest('decide',JSON.stringify(request));
 return receiveIntentsResponse('decide',200,JSON.stringify(body),{request:admitted,proposal:retained});
}

test('the public receiver admits a browser-action preparation in a list page',async()=>{
 const admitted=await list(listBody());
 assert.equal(admitted.intents.length,1);
 assert.equal(admitted.intents[0].kind,'browser_action');
 assert.equal(admitted.intents[0].operation.id,'browser_action');
 assert.equal(admitted.intents[0].proposal.display.tool,'browser_click');
 assert.equal(admitted.intents[0].phase,'awaiting_approval');
 assert.equal(admitted.intents[0].decision,null);
 assert.equal(admitted.next,null);
});

test('a browser decision is recorded as awaiting execution, not as a success',async()=>{
 const answer=await decide(decideBody());
 assert.equal(answer.status,'browser_decision_recorded');
 assert.equal(answer.decision.decision,'approved');
 assert.equal(Object.hasOwn(answer,'outcome'),false,'no execution outcome is implied');
 const rejected=decideBody();
 rejected.status='browser_rejected';
 rejected.decision={...decision(),decision:'rejected'};
 const request=decideRequest();request.decision='rejected';
 const refused=await decide(rejected,request);
 assert.equal(refused.status,'browser_rejected');
});

test('foreign binding, scope, subject and extra fields are refused by the public receiver',async()=>{
 const foreign=item();foreign.proposal.binding={...binding,conversationId:id(9)};
 await assert.rejects(()=>list({...listBody(),intents:[foreign]}),IntentsResponseError);
 const otherTenant=item();otherTenant.proposal.scopes=[{...scopes[0],tenantId:'other'}];
 await assert.rejects(()=>list({...listBody(),intents:[otherTenant]}),IntentsResponseError);
 const extra=item();extra.proposal.display={...extra.proposal.display,rawInput:'click #go'};
 await assert.rejects(()=>list({...listBody(),intents:[extra]}),IntentsResponseError);
 const expired=item();expired.proposal.expiresAtMs=expired.proposal.requestedAtMs;
 await assert.rejects(()=>list({...listBody(),intents:[expired]}),IntentsResponseError);
 const wrongSubject=decideRequest();wrongSubject.subjectSha256='e'.repeat(64);
 await assert.rejects(()=>decide(decideBody(),wrongSubject),IntentsResponseError);
 const mismatch=decideBody();mismatch.status='browser_rejected';
 await assert.rejects(()=>decide(mismatch),IntentsResponseError,'approved choice cannot answer rejected');
 const foreignDecision=decideBody();
 foreignDecision.decision={...decision(),proposalId:id(10)};
 await assert.rejects(()=>decide(foreignDecision),IntentsResponseError);
});

test('existing SDK decide requests keep their exact shape',async()=>{
 const request=await receiveIntentsRequest('decide',JSON.stringify({conversationId,
  deliveryId:'sdk:'+'f'.repeat(64),proposalId,commandSha256:'1'.repeat(64),decision:'rejected'}));
 assert.equal(request.decision,'rejected');
 await assert.rejects(()=>receiveIntentsRequest('decide',JSON.stringify({conversationId,
  deliveryId:'sdk:'+'f'.repeat(64),proposalId,subjectSha256,decision:'approved'})),IntentsResponseError,
  'an SDK decision still carries a command digest');
});
