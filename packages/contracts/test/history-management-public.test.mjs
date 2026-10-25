import test from 'node:test';
import assert from 'node:assert/strict';
import {receiveConversationHistoryRequest as request,receiveConversationHistoryResponse as response,MANAGEMENT_VERSION,HISTORY_PATHS} from '../dist/conversation-history.mjs';
const bytes=v=>new TextEncoder().encode(JSON.stringify(v)),id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const at='2026-10-24T12:00:00.000Z',until='2026-11-23T12:00:00.000Z';
const metadata={conversationId:id(1),title:'User chosen title',status:'active',revision:'1',scopeKind:'general',clientId:null,updatedAt:at,archivedAt:null,trashedAt:null,restoreUntil:null};
const summaries={version:MANAGEMENT_VERSION,status:'active',title:'chosen',before:null};
const command={version:MANAGEMENT_VERSION,requestId:id(2),conversationId:id(1),expectedRevision:'0',operation:'rename',title:metadata.title};
test('additive routes retain the three established paths and round-trip empty General summaries',async()=>{
 assert.equal(HISTORY_PATHS.list,'/api/conversations/list');assert.equal(HISTORY_PATHS.transcript,'/api/conversations/transcript');assert.equal(HISTORY_PATHS.nextTurn,'/api/conversations/next-turn');
 const q=request('summaries',bytes(summaries)),result={version:MANAGEMENT_VERSION,conversations:[{...metadata,hasTranscript:false,canManage:true}],nextBefore:null};
 assert.deepEqual(await response('summaries',200,bytes(result),q),result);
});
test('owned title queries and mutation requests are closed; no caller authority or reassignment',()=>{
 for(const changed of [{...summaries,transcript:'hidden'},{...summaries,title:' padded '},{...summaries,before:{createdAt:at,conversationId:id(1)}}])assert.throws(()=>request('summaries',bytes(changed)));
 for(const changed of [{...command,clientId:id(3)},{...command,actorId:id(3)},{...command,autoTitle:true},{...command,title:''},{...command,title:' x '},{...command,expectedRevision:0}])assert.throws(()=>request('manage',bytes(changed)));
 assert.throws(()=>request('manage',bytes({...command,operation:'archive'})));
});
test('rename receipt correlates exact command, revision and title, and requires admitted request',async()=>{
 const q=request('manage',bytes(command)),result={version:MANAGEMENT_VERSION,requestId:id(2),conversation:metadata};
 assert.deepEqual(await response('manage',200,bytes(result),q),result);
 for(const changed of [{...result,requestId:id(3)},{...result,conversation:{...metadata,conversationId:id(3)}},{...result,conversation:{...metadata,revision:'2'}},{...result,conversation:{...metadata,title:'Model-generated replacement'}}])await assert.rejects(response('manage',200,bytes(changed),q));
 await assert.rejects(response('manage',200,bytes(result),command),/UNADMITTED_REQUEST/);
});
test('Trash deadline is exactly thirty days; explicit client and General scopes cannot be confused',async()=>{
 const q=request('manage',bytes({version:MANAGEMENT_VERSION,requestId:id(2),conversationId:id(1),expectedRevision:'0',operation:'trash'}));
 const trashed={...metadata,status:'trashed',trashedAt:at,restoreUntil:until};
 const result={version:MANAGEMENT_VERSION,requestId:id(2),conversation:trashed};
 await response('manage',200,bytes(result),q);
 for(const changed of [{...trashed,restoreUntil:'2026-11-24T12:00:00.000Z'},{...trashed,trashedAt:null},{...trashed,clientId:id(3)},{...trashed,scopeKind:'client'}])await assert.rejects(response('manage',200,bytes({...result,conversation:changed}),q));
 await response('manage',200,bytes({...result,conversation:{...trashed,scopeKind:'client',clientId:id(3)}}),q);
});
test('summary status, stable order, unique identities and exact cursor are verified',async()=>{
 const q=request('summaries',bytes(summaries)),row={...metadata,hasTranscript:true,canManage:false};
 for(const result of [
  {version:MANAGEMENT_VERSION,conversations:[{...row,status:'archived',archivedAt:at}],nextBefore:null},
  {version:MANAGEMENT_VERSION,conversations:[row,row],nextBefore:null},
  {version:MANAGEMENT_VERSION,conversations:[row,{...row,conversationId:id(2)}],nextBefore:null},
  {version:MANAGEMENT_VERSION,conversations:[row],nextBefore:{updatedAt:at,conversationId:id(9)}},
 ])await assert.rejects(response('summaries',200,bytes(result),q));
 await response('summaries',200,bytes({version:MANAGEMENT_VERSION,conversations:[row],nextBefore:{updatedAt:at,conversationId:id(1)}}),q);
});
test('management preserves unknown-write reconciliation and definite conflict/expiry outcomes',async()=>{
 const q=request('manage',bytes(command));
 for(const [status,error]of [[503,{code:'CONVERSATION_UNAVAILABLE',outcome:'UNKNOWN'}],[409,{code:'CONVERSATION_MANAGEMENT_CONFLICT',outcome:'NOT_DISPATCHED'}],[410,{code:'CONVERSATION_RESTORE_EXPIRED',outcome:'NOT_DISPATCHED'}]])assert.deepEqual(await response('manage',status,bytes({error}),q),{error});
 await assert.rejects(response('manage',409,bytes({error:{code:'CONVERSATION_MANAGEMENT_CONFLICT',outcome:'UNKNOWN'}}),q));
});
