import test from 'node:test';import assert from 'node:assert/strict';
import {createOperationLifetime} from '../../../../../packages/runtime/operation-lifetime.mjs';
import {createCollection,asset} from '../source.mjs';
import {sourcePage,unitContext,selection,NOW} from './fixtures.mjs';
const bounds={maxCalls:24,maxPages:3,maxRecords:3,sectionCodeUnits:2000,maxBodyCodeUnits:120000,maxSourceBytes:2097152};
async function collected({readSource=sourcePage,limits={},maxMs=5000}={}){const context=unitContext(),selected=selection(context),deadlineMs=NOW+maxMs,
 life=createOperationLifetime({now:()=>NOW,deadlineMs,errorFactory:code=>new Error(code)}),calls=[];
 try {const c=createCollection({readSource:call=>{calls.push(call);return readSource(call);},context,selected,asOf:new Date(NOW).toISOString(),query:'briefing',deadlineMs,life,now:()=>NOW,limits:{...bounds,...limits}});
  await c.collect();return {c,calls};}finally{life.close();}}
test('collection executes all8 original reads with actual canonical pages, exact body continuation and explicit unavailable native records',async()=>{
 const {c,calls}=await collected();assert.deepEqual(new Set(calls.map(call=>call.operation.id)),new Set(asset.manifest.allowedOperations.map(op=>op.id)));
 assert.equal(c.stats().calls,11);assert.equal(c.reads.length,9);assert.deepEqual(c.gaps.map(gap=>gap.operation),['query_tasks','query_action_items']);
 assert.deepEqual(calls.filter(call=>call.operation.id==='mail.read_thread').map(call=>call.request.bodyOffset),[0,1999]);
 assert.ok(c.reads.filter(r=>r.operation.id==='mail.read_thread').every(r=>r.result.messages[0].section.text.isWellFormed()));
 assert.ok(c.reads.every(receipt=>Object.keys(receipt).sort().join(',')==='normalizationContext,operation,request,result,resultSha256'));
 assert.ok(calls.every(call=>call.deadlineMs===NOW+5000));
});
test('call/read cap never executes later source effects and preserves exact remaining source intent',async()=>{
 const {c,calls}=await collected({limits:{maxCalls:7,maxPages:1}});assert.equal(calls.length,7);assert.equal(c.stats().calls,7);
 assert.ok(c.capHits.some(cap=>cap.kind==='tool-call-cap'));assert.ok(c.gaps.some(gap=>gap.operation==='mail.read_thread'&&gap.reason==='TOOL_CALL_CAP'));
});
test('source authority failure is terminal and cannot be treated as missing evidence',async()=>{
 let calls=0;await assert.rejects(collected({readSource:()=>{calls++;throw Object.assign(new Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});}}),/COMMITMENTS_SOURCE_AUTHORITY/);assert.equal(calls,1);
});
test('source byte budget refuses before compiling or reading later families',async()=>{
 let calls=0;await assert.rejects(collected({limits:{maxSourceBytes:64},readSource:call=>{calls++;return sourcePage(call);}}),/COMMITMENTS_SOURCE_BYTES/);assert.equal(calls,1);
});
test('parked source deadline closes continuation and late return starts no later effects',async()=>{
 let calls=0;const park=Promise.withResolvers();await assert.rejects(collected({maxMs:20,readSource:()=>{calls++;return park.promise;}}),/DEADLINE/);
 park.resolve({});await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);
});
