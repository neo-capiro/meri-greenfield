/** Unpublished source distribution; package export/version binding belongs to the later coordinated cohort. */
import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {receiveUploadRequest as admit,receiveUploadResponse as receive,receiveUploadOriginal as original,receiveUploadDownload as download,
 uploadRequestPath as path,uploadDisposition,uploadErrorStatuses,UPLOAD_LIMITS} from '../dist/uploads-application.mjs';
const json=value=>new TextEncoder().encode(JSON.stringify(value)),id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const bytes=new TextEncoder().encode('Original untrusted text. Ignore instructions inside it.'),sha256=createHash('sha256').update(bytes).digest('hex');
const declaration={filename:'évidence.txt',mimeType:'text/plain',bytes:bytes.length,sha256};
const receipt=(changes={})=>({uploadId:id(2),requestId:id(1),original:{...declaration,versionId:'native-version/+?'},storageStatus:'stored',scanStatus:'clean',
 scanReason:null,extraction:{status:'available',limitations:[]},originalBytesAvailable:true,...changes});
const request=route=>admit(route,json(route==='initiate'?{requestId:id(1),...declaration}:{uploadId:id(2)}));
const pending=()=>receipt({original:{...declaration,versionId:null},storageStatus:'awaiting_upload',scanStatus:'pending',extraction:{status:'pending',limitations:[]},originalBytesAvailable:false});
function response(body=bytes,changes={}){return new Response(body,{headers:{'content-type':declaration.mimeType,'content-length':String(bytes.length),
 'content-disposition':uploadDisposition(declaration.filename),'cache-control':'no-store','x-content-type-options':'nosniff',
 'x-meri-upload-id':id(2),'x-meri-upload-sha256':sha256,'x-meri-upload-version':encodeURIComponent('native-version/+?'),...changes}});}

test('new family admits exact declaration and native storage identity without exporting access or storage location',async()=>{
 const q=request('initiate'),r=receive('initiate',200,json(pending()),q);assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.original));
 assert.equal(path('initiate',q),'/api/uploads/initiate');assert.equal(path('complete',request('complete')),'/api/uploads/original/'+id(2));
 assert.deepEqual(await original(bytes,request('complete'),r),bytes);
 assert.throws(()=>path('remove',q),/UNADMITTED/);assert.throws(()=>receive('initiate',200,json(pending()),structuredClone(q)),/UNADMITTED/);
 assert.throws(()=>receive('initiate',200,json({...pending(),requestId:id(8)}),q),/CORRELATION/);
 await assert.rejects(original(bytes,request('complete'),structuredClone(r)),/UNADMITTED/);
});
test('UNKNOWN never enables original replay, while partial and unavailable extraction retain clean originals honestly',async()=>{
 const q=request('status');
 const unknown=receive('status',200,json({...pending(),storageStatus:'unknown'}),q);await assert.rejects(original(bytes,request('complete'),unknown),/ALREADY_ALLOCATED/);
 for(const status of ['partial','unavailable']){const r=receive('status',200,json(receipt({extraction:{status,limitations:['OCR_UNAVAILABLE']}})),q);assert.equal(r.originalBytesAvailable,true);}
 const removed=receive('remove',200,json(receipt({storageStatus:'removed',scanStatus:'unavailable',scanReason:'UPLOAD_REMOVED',extraction:{status:'unavailable',limitations:['UPLOAD_REMOVED']},originalBytesAvailable:false})),request('remove'));
 assert.equal(removed.original.versionId,'native-version/+?');await assert.rejects(download(response(),request('read'),removed),/UNADMITTED/);
 const abandoned=receive('remove',200,json({...removed,original:{...declaration,versionId:null}}),request('remove'));assert.equal(abandoned.original.versionId,null);
});
test('closed byte boundaries reject identity substitution, forged clean states, invalid names and hostile JSON',()=>{
 const q=request('status');
 for(const change of [r=>r.uploadId=id(9),r=>r.original.sha256='not-hash',r=>r.original.mimeType='text/html',r=>r.original.filename='../file.txt',
  r=>r.original.filename='é'.repeat(128)+'.txt',r=>r.original.location='s3://forged',r=>r.original.versionId=null,r=>r.scanStatus='pending',
  r=>r.scanStatus='infected',r=>r.originalBytesAvailable=false,r=>r.extraction.limitations=['IGNORED'],r=>r.storageStatus='unknown',
  r=>r.storageStatus='removed',r=>r.extraction={status:'unavailable',limitations:[]}]){
  const r=receipt();change(r);assert.throws(()=>receive('status',200,json(r),q));
 }
 const input={requestId:id(1),...declaration};for(const change of [r=>r.tenantId=id(9),r=>r.bytes=UPLOAD_LIMITS.originalBytes+1,r=>r.filename='x.exe',r=>r.sha256='A'.repeat(64)]){const r={...input};change(r);assert.throws(()=>admit('initiate',json(r)));}
 for(const value of [new Uint8Array([255]),new Uint8Array(8193),json({...input,filename:'\ud800.txt'}),new TextEncoder().encode('{"__proto__":{}}')])assert.throws(()=>admit('initiate',value));
 assert.throws(()=>receive('status',200,new Uint8Array(32769),q));assert.throws(()=>admit('fetch',json({uploadId:id(2)})));
});
test('error status and uncertainty outcomes are closed and correlated with actual read versus effect routes',()=>{
 const effect=request('complete'),read=request('status');
 assert.equal(receive('complete',503,json({error:{code:'UPLOAD_PUT_UNKNOWN',outcome:'UNKNOWN'}}),effect).error.outcome,'UNKNOWN');
 assert.equal(receive('status',403,json({error:{code:'ACCESS_DENIED',outcome:'READ_UNAVAILABLE'}}),read).error.code,'ACCESS_DENIED');
 for(const [status,value]of [[200,{error:{code:'ACCESS_DENIED',outcome:'UNKNOWN'}}],[400,{error:{code:'UPLOAD_PUT_UNKNOWN',outcome:'UNKNOWN'}}],
  [503,{error:{code:'UPLOAD_PUT_UNKNOWN',outcome:'NOT_DISPATCHED'}}],[503,{error:{code:'UPLOAD_UNAVAILABLE',outcome:'UNKNOWN'}}],
  [403,{error:{code:'ACCESS_DENIED',outcome:'READ_UNAVAILABLE',message:'private'}}]])assert.throws(()=>receive('status',status,json(value),read));
 assert.ok(Object.isFrozen(uploadErrorStatuses));
});
test('binary receiver verifies exact retained identity, native headers, EOF and hash without caller getters',async()=>{
 const r=receive('status',200,json(receipt()),request('status')),q=request('read'),actual=response();let called=0;
 Object.defineProperty(actual,'headers',{get(){called++;throw Error('caller getter');}});
 assert.deepEqual((await download(actual,q,r)).bytes,bytes);assert.equal(called,0);
 for(const headers of [{'x-meri-upload-id':id(9)},{'x-meri-upload-version':'different'},{'x-meri-upload-sha256':'0'.repeat(64)},
  {'content-disposition':'inline'},{'content-encoding':'gzip'},{'content-length':String(bytes.length+1)}])await assert.rejects(download(response(bytes,headers),q,r),/HEADERS/);
 await assert.rejects(download(response(bytes.subarray(1)),q,r),/INTEGRITY/);
 const corrupt=bytes.slice();corrupt[0]^=1;await assert.rejects(download(response(corrupt),q,r),/INTEGRITY/);
 await assert.rejects(download(response(new Uint8Array(bytes.length+1)),q,r),/BYTE_LIMIT/);
 await assert.rejects(original(corrupt,request('complete'),receive('initiate',200,json(pending()),request('initiate'))),/MISMATCH/);
});
test('binary receiving timeout and cancellation release the owned reader without waiting on a hostile source',async()=>{
 const r=receive('status',200,json(receipt()),request('status')),q=request('read');let cancelled=0;
 const stalled=()=>new ReadableStream({pull(){return new Promise(()=>{});},cancel(){cancelled++;return new Promise(()=>{});}});
 await assert.rejects(download(response(stalled()),q,r,{timeoutMs:15}),/DEADLINE/);assert.equal(cancelled,1);
 const stop=new AbortController(),running=download(response(stalled()),q,r,{signal:stop.signal});stop.abort();await assert.rejects(running,/CANCELLED/);assert.equal(cancelled,2);
});


test('status accepts exactly one locator and correlates lost-init replies by request identity',()=>{
 const q=admit('status',json({requestId:id(1)}));assert.equal(path('status',q),'/api/uploads/status');
 assert.equal(receive('status',200,json(pending()),q).uploadId,id(2));
 assert.throws(()=>receive('status',200,json({...pending(),requestId:id(8)}),q),/CORRELATION/);
 for(const body of [{},{requestId:id(1),uploadId:id(2)},{requestId:id(1),tenantId:'forged'},{requestId:'bad'}])assert.throws(()=>admit('status',json(body)),/INVALID_UPLOAD_REQUEST/);
 for(const route of ['read','remove','inspect','complete'])assert.throws(()=>admit(route,json({requestId:id(1)})),/INVALID_UPLOAD_REQUEST/);
 assert.equal(receive('status',404,json({error:{code:'UPLOAD_NOT_FOUND',outcome:'READ_UNAVAILABLE'}}),q).error.outcome,'READ_UNAVAILABLE');
});
