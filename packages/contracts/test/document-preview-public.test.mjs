/** Canonical preview service/record with synthetic durable ports. No native renderer, cloud, DB or qualification. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';
import * as access from '../dist/document-access-application.mjs';
import * as legacy from '../dist/document-application.mjs';
import {custodyFixture} from '../../../apps/artifacts/test/preview-custody-fixture.mjs';
import {previewRecord} from '../../../apps/artifacts/preview/record.mjs';
import {artifactValidators as v} from '../retrieval-0.2/validate.mjs';
import {ARTIFACT_MIME_TYPES} from '../artifacts-0.2/artifact-formats.mjs';
const utf8=x=>new TextEncoder().encode(JSON.stringify(x)),hash=x=>createHash('sha256').update(x).digest('hex');
const code=expected=>error=>{assert.equal(error.code,expected);return true;};
async function fixture(format='pdf'){
 const f=custodyFixture(),raw=structuredClone(f.source);raw.version.mimeType=ARTIFACT_MIME_TYPES[format];raw.version.filename='Synthetic.'+format;
 const details={pdf:{conversionCompleted:true,renderInspection:'pending',sourceDocxSha256:'1'.repeat(64)},docx:{paragraphs:1,tables:0,pictures:0},xlsx:{sheets:['Data'],formulas:0,formulaCache:'unverified-zero-placeholder; recalculation required'},pptx:{slides:1,editable:true,visualInspection:'pending'},txt:{encoding:'UTF-8',whitespace:'unchanged'},zip:{rows:1,columns:['a'],chart:false}};
 const inspect=access.receiveDocumentRequest('inspect',utf8({versionId:raw.version.versionId}));
 const {version}=await access.receiveDocumentResponse('inspect',200,utf8({version:raw.version,inspection:{...raw.inspection,format,details:details[format],currentBytesVerified:true}}),inspect);
 let publication;
 if(format==='pdf')publication=await f.publish();else publication={status:'published',preview:previewRecord({v,previewId:randomUUID(),version,object:{...version.object,objectId:randomUUID()},pages:1,
  conversion:{method:'office-pdf',inputSha256:version.object.sha256,outputSha256:version.object.sha256,qualificationId:'synthetic-not-native',imageDigest:'sha256:'+'b'.repeat(64)},createdAt:version.createdAt})};
 const request=access.receiveDocumentPreviewRequest('publish',utf8({versionId:version.versionId}));
 const response=(changes={},bytes=f.bytes)=>new Response(bytes,{headers:{'content-type':'application/pdf','content-disposition':`inline; filename="${version.filename}.preview.pdf"`,
  'content-length':String(f.bytes.length),'cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"sandbox; default-src 'none'",
  'x-meri-preview-id':publication.preview.previewId,'x-meri-preview-source-version':version.versionId,'x-meri-preview-source-sha256':version.object.sha256,
  'x-meri-preview-sha256':hash(f.bytes),'x-meri-preview-pages':'1','x-meri-preview-record-sha256':v.hash(publication.preview),...changes}});
 return {...f,version,publication,request,response};
}
for(const format of ['pdf','docx','xlsx','pptx'])test(`${format}: explicit publication preserves the canonical immutable receipt and source status`,async()=>{
 const f=await fixture(format),result=access.receiveDocumentPreviewPublication(200,utf8(f.publication),f.request,f.version);
 assert.deepEqual(result,f.publication);assert.equal(result.preview.nativeQualified,false);assert.equal(f.version.previewStatus,'pending');
 const read=await access.receiveDocumentPreview(f.response(),f.version);assert.equal(hash(read.bytes),f.version.object.sha256);assert.equal(read.preview.nativeQualified,false);
});
test('read survives receiver reload after inspect without a publication request, and the old route vocabularies stay closed',async()=>{
 const f=await fixture();const fresh=await import('../dist/document-access-application.mjs?fresh-preview');
 const request=fresh.receiveDocumentRequest('inspect',utf8({versionId:f.version.versionId}));
 const {version}=await fresh.receiveDocumentResponse('inspect',200,utf8({version:f.version,inspection:{...f.source.inspection,currentBytesVerified:true}}),request);
 assert.deepEqual((await fresh.receiveDocumentPreview(f.response(),version)).bytes,new Uint8Array(f.bytes));
 for(const receiver of [access,legacy])for(const route of ['preview','preview-publish'])assert.throws(()=>receiver.receiveDocumentRequest(route,utf8({versionId:f.version.versionId})),code('INVALID_ROUTE'));
 assert.equal(access.documentAccessVersion,'0.2.0');assert.equal(access.documentPreviewMetadata.publish.effect,'write');assert.equal(access.documentPreviewMetadata.read.effect,'read');
});
for(const [name,mutate]of Object.entries({source:r=>r.source.sha256='0'.repeat(64),tenant:r=>r.tenantId='other',conversation:r=>r.conversationId=randomUUID(),artifact:r=>r.artifactId=randomUUID(),
 objectScope:r=>r.preview.object.scopes[0].resourceId='other',digest:r=>r.conversion.outputSha256='0'.repeat(64),native:r=>r.nativeQualified=true,
 method:r=>r.conversion.method='office-pdf',oversize:r=>r.preview.object.bytes=8388609,extra:r=>r.authorized=true}))test(`publication refuses ${name}`,async()=>{
 const f=await fixture(),bad=structuredClone(f.publication);mutate(bad.preview);assert.throws(()=>access.receiveDocumentPreviewPublication(200,utf8(bad),f.request,f.version));
});
for(const [name,headers]of Object.entries({source:{'x-meri-preview-source-sha256':'0'.repeat(64)},version:{'x-meri-preview-source-version':randomUUID()},digest:{'x-meri-preview-sha256':'0'.repeat(64)},
 missingIdentity:{'x-meri-preview-id':''},pages:{'x-meri-preview-pages':'501'},record:{'x-meri-preview-record-sha256':'x'},unsafeCsp:{'content-security-policy':"default-src *"},encoding:{'content-encoding':'gzip'},cache:{'cache-control':'public'}}))test(`read refuses ${name}`,async()=>{
 const f=await fixture();await assert.rejects(access.receiveDocumentPreview(f.response(headers),f.version),code('PREVIEW_HEADERS'));
});
test('read verifies body hash, length and byte cap; copied versions carry no integrity brand',async()=>{
 const f=await fixture('docx'),changed=Buffer.from(f.bytes);changed[0]^=1;
 await assert.rejects(access.receiveDocumentPreview(f.response({},changed),f.version),code('PREVIEW_HASH'));
 await assert.rejects(access.receiveDocumentPreview(f.response({},f.bytes.subarray(1)),f.version),code('PREVIEW_LENGTH'));
 await assert.rejects(access.receiveDocumentPreview(f.response(),f.version,{maxBytes:f.bytes.length-1}),code('PREVIEW_HEADERS'));
 await assert.rejects(access.receiveDocumentPreview(f.response(),structuredClone(f.version)),code('UNADMITTED_VERSION'));
});
test('unsupported sources and read requests cannot publish; UNKNOWN remains an error receipt',async()=>{
 const f=await fixture();const request=access.receiveDocumentPreviewRequest('read',utf8({versionId:f.version.versionId}));
 assert.throws(()=>access.receiveDocumentPreviewPublication(200,utf8(f.publication),request,f.version),code('UNADMITTED_REQUEST'));
 assert.deepEqual(access.receiveDocumentPreviewPublication(502,utf8({error:{code:'ARTIFACT_EFFECT_UNKNOWN',outcome:'UNKNOWN'}}),f.request,f.version),{error:{code:'ARTIFACT_EFFECT_UNKNOWN',outcome:'UNKNOWN'}});
 for(const format of ['txt','zip']){const x=await fixture(format);await assert.rejects(access.receiveDocumentPreview(x.response(),x.version),code('PREVIEW_UNSUPPORTED'));}
});
test('a stalled stream is cancelled on deadline without retaining its reader lock',async()=>{
 const f=await fixture('docx');let cancelled=0;const body=new ReadableStream({pull(){return new Promise(()=>{});},cancel(){cancelled++;}});
 const response=new Response(body,{headers:f.response().headers});await assert.rejects(access.receiveDocumentPreview(response,f.version,{timeoutMs:20}),code('PREVIEW_DEADLINE'));
 await new Promise(resolve=>setTimeout(resolve,1));assert.equal(cancelled,1);assert.equal(body.locked,false);
});
