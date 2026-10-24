/** Actual journals over scripted SQL; no database, SDK process or physical-stop claim. */
import test from 'node:test';import assert from 'node:assert/strict';
import {nativeFixture,binding,scopes,id,rowKey,check} from './native-next-run-fixture.mjs';
import {hash} from '../boundary.mjs';
import {createNativeLifecycleAdmission} from '../../../runtime/product-ports/lifecycle.mjs';
import {versions,lifecycleFixture,captureEmptyFiles,settleInvocation} from './lifecycle-fixture.mjs';
const at=Date.parse('2026-10-15T12:00:00.000Z'),controlId=id(5000);
async function fixture(t,{files}={}){t.mock.timers.enable({apis:['Date'],now:at});const x=await nativeFixture();await x.running(binding);x.seed(binding);
 await x.f.control({controlId,intent:'pause'});await x.f.claim(controlId);
 const fileArgs={binding,scopes,selectedClientId:id(5),controlId,sessionId:x.sessionKey.sessionId};
 if(files){const claim={...fileArgs,requestSha256:hash(files)};await x.f.store.lifecycle.beginFileCapture(claim,check);await x.f.store.lifecycle.recordFiles({...claim,files},check);}
 else await captureEmptyFiles(x.f.store,fileArgs);
 const args={binding,scopes,selectedClientId:id(5),controlId,sessionId:x.sessionKey.sessionId,events:[
  {contractVersion:'0.1.0',eventId:id(5001),createdAt:new Date(at).toISOString(),type:'checkpoint.verified',data:{checkpointId:binding.runId}},
  {contractVersion:'0.1.0',eventId:id(5002),createdAt:new Date(at).toISOString(),type:'run.status',data:{state:'paused',reasonCode:null}}]};
 return {...x,args,capture:(value=args)=>x.f.store.lifecycle.captureSession(value,check),inspect:(value={binding,scopes,selectedClientId:id(5),checkpointId:binding.runId})=>x.f.store.lifecycle.readSessionCapture(value,check)};
}
test('capture uses actual SDK reference, retains opaque main/substream history and requires later settlement',async t=>{const x=await fixture(t);
 const captured=await x.capture();assert.equal(captured.state,'APPLIED');assert.equal(captured.proof.kind,'native-session');assert.equal(captured.checkpointId,binding.runId);
 assert.equal(captured.proof.sdkSession.entriesCount,22);assert.equal(captured.proof.checkpointSha256,hash({sdkSession:captured.proof.sdkSession,files:captured.proof.files}));assert.equal(x.f.state.checkpoints.size,0);
 assert.equal(await x.state(),'paused');await assert.rejects(x.inspect(),/UNSETTLED/);await x.settle(binding);
 assert.deepEqual((await x.inspect()).proof,captured.proof);const before=x.f.state.events.get(rowKey(binding)).length;
 assert.deepEqual((await x.capture()).proof,captured.proof);assert.equal(x.f.state.events.get(rowKey(binding)).length,before);
});

function artifactFiles(selectedScopes=scopes){const entry=(path,n)=>({path,kind:'file',executable:false,object:{objectId:id(n),versionId:'actual-synthetic-object-version',sha256:'a'.repeat(64),bytes:5,scopes:selectedScopes}});
 return {workspace:{contractVersion:'0.1.0',manifestId:id(7100),binding,logicalCwd:'/workspace/conversation',entries:[entry('output/report.txt',7101)],scopes:selectedScopes,createdAt:new Date(at).toISOString()},tasks:[entry('1.json',7102)]};}
const artifactRequest=(overrides={})=>({binding,scopes,selectedClientId:id(5),versionId:id(7101),...overrides});
test('public native file read returns the exact settled workspace entry, never task JSON or an upload alone',async t=>{
 const files=artifactFiles(),x=await fixture(t,{files}),read=v=>x.f.store.lifecycle.readArtifactFile(v??artifactRequest(),check);
 assert.equal(await read(),null,'unpublished upload is not a public file');await x.capture();await assert.rejects(read(),/UNSETTLED/);await x.settle(binding);
 assert.deepEqual(await read(),{kind:'native-file',binding,scopes,manifestId:files.workspace.manifestId,createdAt:files.workspace.createdAt,entry:files.workspace.entries[0]});
 assert.equal(await read(artifactRequest({versionId:id(7102)})),null,'native task state stays private');assert.equal(await read(artifactRequest({versionId:id(7199)})),null);
 assert.equal(x.f.state.checkpoints.size,0);assert.equal(x.f.state.allocations.size,0);
});
for(const changed of ['actor','tenant','client','scope','cancelled','owner','proof','SQL'])test(`public native file refuses ${changed} rather than falling back to an object lookup`,async t=>{
 const x=await fixture(t,{files:artifactFiles()});await x.capture();await x.settle(binding);const value=artifactRequest(),run=x.f.state.runs.get(rowKey(binding)),saved=[...x.f.state.controls.values()][0];
 if(changed==='actor')value.binding={...binding,actorId:id(7199)};
 if(changed==='tenant')value.binding={...binding,tenantId:id(7199)};
 if(changed==='client')value.selectedClientId=id(7199);
 if(changed==='scope')value.scopes=[{...scopes[0],resourceId:id(7199)}];
 if(changed==='cancelled'){run.projection.state='cancelled';run.projection_sha256=hash(run.projection);}
 if(changed==='owner'){const row=x.f.state.sdkSessions.get(rowKey(binding));row.owner.executionSha256='e'.repeat(64);row.owner_sha256=hash(row.owner);}
 if(changed==='proof')saved.projection.proof.files.workspace.entries[0].object.sha256='f'.repeat(64);
 if(changed==='SQL')x.f.state.artifactLookupFailure=true;
 await assert.rejects(x.f.store.lifecycle.readArtifactFile(value,check));
});
test('published completion file is readable from an authorized later turn after source range closure',async t=>{
 t.mock.timers.enable({apis:['Date'],now:at});const x=await nativeFixture();await x.running(binding);x.seed(binding);const files=artifactFiles();
 const input={binding,scopes,selectedClientId:id(5),completionId:binding.runId,checkpointId:binding.runId,kind:'native-session',sessionId:x.sessionKey.sessionId,filesRequestSha256:hash(files)};
 const capture=await x.f.store.completions.begin(input,check),event=(eventId,type,data)=>({contractVersion:'0.1.0',eventId,createdAt:new Date(at).toISOString(),type,data});
 await x.f.store.completions.publish({...input,files,events:[event(capture.verifiedEventId,'checkpoint.verified',{checkpointId:binding.runId}),event(capture.completedEventId,'run.status',{state:'completed',reasonCode:null})]},check);await x.settle(binding);
 const target=(await x.select()).binding;await x.accept(target,'Continue the same conversation.');
 const result=await x.f.store.lifecycle.readArtifactFile(artifactRequest({binding:target}),check);assert.deepEqual(result.entry,files.workspace.entries[0]);assert.deepEqual(result.binding,binding);
 assert.notEqual(x.f.state.runs.get(rowKey(binding)).sequence_end,null);
});
for(const mode of ['resume','fork'])test(`native ${mode} exposes only its exact committed source workspace, with no unrelated conversation lookup`,async t=>{
 const files=artifactFiles(),x=await fixture(t,{files}),captured=await x.capture();await x.settle(binding);await nativeAdmission(x);
 const receipt=await x.f.control({controlId:id(6000),intent:mode,checkpointId:binding.runId,checkpointSha256:captured.proof.checkpointSha256}),query=artifactRequest({binding:receipt.targetBinding});
 assert.deepEqual((await x.f.store.lifecycle.readArtifactFile(query,check)).entry,files.workspace.entries[0]);
 assert.equal(await x.f.store.lifecycle.readArtifactFile({...query,versionId:id(7199)},check),null);
 const row=x.f.state.runs.get(rowKey(receipt.targetBinding));row.continuation.continuation.files.workspace.entries[0].object.sha256='f'.repeat(64);row.continuation_sha256=hash(row.continuation);
 if(mode==='fork')await assert.rejects(x.f.store.lifecycle.readArtifactFile(query,check),/STORE_CORRUPT/);
});
test('General native file requires explicit null and exact actor-private scope',async t=>{
 t.mock.timers.enable({apis:['Date'],now:at});const privateScopes=[{tenantId:binding.tenantId,kind:'private-user',resourceId:binding.actorId,policyRevision:scopes[0].policyRevision}],f=await lifecycleFixture({scopes:privateScopes,selectedClientId:null});t.after(f.close);
 await f.running();await f.capture();await f.control({controlId,intent:'pause'});await f.claim(controlId);const files=artifactFiles(privateScopes),args={binding,scopes:privateScopes,selectedClientId:null,controlId,sessionId:id(223),requestSha256:hash(files)};
 await f.store.lifecycle.beginFileCapture(args,check);await f.store.lifecycle.recordFiles({...args,files},check);await f.service.recordCheckpoint({credential:f.credential,binding,input:{controlId,sessionId:id(223)}});await settleInvocation(f.store,binding);
 const query=artifactRequest({scopes:privateScopes,selectedClientId:null});assert.deepEqual((await f.store.lifecycle.readArtifactFile(query,check)).entry,files.workspace.entries[0]);
 await assert.rejects(f.store.lifecycle.readArtifactFile({...query,selectedClientId:id(5)},check));
 await assert.rejects(f.store.lifecycle.readArtifactFile({...query,scopes:[{...privateScopes[0],resourceId:id(7199)}]},check));
});
for(const changed of ['session','actor','tenant','client','scope'])test(`capture refuses changed ${changed} without creating a checkpoint`,async t=>{const x=await fixture(t),args=structuredClone(x.args);
 if(changed==='session')args.sessionId=id(5999);if(changed==='actor')args.binding.actorId='foreign';if(changed==='tenant')args.binding.tenantId='foreign';if(changed==='client')args.selectedClientId=id(5999);if(changed==='scope')args.scopes=[{...scopes[0],resourceId:id(5999)}];
 await assert.rejects(x.capture(args));assert.equal(await x.state(),'running');assert.equal(x.f.state.checkpoints.size,0);
});
for(const changed of ['stopping','settled','expired','owner','entries','stream'])test(`capture refuses ${changed} writer/data`,async t=>{const x=await fixture(t),row=x.f.state.executions.get(rowKey(binding));
 if(changed==='stopping')row.record.phase='stopping';if(changed==='settled'){row.record.phase='settled';row.record.native={state:'paused'};}if(changed==='expired')row.record.expiresAtMs=at;
 row.record_sha256=hash(row.record);
 if(changed==='owner'){const session=x.f.state.sdkSessions.get(rowKey(binding));session.owner.executionSha256='e'.repeat(64);session.owner_sha256=hash(session.owner);}
 if(changed==='entries')x.f.state.sdkEntries[0].entry.opaque.changed=true;
 if(changed==='stream')x.f.state.sdkStreams[1].last_sequence++;
 await assert.rejects(x.capture());assert.equal(await x.state(),'running');assert.equal(x.f.state.checkpoints.size,0);
});
test('late append, changed owner and cancelled source never release a captured reference',async t=>{const x=await fixture(t);await x.capture();await x.settle(binding);
 const row=x.f.state.sdkSessions.get(rowKey(binding));row.entries_count++;await assert.rejects(x.inspect());row.entries_count--;
 row.owner.selectedClientId=id(5999);row.owner_sha256=hash(row.owner);await assert.rejects(x.inspect());row.owner.selectedClientId=id(5);row.owner_sha256=hash(row.owner);
 const run=x.f.state.runs.get(rowKey(binding));run.projection.state='cancelled';run.projection_sha256=hash(run.projection);await assert.rejects(x.inspect());
});
test('completed native history is inspectable without a fabricated workspace checkpoint',async t=>{t.mock.timers.enable({apis:['Date'],now:at});const x=await nativeFixture();await x.complete();
 const saved=await x.f.store.lifecycle.readSessionCapture({binding,scopes,selectedClientId:id(5),checkpointId:binding.runId},check);
 assert.equal(saved.proof.kind,'native-session');assert.equal(saved.proof.sdkSession.entriesCount,22);assert.equal(saved.approval,null);assert.equal(x.f.state.checkpoints.size,0);
});
test('actual lifecycle service resumes a settled native capture and restores exact opaque streams',async t=>{const x=await fixture(t),captured=await x.capture();await x.settle(binding);
 const result=await x.f.control({controlId:id(5100),intent:'resume',checkpointId:binding.runId,checkpointSha256:captured.proof.checkpointSha256});
 assert.equal(result.state,'APPLIED');assert.equal(result.targetBinding.writerFence,2);
 const request={binding:result.targetBinding,scopes,selectedClientId:id(5)},saved=await x.f.store.lifecycle.execution(request,check);
 assert.equal(saved.continuation.kind,'native-session');assert.deepEqual(saved.continuation.sdkSession,captured.proof.sdkSession);
 assert.equal(await x.f.store.nextRuns.execution(request,check),null,'a resume cannot become a new prompt lineage');
 const snapshot=await x.f.store.lifecycle.sessionSnapshot(request,check);assert.deepEqual(snapshot.transcripts,x.transcripts);
 assert.equal(x.f.state.checkpoints.size,0);assert.equal(x.f.state.allocations.size,0);assert.equal(x.f.state.retirements,1);
});
async function nativeAdmission(x,{alter=()=>{},fork=true}={}){
 let n=6100,calls=0;
 const owner=createNativeLifecycleAdmission({store:x.f.store,versions,runWindowMs:60000,now:()=>at,newId:()=>id(n++),...(fork?{admitFork:async value=>{
  calls++;assert.deepEqual(value.sourceBinding,binding);assert.deepEqual(value.scopes,scopes);assert.equal(value.selectedClientId,id(5));
  const target={...binding,conversationId:id(6200),runId:id(6201),attemptId:id(6202),workerId:id(6203),writerFence:1};
  const result={binding:target,expiresAtMs:at+60000,bootstrap:{schemaVersion:1,requestId:value.controlId,conversationId:target.conversationId,tenantId:binding.tenantId,actorId:binding.actorId,clientId:id(5)}};
  alter(result);return result;
 }}:{})});
 Object.assign(x.f.nativeAdmission,owner);return ()=>calls;
}
for(const mode of ['resume','fork'])test(`native ${mode} uses settled writer and canonical persisted origin without allocation or stop`,async t=>{
 const x=await fixture(t),captured=await x.capture();await x.settle(binding);const calls=await nativeAdmission(x),input={controlId:id(6000),intent:mode,checkpointId:binding.runId,checkpointSha256:captured.proof.checkpointSha256};
 const result=await x.f.control(input);assert.equal(result.state,'APPLIED');assert.equal(calls(),mode==='fork'?1:0);assert.equal(x.f.state.allocations.size,0);assert.equal(x.f.state.retirements,0);
 const selection={binding:result.targetBinding,scopes,selectedClientId:id(5)},origin=await x.f.store.lifecycle.continuationOrigin(selection,check);
 assert.deepEqual(origin,{controlId:input.controlId,mode,sourceBinding:binding,bootstrap:mode==='resume'?null:{schemaVersion:1,requestId:input.controlId,conversationId:result.targetBinding.conversationId,tenantId:binding.tenantId,actorId:binding.actorId,clientId:id(5)}});
 assert.deepEqual((await x.f.store.lifecycle.sessionSnapshot(selection,check)).transcripts,x.transcripts);
 const replay=await x.f.control(input);assert.equal(replay.replayed,true);assert.deepEqual(replay.targetBinding,result.targetBinding);assert.equal(calls(),mode==='fork'?1:0);
 const row=[...x.f.state.controls.values()].find(r=>r.control_id===input.controlId);assert.ok(row);row.projection.state='UNKNOWN';row.projection_sha256=hash(row.projection);
 await assert.rejects(x.f.store.lifecycle.continuationOrigin(selection,check),/TRANSITION_REFUSED/);
});
for(const change of ['request','conversation','tenant','actor','client','absent'])test(`fork refuses ${change} bootstrap receipt and never inserts a Meri target`,async t=>{
 const x=await fixture(t),captured=await x.capture();await x.settle(binding);const calls=await nativeAdmission(x,{alter:r=>{if(change==='absent')delete r.bootstrap;else r.bootstrap[{request:'requestId',conversation:'conversationId',tenant:'tenantId',actor:'actorId',client:'clientId'}[change]]=id(6999);}});
 const before=x.f.state.runs.size;await assert.rejects(x.f.control({controlId:id(6000),intent:'fork',checkpointId:binding.runId,checkpointSha256:captured.proof.checkpointSha256}),/UNKNOWN/);
 assert.equal(calls(),1);assert.equal(x.f.state.runs.size,before);const replay=await x.f.control({controlId:id(6000),intent:'fork',checkpointId:binding.runId,checkpointSha256:captured.proof.checkpointSha256});assert.equal(replay.state,'UNKNOWN');assert.equal(calls(),1);
});

for(const terminal of ['completed','failed','cancelled'])test(`committed native origin ${terminal} target readback preserves terminal truth`,async t=>{
 const x=await fixture(t),captured=await x.capture();await x.settle(binding);await nativeAdmission(x);
 const result=await x.f.control({controlId:id(6000),intent:'resume',checkpointId:binding.runId,checkpointSha256:captured.proof.checkpointSha256});
 const target=result.targetBinding,selection={binding:target,scopes,selectedClientId:id(5)};
 for(const [index,state] of ['starting','running',terminal].entries())await x.f.store.append(target,{eventId:id(6300+index),createdAt:new Date(at).toISOString(),type:'run.status',data:{state,reasonCode:state==='cancelled'?'USER_CANCELLED':null}},check);
 if(terminal==='cancelled')await assert.rejects(x.f.store.lifecycle.continuationOrigin(selection,check),/TRANSITION_REFUSED/);
 else assert.deepEqual(await x.f.store.lifecycle.continuationOrigin(selection,check),{controlId:id(6000),mode:'resume',sourceBinding:binding,bootstrap:null});
 assert.equal((await x.f.store.read(target,{},check)).run.state,terminal,'readback never changes or redispatches the target');
});

for(const mode of ['resume','fork'])test(`explicit General native ${mode} preserves actor-private scope and null client through capture and readback`,async t=>{
 t.mock.timers.enable({apis:['Date'],now:at});const privateScopes=[{tenantId:binding.tenantId,kind:'private-user',resourceId:binding.actorId,policyRevision:scopes[0].policyRevision}],f=await lifecycleFixture({scopes:privateScopes,selectedClientId:null});t.after(f.close);
 await f.running();await f.control({controlId:id(6500),intent:'pause'});await f.claim(id(6500));await f.checkpoint(id(6500));
 const saved=await f.store.lifecycle.readSessionCapture({binding,scopes:privateScopes,selectedClientId:null,checkpointId:binding.runId},check);
 assert.deepEqual(saved.proof.scopes,privateScopes);assert.equal(f.state.sdkSessions.get(rowKey(binding)).owner.selectedClientId,null);
 for(const selected of [id(5),id(999)])await assert.rejects(f.store.lifecycle.readSessionCapture({binding,scopes:privateScopes,selectedClientId:selected,checkpointId:binding.runId},check));
 const result=await f.control({controlId:id(6501),intent:mode,checkpointId:binding.runId,checkpointSha256:saved.proof.checkpointSha256});assert.equal(result.state,'APPLIED');
 const selection={binding:result.targetBinding,scopes:privateScopes,selectedClientId:null},origin=await f.store.lifecycle.continuationOrigin(selection,check);
 assert.equal(origin.mode,mode);if(mode==='fork'){assert.equal(origin.bootstrap.schemaVersion,2);assert.equal(origin.bootstrap.scopeKind,'general');assert.equal(origin.bootstrap.clientId,null);}else assert.equal(origin.bootstrap,null);
 assert.deepEqual((await f.store.lifecycle.sessionSnapshot(selection,check)).sdkSession,saved.proof.sdkSession);
 const session=f.state.sdkSessions.get(rowKey(binding));session.owner.scopes=[{...privateScopes[0],resourceId:'foreign-actor'}];session.owner_sha256=hash(session.owner);
 await assert.rejects(f.store.lifecycle.sessionSnapshot(selection,check));
});
