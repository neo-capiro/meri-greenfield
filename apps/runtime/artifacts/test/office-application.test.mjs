/** Actual native-session, runtime composition, artifact, token and Core-client
 * owners. Synthetic options authority, Core HTTP and SQL/object ports. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {wopiFixture} from '../../../artifacts/edit-sessions/test/wopi-fixture.mjs';
import {createCollaboraCodeLaunch} from '../../../artifacts/edit-sessions/collabora-code.mjs';
import {createRuntimeOfficeApplication} from '../office-application.mjs';
import {id} from '../../../artifacts/storage/test/sql-fixture.mjs';
import {ooxml} from '../../../artifacts/structure/test/fixtures.mjs';
async function fixture(t,{format='docx',discoveryFormat=format}={}){
 const f=await wopiFixture(t,{format}),now=f.options.now;
 const state=Object.assign(f.state,{observations:[],phaseHook:null,modeDenied:null});
 const limits={maxRequestMs:5000,maxRequestBytes:2097152,maxResponseBytes:16777216};
 const optionsOwner={async resolve(call){
  const required={revise:'artifact.revise',inspect:'artifact.inspect',download:'artifact.download'}[call.intent];
  const authorize=async x=>{if(x.action!==required||state.modeDenied===call.intent)throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});return f.artifactOptions.authorize(x);};
  return {documentOptions:{sessions:f.sessions,selectedClientId:f.claims.selectedClientId,artifactOptions:{...f.artifactOptions,now,authorize,ids:()=>({artifactId:id(960),versionId:id(961),objectId:id(962)})},now,limits,enabled:true},
   async recheck({phase}){state.observations.push({intent:call.intent,phase});await state.phaseHook?.(call.intent,phase);if(state.modeDenied===call.intent)throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});}};
 }};
 const discoveryBytes=Buffer.from(`<wopi-discovery><net-zone name="external-https"><app>${['edit','view'].map(mode=>`<action ext="${discoveryFormat}" name="${mode}" urlsrc="https://office.example.test/browser/synthetic/cool.html?"/>`).join('')}</app></net-zone></wopi-discovery>`);
 const launch=createCollaboraCodeLaunch({editorOrigin:'https://office.example.test',wopiOrigin:'https://wopi.example.test',discoveryBytes,codec:f.codec,now});
 const config={optionsOwner,sessions:f.sessions,now,limits,drafts:f.options.drafts,codec:f.codec,launch,generation:f.options.generation};
 const app=createRuntimeOfficeApplication(config),key={draftId:f.draft.draftId,versionId:f.first.version.versionId};
 const auth=()=>({credential:f.session.credential,deadlineMs:now()+5000});
 const execute=(route,extra={},chosen=auth())=>app.execute(route,{...key,...extra},chosen);
 const start=(extra={})=>execute('launch',{operation:'acquire',editorId:f.claims.editorId,expectedEpoch:0,mode:'edit',...extra});
 const wopi=(form,operation='checkFileInfo',extra={})=>{
  const original=f.request(operation,{...extra,token:form.fields.access_token}),url=new URL(original.url);
  url.pathname=url.pathname.replace('synthetic-file',f.draft.draftId);
  return app.handleWopi(new Request(url,original));
 };
 return {...f,state,app,execute,start,wopi,auth,key,config};
}
for(const format of ['docx','xlsx','pptx'])test(`${format}: attended open, launch, WOPI Save, recover and separate Publish`,async t=>{
 const f=await fixture(t,{format}),opened=await f.execute('open');
 assert.equal(opened.draft.sequence,0);assert.equal(opened.launch,null);assert.equal(Object.hasOwn(opened.draft,'bytesBase64'),false);
 const started=await f.start(),claims=f.codec.verify(started.launch.fields.access_token,{fileId:f.draft.draftId});
 assert.deepEqual(claims.runBinding,f.context.binding);assert.equal(claims.selectedClientId,f.claims.selectedClientId);
 assert.equal(claims.expiresAtMs,f.session.expiresAtMs);assert.ok(claims.expiresAtMs<Date.parse(started.editor.expiresAt));
 assert.equal((await f.wopi(started.launch,'lock',{lock:'CODE'})).status,200);
 assert.equal((await f.wopi(started.launch,'save',{lock:'CODE',body:ooxml(format)})).status,200);
 assert.equal(f.state.puts,1);assert.equal(f.sql.state.versions.size,1);
 const recovered=await f.execute('read');assert.equal(recovered.draft.sequence,1);assert.equal(recovered.launch,null);assert.equal(Object.hasOwn(recovered.draft,'bytesBase64'),false);
 const published=await f.execute('publish',{sequence:recovered.draft.sequence,sha256:recovered.draft.sha256});
 assert.equal(published.draft.state,'published');assert.equal(published.publication.version.parentVersionId,f.first.version.versionId);
 assert.equal(f.state.puts,2);assert.equal(f.state.executions.length,1);
});
test('renew clips the token to current native expiry and release invalidates WOPI while preserving private bytes',async t=>{
 const f=await fixture(t),started=await f.start();
 await f.wopi(started.launch,'lock',{lock:'CODE'});await f.wopi(started.launch,'save',{lock:'CODE',body:ooxml('docx')});
 f.state.clock+=1000;
 const renewed=await f.execute('renew',{editorId:started.editor.editorId,expectedEpoch:started.editor.epoch,mode:'edit'});
 assert.equal(renewed.launch.expiresAtMs,f.session.expiresAtMs);assert.equal(renewed.editor.epoch,started.editor.epoch);
 const released=await f.execute('release',{editorId:started.editor.editorId,expectedEpoch:started.editor.epoch});
 assert.equal(released.editor.editorId,null);assert.equal(released.draft.sequence,1);assert.equal(f.state.lock,'');
 assert.equal((await f.wopi(renewed.launch)).status,404);assert.equal((await f.execute('read')).draft.sha256,renewed.draft.sha256);
});
test('only explicit takeover replaces an active editor and old tokens no longer read or save',async t=>{
 const f=await fixture(t),started=await f.start();
 await assert.rejects(f.start({editorId:id(702),expectedEpoch:1}),{code:'OFFICE_DRAFT_CONFLICT'});
 const next=await f.start({operation:'takeover',editorId:id(702),expectedEpoch:1});assert.equal(next.editor.epoch,2);
 assert.equal((await f.wopi(started.launch)).status,404);assert.equal((await f.wopi(next.launch)).status,200);
});
test('missing discovery action and wrong selected source refuse before acquiring an editor',async t=>{
 const f=await fixture(t,{discoveryFormat:'xlsx'});
 await assert.rejects(f.start(),{code:'EDITOR_CODE_ACTION_UNAVAILABLE'});
 assert.ok(!f.state.calls.some(c=>c.route==='editor'));
 const other=await fixture(t);other.draft.baseSha256='a'.repeat(64);
 await assert.rejects(other.start(),{code:'EDITOR_SOURCE_MISMATCH'});assert.ok(!other.state.calls.some(c=>c.route==='editor'));
});
test('view uses download permission and its token cannot lock or Save',async t=>{
 const f=await fixture(t);f.state.modeDenied='revise';const opened=await f.start({mode:'view'});
 assert.equal((await f.wopi(opened.launch)).status,200);assert.equal((await f.wopi(opened.launch,'lock',{lock:'CODE'})).status,401);
 assert.ok(f.state.observations.every(o=>o.intent==='download'));
});
test('native expiry, revocation and exact run/scope/client binding refuse borrowed-token use',async t=>{
 for(const change of ['expiry','revoke','run','scope']){
  const f=await fixture(t),started=await f.start();
  if(change==='expiry')f.state.clock=f.session.expiresAtMs;
  if(change==='revoke')f.sessions.close();
  if(change==='run')f.context.binding.writerFence++;
  if(change==='scope')f.context.scopes[0].policyRevision='changed';
  assert.ok([401,404].includes((await f.wopi(started.launch)).status),change);
 }
});
test('a replacement native session cannot revive an old token; explicit renewal binds the replacement',async t=>{
 const f=await fixture(t),started=await f.start();
 f.sessions.revoke(f.session.credential);
 const replacement=await f.sessions.issue({identityCredential:'synthetic-replacement-native'});
 assert.equal((await f.wopi(started.launch)).status,404);
 const renewed=await f.execute('renew',{editorId:started.editor.editorId,expectedEpoch:started.editor.epoch,mode:'edit'},
  {credential:replacement.credential,deadlineMs:f.options.now()+5000});
 assert.equal((await f.wopi(renewed.launch)).status,200);
 assert.equal((await f.wopi(started.launch)).status,404);
});
test('an acquired editor whose acknowledgement is lost is recovered by the same explicit editor identity',async t=>{
 const f=await fixture(t);f.state.editorId=null;
 let lost=true;const drafts={async call(route,body,selection){const result=await f.options.drafts.call(route,body,selection);
  if(lost&&route==='editor'&&body.operation==='acquire'){lost=false;throw Object.assign(Error('lost editor ACK'),{outcome:'UNKNOWN'});}return result;}};
 const app=createRuntimeOfficeApplication({...f.config,drafts}),input={...f.key,operation:'acquire',editorId:id(703),expectedEpoch:1,mode:'edit'};
 await assert.rejects(app.execute('launch',input,f.auth()),e=>e.outcome==='UNKNOWN');assert.equal(f.state.epoch,2);
 const recovered=await f.execute('read');assert.equal(recovered.editor.editorId,id(703));assert.equal(recovered.editor.epoch,2);
 const replay=await app.execute('launch',input,f.auth());assert.equal(replay.editor.epoch,2);assert.equal(f.state.epoch,2);
});
test('release-time access loss and retention generation change never return a launch form',async t=>{
 const f=await fixture(t);f.state.phaseHook=(intent,phase)=>{if(phase==='release')f.state.modeDenied=intent;};
 await assert.rejects(f.start(),{code:'ACCESS_DENIED'});assert.equal(f.state.puts,1);
 const g=await fixture(t);let reads=0;g.state.generationHook=()=>{if(++reads===3)g.state.generation++;};
 await assert.rejects(g.start(),{code:'EDITOR_RESULT_NOT_RELEASED'});
});
test('current Core artifact authority is checked again after a delayed byte read',async t=>{
 const f=await fixture(t),started=await f.start(),get=f.artifactOptions.objects.get;
 f.artifactOptions.objects.get=async(...args)=>{const bytes=await get(...args);f.state.modeDenied='revise';return bytes;};
 assert.equal((await f.wopi(started.launch,'getFile')).status,500);assert.equal(f.state.puts,1);
});
test('discard is explicit, clears saved private bytes, and remains blocked during uncertain Publish',async t=>{
 const f=await fixture(t),started=await f.start();await f.wopi(started.launch,'lock',{lock:'CODE'});await f.wopi(started.launch,'save',{lock:'CODE',body:ooxml('docx')});
 f.draft.state='publish-unknown';f.draft.publishIntent=`office:${f.draft.draftId}:1`;
 await assert.rejects(f.execute('discard'),{code:'OFFICE_DRAFT_CONFLICT'});assert.ok(f.draft.bytesBase64);
 f.draft.state='publish-refused';assert.deepEqual(await f.execute('discard'),{discarded:true});assert.equal(f.draft.bytesBase64,null);
});
