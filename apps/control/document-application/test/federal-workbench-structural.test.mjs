/** Actual HTTP/service/CAS/public receivers with synthetic Core, schema and Word/XML execution ports.
 * No Python/XSD, native renderer, database, provider or deployment qualification is claimed here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import * as federal from '@capiro/meri-contracts/federal-workbench';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {USLM_SCHEMA_PROFILE,USLM_SCHEMA_SHA256} from '../../../../packages/contracts/federal-workbench/schema-receipt.mjs';
import {structuralDossierMaterial} from '../../../../packages/contracts/federal-workbench/structural-dossier.mjs';
import {textSha256 as sha} from '../../../artifacts/federal-drafting/engine.mjs';
import {opFor} from '../../../artifacts/federal-drafting/test/fixtures.mjs';
import {fixture,bytes,publication} from './federal-workbench-fixture.mjs';
const official=await readFile(new URL('../../../artifacts/federal-drafting/uslm-schema/test/fixtures/BILLS-114hres99eh.xml',import.meta.url),'utf8');
const schemaPort={async validate(text){return {profile:USLM_SCHEMA_PROFILE,schemaSha256:USLM_SCHEMA_SHA256,sourceSha256:sha(text),bytes:Buffer.byteLength(text),valid:true};}};
const writes=x=>({executions:x.f.state.executions.length,puts:x.f.state.puts,versions:x.f.sql.state.versions.size});
async function exchange(x,route,body,review){
 const request=federal.receiveFederalRequest(route,bytes(body)),response=await x.post(route,request),raw=await response.json();
 const received=await federal.receiveFederalResponse(route,response.status,bytes(raw),request,review);
 return {status:response.status,raw,received,request};
}
const good=result=>{assert.equal(result.status,200,JSON.stringify(result.raw));return result.received;};
async function setup(t,{text=official,profile=true,pdf=false}={}){
 const x=await fixture(t,{native:true,raw:true,text,docx:true,xml:true,pdf,federalValidator:schemaPort,realClock:true});
 const imported=good(await exchange(x,'federal-import',{...x.importRequest(),validationProfile:'uslm-2.1.0',...(profile?{sourceProfile:'uslm-text-runs/1'}:{})}));
 const selectionFor=operations=>({versionId:imported.publication.version.versionId,expectedArtifactSha256:imported.publication.version.object.sha256,operations});
 const scope=imported.source.scopes.find(s=>profile?s.textRun?.decoded.includes('profound sorrow'):s.id==='xml:HE4CAF9520F654C99838F6B0FC30297BB');
 const selection=selectionFor([opFor(imported.source,{scopeId:scope.id,expectedText:'profound sorrow',text:'deep & lasting sorrow',...(profile?{textMode:'decoded-xml'}:{text:'deep sorrow'})})]);
 const review=good(await exchange(x,'federal-prepare',{selection}));return {x,imported,selection,selectionFor,review};
}

test('decoded profile retains exact XML, structured comparison and final Word spec/mapping/execution binding',async t=>{
 const {x,selection,review}=await setup(t),p=review.prepared,d=p.draft;
 assert.equal(d.source.parserVersion,'federal-uslm-xml/3');assert.equal(d.structuralProjection.status,'supported');
 assert.equal(d.outputs.consolidated,official.replace('profound sorrow','deep &amp; lasting sorrow'));
 assert.ok(d.structuralProjection.original.blocks.some(b=>b.runs?.some(r=>r.strike)));
 assert.ok(d.structuralProjection.revised.blocks.some(b=>b.runs?.some(r=>r.underline)));
 const tampered=structuredClone(review);tampered.prepared.draft.structuralProjection.original.blocks[0].runs[0].text+=' forged';
 const {revisionSha256:ignored,approval:state,...materialDraft}=tampered.prepared.draft;
 tampered.prepared.draft.revisionSha256=hash(materialDraft);
 tampered.prepared.revisionSha256=hash({sourceArtifact:p.sourceArtifact,draftSha256:tampered.prepared.draft.revisionSha256,schemaValidation:p.schemaValidation});
 await assert.rejects(federal.receiveFederalResponse('federal-prepare',200,bytes(tampered),federal.receiveFederalRequest('federal-prepare',bytes({selection}))),/STRUCTURAL_MISMATCH/);
 const xml=good(await exchange(x,'federal-publish',publication(selection,p.revisionSha256,'xml'),review));
 assert.equal(xml.publication.version.mimeType,'application/xml; charset=utf-8');assert.match(xml.publication.version.filename,/\.xml$/);
 assert.equal(xml.publication.version.object.sha256,d.outputHashes.consolidated);assert.equal(xml.structuralReceipt,undefined);
 assert.equal((await x.reads.download(xml.publication.version.versionId,x.f.context)).bytes.toString('utf8'),d.outputs.consolidated);
 const body=publication(selection,p.revisionSha256,'docx'),published=await exchange(x,'federal-publish',body,review),word=good(published);
 const execution=x.f.state.executions.at(-1),material=structuralDossierMaterial(p,null,'docx',execution.request.title);
 assert.deepEqual(execution.request,material.request);assert.equal(word.structuralReceipt.specSha256,hash(execution.request));
 assert.equal(word.structuralReceipt.executionRequestSha256,word.publication.execution.requestSha256);
 assert.notEqual(word.structuralReceipt.specSha256,word.structuralReceipt.executionRequestSha256);
 assert.equal(word.structuralReceipt.mappingSha256,hash({mapping:material.mapping,omissions:material.omissions}));
 assert.deepEqual(word.structuralReceipt.mapping,material.mapping);
 for(const m of material.mapping.filter(m=>m.kind==='run'))assert.equal(typeof execution.request.content.blocks[m.blockIndex].runs[m.runIndex].text,'string');
 const before=writes(x),replayed=good(await exchange(x,'federal-publish',body,review));
 assert.deepEqual(replayed.publication.version,word.publication.version);assert.deepEqual(replayed.structuralReceipt,word.structuralReceipt);
 assert.notEqual(replayed.publication.execution.authorizationReceiptId,word.publication.execution.authorizationReceiptId);assert.deepEqual(writes(x),before);
 for(const field of ['specSha256','executionRequestSha256','mappingSha256']){
  const altered=structuredClone(word);altered.structuralReceipt[field]='0'.repeat(64);
  await assert.rejects(federal.receiveFederalResponse('federal-publish',200,bytes(altered),published.request,review),/STRUCTURAL_MISMATCH/);
 }
 const altered=structuredClone(word);altered.structuralReceipt.mapping[0].blockIndex++;
 await assert.rejects(federal.receiveFederalResponse('federal-publish',200,bytes(altered),published.request,review),/STRUCTURAL_MISMATCH/);
 const pdf=await exchange(x,'federal-publish',publication(selection,p.revisionSha256,'pdf'),review);
 assert.equal(pdf.status,422);assert.equal(pdf.raw.error.code,'UNSUPPORTED_DOCUMENT_FORMAT');assert.deepEqual(writes(x),before);
 assert.equal(structuralDossierMaterial(p,null,'pdf').request.format,'pdf');
});

test('saved structural revision reloads and approval binds exactly its exported Word dossier',async t=>{
 const {x,selection,review}=await setup(t),p=review.prepared;
 const saved=good(await exchange(x,'federal-publish',publication(selection,p.revisionSha256,'draft'),review));
 const v=saved.publication.version,loaded=good(await exchange(x,'federal-load',{versionId:v.versionId,expectedArtifactSha256:v.object.sha256}));
 assert.deepEqual(loaded.prepared,p);
 const approved=good(await exchange(x,'federal-approve',{versionId:v.versionId,expectedArtifactSha256:v.object.sha256,revisionSha256:p.revisionSha256,deliveryId:randomUUID()}));
 const exported=good(await exchange(x,'federal-publish',publication(selection,p.revisionSha256,'docx',{reviewVersionId:approved.savedDraft.versionId}),approved));
 assert.equal(exported.review,'approved');assert.deepEqual(exported.approval,approved.approval);
 assert.ok(x.f.state.executions.at(-1).request.content.blocks.some(b=>b.runs?.some(r=>r.text.includes('Approval: approved revision'))));
 assert.equal(exported.structuralReceipt.revisionSha256,p.revisionSha256);
});

test('typed whole-source removal retains a structured original and zero-byte TXT but refuses XML before writes',async t=>{
 const {x,imported,selectionFor}=await setup(t),s=imported.source;
 const selection=selectionFor([{id:'remove',kind:'remove_source_text',expectedSourceSha256:s.sha256,expectedTextSha256:s.sha256,dependsOn:[]}]);
 const review=good(await exchange(x,'federal-prepare',{selection})),p=review.prepared;
 assert.equal(p.draft.structuralProjection.consolidated,null);assert.equal(p.draft.structuralProjection.revised,null);
 assert.ok(p.draft.structuralProjection.original.blocks.every(b=>b.runs.every(r=>r.strike)));
 const before=writes(x),xml=await exchange(x,'federal-publish',publication(selection,p.revisionSha256,'xml'),review);
 assert.equal(xml.status,422);assert.equal(xml.raw.error.code,'DRAFT_XML_REMOVED');assert.deepEqual(writes(x),before);
 const txt=good(await exchange(x,'federal-publish',publication(selection,p.revisionSha256,'consolidated'),review));assert.equal(txt.publication.version.object.bytes,0);
 const word=good(await exchange(x,'federal-publish',publication(selection,p.revisionSha256,'docx'),review));
 assert.ok(word.structuralReceipt.mapping.every(m=>m.part==='original'));
});

test('unsupported structure keeps decoded/XML work available and refuses structural Word without flattening',async t=>{
 const {x,selection,review}=await setup(t,{text:official.replace('<main ', '<main style="color:red" ')}),p=review.prepared;
 assert.deepEqual(p.draft.structuralProjection,{profile:'uslm-word/1',status:'unsupported',code:'DRAFT_STRUCTURAL_UNSUPPORTED'});
 assert.ok(p.draft.findings.some(f=>f.category==='structural-export'&&f.status==='unresolved'));
 const before=writes(x),word=await exchange(x,'federal-publish',publication(selection,p.revisionSha256,'docx'),review);
 assert.equal(word.status,422);assert.equal(word.raw.error.code,'DRAFT_STRUCTURAL_UNSUPPORTED');assert.deepEqual(writes(x),before);
 good(await exchange(x,'federal-publish',publication(selection,p.revisionSha256,'xml'),review));
});

test('prior schema profile exports native XML without acquiring structural fields',async t=>{
 const {x,selection,review}=await setup(t,{profile:false});assert.equal(review.prepared.draft.structuralProjection,undefined);
 const xml=good(await exchange(x,'federal-publish',publication(selection,review.prepared.revisionSha256,'xml'),review));
 assert.equal(xml.structuralReceipt,undefined);assert.equal(xml.publication.version.object.sha256,review.prepared.draft.outputHashes.consolidated);
});

test('PDF uses the same structural request and immutable receipt under synthetic trusted renderer admission',async t=>{
 const {x,selection,review}=await setup(t,{pdf:true}),p=review.prepared;
 const input=publication(selection,p.revisionSha256,'pdf'),pdf=good(await exchange(x,'federal-publish',input,review));
 assert.equal(pdf.publication.version.mimeType,'application/pdf');assert.match(pdf.publication.version.filename,/\.pdf$/);
 assert.equal(pdf.publication.execution.nativeQualified,false);assert.equal(pdf.publication.inspection.rendered,false);
 const call=x.f.state.executions.at(-1),material=structuralDossierMaterial(p,null,'pdf',call.request.title);
 assert.deepEqual(call.request,material.request);assert.equal(pdf.structuralReceipt.specSha256,hash(material.request));
 const downloaded=await x.reads.download(pdf.publication.version.versionId,x.f.context);assert.equal(downloaded.bytes.subarray(0,5).toString(),'%PDF-');
 const before=writes(x),replayed=good(await exchange(x,'federal-publish',input,review));
 assert.deepEqual(replayed.publication.version,pdf.publication.version);assert.deepEqual(replayed.structuralReceipt,pdf.structuralReceipt);assert.deepEqual(writes(x),before);
});
