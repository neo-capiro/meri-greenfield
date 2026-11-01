/** Native `AskUserQuestion` through the actual lifecycle journal, control service and activity: one durable pending question, one
 * answer control that resumes the suspended call exactly once, and a Stop that leaves one durable cancelled outcome and no answer.
 * Scripted store, no SDK process, no provider. */
import test from 'node:test';import assert from 'node:assert/strict';
import {setTimeout as sleep} from 'node:timers/promises';
import {createConversationActivity} from '../activity.mjs';
import {createLifecycleRunOwner} from '../../../control/conversations/lifecycle/worker-owner.mjs';
import {SDK_MODEL_CONFIGURATION} from '../../../control/conversations/usage.mjs';
import {lifecycleFixture,binding,versions,id,allocateOriginal} from '../../../control/conversations/test/lifecycle-fixture.mjs';
const success={type:'result',subtype:'success',is_error:false};
const question={question:'How should I format the output?',header:'Format',options:[{label:'Summary',description:'Brief overview'},{label:'Detailed',description:'Full explanation'}],multiSelect:false};
// The trusted capability producer admits only the question tool for this run; the activity reads it from the loaded run.
const serviceOptions={capabilityPolicy:{async forRun(){return {userQuestions:true};}},readCapabilityRole:async()=>({actorRole:'standard_user',expiresAtMs:Date.now()+30000})};
const runtime=async({binding:target})=>({binding:target,versions,cwd:`/workspace/conversations/${target.conversationId}`,...SDK_MODEL_CONFIGURATION,providerEnvironment:{},sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+8000,maxTurns:2,maxCostMicroUSD:1000,maxOutputBytes:4096});
async function until(read,what){for(let i=0;i<400;i++){const value=await read();if(value)return value;await sleep(10);}throw Error(`timed out waiting for ${what}`);}
async function fixture(t){const f=await lifecycleFixture({serviceOptions});t.after(()=>f.close());await f.service.allocateInput({credential:f.credential,input:f.input});await f.service.submit({credential:f.credential,input:f.input});await allocateOriginal(f.store,binding);
 const history=()=>f.service.history({credential:f.credential}),runOwner=createLifecycleRunOwner({service:f.service,credentialForBinding:async()=>f.credential});
 const asked=Promise.withResolvers(),release=Promise.withResolvers(),closed=Promise.withResolvers();const gateResults=[];
 /** The SDK stand-in asks one question through the admitted permission callback, then waits to be released before its result;
  * a close() while it waits ends it without a result, as the real query's abort does. */
 const execute=createConversationActivity({runOwner,prepareRuntime:runtime,lifecycle:{captureCheckpoint:async()=>{},pollMs:5},query(args){return {async *[Symbol.asyncIterator](){
  yield {type:'system',subtype:'init',session_id:id(223)};await args.prompt[Symbol.asyncIterator]().next();
  const result=await args.options.canUseTool('AskUserQuestion',{questions:[question]},{toolUseID:'toolu_q',signal:new AbortController().signal});gateResults.push(result);asked.resolve(result);
  if(await Promise.race([release.promise.then(()=>'released'),closed.promise.then(()=>'closed')])==='closed')return;yield success;},async interrupt(){return {still_queued:[]};},close(){closed.resolve();}};}});
 return {f,history,execute,asked:asked.promise,release:()=>release.resolve(),gateResults};}
const questionEvents=h=>h.events.filter(e=>e.type.startsWith('question.')).map(e=>e.type==='question.pending'?['pending']:[e.data.outcome,e.data.reasonCode]);

test('one answer control resumes the suspended question exactly once: APPLIED, then a second answer is refused and never re-applied',async t=>{
 const {f,history,execute,asked,release,gateResults}=await fixture(t);const done=execute({binding});
 const pending=await until(async()=>(await history()).events.find(e=>e.type==='question.pending'),'the durable pending question');
 assert.equal(pending.data.toolUseId,'toolu_q');assert.deepEqual(pending.data.questions,[question]);assert.match(pending.data.questionId,/^[0-9a-f-]{36}$/u);
 const answer={controlId:id(600),intent:'answer',questionId:pending.data.questionId,answers:{[question.question]:'Summary'}};
 assert.equal((await f.control(answer)).state,'PENDING','the answer is a durable control the running worker claims');
 const result=await asked;assert.equal(result.behavior,'allow');assert.deepEqual(result.updatedInput.answers,{[question.question]:'Summary'});
 assert.equal((await until(async()=>{const r=await f.control(answer);return r.state==='APPLIED'?r:null;},'the APPLIED receipt')).replayed,true);
 // A second answer for the same question while the run still runs: claimed, refused by the owner, never applied, call untouched.
 const again={controlId:id(601),intent:'answer',questionId:pending.data.questionId,answers:{[question.question]:'Detailed'}};
 assert.equal((await f.control(again)).state,'PENDING');
 await until(async()=>(await f.control(again)).state==='UNKNOWN','the refused second answer');
 assert.equal(gateResults.length,1,'the suspended call was resumed exactly once');
 release();assert.deepEqual(await done,{state:'completed'});
 const h=await history();assert.equal(h.run.state,'completed');assert.deepEqual(questionEvents(h),[['pending'],['answered',null]]);
 await assert.rejects(f.control({...again,controlId:id(602)}),/LIFECYCLE_STATE_REFUSED/,'a completed run takes no answer');
});

test('a Stop while the question is pending leaves exactly one durable cancelled outcome and no answer',async t=>{
 const {f,history,execute,asked,gateResults}=await fixture(t);const controller=new AbortController();const done=execute({binding,signal:controller.signal});
 const pending=await until(async()=>(await history()).events.find(e=>e.type==='question.pending'),'the durable pending question');
 assert.deepEqual(await f.service.cancel({credential:f.credential}),{state:'cancelled'});
 // Temporal cancellation reaches the activity; the question gate denies, and the worker's late record is refused by the terminal run.
 controller.abort();await assert.rejects(done,/EXECUTION_STOPPED/);
 const result=await asked;assert.equal(result.behavior,'deny');assert.equal(result.message,'USER_QUESTION_CANCELLED');assert.equal(gateResults.length,1);
 const h=await history();assert.equal(h.run.state,'cancelled');
 assert.deepEqual(questionEvents(h),[['pending'],['cancelled','USER_CANCELLED']]);
 const [settled,cancelled]=h.events.slice(-2);assert.equal(settled.data.questionId,pending.data.questionId);assert.equal(cancelled.data.state,'cancelled');assert.equal(cancelled.sequence,h.lastSequence);
 await assert.rejects(f.control({controlId:id(610),intent:'answer',questionId:pending.data.questionId,answers:{[question.question]:'Summary'}}),/LIFECYCLE_STATE_REFUSED/,'a stopped run takes no answer');
});

test('a run that ends on its own with the question pending records the cancellation before its terminal event',async t=>{
 const {f,history,execute,asked}=await fixture(t);const controller=new AbortController();const done=execute({binding,signal:controller.signal});
 await until(async()=>(await history()).events.find(e=>e.type==='question.pending'),'the durable pending question');
 controller.abort();await assert.rejects(done,/EXECUTION_STOPPED/);
 assert.equal((await asked).message,'USER_QUESTION_CANCELLED');
 const h=await history();assert.equal(h.run.state,'cancelled');
 assert.deepEqual(questionEvents(h),[['pending'],['cancelled','USER_QUESTION_CANCELLED']],'the worker wrote the outcome; the store had nothing left to settle');
});
