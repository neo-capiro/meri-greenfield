/** Real local Python/XSD through mounted document paths; SQL/Core/object transports are synthetic. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import * as federal from '@capiro/meri-contracts/federal-workbench';
import {createFederalSchemaValidator} from '../../../artifacts/federal-drafting/schema-validator.mjs';
import {opFor} from '../../../artifacts/federal-drafting/test/fixtures.mjs';
import {fixture,bytes,publication} from './federal-workbench-fixture.mjs';

const pythonExecutable=process.env.FEDERAL_SCHEMA_TEST_PYTHON;
const actual={skip:pythonExecutable?false:'FEDERAL_SCHEMA_TEST_PYTHON is not configured; actual Python/XSD mounted path not run'};
const official=await readFile(new URL('../../../artifacts/federal-drafting/uslm-schema/test/fixtures/BILLS-114hres99eh.xml',import.meta.url),'utf8');
const sectionId='xml:HE4CAF9520F654C99838F6B0FC30297BB';
async function validator(t){const tempRoot=await mkdtemp(join(tmpdir(),'meri-schema-mounted-'));
 t.after(async()=>{assert.deepEqual(await readdir(tempRoot),[]);await rm(tempRoot,{recursive:true,force:true});});
 const owner=createFederalSchemaValidator({pythonExecutable,tempRoot});
 if(process.env.FEDERAL_SCHEMA_TEST_TIMINGS!=='1')return owner;
 let calls=0,totalMs=0;
 return {async validate(text,options){const started=Date.now(),call=++calls;try{return await owner.validate(text,options);}
  finally{const elapsedMs=Date.now()-started;totalMs+=elapsedMs;console.log(JSON.stringify({schemaValidatorTiming:{call,elapsedMs,totalMs,bytes:Buffer.byteLength(text)}}));}}};}
async function roundTrip(x,route,body,review){
 const started=Date.now(),request=federal.receiveFederalRequest(route,bytes(body)),response=await x.post(route,request),raw=await response.json();
 if(process.env.FEDERAL_SCHEMA_TEST_TIMINGS==='1')console.log(JSON.stringify({schemaRouteTiming:{route,elapsedMs:Date.now()-started,status:response.status}}));
 const received=await federal.receiveFederalResponse(route,response.status,bytes(raw),request,review);
 return {status:response.status,raw,received};
}
async function imported(t){const x=await fixture(t,{native:true,raw:true,text:official,federalValidator:await validator(t),realClock:true});
 const result=await roundTrip(x,'federal-import',{...x.importRequest(),validationProfile:'uslm-2.1.0'});
 assert.equal(result.status,200,JSON.stringify(result.raw));return {x,source:result.received};}
const selectionFor=(imported,operations)=>({versionId:imported.publication.version.versionId,
 expectedArtifactSha256:imported.publication.version.object.sha256,operations});
const writes=x=>({executions:x.f.state.executions.length,puts:x.f.state.puts,versions:x.f.sql.state.versions.size});

test('schema mode without a validator is503 and never publishes an artifact',async t=>{
 const x=await fixture(t,{native:true,raw:true,text:official}),before=writes(x);
 const result=await roundTrip(x,'federal-import',{...x.importRequest(),validationProfile:'uslm-2.1.0'});
 assert.equal(result.status,503);assert.equal(result.raw.error.code,'DRAFT_SCHEMA_VALIDATOR_UNAVAILABLE');assert.deepEqual(writes(x),before);
});

test('malformed internal validator and public validator JSON injection refuse without writes',async t=>{
 const malformed=await fixture(t,{native:true,raw:true,text:official,federalValidator:{validate:'not a method'}}),before=writes(malformed);
 const refused=await malformed.post('federal-import',{...malformed.importRequest(),validationProfile:'uslm-2.1.0'});
 assert.notEqual(refused.status,200);assert.deepEqual(writes(malformed),before);
 const x=await fixture(t,{native:true,raw:true,text:official}),unchanged=writes(x);
 const injected={...x.importRequest(),validationProfile:'uslm-2.1.0',federalValidator:{validate:{valid:true}}};
 assert.throws(()=>federal.receiveFederalRequest('federal-import',bytes(injected)));
 assert.equal((await x.post('federal-import',injected)).status,400);assert.deepEqual(writes(x),unchanged);
});

test('actual pinned schema import edits, saves, reloads and exports through public1.6 receiver',actual,async t=>{
 const {x,source:importedSource}=await imported(t),source=importedSource.source;
 assert.equal(source.parserVersion,'federal-uslm-xml/2');assert.equal(source.validation.valid,true);
 assert.equal(source.validation.sourceSha256,source.sha256);assert.ok(source.scopes.some(s=>s.id===sectionId));
 const downloaded=await x.reads.download(importedSource.publication.version.versionId,x.f.context);
 assert.deepEqual(await federal.receiveFederalSource(downloaded.bytes),source);
 const selection=selectionFor(importedSource,[opFor(source,{scopeId:sectionId,expectedText:'profound sorrow',text:'deep sorrow'})]);
 const reviewed=await roundTrip(x,'federal-prepare',{selection});assert.equal(reviewed.status,200,JSON.stringify(reviewed.raw));
 const review=reviewed.received,prepared=review.prepared;
 assert.equal(prepared.draft.outputs.consolidated,official.replace('profound sorrow','deep sorrow'));
 assert.deepEqual(prepared.schemaValidation.source,source.validation);
 assert.equal(prepared.schemaValidation.consolidated.sourceSha256,prepared.draft.outputHashes.consolidated);
 const saved=await roundTrip(x,'federal-publish',publication(selection,prepared.revisionSha256,'draft'),review);
 assert.equal(saved.status,200,JSON.stringify(saved.raw));
 const loaded=await roundTrip(x,'federal-load',{versionId:saved.received.publication.version.versionId,
  expectedArtifactSha256:saved.received.publication.version.object.sha256});
 assert.equal(loaded.status,200,JSON.stringify(loaded.raw));assert.deepEqual(loaded.received.prepared,prepared);
 const exported=await roundTrip(x,'federal-publish',publication(selection,prepared.revisionSha256,'consolidated'),loaded.received);
 assert.equal(exported.status,200,JSON.stringify(exported.raw));
 const result=await x.reads.download(exported.received.publication.version.versionId,x.f.context);
 assert.equal(result.bytes.toString('utf8'),prepared.draft.outputs.consolidated);
});

test('malformed and schema-invalid source refuse before artifact publication',actual,async t=>{
 const federalValidator=await validator(t);
 for(const text of [official.slice(0,-15),official.replace('<meta>','<unknown>').replace('</meta>','</unknown>')]){
  const x=await fixture(t,{native:true,raw:true,text,federalValidator,realClock:true}),before=writes(x);
  const result=await roundTrip(x,'federal-import',{...x.importRequest(),validationProfile:'uslm-2.1.0'});
  assert.equal(result.status,422,JSON.stringify(result.raw));assert.match(result.raw.error.code,/^DRAFT_/);
  if(text.includes('<unknown>'))assert.equal(result.raw.error.code,'DRAFT_SCHEMA_INVALID');
  assert.deepEqual(writes(x),before);
 }
});

test('schema-invalid compiled required-node deletion returns422 with no write',actual,async t=>{
 const {x,source:importedSource}=await imported(t),source=importedSource.source;
 const start=official.indexOf('<meta>'),end=official.indexOf('</meta>')+'</meta>'.length;
 const selection=selectionFor(importedSource,[opFor(source,{scopeId:'document',kind:'delete',expectedText:official.slice(start,end)})]);
 const before=writes(x),result=await roundTrip(x,'federal-prepare',{selection});
 assert.equal(result.status,422,JSON.stringify(result.raw));assert.equal(result.raw.error.code,'DRAFT_SCHEMA_INVALID');
 assert.deepEqual(writes(x),before);
});

test('schema-qualified typed removal retains source receipt and exports exactly zero bytes',actual,async t=>{
 const {x,source:importedSource}=await imported(t),source=importedSource.source;
 const selection=selectionFor(importedSource,[{id:'remove',kind:'remove_source_text',expectedSourceSha256:source.sha256,
  expectedTextSha256:source.sha256,dependsOn:[]}]);
 const reviewed=await roundTrip(x,'federal-prepare',{selection});assert.equal(reviewed.status,200,JSON.stringify(reviewed.raw));
 const review=reviewed.received,prepared=review.prepared;
 assert.equal(prepared.draft.resultKind,'source-text-removed');assert.equal(prepared.schemaValidation.consolidated,null);
 assert.deepEqual(prepared.schemaValidation.source,source.validation);assert.equal(prepared.draft.outputs.consolidated,'');
 const exported=await roundTrip(x,'federal-publish',publication(selection,prepared.revisionSha256,'consolidated'),review);
 assert.equal(exported.status,200,JSON.stringify(exported.raw));
 const result=await x.reads.download(exported.received.publication.version.versionId,x.f.context);
 assert.equal(result.bytes.length,0);assert.equal(exported.received.publication.version.object.bytes,0);
 assert.equal(exported.received.publication.version.object.sha256,'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});
