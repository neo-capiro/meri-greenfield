/** Synthetic (scripted SQL protocol fixture): the only worker exit from a control hold is the explicit, verified uncheckpointed-hold failure. */
import test from 'node:test';import assert from 'node:assert/strict';
import {lifecycleFixture,binding,id} from './lifecycle-fixture.mjs';
const at=new Date().toISOString(),status=(f,eventId,state,reasonCode)=>f.service.publish({credential:f.credential,binding,event:{eventId:id(eventId),createdAt:at,type:'run.status',data:{state,reasonCode}}});
const holdFailure=(f,eventId=270)=>status(f,eventId,'failed','HOLD_CHECKPOINT_FAILED');
const controlState=async(f,controlId)=>(await f.store.lifecycle.get({binding,scopes:(await f.service.history({credential:f.credential})).run.scopes,selectedClientId:id(5),controlId},()=>{})).state;
test('without a control hold the hold-failure reason is refused and an ordinary failure is unaffected',async()=>{const f=await lifecycleFixture();try{await f.running();
 await assert.rejects(holdFailure(f),/HOLD_FAILURE_REFUSED/);assert.equal((await f.service.history({credential:f.credential})).run.state,'running');
 await status(f,271,'failed','EXECUTION_FAILED');assert.equal((await f.service.history({credential:f.credential})).run.state,'failed');}finally{f.close();}});
for(const claimed of [false,true])test(`an unapplied ${claimed?'claimed':'unclaimed'} pause hold admits only the explicit failure, which leaves an UNKNOWN barrier and replays exactly`,async()=>{const f=await lifecycleFixture();try{await f.running();const i={controlId:id(231),intent:'pause'};await f.control(i);if(claimed)await f.claim(i.controlId);
 for(const [state,reasonCode] of [['failed','EXECUTION_FAILED'],['cancelled','EXECUTION_STOPPED'],['completed',null]])await assert.rejects(status(f,272,state,reasonCode),/RUN_HELD/);
 const event=await holdFailure(f);assert.deepEqual(event.data,{state:'failed',reasonCode:'HOLD_CHECKPOINT_FAILED'});assert.deepEqual((await holdFailure(f)).sequence,event.sequence);
 const saved=await f.service.history({credential:f.credential});assert.equal(saved.run.state,'failed');assert.equal(await controlState(f,i.controlId),'UNKNOWN');
 assert.equal((await f.service.nextControls({credential:f.credential,binding})).controls.length,0);await assert.rejects(f.checkpoint(i.controlId),/STATE_REFUSED|CHECKPOINT_REFUSED/);
 await assert.rejects(holdFailure(f,273),/RUN_TRANSITION_REFUSED/);}finally{f.close();}});
test('a checkpointed (applied) hold refuses the hold failure: paused stays paused',async()=>{const f=await lifecycleFixture();try{await f.running();const i={controlId:id(231),intent:'pause'};await f.control(i);await f.claim(i.controlId);await f.checkpoint(i.controlId);
 await assert.rejects(holdFailure(f),/RUN_TRANSITION_REFUSED|RUN_HELD/);assert.equal((await f.service.history({credential:f.credential})).run.state,'paused');assert.equal(await controlState(f,i.controlId),'APPLIED');}finally{f.close();}});
test('a hold-failure attempt whose control row does not match the hold is refused, not terminalized',async()=>{const f=await lifecycleFixture();try{await f.running();await f.control({controlId:id(231),intent:'pause'});f.state.runs.values().next().value.hold_control_id=id(999);
 await assert.rejects(holdFailure(f),/RUN_HELD/);assert.equal((await f.service.history({credential:f.credential})).run.state,'running');}finally{f.close();}});
