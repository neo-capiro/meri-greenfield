/** Streamed text deltas fold into the publication that follows a slow one, and into one publication per fold window while the
 * SDK keeps producing them; every fold boundary keeps its own publication. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as sleep} from 'node:timers/promises';
import {createConversationActivity,DELTA_FOLD_MAX_BYTES,DELTA_FOLD_WINDOW_MS} from '../activity.mjs';
import {applicationFixture,binding,versions,id} from '../../../control/conversations/test/application-fixture.mjs';
import {SDK_MODEL_CONFIGURATION} from '../../../control/conversations/usage.mjs';

const runtime=extra=>({binding,versions,cwd:`/workspace/conversations/${binding.conversationId}`,...SDK_MODEL_CONFIGURATION,providerEnvironment:{},
 sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+5000,maxTurns:2,maxCostMicroUSD:1000,maxOutputBytes:262144,...extra});
const start=msg=>({type:'stream_event',parent_tool_use_id:null,event:{type:'message_start',message:{id:msg}}});
const block=(index,type='text')=>({type:'stream_event',parent_tool_use_id:null,event:{type:'content_block_start',index,content_block:type==='text'?{type:'text',text:''}:{type:'tool_use',id:'toolu_1',name:'Read',input:{}}}});
const delta=(text,index=0)=>({type:'stream_event',parent_tool_use_id:null,event:{type:'content_block_delta',index,delta:{type:'text_delta',text}}});
const stop=index=>({type:'stream_event',parent_tool_use_id:null,event:{type:'content_block_stop',index}});
const assistant=(msg,...texts)=>({type:'assistant',parent_tool_use_id:null,message:{id:msg,content:texts.map(text=>({type:'text',text}))}});
const success={type:'result',subtype:'success',is_error:false};
const words=(n,prefix='w')=>Array.from({length:n},(_,i)=>`${prefix}${i} `);
/** A reply the SDK produces one delta every `gapMs`, as a live model does. */
async function* slowly(frames,gapMs){for(const frame of frames){yield frame;if(frame.event?.type==='content_block_delta')await sleep(gapMs);}}

/** Every display publication waits `publishMs` (control's authorization round) before it is durable; the SDK yields at once unless
 * `frames` is an async iterable. `modelDeadlineInMs` is the model deadline, counted from the activity's start. `deltaFoldWindowMs`
 * defaults to 0 here so each case below isolates one folding rule; the window cases set it explicitly. */
async function run(frames,{publishMs=40,runtime:extra,modelDeadlineInMs,deltaFoldWindowMs=0,now}={}){
 const f=await applicationFixture({initialInput:true});await f.service.allocateInput({credential:f.credential,input:f.input});await f.service.submit({credential:f.credential,input:f.input});
 const published=[];let n=500;
 const runOwner={...f.runOwner,async append(value){if(value.event.type==='message.delta'){published.push({...value.event.data,at:Date.now()});if(publishMs)await new Promise(resolve=>setTimeout(resolve,publishMs));}return f.runOwner.append(value);}};
 const execute=createConversationActivity({runOwner,prepareRuntime:async()=>runtime(extra),query:()=>({[Symbol.asyncIterator](){return (typeof frames[Symbol.asyncIterator]==='function'?frames:(async function*(){yield* frames;})())[Symbol.asyncIterator]();},close(){}}),newId:()=>id(n++),
  deltaFoldWindowMs,...(now===undefined?{}:{now}),modelDeadlineMs:modelDeadlineInMs===undefined?undefined:Date.now()+modelDeadlineInMs});
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

test('the fold window is bounded and defaults inside 150-250 ms; a window outside 0-1000 ms is refused',()=>{
 assert.ok(DELTA_FOLD_WINDOW_MS>=150&&DELTA_FOLD_WINDOW_MS<=250);
 const ports={runOwner:{async load(){},async append(){}},prepareRuntime:async()=>{},query:()=>{}};
 for(const deltaFoldWindowMs of [-1,1001,1.5,'200'])assert.throws(()=>createConversationActivity({...ports,deltaFoldWindowMs}),/ACTIVITY_CONFIGURATION/);
 for(const deltaFoldWindowMs of [0,1000,undefined])createConversationActivity({...ports,deltaFoldWindowMs});
});

test('a slowly streamed reply publishes once per fold window instead of once per delta, with every delta published before the result',async()=>{
 // Twenty deltas 20 ms apart (about 400 ms) with instant publications: without a window that is one publication per delta.
 const parts=words(20),frames=[start('m1'),block(0),...parts.map(t=>delta(t)),stop(0),assistant('m1',parts.join('')),success];
 const perDelta=await run(slowly(frames,20),{publishMs:0,deltaFoldWindowMs:0});
 assert.deepEqual(perDelta.outcome,{state:'completed'});assert.equal(perDelta.published.length,parts.length,'without a window every delta is its own control round');
 const windowed=await run(slowly(frames,20),{publishMs:0,deltaFoldWindowMs:150});
 assert.deepEqual(windowed.outcome,{state:'completed'});
 assert.ok(windowed.published.length>=2&&windowed.published.length<=5,`a 400 ms reply with a 150 ms window makes a few regular publications (${windowed.published.length})`);
 assert.equal(windowed.deltas.map(d=>d.text).join(''),parts.join(''),'no text is lost or reordered');
 const completedAt=windowed.history.events.find(e=>e.type==='run.status'&&e.data.state==='completed').sequence;
 assert.ok(windowed.history.events.filter(e=>e.type==='message.delta').every(e=>e.sequence<completedAt),'all text is durable before the result is handled');
 for(let i=1;i<windowed.published.length;i++)assert.ok(windowed.published[i].at-windowed.published[i-1].at>=100,'publications are spaced by the window, not by delta arrival');
});

test('a block end or the result inside the window ends the fold at once, so a short reply is not delayed',async()=>{
 const parts=words(3),began=Date.now(),r=await run([start('m1'),block(0),...parts.map(t=>delta(t)),stop(0),assistant('m1',parts.join('')),success],{publishMs:0,deltaFoldWindowMs:1000});
 assert.deepEqual(r.outcome,{state:'completed'});assert.deepEqual(r.published.map(p=>p.text),[parts.join('')],'one publication for the whole block');
 assert.ok(Date.now()-began<900,'the 1 s window did not hold the block end or the result back');
});

test('the window is measured on the injected clock: a frozen clock keeps one fold open for the whole block',async()=>{
 const parts=words(12),frames=[start('m1'),block(0),...parts.map(t=>delta(t)),stop(0),assistant('m1',parts.join('')),success];
 const frozen=Date.now(),r=await run(slowly(frames,15),{publishMs:0,deltaFoldWindowMs:150,now:()=>frozen});
 assert.deepEqual(r.outcome,{state:'completed'});
 assert.deepEqual(r.published.map(p=>p.text),[parts.join('')],'the window never elapses on a clock that does not advance, so the block end closes the only fold');
});
