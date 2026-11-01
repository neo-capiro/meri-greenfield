/** Native clarifying questions: the SDK callback contract, the durable pending/answer owner and the answers that reach
 * the suspended call. No SDK process, model, database or provider: a scripted journal and clock. */
import test from 'node:test';import assert from 'node:assert/strict';
import {assertUserQuestionInput,createUserQuestionGate,USER_QUESTION_TOOL,MAX_QUESTIONS,QUESTION_DEADLINE_MS} from '../capabilities/questions.mjs';
import {createQuestionRegistry,QUESTION_PENDING_RECORD,QUESTION_ANSWERED_RECORD,QUESTION_CANCELLED_RECORD} from '../questions/registry.mjs';
import {binding,id} from '../../../control/conversations/test/store-fixture.mjs';
const T0=1760486400000;
/** Scripted durable journal: one record list, latest record per question id. */
function journal(){const records=new Map();return {records,
 record:async entry=>{const questionId=entry.data?.questionId;if(typeof questionId!=='string')throw Error('JOURNAL_INVALID');records.set(questionId,{...entry});}};}
const opts=()=>[{label:'Summary',description:'Brief overview'},{label:'Detailed',description:'Full explanation'}].map(o=>({...o}));
const question=(over={})=>({question:'How should I format the output?',header:'Format',options:opts(),multiSelect:false,...over});
const questions=(over={})=>[question(over)];
const clock={now:T0};const now=()=>clock.now;
const fake=(n=1)=>()=>id(n);
const setup=(over={})=>{const store=journal(),registry=createQuestionRegistry({journal:store,now});let n=500;const gate=createUserQuestionGate({binding,questions:registry,now,newId:()=>id(n++),...over});return {store,registry,gate};};
const call=(gate,input,{toolUseID='toolu_q1',signal=new AbortController().signal}={})=>gate(USER_QUESTION_TOOL,input,{toolUseID,signal});
/** The port records durably before it waits, so the pending record appears a few microtasks after the call starts. */
const until=async predicate=>{for(let i=0;i<200;i++){if(predicate())return;await Promise.resolve();}throw Error('PENDING_QUESTION_NOT_RECORDED');};
/** The questions still pending in the durable journal: the only place a reconnecting client or this test can read them from. */
const pendingRecords=store=>[...store.records.values()].filter(r=>r.type===QUESTION_PENDING_RECORD);
const waitingFor=async store=>{await until(()=>pendingRecords(store).length===1);return pendingRecords(store)[0].data.request;};
const key='How should I format the output?';

test('native question input is bounded to 1-4 questions with 2-4 options and a 12-character header',()=>{
 assert.equal(assertUserQuestionInput({questions:questions()}).length,1);
 assert.equal(assertUserQuestionInput({questions:Array.from({length:MAX_QUESTIONS},(_,i)=>question({question:`Q${i}?`}))}).length,4);
 for(const bad of [
  {questions:[]},
  {questions:Array.from({length:5},(_,i)=>question({question:`Q${i}?`}))},
  {questions:[question({options:[opts()[0]]})]},
  {questions:[question({options:[...opts(),{label:'A',description:'a'},{label:'B',description:'b'},{label:'C',description:'c'}]})]},
  {questions:[question({header:'Thirteen char'})]},
  {questions:[question({question:'   '})]},
  {questions:[question({multiSelect:'yes'})]},
  {questions:[question(),question()]},
  {questions:[question({options:[{label:'Same',description:'a'},{label:'Same',description:'b'}]})]},
  {questions:questions(),extra:1},
  {questions:[{...question(),unknown:true}]}
 ])assert.throws(()=>assertUserQuestionInput(bad),/USER_QUESTION_INVALID/,JSON.stringify(bad).slice(0,120));
});

test('an answered question returns the original questions and the mapped answers to the SDK callback',async()=>{
 const {store,registry,gate}=setup();
 const pending=call(gate,{questions:[question()]});
 // The owner holds one durable pending record and one resumable wait for exactly this question set.
 const request=await waitingFor(store);
 assert.equal(request.subject.toolUseId,'toolu_q1');assert.equal(request.subject.questionsSha256.length,64);
 assert.deepEqual(request.questions,[question()]);
 const delivered=await registry.deliver({questionId:request.subject.questionId,answers:{[key]:'Summary'}});
 assert.equal(delivered,'ANSWERED');
 const result=await pending;
 assert.equal(result.behavior,'allow');
 assert.deepEqual(result.updatedInput.questions,request.questions);
 assert.deepEqual(result.updatedInput.answers,{[key]:'Summary'});
 assert.equal(result.toolUseID,'toolu_q1');
 assert.equal(store.records.get(request.subject.questionId).type,QUESTION_ANSWERED_RECORD);
 assert.deepEqual(Object.keys(store.records.get(request.subject.questionId).data.answer).sort(),['answeredAtMs','answers','questionId']);
});

test('free text and multi-select answers reach the callback unchanged; a wrong shape is refused and leaves the question answerable',async()=>{
 const {store,registry,gate}=setup();
 const multi={questions:[question({question:'Which sections?',header:'Sections',multiSelect:true})]};
 const pending=call(gate,multi,{toolUseID:'toolu_multi'});
 const request=await waitingFor(store);
 assert.equal(await registry.deliver({questionId:request.subject.questionId,answers:{'Which sections?':['Summary','Detailed']}}),'ANSWERED');
 // The pinned SDK takes strings; a multi-select selection is comma-separated at that boundary.
 assert.deepEqual((await pending).updatedInput.answers,{'Which sections?':'Summary, Detailed'});

 const typed=call(gate,{questions:[question()]},{toolUseID:'toolu_text'});
 const second=await waitingFor(store);
 assert.equal(await registry.deliver({questionId:second.subject.questionId,answers:{[key]:'jquery plugin'}}),'ANSWERED');
 assert.deepEqual((await typed).updatedInput.answers,{[key]:'jquery plugin'},'the user\'s own text is the answer');

 // An array on a single-select question, an unasked key, a partial set or an empty text is not an answer: the owner refuses
 // it before recording anything, the question stays pending, and the same suspended call is still answerable.
 const single=call(gate,{questions:[question()]},{toolUseID:'toolu_single'});
 const third=await waitingFor(store);
 for(const [answers,code] of [[{[key]:['Summary']},'USER_QUESTION_ANSWER_MISMATCH'],[{'Not asked?':'Summary'},'USER_QUESTION_ANSWER_MISMATCH'],[{[key]:'Summary','Extra?':'A'},'USER_QUESTION_ANSWER_MISMATCH'],[{[key]:'  '},'USER_QUESTION_ANSWER_DENIED'],[null,'USER_QUESTION_ANSWER_DENIED']])
  assert.equal(await registry.deliver({questionId:third.subject.questionId,answers}),code,JSON.stringify(answers));
 assert.equal(pendingRecords(store).length,1,'a malformed answer leaves the question answerable');
 assert.equal(await registry.deliver({questionId:third.subject.questionId,answers:{[key]:'Summary'}}),'ANSWERED');
 const accepted=await single;
 assert.equal(accepted.behavior,'allow','the valid answer still reaches the suspended call');
 assert.deepEqual(accepted.updatedInput.answers,{[key]:'Summary'});
});

test('an unknown question, a duplicate reply and a cancelled wait never reach the callback',async()=>{
 const {store,registry,gate}=setup();
 const pending=call(gate,{questions:[question()]},{toolUseID:'toolu_run'});
 const request=await waitingFor(store);
 assert.equal(await registry.deliver({questionId:id(98),answers:{[key]:'Summary'}}),'STALE');
 assert.equal(await registry.deliver({questionId:'not-a-uuid',answers:{[key]:'Summary'}}),'USER_QUESTION_INVALID');
 assert.equal(await registry.deliver({questionId:request.subject.questionId,answers:{[key]:'Summary'}}),'ANSWERED');
 assert.equal(await registry.deliver({questionId:request.subject.questionId,answers:{[key]:'Summary'}}),'REPLAY');
 assert.equal(await registry.deliver({questionId:request.subject.questionId,answers:{'Not asked?':'Summary'}}),'REPLAY','a second reply never re-applies');
 assert.equal(store.records.get(request.subject.questionId).type,QUESTION_ANSWERED_RECORD);
 assert.deepEqual((await pending).updatedInput.answers,{[key]:'Summary'});

 const controller=new AbortController();
 const cancelled=call(gate,{questions:[question()]},{toolUseID:'toolu_cancel',signal:controller.signal});
 const waiting=await waitingFor(store);
 controller.abort();
 const denied=await cancelled;
 assert.equal(denied.behavior,'deny');assert.equal(denied.message,'USER_QUESTION_CANCELLED','an aborted run fabricates no answer');
 assert.equal(await registry.deliver({questionId:waiting.subject.questionId,answers:{[key]:'Summary'}}),'CANCELLED');
 await until(()=>store.records.get(waiting.subject.questionId)?.type===QUESTION_CANCELLED_RECORD);
 assert.equal(store.records.get(waiting.subject.questionId).data.reasonCode,'USER_QUESTION_CANCELLED');
});

test('an elapsed answer window refuses the call instead of answering it',async()=>{
 const {store,registry,gate}=setup({questionDeadlineMs:QUESTION_DEADLINE_MS.min});
 const pending=call(gate,{questions:[question()]},{toolUseID:'toolu_expiry'});
 const request=await waitingFor(store);
 clock.now=T0+QUESTION_DEADLINE_MS.min+1;
 const expired=await pending;
 assert.equal(expired.behavior,'deny');assert.equal(expired.message,'USER_QUESTION_EXPIRED');
 // The port's wait was closed when the window elapsed, so a late answer cannot reach the callback.
 assert.equal(await registry.deliver({questionId:request.subject.questionId,answers:{[key]:'Summary'}}),'CANCELLED');
 await until(()=>store.records.get(request.subject.questionId)?.type===QUESTION_CANCELLED_RECORD);
 assert.equal(store.records.get(request.subject.questionId).data.reasonCode,'USER_QUESTION_EXPIRED','the durable record says the window elapsed');
 clock.now=T0;
});

test('an answer delivered after the window elapsed on the owner clock is refused, ends the call and records the elapsed window',async()=>{
 const {store,registry,gate}=setup();
 const pending=call(gate,{questions:[question()]},{toolUseID:'toolu_owner_expiry'});
 const request=await waitingFor(store);
 clock.now=T0+QUESTION_DEADLINE_MS.default+1;
 assert.equal(await registry.deliver({questionId:request.subject.questionId,answers:{[key]:'Summary'}}),'EXPIRED');
 const denied=await pending;assert.equal(denied.behavior,'deny');assert.equal(denied.message,'USER_QUESTION_EXPIRED');
 assert.equal(store.records.get(request.subject.questionId).type,QUESTION_CANCELLED_RECORD);
 assert.equal(store.records.get(request.subject.questionId).data.reasonCode,'USER_QUESTION_EXPIRED');
 assert.equal(pendingRecords(store).length,0);
 clock.now=T0;
});

test('close() cancels every waiting question durably, awaits the records, and refuses later asks and answers',async()=>{
 const {store,registry,gate}=setup();
 const pending=call(gate,{questions:[question()]},{toolUseID:'toolu_close'});
 const request=await waitingFor(store);
 await registry.close();
 assert.equal(store.records.get(request.subject.questionId).type,QUESTION_CANCELLED_RECORD,'the cancelled outcome is written before close() returns');
 assert.equal(store.records.get(request.subject.questionId).data.reasonCode,'USER_QUESTION_CANCELLED');
 const denied=await pending;assert.equal(denied.behavior,'deny');assert.equal(denied.message,'USER_QUESTION_CANCELLED');
 assert.equal(await registry.deliver({questionId:request.subject.questionId,answers:{[key]:'Summary'}}),'CANCELLED');
 assert.equal(pendingRecords(store).length,0);
 // A question asked after the run ended is recorded and cancelled at once; it never waits and never answers.
 const late=await call(gate,{questions:[question()]},{toolUseID:'toolu_late'});
 assert.equal(late.message,'USER_QUESTION_CANCELLED');
 await registry.close();// idempotent
});

test('an answer is durable before it resolves the call: a record the journal refuses leaves the question answerable',async()=>{
 const {store,registry,gate}=setup();let refuse=true;const record=store.record;
 store.record=async entry=>{if(refuse&&entry.type===QUESTION_ANSWERED_RECORD)throw Error('JOURNAL_DOWN');return record(entry);};
 const pending=call(gate,{questions:[question()]},{toolUseID:'toolu_durable'});
 const request=await waitingFor(store),answers={[key]:'Summary'};
 await assert.rejects(registry.deliver({questionId:request.subject.questionId,answers}),/USER_QUESTION_PERSISTENCE_FAILED/);
 assert.equal(pendingRecords(store).length,1,'the suspended call is still waiting');
 refuse=false;
 assert.equal(await registry.deliver({questionId:request.subject.questionId,answers}),'ANSWERED');
 assert.equal((await pending).behavior,'allow');
 assert.equal(await registry.deliver({questionId:request.subject.questionId,answers}),'REPLAY','answered for good once the record is written');
});

test('a question is answerable the moment its record is visible, and a question whose record could not be written is never answerable',async()=>{
 const {store,registry,gate}=setup();
 // The record lands and the answer arrives in the same tick: the owner registered the entry before writing, so it is delivered,
 // and the journal still holds the question ahead of its answer.
 const order=[];const record=store.record;store.record=async entry=>{order.push(entry.type);return record(entry);};
 const pending=call(gate,{questions:[question()]},{toolUseID:'toolu_at_once'});
 const request=await waitingFor(store);
 assert.equal(await registry.deliver({questionId:request.subject.questionId,answers:{[key]:'Summary'}}),'ANSWERED');
 assert.deepEqual(order,[QUESTION_PENDING_RECORD,QUESTION_ANSWERED_RECORD]);assert.equal((await pending).behavior,'allow');
 // A pending record the journal refuses never leaves an answerable entry behind: the ask fails and a delivery is stale.
 const broken=setup();broken.store.record=async()=>{throw Error('JOURNAL_DOWN');};
 const refused=await call(broken.gate,{questions:[question()]},{toolUseID:'toolu_unrecorded'});
 assert.equal(refused.behavior,'deny');assert.equal(refused.message,'USER_QUESTION_UNAVAILABLE');
 assert.equal(await broken.registry.deliver({questionId:id(500),answers:{[key]:'Summary'}}),'STALE');
});

test('the run abort signal ends a waiting question even when the SDK keeps the tool call signal open',async()=>{
 const run=new AbortController();const {store,registry,gate}=setup({signal:run.signal});
 const pending=call(gate,{questions:[question()]},{toolUseID:'toolu_run_abort',signal:new AbortController().signal});
 const request=await waitingFor(store);
 run.abort();
 const denied=await pending;assert.equal(denied.behavior,'deny');assert.equal(denied.message,'USER_QUESTION_CANCELLED');
 await until(()=>store.records.get(request.subject.questionId)?.type===QUESTION_CANCELLED_RECORD);
 assert.equal((await call(gate,{questions:[question()]},{toolUseID:'toolu_after_abort'})).message,'USER_QUESTION_UNAVAILABLE','an aborted run offers no question');
 assert.throws(()=>createUserQuestionGate({binding,questions:registry,now,newId:fake(),signal:'run'}),/USER_QUESTION_CONFIGURATION/);
 assert.throws(()=>createQuestionRegistry({journal:{},now}),/USER_QUESTION_CONFIGURATION/);
});
