/** Closed public receiver tests over canonical native file metadata. No S3, renderer or model qualification. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';
import * as documents from '../dist/document-application.mjs';import * as access from '../dist/document-access-application.mjs';
import {artifactValidators} from '../retrieval-0.2/validate.mjs';
import {nativeArtifactFilename,nativeArtifactDisposition} from '../artifacts-0.2/artifact-formats.mjs';
import {assertNativeFileState} from '../runtime-0.2/files.mjs';
const bytes=new TextEncoder().encode('actual synthetic stored bytes'),sha256=createHash('sha256').update(bytes).digest('hex'),utf8=v=>new TextEncoder().encode(JSON.stringify(v));
function fixture(path='exports/report.csv'){
 const binding={tenantId:'tenant',actorId:'actor',conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1};
 const scopes=[{tenantId:binding.tenantId,kind:'private-user',resourceId:binding.actorId,policyRevision:'test'}],object={objectId:randomUUID(),versionId:'immutable-s3-version',sha256,bytes:bytes.length,scopes};
 const workspace={contractVersion:'0.1.0',manifestId:randomUUID(),binding,logicalCwd:'/workspace/conversation',entries:[{path,kind:'file',object,executable:false}],scopes,createdAt:'2026-10-24T07:00:00.000Z'};
 const result={kind:'native-file',version:{versionId:object.objectId,binding,manifestId:workspace.manifestId,path,object,scopes,createdAt:workspace.createdAt},integrity:{sha256,bytes:bytes.length,currentBytesVerified:true}};
 return {workspace,result};
}
async function inspect(mod,value,id=value.version.versionId){const request=mod.receiveDocumentRequest('inspect',utf8({versionId:id}));return mod.receiveDocumentResponse('inspect',200,utf8(value),request);}
function download(value,headers={},body=bytes){return new Response(body,{headers:{'content-type':'application/octet-stream','content-disposition':nativeArtifactDisposition(value.version.path),'content-length':String(bytes.length),'cache-control':'no-store','x-content-type-options':'nosniff',...headers}});}
for(const [name,mod] of [['documents',documents],['access',access]]){
 test(name+': actual native workspace shape becomes verified metadata and opaque bytes without invented format',async()=>{
  const {workspace,result}=fixture();assertNativeFileState({workspace,tasks:[]});assert.deepEqual(artifactValidators.nativeFileInspection(result),result);
  const out=await inspect(mod,result);assert.equal(out.kind,'native-file');assert.equal(out.version.path,'exports/report.csv');assert.equal('inspection' in out,false);assert.equal('mimeType' in out.version,false);assert(Object.isFrozen(out.version));
  const file=await mod.receiveDocumentDownload(download(out),out.version);assert.deepEqual(file.bytes,bytes);assert.equal(file.version,out.version);
  await assert.rejects(mod.receiveDocumentDownload(download(out),structuredClone(out.version)),e=>e.code==='UNADMITTED_VERSION');
  await assert.rejects(inspect(mod,result,randomUUID()),e=>e.code==='VERSION_MISMATCH');
 });
 test(name+': native Unicode filename remains exact with an ASCII fallback and RFC5987 correlation',async()=>{
  const {result}=fixture('exports/r\u00e9sum\u00e9.csv'),out=await inspect(mod,result);assert.equal(nativeArtifactFilename(out.version.path),'r_sum_.csv');
  assert.equal(nativeArtifactDisposition(out.version.path),"attachment; filename=\"r_sum_.csv\"; filename*=UTF-8''r%C3%A9sum%C3%A9.csv");
  assert.deepEqual((await mod.receiveDocumentDownload(download(out),out.version)).bytes,bytes);
  await assert.rejects(mod.receiveDocumentDownload(download(out,{'content-disposition':'attachment; filename="r_sum_.csv"'}),out.version),e=>e.code==='DOWNLOAD_HEADERS');
 });
 const bad={
  'foreign tenant':v=>v.version.binding.tenantId='other','object scope':v=>v.version.object.scopes=[{...v.version.object.scopes[0],resourceId:'other'}],
  'wrong object ID':v=>v.version.object.objectId=randomUUID(),'hash':v=>v.integrity.sha256='f'.repeat(64),'bytes':v=>v.integrity.bytes++,
  'unverified':v=>v.integrity.currentBytesVerified=false,'missing immutable version':v=>v.version.object.versionId='pending',
  'native byte cap':v=>{v.version.object.bytes=8388609;v.integrity.bytes=8388609;},'fake inspection':v=>v.inspection={rendered:true},
  'invented MIME':v=>v.version.mimeType='text/csv','unknown kind':v=>v.kind='rendered-file',
  'traversal':v=>v.version.path='../report.csv','absolute':v=>v.version.path='/report.csv','backslash':v=>v.version.path='a\\b.csv',
  'alternate stream':v=>v.version.path='a:b','control':v=>v.version.path='a\r\nb','non-NFC':v=>v.version.path='re\u0301sume.csv','long segment':v=>v.version.path='a'.repeat(129)
 };
 for(const [reason,change] of Object.entries(bad))test(name+': rejects native '+reason,async()=>{const {result}=fixture();change(result);assert.throws(()=>artifactValidators.nativeFileInspection(result));await assert.rejects(inspect(mod,result));});
 test(name+': download keeps exact byte, hash, headers, cancellation and session admission fences',async()=>{
  const out=await inspect(mod,fixture().result);
  for(const headers of [{'content-type':'text/csv'},{'content-disposition':'attachment; filename="wrong.csv"'},{'content-length':'1'},{'cache-control':'public'},{'x-content-type-options':'sniff'},{'content-encoding':'gzip'}])await assert.rejects(mod.receiveDocumentDownload(download(out,headers),out.version),e=>e.code==='DOWNLOAD_HEADERS');
  const wrong=bytes.slice();wrong[0]^=1;await assert.rejects(mod.receiveDocumentDownload(download(out,{},wrong),out.version),e=>e.code==='DOWNLOAD_HASH');
  const abort=new AbortController();abort.abort();await assert.rejects(mod.receiveDocumentDownload(download(out),out.version,{signal:abort.signal}),e=>e.code==='DOWNLOAD_CANCELLED');
  await assert.rejects(mod.receiveDocumentDownload(download(out),out.version,{maxBytes:bytes.length-1}),e=>e.code==='BYTE_LIMIT');
 });
}
