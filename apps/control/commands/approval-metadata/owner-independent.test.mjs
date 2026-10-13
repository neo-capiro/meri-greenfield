import test from 'node:test';
import assert from 'node:assert/strict';
import {createTaskCreateApprovalMetadataOwner} from './index.mjs';
import {createCommandToolInterface} from '../tool-interface.mjs';
import {commandToolValidators} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {canonicalSha256,assertProposalIntegrity} from '../../../../packages/contracts/validate.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const clone=x=>structuredClone(x);
function setup(options={}){
 const clock={at:Date.now()},now=()=>clock.at,binding={tenantId:'tenant-review',actorId:'actor-review',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
 const commandContext={binding,clientResolution:null},scopes=[{tenantId:binding.tenantId,kind:'tenant',resourceId:binding.tenantId,policyRevision:'review-policy'}],requiredApprover={tenantId:binding.tenantId,actorId:'existing-policy-approver'};
 const state={ids:0,stored:null,inserts:0,reads:0,policy:[],executor:0},expires=new Date(clock.at+60000).toISOString();
 const store={async insert(payload,check){state.inserts++;check();state.stored=clone(payload);check();return clone(payload);},async read(key,check){state.reads++;check();return clone(state.stored);}};
 const preparePolicy=async call=>{state.policy.push(call);return {authorized:true,selectionSha256:call.selectionSha256,binding,scopes,requiredApprover,proposalExpiresAt:expires,checkedAtMs:now(),expiresAtMs:now()+500};};
 const owner=createTaskCreateApprovalMetadataOwner({store:options.store?.(store,state)??store,commandContext,preparePolicy:options.policy?.(preparePolicy,state,clock)??preparePolicy,now,newId:()=>id(100+(state.ids++)),maxRequestMs:500});
 const request={title:'  Follow up on recommendation  ',clientId:' ',dueDate:'2026-10-14'},operation={id:'create_task',version:'0.2.0'},input=commandToolValidators.normalizeCommandToolInput('task.create',request,{commandContext}).input;
 const call={operation,action:'task.create',binding,request,input,inputSha256:canonicalSha256(input),deadlineMs:now()+500};
 const tool=createCommandToolInterface({operation,action:'task.create',outputShape:'TaskCreateToolResult',commandContext,validators:commandToolValidators,assertProposal:assertProposalIntegrity,approvalMetadataOwner:owner,executor:{async execute(){state.executor++;return {status:'indeterminate',outcome:null};}},now,limits:{maxRequestMs:500,maxFactBytes:65536}});
 const readCall=record=>({proposalId:record.proposalId,commandSha256:state.stored.commandSha256,operation,action:'task.create',binding,deadlineMs:now()+500});
 return {clock,now,binding,commandContext,scopes,requiredApprover,state,store,owner,call,tool,readCall,expires};
}
test('independent actual command tool prepares exact immutable task proposal without execution or approval',async()=>{
 const t=setup(),out=await t.tool.prepare(t.call.request);assert.equal(out.status,'approval_required');assertProposalIntegrity(out.proposal);
 assert.deepEqual(out.proposal.command.arguments,{title:'Follow up on recommendation',clientId:null,dueDate:'2026-10-14T00:00:00.000Z'});
 assert.deepEqual(out.proposal.command.binding,t.binding);assert.deepEqual(out.proposal.command.scopes,t.scopes);assert.deepEqual(out.proposal.requiredApprover,t.requiredApprover);
 assert.equal(t.state.inserts,1);assert.equal(t.state.ids,3);assert.equal(t.state.executor,0);assert.equal(Object.hasOwn(out,'approved'),false);
 assert.deepEqual(t.state.policy.map(x=>x.phase),['prepare','before_release']);assert.equal(t.state.stored.commandSha256,out.proposal.commandSha256);
});
test('independent metadata read reaffirms exact original proposal with fresh observation',async()=>{
 const t=setup(),record=await t.owner.prepare(t.call);t.clock.at+=5;const read=await t.owner.read(t.readCall(record));
 assert.deepEqual({...read,checkedAtMs:0},{...record,checkedAtMs:0});assert.equal(read.checkedAtMs,t.now());assert.deepEqual(t.state.policy.map(x=>x.phase),['prepare','before_release','before_read','read_release']);assert.equal(t.state.inserts,1);
});
test('independent explicit prepare allocates distinct immutable identities without resubmission inference',async()=>{
 const t=setup(),a=await t.owner.prepare(t.call),b=await t.owner.prepare(t.call);assert.notEqual(a.proposalId,b.proposalId);assert.notEqual(a.commandId,b.commandId);assert.notEqual(a.idempotencyKey,b.idempotencyKey);assert.equal(t.state.inserts,2);
});
for(const field of ['scopes','requiredApprover','proposalId','commandId','approved','expiresAt'])test(`independent model ${field} cannot become preparation authority`,async()=>{
 const t=setup();await assert.rejects(t.tool.prepare({...t.call.request,[field]:'model'}));assert.equal(t.state.inserts,0);assert.equal(t.state.policy.length,0);assert.equal(t.state.ids,0);
});
for(const kind of ['input','digest','binding','operation','action'])test(`independent forged direct ${kind} refuses before policy and persistence`,async()=>{
 const t=setup(),call=clone(t.call);if(kind==='input')call.input.arguments.title='substitute';if(kind==='digest')call.inputSha256='f'.repeat(64);if(kind==='binding')call.binding.writerFence=2;if(kind==='operation')call.operation.id='update_task';if(kind==='action')call.action='task.update';
 await assert.rejects(t.owner.prepare(call));assert.equal(t.state.inserts,0);assert.equal(t.state.policy.length,0);
});
for(const kind of ['selectionSha256','binding','scopes','requiredApprover','future','expired','authorized'])test(`independent policy ${kind} mismatch refuses before insert`,async()=>{
 const t=setup({policy:base=>async call=>{const r=clone(await base(call));if(kind==='selectionSha256')r.selectionSha256='f'.repeat(64);if(kind==='binding')r.binding.actorId='other';if(kind==='scopes')r.scopes[0].tenantId='other';if(kind==='requiredApprover')r.requiredApprover.tenantId='other';if(kind==='future')r.checkedAtMs+=1;if(kind==='expired')r.expiresAtMs=r.checkedAtMs;if(kind==='authorized')r.authorized=false;return r;}});
 await assert.rejects(t.owner.prepare(t.call));assert.equal(t.state.inserts,0);
});
for(const kind of ['scopes','approver','expiry','denied'])test(`independent after-insert ${kind} change retains stored-not-released`,async()=>{
 const t=setup({policy:base=>async call=>{const r=clone(await base(call));if(call.phase==='before_release'){if(kind==='scopes')r.scopes[0].policyRevision='changed';if(kind==='approver')r.requiredApprover.actorId='changed';if(kind==='expiry')r.proposalExpiresAt=new Date(Date.parse(r.proposalExpiresAt)+1).toISOString();if(kind==='denied')r.authorized=false;}return r;}});
 await assert.rejects(t.owner.prepare(t.call),e=>e.outcome==='STORED_NOT_RELEASED');assert.equal(t.state.inserts,1);assert.ok(t.state.stored);assert.equal(t.state.executor,0);
});
test('independent write acknowledgment loss retains UNKNOWN without automatic new identity or retry',async()=>{
 const t=setup({store:(store,state)=>({...store,async insert(payload,check){await store.insert(payload,check);throw new Error('private-insert-canary');}})});
 await assert.rejects(t.owner.prepare(t.call),e=>e.outcome==='UNKNOWN'&&!e.message.includes('canary'));assert.equal(t.state.inserts,1);assert.equal(t.state.ids,3);assert.ok(t.state.stored);
});
test('independent current read denial occurs before store access and leaks no record',async()=>{
 let denied=false;const t=setup({policy:base=>async call=>{const r=await base(call);return denied?{...r,authorized:false}:r;}}),record=await t.owner.prepare(t.call);denied=true;
 await assert.rejects(t.owner.read(t.readCall(record)));assert.equal(t.state.reads,0);assert.equal(t.state.inserts,1);
});
test('independent read-release revocation cannot return previously stored proposal',async()=>{
 const t=setup({policy:base=>async call=>{const r=await base(call);return call.phase==='read_release'?{...r,authorized:false}:r;}}),record=await t.owner.prepare(t.call);
 await assert.rejects(t.owner.read(t.readCall(record)));assert.equal(t.state.reads,1);assert.equal(t.state.inserts,1);
});
test('independent no retained record is a read refusal rather than an absent approval',async()=>{
 const t=setup();await assert.rejects(t.owner.read({proposalId:id(90),commandSha256:'a'.repeat(64),operation:t.call.operation,action:'task.create',binding:t.binding,deadlineMs:t.now()+500}));assert.equal(t.state.inserts,0);
});
test('independent hostile raw request is inert and detached from policy calls',async()=>{
 const t=setup();let hits=0;for(const request of [{get title(){hits++;return 'x';}},new Proxy({},{ownKeys(){hits++;throw Error('trap');}})])await assert.rejects(t.tool.prepare(request));assert.equal(hits,0);assert.equal(t.state.inserts,0);
});
test('independent policy lease can shorten a parked callback before receipt',async()=>{
 const t=setup({policy:()=>async call=>{call.limitDeadline(Date.now()+15);return new Promise(()=>{});}});
 await assert.rejects(t.owner.prepare(t.call));assert.equal(t.state.inserts,0);
});
test('independent cancellation of a parked insertion returns UNKNOWN and suppresses late metadata',async()=>{
 let release,entered;const enteredPromise=new Promise(resolve=>{entered=resolve;});const t=setup({store:(store,state)=>({...store,insert(payload,check){state.inserts++;return new Promise(resolve=>{release=()=>{state.stored=clone(payload);resolve(clone(payload));};entered();});}})}),a=new AbortController();
 const pending=t.owner.prepare({...t.call,signal:a.signal});await Promise.race([enteredPromise,pending.then(()=>assert.fail('insert unexpectedly completed'),e=>{throw e;})]);a.abort();await assert.rejects(pending,e=>e.outcome==='UNKNOWN');release();await new Promise(resolve=>setImmediate(resolve));assert.equal(t.state.inserts,1);assert.equal(t.state.policy.some(x=>x.phase==='before_release'),false);
});
for(const kind of ['command hash','proposal identity','raw request','original binding'])test(`independent substituted retained ${kind} cannot be read`,async()=>{
 const t=setup(),record=await t.owner.prepare(t.call),read=t.readCall(record);
 if(kind==='command hash')t.state.stored.commandSha256='f'.repeat(64);
 else if(kind==='proposal identity')t.state.stored.record.proposalId=id(900);
 else if(kind==='raw request')t.state.stored.record.request.title='substituted';
 else t.state.stored.record.binding.writerFence=99;
 await assert.rejects(t.owner.read(read));assert.equal(t.state.inserts,1);assert.equal(t.state.executor,0);
});
test('independent actual command interface rechecks retained metadata before calling existing executor',async()=>{
 let denied=false;const t=setup({policy:base=>async call=>{const r=await base(call);return denied?{...r,authorized:false}:r;}});
 const result=await t.tool.prepare(t.call.request);denied=true;
 const execution={contractVersion:'0.1.0',proposalId:result.proposal.proposalId,commandSha256:result.proposal.commandSha256,idempotencyKey:result.proposal.command.idempotencyKey,executorBinding:t.binding};
 await assert.rejects(t.tool.executeApproved(result.proposal,execution,'unused-credential'));assert.equal(t.state.executor,0);assert.equal(t.state.inserts,1);
});
