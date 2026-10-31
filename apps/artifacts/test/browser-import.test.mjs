/** Byte-import publication: the actual ArtifactService over the real local immutable store, real validators and
 * real version CAS, with scripted authority/retention. No renderer, SDK invocation or native host runs here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {artifactHarness,context} from './artifact-harness.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {browserImportSource} from '../../../packages/contracts/browser-import.mjs';
import {verifyArtifactPublicationInput} from '../storage/artifact-publication.mjs';

const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=Buffer.from('hello browser import\n','utf8');
const policySha256='a'.repeat(64);
function input(ctx,over={}){
 return {binding:ctx.binding,scopes:ctx.scopes,filename:'notes.txt',format:'txt',
  mimeType:'text/plain; charset=utf-8',bytes:Buffer.from(bytes),sha256:sha256(bytes),
  idempotencyKey:sha256(Buffer.from('run-1/notes.txt')),source:{kind:'browser-download',
   origin:'https://app.capiro.example',urlHost:'app.capiro.example',acquiredAtMs:1750000000000,policySha256},...over};
}

test('a downloaded file is published immutably and reads back as exact bytes',async t=>{
 const {service,state}=await artifactHarness(t),ctx=context();
 const ack=await service.ingest(input(ctx),ctx);
 assert.equal(typeof ack.versionId,'string');
 assert.equal(ack.sha256,sha256(bytes));
 assert.equal(ack.bytes,bytes.length);
 assert.equal(ack.idempotencyKey,input(ctx).idempotencyKey);
 const read=await service.download(ack.versionId,ctx);
 assert.deepEqual(Buffer.from(read.bytes),bytes);
 assert.equal(read.version.filename,'notes.txt');
 assert.equal(read.version.mimeType,'text/plain; charset=utf-8');
 assert.equal(read.version.parentVersionId,null);
 assert.equal(state.authorizations.filter(a=>a==='artifact.generate').length,3);
});

test('the same idempotency key reconciles one version instead of publishing a second',async t=>{
 const {service}=await artifactHarness(t),ctx=context(),first=await service.ingest(input(ctx),ctx);
 const again=await service.ingest(input(ctx),ctx);
 assert.equal(again.versionId,first.versionId);
 assert.equal(again.versionSha256,undefined);
 const read=await service.download(first.versionId,ctx);
 assert.deepEqual(Buffer.from(read.bytes),bytes);
});

test('hash, type, scope and size mismatches refuse before any publication',async t=>{
 const {service,state}=await artifactHarness(t),ctx=context();
 const cases=[
  [{sha256:'0'.repeat(64)},'BROWSER_IMPORT_HASH'],
  [{mimeType:'application/zip'},'BROWSER_IMPORT_FORMAT'],
  [{scopes:[{tenantId:'tenant',kind:'tenant',resourceId:'tenant',policyRevision:'2'}]},'BROWSER_IMPORT_CONTEXT'],
  [{source:{kind:'native-download',origin:'https://app.capiro.example',urlHost:'app.capiro.example',acquiredAtMs:1750000000000,policySha256}},'BROWSER_IMPORT_SOURCE'],
  [{idempotencyKey:'not-a-digest'},'BROWSER_IMPORT_KEY'],
 ];
 for(const [over,code] of cases){
  await assert.rejects(()=>service.ingest(input(ctx,over),ctx),error=>{
   assert.match(String(error.code??''),new RegExp(code,'u'),`${code}: ${error.code}`);
   return true;
  });
 }
 assert.equal(state.puts,0,'no object write for any refused import');
 const limited=context();limited.maxBytes=4;
 await assert.rejects(()=>service.ingest(input(limited),limited),/ARTIFACT_OUTPUT_LIMIT/u);
});

test('current retention suppression blocks the import and a denied authority never writes',async t=>{
 const {service,state}=await artifactHarness(t),ctx=context();
 state.suppressed.add(ctx.binding.conversationId);
 await assert.rejects(()=>service.ingest(input(ctx),ctx),/RETENTION_SUPPRESSED/u);
 assert.equal(state.puts,0);
 state.suppressed.clear();state.deny=true;
 await assert.rejects(()=>service.ingest(input(ctx),ctx),/ARTIFACT_AUTHORITY/u);
 assert.equal(state.puts,0);
});

test('a restarted retry under a later clock reconciles the original version, not a second write',async t=>{
 const {service,state}=await artifactHarness(t),ctx=context();
 const first=await service.ingest(input(ctx),ctx);
 // The current download port stamps acquiredAtMs from its own clock on every invocation.
 const later=await service.ingest(input(ctx,{source:{kind:'browser-download',origin:'https://app.capiro.example',
  urlHost:'app.capiro.example',acquiredAtMs:1750000000000+120000,policySha256}}),ctx);
 assert.equal(later.versionId,first.versionId);
 assert.equal(later.reconciled,true);
 assert.equal(state.puts,1,'the original object is not written a second time');
 const read=await service.download(first.versionId,ctx);
 assert.deepEqual(Buffer.from(read.bytes),bytes);
});

test('a retry whose bytes or provenance changed conflicts with the admitted import',async t=>{
 const {service}=await artifactHarness(t),ctx=context();
 await service.ingest(input(ctx),ctx);
 await assert.rejects(()=>service.ingest(input(ctx,{bytes:Buffer.from('other bytes'),sha256:sha256(Buffer.from('other bytes'))}),ctx),
  /BROWSER_IMPORT_CONFLICT/u);
 await assert.rejects(()=>service.ingest(input(ctx,{source:{kind:'browser-download',origin:'https://other.example',
  urlHost:'other.example',acquiredAtMs:1750000000000,policySha256}}),ctx),/BROWSER_IMPORT_CONFLICT/u);
});

test('the canonical publication verifier admits exactly a matching browser-import invocation',async()=>{
 const ctx=context(),spec=browserImportSource({sourceKind:'meri.browser-download/1',operation:'import_file',
  format:'txt',title:'notes',source:{kind:'browser-download',origin:'https://app.capiro.example',
   urlHost:'app.capiro.example',acquiredAtMs:1750000000000,policySha256},sha256:sha256(bytes),bytes:bytes.length});
 const object={objectId:'00000000-0000-4000-8000-000000000010',versionId:sha256(bytes),sha256:sha256(bytes),
  bytes:bytes.length,scopes:ctx.scopes};
 const version={contractVersion:'0.2.0',artifactId:'00000000-0000-4000-8000-000000000003',
  versionId:'00000000-0000-4000-8000-000000000004',parentVersionId:null,binding:ctx.binding,object,
  filename:'notes.txt',mimeType:'text/plain; charset=utf-8',scopes:ctx.scopes,evidence:[],
  generationStatus:'draft',previewStatus:'pending',createdAt:new Date(1750000000000).toISOString()};
 const inspection={sha256:sha256(bytes),bytes:bytes.length,format:'txt',nativeOpened:false,rendered:false,
  recalculated:false,members:[],details:{mimeType:'text/plain; charset=utf-8'}};
 const requestSha256=canonicalSha256({probe:'publication'});
 const publication={record:{version,spec,specSha256:canonicalSha256(spec),requestSha256,inspection},
  expectedParentVersionId:null,
  authorization:{receiptId:'authority',decision:'allow',action:'artifact.generate',binding:ctx.binding,
   scopesSha256:canonicalSha256(ctx.scopes),resourceSha256:canonicalSha256({versionId:null,object:null,assetObjects:[]}),
   requestSha256,expiresAtMs:Date.now()+60000},
  invocation:{kind:'browser-import',versionId:version.versionId,binding:ctx.binding,requestSha256,
   idempotencyKey:sha256(Buffer.from('run-1/notes.txt'))}};
 assert.doesNotThrow(()=>verifyArtifactPublicationInput(publication));
 for(const bad of [
  {invocation:{...publication.invocation,idempotencyKey:'not-a-digest'}},
  {invocation:{...publication.invocation,requestSha256:'0'.repeat(64)}},
  {invocation:{...publication.invocation,binding:{...ctx.binding,runId:'00000000-0000-4000-8000-000000000099'}}},
  {invocation:{kind:'native-document',versionId:version.versionId,binding:ctx.binding,requestSha256}},
 ]) assert.throws(()=>verifyArtifactPublicationInput({...publication,...bad}));
});
