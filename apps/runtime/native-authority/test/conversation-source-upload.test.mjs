/** The current-source reader re-reads only saved bill pages and hearing records. Saved upload metadata has no current
 *  source: it is refused as unsupported before any Core call, never re-labelled as a bill request. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createCoreConversationSourceReader} from '../conversation-source.mjs';
import {productFailure} from '../../../control/product-access/errors.mjs';
import {UPLOAD_SOURCE_EVENT} from '../../../../packages/contracts/conversation-sources/protocol.mjs';
const sha='a'.repeat(64);
const binding={tenantId:'tenant1',actorId:'actor1',conversationId:'00000001-0000-4000-8000-000000000000',runId:'00000002-0000-4000-8000-000000000000',attemptId:'00000003-0000-4000-8000-000000000000',workerId:'00000004-0000-4000-8000-000000000000',writerFence:1};
const scope={tenantId:'tenant1',kind:'client',resourceId:'00000005-0000-4000-8000-000000000000',policyRevision:'p1'};
const upload={contractVersion:'0.1.0',eventId:'00000008-0000-4000-8000-000000000000',binding,scopes:[scope],sequence:1,createdAt:'2026-10-28T00:00:00.000Z',type:UPLOAD_SOURCE_EVENT,data:{
 schemaVersion:'meri.native-upload-source/1',deliveryId:'delivery-1',operation:{id:'read_upload_source',version:'0.2.0'},requestSha256:sha,argumentsSha256:sha,resultSha256:sha,executionSha256:sha,policyRevision:'p1',
 source:{authoritativeOwner:'upload_custody',uploadId:'00000009-0000-4000-8000-000000000000',sha256:sha,versionId:'v1',filename:'synthetic.pdf',mimeType:'application/pdf',bytes:1024,extractedSourceSha256:sha,extractionStatus:'available',limitations:[]},
 page:{number:0,count:1,sha256:sha,nextPage:null,fragmentCount:0,extractionStatus:'available',limitations:[]}}};
const notFound=error=>productFailure(error)?.code==='SOURCE_REFERENCE_NOT_FOUND';
test('a saved upload reference is unsupported by the current-source reader and reaches no Core route',async()=>{
 let calls=0;
 const reader=createCoreConversationSourceReader({origin:'https://core.example.invalid',getServiceSecret:async()=>'SYNTHETIC_SERVICE',now:()=>1000,maxRequestMs:1000,async fetchImpl(){calls++;throw Error('never called');}});
 const request=reader.forRequest({credential:'SYNTHETIC_CURRENT',principal:{tenantId:'tenant1',actorId:'actor1',clientIds:[scope.resourceId]},deadlineMs:2000});
 await assert.rejects(request.read(upload),notFound);
 await assert.rejects(request.media(upload,{}),notFound);
 assert.equal(calls,0);
});
