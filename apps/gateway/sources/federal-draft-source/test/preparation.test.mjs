import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from '../../../../runtime/test/reads-native-fixture.mjs';
import {connect} from '../../../../worker/conversation/reads/test/native-mcp-fixture.mjs';
import {preparationCase,operation} from './fixture.mjs';
import {nativeDocumentFixture} from '../../../../artifacts/test/native-document-fixture.mjs';
import {createArtifactService} from '../../../../artifacts/service.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {prepareNativeFederalDraft} from '../../../../artifacts/federal-drafting/native-source.mjs';

test('fixed native source -> deterministic preparation -> three distinct canonical artifacts',async()=>{
 const f=preparationCase(),result=JSON.parse(await f.handler()(f.call())).result;
 assert.equal(new URL(f.wire[0].url).pathname,'/api/clio/tools/read_federal_draft_source');assert.deepEqual(f.wire[0].body,f.arguments.selection);
 assert.equal(result.draft.outputs.consolidated,'SEC. 1. Synthetic authorization.\nThe amount is $30.\n');
 assert.match(result.draft.outputs.operative,/strike "\$20" and insert "\$30"/);
 assert.deepEqual(result.draft.outputs.segments.filter(x=>x.kind!=='unchanged'),[{kind:'delete',text:'2'},{kind:'insert',text:'3'}]);
 assert.equal(result.approval,'unapproved');
 const artifacts=nativeDocumentFixture(),reader=createArtifactService({...artifacts.options,ids:()=>{throw Error('read must not write');}}),ids=[];
 for(const kind of ['operative','consolidated','redline']){
  const retained=await artifacts.run({deliveryId:'federal-'+kind,baseVersionId:null,request:result.exports[kind]});ids.push(retained.version.versionId);
  const read=await reader.download(retained.version.versionId,artifacts.context);
  assert.equal(read.bytes.toString('utf8'),result.draft.outputs[kind]);assert.equal(retained.version.object.sha256,result.draft.outputHashes[kind]);
 }
 assert.equal(new Set(ids).size,3);
});
test('native preparation refuses stale source, ambiguous targets and altered result/export',async()=>{
 const f=preparationCase(),result=JSON.parse(await f.handler()(f.call())).result;
 const unavailable={tool:'read_federal_draft_source',authoritativeOwner:'federal_evidence_current',currentStatus:'unavailable',selection:f.arguments.selection,reason:'exact_current_source_unavailable'};
 assert.throws(()=>prepareNativeFederalDraft(f.arguments.selection,unavailable,f.arguments.operations),/DRAFT_SOURCE_UNAVAILABLE/);
 for(const mutate of [r=>{r.exports.consolidated.content.text='changed';},r=>{r.draft.outputs.consolidated='changed';},r=>{r.draft.approval='approved';},r=>{r.nativeSource.source.fetchedAt='2026-02-03T00:00:00.000Z';}]){
  const changed=structuredClone(result);mutate(changed);assert.throws(()=>f.contract.assertOutput(changed,{request:f.arguments}));
 }
 const changed=structuredClone(f.arguments);changed.operations[0].expectedText='.';changed.operations[0].expectedTextSha256='0'.repeat(64);assert.throws(()=>f.contract.normalizeInput(changed));
});
test('unreported publication date stays null and cannot borrow the fetch date',()=>{
 const f=preparationCase(),source=structuredClone(f.state.page);source.source.publishedAt=null;
 const draft=prepareNativeFederalDraft(f.arguments.selection,source,f.arguments.operations);
 assert.equal(draft.draft.source.publishedAt,null);assert.match(draft.draft.outputs.operative,/published unreported/);
 assert.doesNotThrow(()=>f.contract.assertOutput(draft,{request:f.arguments}));
});
test('actual SDK native tool path records the exact compiled result and refuses access loss',async t=>{
 const scene=preparationCase(),f=await fixture('federal-draft-source',operation.id,{scene}),m=await connect(t,f);
 const output=await m.call();assert.equal(output.isError,undefined,JSON.stringify(output));
 const envelope=JSON.parse(output.content[0].text);assert.equal(envelope.result.draft.outputs.consolidated.includes('$30'),true);
 assert.equal(m.runtime.receipts()[0].resultSha256,canonicalSha256(envelope));
 f.revoke();assert.equal((await m.call()).isError,true);assert.equal(scene.wire.length,1);
});
test('revocation during source read withholds the prepared draft and receipt',async t=>{
 const scene=preparationCase(),f=await fixture('federal-draft-source',operation.id,{scene}),m=await connect(t,f);
 scene.state.afterSource=()=>f.revoke();assert.equal((await m.call()).isError,true);assert.deepEqual(m.runtime.receipts(),[]);
});
