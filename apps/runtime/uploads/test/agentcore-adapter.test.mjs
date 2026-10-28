/** The DEFAULT adapter path: the real `sdkTransport` over a REPLACED SDK module.
 *
 * Run this file with `--experimental-test-module-mocks`. The module mock is the safety boundary, not a convenience:
 * without it the production adapter would build a real client and address a real endpoint, so every check below
 * asserts the replacement took effect BEFORE it can dispatch, and refuses to continue if it did not. Nothing here
 * reads the host credential chain, resolves a live region, or issues any AWS request -- the mocked client is this
 * file's only `send`, and the "runtime" behind it is the REAL purpose-locked application, driven through the real
 * contract, so the invoke/stop/cleanup accounting is genuine even though no cloud call can happen.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mock} from 'node:test';
import {Readable} from 'node:stream';
import {createUploadInspectionClient,requireUploadInspectionSdk} from '../agentcore-client.mjs';
import {createAgentCoreApplication} from '../../agentcore-http.mjs';
import {AGENTCORE_SESSION_HEADER} from '../../agentcore-contract.mjs';
import {createUploadInspectionApplication} from '../agentcore-http.mjs';
import {UPLOAD_INSPECTION_SESSION_PREFIX,UPLOAD_INSPECTION_WIRE_BYTES} from '../agentcore-contract.mjs';
import {nativeInspection,IMAGE_DIGEST,BYTES,DECLARATION} from './agentcore-fixture.mjs';

const SDK='@aws-sdk/client-bedrock-agentcore';
/** A documentation-placeholder account, so this ARN names a runtime no account owns. It is a fixture either way: the
 * mocked client below is what keeps every check in this file away from the network. */
const RUNTIME='arn:aws:bedrock-agentcore:us-east-1:111122223333:runtime/meri_synthetic';
const base={region:'us-east-1',agentRuntimeArn:RUNTIME,qualifier:'preview',imageDigest:IMAGE_DIGEST};
const sent=[];let reply=async()=>{throw Error('no synthetic reply was programmed');};
class FakeClient{
 constructor(options){this.options=options;this.destroyed=false;sent.push({operation:'client',options,client:this});}
 async send(command,options){sent.push({operation:'send',name:command.constructor.name,input:command.input,options});
  return reply({command,options});}
 destroy(){this.destroyed=true;}
}
class Command{constructor(input){this.input=input;}}
class InvokeAgentRuntimeCommand extends Command{}
class StopRuntimeSessionCommand extends Command{}
const supported=typeof mock.module==='function';
if(supported)mock.module(SDK,{namedExports:{BedrockAgentCoreClient:FakeClient,InvokeAgentRuntimeCommand,StopRuntimeSessionCommand}});
/** The mock, or no test at all: an un-mocked module would send a real request, so this fails rather than proceeds. */
async function mocked(){
 assert.equal(supported,true,'run this file with --experimental-test-module-mocks');
 const sdk=await import(SDK);
 assert.equal(sdk.BedrockAgentCoreClient,FakeClient,'the SDK module was NOT replaced; nothing dispatches without it');
 assert.equal(sdk.InvokeAgentRuntimeCommand,InvokeAgentRuntimeCommand);
 assert.equal(sdk.StopRuntimeSessionCommand,StopRuntimeSessionCommand);
}
const dispatched=()=>sent.filter(entry=>entry.operation==='send');
const names=()=>dispatched().map(entry=>entry.name);
/** Route the mocked invoke into the REAL purpose-locked application over a narrow fixture inspection owner, exactly
 * as the platform would route it. `onInvoke`/`onStop` replace the synthetic behaviour per check. */
function harness({inspection=nativeInspection(),imageDigest=IMAGE_DIGEST,onInvoke,onStop}={}){
 const apps=new Map();
 const application=session=>{
  let app=apps.get(session);
  if(!app){
   app=createAgentCoreApplication({execute:()=>assert.fail('the inspection purpose must never reach SDK execution'),
    inspection:createUploadInspectionApplication({imageDigest,inspection})});
   apps.set(session,app);
  }
  return app;
 };
 const ack=input=>({statusCode:200,$metadata:{httpStatusCode:200},runtimeSessionId:input.runtimeSessionId});
 reply=async({command})=>{
  const name=command.constructor.name;
  if(name==='StopRuntimeSessionCommand')return onStop?onStop(command):ack(command.input);
  if(name!=='InvokeAgentRuntimeCommand')throw Error('unexpected command '+name);
  if(onInvoke)return onInvoke(command);
  const response=await application(command.input.runtimeSessionId).handle(new Request('http://runtime.invalid/invocations',
   {method:'POST',headers:{'content-type':'application/json',[AGENTCORE_SESSION_HEADER]:command.input.runtimeSessionId},
    body:command.input.payload}));
  return {...ack(command.input),contentType:'application/json',
   response:Readable.from([Buffer.from(JSON.stringify(await response.json()))])};
 };
 return {apps};
}
const reset=()=>{sent.length=0;reply=async()=>{throw Error('no synthetic reply was programmed');};};
const deadline=()=>Date.now()+30000;

test('the default adapter resolves the SDK once, and the mocked module is what it gets',async()=>{
 await mocked();
});

test('the real adapter invokes once and stops the SAME owned session, with the client it created',async()=>{
 await mocked();reset();harness();
 const client=createUploadInspectionClient({...base});
 const result=await client.inspect(DECLARATION,BYTES,{deadlineMs:deadline()});
 assert.equal(result.file.sha256,DECLARATION.sha256);
 assert.equal(result.scan.status,'clean');
 assert.equal(result.extraction.status,'available');
 assert.equal(result.extraction.segments.length,1);
 assert.deepEqual(names(),['InvokeAgentRuntimeCommand','StopRuntimeSessionCommand'],'exactly one call and one cleanup');
 const [invoked,stopped]=dispatched();
 const payload=JSON.parse(invoked.input.payload),instance=sent.find(entry=>entry.operation==='client').client;
 assert.equal(instance.options.maxAttempts,1,'the standard adapter never retries an ambiguous dispatch');
 assert.equal(instance.options.region,'us-east-1');
 assert.match(invoked.input.runtimeSessionId,/^meri-inspect-[a-f0-9]{64}$/u);
 assert.equal(invoked.input.runtimeSessionId,'meri-inspect-'+payload.requestId);
 assert.equal(stopped.input.runtimeSessionId,invoked.input.runtimeSessionId,'the owned session is the one that is stopped');
 assert.equal(stopped.input.clientToken,payload.requestId);
 assert.equal(invoked.input.agentRuntimeArn,RUNTIME);
 assert.equal(invoked.input.qualifier,'preview');
 assert.equal(Buffer.from(payload.bytesBase64,'base64').equals(BYTES),true,'the exact original bytes are what is sent');
 assert.equal(instance.destroyed,false);
 client.close();
 await new Promise(setImmediate);
 assert.equal(instance.destroyed,true,'close() destroys only a client this module created');
});

test('an ambiguous dispatch is never retried and the owned session is still stopped',async()=>{
 await mocked();reset();harness({onInvoke:async()=>{throw Error('synthetic delivery unknown');}});
 const client=createUploadInspectionClient({...base});
 await assert.rejects(client.inspect(DECLARATION,BYTES,{deadlineMs:deadline()}),{code:'UPLOAD_INSPECTION_OUTCOME_UNKNOWN'});
 assert.deepEqual(names(),['InvokeAgentRuntimeCommand','StopRuntimeSessionCommand']);
 assert.equal(dispatched().filter(entry=>entry.name==='InvokeAgentRuntimeCommand').length,1,'no replay');
 client.close();
});

test('cancellation is not an unknown outcome, and the session is still stopped',async()=>{
 await mocked();reset();harness();
 const controller=new AbortController();
 const client=createUploadInspectionClient({...base});
 reply=async({command})=>{
  if(command.constructor.name==='InvokeAgentRuntimeCommand'){controller.abort();return new Promise(()=>{});}
  return {statusCode:200,$metadata:{httpStatusCode:200},runtimeSessionId:command.input.runtimeSessionId};
 };
 await assert.rejects(client.inspect(DECLARATION,BYTES,{deadlineMs:deadline(),signal:controller.signal}),{code:'CANCELLED'});
 assert.deepEqual(names(),['InvokeAgentRuntimeCommand','StopRuntimeSessionCommand']);
 client.close();
});

test('a cleanup that cannot be confirmed is surfaced, and one that throws is surfaced the same way',async()=>{
 await mocked();reset();harness({onStop:input=>({statusCode:500,$metadata:{httpStatusCode:500},runtimeSessionId:input.runtimeSessionId})});
 const refused=createUploadInspectionClient({...base});
 await assert.rejects(refused.inspect(DECLARATION,BYTES,{deadlineMs:deadline()}),{code:'UPLOAD_INSPECTION_CLEANUP_UNKNOWN'});
 assert.deepEqual(names(),['InvokeAgentRuntimeCommand','StopRuntimeSessionCommand']);
 refused.close();
 reset();harness({onStop:async()=>{throw Error('synthetic stop failure');}});
 const throwing=createUploadInspectionClient({...base});
 await assert.rejects(throwing.inspect(DECLARATION,BYTES,{deadlineMs:deadline()}),{code:'UPLOAD_INSPECTION_CLEANUP_UNKNOWN'});
 throwing.close();
});

test('an absent or incomplete SDK is the same honest transport fault, never a TypeError',()=>{
 // The trace is reset FIRST so this case proves its OWN property: the guard dispatches nothing at all, whether it
 // runs standalone or after the working-path checks above. Inheriting their calls proved nothing about the guard.
 reset();
 // The namespaces are asserted DIRECTLY rather than by replacing the specifier a second time. A replacement is not
 // provably effective for the module under test's own resolution, and if it silently were not, the real adapter
 // would address a real endpoint with this process's own credentials -- so the guard is exercised on plain objects
 // here, where no import and no `send` exists at all, and the mocked COMPLETE module above is what proves the
 // working path. A package that is missing entirely takes the same branch: the import rejects, the caller maps it to
 // this same fault, and no client object is ever constructed.
 for(const absent of [undefined,null,{},{BedrockAgentCoreClient:()=>{}},
  {BedrockAgentCoreClient:FakeClient,InvokeAgentRuntimeCommand:InvokeAgentRuntimeCommand},
  {BedrockAgentCoreClient:FakeClient,StopRuntimeSessionCommand:StopRuntimeSessionCommand}])
  assert.throws(()=>requireUploadInspectionSdk(absent),{code:'UPLOAD_INSPECTION_TRANSPORT_UNAVAILABLE'});
 const complete={BedrockAgentCoreClient:FakeClient,InvokeAgentRuntimeCommand,StopRuntimeSessionCommand};
 assert.equal(requireUploadInspectionSdk(complete),complete);
 assert.equal(dispatched().filter(entry=>entry.name==='InvokeAgentRuntimeCommand').length,0,
  'the guard itself dispatches nothing, standalone or in sequence');
});

/** OPEN-4 witness: the REAL listener's own bound on an upload body, applied before it buffers or parses anything.
 *
 * `UPLOAD_INSPECTION_WIRE_BYTES` is enforced inside the shared `jsonBody` owner this listener reads through
 * (apps/control/action-application/http.mjs:20-29, called at uploads/agentcore-http.mjs:52-53): a declared length
 * over the cap is refused from the header alone, and a length-less body is refused as soon as the running byte count
 * crosses the cap -- with the reader cancelled and released rather than drained. Both are driven over the mocked SDK,
 * so "nothing dispatched" is observed here rather than assumed, and no ambient request can be issued by this file. */
test('the real listener refuses an over-cap upload body before buffering, parsing or dispatching',async()=>{
 await mocked();reset();
 const session=UPLOAD_INSPECTION_SESSION_PREFIX+'a'.repeat(64);
 const app=createAgentCoreApplication({execute:()=>assert.fail('the inspection purpose must never reach SDK execution'),
  inspection:createUploadInspectionApplication({imageDigest:IMAGE_DIGEST,inspection:nativeInspection()})});
 const post=(headers,body)=>new Request('http://runtime.invalid/invocations',{method:'POST',duplex:'half',
  headers:{'content-type':'application/json',[AGENTCORE_SESSION_HEADER]:session,...headers},body});
 const counted=()=>({bytes:0});
 // A length-less source with no eager read-ahead: `highWaterMark:0` means a pull happens only when the listener
 // actually reads, so the counter measures exactly what was consumed rather than Node's stream prefetching.
 const source=counter=>{const chunk=Buffer.alloc(256*1024);
  return new ReadableStream({pull(controller){counter.bytes+=chunk.byteLength;
   if(counter.bytes>128*chunk.byteLength)controller.close();else controller.enqueue(chunk);}},{highWaterMark:0});};
 // (1) A DECLARED length over the cap is refused before the first read, so no byte of the body is buffered at all.
 const declaredPulled=counted();
 const declared=await app.handle(post({'content-length':String(UPLOAD_INSPECTION_WIRE_BYTES+1)},source(declaredPulled)));
 assert.equal(declared.status,400);
 assert.equal((await declared.json()).error.code,'UPLOAD_INSPECTION_REQUEST_REFUSED');
 assert.equal(declaredPulled.bytes,0,'an over-cap declared length never reads the body');
 // (2) A length-LESS body is bounded while it streams: the listener stops at the cap instead of draining the source.
 const streamedPulled=counted();
 const streamed=await app.handle(post({},source(streamedPulled)));
 assert.equal(streamed.status,400);
 assert.equal((await streamed.json()).error.code,'UPLOAD_INSPECTION_REQUEST_REFUSED');
 assert.ok(streamedPulled.bytes<=UPLOAD_INSPECTION_WIRE_BYTES+1024*1024,'the read stops once the cap is crossed');
 assert.ok(streamedPulled.bytes<32*1024*1024,'the source is never drained in order to find its length');
 assert.deepEqual(dispatched(),[],'an over-cap upload body reaches no inspection port and issues no SDK call');
});
