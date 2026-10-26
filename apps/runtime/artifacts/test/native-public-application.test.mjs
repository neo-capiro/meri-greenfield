/** Real session, Core wire, runtime/document handlers, intent SQL and immutable publication owners.
 * Scripted Core/SQL/object transports only: no HTTP listener, database or provider. */
import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createCoreArtifactAuthorityClient} from '../core-authority-client.mjs';
import {createCoreArtifactAuthority} from '../core-authority.mjs';
import {createArtifactAuthorityCredentials} from '../authority-credentials.mjs';
import {createRuntimeDocumentOptionsComposer} from '../composition.mjs';
import {createRuntimeArtifactApplication} from '../application.mjs';
import {applicationFixture} from '../../../control/conversations/test/application-fixture.mjs';
import {nativeDocumentFixture,sha} from '../../../artifacts/test/native-document-fixture.mjs';
import {NOW,id} from '../../../artifacts/storage/test/sql-fixture.mjs';
const binding={tenantId:id(100),actorId:id(101),conversationId:id(102),runId:id(103),attemptId:id(104),workerId:id(105),writerFence:1},clientId=id(106),now=()=>Date.now();
async function fixture(t,{general=false,nativeLookup=false}={}){
 t.mock.timers.enable({apis:['Date'],now:NOW});const selectedClientId=general?null:clientId,scopes=[{tenantId:binding.tenantId,kind:general?'private-user':'client',resourceId:general?binding.actorId:clientId,policyRevision:'policy1'}];
 const f=await applicationFixture({binding,scopes,selectedClientId,initialInput:true});t.after(()=>f.close());await f.service.allocateInput({credential:f.credential,input:f.input});await f.service.submit({credential:f.credential,input:f.input});
 const documents=nativeDocumentFixture({binding,scopes}),state={coreCalls:[],coreStatus:200,mutate:null,onCore:null,file:null,fileCalls:0,fileFailure:false};
 const core=createCoreArtifactAuthorityClient({origin:'https://core.synthetic.invalid',now,fetchImpl:async(url,init)=>{
  const q=JSON.parse(init.body);state.coreCalls.push(q);await state.onCore?.(q,state.coreCalls.length);assert.equal(init.headers.authorization,'Bearer synthetic-native');assert.equal(init.headers['x-internal-service-secret'],'synthetic-service-only');
  if(state.coreStatus!==200)return Response.json({error:'denied'},{status:state.coreStatus});
  const receipt={...q,principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'a'.repeat(64),selectedClientId:q.clientId,contextRevision:'b'.repeat(64),operations:['artifact.download','artifact.generate','artifact.inspect','artifact.preview-publish','artifact.revise'],limits:{maxArtifactBytes:1048576},authorityRevision:'c'.repeat(64),checkedAtMs:NOW,expiresAtMs:NOW+60000};delete receipt.clientId;
  state.mutate?.(receipt);return Response.json(receipt);
 }});
 const credentials=await createArtifactAuthorityCredentials({serviceSecretFile:'/run/core-secret',readSecret:async()=>Buffer.from('synthetic-service-only')});
 const limits={maxRequestMs:5000,maxRequestBytes:131072,maxResponseBytes:1048576},authority=createCoreArtifactAuthority({client:core,credentials,now,limits,maxOutputBytes:1048576});
 const store=nativeLookup?f.store:{...f.store,lifecycle:{...f.store.lifecycle,async readArtifactFile(value,check){check();state.fileCalls++;if(state.fileFailure)throw Error('NATIVE_FILE_STORE_UNKNOWN');return value.versionId===state.file?.entry.object.objectId?structuredClone(state.file):null;}}};
 const compose=createRuntimeDocumentOptionsComposer({storage:{versions:documents.options.versions,objects:documents.options.objects},executor:documents.options.executor,pool:documents.options.pool,sessions:f.sessions,store,now});
 const optionsOwner={async resolve(call){const result=await authority.resolve({...call,sessions:f.sessions,store});const {recheck,...options}=result;return {documentOptions:compose(options),recheck};}};
 const app=createRuntimeArtifactApplication({sessions:f.sessions,optionsOwner,retention:documents.sql.retention,now,limits});
 const post=(route,body,credential=f.credential)=>app.handle(new Request('https://meri.synthetic.invalid/api/documents/'+route,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(body)}));
 return {f,documents,state,post,scopes,selectedClientId,body:{deliveryId:'http-native-document',request:documents.call.request}};
}

test('reserved current run reads the prior generated version through actual native lookup absence',async t=>{
 const x=await fixture(t,{general:true,nativeLookup:true}),created=await x.post('create',x.body);
 assert.equal(created.status,200,await created.clone().text());const prior=await created.json();
 const reserved={...binding,runId:id(800),attemptId:id(801),workerId:id(802)};x.f.state.context.binding=reserved;
 const session=await x.f.sessions.issue({identityCredential:'synthetic-native'}),read=route=>x.post(route,{versionId:prior.version.versionId},session.credential);
 assert.equal(x.f.state.runs.size,1,'no input accepted for the current reservation');
 const inspected=await read('inspect');assert.equal(inspected.status,200,await inspected.clone().text());
 const inspection=await inspected.json();assert.deepEqual(inspection.version,prior.version);assert.equal(inspection.inspection.currentBytesVerified,true);
 const downloaded=await read('download');assert.equal(downloaded.status,200,await downloaded.clone().text());assert.equal(await downloaded.text(),'First version\n');
 assert.equal(x.documents.state.executions.length,1);assert.equal(x.f.state.runs.size,1,'reading never accepts an input');
 x.f.state.artifactLookupFailure=true;const unknown=await read('inspect');assert.equal(unknown.status,502);assert.equal((await unknown.json()).error.code,'DOCUMENT_REFUSED');
 x.f.state.artifactLookupFailure=false;x.state.coreStatus=403;assert.equal((await read('download')).status,403,'fresh Core denial still withholds bytes');
});

for(const general of [false,true])test(`actual native ${general?'General':'client'} public create/revise/inspect/download keeps current Core and immutable owners`,async t=>{
 const x=await fixture(t,{general}),created=await x.post('create',x.body);assert.equal(created.status,200,await created.clone().text());const first=await created.json();
 assert.equal(first.execution.kind,'native-document');assert.equal(x.documents.state.executions.length,1);assert.equal(x.state.coreCalls.length,3,'resolve plus admission and release only');
 assert.equal(x.state.coreCalls[0].contract,general?'capiro.meri-artifact-authority.v2':'capiro.meri-artifact-authority.v1');assert.equal(x.state.coreCalls[0].clientId,general?null:clientId);
 const again=await x.post('create',x.body);assert.equal(again.status,200);assert.deepEqual((await again.json()).version,first.version);assert.equal(x.documents.state.executions.length,1);
 const inspect=await x.post('inspect',{versionId:first.version.versionId});assert.equal(inspect.status,200,await inspect.clone().text());assert.equal((await inspect.json()).inspection.currentBytesVerified,true);
 const download=await x.post('download',{versionId:first.version.versionId});assert.equal(download.status,200);assert.equal(await download.text(),'First version\n');assert.equal(download.headers.get('content-type'),'text/plain; charset=utf-8');
 const revised=await x.post('revise',{deliveryId:'http-revision',baseVersionId:first.version.versionId,request:{...x.body.request,content:{text:'Second version'}}});assert.equal(revised.status,200,await revised.clone().text());assert.equal((await revised.json()).version.parentVersionId,first.version.versionId);assert.equal(x.documents.state.executions.length,2);
});

for(const denial of ['Core','principal','client','session','run','scope','operation'])test(`native public ${denial} refusal performs no artifact effect`,async t=>{
 const x=await fixture(t);if(denial==='Core')x.state.coreStatus=403;if(denial==='principal')x.state.mutate=r=>r.principal.actorId=id(999);
 if(denial==='client')x.state.mutate=r=>r.selectedClientId=id(999);if(denial==='session')x.f.state.revoked=true;
 if(denial==='run'){const row=[...x.f.state.runs.values()][0];row.projection.state='cancelled';row.projection_sha256=hash(row.projection);}
 if(denial==='scope')x.f.state.context.scopes=[{...x.scopes[0],resourceId:id(999)}];if(denial==='operation')x.state.mutate=r=>r.operations=['artifact.download'];
 const response=await x.post('create',x.body);assert.notEqual(response.status,200);assert.equal(x.documents.state.executions.length,0);assert.equal(x.documents.state.puts,0);assert.equal(x.documents.state.rows.size,0);
});

test('Core release revocation withholds a committed result; replay never generates twice',async t=>{
 const x=await fixture(t);x.state.onCore=(q,n)=>{if(n===3)x.state.coreStatus=403;};const response=await x.post('create',x.body);assert.equal(response.status,403);assert.equal((await response.json()).error.outcome,'RESULT_NOT_RELEASED');
 assert.equal(x.documents.state.executions.length,1);x.state.onCore=null;x.state.coreStatus=200;assert.equal((await x.post('create',x.body)).status,200);assert.equal(x.documents.state.executions.length,1);
});

function file(x,path='output/café.txt'){const bytes=Buffer.from('Native output');const object={objectId:id(700),versionId:'synthetic-exact-version',sha256:sha(bytes),bytes:bytes.length,scopes:x.scopes};
 x.documents.state.objects.set(v.hash(object),bytes);x.state.file={kind:'native-file',binding,scopes:x.scopes,manifestId:id(701),createdAt:new Date(NOW).toISOString(),entry:{path,kind:'file',executable:false,object}};return object;}
test('native workspace inspect/download use actual file metadata and exact safe filename headers',async t=>{
 const x=await fixture(t,{general:true}),object=file(x),inspect=await x.post('inspect',{versionId:object.objectId});assert.equal(inspect.status,200,await inspect.clone().text());const value=await inspect.json();v.nativeFileInspection(value);assert.equal(value.kind,'native-file');assert.equal(Object.hasOwn(value,'inspection'),false);
 const response=await x.post('download',{versionId:object.objectId});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/octet-stream');assert.equal(response.headers.get('content-disposition'),"attachment; filename=\"caf_.txt\"; filename*=UTF-8''caf%C3%A9.txt");assert.equal(await response.text(),'Native output');
 assert.equal(x.documents.state.executions.length,0);assert.equal(x.documents.state.puts,0);
});
for(const changed of ['object','metadata','source','suppression','lookup'])test(`native file ${changed} failure cannot fall back to generated storage or release bytes`,async t=>{
 const x=await fixture(t),object=file(x);if(changed==='object')x.documents.state.objects.set(v.hash(object),Buffer.from('wrong'));
 if(changed==='metadata')x.state.file.entry.object.scopes=[{...x.scopes[0],resourceId:id(999)}];if(changed==='source')x.state.file.binding={...binding,actorId:id(999)};
 if(changed==='suppression')x.documents.sql.suppressed.add(`${binding.tenantId}:artifact:${object.objectId}`);if(changed==='lookup')x.state.fileFailure=true;
 const before=x.documents.sql.events.length,response=await x.post('download',{versionId:object.objectId});assert.notEqual(response.status,200);assert.equal(x.documents.sql.events.length,before);assert.equal(x.documents.state.executions.length,0);
});
