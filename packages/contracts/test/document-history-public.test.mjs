import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {receiveDocumentRequest,receiveDocumentResponse,receiveDocumentDownload} from '../dist/document-access-application.mjs';

const bytes=value=>new TextEncoder().encode(JSON.stringify(value)),copy=structuredClone;
const scopes=[{tenantId:'synthetic',kind:'client',resourceId:randomUUID(),policyRevision:'current-policy'}];
const binding={tenantId:'synthetic',actorId:'synthetic-actor',conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1};
function chain(count=11){
 const artifactId=randomUUID(),versions=[];
 for(let index=0;index<count;index++)versions.unshift({contractVersion:'0.1.0',artifactId,versionId:randomUUID(),parentVersionId:versions[0]?.versionId??null,
  binding:copy(binding),object:{objectId:randomUUID(),versionId:'immutable-'+index,sha256:'a'.repeat(64),bytes:20,scopes:copy(scopes)},filename:'Draft.txt',mimeType:'text/plain; charset=utf-8',scopes:copy(scopes),evidence:[],generationStatus:'draft',previewStatus:'pending',createdAt:'2026-10-27T00:00:00.000Z'});
 return versions;
}
const request=(versionId,limit=10,cursor=null)=>receiveDocumentRequest('history',bytes({versionId,limit,cursor}));
const page=(versions,anchorVersionId=versions.at(-1).versionId,nextCursor=null)=>({anchorVersionId,artifactId:versions[0].artifactId,headVersionId:versions[0].versionId,versions,nextCursor});
const receive=(value,q)=>receiveDocumentResponse('history',200,bytes(value),q);

test('metadata history receives more than ten immutable versions over pages without granting byte access',async()=>{
 const versions=chain(),anchor=versions.at(-1).versionId,first=page(versions.slice(0,10),anchor,'b'.repeat(64));
 const received=await receive(first,request(anchor));
 assert.deepEqual(received,first);assert(Object.isFrozen(received.versions[0]));
 const second={...page(versions.slice(10),anchor),headVersionId:versions[0].versionId};
 assert.deepEqual(await receive(second,request(anchor,10,first.nextCursor)),second);
 await assert.rejects(receiveDocumentDownload(new Response('synthetic'),received.versions[0]),e=>e.code==='UNADMITTED_VERSION');
});

test('history request is closed, explicitly routed, and bounded',()=>{
 const versionId=randomUUID();
 for(const patch of [{limit:0},{limit:101},{limit:1.5},{cursor:''},{cursor:'A'.repeat(64)},{cursor:'b'.repeat(63)},{scope:'owner'},{clientId:randomUUID()},{versionId:'unknown'}])
  assert.throws(()=>receiveDocumentRequest('history',bytes({versionId,limit:10,cursor:null,...patch})),e=>e.code==='INVALID_REQUEST');
 assert.throws(()=>receiveDocumentRequest('inspect',bytes({versionId,limit:10,cursor:null})),e=>e.code==='INVALID_REQUEST');
});

for(const [name,mutate]of Object.entries({
 'wrong anchor':value=>{value.anchorVersionId=randomUUID();},
 'wrong artifact':value=>{value.artifactId=randomUUID();},
 'wrong first head':value=>{value.headVersionId=randomUUID();},
 'duplicate version':value=>{value.versions[1]=copy(value.versions[0]);},
 'broken parent':value=>{value.versions[0].parentVersionId=randomUUID();},
 'hidden tail':value=>{value.versions.at(-1).parentVersionId=randomUUID();},
 'fake continuation':value=>{value.nextCursor='b'.repeat(64);},
 'foreign actor':value=>{value.versions[1].binding.actorId='other';},
 'foreign conversation':value=>{value.versions[1].binding.conversationId=randomUUID();},
 'foreign tenant':value=>{value.versions[1].binding.tenantId='other';},
 'changed scopes':value=>{value.versions[1].scopes[0].policyRevision='changed';},
 'oversized object':value=>{value.versions[0].object.bytes=16777217;},
 'mime mismatch':value=>{value.versions[0].filename='Draft.pdf';},
 'byte verification claim':value=>{value.currentBytesVerified=true;},
 'preview claim':value=>{value.versions[0].previewStatus='validated';},
 'native-file surrogate':value=>{value.versions[0]={kind:'native-file',versionId:value.versions[0].versionId};},
}))test(`history refuses ${name}`,async()=>{
 const original=chain(2),q=request(original.at(-1).versionId),value=copy(page(original));mutate(value);
 await assert.rejects(receive(value,q));
});

test('history refuses oversized pages, repeated cursors, and unadmitted request objects',async()=>{
 const versions=chain(3),anchor=versions[0].versionId,value=page(versions,anchor);
 await assert.rejects(receive(value,request(anchor,2)),e=>e.code==='HISTORY_MISMATCH');
 const partial={...page(versions.slice(1,2),anchor,'b'.repeat(64)),headVersionId:versions[0].versionId};
 await assert.rejects(receive(partial,request(anchor,2,'b'.repeat(64))),e=>e.code==='HISTORY_MISMATCH');
 await assert.rejects(receive(value,copy(request(anchor))),e=>e.code==='UNADMITTED_REQUEST');
 const inspect=receiveDocumentRequest('inspect',bytes({versionId:anchor}));
 await assert.rejects(receive(value,inspect),e=>e.code==='UNADMITTED_REQUEST');
});

test('history receives only matching closed errors, never an error page as success',async()=>{
 const q=request(randomUUID()),denied={error:{code:'ACCESS_DENIED',outcome:'READ_UNAVAILABLE'}};
 assert.deepEqual(await receiveDocumentResponse('history',403,bytes(denied),q),denied);
 await assert.rejects(receiveDocumentResponse('history',200,bytes(denied),q),e=>e.code==='INVALID_RESPONSE');
 await assert.rejects(receiveDocumentResponse('history',500,bytes(denied),q),e=>e.code==='INVALID_ERROR_RESPONSE');
});
