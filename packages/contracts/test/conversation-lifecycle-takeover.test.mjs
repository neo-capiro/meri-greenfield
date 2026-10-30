import test from 'node:test';
import assert from 'node:assert/strict';
import {assertLifecycleCommand,assertWorkerControl,assertLifecycleReceipt,workerActionForIntent} from '../conversation-lifecycle/validate.mjs';
const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-000000000000`;
const binding={tenantId:'synthetic',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const begin={controlId:id(10),intent:'takeover.begin'};
const end={controlId:id(11),intent:'takeover.end',checkpointId:id(12),checkpointSha256:'a'.repeat(64)};

test('takeover begins through its distinct pause action and ends through native resume',()=>{
 assert.deepEqual(assertLifecycleCommand(begin),begin);assert.deepEqual(assertLifecycleCommand(end),end);
 assert.equal(workerActionForIntent('takeover.begin'),'takeover.begin');
 assert.equal(workerActionForIntent('takeover.end'),'resume');assert.equal(workerActionForIntent('pause'),'pause');
 const command={controlId:begin.controlId,action:'takeover.begin',binding,contextSha256:'b'.repeat(64)};
 assert.deepEqual(assertWorkerControl(command),command);
 for(const extra of [{prompt:'private text'},{ownerInstanceId:id(13)},{leaseEpoch:1},{answers:{Q:'A'}}])
  assert.throws(()=>assertWorkerControl({...command,...extra}));
});
test('public takeover selectors cannot carry caller-authored custody or omit their checkpoint',()=>{
 for(const extra of [{ownerInstanceId:id(13)},{leaseEpoch:1},{browserAdmitted:true},{checkpointId:id(12)}])
  assert.throws(()=>assertLifecycleCommand({...begin,...extra}));
 for(const key of ['checkpointId','checkpointSha256']){const value={...end};delete value[key];assert.throws(()=>assertLifecycleCommand(value));}
});
test('an applied takeover end requires a fresh same-conversation successor and source retirement',()=>{
 const receipt={controlId:end.controlId,intent:end.intent,sourceBinding:binding,inputSha256:'b'.repeat(64),state:'APPLIED',
  checkpointId:end.checkpointId,targetBinding:{...binding,runId:id(21),attemptId:id(22),workerId:id(23),writerFence:2},
  admissionReceiptId:id(24),retirementReceiptId:id(25),replayed:false};
 assert.deepEqual(assertLifecycleReceipt(receipt),receipt);
 for(const field of ['targetBinding','checkpointId','admissionReceiptId','retirementReceiptId'])
  assert.throws(()=>assertLifecycleReceipt({...receipt,[field]:null}));
 for(const field of ['runId','attemptId','workerId','writerFence'])
  assert.throws(()=>assertLifecycleReceipt({...receipt,targetBinding:{...receipt.targetBinding,[field]:binding[field]}}));
 assert.throws(()=>assertLifecycleReceipt({...receipt,targetBinding:{...receipt.targetBinding,conversationId:id(99)}}));
});
