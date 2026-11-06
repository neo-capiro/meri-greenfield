import test from 'node:test';
import assert from 'node:assert/strict';
import {applicationFixture,binding,scopes,id} from './application-fixture.mjs';
import {receiveConversationRequest,receiveConversationResponse,createConversationCursor} from '../../../../packages/contracts/dist/conversation-application.mjs';

const bytes=value=>new TextEncoder().encode(JSON.stringify(value));
const empty={schema:'meri.conversation-history-empty/1',binding,scopes};

test('an authenticated untouched run returns explicit empty history without creating a run or observation authority',async()=>{
 const f=await applicationFixture();
 try{
  const legacy=await f.post('history',{});assert.equal(legacy.status,404);assert.equal((await legacy.json()).error.code,'NOT_FOUND');
  const response=await f.post('history',{acceptEmpty:true});
  assert.equal(response.status,200);assert.deepEqual(await response.json(),empty);
  const admitted=await receiveConversationResponse('history',200,bytes(empty),receiveConversationRequest('history',bytes({acceptEmpty:true})));
  assert.deepEqual(admitted,empty);assert.throws(()=>createConversationCursor(admitted),/UNADMITTED_VIEW/);
  assert.equal(f.state.runs.size,0);assert.equal(f.state.events.size,0);assert.equal(f.state.starts,0);
  const stream=await f.post('events',{command:{conversationId:binding.conversationId,intent:'view.subscribe'}});
  assert.equal(stream.status,404);
 }finally{f.close();}
});

test('empty history cannot satisfy a nonzero cursor or bypass current binding, access, and final-release checks',async()=>{
 const f=await applicationFixture();
 try{
  const cursor=await f.post('history',{after:1,acceptEmpty:true});assert.equal(cursor.status,404);assert.equal((await cursor.json()).error.code,'NOT_FOUND');
  let current=0;
  f.state.checkCurrentBinding=async()=>{if(++current===2)throw Error('synthetic binding revoked during read');};
  assert.equal((await f.post('history',{acceptEmpty:true})).status,403);assert.equal(current,2);
  f.state.checkCurrentBinding=async requested=>{assert.notEqual(requested.runId,id(99));throw Error('synthetic unknown current binding');};
  assert.equal((await f.post('history',{acceptEmpty:true})).status,403);
  f.state.revoked=true;assert.equal((await f.post('history',{acceptEmpty:true})).status,403);
 }finally{f.close();}
});

test('empty history receiving rejects nonzero cursors, scope mismatches, extra fields and non-history routes',async()=>{
 for(const invalid of [false,null,'true',1])assert.throws(()=>receiveConversationRequest('history',bytes({acceptEmpty:invalid})),/INVALID_REQUEST/);
 for(const [route,request,value] of [
  ['history',{},empty],
  ['history',{after:1,acceptEmpty:true},empty],
  ['history',{acceptEmpty:true}, {...empty,scopes:[{...scopes[0],tenantId:id(99)}]}],
  ['history',{acceptEmpty:true}, {...empty,request:{requestId:id(9),prompt:'fabricated'}}],
  ['cancel',{},empty],
 ])await assert.rejects(receiveConversationResponse(route,200,bytes(value),receiveConversationRequest(route,bytes(request))));
});

test('a positive admitted history view cannot become an empty result',async()=>{
 const f=await applicationFixture({initialInput:true});
 try{
  await f.service.allocateInput({credential:f.credential,input:f.input});await f.service.submit({credential:f.credential,input:f.input});
  const request=receiveConversationRequest('history',bytes({acceptEmpty:true}));
  const positive=await receiveConversationResponse('history',200,bytes(await f.service.history({credential:f.credential})),request);
  await assert.rejects(receiveConversationResponse('history',200,bytes(empty),request,positive),/CURSOR_MISMATCH/);
 }finally{f.close();}
});
