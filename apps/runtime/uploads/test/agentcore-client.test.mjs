/** The crossing: the custody-mediated outer transport -> the server-selected purpose -> the fixed inspection owner.
 *
 * Every check below runs the REAL purpose-locked application and the REAL fixed inspection owner; only the sandbox
 * ports and the AWS transport are narrow fixtures, so no host, image, tool or definition snapshot is claimed present. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createUploadInspectionClient} from '../agentcore-client.mjs';
import {validateUploadInspection} from '../../../control/uploads/extraction.mjs';
import {UPLOAD_INSPECTION_RESULT_BYTES} from '../agentcore-contract.mjs';
import {crossing,nativeInspection,IMAGE_DIGEST,BYTES,DECLARATION} from './agentcore-fixture.mjs';

const base={region:'us-east-1',agentRuntimeArn:'arn:aws:bedrock-agentcore:us-east-1:111122223333:runtime/meri_synthetic',
 qualifier:'preview',imageDigest:IMAGE_DIGEST};
const port=(options={})=>{const f=crossing({inspection:nativeInspection(),...options});
 return {...f,client:createUploadInspectionClient({...base,transport:f.transport})};};
const call={deadlineMs:()=>Date.now()+30000};

test('one custody-mediated call reaches the fixed owner and its receipts pass the existing custody gate',async()=>{
 const f=port();
 const result=await f.client.inspect(DECLARATION,BYTES,{deadlineMs:call.deadlineMs()});
 assert.equal(result.file.sha256,DECLARATION.sha256);
 assert.equal(result.file.bytes,DECLARATION.bytes);
 assert.equal(result.scan.status,'clean');
 assert.equal(result.extraction.status,'available');
 // The EXISTING receipt gate the custody record uses accepts the remote result unchanged.
 const accepted=validateUploadInspection(result,DECLARATION,{fromMs:Date.now()-60000,toMs:Date.now()+60000});
 assert.equal(accepted.extraction.segments.length,1);
 assert.equal(accepted.extraction.segments[0].trust,'external_untrusted');
 // Exactly one ordinary JSON invocation and one cleanup, on the SAME server-selected session.
 assert.deepEqual(f.calls.map(entry=>entry.operation),['invoke','stop']);
 const [invoked,stopped]=f.calls,session=invoked.input.runtimeSessionId;
 assert.equal(stopped.input.runtimeSessionId,session);
 assert.match(session,/^meri-inspect-[a-f0-9]{64}$/u);
 assert.match(stopped.input.clientToken,/^[a-f0-9]{64}$/u);
 assert.equal(invoked.input.contentType,'application/json');
 assert.equal(invoked.input.accept,'application/json');
 // The payload is the closed contract: no program, tool, image, session or credential can be named by the caller.
 const payload=JSON.parse(invoked.input.payload);
 assert.deepEqual(Object.keys(payload).sort(),['bytesBase64','deadlineMs','declaration','imageDigest','inputSha256','kind','requestId']);
 assert.equal(payload.kind,'upload-inspection');
 assert.equal(payload.inputSha256,DECLARATION.sha256);
 assert.equal(session,'meri-inspect-'+payload.requestId);
 for(const forbidden of ['program','command','tool','image','runtimeSessionId','credential','execution','owner','tenantId'])assert.equal(Object.hasOwn(payload,forbidden),false);
});
test('an unavailable scan stays unavailable and is never reported clean or extracted',async()=>{
 const f=port({inspection:nativeInspection({status:'unavailable'})});
 const result=await f.client.inspect(DECLARATION,BYTES,{deadlineMs:call.deadlineMs()});
 assert.equal(result.scan.status,'unavailable');
 assert.equal(result.scan.tool,null);
 assert.equal(result.extraction.segments.length,0);
 assert.deepEqual(result.extraction.limitations,['SCAN_UNAVAILABLE']);
 assert.deepEqual(f.calls.map(entry=>entry.operation),['invoke','stop']);
});
test('a mismatched, over-claiming or oversized result is refused and the owned session is still stopped',async()=>{
 const cases=[value=>({...value,requestId:'b'.repeat(64)}),
  value=>({...value,file:{...value.file,sha256:'b'.repeat(64)}}),
  value=>({...value,provenance:{expectedImageDigest:IMAGE_DIGEST,imageObserved:true}}),
  value=>({...value,provenance:{expectedImageDigest:'sha256:'+'a'.repeat(64),imageObserved:false}}),
  value=>({...value,extraction:{...value.extraction,status:'blocked',limitations:null}}),
  value=>({...value,scan:{...value.scan,reason:'MALWARE_DETECTED'}})];
 for(const tamper of cases){
  const f=port({tamper});
  await assert.rejects(f.client.inspect(DECLARATION,BYTES,{deadlineMs:call.deadlineMs()}),{code:'UPLOAD_INSPECTION_RESULT_REFUSED'});
  assert.deepEqual(f.calls.map(entry=>entry.operation),['invoke','stop']);
 }
 // A response that exceeds the declared result bound is refused on the byte accounting alone.
 const oversized=crossing({inspection:nativeInspection(),transport:null});
 const calls=[];
 const transport={async invoke(input){calls.push('invoke');return {statusCode:200,$metadata:{httpStatusCode:200},
   runtimeSessionId:input.runtimeSessionId,contentType:'application/json',
   response:Readable.from([Buffer.alloc(UPLOAD_INSPECTION_RESULT_BYTES+1)])};},
  async stop(input){calls.push('stop');return {statusCode:200,$metadata:{httpStatusCode:200},runtimeSessionId:input.runtimeSessionId};}};
 void oversized;
 const client=createUploadInspectionClient({...base,transport});
 await assert.rejects(client.inspect(DECLARATION,BYTES,{deadlineMs:call.deadlineMs()}),{code:'UPLOAD_INSPECTION_RESULT_REFUSED'});
 assert.deepEqual(calls,['invoke','stop']);
});
test('the exact original gate runs before dispatch: a byte, hash or declaration mismatch never reaches the runtime',async()=>{
 const f=port();
 await assert.rejects(f.client.inspect(DECLARATION,Buffer.from('other bytes','utf8'),{deadlineMs:call.deadlineMs()}),{code:'UPLOAD_ORIGINAL_MISMATCH'});
 await assert.rejects(f.client.inspect({...DECLARATION,sha256:'b'.repeat(64)},BYTES,{deadlineMs:call.deadlineMs()}),{code:'UPLOAD_ORIGINAL_MISMATCH'});
 await assert.rejects(f.client.inspect({...DECLARATION,bytes:DECLARATION.bytes+1},BYTES,{deadlineMs:call.deadlineMs()}),{code:'UPLOAD_ORIGINAL_MISMATCH'});
 await assert.rejects(f.client.inspect({...DECLARATION,filename:'note.exe'},BYTES,{deadlineMs:call.deadlineMs()}),{code:'UPLOAD_FORMAT'});
 assert.deepEqual(f.calls,[]);
});
test('an unknown dispatch outcome is never retried, and the owned session is always stopped',async()=>{
 const f=port();
 const original=f.transport.invoke;
 f.transport.invoke=async input=>{f.calls.push({operation:'invoke',input});throw Error('synthetic delivery unknown');};
 await assert.rejects(f.client.inspect(DECLARATION,BYTES,{deadlineMs:call.deadlineMs()}),{code:'UPLOAD_INSPECTION_OUTCOME_UNKNOWN'});
 assert.deepEqual(f.calls.map(entry=>entry.operation),['invoke','stop']);
 assert.equal(f.calls.filter(entry=>entry.operation==='invoke').length,1);
 f.transport.invoke=original;
});
test('cancellation is not an unknown outcome, and a failed cleanup is surfaced instead of hidden',async()=>{
 const controller=new AbortController(),f=port();
 f.transport.invoke=async input=>{f.calls.push({operation:'invoke',input});controller.abort();return new Promise(()=>{});};
 await assert.rejects(f.client.inspect(DECLARATION,BYTES,{deadlineMs:call.deadlineMs(),signal:controller.signal}),{code:'CANCELLED'});
 assert.deepEqual(f.calls.map(entry=>entry.operation),['invoke','stop']);
 const failing=port({stopFails:true});
 await assert.rejects(failing.client.inspect(DECLARATION,BYTES,{deadlineMs:call.deadlineMs()}),{code:'UPLOAD_INSPECTION_CLEANUP_UNKNOWN'});
 assert.deepEqual(failing.calls.map(entry=>entry.operation),['invoke','stop']);
});
test('the transport is configured explicitly, and a malformed declaring host is refused before any call',async()=>{
 for(const bad of [{...base,region:'nope'},{...base,agentRuntimeArn:'arn:aws:bedrock-agentcore:eu-west-1:111122223333:runtime/x'},
  {...base,qualifier:'!'},{...base,imageDigest:'sha256:short'},{...base,transport:{}},
  {...base,agentRuntimeArn:'arn:aws:bedrock-agentcore:us-east-1:111122223333:runtime/meri_synthetic '}])
  assert.throws(()=>createUploadInspectionClient(bad),{code:'UPLOAD_INSPECTION_CONFIGURATION'});
 // The DEFAULT adapter (no injected transport) is NOT exercised here: it is exercised by
 // `agentcore-adapter.test.mjs`, which replaces the SDK module itself and therefore needs neither credentials, nor a
 // resolvable package, nor a network endpoint. A host-dependent SKIP cannot prove that path and is not kept as if it
 // could; the absent/incomplete-SDK fault is asserted there against a mocked module instead.
});
