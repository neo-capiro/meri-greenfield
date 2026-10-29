import test from 'node:test';
import assert from 'node:assert/strict';
import {receiveConversationHistoryRequest as request,receiveConversationHistoryResponse as response,MANAGEMENT_VERSION,HISTORY_PATHS} from '../dist/conversation-history.mjs';
const bytes=v=>new TextEncoder().encode(JSON.stringify(v)),id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const reference={requestId:id(2),conversationId:id(1),revision:'1',createdAt:'2026-10-01T00:00:00.000Z',restoreUntil:'2026-10-31T00:00:00.000Z'};
test('public history admits content-free request history and exact status',async()=>{
 assert.equal(HISTORY_PATHS.deletionStatus,'/api/conversations/deletions/status');
 const q=request('deletions',bytes({version:MANAGEMENT_VERSION,before:null}));
 const result={version:MANAGEMENT_VERSION,requests:[reference],olderRequestsUnavailable:true,nextBefore:{createdAt:reference.createdAt,requestId:reference.requestId}};
 assert.deepEqual(await response('deletions',200,bytes(result),q),result);
 const status=request('deletionStatus',bytes({version:MANAGEMENT_VERSION,requestId:reference.requestId}));
 for(const state of ['pending','blocked','unknown','completed','superseded']){
  const r={version:MANAGEMENT_VERSION,...reference,state,reasons:['completed','superseded'].includes(state)?[]:['verification_unavailable'],retainedSharedCopies:false,checkedAtMs:Date.parse('2026-11-01T00:00:00.000Z')};
  assert.deepEqual(await response('deletionStatus',200,bytes(r),status),r);
 }
});
test('closed schema rejects content leaks, authority hints, malformed cursors and mismatched completion',async()=>{
 assert.throws(()=>request('deletionStatus',bytes({version:MANAGEMENT_VERSION,requestId:reference.requestId,tenantId:id(9)})));
 const q=request('deletionStatus',bytes({version:MANAGEMENT_VERSION,requestId:reference.requestId}));
 const base={version:MANAGEMENT_VERSION,...reference,state:'completed',reasons:[],retainedSharedCopies:false,checkedAtMs:Date.parse(reference.restoreUntil)};
 for(const change of [{requestId:id(3)},{title:'private'},{reasons:['legal_hold']},{checkedAtMs:Date.parse(reference.createdAt)},{state:'unknown'},{storageKey:'secret'}])await assert.rejects(response('deletionStatus',200,bytes({...base,...change}),q));
 const list=request('deletions',bytes({version:MANAGEMENT_VERSION,before:null}));
 for(const change of [{requests:[reference,reference]},{nextBefore:{createdAt:reference.createdAt,requestId:id(9)}},{requests:[{...reference,createdAt:'2026-10-01'}]}])await assert.rejects(response('deletions',200,bytes({version:MANAGEMENT_VERSION,requests:[reference],olderRequestsUnavailable:false,nextBefore:null,...change}),list));
});
