import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createArtifactService} from '../../service.mjs';
import {nativeDocumentFixture} from '../../test/native-document-fixture.mjs';
import {federalDraftExportRequests} from '../preparation.mjs';
import {sourceFor,opFor} from './fixtures.mjs';
import {textSha256} from '../engine.mjs';

async function fixture(){
 const f=nativeDocumentFixture(),source=sourceFor(),retained=await f.run({...f.call,request:{...f.call.request,title:'Synthetic source envelope',content:{text:JSON.stringify(source)}}});
 const artifacts=createArtifactService({...f.options,ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()})});
 const selection={versionId:retained.version.versionId,expectedArtifactSha256:retained.version.object.sha256,operations:[opFor(source)]};
 return {...f,source,retained,artifacts,selection};
}

test('canonical artifact source -> amendment preparation -> three exact native immutable outputs, without preparation writes',async()=>{
 const f=await fixture(),before={puts:f.state.puts,runs:f.state.executions.length};
 const prepared=await f.artifacts.prepareFederalDraft(f.selection,f.context);
 assert.deepEqual({puts:f.state.puts,runs:f.state.executions.length},before);assert.equal(prepared.sourceArtifact.sha256,f.retained.version.object.sha256);
 const requests=federalDraftExportRequests(prepared,prepared.revisionSha256),ids=[];
 for(const [kind,request] of Object.entries(requests)){
  const output=await f.run({deliveryId:'federal-'+kind,baseVersionId:null,request});ids.push(output.version.versionId);
  const downloaded=await f.artifacts.download(output.version.versionId,f.context);
  assert.equal(downloaded.bytes.toString('utf8'),prepared.draft.outputs[kind]);
  assert.equal(output.version.object.sha256,prepared.draft.outputHashes[kind]);
 }
 assert.equal(new Set(ids).size,3);
 // This exercises existing authorization/publication, not an unimplemented human-review receiver.
 assert.equal(prepared.approval,'unapproved');
});

test('source custody denies changed hash, revoked access, foreign actor and suppressed source before compiling',async()=>{
 const f=await fixture();
 await assert.rejects(f.artifacts.prepareFederalDraft({...f.selection,expectedArtifactSha256:'0'.repeat(64)},f.context),{code:'DRAFT_SOURCE_CHANGED'});
 await assert.rejects(f.artifacts.prepareFederalDraft(f.selection,{...f.context,binding:{...f.context.binding,actorId:'another-actor'}}),{code:'ARTIFACT_VERSION_CONTEXT'});
 f.state.denied=true;await assert.rejects(f.artifacts.prepareFederalDraft(f.selection,f.context),/CURRENT_ACCESS_DENIED/);f.state.denied=false;
 f.sql.suppressed.add(`${f.context.binding.tenantId}:artifact:${f.retained.version.artifactId}`);
 await assert.rejects(f.artifacts.prepareFederalDraft(f.selection,f.context),{code:'RETENTION_SUPPRESSED'});
});

test('an edited draft cannot export using a prior revision hash or altered compiled output',async()=>{
 const f=await fixture(),a=await f.artifacts.prepareFederalDraft(f.selection,f.context);
 const b=await f.artifacts.prepareFederalDraft({...f.selection,operations:[opFor(f.source,{text:'$200'})]},f.context);
 assert.throws(()=>federalDraftExportRequests(b,a.revisionSha256),{code:'DRAFT_REVISION_CHANGED'});
 const tampered=structuredClone(a);tampered.draft.outputs.consolidated='unexpected output';
 assert.throws(()=>federalDraftExportRequests(tampered,a.revisionSha256),{code:'DRAFT_REVISION_CHANGED'});
 const approved=structuredClone(a);approved.approval='approved';assert.throws(()=>federalDraftExportRequests(approved,a.revisionSha256),{code:'DRAFT_REVISION_CHANGED'});
});

test('preparation refuses a package that exceeds the existing native export contract before any output write',async()=>{
 const f=nativeDocumentFixture(),source=sourceFor(['A'.repeat(5000)]),retained=await f.run({...f.call,request:{...f.call.request,content:{text:JSON.stringify(source)}}});
 const artifacts=createArtifactService({...f.options,ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()})});
 let before='A'.repeat(5000);const operations=[];
 for(let n=0;n<12;n++){
  const text=String.fromCharCode(66+n).repeat(5000);
  operations.push(opFor(source,{id:'op-'+n,expectedText:before,text,expectedScopeSha256:textSha256(before),dependsOn:n?['op-'+(n-1)]:[]}));before=text;
 }
 const writes=f.state.puts;
 await assert.rejects(artifacts.prepareFederalDraft({versionId:retained.version.versionId,expectedArtifactSha256:retained.version.object.sha256,operations},f.context),{code:'DRAFT_OUTPUT_UNEXPORTABLE'});
 assert.equal(f.state.puts,writes);
});

test('ordered multi-operation preparation exports three exact outputs and replays the same revision',async()=>{
 const f=await fixture(),selection={...f.selection,operations:[
  opFor(f.source,{id:'op-1',scopeId:'section-1',text:'$150'}),
  opFor(f.source,{id:'op-2',scopeId:'section-2',text:'$250'})]};
 const prepared=await f.artifacts.prepareFederalDraft(selection,f.context);
 assert.deepEqual(prepared.draft.operations.map(operation=>operation.dependsOn),[[],[]]);
 assert.equal(prepared.draft.outputs.consolidated,f.source.text.replace('$100','$150').replace('$100','$250'));
 // Each changed scope contributes one exact comparison: dropping deleted segments rebuilds
 // the consolidated text and dropping inserted segments rebuilds the original source.
 const segments=prepared.draft.outputs.segments;
 assert.equal(segments.filter(part=>part.kind!=='delete').map(part=>part.text).join(''),prepared.draft.outputs.consolidated);
 assert.equal(segments.filter(part=>part.kind!=='insert').map(part=>part.text).join(''),f.source.text);
 const requests=federalDraftExportRequests(prepared,prepared.revisionSha256);
 for(const [kind,request] of Object.entries(requests)){
  const output=await f.run({deliveryId:'multi-'+kind,baseVersionId:null,request});
  const downloaded=await f.artifacts.download(output.version.versionId,f.context);
  assert.equal(downloaded.bytes.toString('utf8'),prepared.draft.outputs[kind]);
 }
 assert.equal(prepared.approval,'unapproved');
 const replay=await f.artifacts.prepareFederalDraft(selection,f.context);
 assert.equal(replay.revisionSha256,prepared.revisionSha256);
});
