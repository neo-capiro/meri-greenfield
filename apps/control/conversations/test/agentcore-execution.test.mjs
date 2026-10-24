/** Real control/journal functions over scripted SQL. No Runtime, PostgreSQL, model or physical-stop claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,check,at} from './next-run-recovery-fixture.mjs';
import {nativeFixture,binding,scopes,id,rowKey} from './native-next-run-fixture.mjs';
import {versions} from './lifecycle-fixture.mjs';
import {createExecutionBinding,executionIdentity} from '../execution-boundary.mjs';
import {createRunReconciler} from '../run-reconciler.mjs';
import {hash} from '../boundary.mjs';
const identity=(b=binding)=>{const {versions:ignored,...value}=createExecutionBinding({binding:b,versions,plan:{runtime:'synthetic'},expiresAtMs:Date.parse(at)+900000,runtimeSessionId:'conversation-'+hash({tenant:b.tenantId,actor:b.actorId,conversation:b.conversationId})});return value;};
const queued=async x=>{await x.f.service.allocateInput({credential:x.f.credential,input:x.f.input});await x.f.service.submit({credential:x.f.credential,input:x.f.input});};
const phase=(x,b=binding)=>x.f.state.executions.get(rowKey(b)).record.phase;
const record=(x,p,native=null)=>x.f.store.executions.record({binding,executionId:hash(binding),phase:p,native},check);
const stopped=({binding,executionId,runtimeSessionId})=>({binding,executionId,runtimeSessionId,stopped:true});

test('concurrent claims dispatch once; replay and changed session/plan/deadline cannot launch again',async()=>{
 const x=await fixture();try{await queued(x);const original=identity(),claims=await Promise.all([1,2,3].map(()=>x.f.store.executions.claim(original,check)));
  assert.equal(claims.filter(c=>c.dispatch).length,1);assert.equal(x.f.state.executions.size,1);
  for(const patch of [{runtimeSessionId:'foreign-'+hash('foreign')},{planSha256:'b'.repeat(64)},{expiresAtMs:original.expiresAtMs+1}])await assert.rejects(x.f.store.executions.claim({...original,...patch},check),/EXECUTION_REPLAY_REFUSED/);
  await record(x,'unknown');assert.equal((await x.f.store.executions.claim(original,check)).dispatch,false);
 }finally{x.f.close();}
});

test('lost invocation-claim commit acknowledgement retains one identity and never redispatches',async()=>{
 const x=await fixture();try{await queued(x);const original=identity();x.f.faults.onCommit=()=>{if(x.f.state.executions.size){x.f.faults.onCommit=null;throw Error('lost claim acknowledgement');}};
  await assert.rejects(x.f.store.executions.claim(original,check));assert.equal(x.f.state.executions.size,1);
  assert.equal((await x.f.store.executions.claim(original,check)).dispatch,false);
 }finally{x.f.close();}
});

test('terminal cancellation without a claim forbids late dispatch and can admit a fresh successor',async()=>{
 const x=await fixture();try{await queued(x);await x.f.service.cancel({credential:x.f.credential});
  assert.equal(await x.f.store.nextRuns.settlement(binding,check),null);await assert.rejects(x.f.store.executions.claim(identity(),check),/EXECUTION_NOT_QUEUED/);
  const target=(await x.select()).binding;await x.accept(target);assert.equal(x.f.state.executions.size,0);
 }finally{x.f.close();}
});

test('an unknown invocation and a mismatched terminal outcome cannot release a next turn',async()=>{
 const x=await fixture();try{await x.first();await x.running(binding);await record(x,'unknown');await x.f.store.append(binding,x.status('failed','EXECUTION_FAILED'),check);
  await assert.rejects(x.select(),/NEXT_RUN_EXECUTION_UNSETTLED/);await assert.rejects(record(x,'settled',{state:'completed'}),/EXECUTION_SETTLEMENT_REFUSED/);
  assert.equal(phase(x),'unknown');await x.settle(binding);assert.equal((await x.select()).reserved,true);
  await assert.rejects(record(x,'started'),/EXECUTION_TRANSITION_REFUSED/);
 }finally{x.f.close();}
});

test('Stop requires the canonical run fence and ordinary SDK completion cannot clear stopping',async()=>{
 const x=await fixture();try{await x.first();await x.running(binding);await assert.rejects(x.f.store.executions.requestStop(binding,check),/EXECUTION_STOP_UNFENCED/);
  await x.f.service.cancel({credential:x.f.credential});const requested=await x.f.store.executions.requestStop(binding,check);assert.equal(requested.dispatch,true);assert.equal(phase(x),'stopping');
  await assert.rejects(x.settle(binding),/EXECUTION_STOPPING/);await assert.rejects(x.select(),/NEXT_RUN_EXECUTION_UNSETTLED/);
  const repeat=await x.f.store.executions.requestStop(binding,check);assert.equal(repeat.record.executionId,requested.record.executionId);assert.equal(repeat.record.runtimeSessionId,requested.record.runtimeSessionId);
  await assert.rejects(x.f.store.executions.settleStopped({binding,executionId:hash(binding),runtimeSessionId:'foreign-'+hash('foreign'),state:'cancelled'},check),/EXECUTION_STOP_REFUSED/);
  await x.f.store.executions.settleStopped({binding,executionId:hash(binding),runtimeSessionId:requested.record.runtimeSessionId,state:'cancelled'},check);assert.equal((await x.select()).reserved,true);
 }finally{x.f.close();}
});

for(const result of ['lost','wrong-session','false'])test(`Stop ${result} remains uncertain and fenced; exact retry settles the same invocation`,async()=>{
 const x=await fixture();try{await x.first();await x.running(binding);let mode=result,calls=[];
  const reconciler=createRunReconciler({store:x.f.store,stopExecution:async input=>{calls.push({...input,signal:undefined});assert.equal(await x.state(),'failed','run is fenced before external Stop');if(mode==='lost')throw Error('lost Stop acknowledgement');const reply=stopped(input);return mode==='wrong-session'?{...reply,runtimeSessionId:'foreign-'+hash('foreign')}:mode==='false'?{...reply,stopped:false}:reply;}});
  assert.deepEqual(await reconciler.reconcile({binding}),{outcome:'unknown',state:'failed'});assert.equal(phase(x),'stopping');await assert.rejects(x.select(),/NEXT_RUN_EXECUTION_UNSETTLED/);await assert.rejects(x.settle(binding),/EXECUTION_STOPPING/);
  mode='valid';assert.deepEqual(await reconciler.reconcile({binding}),{outcome:'settled',state:'failed'});assert.deepEqual(calls[0],calls[1]);assert.equal((await x.select()).reserved,true);
 }finally{x.f.close();}
});

test('completed settled old Stop does not touch the warm-session successor',async()=>{
 const x=await nativeFixture();try{const target=await x.second();await x.allocate(target);await x.running(target);let stops=0;
  const old=x.f.state.executions.get(rowKey(binding)).record,current=x.f.state.executions.get(rowKey(target)).record;assert.equal(old.runtimeSessionId,current.runtimeSessionId);
  const reconciler=createRunReconciler({store:x.f.store,stopExecution:async input=>{stops++;return stopped(input);}});
  assert.deepEqual(await reconciler.reconcile({binding}),{outcome:'settled',state:'completed'});assert.equal(stops,0);assert.equal(phase(x,target),'launching');assert.equal((await x.f.store.read(target,{after:0,limit:1},check)).run.state,'running');
 }finally{x.f.close();}
});

test('settled execution hashes and immutable SDK ownership are rechecked at both reservation and execution',async()=>{
 const x=await nativeFixture();try{await x.complete();const row=x.f.state.executions.get(rowKey(binding)),original=structuredClone(row);row.record_sha256='f'.repeat(64);await assert.rejects(x.select(),/EXECUTION_CORRUPT/);x.f.state.executions.set(rowKey(binding),original);
  const target=(await x.select()).binding;await x.accept(target);const current=x.f.state.executions.get(rowKey(binding));current.record.runtimeSessionId='foreign-'+hash('foreign');current.record_sha256=hash(current.record);await assert.rejects(x.snapshot(target),/NEXT_RUN_EXECUTION_UNSETTLED/);
 }finally{x.f.close();}
});

test('read-only historical donor keeps all 22 stored entries without installing an ECS execution path',async()=>{
 const x=await nativeFixture();try{await x.complete();const key=rowKey(binding),session=x.f.state.sdkSessions.get(key),native=structuredClone(x.f.state.executions.get(key));delete session.owner.executionSha256;session.owner.allocationSha256='d'.repeat(64);session.owner_sha256=hash(session.owner);x.f.state.executions.delete(key);
  const record={state:'RETIRED',resource:{physicalStopProven:true},original:{binding},allocationSha256:'d'.repeat(64),grantIntents:[{grantId:id(700)}]};x.f.state.allocations.set(key,{tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId,record,record_sha256:hash(record)});
  const target=(await x.select()).binding;await x.accept(target);assert.deepEqual((await x.snapshot(target)).transcripts,x.transcripts);assert.equal(x.f.state.executions.size,0);
  x.f.state.executions.set(key,native);await assert.rejects(x.snapshot(target),/NEXT_RUN_EXECUTION_UNSETTLED/);x.f.state.executions.delete(key);
  await x.allocate(target);assert.ok(executionIdentity(x.f.state.executions.get(rowKey(target)).record).runtimeSessionId);
  record.resource.physicalStopProven=false;x.f.state.allocations.get(key).record_sha256=hash(record);await assert.rejects(x.snapshot(target),/NEXT_RUN_EXECUTION_UNSETTLED/);
 }finally{x.f.close();}
});

test('a historical reservation decoder does not make old physical-stop facts admissible for a new turn',async()=>{
 const x=await nativeFixture();try{await x.complete();const reservation={source:binding,target:{...binding,runId:id(900),attemptId:id(901),workerId:id(902),writerFence:2},facts:{checkpoint:null,retirement:{physicalStopProven:true},revocation:{receiptSha256:'f'.repeat(64),grantIds:['old']}},scopes,versions,policyRevision:'policy1',reservedAt:at};
  await assert.rejects(x.f.store.nextRuns.reserve(reservation,check));assert.equal(x.f.state.nextRuns.size,0);
 }finally{x.f.close();}
});

test('SessionStore admission supplies current scope and immutable identity, permits final flush, then fences settled appends',async()=>{
 const x=await fixture();try{await queued(x);const original={...identity(),expiresAtMs:Date.now()+60000};await x.f.store.executions.claim(original,check);let calls=0;
  const read=()=>x.f.store.executions.withCurrentRun({binding,deadlineMs:Date.now()+10000},async({client,current})=>{calls++;assert.equal(typeof client.query,'function');assert.deepEqual(current.binding,binding);assert.deepEqual(current.scopes,scopes);assert.equal(current.policyRevision,'policy1');assert.equal(current.executionSha256,hash(original));assert.equal(current.executionPhase,'launching');assert.equal(current.deadlineMs,original.expiresAtMs);return current.run.state;});
  assert.equal(await read(),'queued');await x.running(binding);assert.equal(await read(),'running');await x.f.store.append(binding,x.status('completed'),check);assert.equal(await read(),'completed');
  await x.settle(binding);await assert.rejects(read(),/EXECUTION_ADMISSION_REFUSED/);assert.equal(calls,3);
 }finally{x.f.close();}
});

test('SessionStore holds the conversation transaction through final flush before settlement can release a successor',async()=>{
 const x=await fixture();try{await queued(x);await x.f.store.executions.claim({...identity(),expiresAtMs:Date.now()+60000},check);await x.running(binding);await x.f.store.append(binding,x.status('completed'),check);
  const entered=Promise.withResolvers(),release=Promise.withResolvers();let settled=false;
  const flush=x.f.store.executions.withCurrentRun({binding,deadlineMs:Date.now()+10000},async()=>{entered.resolve();await release.promise;return {flushed:true};});await entered.promise;
  const settlement=x.settle(binding).then(()=>{settled=true;});await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,false);release.resolve();assert.deepEqual(await flush,{flushed:true});await settlement;assert.equal(settled,true);
  await assert.rejects(x.f.store.executions.withCurrentRun({binding},async()=>assert.fail('late append admitted')),/EXECUTION_ADMISSION_REFUSED/);
 }finally{x.f.close();}
});

test('SessionStore rejects cancellation, stopping, foreign binding and a newer writer before effects',async()=>{
 const x=await fixture();try{await queued(x);await x.f.store.executions.claim({...identity(),expiresAtMs:Date.now()+60000},check);let effects=0;const effect=async()=>{effects++;return null;};
  await assert.rejects(x.f.store.executions.withCurrentRun({binding:{...binding,actorId:id(888)}},effect),/STALE_WRITER/);
  const row=x.f.state.runs.get(rowKey(binding)),newer=structuredClone(row);newer.projection.binding={...binding,runId:id(889),writerFence:2};newer.run_id=id(889);newer.projection_sha256=hash(newer.projection);x.f.state.runs.set(rowKey(newer.projection.binding),newer);
  await assert.rejects(x.f.store.executions.withCurrentRun({binding},effect),/STALE_WRITER/);x.f.state.runs.delete(rowKey(newer.projection.binding));
  await x.f.service.cancel({credential:x.f.credential});await assert.rejects(x.f.store.executions.withCurrentRun({binding},effect),/EXECUTION_ADMISSION_REFUSED/);
  await x.f.store.executions.requestStop(binding,check);await assert.rejects(x.f.store.executions.withCurrentRun({binding},effect),/EXECUTION_ADMISSION_REFUSED/);assert.equal(effects,0);
 }finally{x.f.close();}
});

test('SessionStore checks caller abort/deadline, immutable expiry and cancellation after the callback',async()=>{
 const x=await fixture();try{await queued(x);await x.f.store.executions.claim({...identity(),expiresAtMs:Date.now()+60000},check);const aborted=new AbortController();aborted.abort();let effects=0;
  for(const input of [{signal:aborted.signal},{deadlineMs:Date.now()-1}])await assert.rejects(x.f.store.executions.withCurrentRun({binding,...input},async()=>{effects++;}),/EXECUTION_ADMISSION_EXPIRED/);
  const during=new AbortController();await assert.rejects(x.f.store.executions.withCurrentRun({binding,signal:during.signal},async()=>{during.abort();return null;}),/EXECUTION_ADMISSION_EXPIRED/);
  const row=x.f.state.executions.get(rowKey(binding));row.record.expiresAtMs=Date.now()-1;row.record_sha256=hash(row.record);
  await assert.rejects(x.f.store.executions.withCurrentRun({binding},async()=>{effects++;}),/EXECUTION_ADMISSION_EXPIRED/);assert.equal(effects,0);
 }finally{x.f.close();}
});

test('missing new execution never makes an active historical allocation safe for a successor',async()=>{
 const x=await fixture();try{await queued(x);await x.f.service.cancel({credential:x.f.credential});const key=rowKey(binding),record={state:'ADMITTED',resource:{},original:{binding},allocationSha256:'d'.repeat(64),grantIntents:[{grantId:id(700)}]};
  const saved={tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId,record,record_sha256:hash(record)};x.f.state.allocations.set(key,saved);await assert.rejects(x.select(),/NEXT_RUN_EXECUTION_UNSETTLED/);
  const retired={...record,state:'RETIRED',resource:{physicalStopProven:true}};x.f.state.allocations.set(key,{...saved,record:retired,record_sha256:hash(retired)});assert.equal((await x.select()).reserved,true);
 }finally{x.f.close();}
});

test('schedule settlement reads exact native completion and refuses unsettled, foreign and corrupt facts',async()=>{
 const x=await fixture();try{await queued(x);assert.equal((await x.f.store.executions.settlement(binding,check)).settled,false);
  await x.f.store.executions.claim(identity(),check);await x.running(binding);await record(x,'unknown');
  await x.f.store.append(binding,x.status('failed','EXECUTION_FAILED'),check);
  assert.equal((await x.f.store.executions.settlement(binding,check)).settled,false);
  await x.f.store.executions.requestStop(binding,check);assert.equal((await x.f.store.executions.settlement(binding,check)).settled,false);
  const current=(await x.f.store.executions.read(binding,check)).record;
  await x.f.store.executions.settleStopped({binding,executionId:current.executionId,runtimeSessionId:current.runtimeSessionId,state:'failed'},check);
  assert.equal((await x.f.store.executions.settlement(binding,check)).settled,true);
  await assert.rejects(x.f.store.executions.settlement({...binding,actorId:'foreign'},check),/STALE_WRITER/);
  const row=x.f.state.executions.get(rowKey(binding));row.record.native.state='completed';row.record_sha256=hash(row.record);
  await assert.rejects(x.f.store.executions.settlement(binding,check),/NEXT_RUN_EXECUTION_UNSETTLED/);
  x.f.state.executions.get(rowKey(binding)).record_sha256='f'.repeat(64);await assert.rejects(x.f.store.executions.settlement(binding,check),/EXECUTION_CORRUPT/);
 }finally{x.f.close();}
});

test('schedule no-invocation settlement preserves the canonical cancellation fence and historical uncertainty',async()=>{
 const x=await fixture();try{await queued(x);await x.f.service.cancel({credential:x.f.credential});
  assert.equal((await x.f.store.executions.settlement(binding,check)).settled,true);
  await assert.rejects(x.f.store.executions.claim(identity(),check),/EXECUTION_NOT_QUEUED/);
  const key=rowKey(binding),record={state:'ADMITTED',resource:{},original:{binding},allocationSha256:'d'.repeat(64),grantIntents:[{grantId:id(700)}]},row={tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId,record,record_sha256:hash(record)};
  x.f.state.allocations.set(key,row);await assert.rejects(x.f.store.executions.settlement(binding,check),/NEXT_RUN_EXECUTION_UNSETTLED/);
  const retained=x.f.state.allocations.get(key);retained.record.state='RETIRED';retained.record.resource.physicalStopProven=true;retained.record_sha256=hash(retained.record);
  assert.equal((await x.f.store.executions.settlement(binding,check)).settled,true);
  x.f.state.allocations.get(key).record_sha256='f'.repeat(64);await assert.rejects(x.f.store.executions.settlement(binding,check),/NEXT_RUN_EXECUTION_UNSETTLED/);
 }finally{x.f.close();}
});

for(const held of ['paused','waiting-for-approval'])test(`canonical cancellation preserves immutable settled ${held} without another invocation`,async()=>{
 const x=await fixture();try{await x.first();await x.running(binding);await x.f.store.append(binding,x.status(held),check);await x.settle(binding);
  const before=structuredClone(x.f.state.executions.get(rowKey(binding)));await x.f.service.cancel({credential:x.f.credential});
  assert.equal((await x.f.store.executions.settlement(binding,check)).settled,true);
  assert.deepEqual(x.f.state.executions.get(rowKey(binding)),before);assert.equal((await x.f.store.executions.requestStop(binding,check)).dispatch,false);
  const reconciler=createRunReconciler({store:x.f.store,stopExecution:async()=>assert.fail('settled held invocation must not stop the warm session')});
  assert.deepEqual(await reconciler.reconcile({binding}),{outcome:'settled',state:'cancelled'});
  await assert.rejects(x.f.store.executions.claim({...identity(),runtimeSessionId:'foreign-'+hash('new')} ,check),/EXECUTION_REPLAY_REFUSED/);
 }finally{x.f.close();}
});
