/** Real metadata, memory scope and intent owners over synthetic storage/Core. Preparation never submits. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeMemoryFixture,operation,NOW,id} from './native-memory-fixture.mjs';
import {createIntentApprovalOwner} from '../approval.mjs';
import {productFailure} from '../../product-access/errors.mjs';
import {assertPreparedResult} from '../../../worker/conversation/intents/prepared.mjs';
import {receiveIntentsResponse} from '../../../../packages/contracts/dist/intents-application.mjs';
const code=expected=>error=>(productFailure(error)?.code??error.code)===expected;
for(const general of [false,true])test(`${general?'General':'client'} prepares exact text and scope once without candidate or publication`,async()=>{
 const f=nativeMemoryFixture({general}),first=await f.port.prepare(f.call);
 assert.equal(first.status,'approval_required');
 assert.equal(first.proposal.command.arguments.content,f.raw.content);
 assert.equal(first.proposal.command.arguments.scope,general?'personal':'client');
 assert.deepEqual(await f.port.prepare(f.call),first);assert.equal(f.state.prepares,1);
 assert.equal(f.metadata.rows.size,1);assert.equal(f.journal.rows.size,0);assert.equal(f.core.calls.length,0);
 const resumed={...f.binding,runId:id(20),attemptId:id(21),writerFence:2};
 assert.deepEqual(await f.newMount(resumed).prepare(f.call),first);
 assert.equal(assertPreparedResult('memory',operation,first,resumed,{scopes:f.scopes,nowMs:NOW}).reference,first.proposal.proposalId);
 const owner=createIntentApprovalOwner({journal:f.intentStore.port,now:f.now,limits:{maxRequestMs:3000},enabled:true});
 const principal={tenantId:f.binding.tenantId,actorId:f.binding.actorId,clientIds:general?[]:[f.scopes[0].resourceId]},request={conversationId:f.binding.conversationId};
 const listed=await owner.list({principal,request}),received=await receiveIntentsResponse('list',200,JSON.stringify(listed),{request});
 assert.equal(received.intents[0].kind,'proposal');assert.deepEqual(received.intents[0].proposal,first.proposal);
 // The missing approved execution port must not be bypassed by enabling an allowlist alone.
 await assert.rejects(owner.decide({principal,request:{...request,deliveryId:f.call.deliveryId,proposalId:first.proposal.proposalId,commandSha256:first.proposal.commandSha256,decision:'approved'}}),code('APPROVAL_OWNER_UNAVAILABLE'));
 assert.equal(f.journal.rows.size,0);
 if(!general){const hidden=await owner.list({principal:{...principal,clientIds:[]},request});assert.equal(hidden.intents[0].withheld,true);assert.equal(Object.hasOwn(hidden.intents[0],'proposal'),false);}
});
test('lost outer settlement ACK reads the original exact proposal without preparing again',async()=>{
 const f=nativeMemoryFixture();f.intentStore.state.loseSettleAck=true;
 await assert.rejects(f.port.prepare(f.call),code('UNKNOWN'));
 const result=await f.port.prepare(f.call);assert.equal(result.status,'approval_required');
 assert.equal(f.state.prepares,1);assert.equal(f.metadata.rows.size,1);assert.equal(f.journal.rows.size,0);
});
test('concurrent delivery has one immutable metadata write and no candidate',async()=>{
 const f=nativeMemoryFixture();let enter,finish;
 const entered=new Promise(r=>{enter=r;}),blocked=new Promise(r=>{finish=r;});
 f.state.afterPrepare=async()=>{enter();await blocked;};
 const first=f.port.prepare(f.call);await entered;
 await assert.rejects(f.newMount().prepare(f.call),code('UNKNOWN'));finish();
 const result=await first;assert.deepEqual(await f.newMount().prepare(f.call),result);
 assert.equal(f.metadata.rows.size,1);assert.equal(f.core.calls.length,0);
});
test('revocation after metadata withholds proposal and recovery does not create another',async()=>{
 const f=nativeMemoryFixture();f.state.afterPrepare=()=>{f.state.revoked=true;};
 await assert.rejects(f.port.prepare(f.call),code('ACCESS_DENIED'));
 await assert.rejects(f.port.prepare(f.call),code('ACCESS_DENIED'));f.state.revoked=false;
 assert.equal((await f.port.prepare(f.call)).status,'approval_required');assert.equal(f.metadata.rows.size,1);assert.equal(f.journal.rows.size,0);
});
test('changed delivery arguments refuse without replacement metadata',async()=>{
 const f=nativeMemoryFixture();await f.port.prepare(f.call);
 await assert.rejects(f.port.prepare({...f.call,arguments:{...f.raw,content:'Different'}}),code('CONFLICT'));
 assert.equal(f.metadata.rows.size,1);assert.equal(f.journal.rows.size,0);
});
test('worker refuses tampered exact proposal, foreign client and wrong approver',async()=>{
 const f=nativeMemoryFixture(),result=await f.port.prepare(f.call);
 for(const change of [r=>{r.proposal.command.arguments.content='changed';},r=>{r.proposal.command.arguments.clientId=id(99);},r=>{r.proposal.requiredApprover.actorId='other';},r=>{r.proposal.expiresAt=new Date(NOW).toISOString();}]){
  const r=structuredClone(result);change(r);assert.throws(()=>assertPreparedResult('memory',operation,r,f.binding,{scopes:f.scopes,nowMs:NOW}),code('INVALID_RESULT'));
 }
});
test('legacy pending-candidate receipts remain readable without becoming a new proposal',()=>{
 const f=nativeMemoryFixture(),old={status:'review_pending',binding:f.binding,scopes:f.scopes,result:{candidateId:id(300),commandSha256:'a'.repeat(64),status:'pending'}};
 assert.equal(assertPreparedResult('memory',operation,old,f.binding,{scopes:f.scopes,nowMs:NOW}).status,'review_pending');
});
