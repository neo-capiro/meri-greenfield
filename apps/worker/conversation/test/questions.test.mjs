/** Native clarifying questions: the SDK callback contract, the durable pending/answer owner and the answers that reach
 * the suspended call. No SDK process, model, database or provider: a scripted journal and clock. */
import test from 'node:test';import assert from 'node:assert/strict';
import {
 assertUserQuestionInput,userQuestionAnswer,createUserQuestionGate,
 USER_QUESTION_ANSWER_SCHEMA,USER_QUESTION_TOOL,MAX_QUESTIONS,QUESTION_DEADLINE_MS
} from '../capabilities/questions.mjs';
import {createQuestionRegistry,QUESTION_PENDING_RECORD,QUESTION_ANSWERED_RECORD,QUESTION_CANCELLED_RECORD} from '../questions/registry.mjs';
import {binding,id} from '../../../control/conversations/test/store-fixture.mjs';
const T0=1760486400000;
/** Scripted durable journal: one record list, latest record per question id. */
function journal(){const records=new Map();return {records,
 record:async entry=>{const questionId=entry.data?.questionId;if(typeof questionId!=='string')throw Error('JOURNAL_INVALID');records.set(questionId,{...entry});},
 read:async questionId=>records.get(questionId)??null};}
const opts=(multiSelect=false)=>[{label:'Summary',description:'Brief overview'},{label:'Detailed',description:'Full explanation'}].map(o=>({...o})).slice(0,2).map(o=>o);
const question=(over={})=>({question:'How should I format the output?',header:'Format',options:opts(),multiSelect:false,...over});
const questions=(over={})=>[question(over)];
const clock={now:T0};const now=()=>clock.now;
const fake=(n=1)=>()=>id(n);
const setup=(over={})=>{const store=journal(),registry=createQuestionRegistry({journal:store,now});let n=500;const gate=createUserQuestionGate({binding,questions:registry,now,newId:()=>id(n++),...over});return {store,registry,gate,next:()=>id(n)};};
const call=(gate,input,{toolUseID='toolu_q1',signal=new AbortController().signal}={})=>gate(USER_QUESTION_TOOL,input,{toolUseID,signal});
/** The port records durably before it waits, so the pending entry appears a few microtasks after the call starts. */
const until=async predicate=>{for(let i=0;i<200;i++){if(predicate())return;await Promise.resolve();}throw Error('PENDING_QUESTION_NOT_RECORDED');};
const waitingFor=async registry=>{await until(()=>registry.outstanding().length===1);return registry.outstanding()[0];};
const answerFor=(request,answers)=>({schema:USER_QUESTION_ANSWER_SCHEMA,questionId:request.subject.questionId,subjectSha256:request.subjectSha256,
 binding:structuredClone(request.subject.binding),answers,answeredAtMs:T0});
const asked=request=>request.questions;

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
 const outstanding=await waitingFor(registry);
 assert.equal(outstanding.subject.toolUseId,'toolu_q1');
 assert.equal(store.records.get(outstanding.subject.questionId).type,QUESTION_PENDING_RECORD);
 assert.equal(store.records.get(outstanding.subject.questionId).data.request.subjectSha256,outstanding.subjectSha256);
 const delivered=await registry.deliver({questionId:outstanding.subject.questionId,answers:{'How should I format the output?':'Summary'},binding});
 assert.equal(delivered,'ANSWERED');
 const result=await pending;
 assert.equal(result.behavior,'allow');
 assert.deepEqual(result.updatedInput.questions,outstanding.questions);
 assert.deepEqual(result.updatedInput.answers,{'How should I format the output?':'Summary'});
 assert.equal(result.toolUseID,'toolu_q1');
 assert.equal(store.records.get(outstanding.subject.questionId).type,QUESTION_ANSWERED_RECORD);
});

test('free text and multi-select answers reach the callback unchanged; a single-select question refuses an array',async()=>{
 const {registry,gate}=setup();
 const multi={questions:[question({question:'Which sections?',header:'Sections',multiSelect:true})]};
 const pending=call(gate,multi,{toolUseID:'toolu_multi'});
 const request=await waitingFor(registry);
 assert.equal(await registry.deliver({questionId:request.subject.questionId,answers:{'Which sections?':['Summary','Detailed']},binding}),'ANSWERED');
 // The pinned SDK takes strings; a multi-select selection is comma-separated at that boundary.
 assert.deepEqual((await pending).updatedInput.answers,{'Which sections?':'Summary, Detailed'});

 const typed=call(gate,{questions:[question()]},{toolUseID:'toolu_text'});
 const second=await waitingFor(registry);
 assert.equal(await registry.deliver({questionId:second.subject.questionId,answers:{'How should I format the output?':'jquery plugin'},binding}),'ANSWERED');
 assert.deepEqual((await typed).updatedInput.answers,{'How should I format the output?':'jquery plugin'},'the user\'s own text is the answer');

 const single=call(gate,{questions:[question()]},{toolUseID:'toolu_single'});
 const third=await waitingFor(registry);
 await registry.deliver({questionId:third.subject.questionId,answers:{'How should I format the output?':['Summary']},binding});
 const refused=await single;
 assert.equal(refused.behavior,'deny');assert.equal(refused.message,'USER_QUESTION_ANSWER_MISMATCH');
});

test('an answer for another run, an unknown question, a duplicate reply and a cancelled wait never reach the callback',async()=>{
 const {store,registry,gate}=setup();
 const pending=call(gate,{questions:[question()]},{toolUseID:'toolu_run'});
 const request=await waitingFor(registry);
 const questionKey='How should I format the output?';
 assert.equal(await registry.deliver({questionId:request.subject.questionId,answers:{[questionKey]:'Summary'},binding:{...binding,tenantId:id(99)}}),'USER_QUESTION_ANSWER_MISMATCH');
 assert.equal(await registry.deliver({questionId:id(98),answers:{[questionKey]:'Summary'},binding}),'STALE');
 assert.equal(await registry.deliver({questionId:request.subject.questionId,answers:{[questionKey]:'Summary'},binding}),'ANSWERED');
 assert.equal(await registry.deliver({questionId:request.subject.questionId,answers:{[questionKey]:'Summary'},binding}),'REPLAY');
 assert.equal(await registry.deliver({questionId:request.subject.questionId,answers:{'Not asked?':'Summary'},binding}),'REPLAY','a second reply never re-applies');
 assert.equal(store.records.get(request.subject.questionId).type,QUESTION_ANSWERED_RECORD);

 const controller=new AbortController();
 const cancelled=call(gate,{questions:[question()]},{toolUseID:'toolu_cancel',signal:controller.signal});
 const waiting=await waitingFor(registry);
 controller.abort();
 const denied=await cancelled;
 assert.equal(denied.behavior,'deny');assert.equal(denied.message,'USER_QUESTION_CANCELLED','an aborted run fabricates no answer');
 assert.equal(await registry.deliver({questionId:waiting.subject.questionId,answers:{[questionKey]:'Summary'},binding}),'CANCELLED');
 await until(()=>store.records.get(waiting.subject.questionId)?.type===QUESTION_CANCELLED_RECORD);
});

test('an elapsed answer window refuses the call instead of answering it',async()=>{
 const {store,registry,gate}=setup({questionDeadlineMs:QUESTION_DEADLINE_MS.min});
 const pending=call(gate,{questions:[question()]},{toolUseID:'toolu_expiry'});
 const request=await waitingFor(registry);
 clock.now=T0+QUESTION_DEADLINE_MS.min+1;
 const expired=await pending;
 assert.equal(expired.behavior,'deny');assert.equal(expired.message,'USER_QUESTION_EXPIRED');
 // The port's wait was closed when the window elapsed, so a late answer cannot reach the callback.
 assert.equal(await registry.deliver({questionId:request.subject.questionId,answers:{'How should I format the output?':'Summary'},binding}),'CANCELLED');
 await until(()=>store.records.get(request.subject.questionId)?.type===QUESTION_CANCELLED_RECORD);
 assert.equal(store.records.get(request.subject.questionId).data.reasonCode,'USER_QUESTION_EXPIRED','the durable record says the window elapsed');
 clock.now=T0;
});

test('the pending question survives a worker restart through the durable record',async()=>{
 const {store,registry,gate}=setup();
 const controller=new AbortController();
 const pending=call(gate,{questions:[question()]},{toolUseID:'toolu_restart',signal:controller.signal});
 const request=await waitingFor(registry);
 // A new worker process rebuilds its registry from the same durable journal and finds the same question set.
 const restarted=createQuestionRegistry({journal:store,now});
 const recovered=await restarted.recover(request.subject.questionId);
 assert.equal(recovered.type,QUESTION_PENDING_RECORD);
 assert.deepEqual(recovered.request.questions,request.questions);
 assert.equal(recovered.request.subjectSha256,request.subjectSha256);
 // Recovery can show what was asked, but the suspended native callback died with its process: an answer is refused
 // as unrecoverable instead of pretending to resume it.
 assert.equal(recovered.resumable,false);
 assert.equal(await restarted.deliver({questionId:request.subject.questionId,answers:{'How should I format the output?':'Summary'},binding}),'USER_QUESTION_UNRECOVERABLE');
 controller.abort();
 assert.equal((await pending).message,'USER_QUESTION_CANCELLED');
});

test('the mapping refuses answers that do not match the asked questions',()=>{
 const request={subject:{questionId:id(1),toolUseId:'t',binding,questionsSha256:'a'.repeat(64)},subjectSha256:'b'.repeat(64),
  questions:Object.freeze([{question:'Pick',header:'Pick',options:[{label:'A',description:'a'},{label:'B',description:'b'}],multiSelect:false}]),
  requestedAtMs:T0,expiresAtMs:T0+1000};
 assert.equal(userQuestionAnswer({...answerFor(request,{Pick:'A'}),subjectSha256:'c'.repeat(64)},request,T0),'USER_QUESTION_ANSWER_MISMATCH');
 assert.equal(userQuestionAnswer({...answerFor(request,{Pick:'A'}),questionId:id(2)},request,T0),'USER_QUESTION_ANSWER_MISMATCH');
 assert.equal(userQuestionAnswer({...answerFor(request,{Other:'A'})},request,T0),'USER_QUESTION_ANSWER_MISMATCH');
 assert.equal(userQuestionAnswer({...answerFor(request,{Pick:'A','Second?':'B'})},request,T0),'USER_QUESTION_ANSWER_MISMATCH');
 assert.equal(userQuestionAnswer(answerFor(request,{Pick:['A']}),request,T0),'USER_QUESTION_ANSWER_MISMATCH','an array answers only a multi-select question');
 assert.equal(userQuestionAnswer({...answerFor(request,{Pick:'A'}),answeredAtMs:T0-1},request,T0),'USER_QUESTION_ANSWER_EXPIRED');
 assert.equal(userQuestionAnswer(answerFor(request,{Pick:'A'}),request,T0+1001),'USER_QUESTION_ANSWER_EXPIRED');
});
