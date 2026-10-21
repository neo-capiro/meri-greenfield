import test from 'node:test';
import assert from 'node:assert/strict';
import {assertPreparedResult} from '../../../worker/conversation/intents/prepared.mjs';
import {attachmentFilingFixture,id,NOW,canonicalSha256} from './attachment-filing-execution-fixture.mjs';

test('attachment intent prepares immutable metadata, then approved canonical filing executes once and retains its durable result',async()=>{
 const c=await attachmentFilingFixture(),prepared=await c.prepare(),{proposal}=prepared;
 assert.equal(prepared.status,'approval_required');assert.deepEqual(proposal.command.attachments,[c.custody.object]);
 assert.equal(assertPreparedResult('command',c.f.descriptor.operation,prepared,c.f.binding,
  {scopes:c.f.scopes,nowMs:NOW}).reference,proposal.proposalId);
 assert.deepEqual(proposal.command.arguments,c.f.context.destination);assert.equal(c.sql.rows.size,1);
 assert.equal(c.state.registrationCalls.length,0);assert.equal(c.state.httpCalls.length,0);assert.equal(c.f.pg.rows.size,0);
 assert.deepEqual(await c.prepare(),prepared);assert.equal(c.sql.rows.size,1);
 c.approve(proposal);const result=await c.execute(proposal),registration=c.state.registrationCalls[0];
 assert.equal(result.status,'observed');assert.equal(result.outcome.receipt.outcome,'succeeded');
 assert.deepEqual(result.outcome.result.files[0].object,c.custody.object);assert.equal(result.outcome.result.files[0].indexingStatus,'pending');
 assert.deepEqual(registration.destination,c.f.context.destination);assert.deepEqual(registration.binding,c.f.binding);
 assert.equal(registration.versionId,c.custody.version.versionId);assert.equal(registration.filename,'Memo.txt');
 assert.equal(registration.mimeType,'text/plain; charset=utf-8');assert.deepEqual(registration.bytes,c.custody.bytes);
 assert.equal(registration.journalState,'CLAIMED');assert.equal(registration.reservations,1);
 assert.deepEqual(c.state.httpCalls[0],{url:'https://source.invalid/api/clio/tools/save_chat_attachments',
  body:{...c.f.context.destination,attachmentIds:[id(40)]}});
 assert.equal([...c.f.pg.rows.values()][0].state,'OUTCOME');assert.equal([...c.b.state().reservations.values()][0].state,'SETTLED');
 assert.deepEqual(await c.execute(proposal),result);assert.equal(c.state.registrationCalls.length,1);assert.equal(c.state.httpCalls.length,1);
 assert.equal(c.b.state().budget.consumed_micro_usd,'10');
 assert.equal(result.outcome.receipt.commandSha256,canonicalSha256(proposal.command));
});

test('concurrent approved deliveries share one claimed filing effect and changed preparation cannot reuse its delivery',async()=>{
 const c=await attachmentFilingFixture(),prepared=await c.prepare(),{proposal}=prepared;c.approve(proposal);
 await assert.rejects(c.prepare(1,{...c.custody.request,objects:[{...c.custody.object,sha256:'f'.repeat(64)}]}),/CONFLICT/);
 assert.equal(c.sql.rows.size,1);
 const attempts=await Promise.allSettled([c.execute(proposal),c.execute(proposal)]);
 assert.ok(attempts.some(attempt=>attempt.status==='fulfilled'&&attempt.value.status==='observed'));
 assert.equal(c.state.registrationCalls.length,1);assert.equal(c.state.httpCalls.length,1);
 assert.equal((await c.execute(proposal)).status,'observed');assert.equal(c.state.registrationCalls.length,1);
});

for(const stage of ['registration','source'])test(`lost ${stage} acknowledgement stays UNKNOWN and replay never repeats the effect`,async()=>{
 const c=await attachmentFilingFixture(),{proposal}=await c.prepare();c.approve(proposal);
 if(stage==='registration')c.state.loseRegistrationAck=true;else c.state.loseSourceAck=true;
 await assert.rejects(c.execute(proposal),/COMMAND_OUTCOME_UNKNOWN/);
 assert.equal([...c.f.pg.rows.values()][0].state,'UNKNOWN');assert.equal(c.state.registrationCalls.length,1);
 const again=await c.execute(proposal);assert.equal(again.status,'indeterminate');assert.equal(c.state.registrationCalls.length,1);
 assert.equal(c.state.httpCalls.length,stage==='source'?1:0);
 assert.equal(c.b.state().reservations.size,1);
});

test('changed immutable source or destination, revoked approval/capability and expired proposal execute nothing',async()=>{
 for(const kind of ['source','destination','approval','capability','expiry']){
  const c=await attachmentFilingFixture(),{proposal}=await c.prepare();c.approve(proposal);
  let selected=proposal;
  if(kind==='source')c.custody.state.changeRecord=record=>{record.version.object.versionId='changed-native-version';};
  if(kind==='destination'){selected=structuredClone(proposal);selected.command.arguments.clientId=id(99);selected.commandSha256=canonicalSha256(selected.command);}
  if(kind==='approval')c.f.state.approvalRevoked=true;
  if(kind==='capability')c.f.state.revoked=true;
  if(kind==='expiry')c.f.state.now=NOW+50000;
  await assert.rejects(c.execute(selected),undefined,kind);
  assert.equal(c.state.registrationCalls.length,0,kind);assert.equal(c.state.httpCalls.length,0,kind);
 }
});

test('suppression or cancellation after registration withholds success and cannot grant retry',async()=>{
 for(const kind of ['suppression','cancel']){
  const c=await attachmentFilingFixture(),{proposal}=await c.prepare(),controller=new AbortController();c.approve(proposal);
  c.state.registrationHook=()=>{if(kind==='suppression')c.custody.state.suppressed=true;else controller.abort();};
  await assert.rejects(c.execute(proposal,controller.signal));assert.equal(c.state.registrationCalls.length,1);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(c.state.httpCalls.length,0);assert.equal([...c.f.pg.rows.values()][0].state,'UNKNOWN');
  c.custody.state.suppressed=false;
  assert.equal((await c.execute(proposal)).status,'indeterminate');assert.equal(c.state.registrationCalls.length,1);
 }
});

test('pending filing and indexing warnings remain partial, with no invented completion or replay effect',async()=>{
 const c=await attachmentFilingFixture(),{proposal}=await c.prepare();c.approve(proposal);
 c.state.httpHook=result=>{result.status='pending';result.savedCount=0;result.pendingCount=1;
  Object.assign(result.files[0],{status:'pending',indexingStatus:'not_indexed',reason:'Source scan pending'});};
 const result=await c.execute(proposal);assert.equal(result.outcome.receipt.outcome,'indeterminate');
 assert.equal(result.outcome.result.files[0].reason,'Source scan pending');
 assert.deepEqual(await c.execute(proposal),result);assert.equal(c.state.registrationCalls.length,1);
});

test('metadata ACK loss remains one stored proposal and UNKNOWN delivery; no registration starts',async()=>{
 const c=await attachmentFilingFixture();c.state.loseMetadataAck=true;
 await assert.rejects(c.prepare(),/UNKNOWN/);assert.equal(c.sql.rows.size,1);
 await assert.rejects(c.prepare(),/UNKNOWN/);assert.equal(c.sql.rows.size,1);
 assert.equal(c.sql.calls.filter(call=>call?.text?.startsWith('INSERT')).length,1);
 assert.equal(c.state.registrationCalls.length,0);
});
