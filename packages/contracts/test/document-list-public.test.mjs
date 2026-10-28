import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {receiveDocumentRequest,receiveDocumentResponse,receiveDocumentDownload} from '../dist/document-access-application.mjs';
const bytes=value=>new TextEncoder().encode(JSON.stringify(value)),copy=structuredClone;
const tenantId='synthetic-tenant',actorId='synthetic-actor';
function version({conversationId=randomUUID(),clientId=randomUUID()}={}){
 const scopes=[{tenantId,kind:clientId===null?'private-user':'client',resourceId:clientId??actorId,policyRevision:'current-policy'}];
 return {contractVersion:'0.1.0',artifactId:randomUUID(),versionId:randomUUID(),parentVersionId:randomUUID(),
  binding:{tenantId,actorId,conversationId,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1},
  object:{objectId:randomUUID(),versionId:'immutable',sha256:'a'.repeat(64),bytes:20,scopes:copy(scopes)},filename:'Draft.txt',mimeType:'text/plain; charset=utf-8',
  scopes,evidence:[],generationStatus:'draft',previewStatus:'pending',createdAt:'2026-10-27T00:00:00.000Z'};
}
const request=(scope='owner',limit=10,cursor=null)=>receiveDocumentRequest('list',bytes({scope,limit,cursor}));
const page=(versions=[],scope='owner',nextCursor=null)=>({scope,versions,nextCursor});
const receive=(value,q=request())=>receiveDocumentResponse('list',200,bytes(value),q);

test('owner library receives original metadata across client and General origins without granting downloads',async()=>{
 const value=page([version(),version({clientId:null}),version()]),received=await receive(value);
 assert.deepEqual(received,value);assert(Object.isFrozen(received.versions[0]));
 await assert.rejects(receiveDocumentDownload(new Response('synthetic'),received.versions[0]),e=>e.code==='UNADMITTED_VERSION');
});
test('client and conversation pages keep their actual scope and can continue with zero visible rows',async()=>{
 const clientId=randomUUID(),conversationId=randomUUID();
 for(const scope of ['client','conversation']){
  const versions=[version({clientId,conversationId}),version({clientId,conversationId:scope==='client'?randomUUID():conversationId})];
  assert.deepEqual(await receive(page(versions,scope),request(scope)),page(versions,scope));
 }
 const empty=page([],'owner','b'.repeat(64));assert.deepEqual(await receive(empty),empty);
 assert.deepEqual(await receive(page(),request('owner',10,empty.nextCursor)),page());
});
test('list request is closed, scope-explicit and bounded; old operation shapes cannot carry discovery selectors',()=>{
 for(const patch of [{scope:'tenant'},{scope:null},{limit:0},{limit:101},{limit:1.5},{cursor:''},{cursor:'A'.repeat(64)},{cursor:'b'.repeat(63)},{clientId:randomUUID()},{actorId},{conversationId:randomUUID()},{versionId:randomUUID()}])
  assert.throws(()=>receiveDocumentRequest('list',bytes({scope:'owner',limit:10,cursor:null,...patch})),e=>e.code==='INVALID_REQUEST');
 assert.throws(()=>receiveDocumentRequest('inspect',bytes({versionId:randomUUID(),scope:'owner'})),e=>e.code==='INVALID_REQUEST');
});
for(const [name,mutate]of Object.entries({
 'wrong scope':v=>{v.scope='client';},
 'duplicate artifact head':v=>{v.versions[1].artifactId=v.versions[0].artifactId;},
 'duplicate version':v=>{v.versions[1].versionId=v.versions[0].versionId;},
 'foreign actor':v=>{v.versions[1].binding.actorId='colleague';},
 'foreign tenant':v=>{v.versions[1].binding.tenantId='other';},
 'wrong object scopes':v=>{v.versions[0].object.scopes[0].policyRevision='stale';},
 'foreign private scope':v=>{v.versions[0].scopes=[{...v.versions[0].scopes[0],kind:'private-user',resourceId:'colleague'}];v.versions[0].object.scopes=copy(v.versions[0].scopes);},
 'oversized object':v=>{v.versions[0].object.bytes=16777217;},
 'mime mismatch':v=>{v.versions[0].filename='Draft.pdf';},
 'fake totals':v=>{v.total=2;},
 'byte claim':v=>{v.currentBytesVerified=true;},
 'preview claim':v=>{v.versions[0].previewStatus='validated';},
 'native-file surrogate':v=>{v.versions[0]={kind:'native-file',versionId:randomUUID()};},
}))test(`list refuses ${name}`,async()=>{const value=page([version(),version()]);mutate(value);await assert.rejects(receive(value));});
test('list refuses mixed conversation/client scopes, oversized pages, repeated cursors and unadmitted requests',async()=>{
 await assert.rejects(receive(page([version(),version()],'conversation'),request('conversation')),e=>e.code==='LIST_MISMATCH');
 await assert.rejects(receive(page([version(),version()],'client'),request('client')),e=>e.code==='LIST_MISMATCH');
 await assert.rejects(receive(page([version({clientId:null})],'client'),request('client')),e=>e.code==='LIST_MISMATCH');
 await assert.rejects(receive(page([version(),version()]),request('owner',1)),e=>e.code==='LIST_MISMATCH');
 await assert.rejects(receive(page([],'owner','b'.repeat(64)),request('owner',10,'b'.repeat(64))),e=>e.code==='LIST_MISMATCH');
 await assert.rejects(receive(page(),copy(request())),e=>e.code==='UNADMITTED_REQUEST');
 await assert.rejects(receive(page(),receiveDocumentRequest('history',bytes({versionId:randomUUID(),limit:10,cursor:null}))),e=>e.code==='UNADMITTED_REQUEST');
});
test('list receives the owned cursor refusal and existing failures, never an error page as success',async()=>{
 const q=request();for(const [status,code]of [[409,'ARTIFACT_LIBRARY_CURSOR'],[403,'ACCESS_DENIED'],[503,'UNAVAILABLE']]){
  const refused={error:{code,outcome:'READ_UNAVAILABLE'}};assert.deepEqual(await receiveDocumentResponse('list',status,bytes(refused),q),refused);
  await assert.rejects(receive(refused,q),e=>e.code==='INVALID_RESPONSE');
  await assert.rejects(receiveDocumentResponse('list',500,bytes(refused),q),e=>e.code==='INVALID_ERROR_RESPONSE');
 }
});
