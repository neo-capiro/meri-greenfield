/** Per-run question wiring: the registry's records become durable run events, and a claimed answer control resolves the
 * suspended call through the existing acknowledgement. Contract-validated, no SDK, no database, no provider. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createQuestionRegistry,QUESTION_PENDING_RECORD} from '../questions/registry.mjs';
import {createQuestionEventJournal} from '../questions/events.mjs';
import {createQuestionControlDispatch} from '../questions/dispatch.mjs';
import {assertConversationEvent,isUserQuestionEventType} from '../../../../packages/contracts/conversation-sources/validate.mjs';
import {createUserQuestionGate,USER_QUESTION_TOOL} from '../capabilities/questions.mjs';
import {binding,scopes,id} from '../../../control/conversations/test/store-fixture.mjs';
const T0=1760486400000,clock={now:T0},now=()=>clock.now;
const question={question:'How should I format the output?',header:'Format',options:[{label:'Summary',description:'Brief overview'},{label:'Detailed',description:'Full explanation'}],multiSelect:false};
/** Scripted run-owner port: records the events exactly as the control store would receive them. */
function owner(){const events=[],acks=[];let n=900;return {events,acks,
 append:async({binding:b,event})=>{assert.deepEqual(b,binding);events.push(event);},
 claimControl:async()=>({claimed:false,receipt:{}}),ackControl:async({input})=>{acks.push(input);return {controlId:input.controlId,state:input.outcome}}};}
/** Wrap one appended event in the envelope the control store adds before validating. */
const envelope=(event,sequence)=>({contractVersion:'0.1.0',eventId:event.eventId,binding,sequence,createdAt:event.createdAt,scopes,type:event.type,data:event.data});
const until=async predicate=>{for(let i=0;i<200;i++){if(predicate())return;await Promise.resolve();}throw Error('NOT_RECORDED');};

test('a pending question and its resolution are durable run events the contract accepts',async()=>{
 const runOwner=owner(),journal=createQuestionEventJournal({runOwner,binding,now,newId:()=>id(901)});
 const registry=createQuestionRegistry({journal,now});
 const gate=createUserQuestionGate({binding,questions:registry,now,newId:()=>id(902)});
 const pending=gate(USER_QUESTION_TOOL,{questions:[question]},{toolUseID:'toolu_evt',signal:new AbortController().signal});
 await until(()=>runOwner.events.length===1);
 const [event]=runOwner.events;
 assert.equal(event.type,'question.pending');
 assert.ok(isUserQuestionEventType(event.type));
 assert.equal(event.data.toolUseId,'toolu_evt');
 assert.equal(event.data.questions.length,1);
 assert.deepEqual(event.data.questions[0].options.map(o=>o.label),['Summary','Detailed']);
 assert.equal(event.data.expiresAt,new Date(T0+900000).toISOString());
 assert.equal(assertConversationEvent(envelope(event,1)).type,'question.pending');
 const [outstanding]=await (async()=>{await until(()=>registry.outstanding().length===1);return registry.outstanding();})();
 assert.equal(await registry.deliver({questionId:outstanding.subject.questionId,answers:{'How should I format the output?':'Summary'},binding}),'ANSWERED');
 await until(()=>runOwner.events.length===2);
 const resolution=runOwner.events[1];
 assert.equal(resolution.type,'question.answered');
 assert.deepEqual(resolution.data,{questionId:outstanding.subject.questionId,outcome:'answered',reasonCode:null});
 assert.equal(assertConversationEvent(envelope(resolution,2)).type,'question.answered');
 assert.equal((await pending).behavior,'allow');
 assert.deepEqual(runOwner.events.map(e=>e.type),['question.pending','question.answered'],'the registry record vocabulary is the run-event vocabulary, not a second one');
});

test('a cancelled question is a durable cancelled outcome, and a malformed one is refused by the contract',async()=>{
 const runOwner=owner(),registry=createQuestionRegistry({journal:createQuestionEventJournal({runOwner,binding,now,newId:()=>id(903)}),now});
 const controller=new AbortController();
 const gate=createUserQuestionGate({binding,questions:registry,now,newId:()=>id(904)});
 const pending=gate(USER_QUESTION_TOOL,{questions:[question]},{toolUseID:'toolu_cancel',signal:controller.signal});
 await until(()=>runOwner.events.length===1);
 controller.abort();
 await until(()=>runOwner.events.length===2);
 assert.deepEqual(runOwner.events[1].data.outcome,'cancelled');
 assert.equal(runOwner.events[1].data.reasonCode,'USER_QUESTION_CANCELLED');
 assert.equal((await pending).behavior,'deny');
 assert.equal((await pending).message,'USER_QUESTION_CANCELLED');
 // The stored shape is validated: a duplicate question text or a bad outcome never reaches the journal.
 assert.throws(()=>assertConversationEvent(envelope({...runOwner.events[0],data:{...runOwner.events[0].data,questions:[question,question]}},3)),/INVALID_USER_QUESTION_EVENT/);
 assert.throws(()=>assertConversationEvent(envelope({...runOwner.events[1],data:{questionId:id(905),outcome:'answered',reasonCode:'X'}},4)),/INVALID_USER_QUESTION_EVENT/);
 assert.throws(()=>assertConversationEvent(envelope({...runOwner.events[1],data:{questionId:id(905),outcome:'maybe',reasonCode:null}},5)),/INVALID_SOURCE_SHAPE|INVALID_USER_QUESTION_EVENT/);
});

test('only a claimed answer control is intercepted; every other control reaches the lifecycle owner untouched',async()=>{
 const runOwner=owner(),registry=createQuestionRegistry({journal:createQuestionEventJournal({runOwner,binding,now,newId:()=>id(906)}),now});
 const commands=[];
 // The real lifecycle claim: the command digest sits on the envelope beside the command, not inside it.
 runOwner.claimControl=async input=>{commands.push(input.controlId);return {claimed:true,control:{controlSequence:1,commandSha256:'a'.repeat(64),
  command:{controlId:input.controlId,action:'answerQuestion',questionId:id(907),answers:{'How should I format the output?':'Summary'}}}};};
 const dispatch=createQuestionControlDispatch({runOwner,registry,binding});
 // No pending question for that id: the answer is stale, so it is acknowledged UNKNOWN rather than applied.
 const claim=await dispatch.claimControl({controlId:id(908)});
 assert.deepEqual(claim,{claimed:false,receipt:{controlId:id(908),state:'UNKNOWN'}});
 assert.deepEqual(runOwner.acks,[{controlId:id(908),commandSha256:'a'.repeat(64),outcome:'UNKNOWN'}]);

 const steer={claimed:true,control:{controlSequence:2,commandSha256:'c'.repeat(64),command:{controlId:id(909),action:'steer',prompt:'go'}}};
 runOwner.claimControl=async()=>steer;
 assert.equal(await dispatch.claimControl({controlId:id(909)}),steer,'the pump still applies steer/pause itself');
});

test('an answered control is acknowledged APPLIED through the existing owner',async()=>{
 const runOwner=owner(),registry=createQuestionRegistry({journal:createQuestionEventJournal({runOwner,binding,now,newId:()=>id(910)}),now});
 const gate=createUserQuestionGate({binding,questions:registry,now,newId:()=>id(911)});
 const pending=gate(USER_QUESTION_TOOL,{questions:[question]},{toolUseID:'toolu_ack',signal:new AbortController().signal});
 await until(()=>registry.outstanding().length===1);
 const [outstanding]=registry.outstanding();
 runOwner.claimControl=async()=>({claimed:true,control:{controlSequence:1,commandSha256:'b'.repeat(64),
  command:{controlId:id(912),action:'answerQuestion',questionId:outstanding.subject.questionId,answers:{'How should I format the output?':'Detailed'}}}});
 const controller=new AbortController();
 const claim=await createQuestionControlDispatch({runOwner,registry,binding}).claimControl({controlId:id(912),signal:controller.signal});
 assert.deepEqual(claim,{claimed:false,receipt:{controlId:id(912),state:'APPLIED'}});
 assert.deepEqual((await pending).updatedInput.answers,{'How should I format the output?':'Detailed'});
 assert.equal(runOwner.acks.at(-1).commandSha256,'b'.repeat(64),'the ack carries the envelope digest, not an undefined in-command one');
});
