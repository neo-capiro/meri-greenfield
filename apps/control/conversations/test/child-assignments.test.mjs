/** The durable child crossing on the existing run owner: the real lifecycle service and the real lifecycle journal against
 * the scripted PostgreSQL protocol fixture. The assignment is persisted on the run row before the SDK Agent call could be
 * admitted, the result receipt before the parent is acknowledged, and a stale goal revision or a revoked authority never
 * publishes a child result. Scripted SQL only: no SDK, model, provider, network or database is started, so this is source
 * proof of the durable crossing, not live model-workflow acceptance. */
import test from 'node:test';import assert from 'node:assert/strict';
import {lifecycleFixture} from './lifecycle-fixture.mjs';
import {binding,scopes,id} from './store-fixture.mjs';
import {childAssignmentId,readChildAssignments} from '../lifecycle/child-assignments.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
const check=()=>{},key=`${binding.tenantId}:${binding.conversationId}:${binding.runId}`;
/** A refusal is an owned product code; uncertain custody is a store answer. They are asserted apart, never conflated. */
const refuses=code=>error=>String(error.code??error.message).includes(code);
const run=f=>f.state.runs.get(key),durable=f=>readChildAssignments(run(f));
const dispatchInput=(toolUseId='toolu_child_1')=>({toolUseId,role:'research',inputSha256:hash({delegated:toolUseId}),narrowing:{tools:['Read'],maxTurns:8,disallowedTools:['Bash']}});
const settleInput=(toolUseId='toolu_child_1',over={})=>({toolUseId,outcome:'completed',resultSha256:hash({result:toolUseId}),resultBytes:12,sessionId:id(223),agentId:id(224),...over});
const dispatch=(f,input)=>f.service.dispatchChild({credential:f.credential,binding,input}),settle=(f,input)=>f.service.settleChild({credential:f.credential,binding,input});
/** The same durable crossing the service performs, called on the run owner directly so an uncertain COMMIT is injected
 * into the child transaction itself instead of into the authority read that precedes it. */
const ownedDispatch=(f,input)=>f.store.lifecycle.dispatchChild({binding,scopes,input},check),ownedSettle=(f,input)=>f.store.lifecycle.settleChild({binding,scopes,input},check);
const steers=async f=>{const input={controlId:id(230),intent:'steer',text:'Use the exact newer goal'};await f.control(input);
 const claimed=await f.claim(input.controlId);
 await f.service.ackControl({credential:f.credential,binding,input:{controlId:input.controlId,commandSha256:claimed.control.commandSha256,outcome:'APPLIED',sdkUserMessageId:input.controlId}});return input;};

test('the assignment is persisted on the run row before the SDK could dispatch, pinned to the run objective revision, and a re-issued call never dispatches a second child',async()=>{
 const f=await lifecycleFixture();try{await f.running();
  const input=dispatchInput(),answer=await dispatch(f,input);
  assert.deepEqual([answer.replayed,answer.effect],[false,'none']);
  const row0=run(f),receipts=readChildAssignments(row0);
  assert.equal(receipts.length,1,'exactly one durable assignment receipt');
  assert.equal(receipts[0].kind,'assignment');
  assert.equal(receipts[0].assignmentId,childAssignmentId(binding,input.toolUseId));
  assert.equal(receipts[0].assignmentId,answer.assignment.assignmentId);
  assert.equal(receipts[0].revision.requestSha256,row0.request_sha256,'the persisted goal revision is the run objective revision itself');
  assert.equal(receipts[0].revision.steer,null,'no steer has been applied yet');
  assert.deepEqual(receipts[0].narrowing,input.narrowing);
  assert.equal(receipts[0].dispatchedAtMs,answer.assignment.dispatchedAtMs);
  assert.equal(row0.child_assignments_sha256,hash(row0.child_assignments),'the durable receipt digest covers the persisted record');
  const replay=await dispatch(f,input);
  assert.deepEqual([replay.replayed,replay.effect],[true,'unknown'],'a replacement worker reads the persisted assignment instead of dispatching again');
  assert.equal(replay.assignment.assignmentId,receipts[0].assignmentId);
  assert.equal(durable(f).length,1,'the re-issued SDK call appended no second child');
 }finally{f.close();}});

test('the child result receipt is retained before the parent could be acknowledged, written once, and a conflicting second result is refused',async()=>{
 const f=await lifecycleFixture();try{await f.running();
  await assert.rejects(settle(f,settleInput()),/CHILD_ASSIGNMENT_UNKNOWN/);
  assert.equal(durable(f).length,0,'a result without an assignment appends nothing');
  await dispatch(f,dispatchInput());
  const input=settleInput(),answer=await settle(f,input),receipts=durable(f);
  assert.equal(answer.replayed,false);
  assert.equal(receipts.length,2);
  assert.equal(receipts[1].kind,'result');
  assert.equal(receipts[1].assignmentId,receipts[0].assignmentId);
  assert.equal(receipts[1].resultSha256,input.resultSha256);
  // The canonical wire request carries the hook's flat identity; the durable owner persists it as the custody binding.
  assert.deepEqual(receipts[1].custody,{sessionId:input.sessionId,agentId:input.agentId},'the persisted custody is the SDK identity that produced the result');
  assert.deepEqual(answer.receipt.custody,receipts[1].custody,'the service answers with the persisted custody, not the request shape');
  assert.deepEqual(receipts[1].revision,receipts[0].revision,'the result is published under the revision it was assigned under');
  const replay=await settle(f,input);
  assert.equal(replay.replayed,true);
  assert.equal(replay.receipt.settledAtMs,receipts[1].settledAtMs,'the identical replay reads the retained receipt back');
  assert.equal(durable(f).length,2,'no second custody claim');
  await assert.rejects(settle(f,settleInput('toolu_child_1',{resultSha256:hash({other:'result'})})),/CHILD_RESULT_CONFLICT/);
  assert.equal(durable(f).length,2,'a conflicting result never replaces the retained one');
 }finally{f.close();}});

test('a lost acknowledgement leaves the assignment durable and the replacement worker recovers no-effect rather than replaying the child',async()=>{
 const f=await lifecycleFixture();try{await f.running();
  f.state.commitUnknown=true;
  await assert.rejects(ownedDispatch(f,dispatchInput('toolu_child_2')),/COMMIT_UNKNOWN/);
  f.state.commitUnknown=false;
  assert.equal(durable(f).length,1,'the assignment committed even though the acknowledgement was lost');
  const replay=await dispatch(f,dispatchInput('toolu_child_2'));
  assert.deepEqual([replay.replayed,replay.effect],[true,'unknown'],'an uncertain predispatch outcome is read back as persisted, never re-dispatched');
  assert.equal(durable(f).length,1);
  assert.equal(await settle(f,settleInput('toolu_child_2')).then(answer=>answer.replayed),false,'the recovered assignment still settles once');
  assert.equal(durable(f).length,2);
 }finally{f.close();}});

test('a result committed before a lost acknowledgement is read back as committed without a second child or a second receipt',async()=>{
 const f=await lifecycleFixture();try{await f.running();
  await dispatch(f,dispatchInput('toolu_child_3'));
  f.state.commitUnknown=true;
  // The lost acknowledgement is injected at COMMIT only: the receipt is committed, so the answer is uncertain custody,
  // never a refusal, and it is recovered by reading the row back.
  await assert.rejects(ownedSettle(f,settleInput('toolu_child_3')),refuses('STORE_COMMIT_UNKNOWN'),'uncertain custody is distinct from a refusal');
  f.state.commitUnknown=false;
  assert.equal(durable(f).length,2,'the result receipt committed before the acknowledgement was lost');
  assert.deepEqual(durable(f)[1].revision,durable(f)[0].revision,'the committed result carries the exact assignment revision it was admitted under');
  const replay=await settle(f,settleInput('toolu_child_3'));
  assert.equal(replay.replayed,true);assert.equal(durable(f).length,2);
  assert.equal(replay.receipt.resultSha256,settleInput('toolu_child_3').resultSha256,'the read-back receipt is the committed one');
  const reissued=await dispatch(f,dispatchInput('toolu_child_3'));
  assert.deepEqual([reissued.replayed,reissued.effect],[true,'committed'],'a re-issued call under a retained result is committed, not unknown');
  assert.equal(durable(f).length,2);
 }finally{f.close();}});

test('a steer applied between dispatch and publication makes the child revision stale: the result is refused and never recorded',async()=>{
 const f=await lifecycleFixture();try{await f.running();
  await dispatch(f,dispatchInput('toolu_child_4'));
  const control=await steers(f);
  await assert.rejects(settle(f,settleInput('toolu_child_4')),/CHILD_REVISION_STALE/);
  assert.equal(durable(f).length,1,'a stale child publication is refused, not retained as an accepted result');
  await dispatch(f,dispatchInput('toolu_child_5'));
  const receipts=durable(f),latest=receipts.at(-1);
  assert.equal(latest.toolUseId,'toolu_child_5');
  assert.equal(latest.revision.steer.controlId,control.controlId,'a later child is assigned under the applied steer');
  const stored=[...f.state.controls.values()].find(row=>row.projection.input.controlId===control.controlId);
  assert.equal(latest.revision.steer.inputSha256,stored.projection.inputSha256,'the goal revision binds the applied steer\'s own persisted input digest');
  assert.notDeepEqual(latest.revision,receipts[0].revision);
  assert.equal((await settle(f,settleInput('toolu_child_5'))).replayed,false);
  assert.equal(durable(f).length,3);
 }finally{f.close();}});

test('a held or non-running job admits no child assignment, and the refusal performs no retry or polling',async()=>{
 const f=await lifecycleFixture();try{await f.running();
  await f.control({controlId:id(240),intent:'pause'});
  // The counter is scoped to the refusal itself: the hold's own control transaction is not the refusal's work.
  const begins=()=>f.state.calls.filter(sql=>sql==='BEGIN').length,work={starts:f.state.starts,cancels:f.state.cancels};
  const owned=begins();
  await assert.rejects(ownedDispatch(f,dispatchInput('toolu_child_6')),refuses('CHILD_HOLD_REFUSED'));
  assert.equal(begins()-owned,1,'the durable refusal is exactly one bounded transaction');
  const before=begins();
  await assert.rejects(dispatch(f,dispatchInput('toolu_child_6')),refuses('CHILD_HOLD_REFUSED'));
  const first=begins()-before;
  assert.equal(durable(f).length,0,'a waiting/approval-held job performs no child work');
  assert.equal(f.state.calls.some(sql=>sql.startsWith('UPDATE meri_conversations.runs SET child_assignments')),false,'the refusal writes no child receipt');
  assert.deepEqual([f.state.starts,f.state.cancels],[work.starts,work.cancels],'a waiting job starts and cancels no work');
  const repeat=begins();
  await assert.rejects(dispatch(f,dispatchInput('toolu_child_6')),refuses('CHILD_HOLD_REFUSED'));
  assert.equal(begins()-repeat,first,'a repeated refusal performs the same bounded work: no retry loop accumulates');
  // The real cancel operation writes the terminal row through the journal; the row is never hand-mutated behind the store.
  await f.service.cancel({credential:f.credential});
  assert.equal(run(f).projection.state,'cancelled','the real cancel operation reached the terminal state');
  await assert.rejects(dispatch(f,dispatchInput('toolu_child_7')),refuses('CHILD_STATE_REFUSED'));
  assert.equal(durable(f).length,0);
  await assert.rejects(settle(f,settleInput('toolu_child_7')),/CHILD_ASSIGNMENT_UNKNOWN/);
 }finally{f.close();}});

test('a foreign or revoked authority and a malformed request are refused by the durable owner before any child receipt exists',async()=>{
 const f=await lifecycleFixture();try{await f.running();
  await assert.rejects(f.store.lifecycle.dispatchChild({binding:{...binding,writerFence:2},scopes,input:dispatchInput()},check),/STALE_WRITER/);
  await assert.rejects(f.store.lifecycle.dispatchChild({binding,scopes:[{...scopes[0],resourceId:id(9)}],input:dispatchInput()},check),/SCOPE_REFUSED/);
  await assert.rejects(dispatch(f,{...dispatchInput(),toolUseId:'toolu child 1'}),refuses('CHILD_ASSIGNMENT_REFUSED'));
  // The canonical commands-0.2 boundary owns unknown-field refusal (INVALID_COMMAND); a child prompt can never reach the receipt.
  await assert.rejects(dispatch(f,{...dispatchInput(),prompt:'never persisted'}),refuses('INVALID_COMMAND'),'an unknown field such as the child prompt is never accepted');
  await assert.rejects(dispatch(f,{...dispatchInput(),narrowing:{tools:['Read'],maxTurns:0,disallowedTools:[]}}),refuses('CHILD_ASSIGNMENT_REFUSED'));
  assert.equal(durable(f).length,0,'no refused request leaves a child receipt');
  // The real fresh authorization boundary the lifecycle operation reads on every call: the action-session owner.
  f.sessions.revoke(f.credential);
  await assert.rejects(dispatch(f,dispatchInput('toolu_child_8')),refuses('SESSION_REFUSED'),'a revoked worker admits no child');
  assert.equal(durable(f).length,0,'a revoked worker performs no child work');
 }finally{f.close();}});

test('authority revoked after the assignment is durable publishes no result, and a replacement worker can neither re-dispatch nor use the child',async()=>{
 const f=await lifecycleFixture();try{await f.running();
  await dispatch(f,dispatchInput('toolu_child_10'));
  assert.equal(durable(f).length,1,'the assignment is durable before the acknowledgement');
  f.sessions.revoke(f.credential);
  await assert.rejects(settle(f,settleInput('toolu_child_10')),refuses('SESSION_REFUSED'),'a revoked worker cannot publish the child result');
  assert.equal(durable(f).length,1,'no result is recorded under revoked authority');
  await assert.rejects(dispatch(f,dispatchInput('toolu_child_10')),refuses('SESSION_REFUSED'),'a revoked replacement worker cannot re-dispatch either');
  assert.equal(durable(f).length,1,'the persisted assignment is retained and no second child is created');
  const issued=await f.sessions.issue({identityCredential:'synthetic-native'});
  const answer=await f.service.settleChild({credential:issued.credential,binding,input:settleInput('toolu_child_10')});
  assert.equal(answer.replayed,false);
  assert.equal(durable(f).length,2,'a re-authorized worker settles the retained assignment exactly once');
  assert.deepEqual(durable(f)[1].revision,durable(f)[0].revision,'the exact persisted objective revision is preserved across dispatch and settlement');
  assert.deepEqual(durable(f)[1].custody,{sessionId:id(223),agentId:id(224)});
 }finally{f.close();}});
