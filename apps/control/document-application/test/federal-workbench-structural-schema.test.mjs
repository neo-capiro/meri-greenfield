/** Candidate qualification: actual fixed Python/XSD with parser3 and the canonical public receiver.
 * Core/SQL/object and Word/XML execution ports are synthetic; this does not qualify native rendering. */
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
test('actual pinned XSD qualifies decoded parser3 edit and exact XML/structural Word exports',
 {skip:pythonExecutable?false:'FEDERAL_SCHEMA_TEST_PYTHON not configured; actual parser3 schema qualification UNRUN'},async t=>{
 const root=await mkdtemp(join(tmpdir(),'meri-structural-schema-'));
 t.after(async()=>{assert.deepEqual(await readdir(root),[]);await rm(root,{recursive:true,force:true});});
 const validator=createFederalSchemaValidator({pythonExecutable,tempRoot:root});
 const text=await readFile(new URL('../../../artifacts/federal-drafting/uslm-schema/test/fixtures/BILLS-114hres99eh.xml',import.meta.url),'utf8');
 const x=await fixture(t,{native:true,raw:true,text,docx:true,xml:true,federalValidator:validator,realClock:true});
 const exchange=async(route,input,review)=>{
  const request=federal.receiveFederalRequest(route,bytes(input)),response=await x.post(route,request),result=await response.json();
  assert.equal(response.status,200,JSON.stringify(result));
  return federal.receiveFederalResponse(route,response.status,bytes(result),request,review);
 };
 const imported=await exchange('federal-import',{...x.importRequest(),validationProfile:'uslm-2.1.0',sourceProfile:'uslm-text-runs/1'});
 assert.equal(imported.source.parserVersion,'federal-uslm-xml/3');
 const scope=imported.source.scopes.find(s=>s.textRun?.decoded.includes('profound sorrow'));
 const selection={versionId:imported.publication.version.versionId,expectedArtifactSha256:imported.publication.version.object.sha256,
  operations:[opFor(imported.source,{scopeId:scope.id,expectedText:'profound sorrow',text:'deep & lasting sorrow',textMode:'decoded-xml'})]};
 const review=await exchange('federal-prepare',{selection}),p=review.prepared;
 assert.equal(p.draft.outputs.consolidated,text.replace('profound sorrow','deep &amp; lasting sorrow'));
 assert.equal(p.schemaValidation.source.sourceSha256,imported.source.sha256);
 assert.equal(p.schemaValidation.consolidated.sourceSha256,p.draft.outputHashes.consolidated);
 assert.equal(p.draft.structuralProjection.status,'supported');
 const xml=await exchange('federal-publish',publication(selection,p.revisionSha256,'xml'),review);
 assert.equal(xml.publication.version.mimeType,'application/xml; charset=utf-8');
 assert.equal((await x.reads.download(xml.publication.version.versionId,x.f.context)).bytes.toString('utf8'),p.draft.outputs.consolidated);
 const word=await exchange('federal-publish',publication(selection,p.revisionSha256,'docx'),review);
 assert.equal(word.structuralReceipt.revisionSha256,p.revisionSha256);
 assert.equal(word.structuralReceipt.sourceSha256,imported.source.sha256);
 assert.equal(word.structuralReceipt.consolidatedSha256,p.draft.outputHashes.consolidated);
 assert.equal(word.publication.execution.nativeQualified,false);
});
