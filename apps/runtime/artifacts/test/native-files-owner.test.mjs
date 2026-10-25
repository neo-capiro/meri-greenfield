import {contentRows} from '../../../control/conversations/test/retention-content-fixture.mjs';
/** Real conversation journals, mocked object transport; no provider, database or model calls. */
import test from 'node:test';import assert from 'node:assert/strict';
import {listenRuntime} from '../../http-server.mjs';
import {createNativeCapabilityClient} from '../../native-client.mjs';
import {createNativeFileOwner} from '../native-files-owner.mjs';import {createNativeFileApplication} from '../native-files-http.mjs';
import {createNativeSessionContinuation} from '../../sdk-continuation-owner.mjs';
import {decodeConversationInventoryRows} from '../../../control/conversations/retention-inventory-decode.mjs';
import {enumerateReferences,createReferenceIndex,sharedReferences} from '../../../control/retention/inventory.mjs';
import {nativeFixture,binding,scopes,id,check,rowKey} from '../../../control/conversations/test/native-next-run-fixture.mjs';
import {versions} from '../../../control/conversations/test/lifecycle-fixture.mjs';
import {executionIdentity} from '../../../control/conversations/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {nativeFileSha256,nativeFileBindingHeader,NATIVE_FILE_LIMITS} from '../../../../packages/contracts/runtime-0.2/files.mjs';
import {createPostgresConversationStore} from '../../../control/conversations/postgres-store.mjs';
import {createTurnTelemetry} from '../../telemetry/turn-context.mjs';
import {countingFetch} from '../../telemetry/counting.mjs';
import {assembleAgentCoreCandidate} from '../../agentcore-candidate.mjs';
import {agentcoreControlFixture} from '../../test/agentcore-fixture.mjs';
const raw=(path,value)=>{const b=Buffer.from(value);return {path,executable:false,bytes:b.length,sha256:nativeFileSha256(b),base64:b.toString('base64')};};
async function fixture(t,options={}){t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-15T12:00:00.000Z')});const x=await nativeFixture();t.after(x.f.close);await x.running(binding);x.seed(binding);const objects=new Map(),state={puts:0,gets:0,deny:false,unknown:false,suppressed:false};
 const store=options.onPublished?createPostgresConversationStore({pool:x.f.pool,onPublished:options.onPublished}):x.f.store;
 const execution={async authenticate({credential,binding:b}){if(credential!=='synthetic-execution'||state.deny)throw Error('denied');const v=await x.f.store.executions.read(b,check);if(!v.record||['stopping','settled'].includes(v.record.phase)||v.run.state==='cancelled')throw Error('denied');return {execution:executionIdentity(v.record),versions:v.run.versions,state:v.run.state,scopes:v.run.scopes,selectedClientId:id(5),policyRevision:v.run.policyRevision};}};
 const snapshot=createNativeSessionContinuation({store:x.f.store,execution,versions,maxOutputBytes:1024}),storage={async put({objectId,bytes,scopes}){state.puts++;const object={objectId,versionId:'synthetic-version',sha256:nativeFileSha256(bytes),bytes:bytes.length,scopes};objects.set(objectId,{object,bytes:Buffer.from(bytes)});if(state.unknown)throw Error('synthetic lost object acknowledgment');return object;},async get(object){state.gets++;const saved=objects.get(object.objectId);assert.deepEqual(saved.object,object);return Buffer.from(saved.bytes);}};
 const owner=createNativeFileOwner({store,execution,objects:storage,snapshot,maxRequestMs:3000,retention:{async assertServable(){if(state.suppressed)throw Error('suppressed');}}}),application=createNativeFileApplication({owner,maxRequestMs:3000}),request={binding,sessionId:x.sessionKey.sessionId,files:[raw('answer.txt','synthetic result')],taskFiles:[raw('3.json','{"id":"3","status":"completed"}\n'),raw('.highwatermark','3')]};
 const call=(method,request)=>owner[method]({credential:'synthetic-execution',request});
 async function hold(){const controlId=id(8100);await x.f.control({controlId,intent:'pause'});await x.f.claim(controlId);return {...request,controlId};}
 return {...x,owner,application,state,objects,execution,request,call,hold};
}
test('capture records the native files before hold publication and replay never repeats an object write',async t=>{const x=await fixture(t),request=await x.hold(),r=await x.call('capture',request);assert.equal(x.state.puts,3);assert.equal((await x.f.store.read(binding,{},check)).run.state,'running');
 assert.equal(r.files.workspace.entries[0].path,'answer.txt');assert.equal(r.files.tasks.length,2);assert.equal(x.f.state.controls.get(`${binding.tenantId}:${request.controlId}`)?.projection?.proof??null,null);
 assert.deepEqual(await x.call('capture',request),r);assert.equal(x.state.puts,3);
 const captured=await x.f.service.recordCheckpoint({credential:x.f.credential,binding,input:{controlId:request.controlId,sessionId:request.sessionId}});assert.equal(captured.state,'APPLIED');assert.equal((await x.f.store.read(binding,{},check)).run.state,'paused');
 await x.settle(binding);const proof=(await x.f.store.lifecycle.readSessionCapture({binding,scopes,selectedClientId:id(5),checkpointId:binding.runId},check)).proof;assert.deepEqual(proof.files,r.files);assert.equal(proof.checkpointSha256,hash({sdkSession:proof.sdkSession,files:r.files}));
});
test('native completion uses the actual SDK reference and one atomic final event pair',async t=>{const x=await fixture(t),r=await x.call('complete',x.request);assert.equal(r.state,'completed');assert.equal(r.proof.sdkSession.entriesCount,22);assert.equal(r.proof.files.tasks.length,2);assert.equal(x.f.state.checkpoints.size,0);
 const before=(await x.f.store.read(binding,{},check)).events;assert.deepEqual(before.slice(-2).map(e=>e.type),['checkpoint.verified','run.status']);assert.deepEqual(await x.call('complete',x.request),r);assert.equal(x.state.puts,3);assert.equal((await x.f.store.read(binding,{},check)).events.length,before.length);
 await x.settle(binding);assert.deepEqual((await x.f.store.lifecycle.readSessionCapture({binding,scopes,selectedClientId:id(5),checkpointId:binding.runId},check)).proof,r.proof);
});
for(const mode of ['capture','complete'])test(`${mode} lost object result retains the durable unknown barrier and no replay`,async t=>{const x=await fixture(t),request=mode==='capture'?await x.hold():x.request;x.state.unknown=true;await assert.rejects(x.call(mode,request));assert.equal(x.state.puts,1);x.state.unknown=false;await assert.rejects(x.call(mode,request));assert.equal(x.state.puts,1);assert.equal((await x.f.store.read(binding,{},check)).run.state,'running');});
for(const mode of ['capture','complete'])test(`${mode} changed bytes cannot reuse the attempted identity`,async t=>{const x=await fixture(t),request=mode==='capture'?await x.hold():x.request;await x.call(mode,request);await assert.rejects(x.call(mode,{...request,files:[raw('answer.txt','substituted')]}));assert.equal(x.state.puts,3);});
test('scope revocation, retention suppression and cancelled writer refuse before storage',async t=>{const x=await fixture(t);x.state.deny=true;await assert.rejects(x.call('complete',x.request));x.state.deny=false;x.state.suppressed=true;await assert.rejects(x.call('complete',x.request));x.state.suppressed=false;await x.f.store.append(binding,x.status('cancelled'),check);await assert.rejects(x.call('complete',x.request));assert.equal(x.state.puts,0);});
test('changed object readback leaves completion uncommitted',async t=>{const x=await fixture(t),owner=createNativeFileOwner({store:x.f.store,execution:x.execution,objects:{async put(v){return {objectId:v.objectId,versionId:'version',bytes:v.bytes.length,sha256:'f'.repeat(64),scopes};},async get(){throw Error('unused');}},snapshot:{async readFiles(){throw Error('unused');}}});await assert.rejects(owner.complete({credential:'synthetic-execution',request:x.request}));assert.equal((await x.f.store.read(binding,{},check)).run.state,'running');});
test('restore follows actual accepted source mapping and verifies every object; changed origin is refused',async t=>{const x=await fixture(t),completed=await x.call('complete',x.request);await x.settle(binding);const target=(await x.select()).binding;await x.accept(target,'synthetic follow-up');await x.allocate(target);await x.running(target);
 const r=await x.call('restore',{binding:target});assert.deepEqual(r.files,completed.proof.files);assert.deepEqual(r.upload,{files:x.request.files,taskFiles:x.request.taskFiles});assert.equal(x.state.gets,3);
 const reservation=[...x.f.state.nextRuns.values()].find(r=>r.target_run_id===target.runId);reservation.reservation.facts.sdkSession.ownerSha256='e'.repeat(64);reservation.reservation_sha256=hash(reservation.reservation);await assert.rejects(x.call('restore',{binding:target}));assert.equal(x.state.gets,3);
});
test('private HTTP authenticates the bounded binding before consuming a large body',async t=>{const x=await fixture(t);let reads=0,cancels=0;const body=new ReadableStream({pull(){reads++;},cancel(){cancels++;}},{highWaterMark:0});
 const r=await x.application.handle(new Request('https://synthetic.invalid/v1/runner/checkpoint/complete',{method:'POST',headers:{authorization:'Bearer incorrect','content-type':'application/json','x-meri-run-binding':nativeFileBindingHeader(binding)},body,duplex:'half'}));assert.equal(r.status,401);assert.equal(reads,0);assert.equal(x.state.puts,0);await body.cancel();assert.equal(cancels,1);
});
for(const change of ['header-overflow','header-shape','body-binding','body-limit','compressed'])test(`private HTTP refuses ${change} without object writes`,async t=>{const x=await fixture(t),headers={authorization:'Bearer synthetic-execution','content-type':'application/json','x-meri-run-binding':nativeFileBindingHeader(binding)},body=structuredClone(x.request);
 if(change==='header-overflow')headers['x-meri-run-binding']='a'.repeat(2049);if(change==='header-shape')headers['x-meri-run-binding']=Buffer.from(JSON.stringify({...binding,extra:true})).toString('base64url');if(change==='body-binding')body.binding.actorId='foreign';if(change==='body-limit')headers['content-length']=String(NATIVE_FILE_LIMITS.requestBytes+1);if(change==='compressed')headers['content-encoding']='gzip';
 const r=await x.application.handle(new Request('https://synthetic.invalid/v1/runner/checkpoint/complete',{method:'POST',headers,body:JSON.stringify(body)}));assert.ok([400,403,413].includes(r.status));assert.equal(x.state.puts,0);
});

function inventory(x,b=binding){const state=x.f.state,subject={tenantId:b.tenantId,kind:'conversation',subjectId:b.conversationId,ownerActorId:b.actorId},filter=rows=>rows.filter(r=>r.tenant_id===b.tenantId&&r.conversation_id===b.conversationId),events=[...state.events.values()].flat().map(r=>({...r,tenant_id:r.event.binding.tenantId,conversation_id:r.event.binding.conversationId,run_id:r.event.binding.runId}));
 const raw={subject,conversation:state.conversations.get(`${b.tenantId}:${b.conversationId}`),runs:filter([...state.runs.values()]),events:filter(events),controls:filter([...state.controls.values()]),checkpoints:filter([...state.checkpoints.values()]),completionCheckpoints:filter([...state.completions.values()]),nextRuns:filter([...state.nextRuns.values()]),memoryContinuations:[],memoryContextRows:[],memoryCandidates:[],contentRows:contentRows(state,b)};
 const decoded=decodeConversationInventoryRows(raw),enumerated=enumerateReferences({...decoded,sdkSessionEntries:[],selectedOutputs:[],artifactVersions:[],nativeJournalRows:[],uploads:[]});return {raw,decoded,enumerated};
}
for(const mode of ['capture','complete'])test(`retention inventories actual ${mode} workspace and task versions without a legacy checkpoint row`,async t=>{const x=await fixture(t),request=mode==='capture'?await x.hold():x.request;await x.call(mode,request);if(mode==='capture')await x.f.service.recordCheckpoint({credential:x.f.credential,binding,input:{controlId:request.controlId,sessionId:request.sessionId}});
 const i=inventory(x);assert.equal(i.decoded.checkpoints.length,0);assert.equal(i.decoded.objectVersions.length,3);assert.equal(i.enumerated.objects.length,3);assert.ok(i.enumerated.objects.every(o=>o.classes.includes(mode==='capture'?'lifecycle':'completionCheckpoints')));assert.equal(i.enumerated.rowTargets.some(t=>t.className==='lifecycle'),false,'no fabricated legacy checkpoint row target');
});
test('unknown hold capture refuses complete inventory; unknown completion retains its existing purge blocker',async t=>{const x=await fixture(t),request=await x.hold();x.state.unknown=true;await assert.rejects(x.call('capture',request));assert.throws(()=>inventory(x),/STORE_CORRUPT/);});
test('unknown native completion is enumerated as unresolved, never a fabricated file inventory',async t=>{const x=await fixture(t);x.state.unknown=true;await assert.rejects(x.call('complete',x.request));const i=inventory(x);assert.equal(i.enumerated.unpublishedCompletionCheckpoints.length,1);assert.equal(i.enumerated.objects.length,0);});

test('published native capture cannot certify an inventory after its SDK rows disappear',async t=>{const x=await fixture(t);await x.call('complete',x.request);const {raw}=inventory(x);
 for(const table of Object.keys(raw.contentRows))if(table.startsWith('meri_conversations.sdk_session'))raw.contentRows[table]=[];
 assert.throws(()=>decodeConversationInventoryRows(raw),/STORE_CORRUPT/);
});
test('fork copies immutable file custody, preserves source and blocks deletion while another holder remains',async t=>{const x=await fixture(t),request=await x.hold();await x.call('capture',request);await x.f.service.recordCheckpoint({credential:x.f.credential,binding,input:{controlId:request.controlId,sessionId:request.sessionId}});await x.settle(binding);
 const proof=(await x.f.store.lifecycle.readSessionCapture({binding,scopes,selectedClientId:id(5),checkpointId:binding.runId},check)).proof;
 const result=await x.f.control({controlId:id(8201),intent:'fork',checkpointId:binding.runId,checkpointSha256:proof.checkpointSha256});const source=inventory(x),target=inventory(x,result.targetBinding);assert.deepEqual(source.decoded.objectVersions,target.decoded.objectVersions);assert.equal(target.decoded.runs[0].continuation.files.tasks.length,2);
 const index=createReferenceIndex();index.record('source',source.enumerated);index.record('target',target.enumerated);assert.equal(sharedReferences(source.enumerated,index,'source',()=>({eligible:false})).length,3);assert.equal(sharedReferences(source.enumerated,index,'source',()=>({eligible:true})).length,0);
});
for(const change of ['manifest-binding','object-scope','task-path','capture-hash'])test(`retention refuses changed native ${change} even after row digest is recomputed`,async t=>{const x=await fixture(t);await x.call('complete',x.request);const raw=structuredClone(inventory(x).raw),row=raw.completionCheckpoints[0],p=row.proof;if(change==='manifest-binding')p.files.workspace.binding.actorId='foreign';if(change==='object-scope')p.files.tasks[0].object.scopes=[];if(change==='task-path')p.files.tasks[0].path='../credentials';if(change==='capture-hash')p.checkpointSha256='e'.repeat(64);row.proof_sha256=hash(p);assert.throws(()=>decodeConversationInventoryRows(raw),/STORE_CORRUPT/);});

test('actual private HTTP and native client preserve a file payload above the ordinary JSON ceiling, then close all sockets',async t=>{const x=await fixture(t),server=await listenRuntime({configuration:{http:{hostname:'127.0.0.1',port:0,frontendOrigin:'https://synthetic.invalid'},limits:{requestMs:5000,shutdownMs:2000}},application:x.application,readiness:async()=>({})});
 try{const origin=`http://127.0.0.1:${server.address.port}`,client=createNativeCapabilityClient({configuration:{origin,maxResponseBytes:262144},credential:'synthetic-execution',maxRequestMs:5000});
  const request={...x.request,files:[raw('first.bin',Buffer.alloc(6*1024*1024,17)),raw('second.bin',Buffer.alloc(6*1024*1024,18)),raw('third.bin',Buffer.alloc(1024*1024,19))]};
  assert.ok(Buffer.byteLength(JSON.stringify(request))>16*1024*1024);const completed=await client.call('runner/checkpoint/complete',request);assert.equal(completed.state,'completed');assert.equal(x.state.puts,5);
  await x.settle(binding);const target=(await x.select()).binding;await x.accept(target,'synthetic restore');await x.allocate(target);await x.running(target);
  const restored=await client.call('runner/files/restore',{binding:target});assert.deepEqual(restored.upload,{files:request.files,taskFiles:request.taskFiles});assert.equal(x.state.gets,5);
  let transports=0;const refusing=createNativeCapabilityClient({configuration:{origin,maxResponseBytes:262144},credential:'synthetic-execution',fetch:async(...args)=>{transports++;return fetch(...args);}});
  await assert.rejects(refusing.call('runner/publish',request));assert.equal(transports,0,'large file exception cannot widen ordinary run/tool JSON');
 }finally{assert.deepEqual(await server.close(),{listenerStopped:true,pendingRequests:0});}
});


test('native completion telemetry observes committed journal events once and waits for the final attributed call',async t=>{
 const lines=[],seen=[];let clock=100;
 const telemetry=createTurnTelemetry({service:'control',now:()=>clock,write:line=>lines.push(JSON.parse(line))});t.after(()=>telemetry.close());
 const x=await fixture(t,{onPublished:event=>{seen.push(event);telemetry.bind(event.binding);telemetry.summary(event);}});
 const core=countingFetch(async()=>{clock+=3;return Response.json({ok:true});},telemetry,{origin:'https://core.synthetic.invalid'});
 await telemetry.provisional(async()=>{
  await core('https://core.synthetic.invalid/application-authority/current');
  assert.equal((await x.call('complete',x.request)).state,'completed');
  assert.equal(lines.filter(l=>l.event==='meri.turn.counters').length,0);
  await core('https://core.synthetic.invalid/application-authority/current');
 });
 const summaries=lines.filter(l=>l.event==='meri.turn.summary'),counters=lines.filter(l=>l.event==='meri.turn.counters');
 assert.equal(summaries.length,1);assert.equal(summaries[0].state,'completed');assert.equal(summaries[0].conversationId,binding.conversationId);
 assert.equal(counters.length,1);assert.equal(counters[0].CoreCalls,2);assert.equal(counters[0].coreMs,6);
 assert.deepEqual(seen.map(e=>e.type),['checkpoint.verified','run.status']);
 const committed=(await x.f.store.read(binding,{},check)).events.at(-1);assert.deepEqual(seen.at(-1),committed);
 await telemetry.provisional(()=>x.call('complete',x.request));
 assert.equal(seen.length,3,'validated PUBLISHED begin replay observes the same canonical terminal');
 assert.equal(seen.at(-1).eventId,committed.eventId);assert.equal(seen.at(-1).sequence,committed.sequence);
 assert.equal(lines.filter(l=>l.event==='meri.turn.summary').length,1);assert.equal(lines.filter(l=>l.event==='meri.turn.counters').length,1);
 telemetry.rollup();assert.equal(lines.find(l=>l.event==='meri.process.rollup').CoreCalls,0);
 assert.equal(x.state.puts,3,'telemetry does not add or repeat object I/O');
});

test('native completion telemetry preserves failed capture and lost commit acknowledgment, then observes validated replay',async t=>{
 const lines=[],telemetry=createTurnTelemetry({service:'control',write:line=>lines.push(JSON.parse(line))});t.after(()=>telemetry.close());
 const options={onPublished:event=>{telemetry.bind(event.binding);telemetry.summary(event);}},x=await fixture(t,options);
 const connect=x.f.pool.connect;
 x.f.pool.connect=async(...args)=>{const client=await connect.apply(x.f.pool,args),query=client.query;
  client.query=async function(sql,...values){const result=await query.call(this,sql,...values);
   if(typeof sql==='string'&&sql.startsWith("UPDATE meri_conversations.completion_checkpoints SET state='PUBLISHED'"))x.f.state.commitUnknown=true;
   return result;
  };return client;
 };
 await assert.rejects(telemetry.provisional(()=>x.call('complete',x.request)));
 assert.equal(lines.filter(l=>l.event==='meri.turn.summary').length,0,'an uncertain commit acknowledgment cannot be published as observed success');
 x.f.pool.connect=connect;x.f.state.commitUnknown=false;
 assert.equal((await telemetry.provisional(()=>x.call('complete',x.request))).state,'completed');
 assert.equal(lines.filter(l=>l.event==='meri.turn.summary').length,1);assert.equal(lines.filter(l=>l.event==='meri.turn.counters').length,1);
 assert.equal(x.state.puts,3);
});

test('failed native capture and throwing publication observers preserve domain results',async t=>{
 const seen=[],x=await fixture(t,{onPublished:event=>{seen.push(event);throw Error('telemetry writer failed');}});
 x.state.unknown=true;await assert.rejects(x.call('complete',x.request));assert.equal(seen.length,0);
 assert.equal((await x.f.store.read(binding,{},check)).run.state,'running');
});

test('throwing native completion observer cannot turn committed completion into failure',async t=>{
 const x=await fixture(t,{onPublished(){throw Error('telemetry writer failed');}});
 assert.equal((await x.call('complete',x.request)).state,'completed');
 assert.equal((await x.f.store.read(binding,{},check)).run.state,'completed');
});

test('native telemetry default candidate store observes a failed terminal and waits for stop transport',async t=>{
 const lines=[];let clock=100,stops=0;
 const telemetry=createTurnTelemetry({service:'control',now:()=>clock,write:line=>lines.push(JSON.parse(line))});t.after(()=>telemetry.close());
 const x=await fixture(t),core=countingFetch(async()=>{clock+=4;return Response.json({ok:true});},telemetry,{origin:'https://core.synthetic.invalid'});
 const candidate=assembleAgentCoreCandidate({configuration:agentcoreControlFixture().configuration,pool:x.f.pool,
  controlCredential:'synthetic-control-secret-not-a-user-bearer',turnTelemetry:telemetry,
  nativeCredentials:{nativeCredentialFor(){assert.fail('stop must not mint or read a user credential');}},
  fetchImpl(){assert.fail('telemetry must not add a Core request');},
  provider:{async invoke(){assert.fail('stop never dispatches a model');},async stop({signal,...input}){
   signal?.throwIfAborted();stops++;assert.equal(lines.filter(l=>l.event==='meri.turn.counters').length,0);
   await core('https://core.synthetic.invalid/application-authority/current');return {...input,stopped:true};
  }}});t.after(()=>candidate.close());
 const stop=()=>candidate.native.call('execution/kickoff/stop',{binding,executionId:hash(binding)});
 await stop();await stop();
 assert.equal((await x.f.store.read(binding,{},check)).run.state,'failed');assert.equal(stops,1);
 const summaries=lines.filter(l=>l.event==='meri.turn.summary'),counters=lines.filter(l=>l.event==='meri.turn.counters');
 assert.equal(summaries.length,1);assert.equal(summaries[0].state,'failed');assert.equal(summaries[0].reasonCode,'ATTEMPT_LOST');
 assert.equal(counters.length,1);assert.equal(counters[0].runId,binding.runId);assert.equal(counters[0].CoreCalls,1);assert.equal(counters[0].coreMs,4);
 telemetry.rollup();assert.equal(lines.find(l=>l.event==='meri.process.rollup').CoreCalls,0);
});
