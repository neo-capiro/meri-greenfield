/** Broker outcomes and cancellation: compute settlement belongs to the control execution owner. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {binding} from '../../control/conversations/test/store-fixture.mjs';
import {createBrokerActivity} from '../temporal-worker.mjs';

function fixture({state='completed',kickoffError,statusError,stopError,heartbeat=()=>{},now=Date.now}={}){
 const controller=new AbortController(),calls=[],executionId=hash(binding),expiresAtMs=now()+30000;
 const ack={binding,executionId,expiresAtMs};let stoppedWithLiveSignal=false;
 const native={async call(operation,input,{signal}){
  calls.push(operation);assert.deepEqual(input.binding,binding);
  if(operation==='execution/kickoff'){assert.equal(input.executionKey,executionId);if(kickoffError)throw kickoffError;return ack;}
  assert.equal(input.executionId,executionId);
  if(operation==='execution/kickoff/stop'){stoppedWithLiveSignal=!signal.aborted;if(stopError)throw stopError;return ack;}
  assert.equal(operation,'execution/kickoff/status');if(statusError)throw statusError;
  return {...ack,state};
 }};
 const run=createBrokerActivity({native,now,pollMs:10,context:()=>({cancellationSignal:controller.signal,
  heartbeat:()=>heartbeat(controller)})});
 return {run,calls,controller,stoppedWithLiveSignal:()=>stoppedWithLiveSignal};
}

test('settled outcomes retain the warm runtime instead of issuing Stop',async()=>{
 for(const state of ['completed','failed','cancelled','paused','waiting-for-approval']){
  const f=fixture({state});assert.deepEqual(await f.run({binding}),{state});
  assert.deepEqual(f.calls,['execution/kickoff','execution/kickoff/status']);
 }
});
test('a lost invocation acknowledgement stops the claimed execution without redispatch',async()=>{
 const f=fixture({kickoffError:Error('ACK_LOST')});await assert.rejects(f.run({binding}),/ACK_LOST/u);
 assert.deepEqual(f.calls,['execution/kickoff','execution/kickoff/stop']);assert(f.stoppedWithLiveSignal());
});
test('cancellation during observation uses a fresh cleanup signal',async()=>{
 const f=fixture({state:'executing',heartbeat:controller=>controller.abort(Error('USER_STOP'))});
 await assert.rejects(f.run({binding}),/USER_STOP/u);assert(f.stoppedWithLiveSignal());
 assert.deepEqual(f.calls,['execution/kickoff','execution/kickoff/status','execution/kickoff/stop']);
});
test('an unreadable status or refused receipt cannot masquerade as completion',async()=>{
 for(const options of [{statusError:Error('STATUS_LOST')},{state:'not-a-terminal-state'}]){
  const f=fixture(options);await assert.rejects(f.run({binding}),/STATUS_LOST|BROKER_RECEIPT_REFUSED/u);
  assert.equal(f.calls.at(-1),'execution/kickoff/stop');
 }
});
test('unknown Stop remains a failed activity and never admits a normal terminal receipt',async()=>{
 const f=fixture({statusError:Error('STATUS_LOST'),stopError:Error('STOP_ACK_LOST')});
 await assert.rejects(f.run({binding}),{code:'BROKER_KICKOFF_CLEANUP_UNKNOWN'});
 assert.equal(f.calls.filter(c=>c==='execution/kickoff/stop').length,1);
});
test('lease expiry stops the execution and pre-cancelled work never dispatches',async()=>{
 let at=1000;const f=fixture({state:'executing',now:()=>at,heartbeat:()=>{at+=31000;}});
 await assert.rejects(f.run({binding}),/BROKER_LEASE_EXPIRED/u);assert(f.stoppedWithLiveSignal());
 const cancelled=fixture();cancelled.controller.abort(Error('CANCELLED_BEFORE_START'));
 await assert.rejects(cancelled.run({binding}),/CANCELLED_BEFORE_START/u);assert.deepEqual(cancelled.calls,[]);
});
