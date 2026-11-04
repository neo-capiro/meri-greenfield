/** General DOCX joins the actual session, Office control, launch/token and WOPI owners.
 * Core authority/HTTP, document generation and SQL/object ports are synthetic; no native editor or provider runs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {wopiFixture} from './wopi-fixture.mjs';
import {createCollaboraCodeLaunch} from '../collabora-code.mjs';
import {createRuntimeOfficeApplication} from '../../../runtime/artifacts/office-application.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {OFFICE_SCHEMA,receiveOfficeRequest,receiveOfficeResponse} from '../../../../packages/contracts/dist/office-application.mjs';
import {id} from '../../storage/test/sql-fixture.mjs';

const editorOrigin='https://office.example.test',wopiOrigin='https://wopi.example.test',browserOrigin='https://app.example.test';
const encode=value=>new TextEncoder().encode(JSON.stringify(value));
async function generalDocx(t){
 const f=await wopiFixture(t,{general:true}),now=f.options.now;
 const limits={maxRequestMs:5000,maxRequestBytes:2097152,maxResponseBytes:16777216};
 const {retention,...artifactOptions}=f.artifactOptions;
 const optionsOwner={async resolve(call){
  const action={'office-edit':'artifact.revise',download:'artifact.download'}[call.intent];assert.ok(action);
  return {documentOptions:{sessions:f.sessions,selectedClientId:null,artifactOptions:{...artifactOptions,now,
   ids:()=>({artifactId:id(960),versionId:id(961),objectId:id(962)}),authorize:async request=>{assert.equal(request.action,action);return artifactOptions.authorize(request);}},now,limits,enabled:true},
   async recheck(){}};
 }};
 const discoveryBytes=Buffer.from(`<wopi-discovery><net-zone name="external-https"><app><action ext="docx" name="edit" urlsrc="${editorOrigin}/browser/synthetic/cool.html?"/></app></net-zone></wopi-discovery>`);
 const launch=createCollaboraCodeLaunch({editorOrigin,wopiOrigin,discoveryBytes,codec:f.codec,now});
 const app=createRuntimeOfficeApplication({optionsOwner,sessions:f.sessions,now,limits,retention,drafts:f.options.drafts,
  codec:f.codec,launch,generation:f.options.generation,browserOrigin});
 const key={draftId:f.draft.draftId,versionId:f.first.version.versionId};
 async function control(route,extra={}){
  const body={schema:OFFICE_SCHEMA,...key,...extra},selected=receiveOfficeRequest(route,encode(body));
  const response=await app.handleControl(new Request(`https://control.example.test/api/meri/office/${route}`,{method:'POST',
   headers:{authorization:`Bearer ${f.session.credential}`,'content-type':'application/json'},body:JSON.stringify(body)}));
  assert.equal(response.status,200,await response.clone().text());
  return receiveOfficeResponse(route,response.status,new Uint8Array(await response.arrayBuffer()),selected);
 }
 const start=async()=>{await control('open');return control('launch',{operation:'acquire',editorId:f.claims.editorId,expectedEpoch:0,mode:'edit'});};
 function wopi(form,{contents=false,token=form.fields.access_token}={}){
  const source=new URL(new URL(form.actionUrl).searchParams.get('WOPISrc'));
  if(contents)source.pathname+='/contents';source.searchParams.set('access_token',token);
  source.searchParams.set('access_token_ttl',form.fields.access_token_ttl);
  return app.handleWopi(new Request(source));
 }
 return {...f,start,wopi};
}

test('General DOCX launches and serves CheckFileInfo/GetFile with the exact private-user session and bounded expiry',async t=>{
 const f=await generalDocx(t),scopes=[{tenantId:f.context.binding.tenantId,kind:'private-user',resourceId:f.context.binding.actorId,policyRevision:'synthetic-policy'}];
 assert.deepEqual(f.first.version.scopes,scopes);assert.deepEqual(f.first.version.object.scopes,scopes);
 assert.equal(f.session.context.selectedClientId,null);
 const opened=await f.start(),form=opened.launch,claims=f.codec.verify(form.fields.access_token,{fileId:f.draft.draftId});
 assert.equal(form.method,'POST');assert.equal(form.edition,'collabora-code');assert.equal(new URL(form.actionUrl).origin,editorOrigin);
 assert.deepEqual(claims.runBinding,f.context.binding);assert.equal(claims.selectedClientId,null);assert.equal(claims.scopesSha256,hash(scopes));
 assert.equal(claims.expiresAtMs,f.session.expiresAtMs);assert.equal(form.expiresAtMs,claims.expiresAtMs);
 assert.ok(claims.expiresAtMs<Date.parse(opened.editor.expiresAt));assert.equal(form.fields.access_token_ttl,'0');
 const response=await f.wopi(form);assert.equal(response.status,200);const info=await response.json();
 assert.equal(info.BaseFileName,f.first.version.filename);assert.equal(info.Size,f.baseBytes.length);
 assert.equal(info.UserCanWrite,true);assert.equal(info.SupportsLocks,true);assert.equal(info.PostMessageOrigin,browserOrigin);
 const file=await f.wopi(form,{contents:true});assert.equal(file.status,200);assert.deepEqual(Buffer.from(await file.arrayBuffer()),f.baseBytes);
 assert.equal(file.headers.get('x-wopi-itemversion'),info.Version);
 assert.ok(f.state.calls.every(call=>call.headers.authorization==='Bearer synthetic-native-bearer'));
 assert.equal(f.state.puts,1);assert.equal(f.sql.state.versions.size,1);
 // CODE's zero display TTL cannot extend the signed token or its native session.
 const calls=f.state.calls.length;f.state.clock=claims.expiresAtMs;
 const expired=await f.wopi(form);assert.equal(expired.status,401);assert.equal(expired.headers.get('x-wopi-refusal'),'WOPI_TOKEN_EXPIRED');
 assert.equal(f.state.calls.length,calls);assert.equal((await expired.arrayBuffer()).byteLength,0);
});

test('General DOCX refuses a signed token whose private-user scope differs from its current session',async t=>{
 const f=await generalDocx(t),{launch}=await f.start(),claims=f.codec.verify(launch.fields.access_token,{fileId:f.draft.draftId});
 const token=f.codec.issue({...claims,scopesSha256:hash([{...f.context.scopes[0],resourceId:'another-synthetic-actor'}])});
 const calls=f.state.calls.length,gets=f.state.gets,response=await f.wopi(launch,{contents:true,token});
 assert.equal(response.status,404);assert.equal(response.headers.get('x-wopi-refusal'),'WOPI_SESSION_DRIFT');
 assert.equal((await response.arrayBuffer()).byteLength,0);assert.equal(f.state.calls.length,calls);assert.equal(f.state.gets,gets);
 assert.equal(f.state.puts,1);assert.equal(f.sql.state.versions.size,1);
});
