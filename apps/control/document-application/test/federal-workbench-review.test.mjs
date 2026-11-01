/** Review approval, revision invalidation, history, the Word dossier, USLM import and public refusal reasons through
 * the mounted routes, canonical artifact owners and the distributed receiver. Synthetic ports only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {opFor} from '../../../artifacts/federal-drafting/test/fixtures.mjs';
import {USLM_TEXT,A,S1,B,slice} from '../../../artifacts/federal-drafting/test/uslm-fixture.mjs';
import {FEDERAL_DOSSIER_LEGEND} from '../../../artifacts/federal-drafting/dossier.mjs';
import {FEDERAL_REVIEW_SCHEMA} from '../../../artifacts/federal-drafting/review-record.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {textSha256} from '../../../artifacts/federal-drafting/engine.mjs';
import * as distributedFederal from '@capiro/meri-contracts/federal-workbench';
import {fixture,bytes,ok,publication,importedSelection} from './federal-workbench-fixture.mjs';

const admit=(route,body)=>distributedFederal.receiveFederalRequest(route,bytes(body));
async function roundTrip(x,route,body,review){
 const request=admit(route,body),response=await x.post(route,request),raw=await response.json();
 const received=await distributedFederal.receiveFederalResponse(route,response.status,bytes(raw),request,review);
 assert.deepEqual(received,raw);return {status:response.status,raw,received,request};
}
const approve=(saved,revisionSha256)=>({versionId:saved.publication.version.versionId,expectedArtifactSha256:saved.publication.version.object.sha256,revisionSha256,deliveryId:randomUUID()});

test('approval binds one saved revision; a later revision is unapproved by the store rule and history shows every state',async t=>{
 const x=await fixture(t,{nested:true});
 const first=await roundTrip(x,'federal-prepare',{selection:x.selection}),rev1=first.received.prepared.revisionSha256;
 assert.equal(first.received.approval,null);
 const v1=await roundTrip(x,'federal-publish',publication(x.selection,rev1,'draft'),first.received);
 assert.equal(v1.received.approval,null);
 // Approve the exact saved version: a child version carrying the same compiled revision plus the approval.
 const approval=approve(v1.received,rev1),approved=await roundTrip(x,'federal-approve',approval);
 assert.equal(approved.status,200);assert.deepEqual(approved.received.approval,{revisionSha256:rev1,reviewVersionId:v1.received.publication.version.versionId});
 assert.equal(approved.received.savedDraft.parentVersionId,v1.received.publication.version.versionId);
 assert.deepEqual(approved.received.prepared,first.received.prepared);
 const v2=approved.received.savedDraft,writes=x.f.state.executions.length;
 // Replay of the same approval delivery returns the same version without a second effect.
 assert.equal((await ok(await x.post('federal-approve',approval))).savedDraft.versionId,v2.versionId);assert.equal(x.f.state.executions.length,writes);
 // Loading the approved version carries its approval; loading the unapproved parent does not.
 const loadedV2=await roundTrip(x,'federal-load',{versionId:v2.versionId,expectedArtifactSha256:v2.object.sha256});
 assert.deepEqual(loadedV2.received.approval,approved.received.approval);
 const loadedV1=await roundTrip(x,'federal-load',{versionId:v1.received.publication.version.versionId,expectedArtifactSha256:v1.received.publication.version.object.sha256});
 assert.equal(loadedV1.received.approval,null);
 // Exports cite the saved review they come from: only the approved version makes an export approved.
 const exported=await roundTrip(x,'federal-publish',publication(x.selection,rev1,'operative',{reviewVersionId:v2.versionId}),loadedV2.received);
 assert.equal(exported.received.review,'approved');assert.deepEqual(exported.received.approval,approved.received.approval);
 const unapproved=await roundTrip(x,'federal-publish',publication(x.selection,rev1,'consolidated',{reviewVersionId:v1.received.publication.version.versionId}),loadedV1.received);
 assert.equal(unapproved.received.review,'confirmed-for-export');assert.equal(unapproved.received.approval,null);
 const plain=await roundTrip(x,'federal-publish',publication(x.selection,rev1,'redline'),loadedV1.received);
 assert.equal(plain.received.review,'confirmed-for-export');assert.equal(plain.received.approval,null);
 // A revision of the approved review: new revision hash, child of the approval version, unapproved by construction.
 const selection={...x.selection,operations:[opFor(x.source,{scopeId:'a',text:'$175'})]};
 const next=await roundTrip(x,'federal-prepare',{selection}),rev2=next.received.prepared.revisionSha256;assert.notEqual(rev2,rev1);
 const v3=await roundTrip(x,'federal-publish',publication(selection,rev2,'draft',{baseVersionId:v2.versionId,baseRevisionSha256:rev1}),next.received);
 assert.equal(v3.received.publication.version.parentVersionId,v2.versionId);
 const loadedV3=await roundTrip(x,'federal-load',{versionId:v3.received.publication.version.versionId,expectedArtifactSha256:v3.received.publication.version.object.sha256});
 assert.equal(loadedV3.received.approval,null);
 const fromRevision=await roundTrip(x,'federal-publish',publication(selection,rev2,'operative',{reviewVersionId:v3.received.publication.version.versionId}),loadedV3.received);
 assert.equal(fromRevision.received.review,'confirmed-for-export');
 // The prior approval cannot be cited for the revised text, and an approval cannot be approved again.
 const before=x.f.state.executions.length;
 assert.equal((await x.post('federal-publish',publication(selection,rev2,'operative',{reviewVersionId:v2.versionId}))).status,409);
 assert.equal((await x.post('federal-approve',approve({publication:{version:v2}},rev1))).status,409);
 assert.equal((await x.post('federal-approve',approve(v3.received,rev1))).status,409);
 assert.equal((await x.post('federal-approve',{...approve(v3.received,rev2),expectedArtifactSha256:'0'.repeat(64)})).status,409);
 assert.equal((await x.post('federal-publish',publication(selection,rev2,'draft',{reviewVersionId:v2.versionId}))).status,400);
 assert.equal(x.f.state.executions.length,before);
 // History from the head lists every immutable review version with its own approval state.
 const history=await roundTrip(x,'federal-history',{versionId:v3.received.publication.version.versionId,limit:10,cursor:null});
 assert.equal(history.received.schema,FEDERAL_REVIEW_SCHEMA);
 assert.deepEqual(history.received.revisions.map(r=>[r.version.versionId,r.revisionSha256,r.approval]),[
  [v3.received.publication.version.versionId,rev2,null],[v2.versionId,rev1,approved.received.approval],[v1.received.publication.version.versionId,rev1,null]]);
 assert.deepEqual(history.received.revisions[1].sourceArtifact,first.received.prepared.sourceArtifact);
 const paged=await roundTrip(x,'federal-history',{versionId:v1.received.publication.version.versionId,limit:2,cursor:null});
 assert.equal(paged.received.revisions.length,2);assert.notEqual(paged.received.nextCursor,null);
 const rest=await ok(await x.post('federal-history',{versionId:v1.received.publication.version.versionId,limit:2,cursor:paged.received.nextCursor}));
 assert.deepEqual(rest.revisions.map(r=>r.version.versionId),[v1.received.publication.version.versionId]);assert.equal(rest.nextCursor,null);
 assert.equal((await x.post('federal-history',{versionId:v1.received.publication.version.versionId,limit:0,cursor:null})).status,400);
});

test('a retained approval that names another revision or another parent is invalid, never silently unapproved',async t=>{
 const x=await fixture(t),review=await ok(await x.post('federal-prepare',{selection:x.selection})),rev=review.prepared.revisionSha256;
 const saved=await ok(await x.post('federal-publish',publication(x.selection,rev,'draft')));
 const parent=saved.publication.version,record=(base,approval)=>({...x.f.call,deliveryId:randomUUID(),baseVersionId:base.versionId,
  request:{...x.f.call.request,title:'Synthetic approval',content:{text:JSON.stringify({schema:FEDERAL_REVIEW_SCHEMA,prepared:review.prepared,approval})}}});
 const stale=await x.f.run(record(parent,{revisionSha256:'1'.repeat(64),reviewVersionId:parent.versionId}));
 const load={versionId:stale.version.versionId,expectedArtifactSha256:stale.version.object.sha256};
 for(const [route,body] of [['federal-load',load],['federal-history',{versionId:stale.version.versionId,limit:5,cursor:null}],['federal-approve',{...load,revisionSha256:rev,deliveryId:randomUUID()}]]){
  const response=await x.post(route,body);assert.equal(response.status,422);assert.equal((await response.json()).error.code,'DRAFT_REVIEW_INVALID');
 }
 const foreign=await x.f.run(record(stale.version,{revisionSha256:rev,reviewVersionId:randomUUID()}));
 assert.equal((await x.post('federal-load',{versionId:foreign.version.versionId,expectedArtifactSha256:foreign.version.object.sha256})).status,422);
 // A genuine approval record of a saved review still loads with its approval.
 const other=(await ok(await x.post('federal-publish',publication(x.selection,rev,'draft')))).publication.version;
 const genuine=await x.f.run(record(other,{revisionSha256:rev,reviewVersionId:other.versionId}));
 const loaded=await ok(await x.post('federal-load',{versionId:genuine.version.versionId,expectedArtifactSha256:genuine.version.object.sha256}));
 assert.deepEqual(loaded.approval,{revisionSha256:rev,reviewVersionId:other.versionId});
});

test('the Word dossier export renders through the canonical Word owner and carries source hash, revision and approval',async t=>{
 const x=await fixture(t,{docx:true}),review=await ok(await x.post('federal-prepare',{selection:x.selection})),rev=review.prepared.revisionSha256;
 const prepare=admit('federal-prepare',{selection:x.selection}),admitted=await distributedFederal.receiveFederalResponse('federal-prepare',200,bytes(review),prepare);
 const saved=await ok(await x.post('federal-publish',publication(x.selection,rev,'draft')));
 const approved=await ok(await x.post('federal-approve',approve(saved,rev)));
 const exported=await roundTrip(x,'federal-publish',publication(x.selection,rev,'docx',{reviewVersionId:approved.savedDraft.versionId}),admitted);
 assert.equal(exported.status,200);assert.equal(exported.received.review,'approved');
 const version=exported.received.publication.version;
 assert.equal(version.mimeType,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');assert.match(version.filename,/\.docx$/u);
 assert.equal(version.filename.includes(rev),true);
 const request=x.f.state.executions.at(-1).request;assert.equal(request.format,'docx');
 const lines=request.content.blocks.map(block=>block.runs.map(run=>run.text).join(''));
 assert.ok(lines.includes(`Source text SHA-256 ${x.source.sha256}; parser federal-plain-text/1; coverage partial.`));
 assert.ok(lines.includes(`Revision SHA-256 ${rev}; compiled revision SHA-256 ${review.prepared.draft.revisionSha256}.`));
 assert.ok(lines.includes(`Approval: approved revision ${rev}; approved review version ${saved.publication.version.versionId}.`));
 assert.ok(lines.includes(FEDERAL_DOSSIER_LEGEND));
 const downloaded=await x.reads.download(version.versionId,x.f.context);
 assert.deepEqual(JSON.parse(downloaded.bytes.toString('utf8')),request.content);
 const count=x.f.state.executions.length;
 const unapproved=await roundTrip(x,'federal-publish',publication(x.selection,rev,'docx'),admitted);
 assert.equal(unapproved.received.review,'confirmed-for-export');
 assert.equal(x.f.state.executions.at(-1).request.content.blocks.some(b=>b.runs[0].text==='Approval: unapproved revision.'),true);
 assert.equal(x.f.state.executions.length,count+1);
});

test('an official USLM extraction imports with section identity and compiles exact markup edits end to end',async t=>{
 const x=await fixture(t,{native:true,text:USLM_TEXT});
 const imported=await roundTrip(x,'federal-import',x.importRequest());
 assert.equal(imported.status,200);assert.equal(imported.received.source.parserVersion,'federal-uslm-xml/1');
 assert.deepEqual(imported.received.source.scopes.map(s=>s.id),['document',S1,A,B,'us:bill:119:hr:1:s2','us:bill:119:hr:1:s3']);
 const downloaded=await x.reads.download(imported.received.publication.version.versionId,x.f.context);
 assert.deepEqual(await distributedFederal.receiveFederalSource(downloaded.bytes),imported.received.source);
 const selection=importedSelection(imported.received,{scopeId:A,expectedText:'$100',text:'$150'});
 const review=await roundTrip(x,'federal-prepare',{selection});
 assert.equal(review.received.prepared.draft.outputs.consolidated,USLM_TEXT.replace('Pay $100 😀','Pay $150 😀'));
 for(const output of ['operative','consolidated','redline']){
  const exported=await roundTrip(x,'federal-publish',publication(selection,review.received.prepared.revisionSha256,output),review.received);
  const bytesOut=await x.reads.download(exported.received.publication.version.versionId,x.f.context);
  assert.equal(bytesOut.bytes.toString('utf8'),review.received.prepared.draft.outputs[output]);
 }
 const repeal=importedSelection(imported.received,{scopeId:S1,kind:'delete',expectedText:slice(imported.received.source,B)});
 assert.equal((await ok(await x.post('federal-prepare',{selection:repeal}))).prepared.draft.outputs.consolidated,USLM_TEXT.replace(slice(imported.received.source,B),''));
 const malformed=await roundTrip(x,'federal-prepare',{selection:importedSelection(imported.received,{scopeId:A,expectedText:'report',text:'re<port'})});
 assert.equal(malformed.status,422);assert.deepEqual(malformed.raw.error,{code:'DRAFT_XML_RESULT_MALFORMED',outcome:'READ_UNAVAILABLE',operationId:null});
});

test('non-USLM markup, DOCTYPE and whole-source repeal are explicit public refusals with their reasons',async t=>{
 for(const [text,code] of [['<html><body>bill</body></html>','DRAFT_USLM_NAMESPACE_UNSUPPORTED'],['<!DOCTYPE bill SYSTEM "https://invalid.example/dtd"><bill xmlns="http://xml.house.gov/schemas/uslm/1.0"/>','DRAFT_XML_DOCTYPE_UNSUPPORTED']]){
  const x=await fixture(t,{native:true,text}),refused=await roundTrip(x,'federal-import',x.importRequest());
  assert.equal(refused.status,422);assert.deepEqual(refused.raw.error,{code,outcome:'READ_UNAVAILABLE',operationId:null});assert.equal(x.f.state.executions.length,1);
 }
 const x=await fixture(t),selection={...x.selection,operations:[opFor(x.source,{scopeId:'section-1',kind:'delete',expectedText:'SEC. 1. Payment is $100.\n'}),
  opFor(x.source,{id:'op-2',scopeId:'section-2',kind:'delete',expectedText:'SEC. 2. Payment is $100.\n'}),
  opFor(x.source,{id:'op-3',scopeId:'section-2',kind:'insert',position:'after',expectedText:'missing',text:'x',dependsOn:['op-2'],expectedScopeSha256:'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'})]};
 const missing=await roundTrip(x,'federal-prepare',{selection});
 assert.equal(missing.status,422);assert.deepEqual(missing.raw.error,{code:'DRAFT_TARGET_MISSING',outcome:'READ_UNAVAILABLE',operationId:'op-3'});
 const whole=await fixture(t,{nested:true}),repeal=await roundTrip(whole,'federal-prepare',{selection:{...whole.selection,operations:[opFor(whole.source,{scopeId:'document',kind:'delete',expectedText:whole.source.text})]}});
 assert.equal(repeal.status,422);assert.deepEqual(repeal.raw.error,{code:'DRAFT_WHOLE_SOURCE_REPEAL_UNSUPPORTED',outcome:'READ_UNAVAILABLE',operationId:null});
 const sectionRepeal=await ok(await whole.post('federal-prepare',{selection:{...whole.selection,operations:[opFor(whole.source,{scopeId:'s2',kind:'delete',expectedText:'SEC. 2. Review.\r\n'})]}}));
 assert.equal(sectionRepeal.prepared.draft.outputs.consolidated,whole.source.text.replace('SEC. 2. Review.\r\n',''));
});

test('typed removal saves as a child, reloads, exports genuine zero bytes and recovers its original withheld delivery',async t=>{
 const x=await fixture(t,{native:true,docx:true});
 const imported=(await roundTrip(x,'federal-import',x.importRequest())).received;
 const selected=importedSelection(imported),original=(await roundTrip(x,'federal-prepare',{selection:selected})).received;
 const saved=(await roundTrip(x,'federal-publish',publication(selected,original.prepared.revisionSha256,'draft'),original)).received;
 const removal={id:'remove',kind:'remove_source_text',expectedSourceSha256:imported.source.sha256,
  expectedTextSha256:original.prepared.draft.outputHashes.consolidated,dependsOn:selected.operations.map(op=>op.id)};
 const selection={...selected,operations:[...selected.operations,removal]},review=(await roundTrip(x,'federal-prepare',{selection})).received;
 assert.equal(review.prepared.draft.resultKind,'source-text-removed');assert.equal(review.prepared.draft.outputs.consolidated,'');
 const revision=review.prepared.revisionSha256;
 const child=(await roundTrip(x,'federal-publish',publication(selection,revision,'draft',{baseVersionId:saved.publication.version.versionId,baseRevisionSha256:original.prepared.revisionSha256}),review)).received;
 const loaded=(await roundTrip(x,'federal-load',{versionId:child.publication.version.versionId,expectedArtifactSha256:child.publication.version.object.sha256})).received;
 assert.deepEqual(loaded.prepared,review.prepared);assert.equal(loaded.approval,null);
 const consolidated=publication(selection,revision,'consolidated',{reviewVersionId:child.publication.version.versionId});
 x.deny();const withheld=await x.post('federal-publish',consolidated);
 assert.equal(withheld.status,403);assert.equal((await withheld.json()).error.outcome,'RESULT_NOT_RELEASED');
 const executions=x.f.state.executions.length;x.allow();
 const published=(await roundTrip(x,'federal-publish',consolidated,loaded)).received;
 assert.equal(x.f.state.executions.length,executions);
 const downloaded=await x.reads.download(published.publication.version.versionId,x.f.context);
 assert.equal(downloaded.bytes.length,0);assert.equal(published.publication.version.object.bytes,0);
 assert.equal(published.publication.version.object.sha256,'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
 for(const output of ['operative','redline','docx']){
  const exported=(await roundTrip(x,'federal-publish',publication(selection,revision,output),loaded)).received;
  const result=await x.reads.download(exported.publication.version.versionId,x.f.context);
  if(output==='docx')assert.match(result.bytes.toString(),/contains exactly zero bytes/);
  else assert.equal(result.bytes.toString(),loaded.prepared.draft.outputs[output]);
 }
 const history=(await roundTrip(x,'federal-history',{versionId:child.publication.version.versionId,limit:10,cursor:null})).received;
 assert.deepEqual(history.revisions.map(r=>r.revisionSha256),[revision,original.prepared.revisionSha256]);
 const old=(await roundTrip(x,'federal-load',{versionId:saved.publication.version.versionId,expectedArtifactSha256:saved.publication.version.object.sha256})).received;
 assert.deepEqual(old.prepared,original.prepared);
 const before=x.f.state.executions.length;x.nativeState.available=false;
 assert.notEqual((await x.post('federal-publish',publication(selection,revision,'consolidated'))).status,200);
 assert.notEqual((await x.post('federal-load',{versionId:child.publication.version.versionId,expectedArtifactSha256:child.publication.version.object.sha256})).status,200);
 assert.equal(x.f.state.executions.length,before);
});

test('receiver rejects forged empty outcome semantics even with recomputed revision hashes',async t=>{
 const x=await fixture(t,{native:true}),imported=(await roundTrip(x,'federal-import',x.importRequest())).received;
 const selection={...importedSelection(imported),operations:[{id:'remove',kind:'remove_source_text',expectedSourceSha256:imported.source.sha256,expectedTextSha256:imported.source.sha256,dependsOn:[]}]};
 const request=admit('federal-prepare',{selection}),raw=await ok(await x.post('federal-prepare',request));
 for(const mutate of [r=>{delete r.prepared.draft.resultKind;},r=>{r.prepared.draft.source.coverage.complete=false;},
  r=>{r.prepared.draft.operations[0].expectedSourceSha256='0'.repeat(64);},r=>{r.prepared.draft.operations[0].expectedTextSha256='0'.repeat(64);},
  r=>{r.prepared.draft.outputs.segments=[];},r=>{r.prepared.draft.outputs.consolidated='\n';}]){
  const changed=structuredClone(raw);mutate(changed);
  const p=changed.prepared,draft=p.draft;draft.outputHashes.consolidated=textSha256(draft.outputs.consolidated);
  const {revisionSha256,approval,...material}=draft;draft.revisionSha256=canonicalSha256(material);
  p.revisionSha256=canonicalSha256({sourceArtifact:p.sourceArtifact,draftSha256:draft.revisionSha256});
  await assert.rejects(distributedFederal.receiveFederalResponse('federal-prepare',200,bytes(changed),request));
 }
 const bad={...selection,operations:[{...selection.operations[0],expectedTextSha256:'0'.repeat(64)}]};
 const before=x.f.state.executions.length,response=await x.post('federal-prepare',{selection:bad});
 assert.equal(response.status,422);assert.equal((await response.json()).error.code,'DRAFT_ANCESTOR_CHANGED');
 assert.equal(x.f.state.executions.length,before);
});
