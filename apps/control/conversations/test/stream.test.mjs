import test from 'node:test';import assert from 'node:assert/strict';import {createMeriLiveEventStream} from '../../../../packages/ui-stream/dist/producer.js';import {allocatedApplicationFixture,binding,id} from './application-fixture.mjs';
import {setTimeout as sleep} from 'node:timers/promises';
import {createConversationEventSource} from '../events.mjs';

test('a backed-off subscription flushes repeated Stop once and refuses late worker output', {timeout:5000},async()=>{
 const f=await allocatedApplicationFixture();let reader;
 try{
  await f.post('submit');reader=createConversationEventSource({service:f.service,credential:f.credential}).getReader();
  assert.equal((await reader.read()).value.sequence,1);await sleep(650);
  const stoppedAt=performance.now();assert.equal((await f.post('cancel',{})).status,200);assert.equal((await f.post('cancel',{})).status,200);
  await assert.rejects(f.runOwner.append({binding,event:{eventId:id(50),createdAt:new Date().toISOString(),type:'message.delta',data:{messageId:id(51),text:'late'}}}),/NOT_WRITABLE/);
  const terminal=await reader.read();assert.equal(terminal.value.sequence,2);assert.equal(terminal.value.data.state,'cancelled');
  assert.equal((await reader.read()).done,true);assert.ok(performance.now()-stoppedAt<500,'terminal delivery stays within the poll cap plus local processing margin');
  assert.equal(f.state.starts,1,'subscription and Stop never redispatch');
 }finally{if(reader){await reader.cancel().catch(()=>{});reader.releaseLock();}f.close();}
});
test('live AI SDK transport preserves durable ids/sequences and upstream stream protocol',async()=>{const f=await allocatedApplicationFixture();try{await f.post('submit');await f.post('cancel',{});const response=await f.post('events',{after:0});assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/event-stream/);const text=await response.text();assert.match(text,/data-meri-event/);assert.match(text,/"sequence":1/);assert.match(text,/"sequence":2/);assert.match(text,/\[DONE\]/);assert.equal(text.includes('synthetic-native'),false);assert.equal(text.includes(f.credential),false);}finally{f.close();}});
test('upstream reader cancellation reaches the owned live event source',async()=>{let cancelled=0,ack;const cancelledSource=new Promise(resolve=>ack=resolve);const events=new ReadableStream({pull(){return new Promise(()=>{});},cancel(){cancelled++;ack();}});const stream=createMeriLiveEventStream({messageId:id(22),events}),reader=stream.getReader();assert.equal((await reader.read()).value.type,'start');await reader.cancel('client disconnected');await Promise.race([cancelledSource,new Promise((_,reject)=>setTimeout(()=>reject(Error('SOURCE_NOT_CANCELLED')),200))]);assert.equal(cancelled,1);reader.releaseLock();});
test('live producer suppresses internal source error details',async()=>{const events=new ReadableStream({pull(controller){controller.error(Error('PRIVATE SOURCE DATA'));}});const reader=createMeriLiveEventStream({messageId:id(23),events}).getReader();const chunks=[];while(true){const next=await reader.read();if(next.done)break;chunks.push(next.value);}assert.equal(JSON.stringify(chunks).includes('PRIVATE'),false);assert.match(JSON.stringify(chunks),/subscription unavailable/);reader.releaseLock();});
