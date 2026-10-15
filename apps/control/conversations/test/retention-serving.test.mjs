/** R1: the canonical retention read gate in the conversation and lifecycle owners (in-process journal). Unchanged behaviour when not
 * suppressed, two-conversation isolation, suppression before an operation and across an awaited read, replay after suppression,
 * release after an authorized transition, closed recovery barrier, unreadable journal, event stream and reconnect, lifecycle and
 * execution-load refusal, and cancellation that still stops work without releasing content. Synthetic identities only. */
import test from 'node:test';import assert from 'node:assert/strict';
import {applicationFixture,binding,id} from './application-fixture.mjs';
import {lifecycleFixture} from './lifecycle-fixture.mjs';
import {createConversationEventSource} from '../events.mjs';
import {createRetentionLedger,createMemoryLedgerSink} from '../../retention/ledger.mjs';
import {createMemoryRetentionJournal} from '../../retention/memory-journal.mjs';
import {createSuppressionOwner,createRetentionReadGate} from '../../retention/suppression.mjs';
import {createServingGate} from '../../retention/reconciliation.mjs';
export function retentionFixture(){
 const sink=createMemoryLedgerSink(),ledger=createRetentionLedger({sink,now:Date.now}),journal=createMemoryRetentionJournal(),serving=createServingGate(),state={calls:[],suppressAfter:null,journalDown:false};
 const ownership={async ownerOf(){return binding.actorId;}};const owner=createSuppressionOwner({ledger,journal,ownership,serving,now:Date.now});
 const gate=createRetentionReadGate({journal:{async get(key){if(state.journalDown)throw Error('journal down');return journal.get(key);}},serving});
 const subject=(conversationId=binding.conversationId,tenantId=binding.tenantId)=>({tenantId,kind:'conversation',subjectId:conversationId}),principal={tenantId:binding.tenantId,actorId:binding.actorId};
 const port={async assertServable(s){state.calls.push(s);if(state.suppressAfter!==null&&state.calls.length===state.suppressAfter){state.suppressAfter=null;await owner.suppress({principal,subject:subject(),reason:'during an awaited read'});}return gate.assertServable(s);}};
 return {state,serving,owner,gate,port,subject,suppress:(s=subject())=>owner.suppress({principal:{...principal,tenantId:s.tenantId},subject:s,reason:'owner request'}),release:(s=subject())=>owner.release({principal:{...principal,tenantId:s.tenantId},subject:s,reason:'withdrawn'})};
}
const refused=async(response,code='CONVERSATION_UNAVAILABLE')=>{assert.equal(response.status,502);const body=await response.json();assert.equal(body.error.code,code);assert.equal(Object.keys(body).join(),'error','no content accompanies a refusal');};
test('unsuppressed serving is unchanged and consults the gate with the trusted conversation identity; another conversation\'s suppression does not touch this one',async()=>{
 const r=retentionFixture(),f=await applicationFixture({retention:r.port});try{
  assert.equal((await f.post('submit')).status,200);const history=await f.post('history',{after:0,limit:10});assert.equal(history.status,200);assert.equal((await history.json()).request.prompt,'Hello');
  assert.ok(r.state.calls.length>=2,'the gate ran before exposure and before release');assert.ok(r.state.calls.every(s=>s.tenantId===binding.tenantId&&s.kind==='conversation'&&s.subjectId===binding.conversationId),'the subject is the authenticated binding, never a request claim');
  await r.suppress(r.subject(id(77)));assert.equal((await f.post('history',{})).status,200,'a different conversation\'s suppression is irrelevant');
  const other=retentionFixture();await other.suppress(other.subject(binding.conversationId,'tenant-other'));assert.equal((await f.post('history',{})).status,200,'the same conversation id in another tenant is a different subject');
 }finally{f.close();}
});
test('suppression refuses history, replay submit, execution load and worker publication, releases nothing, and lets trusted cancellation still stop the run; release restores serving and exact replay',async()=>{
 const r=retentionFixture(),f=await applicationFixture({retention:r.port});try{
  await f.post('submit');await r.suppress();
  await refused(await f.post('history',{}));await refused(await f.post('submit'));
  await assert.rejects(f.runOwner.load({binding}),/RETENTION_SUPPRESSED/,'no relaunch or prompt recovery for a suppressed subject');
  await assert.rejects(f.runOwner.append({binding,event:{eventId:id(20),createdAt:new Date().toISOString(),type:'run.status',data:{state:'starting',reasonCode:null}}}),/RETENTION_SUPPRESSED/);
  const cancel=await f.post('cancel',{});assert.equal(cancel.status,200);assert.deepEqual(await cancel.json(),{state:'cancelled'});assert.equal(f.state.cancels,1,'cleanup under the original authority still stops the run');
  await refused(await f.post('history',{}),'CONVERSATION_UNAVAILABLE');
  await r.release();const history=await f.post('history',{});assert.equal(history.status,200);assert.equal((await history.json()).run.state,'cancelled');assert.equal((await (await f.post('submit')).json()).replayed,true,'exact replay after release');
 }finally{f.close();}
});
test('a suppression that lands during an awaited read is caught before release; a closed recovery barrier or an unreadable journal refuses rather than serving',async()=>{
 const r=retentionFixture(),f=await applicationFixture({retention:r.port});try{
  await f.post('submit');const before=r.state.calls.length;r.state.suppressAfter=before+2;await refused(await f.post('history',{}));assert.ok(r.state.calls.length>=before+2,'the gate ran again after the awaited read');
  await r.release();assert.equal((await f.post('history',{})).status,200);
  r.serving.disable();await refused(await f.post('history',{}));await assert.rejects(f.runOwner.load({binding}),/RETENTION_RECOVERY_BARRIER/);r.serving.enable();
  r.state.journalDown=true;await refused(await f.post('history',{}));await assert.rejects(f.runOwner.load({binding}),/RETENTION_READ_UNAVAILABLE/,'an unreadable journal never means unsuppressed');r.state.journalDown=false;
  assert.equal((await f.post('history',{})).status,200);
 }finally{f.close();}
});
test('an open event stream and a reconnect stop exposing events after suppression or barrier closure',async()=>{
 const r=retentionFixture(),f=await applicationFixture({retention:r.port});try{
  await f.post('submit');const source=createConversationEventSource({service:f.service,credential:f.credential,after:0}),reader=source.getReader();assert.equal((await reader.read()).value.sequence,1);
  // The event source keeps its existing public failure (SUBSCRIPTION_UNAVAILABLE); the gate's refusal is what closed it.
  await r.suppress();await assert.rejects(reader.read(),/SUBSCRIPTION_UNAVAILABLE/,'the open stream stops');reader.releaseLock();
  const reconnect=createConversationEventSource({service:f.service,credential:f.credential,after:0}).getReader();await assert.rejects(reconnect.read(),/SUBSCRIPTION_UNAVAILABLE/,'a reconnect gets nothing');reconnect.releaseLock();assert.ok(r.state.calls.length>0);
  await r.release();r.serving.disable();const barred=createConversationEventSource({service:f.service,credential:f.credential,after:0}).getReader();await assert.rejects(barred.read(),/SUBSCRIPTION_UNAVAILABLE/);barred.releaseLock();r.serving.enable();
  const again=createConversationEventSource({service:f.service,credential:f.credential,after:0}).getReader();assert.equal((await again.read()).value.sequence,1);again.releaseLock();
 }finally{f.close();}
});
test('lifecycle entry points read through the gated history: controls, execution load and checkpoint inspection refuse under suppression while lifecycle cancellation still stops work',async()=>{
 const r=retentionFixture(),f=await lifecycleFixture({retention:r.port});try{
  await f.running();const controls=await f.service.nextControls({credential:f.credential,binding});assert.deepEqual(controls.controls,[]);
  await r.suppress();
  await assert.rejects(f.service.nextControls({credential:f.credential,binding}),/RETENTION_SUPPRESSED/);await assert.rejects(f.service.loadForExecution({credential:f.credential,binding}),/RETENTION_SUPPRESSED/);
  await assert.rejects(f.service.inspectCheckpoint({credential:f.credential,input:{checkpointId:id(600)}}),/RETENTION_SUPPRESSED/);await assert.rejects(f.service.recordCheckpoint({credential:f.credential,binding,input:{controlId:id(601),checkpointId:id(600),checkpointSha256:'a'.repeat(64)}}),/RETENTION_SUPPRESSED/);
  await assert.rejects(f.service.history({credential:f.credential}),/RETENTION_SUPPRESSED/);
  const cancelled=await f.service.cancel({credential:f.credential});assert.equal(cancelled.state,'cancelled');assert.equal(f.state.cancels,1,'lifecycle cancellation runs on the cleanup-only read');
  assert.ok(!JSON.stringify(cancelled).includes('Hello'),'the cleanup response carries no suppressed content');
  await r.release();assert.equal((await f.service.history({credential:f.credential})).run.state,'cancelled');
 }finally{f.close();}
});
