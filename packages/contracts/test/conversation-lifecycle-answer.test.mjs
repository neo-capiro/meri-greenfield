/** The `answer` control intent and the worker command it becomes: one additive branch beside steer/pause/approval.
 * Source validator only — the browser distribution is generated separately. */
import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import canonicalize from 'canonicalize';
import {assertLifecycleCommand,assertWorkerControl,assertLifecycleReceipt,workerActionForIntent} from '../conversation-lifecycle/validate.mjs';
const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-000000000000`,hash=v=>createHash('sha256').update(canonicalize(v)).digest('hex');
const binding={tenantId:'synthetic',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const answer={controlId:id(20),intent:'answer',questionId:id(21),answers:{'How should I format the output?':'Summary'}};

test('an answer control carries the question id and the chosen labels',()=>{
 assert.deepEqual(assertLifecycleCommand(answer),answer);
 assert.deepEqual(assertLifecycleCommand({...answer,answers:{'Which sections?':['Introduction','Conclusion']}}).answers,{'Which sections?':['Introduction','Conclusion']});
 assert.deepEqual(assertLifecycleCommand({...answer,answers:{'How should I format the output?':'my own words'}}).answers,{'How should I format the output?':'my own words'});
});

test('an answer control refuses a missing or malformed selection',()=>{
 for(const bad of [
  {controlId:id(20),intent:'answer',answers:{Q:'A'}},
  {controlId:id(20),intent:'answer',questionId:id(21)},
  {controlId:id(20),intent:'answer',questionId:'not-a-uuid',answers:{Q:'A'}},
  {...answer,answers:{}},
  {...answer,answers:{'   ':'A'}},
  {...answer,answers:{Q:''}},
  {...answer,answers:{Q:['A','A']}},
  {...answer,answers:{Q:Array.from({length:5},(_,i)=>`o${i}`)}},
  {...answer,answers:{Q:['A',1]}},
  {...answer,text:'and a prompt'},
  {...answer,answers:Object.fromEntries(Array.from({length:5},(_,i)=>[`Q${i}`,'A']))}
 ])assert.throws(()=>assertLifecycleCommand(bad),/LIFECYCLE_INPUT_REFUSED/,JSON.stringify(bad).slice(0,120));
});

test('the answer intent maps to exactly one worker command action, once',()=>{
 assert.equal(workerActionForIntent('answer'),'answerQuestion');
 assert.equal(workerActionForIntent('approval.wait'),'waitForApproval');
 assert.equal(workerActionForIntent('steer'),'steer');
 assert.equal(workerActionForIntent('pause'),'pause');
 const command=assertWorkerControl({controlId:id(22),action:'answerQuestion',binding,contextSha256:'a'.repeat(64),questionId:id(21),answers:{'How should I format the output?':'Summary'}});
 assert.equal(command.action,'answerQuestion');
 assert.deepEqual(command.answers,{'How should I format the output?':'Summary'});
});

test('a worker command refuses an answer-shaped payload on another action and a prompt on an answer',()=>{
 assert.throws(()=>assertWorkerControl({controlId:id(22),action:'steer',binding,contextSha256:'a'.repeat(64),prompt:'go',answers:{Q:'A'}}),/LIFECYCLE_INPUT_REFUSED/);
 assert.throws(()=>assertWorkerControl({controlId:id(22),action:'answerQuestion',binding,contextSha256:'a'.repeat(64),prompt:'go',questionId:id(21),answers:{Q:'A'}}),/LIFECYCLE_INPUT_REFUSED/);
 assert.throws(()=>assertWorkerControl({controlId:id(22),action:'answerQuestion',binding,contextSha256:'a'.repeat(64),questionId:id(21)}),/LIFECYCLE_INPUT_REFUSED/);
});

test('an answer receipt keeps the existing receipt shape with its own intent',()=>{
 const receipt={controlId:id(20),intent:'answer',sourceBinding:binding,inputSha256:hash(answer),state:'APPLIED',checkpointId:null,targetBinding:null,admissionReceiptId:null,retirementReceiptId:null,replayed:false};
 assert.deepEqual(assertLifecycleReceipt(receipt),receipt);
 assert.throws(()=>assertLifecycleReceipt({...receipt,intent:'answerQuestion'}),/LIFECYCLE_INPUT_REFUSED/);
});
