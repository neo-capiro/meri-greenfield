import test from 'node:test';
import assert from 'node:assert/strict';
import {feedbackFixture,binding,id} from './feedback-fixture.mjs';
import {hash} from '../boundary.mjs';
import {feedbackExecution} from '../feedback-revision.mjs';
import {savedUsage,payload} from '../usage-read/test/fixture.mjs';
const body=response=>response.json();
test('records factual correction with immutable message revision, server model evidence and truthful readback',async t=>{
 const f=await feedbackFixture();t.after(f.close);
 const response=await f.post('feedback',f.input);assert.equal(response.status,200);
 const result=await body(response),r=result.receipt;
 assert.equal(r.actorId,binding.actorId);assert.equal(r.target.messageId,id(20));assert.equal(r.execution.status,'recorded');
 assert.deepEqual(r.execution.models,['model.alpha','model.beta']);assert.equal(r.execution.attribution,'run_including_subagents');
 assert.equal(r.revision.sha256,hash({messageId:id(20),events:[id(103),id(104)],text:'The saved answer.'}));
 assert.deepEqual(r.disposition,{status:'recorded',review:'not_reviewed',effect:'none'});assert.equal(r.taskRevision.status,'not_applicable');
 assert.deepEqual((await body(await f.post('feedback-read',{runId:binding.runId}))).receipts,[r]);
 assert.equal(f.state.starts,0);assert.equal(f.state.cancels,0);
 assert.deepEqual(f.db.calls.filter(sql=>sql.startsWith('UPDATE')).map(sql=>sql.split(' SET ')[1].split(' WHERE ')[0]),['feedback=$4,feedback_sha256=$5']);
});
test('same request replays one receipt; different signal under the same key is refused',async t=>{
 const f=await feedbackFixture();t.after(f.close);const one=await body(await f.post('feedback',f.input));
 const two=await body(await f.post('feedback',f.input));assert.equal(two.replayed,true);assert.deepEqual(two.receipt,one.receipt);
 const changed=await f.post('feedback',{...f.input,signal:{kind:'recommendation',recommendation:'Show the citation first.'}});
 assert.equal(changed.status,409);assert.equal((await body(changed)).error.code,'FEEDBACK_REPLAY_REFUSED');assert.equal(f.row().feedback.length,1);
});
test('preference and recommendation stay distinct; published artifact pins exact version',async t=>{
 const f=await feedbackFixture();t.after(f.close);
 for(const [offset,signal] of [[0,{kind:'preference',value:'not_helpful',note:null}],[1,{kind:'recommendation',recommendation:'Put the summary first.'}]]){
  const result=await body(await f.post('feedback',{...f.input,requestId:id(60+offset),target:{kind:'artifact',runId:binding.runId,throughSequence:7,artifactId:id(30),versionId:id(31)},signal}));
  assert.deepEqual(result.receipt.signal,signal);assert.deepEqual(result.receipt.revision.artifact,{status:'bound',artifactId:id(30),versionId:id(31)});
 }
});
test('closed contract refuses forged model/actor/disposition, empty corrections and mixed signal kinds',async t=>{
 const f=await feedbackFixture();t.after(f.close);
 for(const patch of [{effectiveModel:'forged'},{actorId:'forged'},{disposition:{status:'accepted'}},{signal:{kind:'factual_correction',proposedCorrection:' '}},{signal:{kind:'preference',value:'helpful',note:null,recommendation:'extra'}}]){
  assert.equal((await f.post('feedback',{...f.input,...patch})).status,400);
 }
 assert.equal(f.row().feedback,null);
});
test('stale revision, live run, foreign run, missing message and foreign source never write',async t=>{
 const f=await feedbackFixture();t.after(f.close);
 for(const target of [{...f.input.target,throughSequence:6},{...f.input.target,runId:id(999)},{...f.input.target,messageId:id(998)}])assert.ok([403,409].includes((await f.post('feedback',{...f.input,target})).status));
 assert.equal((await f.post('feedback',{...f.input,sourceEventId:id(997)})).status,403);
 f.row().projection.state='running';f.row().projection_sha256=hash(f.row().projection);
 assert.equal((await f.post('feedback',f.input)).status,409);assert.equal(f.row().feedback,null);
});
test('lost COMMIT acknowledgement is unknown, then exact readback and replay recover one receipt',async t=>{
 const f=await feedbackFixture();t.after(f.close);f.db.commitUnknown=true;
 const response=await f.post('feedback',f.input);assert.equal(response.status,503);assert.equal((await body(response)).error.code,'FEEDBACK_WRITE_UNKNOWN');
 f.db.commitUnknown=false;const saved=await body(await f.post('feedback-read',{runId:binding.runId}));assert.equal(saved.receipts.length,1);
 const replay=await body(await f.post('feedback',f.input));assert.equal(replay.replayed,true);assert.deepEqual(replay.receipt,saved.receipts[0]);
});
test('revoked current session blocks writes and receipt readback',async t=>{
 const f=await feedbackFixture();t.after(f.close);await f.post('feedback',f.input);f.state.revoked=true;
 assert.equal((await f.post('feedback',f.input)).status,403);assert.equal((await f.post('feedback-read',{runId:binding.runId})).status,403);
});
test('corrupt receipt/event evidence fails closed',async t=>{
 const f=await feedbackFixture();t.after(f.close);
 f.rows[3].event.data.text='mutated';assert.equal((await f.post('feedback',f.input)).status,502);assert.equal(f.row().feedback,null);
 [...f.db.events.values()][0][3].event.data.text='The saved ';assert.equal((await f.post('feedback',f.input)).status,200);f.row().feedback[0].signal.proposedCorrection='tampered';
 assert.equal((await f.post('feedback-read',{runId:binding.runId})).status,502);
});
test('current scope changes refuse historical feedback and readback',async t=>{
 const f=await feedbackFixture();t.after(f.close);f.state.context.scopes[0].resourceId=id(400);
 assert.equal((await f.post('feedback',f.input)).status,403);assert.equal((await f.post('feedback-read',{runId:binding.runId})).status,403);assert.equal(f.row().feedback,null);
});
test('selected source revision and approval/checkpoint links bind immutable owner events without granting authority',async t=>{
 const f=await feedbackFixture();t.after(f.close);
 const examples=[['source.available',{sourceId:'source',recordId:'record',sourceVersionId:'revision-7',observedAt:'2026-10-26T00:00:00.000Z',sourceUpdatedAt:null,citationId:id(300),scopes:f.rows[0].event.scopes,contentSha256:'d'.repeat(64),authorizationDecisionId:id(301)}],['checkpoint.verified',{checkpointId:id(302)}]];
 for(const [i,[type,data]] of examples.entries()){
  const event={...f.rows[0].event,eventId:id(310+i),sequence:8+i,type,data};f.rows.push({...f.rows[0],sequence:event.sequence,event_id:event.eventId,event,event_sha256:hash(event)});
 }
 f.row().last_sequence=9;const input={...f.input,target:{...f.input.target,throughSequence:9},sourceEventId:id(310)};
 const response=await f.post('feedback',input);assert.equal(response.status,200);const r=(await body(response)).receipt;
 assert.deepEqual(r.sourceRevision,{status:'bound',eventId:id(310),eventSha256:hash(f.rows[7].event)});
 assert.deepEqual(r.linkedReceipts,[{kind:'completion',eventId:id(311),eventSha256:hash(f.rows[8].event)}]);assert.equal(r.disposition.effect,'none');
});
test('absent usage and unknown cumulative delta do not substitute the selected model',()=>{
 assert.deepEqual(feedbackExecution({request:{modelSelection:{modelId:'selected'}}}),{status:'unavailable',reason:'usage_not_recorded'});
 const usage=savedUsage(payload(),{mode:'resume',parentSessionId:id(70),baseline:null});assert.equal(feedbackExecution({projection:{binding},sdk_usage:usage,sdk_usage_sha256:hash(usage)}).reason,'run_model_delta_unavailable');
});
