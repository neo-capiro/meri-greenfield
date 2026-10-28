import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {receiveRunIndexRequest,receiveRunIndexResponse,receiveConversationHistoryRequest} from '../dist/conversation-history.mjs';
import {projectRunRow} from '../../../apps/control/conversations/runs/projection.mjs';
import {row,principal,request,id} from '../../../apps/control/conversations/runs/test/fixture.mjs';
const bytes=v=>new TextEncoder().encode(JSON.stringify(v));
const response={schemaVersion:'meri.run-index/1',observedAt:'2026-10-27T12:01:00.000Z',scope:request.scope,status:'all',runs:[projectRunRow(row(1),principal).summary],nextCursor:null,coverage:{kind:'current-authorized-durable-runs',complete:true,snapshot:false}};
test('separately branded run index receiver accepts exact public projection and preserves ordinary history strictness',()=>{
 const admitted=receiveRunIndexRequest('list',bytes(request)),actual=receiveRunIndexResponse('list',200,bytes(response),admitted);
 assert.deepEqual(actual,response);assert.equal(Object.isFrozen(actual.runs[0]),true);
 assert.throws(()=>receiveConversationHistoryRequest('list',bytes(request)));
 assert.throws(()=>receiveConversationHistoryRequest('runList',bytes(request)));
 assert.throws(()=>receiveRunIndexResponse('list',200,bytes(response),structuredClone(admitted)),/UNADMITTED_REQUEST/);
 assert.throws(()=>receiveRunIndexRequest('list',bytes({...request,tenantId:'forged'})));
 assert.deepEqual(receiveConversationHistoryRequest('list',bytes({limit:2})),{limit:2});
});
test('cross-scope, status, order, duplicate IDs and missing-as-zero replies are refused',()=>{
 const admitted=receiveRunIndexRequest('list',bytes(request));
 for(const mutate of [v=>v.scope={kind:'general'},v=>v.status='terminal',v=>v.runs.push(v.runs[0]),v=>{v.runs[0].usage.recording='not-recorded';},v=>v.runs[0].references.runId=id(999),v=>v.coverage.complete=false]){
  const changed=structuredClone(response);mutate(changed);assert.throws(()=>receiveRunIndexResponse('list',200,bytes(changed),admitted));
 }
 const current=receiveRunIndexRequest('list',bytes({...request,status:'active'}));assert.throws(()=>receiveRunIndexResponse('list',200,bytes({...response,status:'active'}),current));
});
test('detail/error status correlation cannot be borrowed for another run or treated as an effect result',()=>{
 const r={schemaVersion:'meri.run-detail/1',conversationId:id(101),runId:id(201)},admitted=receiveRunIndexRequest('detail',bytes(r));
 const value={schemaVersion:r.schemaVersion,observedAt:response.observedAt,run:response.runs[0],continuation:{kind:'conversation-owner',physicalStopVerified:false}};
 assert.deepEqual(receiveRunIndexResponse('detail',200,bytes(value),admitted),value);
 assert.throws(()=>receiveRunIndexResponse('detail',200,bytes({...value,run:{...value.run,runId:id(299)}}),admitted));
 assert.deepEqual(receiveRunIndexResponse('detail',404,bytes({error:{code:'RUN_INDEX_NOT_FOUND'}}),admitted),{error:{code:'RUN_INDEX_NOT_FOUND'}});
 assert.throws(()=>receiveRunIndexResponse('detail',200,bytes({error:{code:'RUN_INDEX_NOT_FOUND'}}),admitted));
 assert.throws(()=>receiveRunIndexResponse('detail',404,bytes({error:{code:'RUN_INDEX_NOT_FOUND',outcome:'NOT_DISPATCHED'}}),admitted));
});
test('new named wire metadata keeps run wire separate from the explicitly extended ordinary history family',()=>{
 const metadata=JSON.parse(readFileSync(new URL('../dist/conversation-history.metadata.json',import.meta.url)));
 assert.equal(metadata.historyVersion,'1.3.0');assert.equal(metadata.runIndex.version,'1.0.0');
 assert.equal(metadata.schemaId,'urn:meri:conversation-history:1.3.0');assert.equal(metadata.runIndex.schemaId,'urn:meri:run-index:1.0.0');
});
