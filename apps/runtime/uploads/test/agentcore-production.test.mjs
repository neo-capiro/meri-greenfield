/** The CONTROL production caller: the server-side selection, the MOUNTED custody owner, and the exact original.
 *
 * Run this file with `--experimental-test-module-mocks`. The replaced SDK module is the safety boundary: every check
 * asserts the replacement took effect BEFORE it can dispatch, and refuses to continue if it did not, so no check in
 * this file reads the host credential chain or reaches any endpoint. What is REAL here is the part that matters: the
 * closed declaration compiler, the mount that selects the transport, the custody owner that owns freshness/retention,
 * and the purpose-locked application on the far side of the mocked transport.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mock} from 'node:test';
import {Readable} from 'node:stream';
import {readFile} from 'node:fs/promises';
import {createMemoryRetentionJournal} from '../../../control/retention/memory-journal.mjs';
import {createRetentionReadGate} from '../../../control/retention/suppression.mjs';
import {createUploadCustody,hash} from '../../../control/uploads/custody.mjs';
import {uploadHash} from '../../../control/uploads/policy.mjs';
import {createAgentCoreApplication} from '../../agentcore-http.mjs';
import {AGENTCORE_SESSION_HEADER} from '../../agentcore-contract.mjs';
import {createUploadInspectionApplication} from '../agentcore-http.mjs';
import {compileUploadNativeConfiguration,mountUploadNativeControl} from '../control-lifecycle.mjs';
import {nativeInspection} from './agentcore-fixture.mjs';

const SDK='@aws-sdk/client-bedrock-agentcore';
const RUNTIME='arn:aws:bedrock-agentcore:us-east-1:111122223333:runtime/meri_synthetic';
const DECLARED_IMAGE='sha256:'+'c'.repeat(64);
const sent=[],clients=[];let onInvoke=null,onStop=null;
class FakeClient{
 constructor(options){this.options=options;this.destroyed=false;clients.push(this);}
 async send(command,options){
  const name=command.constructor.name;sent.push({name,input:command.input,options});
  if(name==='StopRuntimeSessionCommand')return onStop?onStop(command.input)
   :{statusCode:200,$metadata:{httpStatusCode:200},runtimeSessionId:command.input.runtimeSessionId};
  assert.equal(name,'InvokeAgentRuntimeCommand');
  if(onInvoke)return onInvoke(command.input);
  return route(command.input);
 }
 destroy(){this.destroyed=true;}
}
class Command{constructor(input){this.input=input;}}
class InvokeAgentRuntimeCommand extends Command{}
class StopRuntimeSessionCommand extends Command{}
const supported=typeof mock.module==='function';
if(supported)mock.module(SDK,{namedExports:{BedrockAgentCoreClient:FakeClient,InvokeAgentRuntimeCommand,StopRuntimeSessionCommand}});
/** The mock, or no test at all: an un-mocked module would send a real request. */
async function mocked(){
 assert.equal(supported,true,'run this file with --experimental-test-module-mocks');
 const sdk=await import(SDK);
 assert.equal(sdk.BedrockAgentCoreClient,FakeClient,'the SDK module was NOT replaced; nothing dispatches without it');
}
const apps=new Map();
/** Route one mocked invoke into the REAL purpose-locked application, exactly as the platform would. */
const route=async input=>{
 let app=apps.get(input.runtimeSessionId);
 if(!app){
  app=createAgentCoreApplication({execute:()=>assert.fail('the inspection purpose must never reach SDK execution'),
   // The far side is built for the SAME declared image this side expects: a purpose built for another image refuses
   // the request outright, which is the before/after correlation the declared expectation is supposed to provide.
   inspection:createUploadInspectionApplication({inspection:nativeInspection({now}),imageDigest:DECLARED_IMAGE})});
  apps.set(input.runtimeSessionId,app);
 }
 const response=await app.handle(new Request('http://runtime.invalid/invocations',{method:'POST',
  headers:{'content-type':'application/json',[AGENTCORE_SESSION_HEADER]:input.runtimeSessionId},body:input.payload}));
 const body=await response.json();
 // The far side of this transport is the real purpose: a refusal there is a fact about the request, so it is
 // surfaced with its own body instead of being flattened into the transport's envelope check.
 assert.equal(response.status,200,'the purpose refused this request: '+JSON.stringify(body));
 return {statusCode:response.status,$metadata:{httpStatusCode:200},runtimeSessionId:input.runtimeSessionId,
  contentType:'application/json',response:Readable.from([Buffer.from(JSON.stringify(body))])};
};
const dispatched=()=>sent.map(entry=>entry.name);
const runtime=()=>({runtimeArn:RUNTIME,qualifier:'preview'});
const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-000000000000`,copy=structuredClone;
/** One clock for both sides of the crossing: the custody owner and the far-side purpose must agree on time, or a
 * receipt that is genuinely fresh is refused as out-of-window. The tests advance it deliberately instead. */
let clock=Date.now;const now=()=>clock();

test('the declaration selects the transport, and a remote declaration carries nothing local with it',()=>{
 // Absent and disabled are unchanged: nothing else may be declared beside them.
 assert.deepEqual(compileUploadNativeConfiguration({uploads:{native:{enabled:false}}}),{enabled:false});
 for(const bad of [{uploads:{native:{enabled:true}}},{uploads:{native:{enabled:true,imageDigest:'sha256:short'}}},
  {uploads:{native:{enabled:true,imageDigest:DECLARED_IMAGE,agentcore:{}}}}])
  assert.throws(()=>compileUploadNativeConfiguration(bad),{code:'UPLOAD_NATIVE_CONFIGURATION'});
 // A REMOTE declaration names the runtime image and nothing local: an unconsumed sandbox digest, root or budget is
 // refused, because this host composes no sandbox at all once the inspection runs in the runtime.
 for(const leftover of [{imageDigest:DECLARED_IMAGE},{definitionsRoot:'/srv/meri/definitions'},
  {scratchRoot:'/run/meri/upload-scratch'},{maxDefinitionsAgeMs:1000},{provisionMs:1000},{extractorPath:'/opt/meri/extract.py'}])
  assert.throws(()=>compileUploadNativeConfiguration({uploads:{native:{enabled:true,agentcore:{imageDigest:DECLARED_IMAGE},...leftover}}}),
   {code:'UPLOAD_NATIVE_CONFIGURATION'},`${Object.keys(leftover)[0]} must not survive a remote declaration`);
 assert.deepEqual(compileUploadNativeConfiguration({uploads:{native:{enabled:true,agentcore:{imageDigest:DECLARED_IMAGE}}}}),
  {enabled:true,agentcore:{imageDigest:DECLARED_IMAGE}});
 // The existing LOCAL declaration still compiles exactly as before, defaults and all.
 const local=compileUploadNativeConfiguration({uploads:{native:{enabled:true,imageDigest:DECLARED_IMAGE}}});
 assert.equal(local.enabled,true);
 assert.equal(local.imageDigest,DECLARED_IMAGE);
 assert.equal(local.agentcore,undefined);
 assert.match(local.extractorPath,/extract\.py$/u);
});

test('the mount chooses the remote port for a genuine runtime, and never runs the bytes locally',async()=>{
 const invoked=[];
 const run=async name=>{invoked.push(String(name));return {stdout:Buffer.alloc(0)};};
 const disabled=await mountUploadNativeControl({configuration:{uploads:{native:{enabled:false}}},now:Date.now,run});
 assert.equal(disabled.inspection,null);
 assert.deepEqual(disabled.missing,['uploads.native.enabled']);
 // A remote declaration without the runtime it depends on is an honest UNAVAILABLE, never a local fallback.
 for(const configuration of [
  {uploads:{native:{enabled:true,agentcore:{imageDigest:DECLARED_IMAGE}}}},
  {uploads:{native:{enabled:true,agentcore:{imageDigest:DECLARED_IMAGE}}},agentcore:{qualifier:'preview'}},
  {uploads:{native:{enabled:true,agentcore:{imageDigest:DECLARED_IMAGE}}},agentcore:{runtimeArn:'not-an-arn',qualifier:'preview'}},
  {uploads:{native:{enabled:true,agentcore:{imageDigest:DECLARED_IMAGE}}},agentcore:{runtimeArn:RUNTIME,qualifier:'!'}}]){
  const unavailable=await mountUploadNativeControl({configuration,now:Date.now,run});
  assert.equal(unavailable.inspection,null);
  assert.deepEqual(unavailable.missing,['uploads.native.agentcore']);
 }
 assert.deepEqual(invoked,[],'no local sandbox composition is attempted for a remote declaration');
 const mounted=await mountUploadNativeControl({configuration:{uploads:{native:{enabled:true,agentcore:{imageDigest:DECLARED_IMAGE}}},
  agentcore:runtime()},now:Date.now,run});
 assert.deepEqual(mounted.missing,[]);
 assert.equal(typeof mounted.inspection.inspect,'function','the remote port is what the uploads family receives');
 assert.equal(mounted.host,null,'no local host exists for a remote declaration');
 assert.equal(mounted.provisionDefinitions,null,'CONTROL does not provision the runtime container');
 assert.deepEqual(invoked,[],'CONTROL never executes the uploaded bytes for a remote declaration');
 // The LOCAL declaration still takes the local path, and an unattested host is still honestly unavailable.
 const localMounted=await mountUploadNativeControl({configuration:{uploads:{native:{enabled:true,imageDigest:DECLARED_IMAGE}}},
  now:Date.now,run});
 assert.equal(localMounted.inspection,null);
 assert.deepEqual(localMounted.missing,['uploads.native.sandbox'],'the local path is the one that composes a sandbox');
});

/** The MOUNTED caller, over the real custody owner: one remote port selected by the mount, no injected leaf. */
async function mounted({inspection,state}){
 const now=()=>state.at,bytes=Buffer.from('literal uploaded document'),declaration={
  filename:'document.txt',mimeType:'text/plain',bytes:bytes.length,sha256:uploadHash(bytes)};
 const binding={tenantId:id(1),actorId:id(2),conversationId:id(3),runId:id(4),attemptId:id(5),workerId:id(6),writerFence:1};
 const scopes=[{tenantId:id(1),kind:'private-user',resourceId:id(2),policyRevision:'policy1'}];
 const current=async()=>{if(state.denied)throw Error('CURRENT_DENIED');
  return {binding:copy(binding),scopes:copy(scopes),selectedClientId:null,checkedAtMs:now(),expiresAtMs:now()+300000};};
 const store={
  async prepare(r){state.rows.set(r.uploadId,copy(r));return copy(r);},
  async read(owner,key){return copy(state.rows.get(key)??null);},
  async transition(a,b,check){check();if(hash(state.rows.get(a.uploadId))!==hash(a))throw Error('UPLOAD_CHANGED');
   state.rows.set(a.uploadId,copy(b));return copy(b);},
 };
 const objects={
  async put(r){state.object={objectId:r.objectId,versionId:'NATIVE_ORIGINAL_VERSION',sha256:uploadHash(r.bytes),bytes:r.bytes.length,scopes:r.scopes};return copy(state.object);},
  async observePut(){return copy(state.object);},
  async get(){state.gets+=1;return Buffer.from(bytes);},
 };
 const journal=createMemoryRetentionJournal();
 const retention=createRetentionReadGate({journal:{...journal,get:async()=>null},serving:{isEnabled:()=>true}});
 const removeOriginal=async({object})=>({deleted:true,objectId:object.objectId,versionId:object.versionId});
 let sequence=20;
 const owner=createUploadCustody({store,objects,inspection,current,retention,removeOriginal,now,ids:()=>id(sequence++)});
 const options={deadlineMs:Date.now()+180000};
 const prepared=await owner.initiate({requestId:id(10),declaration},options);
 return {owner,prepared,bytes,declaration,options};
}

test('a mounted remote port inspects the exact original, and freshness denies before and after the dispatch',async()=>{
 await mocked();sent.length=0;onInvoke=null;
 const state={at:Date.now(),denied:false,gets:0,rows:new Map(),object:null};
 clock=()=>state.at;
 const configuration={uploads:{native:{enabled:true,agentcore:{imageDigest:DECLARED_IMAGE}}},agentcore:runtime()};
 const mountedPort=await mountUploadNativeControl({configuration,now:Date.now,
  run:async()=>{throw Error('the remote selection must not compose a local sandbox');}});
 assert.equal(mountedPort.inspection!==null,true);
 const call=await mounted({inspection:mountedPort.inspection,state});
 await call.owner.put(call.prepared.uploadId,call.bytes,call.options);
 // Freshness BEFORE the dispatch: a denied current recheck must stop the work with nothing dispatched and no stop.
 state.denied=true;
 await assert.rejects(call.owner.inspect(call.prepared.uploadId,call.options),/CURRENT_DENIED/u);
 assert.deepEqual(sent,[],'a denied caller never reaches the inspection purpose');
 assert.equal(state.gets,0,'the original is not even read for a denied caller');
 assert.equal(state.rows.get(call.prepared.uploadId).inspection,null);
 state.denied=false;
 const inspected=await call.owner.inspect(call.prepared.uploadId,call.options);
 assert.equal(inspected.inspection.scan.status,'clean');
 assert.equal(inspected.inspection.extraction.segments.length,1);
 assert.equal(inspected.inspection.extraction.segments[0].trust,'external_untrusted');
 // The wire carried the EXACT original this custody owns, and the owned session was stopped once.
 assert.deepEqual(dispatched(),['InvokeAgentRuntimeCommand','StopRuntimeSessionCommand']);
 const [invoked,stopped]=sent;
 const payload=JSON.parse(invoked.input.payload);
 assert.equal(Buffer.from(payload.bytesBase64,'base64').equals(call.bytes),true);
 assert.equal(payload.inputSha256,call.declaration.sha256);
 assert.deepEqual(payload.declaration,call.declaration);
 assert.equal(payload.imageDigest,DECLARED_IMAGE,'the expected image is the declared one, never an observed one');
 assert.equal(stopped.input.runtimeSessionId,invoked.input.runtimeSessionId);
 assert.equal(stopped.input.agentRuntimeArn,RUNTIME);
 assert.equal(stopped.input.qualifier,'preview','the existing configured endpoint qualifier is what is addressed');
 // Freshness AFTER the dispatch: revoking access while it runs must publish nothing at all.
 sent.length=0;state.at+=1;
 onInvoke=async input=>{state.denied=true;return route(input);};
 await assert.rejects(call.owner.inspect(call.prepared.uploadId,call.options),/CURRENT_DENIED/u);
 // The row legitimately carries the FIRST, authorised inspection; what a revoked caller must not do is replace it
 // with a second one observed while its authority was being withdrawn.
 assert.deepEqual(state.rows.get(call.prepared.uploadId).inspection,inspected.inspection,
  'a revoked caller publishes no NEW inspection');
 assert.deepEqual(dispatched(),['InvokeAgentRuntimeCommand','StopRuntimeSessionCommand'],'the owned session is still stopped');
 onInvoke=null;
});

test('an uncertain dispatch is surfaced by custody and never retried, and the session is still stopped',async()=>{
 await mocked();sent.length=0;onInvoke=async()=>{throw Error('synthetic delivery unknown');};
 const state={at:Date.now(),denied:false,gets:0,rows:new Map(),object:null};
 const configuration={uploads:{native:{enabled:true,agentcore:{imageDigest:DECLARED_IMAGE}}},agentcore:runtime()};
 const mountedPort=await mountUploadNativeControl({configuration,now:Date.now});
 const call=await mounted({inspection:mountedPort.inspection,state});
 await call.owner.put(call.prepared.uploadId,call.bytes,call.options);
 await assert.rejects(call.owner.inspect(call.prepared.uploadId,call.options),{code:'UPLOAD_INSPECTION_OUTCOME_UNKNOWN'});
 assert.deepEqual(dispatched(),['InvokeAgentRuntimeCommand','StopRuntimeSessionCommand']);
 assert.equal(state.rows.get(call.prepared.uploadId).inspection,null);
 onInvoke=null;
});

/** CH-1: the client the mount OWNS is destroyed by the shutdown CONTROL actually runs.
 *
 * The handle's `inspection` is the very object CONTROL hands to the uploads family AND the very object its shutdown
 * close list closes, so this drives the MOUNTED port rather than a free-standing helper: one real custody-mediated
 * inspect (which stops its own owned session), then the close the shutdown performs. The list itself is asserted
 * against the current source, because a runtime witness alone cannot show that the shutdown path reaches this handle,
 * and a close no caller invokes is exactly the gap being closed. */
test('the mounted CONTROL handle destroys the ONE client it owns, after the owned session is stopped',async()=>{
 await mocked();sent.length=0;clients.length=0;onInvoke=null;
 const state={at:Date.now(),denied:false,gets:0,rows:new Map(),object:null};
 clock=()=>state.at;
 const configuration={uploads:{native:{enabled:true,agentcore:{imageDigest:DECLARED_IMAGE}}},agentcore:runtime()};
 const mountedPort=await mountUploadNativeControl({configuration,now:Date.now});
 const call=await mounted({inspection:mountedPort.inspection,state});
 await call.owner.put(call.prepared.uploadId,call.bytes,call.options);
 const inspected=await call.owner.inspect(call.prepared.uploadId,call.options);
 assert.equal(inspected.inspection.scan.status,'clean');
 assert.equal(clients.length,1,'the mount owns exactly one client for its remote port');
 const owned=clients[0],declaredPort=owned.options;
 assert.equal(declaredPort.maxAttempts,1,'the owned client is the standard non-retrying adapter');
 // The owned session is stopped by the dispatch itself, BEFORE any shutdown: that is what the close must follow.
 assert.deepEqual(dispatched(),['InvokeAgentRuntimeCommand','StopRuntimeSessionCommand']);
 assert.equal(owned.destroyed,false,'the client is alive while CONTROL serves');
 // The exact call CONTROL's shutdown close list makes for this handle.
 mountedPort.inspection.close();
 await new Promise(setImmediate);
 assert.equal(owned.destroyed,true,'shutdown destroys the client the mount created');
 mountedPort.inspection.close();
 await new Promise(setImmediate);
 assert.equal(clients.length,1,'a repeated close creates and destroys nothing further');
 const control=await readFile(new URL('../../control.mjs',import.meta.url),'utf8');
 const shutdown=control.slice(control.indexOf('const close=()=>closing??=(async()=>{'),
  control.indexOf('assertTemporalRuntimeCleanup(results)'));
 assert.ok(shutdown.length>0,'the shutdown close list is locatable in the control source');
 assert.match(shutdown,/\(\)=>uploadsNative\?\.inspection\?\.close\?\.\(\)/u,
  'CONTROL shutdown reaches the mounted inspection close, so the owned client is never left unclosed');
 assert.match(shutdown,/\(\)=>assembly\?\.close\(\)[\s\S]*uploadsNative\?\.inspection\?\.close/u,
  'the serving owner stops before the owned client is destroyed');
});
