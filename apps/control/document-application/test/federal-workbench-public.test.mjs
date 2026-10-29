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

async function fixture(t){
 const binding={tenantId:id(100),actorId:id(101),conversationId:id(102),runId:id(103),attemptId:id(104),workerId:id(105),writerFence:1};
 const clientId=id(106),scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:clientId,policyRevision:'policy1'}];
 const f=nativeDocumentFixture({binding,scopes}),source=sourceFor();
 const retained=await f.run({...f.call,request:{...f.call.request,title:'Synthetic federal source',content:{text:JSON.stringify(source)}}});
 const {deadlineMs}=f.context,now=f.options.now;
 const state={closed:false,revoked:false,artifactChecks:0},ports=createLocalDocumentPorts({binding,scopes,clientId,deadlineMs,now,state});
 t.after(()=>ports.sessions.close());
 const limits={maxRequestMs:5000,maxRequestBytes:1048576,maxResponseBytes:2097152};
 const compose=createRuntimeDocumentOptionsComposer({storage:{objects:f.options.objects,versions:f.options.versions},executor:f.options.executor,
  pool:f.options.pool,store:{lifecycle:{readArtifactFile:async()=>null}},sessions:ports.sessions,now});
 let denyRelease=false;
 const optionsOwner={async resolve(){return {documentOptions:compose({artifactOptions:{...f.options,authorize:ports.authorize,
  ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()})},selectedClientId:clientId,limits,enabled:true}),
  async recheck(check){if(denyRelease&&check.phase==='release')throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});}};}};
 const runtime=createRuntimeArtifactApplication({sessions:ports.sessions,optionsOwner,now,limits});
 const listeners=createControlRouteApplications({assembly:runtime,candidate:{async handle(){return null;}}});
 const session=await ports.sessions.issue({identityCredential:ports.nativeCredential});
 const post=(intent,body)=>listeners.public.handle(new Request('https://meri.synthetic.invalid/api/documents/'+intent,{method:'POST',
  headers:{authorization:'Bearer '+session.credential,'content-type':'application/json'},body:JSON.stringify(body)}));
 const selection={versionId:retained.version.versionId,expectedArtifactSha256:retained.version.object.sha256,operations:[opFor(source)]};
 return {f,state,source,selection,post,deny:()=>{denyRelease=true;},allow:()=>{denyRelease=false;},
  suppress:()=>f.sql.suppressed.add(binding.tenantId+':artifact:'+retained.version.artifactId),
  reads:createArtifactService({...f.options,ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()})})};
}
async function ok(response){const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));return body;}
const publication=(selection,revisionSha256,output,extra={})=>({selection,revisionSha256,output,deliveryId:randomUUID(),baseVersionId:null,baseRevisionSha256:null,...extra});

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
});
