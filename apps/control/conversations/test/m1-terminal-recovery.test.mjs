/** MR-08: actual worker deadline -> uncertain terminal recording -> canonical reconciliation -> next prompt.
 * SQL, SDK transport and Runtime Stop receipts are synthetic. This does not qualify physical stop or PostgreSQL durability. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {settlementComposition} from './terminal-settlement-harness.mjs';
import {applicationFixture,binding,scopes,versions,id} from './application-fixture.mjs';
import {createNextRunOwner} from '../next-run.mjs';

test('expired worker window with unrecorded terminal outcome remains blocked until execution settlement, then readable ATTEMPT_LOST permits one explicit next turn',async t=>{
 const h=await settlementComposition(),check=()=>{},terminalAttempts=[];
 let reopened,targetSession,serial=1200;
 const principal={tenantId:binding.tenantId,actorId:binding.actorId},conversationId=binding.conversationId;
 const execution=()=>h.f.store.executions.read(binding,check);
 const next=createNextRunOwner({store:h.f.store,versions,newId:()=>id(serial++)});
 const admit=()=>next.admitTurn({principal,conversationId,sourceRunId:binding.runId});
 try{
  h.hooks.afterSubmit=()=>h.allocate();
  h.hooks.beforeAppend=event=>{
   if(event.type==='run.status'&&['failed','cancelled'].includes(event.data.state)){
    terminalAttempts.push(structuredClone(event));
    throw Object.assign(Error('synthetic terminal recording unavailable'),{code:'STORE_UNAVAILABLE'});
   }
  };
  // No injected terminal state or Stop: the existing runtime's absolute window expires while its one SDK iterator is parked.
  h.script=async function*({init,text,stopped}){yield init;yield text('saved before the window expired');await stopped;};
  await assert.rejects(h.execute(),{code:'EXECUTION_STOPPED'});
  assert.equal(h.counts.queries,1);assert.equal(h.inputs.length,1);assert.equal(h.inputs[0].uuid,h.f.input.requestId);
  assert(h.counts.closes>=1);assert.equal(h.counts.captures,0);assert.equal(h.counts.claims,0);
  assert.equal(h.f.state.starts,1);assert.equal(h.f.state.cancels,0);assert.equal(h.f.state.continued,0);
  assert.equal(terminalAttempts.length,4);assert.equal(new Set(terminalAttempts.map(e=>e.eventId)).size,2,'bounded terminal retries retain each candidate event identity');
  assert.deepEqual(terminalAttempts.filter(e=>e.data.state==='cancelled').map(e=>e.data),[
   {state:'cancelled',reasonCode:'EXECUTION_STOPPED'},{state:'cancelled',reasonCode:'EXECUTION_STOPPED'}
  ]);
  const before=await h.history();
  assert.equal(before.run.state,'running');assert.deepEqual(before.run.binding,binding);assert.deepEqual(before.run.versions,versions);
  assert.equal(before.request.requestId,h.f.input.requestId);assert.equal((await h.terminals()).length,0);
  assert.deepEqual(before.events.filter(e=>e.type==='message.delta').map(e=>e.data.text),['saved before the window expired']);
  assert.equal((await execution()).record.phase,'launching');

  h.retireMode='silent';
  assert.deepEqual(await h.reconcile(),{outcome:'unknown',state:'failed'});
  await assert.rejects(admit(),{code:'NEXT_RUN_SOURCE_UNSETTLED'});
  assert.deepEqual((await h.history()).events.slice(0,-1),before.events);assert.equal(h.f.state.nextRuns.size,0);
  assert.equal(h.retirements,1);assert.equal((await execution()).record.phase,'stopping');

  h.retireMode='record';
  assert.deepEqual(await h.reconcile(),{outcome:'settled',state:'failed'});
  const retired=await execution(),settled=await h.history(),terminal=(await h.terminals())[0];
  assert.equal(retired.record.phase,'settled');assert.deepEqual(retired.record.native,{state:'failed',stopped:true});
  assert.equal(h.retirements,2);assert.equal(settled.run.state,'failed');assert.deepEqual(settled.request,before.request);
  assert.deepEqual(settled.events.slice(0,-1),before.events);
  assert.deepEqual(terminal.data,{state:'failed',reasonCode:'ATTEMPT_LOST'});assert.deepEqual(terminal.binding,binding);
  assert.equal(terminal.sequence,before.lastSequence+1);assert.equal((await h.terminals()).length,1);
  assert.deepEqual(await h.reconcile(),{outcome:'settled',state:'failed'});
  assert.equal(h.retirements,2);assert.deepEqual(await h.history(),settled);

  // Close the process-local owner; a new authenticated session reads the retained run and exact cursor without allocating a turn.
  h.f.close();
  reopened=await applicationFixture({pool:h.f.pool,binding});
  assert.notEqual(reopened.credential,h.f.credential);
  assert.deepEqual(await next.selectRun({principal,conversationId,runId:binding.runId}),{binding,reserved:false});
  assert.deepEqual(await reopened.service.history({credential:reopened.credential}),settled);
  const tail=await reopened.service.history({credential:reopened.credential,after:before.lastSequence});
  assert.deepEqual(tail.events,[terminal]);assert.equal(tail.lastSequence,settled.lastSequence);
  assert.equal(h.f.state.nextRuns.size,0);assert.equal(reopened.state.starts,0);assert.equal(reopened.state.cancels,0);

  // Definitive Stop settled the same invocation; the successor remains an explicit user operation.
  const selected=await admit(),replay=await admit(),target=selected.targetBinding;
  assert.deepEqual(selected.sourceBinding,binding);assert.equal(selected.state,'RESERVED');assert.equal(selected.replayed,false);
  assert.deepEqual(replay.targetBinding,target);assert.equal(replay.replayed,true);assert.equal(h.f.state.nextRuns.size,1);
  assert.equal(target.writerFence,binding.writerFence+1);
  for(const key of ['runId','attemptId','workerId'])assert.notEqual(target[key],binding[key]);
  for(const key of ['tenantId','actorId','conversationId'])assert.equal(target[key],binding[key]);
  targetSession=await applicationFixture({pool:h.f.pool,binding:target});
  const input={requestId:id(1300),prompt:'Continue after the expired attempt'};
  const accepted=await targetSession.service.admitInput({credential:targetSession.credential,input});
  assert.equal(accepted.replayed,false);assert.equal(accepted.request.requestId,input.requestId);
  assert.equal((await targetSession.service.admitInput({credential:targetSession.credential,input})).replayed,true);
  await targetSession.service.submit({credential:targetSession.credential,input});
  assert.equal(targetSession.state.starts,1);assert.equal(targetSession.state.cancels,0);
  const loaded=await targetSession.runOwner.load({binding:target});
  assert.deepEqual(loaded.run.binding,target);assert.deepEqual(loaded.run.versions,versions);assert.equal(loaded.request.requestId,input.requestId);
  assert.equal(await h.f.store.nextRuns.execution({binding:target,scopes,selectedClientId:id(5)},check),null,'a failed first turn supplies no checkpoint lineage');
  const listed=await h.f.store.nextRuns.listRuns({tenantId:binding.tenantId,conversationId},check);
  assert.equal(listed.runs.length,2);assert.equal(listed.reservations.length,1);
  assert.equal(listed.runs[0].state,'failed');assert.equal(listed.runs[1].state,'queued');
  assert.equal(listed.runs[1].sequenceBase,listed.runs[0].sequenceEnd);
  assert.equal(h.f.state.executions.size,1);assert.equal(h.counts.queries,1);assert.equal(h.counts.captures,0);
  assert.equal(h.f.state.starts,1);assert.equal(h.f.state.cancels,0);assert.equal(h.f.state.continued,0);
  const targetHistory=await targetSession.service.history({credential:targetSession.credential});
  const eventIdentity=e=>({eventId:e.eventId,sequence:e.sequence,type:e.type,...(e.type==='run.status'?e.data:{})});
  t.diagnostic(JSON.stringify({proof:'synthetic SQL, SDK transport and Runtime Stop port',
   sourceBinding:binding,targetBinding:target,versions,requestIds:{source:before.request.requestId,target:input.requestId},controlIds:[],
   sourceEvents:settled.events.map(eventIdentity),targetEvents:targetHistory.events.map(eventIdentity),
   terminalAttempts:terminalAttempts.map(e=>({eventId:e.eventId,...e.data})),
   sourceStates:[before.run.state,settled.run.state],targetState:loaded.run.state,checkpointLineage:null,
   execution:{phase:retired.record.phase,stopped:retired.record.native.stopped},
   effects:{providerQueries:h.counts.queries,captures:h.counts.captures,controlClaims:h.counts.claims,originalStarts:h.f.state.starts,
    targetStarts:targetSession.state.starts,cancels:h.f.state.cancels+reopened.state.cancels+targetSession.state.cancels,
    continuations:h.f.state.continued,allocations:h.f.state.executions.size,retirementCalls:h.retirements}
  }));
 }finally{targetSession?.close();reopened?.close();h.f.close();}
});
