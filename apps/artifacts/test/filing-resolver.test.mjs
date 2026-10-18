/** Filing through the artifact owner: the resolveAttachments port of the governed artifact.file command source. Real
 * generators, real local immutable store, canonical ArtifactService; scripted authority/retention, a scripted host attachment
 * broker and a scripted source route (no network). The broker and the source route are not qualified here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {artifactHarness,specs,context,validators as v} from './artifact-harness.mjs';
import {createArtifactFilingResolver} from '../filing.mjs';
import {createCommandHttpSource} from '../../control/commands/source-http.mjs';

const destination={clientId:'20000000-0000-4000-8000-000000000002',conversationId:'10000000-0000-4000-8000-000000000001'};
async function setup(t){
 const h=await artifactHarness(t),ctx=context(),broker={calls:[],fail:null,tamper:null};
 const attachments={async register(call){broker.calls.push({versionId:call.versionId,objectId:call.object.objectId,filename:call.filename,mimeType:call.mimeType,bytes:call.bytes.length});
  if(broker.fail)throw broker.fail;const receipt={attachmentId:randomUUID(),sha256:call.object.sha256,bytes:call.bytes.length,expiresAtMs:Date.now()+60000};return broker.tamper?broker.tamper(receipt):receipt;}};
 const resolve=createArtifactFilingResolver({validators:v,artifacts:h.service,versions:h.store.versions,readContext:async({binding})=>({...ctx,binding}),attachments,now:Date.now});
 const create=async format=>(await h.service.create(specs[format],ctx)).version;
 return {...h,ctx,broker,resolve,create,call:objects=>resolve({objects,destination,binding:ctx.binding,deadlineMs:Date.now()+60000})};
}
test('selected exact objects resolve to their versions, are registered with exact bytes and released as an attachment fact',async t=>{
 const a=await setup(t),docx=await a.create('docx'),xlsx=await a.create('xlsx');
 const fact=await a.call([docx.object,xlsx.object]);
 assert.deepEqual(fact.binding,a.ctx.binding);assert.deepEqual(fact.destination,destination);assert.ok(fact.expiresAtMs>Date.now());
 assert.deepEqual(fact.objects.map(r=>r.object),[docx.object,xlsx.object]);assert.equal(new Set(fact.objects.map(r=>r.attachmentId)).size,2);
 assert.deepEqual(a.broker.calls,[{versionId:docx.versionId,objectId:docx.object.objectId,filename:'Brief.docx',mimeType:docx.mimeType,bytes:docx.object.bytes},{versionId:xlsx.versionId,objectId:xlsx.object.objectId,filename:'Model.xlsx',mimeType:xlsx.mimeType,bytes:xlsx.object.bytes}]);
 // Each object was read under artifact.download authority before registration and re-inspected after it.
 assert.deepEqual(a.state.authorizations.slice(-12),['artifact.download','artifact.download','artifact.download','artifact.download','artifact.download','artifact.download','artifact.inspect','artifact.inspect','artifact.inspect','artifact.inspect','artifact.inspect','artifact.inspect']);
});
test('the governed artifact.file command source prepares and executes against the resolved fact',async t=>{
 const a=await setup(t),docx=await a.create('docx'),requests=[];
 const source=createCommandHttpSource({origin:'https://source.invalid',now:Date.now,maxResponseBytes:65536,resolveAttachments:a.resolve,
  getCredentials:async({binding})=>({binding,bearerToken:'synthetic-bearer',serviceSecret:'synthetic-secret',expiresAtMs:Date.now()+60000}),
  fetchImpl:async(url,init)=>{const body=JSON.parse(init.body);requests.push({url,body});
   return new Response(JSON.stringify({tool:'save_chat_attachments',status:'saved',generatedAt:new Date().toISOString(),clientId:destination.clientId,clientName:'Client',location:'/documents',savedCount:1,pendingCount:0,failedCount:0,
    files:body.attachmentIds.map(attachmentId=>({attachmentId,fileName:'Brief.docx',status:'saved',documentId:'doc-1',location:'/documents/Brief.docx',indexingStatus:'pending',reused:false}))}),{headers:{'content-type':'application/json'}});}});
 const command={action:'artifact.file',arguments:destination,attachments:[docx.object]},authority={binding:a.ctx.binding,subject:{actorId:'actor'},policyRevision:'1',claims:{capabilityId:'capability'},deadlineMs:Date.now()+60000};
 const signal=new AbortController().signal,token=await source.prepare({command,context:{destination},authority,deadlineMs:Date.now()+60000,signal});
 const result=await source.execute(token,{authority,signal});
 assert.equal(requests.length,1);assert.equal(requests[0].url,'https://source.invalid/api/clio/tools/save_chat_attachments');assert.equal(a.broker.calls.length,1);assert.equal(requests[0].body.attachmentIds.length,1);assert.match(requests[0].body.attachmentIds[0],/^[0-9a-f-]{36}$/);assert.deepEqual({clientId:requests[0].body.clientId,conversationId:requests[0].body.conversationId},destination);
 assert.deepEqual(result.files.map(f=>[f.object,f.status]),[[docx.object,'saved']]);
});
test('objects outside the conversation, altered references, suppression and revoked authority register nothing',async t=>{
 const a=await setup(t),docx=await a.create('docx');
 await assert.rejects(a.call([{...docx.object,objectId:randomUUID()}]),{code:'ARTIFACT_FILING_OBJECT_UNKNOWN'});
 for(const change of [o=>({...o,sha256:'0'.repeat(64)}),o=>({...o,bytes:o.bytes+1}),o=>({...o,versionId:o.versionId.split('').reverse().join('')})])
  await assert.rejects(a.call([change(docx.object)]),{code:'ARTIFACT_FILING_OBJECT_MISMATCH'});
 a.state.suppressed.add(docx.artifactId);await assert.rejects(a.call([docx.object]),{code:'RETENTION_SUPPRESSED'});a.state.suppressed.clear();
 a.state.deny=true;await assert.rejects(a.call([docx.object]),{code:'ARTIFACT_AUTHORITY'});a.state.deny=false;
 const other=createArtifactFilingResolver({validators:v,artifacts:a.service,versions:a.store.versions,readContext:async()=>({...a.ctx,binding:{...a.ctx.binding,actorId:'someone-else'}}),attachments:{register(){assert.fail('registered');}},now:Date.now});
 await assert.rejects(other({objects:[docx.object],destination,binding:a.ctx.binding,deadlineMs:Date.now()+60000}),{code:'ARTIFACT_FILING_CONTEXT'});
 assert.equal(a.broker.calls.length,0);
});
test('a broker failure or a mismatched broker receipt after registration starts is UNKNOWN, never no-effect',async t=>{
 const a=await setup(t),docx=await a.create('docx'),xlsx=await a.create('xlsx');
 for(const tamper of [r=>({...r,sha256:'0'.repeat(64)}),r=>({...r,bytes:1}),r=>({...r,attachmentId:'not-a-uuid'}),r=>({...r,expiresAtMs:0}),r=>({...r,extra:true})]){
  a.broker.tamper=tamper;const error=await a.call([docx.object]).then(()=>assert.fail('released'),e=>e);
  assert.equal(error.code,'ARTIFACT_EFFECT_UNKNOWN');assert.equal(error.registrationAttempts,1);assert.equal(error.cause.code,'ARTIFACT_FILING_ATTACHMENT_RECEIPT');
 }
 a.broker.tamper=null;let n=0;
 // The second registration fails: the first attachment already exists at the source, the second may.
 const failing=createArtifactFilingResolver({validators:v,artifacts:a.service,versions:a.store.versions,readContext:async({binding})=>({...a.ctx,binding}),now:Date.now,
  attachments:{async register(call){if(++n===2)throw Object.assign(Error('BROKER_DOWN'),{code:'BROKER_DOWN'});return {attachmentId:randomUUID(),sha256:call.object.sha256,bytes:call.bytes.length,expiresAtMs:Date.now()+60000};}}});
 const error=await failing({objects:[docx.object,xlsx.object],destination,binding:a.ctx.binding,deadlineMs:Date.now()+60000}).then(()=>assert.fail('released'),e=>e);
 assert.equal(error.code,'ARTIFACT_EFFECT_UNKNOWN');assert.equal(error.registrationAttempts,2);assert.equal(error.cause.code,'BROKER_DOWN');
 // A suppression that commits during registration refuses release.
 const late=createArtifactFilingResolver({validators:v,artifacts:a.service,versions:a.store.versions,readContext:async({binding})=>({...a.ctx,binding}),now:Date.now,
  attachments:{async register(call){a.state.suppressed.add(docx.artifactId);return {attachmentId:randomUUID(),sha256:call.object.sha256,bytes:call.bytes.length,expiresAtMs:Date.now()+60000};}}});
 const suppressed=await late({objects:[docx.object],destination,binding:a.ctx.binding,deadlineMs:Date.now()+60000}).then(()=>assert.fail('released'),e=>e);
 assert.equal(suppressed.code,'ARTIFACT_EFFECT_UNKNOWN');assert.equal(suppressed.cause.code,'RETENTION_SUPPRESSED');
});
