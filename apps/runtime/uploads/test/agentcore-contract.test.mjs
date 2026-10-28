/** The closed inspection wire contract: session identity, purpose derivation, bounds and receipt gates. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {uploadDeclaration,UPLOAD_POLICY_VERSION} from '../../../control/uploads/policy.mjs';
import {uploadInspectionSessionId,uploadInspectionPurpose,uploadInspectionRequest,uploadInspectionResult,uploadInspectionBody,
 UPLOAD_INSPECTION_SESSION_PREFIX,UPLOAD_INSPECTION_ORIGINAL_BYTES,UPLOAD_INSPECTION_BASE64_BYTES,UPLOAD_INSPECTION_WIRE_BYTES,
 UPLOAD_INSPECTION_RESULT_BYTES,UPLOAD_INSPECTION_MAX_DEADLINE_MS,UPLOAD_INSPECTION_PAYLOAD_LIMIT_BYTES} from '../agentcore-contract.mjs';
import {IMAGE_DIGEST,BYTES,DECLARATION,SEGMENT} from './agentcore-fixture.mjs';

const ID='a'.repeat(64);
// Exactly the file the existing receipt gate derives from the same closed declaration.
const scanFile={...uploadDeclaration(DECLARATION),policyVersion:UPLOAD_POLICY_VERSION};
const clean={sourceSha256:DECLARATION.sha256,sourceBytes:DECLARATION.bytes,checkedAtMs:5,status:'clean',
 tool:{name:'clamav',version:'1.5.2',binarySha256:'a'.repeat(64)},definitionsSha256:'b'.repeat(64),reason:null};
const extracted={sourceSha256:DECLARATION.sha256,sourceBytes:DECLARATION.bytes,checkedAtMs:5,status:'available',
 tool:{name:'meri-upload-extractor',version:'3.13.16',binarySha256:'c'.repeat(64)},
 segments:[{...SEGMENT,sourceSha256:DECLARATION.sha256,trust:'external_untrusted'}],limitations:[]};
const request=extra=>({kind:'upload-inspection',requestId:ID,imageDigest:IMAGE_DIGEST,declaration:DECLARATION,
 bytesBase64:BYTES.toString('base64'),inputSha256:DECLARATION.sha256,deadlineMs:60000,...extra});
const result=extra=>({kind:'upload-inspection-result',requestId:ID,file:scanFile,scan:clean,extraction:extracted,...extra});
const window={fromMs:0,toMs:10};

test('the original bound is the existing upload bound plus the exact base64 and one fixed envelope',()=>{
 assert.equal(UPLOAD_INSPECTION_ORIGINAL_BYTES,10*1024*1024);
 assert.equal(UPLOAD_INSPECTION_BASE64_BYTES,Math.ceil(UPLOAD_INSPECTION_ORIGINAL_BYTES/3)*4);
 assert.equal(UPLOAD_INSPECTION_WIRE_BYTES,UPLOAD_INSPECTION_BASE64_BYTES+65536);
 assert.ok(UPLOAD_INSPECTION_RESULT_BYTES<=16*1024*1024);
 assert.equal(UPLOAD_INSPECTION_MAX_DEADLINE_MS,60000);
 assert.equal(UPLOAD_INSPECTION_PAYLOAD_LIMIT_BYTES,100000000);
 assert.ok(UPLOAD_INSPECTION_WIRE_BYTES<UPLOAD_INSPECTION_PAYLOAD_LIMIT_BYTES);
});
test('session identity is server-selected and its prefix is the only purpose source',()=>{
 assert.equal(uploadInspectionSessionId(ID),UPLOAD_INSPECTION_SESSION_PREFIX+ID);
 assert.deepEqual(uploadInspectionPurpose(uploadInspectionSessionId(ID)),{session:UPLOAD_INSPECTION_SESSION_PREFIX+ID,requestId:ID});
 for(const other of ['meri-renderer-'+ID,'sdk-'+ID,'',null,undefined,'meri-inspect-nothex'])assert.equal(uploadInspectionPurpose(other),null);
 for(const bad of ['A'.repeat(64),ID.slice(0,63),''])assert.throws(()=>uploadInspectionSessionId(bad),{code:'UPLOAD_INSPECTION_REQUEST_REFUSED'});
});
test('one closed request binds the declaration to the exact bytes',()=>{
 const {request:closed,bytes}=uploadInspectionRequest(request());
 assert.equal(bytes.toString(),BYTES.toString());
 assert.equal(closed.declaration.sha256,DECLARATION.sha256);
 assert.deepEqual(Object.keys(closed).sort(),['bytesBase64','deadlineMs','declaration','imageDigest','inputSha256','kind','requestId']);
});
test('a request is refused for an unknown key, a wrong kind/identity/image/deadline, or bytes that are not the original',()=>{
 const refused=value=>assert.throws(()=>uploadInspectionRequest(value),{code:'UPLOAD_INSPECTION_REQUEST_REFUSED'});
 for(const extra of [{program:'/bin/sh'},{command:'clamscan'},{image:'other'},{runtimeSessionId:'x'},{tool:'tesseract'},{credential:'x'}])refused(request(extra));
 refused(request({kind:'upload-inspection-other'}));
 refused(request({requestId:'nothex'}));
 refused(request({imageDigest:'sha256:'+'a'.repeat(63)}));
 refused(request({deadlineMs:'60000'}));
 refused(request({deadlineMs:-1}));
 refused(request({inputSha256:'b'.repeat(64)}));
 refused(request({bytesBase64:Buffer.from('other','utf8').toString('base64')}));
 refused(request({bytesBase64:'!!!!'}));
 refused(request({bytesBase64:BYTES.toString('base64').slice(0,-4)}));
 refused(request({bytesBase64:'a'.repeat(UPLOAD_INSPECTION_BASE64_BYTES+1)}));
 refused(request({declaration:{...DECLARATION,bytes:DECLARATION.bytes+1}}));
 refused(request({declaration:{...DECLARATION,sha256:'b'.repeat(64)}}));
 refused(request({declaration:{...DECLARATION,filename:'note.exe'}}));
 assert.throws(()=>uploadInspectionRequest(request({bytesBase64:BYTES.toString('base64'),inputSha256:'c'.repeat(64)})),
  {code:'UPLOAD_INSPECTION_REQUEST_REFUSED'});
});
test('a result is admitted only through the existing receipt gate',()=>{
 const closed=uploadInspectionResult(result(),{requestId:ID,declaration:DECLARATION,imageDigest:IMAGE_DIGEST,...window});
 assert.equal(closed.scan.status,'clean');
 assert.equal(closed.extraction.segments.length,1);
 assert.equal(closed.file.sha256,DECLARATION.sha256);
 const withProvenance=uploadInspectionResult(result({provenance:{expectedImageDigest:IMAGE_DIGEST,imageObserved:false}}),
  {requestId:ID,declaration:DECLARATION,imageDigest:IMAGE_DIGEST,...window});
 assert.equal(withProvenance.requestId,ID);
});
test('an ambiguous, mismatched or over-claiming result is refused rather than reported clean',()=>{
 const refused=value=>assert.throws(()=>uploadInspectionResult(value,{requestId:ID,declaration:DECLARATION,imageDigest:IMAGE_DIGEST,...window}),
  {code:'UPLOAD_INSPECTION_RESULT_REFUSED'});
 refused(result({kind:'upload-inspection-other'}));
 refused(result({requestId:'b'.repeat(64)}));
 refused(result({file:{...scanFile,sha256:'b'.repeat(64)}}));
 refused(result({file:{...scanFile,bytes:scanFile.bytes+1}}));
 refused(result({scan:{...clean,status:'unavailable',tool:null,definitionsSha256:null,reason:null}}));
 refused(result({scan:{...clean,reason:'MALWARE_DETECTED'}}));
 refused(result({scan:{...clean,definitionsSha256:null}}));
 // A non-clean scan can never arrive with extracted segments.
 refused(result({scan:{...clean,status:'infected',reason:'MALWARE_DETECTED'}}));
 refused(result({extraction:{...extracted,segments:[{...SEGMENT}]}}));
 refused(result({extraction:{...extracted,limitations:['EXTRACTOR_UNAVAILABLE']}}));
 refused(result({extraction:{...extracted,status:'partial'}}));
 refused(result({extraction:{...extracted,segments:[{...extracted.segments[0],sourceSha256:'c'.repeat(64)}]}}));
 refused(result({extraction:{...extracted,segments:[{...extracted.segments[0],trust:'trusted'}]}}));
 refused(result({extraction:{...extracted,segments:[{...extracted.segments[0]},{...extracted.segments[0]}]}}));
 refused(result({provenance:{expectedImageDigest:IMAGE_DIGEST,imageObserved:true}}));
 refused(result({provenance:{expectedImageDigest:'sha256:'+'a'.repeat(64),imageObserved:false}}));
 refused(result({provenance:{expectedImageDigest:IMAGE_DIGEST,imageObserved:false,observedAtMs:1}}));
 refused({...result(),extra:true});
 // The observation stamp is re-checked against THIS operation's bounded window.
 assert.throws(()=>uploadInspectionResult(result(),{requestId:ID,declaration:DECLARATION,imageDigest:IMAGE_DIGEST,fromMs:100,toMs:200}),
  {code:'UPLOAD_INSPECTION_RESULT_REFUSED'});
});
test('the result body is the closed receipt plus an explicitly UNOBSERVED expectation',()=>{
 const body=uploadInspectionBody({requestId:ID,imageDigest:IMAGE_DIGEST,value:{file:scanFile,scan:clean,extraction:extracted}});
 assert.equal(body.kind,'upload-inspection-result');
 assert.equal(body.provenance.imageObserved,false);
 assert.equal(body.provenance.expectedImageDigest,IMAGE_DIGEST);
 assert.deepEqual(Object.keys(body).sort(),['extraction','file','kind','provenance','requestId','scan']);
});
