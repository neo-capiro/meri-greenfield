import {scopedSource} from '../../../artifacts/federal-drafting/test/scoped-fixture.mjs';
/** Mounted native document application, deterministic compiler and canonical artifact owners;
 * SQL/object storage and native identity are isolated synthetic ports, not live qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {nativeDocumentFixture} from '../../../artifacts/test/native-document-fixture.mjs';
import {id} from '../../../artifacts/storage/test/sql-fixture.mjs';
import {sourceFor,opFor} from '../../../artifacts/federal-drafting/test/fixtures.mjs';
import {createLocalDocumentPorts} from '../local/ports.mjs';
import {createRuntimeArtifactApplication} from '../../../runtime/artifacts/application.mjs';
import {createRuntimeDocumentOptionsComposer} from '../../../runtime/artifacts/composition.mjs';
import {createControlRouteApplications} from '../../../runtime/control-route-boundary.mjs';
import {createArtifactService} from '../../../artifacts/service.mjs';
import {generateFederalWorkbench} from '../../../../packages/contracts/generate-federal-workbench.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import official from '../../../../packages/contracts/test/fixtures/federal-draft-source.wire.json' with {type:'json'};
import {projectNativeFederalSource} from '../../../artifacts/federal-drafting/native-source.mjs';
import * as distributedFederal from '@capiro/meri-contracts/federal-workbench';

test('public package admits the mounted official import and downloaded envelope', async t => {
 const x=await fixture(t,{native:true}),bytes=value=>new TextEncoder().encode(JSON.stringify(value));
 const input=distributedFederal.receiveFederalRequest('federal-import',bytes(importRequest()));
 const response=await x.post('federal-import',input),raw=await response.json();
 const received=await distributedFederal.receiveFederalResponse('federal-import',response.status,bytes(raw),input);
 assert.deepEqual(received,raw);
 const downloaded=await x.reads.download(received.publication.version.versionId,x.f.context);
 assert.deepEqual(await distributedFederal.receiveFederalSource(downloaded.bytes),received.source);
 const changed=structuredClone(raw);changed.selection.revisionId=randomUUID();
 await assert.rejects(distributedFederal.receiveFederalResponse('federal-import',200,bytes(changed),input));
});

async function fixture(t,{native=false,nested=false}={}){
 const binding={tenantId:id(100),actorId:id(101),conversationId:id(102),runId:id(103),attemptId:id(104),workerId:id(105),writerFence:1};
 const clientId=id(106),scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:clientId,policyRevision:'policy1'}];
 const f=nativeDocumentFixture({binding,scopes}),source=nested?scopedSource():sourceFor();
 const retained=await f.run({...f.call,request:{...f.call.request,title:'Synthetic federal source',content:{text:JSON.stringify(source)}}});
 const {deadlineMs}=f.context,now=f.options.now;
 const state={closed:false,revoked:false,artifactChecks:0},ports=createLocalDocumentPorts({binding,scopes,clientId,deadlineMs,now,state});
 const nativeState={calls:0,available:true,mutate:null};
 const federalSource={async read({selection,signal}){
  assert.equal(signal.aborted,false);assert.deepEqual(selection,official.request);nativeState.calls++;
  const result=nativeState.available?structuredClone(official.response):{tool:'read_federal_draft_source',authoritativeOwner:'federal_evidence_current',currentStatus:'unavailable',selection,reason:'exact_current_source_unavailable'};
  nativeState.mutate?.(result);return result;
 }};
 t.after(()=>ports.sessions.close());
 const limits={maxRequestMs:5000,maxRequestBytes:1048576,maxResponseBytes:2097152};
 const compose=createRuntimeDocumentOptionsComposer({storage:{objects:f.options.objects,versions:f.options.versions},executor:f.options.executor,
  pool:f.options.pool,store:{lifecycle:{readArtifactFile:async()=>null}},sessions:ports.sessions,now});
 let denyRelease=false;
 const optionsOwner={async resolve(){return {documentOptions:compose({artifactOptions:{...f.options,authorize:ports.authorize,
  ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()})},selectedClientId:clientId,limits,enabled:true,...(native?{federalSource}:{})}),
  async recheck(check){if(denyRelease&&check.phase==='release')throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});}};}};
 const runtime=createRuntimeArtifactApplication({sessions:ports.sessions,optionsOwner,now,limits});
 const listeners=createControlRouteApplications({assembly:runtime,candidate:{async handle(){return null;}}});
 const session=await ports.sessions.issue({identityCredential:ports.nativeCredential});
 const post=(intent,body)=>listeners.public.handle(new Request('https://meri.synthetic.invalid/api/documents/'+intent,{method:'POST',
  headers:{authorization:'Bearer '+session.credential,'content-type':'application/json'},body:JSON.stringify(body)}));
 const selection={versionId:retained.version.versionId,expectedArtifactSha256:retained.version.object.sha256,operations:[opFor(source,{scopeId:nested?'a':'section-1'})]};
 return {f,state,nativeState,source,selection,post,deny:()=>{denyRelease=true;},allow:()=>{denyRelease=false;},
  suppress:()=>f.sql.suppressed.add(binding.tenantId+':artifact:'+retained.version.artifactId),
  reads:createArtifactService({...f.options,ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()})})};
}
async function ok(response){const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));return body;}
const publication=(selection,revisionSha256,output,extra={})=>({selection,revisionSha256,output,deliveryId:randomUUID(),baseVersionId:null,baseRevisionSha256:null,...extra});
const importRequest=()=>({selection:structuredClone(official.request),deliveryId:randomUUID()});
const importedSelection=result=>({versionId:result.publication.version.versionId,expectedArtifactSha256:result.publication.version.object.sha256,
 operations:[opFor(result.source,{scopeId:'document',expectedText:'$20',text:'$25'})]});

test('nested retained source saves, reloads, exports and revises through the public receiver and immutable history',async t=>{
 const x=await fixture(t,{nested:true}),bytes=value=>new TextEncoder().encode(JSON.stringify(value));
 assert.deepEqual(await distributedFederal.receiveFederalSource(bytes(x.source)),x.source);
 const prepare=distributedFederal.receiveFederalRequest('federal-prepare',bytes({selection:x.selection}));
 const review=await distributedFederal.receiveFederalResponse('federal-prepare',200,bytes(await ok(await x.post('federal-prepare',prepare))),prepare);
 assert.equal(review.prepared.draft.outputs.consolidated,x.source.text.replace('$100','$150'));
 let saved;
 for(const output of ['draft','operative','consolidated','redline']){
  const request=distributedFederal.receiveFederalRequest('federal-publish',bytes(publication(x.selection,review.prepared.revisionSha256,output)));
  const exported=await distributedFederal.receiveFederalResponse('federal-publish',200,bytes(await ok(await x.post('federal-publish',request))),request,review);
  const downloaded=await x.reads.download(exported.publication.version.versionId,x.f.context);
  if(output==='draft')saved=exported;
  else assert.equal(downloaded.bytes.toString('utf8'),review.prepared.draft.outputs[output]);
  const count=x.f.state.executions.length;
  assert.equal((await ok(await x.post('federal-publish',request))).publication.version.versionId,exported.publication.version.versionId);
  assert.equal(x.f.state.executions.length,count);
 }
 const load=distributedFederal.receiveFederalRequest('federal-load',bytes({versionId:saved.publication.version.versionId,expectedArtifactSha256:saved.publication.version.object.sha256}));
 const loaded=await distributedFederal.receiveFederalResponse('federal-load',200,bytes(await ok(await x.post('federal-load',load))),load);
 assert.deepEqual(loaded.prepared,review.prepared);
 const selection={...x.selection,operations:[opFor(x.source,{scopeId:'a',text:'$175'})]};
 const next=await ok(await x.post('federal-prepare',{selection}));
 const child=await ok(await x.post('federal-publish',publication(selection,next.prepared.revisionSha256,'draft',{
  baseVersionId:saved.publication.version.versionId,baseRevisionSha256:review.prepared.revisionSha256})));
 assert.equal(child.publication.version.parentVersionId,saved.publication.version.versionId);
 assert.equal(child.publication.version.artifactId,saved.publication.version.artifactId);
 assert.equal(next.prepared.approval,'unapproved');
 const writes=x.f.state.executions.length;x.suppress();
 assert.notEqual((await x.post('federal-load',load)).status,200);
 assert.notEqual((await x.post('federal-publish',publication(selection,next.prepared.revisionSha256,'operative'))).status,200);
 assert.equal(x.f.state.executions.length,writes);
});

test('invalidated ancestor paths refuse atomically through mounted prepare/publish and the distributed receiver',async t=>{
 const x=await fixture(t,{nested:true}),bytes=value=>new TextEncoder().encode(JSON.stringify(value));
 const valid=await ok(await x.post('federal-prepare',{selection:x.selection}));
 const selection={...x.selection,operations:[
  opFor(x.source,{id:'cross-parent',scopeId:'document',expectedText:'Act\r\nSEC. 1.',text:'New introduction.'}),
  opFor(x.source,{id:'use-child',scopeId:'b',text:'$200',dependsOn:['cross-parent']})]};
 const before=structuredClone(selection),writes=x.f.state.executions.length;
 for(const [route,body] of [['federal-prepare',{selection}],['federal-publish',publication(selection,valid.prepared.revisionSha256,'draft')]]){
  const request=distributedFederal.receiveFederalRequest(route,bytes(body));
  const response=await x.post(route,request),raw=await response.json();
  assert.equal(response.status,422);assert.equal(raw.error.code,'DRAFT_PREPARATION_REFUSED');
  const refused=await distributedFederal.receiveFederalResponse(route,response.status,bytes(raw),request);
  assert.deepEqual(refused,raw);assert.equal('prepared' in refused,false);assert.equal('publication' in refused,false);
  assert.equal(x.f.state.executions.length,writes);assert.deepEqual(selection,before);
 }
 // A failed candidate must not corrupt the existing source or valid review.
 const unchanged=await ok(await x.post('federal-prepare',{selection:x.selection}));
 assert.deepEqual(unchanged.prepared,valid.prepared);assert.equal(x.f.state.executions.length,writes);
});

test('official import retains exact Core projection and replays original custody before review and export',async t=>{
 const x=await fixture(t,{native:true}),input=importRequest(),result=await ok(await x.post('federal-import',input));
 assert.deepEqual(result.source,projectNativeFederalSource(official.request,official.response));
 const bytes=await x.reads.download(result.publication.version.versionId,x.f.context);
 assert.deepEqual(JSON.parse(bytes.bytes),{schema:result.schema,selection:result.selection,source:result.source});
 const count=x.f.state.executions.length;
 assert.equal((await ok(await x.post('federal-import',input))).publication.version.versionId,result.publication.version.versionId);
 assert.equal(x.f.state.executions.length,count);
 const selection=importedSelection(result),review=await ok(await x.post('federal-prepare',{selection}));
 const saved=await ok(await x.post('federal-publish',publication(selection,review.prepared.revisionSha256,'draft')));
 const load={versionId:saved.publication.version.versionId,expectedArtifactSha256:saved.publication.version.object.sha256};
 await ok(await x.post('federal-load',load));
 await ok(await x.post('federal-publish',publication(selection,review.prepared.revisionSha256,'operative')));
 const before=x.f.state.executions.length;x.nativeState.available=false;
 for(const [route,body] of [['federal-import',importRequest()],['federal-prepare',{selection}],['federal-load',load],['federal-publish',publication(selection,review.prepared.revisionSha256,'redline')]]){
  const response=await x.post(route,body);assert.equal(response.status,409);assert.equal((await response.json()).error.code,'DRAFT_SOURCE_STALE');
 }
 assert.equal(x.f.state.executions.length,before);
});

test('official marker never substitutes for a current Core reader; changed metadata refuses',async t=>{
 const x=await fixture(t),source=projectNativeFederalSource(official.request,official.response);
 const retained=await x.f.run({...x.f.call,deliveryId:randomUUID(),request:{...x.f.call.request,content:{text:JSON.stringify({schema:'meri.federal-source.v1',selection:official.request,source})}}});
 const selection=importedSelection({source,publication:retained});
 assert.equal((await x.post('federal-import',importRequest())).status,503);
 assert.equal((await x.post('federal-prepare',{selection})).status,503);
 const y=await fixture(t,{native:true}),result=await ok(await y.post('federal-import',importRequest()));
 y.nativeState.mutate=value=>{value.source.fetchedAt='2026-01-04T00:00:00.000Z';};
 assert.equal((await y.post('federal-prepare',{selection:importedSelection(result)})).status,409);
});

test('source change before commit preserves an unknown original delivery without repeating generation',async t=>{
 const x=await fixture(t,{native:true}),input=importRequest();
 x.f.state.executorHook=()=>{x.nativeState.available=false;};
 const result=await x.post('federal-import',input);assert.notEqual(result.status,200);
 const before=x.f.state.executions.length;
 assert.notEqual((await x.post('federal-import',input)).status,200);assert.equal(x.f.state.executions.length,before);
 x.f.state.executorHook=null;x.nativeState.available=true;
 const retry=await x.post('federal-import',input);assert.notEqual(retry.status,200);
 assert.equal((await retry.json()).error.outcome,'UNKNOWN');assert.equal(x.f.state.executions.length,before);
});

test('committed import withheld at release recovers the same version after current authority returns',async t=>{
 const x=await fixture(t,{native:true}),input=importRequest();x.deny();
 const response=await x.post('federal-import',input);assert.equal(response.status,403);
 assert.equal((await response.json()).error.outcome,'RESULT_NOT_RELEASED');
 const count=x.f.state.executions.length;x.allow();
 await ok(await x.post('federal-import',input));assert.equal(x.f.state.executions.length,count);
});

test('public source preparation, saved review reload and all three confirmed exact exports use existing custody',async t=>{
 const x=await fixture(t),before=x.f.state.executions.length;
 const review=await ok(await x.post('federal-prepare',{selection:x.selection}));
 assert.equal(x.f.state.executions.length,before);assert.equal(review.prepared.approval,'unapproved');
 const revision=review.prepared.revisionSha256;
 const saved=await ok(await x.post('federal-publish',publication(x.selection,revision,'draft')));
 assert.equal(saved.review,'unapproved');
 const loaded=await ok(await x.post('federal-load',{versionId:saved.publication.version.versionId,expectedArtifactSha256:saved.publication.version.object.sha256}));
 assert.deepEqual(loaded.prepared,review.prepared);assert.equal(loaded.savedDraft.versionId,saved.publication.version.versionId);
 for(const kind of ['operative','consolidated','redline']){
  const request=publication(x.selection,revision,kind),exported=await ok(await x.post('federal-publish',request));
  assert.equal(exported.revisionSha256,revision);assert.equal(exported.review,'confirmed-for-export');
  const download=await x.reads.download(exported.publication.version.versionId,x.f.context);
  assert.equal(download.bytes.toString('utf8'),review.prepared.draft.outputs[kind]);
  const count=x.f.state.executions.length;
  const replay=await ok(await x.post('federal-publish',request));
  assert.equal(replay.publication.version.versionId,exported.publication.version.versionId);assert.equal(x.f.state.executions.length,count);
 }
});
test('changed revision, source hash and widened requests refuse before publication',async t=>{
 const x=await fixture(t),review=await ok(await x.post('federal-prepare',{selection:x.selection})),before=x.f.state.executions.length;
 assert.equal((await x.post('federal-publish',publication(x.selection,'0'.repeat(64),'operative'))).status,409);
 assert.equal((await x.post('federal-prepare',{selection:{...x.selection,expectedArtifactSha256:'0'.repeat(64)}})).status,422);
 assert.equal((await x.post('federal-prepare',{selection:x.selection,approved:true})).status,400);
 assert.equal((await x.post('federal-publish',publication(x.selection,review.prepared.revisionSha256,'redline',{baseVersionId:randomUUID(),baseRevisionSha256:'0'.repeat(64)}))).status,400);
 assert.equal(x.f.state.executions.length,before);
});
test('release revocation withholds a committed exact export and its original delivery is recoverable',async t=>{
 const x=await fixture(t),review=await ok(await x.post('federal-prepare',{selection:x.selection}));
 const request=publication(x.selection,review.prepared.revisionSha256,'operative');x.deny();
 const response=await x.post('federal-publish',request);assert.equal(response.status,403);
 assert.equal((await response.json()).error.outcome,'RESULT_NOT_RELEASED');
 assert.equal(x.f.state.executions.length,2);
 x.allow();const recovered=await ok(await x.post('federal-publish',request));
 assert.equal(recovered.revisionSha256,review.prepared.revisionSha256);assert.equal(x.f.state.executions.length,2);
});

test('saved review revisions use the ordinary version chain and require the exact previous revision',async t=>{
 const x=await fixture(t),first=await ok(await x.post('federal-prepare',{selection:x.selection}));
 const saved=await ok(await x.post('federal-publish',publication(x.selection,first.prepared.revisionSha256,'draft')));
 const selected={...x.selection,operations:[opFor(x.source,{text:'An amended amount'})]};
 const next=await ok(await x.post('federal-prepare',{selection:selected}));
 const request=publication(selected,next.prepared.revisionSha256,'draft',{baseVersionId:saved.publication.version.versionId,baseRevisionSha256:first.prepared.revisionSha256});
 assert.equal((await x.post('federal-publish',{...request,baseRevisionSha256:'0'.repeat(64)})).status,409);
 const revised=await ok(await x.post('federal-publish',request));
 assert.equal(revised.publication.version.parentVersionId,saved.publication.version.versionId);
 assert.equal(revised.publication.version.artifactId,saved.publication.version.artifactId);
 const loaded=await ok(await x.post('federal-load',{versionId:revised.publication.version.versionId,expectedArtifactSha256:revised.publication.version.object.sha256}));
 assert.equal(loaded.prepared.revisionSha256,next.prepared.revisionSha256);
});

test('source suppression before publication refuses a new effect',async t=>{
 const x=await fixture(t),review=await ok(await x.post('federal-prepare',{selection:x.selection}));x.suppress();
 assert.notEqual((await x.post('federal-publish',publication(x.selection,review.prepared.revisionSha256,'operative'))).status,200);
 assert.equal(x.f.state.executions.length,1);
});

test('equal output bytes from a different retained source cannot reuse an earlier delivery',async t=>{
 const x=await fixture(t),review=await ok(await x.post('federal-prepare',{selection:x.selection}));
 const first=publication(x.selection,review.prepared.revisionSha256,'operative');
 await ok(await x.post('federal-publish',first));
 const source=await x.f.run({...x.f.call,deliveryId:randomUUID(),request:{...x.f.call.request,content:{text:JSON.stringify(x.source)}}});
 const selection={...x.selection,versionId:source.version.versionId,expectedArtifactSha256:source.version.object.sha256};
 const changed=await ok(await x.post('federal-prepare',{selection}));
 assert.equal(changed.prepared.draft.outputs.operative,review.prepared.draft.outputs.operative);
 assert.notEqual(changed.prepared.revisionSha256,review.prepared.revisionSha256);
 const before=x.f.state.executions.length;
 assert.notEqual((await x.post('federal-publish',{...first,selection,revisionSha256:changed.prepared.revisionSha256})).status,200);
 assert.equal(x.f.state.executions.length,before);
});

test('source suppression during an export withholds the result and prevents replay release',async t=>{
 const x=await fixture(t),review=await ok(await x.post('federal-prepare',{selection:x.selection}));
 x.f.state.executorHook=()=>x.suppress();
 const request=publication(x.selection,review.prepared.revisionSha256,'operative');
 assert.notEqual((await x.post('federal-publish',request)).status,200);
 assert.notEqual((await x.post('federal-publish',request)).status,200);
 assert.equal(x.f.state.executions.length,2);
});

test('generated browser receiver admits actual mounted bytes and refuses changed review/export content',async t=>{
 const outDir=await mkdtemp(join(tmpdir(),'meri-federal-receiver-'));
 t.after(()=>rm(outDir,{recursive:true,force:true}));
 await generateFederalWorkbench({outDir});
 const {receiveFederalRequest:request,receiveFederalResponse:receive,receiveFederalSource}=await import(pathToFileURL(join(outDir,'federal-workbench.mjs')));
 const bytes=value=>new TextEncoder().encode(JSON.stringify(value)),x=await fixture(t);
 assert.deepEqual(await receiveFederalSource(bytes(x.source)),x.source);
 await assert.rejects(receiveFederalSource(bytes({...x.source,text:x.source.text+'changed'})));
 const prepare=request('federal-prepare',bytes({selection:x.selection}));
 const response=await x.post('federal-prepare',prepare),raw=await response.json();
 const review=await receive('federal-prepare',200,bytes(raw),prepare);
 assert.equal(review.prepared.approval,'unapproved');
 for(const output of ['draft','operative','consolidated','redline']){
  const input=request('federal-publish',bytes(publication(x.selection,review.prepared.revisionSha256,output)));
  const produced=await ok(await x.post('federal-publish',input));
  const admitted=await receive('federal-publish',200,bytes(produced),input,review);
  assert.equal(admitted.output,output);
  const bad=structuredClone(produced);bad.publication.version.object.sha256='0'.repeat(64);
  await assert.rejects(receive('federal-publish',200,bytes(bad),input,review));
  await assert.rejects(receive('federal-publish',200,bytes(produced),input,structuredClone(review)));
  if(output==='draft'){
   const load=request('federal-load',bytes({versionId:produced.publication.version.versionId,expectedArtifactSha256:produced.publication.version.object.sha256}));
   const loaded=await receive('federal-load',200,bytes(await ok(await x.post('federal-load',load))),load);
   assert.equal(loaded.prepared.revisionSha256,review.prepared.revisionSha256);
  }
 }
 const changed=structuredClone(raw);changed.prepared.draft.outputs.consolidated+='changed';
 await assert.rejects(receive('federal-prepare',200,bytes(changed),prepare));
 await assert.rejects(receive('federal-prepare',200,bytes(raw),structuredClone(prepare)));
 assert.throws(()=>request('federal-prepare',bytes({selection:x.selection,approved:true})));
 const y=await fixture(t,{native:true}),imported=request('federal-import',bytes(importRequest()));
 const saved=await ok(await y.post('federal-import',imported));
 assert.deepEqual(await receive('federal-import',200,bytes(saved),imported),saved);
 const {publication:unused,...envelope}=saved;
 assert.deepEqual(await receiveFederalSource(bytes(envelope)),saved.source);
 for(const mutate of [r=>{r.source.text+='changed';},r=>{r.selection.revisionId=randomUUID();},r=>{r.publication.version.parentVersionId=randomUUID();},r=>{r.publication.version.object.sha256='0'.repeat(64);}]){
  const bad=structuredClone(saved);mutate(bad);await assert.rejects(receive('federal-import',200,bytes(bad),imported));
 }
});
