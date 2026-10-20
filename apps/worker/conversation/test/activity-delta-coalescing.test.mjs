/** Streamed text deltas fold into the publication that follows a slow one; every fold boundary keeps its own publication. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createConversationActivity,DELTA_FOLD_MAX_BYTES} from '../activity.mjs';
import {applicationFixture,binding,versions,id} from '../../../control/conversations/test/application-fixture.mjs';

const runtime=extra=>({binding,versions,cwd:`/workspace/conversations/${binding.conversationId}`,proxyUrl:'https://trusted-proxy.invalid',proxyCredential:'synthetic-task-capability',
 model:'qualified-model-pin',sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+5000,maxTurns:2,maxCostMicroUSD:1000,maxOutputBytes:262144,...extra});
const start=msg=>({type:'stream_event',parent_tool_use_id:null,event:{type:'message_start',message:{id:msg}}});
const block=(index,type='text')=>({type:'stream_event',parent_tool_use_id:null,event:{type:'content_block_start',index,content_block:type==='text'?{type:'text',text:''}:{type:'tool_use',id:'toolu_1',name:'Read',input:{}}}});
const delta=(text,index=0)=>({type:'stream_event',parent_tool_use_id:null,event:{type:'content_block_delta',index,delta:{type:'text_delta',text}}});
const stop=index=>({type:'stream_event',parent_tool_use_id:null,event:{type:'content_block_stop',index}});
const assistant=(msg,...texts)=>({type:'assistant',parent_tool_use_id:null,message:{id:msg,content:texts.map(text=>({type:'text',text}))}});
const success={type:'result',subtype:'success',is_error:false};
const words=(n,prefix='w')=>Array.from({length:n},(_,i)=>`${prefix}${i} `);

/** Every display publication waits `publishMs` (control's authorization round) before it is durable; the SDK yields at once.
 * `modelDeadlineInMs` is the model deadline, counted from the activity's start. */
async function run(frames,{publishMs=40,runtime:extra,modelDeadlineInMs}={}){
 const f=await applicationFixture({initialInput:true});await f.service.allocateInput({credential:f.credential,input:f.input});await f.service.submit({credential:f.credential,input:f.input});
 const published=[];let n=500;
 const runOwner={...f.runOwner,async append(value){if(value.event.type==='message.delta'){published.push(value.event.data);await new Promise(resolve=>setTimeout(resolve,publishMs));}return f.runOwner.append(value);}};
 const execute=createConversationActivity({runOwner,prepareRuntime:async()=>runtime(extra),query:()=>({async *[Symbol.asyncIterator](){yield* frames;},close(){}}),newId:()=>id(n++),
  modelDeadlineMs:modelDeadlineInMs===undefined?undefined:Date.now()+modelDeadlineInMs});
 try{const outcome=await execute({binding}).then(value=>value,error=>({error:error.message}));const history=await f.service.history({credential:f.credential});
  return {outcome,published,history,deltas:history.events.filter(e=>e.type==='message.delta').map(e=>e.data),state:history.run.state};}
 finally{f.close();}
}

test('a reply streamed while a publication is in flight joins the next one: forty deltas, two publications, same text',async()=>{
 const parts=words(40),r=await run([start('m1'),block(0),...parts.map(t=>delta(t)),stop(0),assistant('m1',parts.join('')),success]);
 assert.deepEqual(r.outcome,{state:'completed'});
 assert.deepEqual(r.published.map(p=>p.text),[parts[0],parts.slice(1).join('')],'the first delta alone, then everything read while it published');
 assert.equal(r.deltas.map(d=>d.text).join(''),parts.join(''));assert.equal(new Set(r.deltas.map(d=>d.messageId)).size,1);
});

test('folding stops at a content block index, a non-text block and a message boundary',async()=>{
 // Block 1's deltas follow block 0's with no stop/start between them: only the index separates them.
 const r=await run([start('m1'),block(0),delta('A1 '),delta('A2 '),delta('A3 '),delta('B1 ',1),delta('B2 ',1),stop(0),stop(1),block(2,'tool_use'),
  assistant('m1','A1 A2 A3 ','B1 B2 '),start('m2'),block(0),delta('C1 '),delta('C2 '),stop(0),assistant('m2','C1 C2 '),success]);
 assert.deepEqual(r.outcome,{state:'completed'});
 for(const {text} of r.published)assert.ok(!/A\d.*B\d|B\d.*C\d|A\d.*C\d/u.test(text),`no publication spans a boundary: ${JSON.stringify(text)}`);
 const byMessage=Map.groupBy(r.deltas,d=>d.messageId);assert.equal(byMessage.size,2);
 assert.deepEqual([...byMessage.values()].map(list=>list.map(d=>d.text).join('')),['A1 A2 A3 B1 B2 ','C1 C2 ']);
});

test('the result is handled after the last folded publication, so all text is durable before completion',async()=>{
 const parts=words(12),r=await run([start('m1'),block(0),...parts.map(t=>delta(t)),stop(0),assistant('m1',parts.join('')),success]);
 assert.deepEqual(r.outcome,{state:'completed'});
 const completedAt=r.history.events.find(e=>e.type==='run.status'&&e.data.state==='completed').sequence;
 assert.ok(r.history.events.filter(e=>e.type==='message.delta').every(e=>e.sequence<completedAt));assert.equal(r.deltas.map(d=>d.text).join(''),parts.join(''));
});

test('the output limit fails the run while folding: nothing beyond it is published',async()=>{
 const parts=words(30),r=await run([start('m1'),block(0),...parts.map(t=>delta(t)),stop(0),assistant('m1',parts.join('')),success],{runtime:{maxOutputBytes:40}});
 assert.equal(r.state,'failed');assert.ok(Buffer.byteLength(r.published.map(p=>p.text).join(''))<=40,'published text stays inside maxOutputBytes');
});

test('deltas read while a publication is in flight are not used once the model deadline has passed',async()=>{
 // The whole reply is read during the first publication; the deadline passes before it is durable, so nothing more is consumed.
 const parts=words(10),r=await run([start('m1'),block(0),...parts.map(t=>delta(t)),stop(0),assistant('m1',parts.join('')),success],{publishMs:1500,modelDeadlineInMs:750});
 assert.match(r.outcome.error,/EXECUTION_FAILED/);assert.equal(r.state,'failed');
 assert.deepEqual(r.published.map(p=>p.text),[parts[0]],'only the publication begun before the deadline');
});

test('one folded publication carries at most the fold bound plus one delta',async()=>{
 const chunk='x'.repeat(1000),parts=Array.from({length:60},()=>chunk),r=await run([start('m1'),block(0),...parts.map(t=>delta(t)),stop(0),assistant('m1',parts.join('')),success]);
 assert.deepEqual(r.outcome,{state:'completed'});
 assert.ok(r.published.length>=3,`a 60 KB reply spans several publications (${r.published.length})`);
 for(const {text} of r.published)assert.ok(Buffer.byteLength(text)<DELTA_FOLD_MAX_BYTES+chunk.length);
 assert.equal(r.deltas.map(d=>d.text).join(''),parts.join(''));
});

test('a subagent delta and a progress-less system message never fold into displayed text',async()=>{
 const sub={...delta('PRIVATE '),parent_tool_use_id:'toolu_agent'};
 const r=await run([start('m1'),block(0),delta('A1 '),delta('A2 '),sub,delta('A3 '),{type:'system',subtype:'status',status:'compacting'},delta('A4 '),stop(0),assistant('m1','A1 A2 A3 A4 '),success]);
 assert.deepEqual(r.outcome,{state:'completed'});assert.equal(JSON.stringify(r.history).includes('PRIVATE'),false);
 assert.equal(r.deltas.map(d=>d.text).join(''),'A1 A2 A3 A4 ');
 for(const {text} of r.published)assert.ok(!/A[12].*A[34]/u.test(text)||!/A2.*A3/u.test(text),'the subagent frame ends the fold');
});
