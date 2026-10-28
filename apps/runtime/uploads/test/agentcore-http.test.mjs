/** The inner one-use inspection purpose: honest unavailability, one fixed invocation, and the refusal set. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentCoreApplication} from '../../agentcore-http.mjs';
import {AGENTCORE_SESSION_HEADER} from '../../agentcore-contract.mjs';
import {createUploadInspectionApplication} from '../agentcore-http.mjs';
import {uploadInspectionSessionId} from '../agentcore-contract.mjs';
import {nativeInspection,IMAGE_DIGEST,BYTES,DECLARATION} from './agentcore-fixture.mjs';

const ID='a'.repeat(64),session=uploadInspectionSessionId(ID);
const body=extra=>({kind:'upload-inspection',requestId:ID,imageDigest:IMAGE_DIGEST,declaration:DECLARATION,
 bytesBase64:BYTES.toString('base64'),inputSha256:DECLARATION.sha256,deadlineMs:Date.now()+10000,...extra});
const invoke=(app,value=body(),headers={})=>app.handle(new Request('http://runtime.invalid/invocations',
 {method:'POST',headers:{'content-type':'application/json',[AGENTCORE_SESSION_HEADER]:session,...headers},
  body:typeof value==='string'?value:JSON.stringify(value)}));

test('the purpose is present but honestly unavailable without a declared digest or an attested host',async()=>{
 for(const configuration of [{},{imageDigest:IMAGE_DIGEST},{inspection:nativeInspection()},{imageDigest:'not-a-digest',inspection:nativeInspection()}]){
  const app=createUploadInspectionApplication(configuration);
  const response=await invoke(app);
  assert.equal(response.status,503);
  assert.deepEqual(await response.json(),{error:{code:'UPLOAD_INSPECTION_UNAVAILABLE'}});
  assert.equal((await app.handle(new Request('http://runtime.invalid/ping'))).status,200);
  await app.close({deadlineMs:Date.now()+1000});
 }
});
test('one fixed invocation returns the closed receipt and the purpose is used exactly once',async()=>{
 let calls=0;
 const inspection={async inspect(declaration,bytes){calls++;assert.equal(declaration.sha256,DECLARATION.sha256);assert.equal(bytes.toString(),BYTES.toString());
  const accepted=await nativeInspection().inspect(declaration,bytes,{deadlineMs:Date.now()+5000});return accepted;}};
 const app=createUploadInspectionApplication({imageDigest:IMAGE_DIGEST,inspection});
 const response=await invoke(app);
 assert.equal(response.status,200);
 const value=await response.json();
 assert.equal(value.kind,'upload-inspection-result');
 assert.equal(value.requestId,ID);
 assert.equal(value.scan.status,'clean');
 assert.equal(value.extraction.status,'available');
 assert.equal(value.extraction.segments.length,1);
 assert.equal(value.provenance.imageObserved,false);
 assert.equal(value.provenance.expectedImageDigest,IMAGE_DIGEST);
 assert.equal(calls,1);
 assert.equal((await invoke(app)).status,409);
 assert.equal(calls,1);
 const closed=await app.close({deadlineMs:Date.now()+1000});
 assert.equal(closed.settled,true);
});
test('a request can never name a program, tool, image or session, and is refused before any invocation',async()=>{
 let calls=0;
 const app=createUploadInspectionApplication({imageDigest:IMAGE_DIGEST,
  inspection:{async inspect(){calls++;return nativeInspection().inspect(DECLARATION,BYTES,{deadlineMs:Date.now()+5000});}}});
 const refused=[body({program:'/bin/sh'}),body({command:'clamscan'}),body({tool:'tesseract'}),body({image:'other'}),
  body({runtimeSessionId:'chosen'}),body({requestId:'nothex'}),body({imageDigest:'sha256:'+'a'.repeat(64)}),
  body({deadlineMs:Date.now()-1}),body({deadlineMs:Date.now()+120000}),body({inputSha256:'b'.repeat(64)}),
  body({bytesBase64:Buffer.from('other').toString('base64')}),body({bytesBase64:'!!!!'})];
 for(const value of refused){
  const response=await invoke(app,value);
  assert.equal(response.status,400,JSON.stringify(value).slice(0,80));
  assert.deepEqual(await response.json(),{error:{code:'UPLOAD_INSPECTION_REQUEST_REFUSED'}});
 }
 // A different server-selected session, a body that is not JSON and a wrong content type are refused too.
 assert.equal((await invoke(app,body(),{[AGENTCORE_SESSION_HEADER]:uploadInspectionSessionId('b'.repeat(64))})).status,400);
 assert.equal((await invoke(app,body(),{[AGENTCORE_SESSION_HEADER]:'meri-renderer-'+ID})).status,400);
 assert.equal((await invoke(app,'{not json')).status,400);
 assert.equal((await app.handle(new Request('http://runtime.invalid/invocations',{method:'POST',
  headers:{'content-type':'text/plain',[AGENTCORE_SESSION_HEADER]:session},body:JSON.stringify(body())}))).status,400);
 assert.equal((await app.handle(new Request('http://runtime.invalid/other',{method:'POST'}))).status,400);
 assert.equal((await app.handle(new Request('http://runtime.invalid/ping',{method:'POST'}))).status,405);
 assert.equal(calls,0);
 await app.close({deadlineMs:Date.now()+1000});
});
test('an unattested or failing fixed owner never becomes clean or extracted',async()=>{
 // No port composed at all: the purpose is honestly unavailable, and readiness still reports the container itself so
 // the SDK purpose is not disabled by this purpose's missing host.
 const bare=createUploadInspectionApplication({imageDigest:IMAGE_DIGEST,inspection:null});
 assert.equal((await invoke(bare)).status,503);
 assert.equal((await bare.handle(new Request('http://runtime.invalid/ping'))).status,200);
 await bare.close({deadlineMs:Date.now()+1000});
 // A fixed owner that fails poisons the one-use environment: no receipts are ever emitted, the purpose reports
 // unhealthy, and a second invocation cannot reuse the consumed session.
 const failing=createUploadInspectionApplication({imageDigest:IMAGE_DIGEST,
  inspection:{async inspect(){throw Object.assign(Error('synthetic child failure'),{code:'SCANNER_UNAVAILABLE'});}}});
 const response=await invoke(failing);
 assert.equal(response.status,503);
 assert.equal(Object.hasOwn(await response.json(),'scan'),false);
 assert.equal((await failing.handle(new Request('http://runtime.invalid/ping'))).status,503);
 assert.equal((await invoke(failing)).status,409);
 await failing.close({deadlineMs:Date.now()+1000});
});
test('a scan that could not fully examine the content returns unavailable receipts, never clean ones',async()=>{
 const app=createUploadInspectionApplication({imageDigest:IMAGE_DIGEST,inspection:nativeInspection({status:'unavailable'})});
 const response=await invoke(app);
 assert.equal(response.status,200);
 const value=await response.json();
 assert.equal(value.scan.status,'unavailable');
 assert.equal(value.scan.tool,null);
 assert.equal(value.scan.reason,'UPLOAD_DEFINITIONS_UNAVAILABLE');
 assert.equal(value.extraction.segments.length,0);
 assert.deepEqual(value.extraction.limitations,['SCAN_UNAVAILABLE']);
 await app.close({deadlineMs:Date.now()+1000});
});
test('the purpose lock latches the selected purpose and refuses a different one afterwards',async()=>{
 const locked=createAgentCoreApplication({execute:()=>assert.fail('the inspection purpose must never reach the SDK execution'),
  inspection:createUploadInspectionApplication({imageDigest:IMAGE_DIGEST,inspection:nativeInspection()})});
 assert.equal((await invoke(locked)).status,200);
 const sdk=await locked.handle(new Request('http://runtime.invalid/invocations',{method:'POST',
  headers:{'content-type':'application/json',[AGENTCORE_SESSION_HEADER]:'sdk-session-'+'b'.repeat(40)},body:'{}'}));
 assert.equal(sdk.status,403);
 assert.deepEqual(await sdk.json(),{error:{code:'SESSION_REFUSED'}});
 assert.equal((await locked.handle(new Request('http://runtime.invalid/ping'))).status,200);
 assert.equal((await locked.close({deadlineMs:Date.now()+1000})).settled,true);
});
test('an unconfigured purpose is honestly unavailable and is never served by another purpose',async()=>{
 const call=session=>new Request('http://runtime.invalid/invocations',{method:'POST',
  headers:{'content-type':'application/json',[AGENTCORE_SESSION_HEADER]:session},body:JSON.stringify(body())});
 const bare=createAgentCoreApplication({execute:()=>assert.fail('no SDK execution')});
 assert.equal((await bare.handle(call(session))).status,503);
 assert.equal((await bare.handle(call('meri-renderer-'+ID))).status,503);
 assert.equal((await bare.close({deadlineMs:Date.now()+1000})).settled,true);
});
