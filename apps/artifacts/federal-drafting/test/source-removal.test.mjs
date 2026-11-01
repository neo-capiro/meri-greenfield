import test from 'node:test';
import assert from 'node:assert/strict';
import {compileFederalDraft,textSha256} from '../engine.mjs';
import {sourceFor,opFor} from './fixtures.mjs';
import {scopedSource} from './scoped-fixture.mjs';
import {uslmSource} from './uslm-fixture.mjs';
import {validateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';

const complete=source=>({...source,coverage:{...source.coverage,complete:true}});
const remove=(source,over={})=>({id:'remove',kind:'remove_source_text',expectedSourceSha256:source.sha256,expectedTextSha256:source.sha256,dependsOn:[],...over});
const emptySha='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

test('explicit complete-source removal has zero consolidated bytes and full original deletion for all parser layers',()=>{
 for(const source of [complete(sourceFor(['SEC. 1. Café 😀\r\n'])),complete(scopedSource()),complete(uslmSource())]){
  const operation=remove(source),before=structuredClone({source,operation}),draft=compileFederalDraft(source,[operation]);
  assert.equal(draft.resultKind,'source-text-removed');assert.equal(draft.outputs.consolidated,'');
  assert.equal(Buffer.byteLength(draft.outputs.consolidated),0);assert.equal(draft.outputHashes.consolidated,emptySha);
  assert.deepEqual(draft.outputs.segments,[{kind:'delete',text:source.text}]);
  assert.match(draft.outputs.operative,/Proposed removal of all selected source text/);assert.match(draft.outputs.operative,/does not establish enactment/);
  assert.equal(draft.approval,'unapproved');assert.deepEqual({source,operation},before);
  assert.throws(()=>validateShape('FederalDraftOperation',operation));
 }
});

test('removal binds exact current full text and all independent or transitive dependencies',()=>{
 const source=complete(sourceFor()),a=opFor(source,{id:'a'}),b=opFor(source,{id:'b',scopeId:'section-2',text:'$250'});
 const intermediate=compileFederalDraft(source,[a,b]);
 const removal=remove(source,{expectedTextSha256:intermediate.outputHashes.consolidated,dependsOn:['a','b']});
 assert.equal(compileFederalDraft(source,[a,b,removal]).outputHashes.consolidated,emptySha);
 assert.throws(()=>compileFederalDraft(source,[a,b,{...removal,dependsOn:['a']}]),{code:'DRAFT_DEPENDENCY_REQUIRED'});
 assert.throws(()=>compileFederalDraft(source,[a,b,{...removal,expectedTextSha256:source.sha256}]),{code:'DRAFT_ANCESTOR_CHANGED'});
 const c=opFor(source,{id:'c',expectedText:'$150',text:'$175',expectedScopeSha256:textSha256(source.text.slice(source.scopes[0].start,source.scopes[0].end).replace('$100','$150')),dependsOn:['a','b']});
 const after=compileFederalDraft(source,[a,b,c]);
 assert.equal(compileFederalDraft(source,[a,b,c,remove(source,{dependsOn:['c'],expectedTextSha256:after.outputHashes.consolidated})]).outputHashes.consolidated,emptySha);
});

test('partial, wrong source, widened removal and trailing operations refuse without mutating the source',()=>{
 const source=complete(sourceFor()),before=structuredClone(source),operation=remove(source);
 for(const [candidate,code] of [[{...operation,expectedSourceSha256:'0'.repeat(64)},'DRAFT_SOURCE_MISMATCH'],
  [{...operation,expectedTextSha256:'0'.repeat(64)},'DRAFT_ANCESTOR_CHANGED'],[{...operation,scopeId:'document'},'DRAFT_OPERATION_INVALID'],
  [{...operation,dependsOn:['missing']},'DRAFT_DEPENDENCY_INVALID']])assert.throws(()=>compileFederalDraft(source,[candidate]),{code});
 assert.throws(()=>compileFederalDraft(sourceFor(),[operation]),{code:'DRAFT_SOURCE_INCOMPLETE'});
 assert.throws(()=>compileFederalDraft(source,[operation,opFor(source)]),{code:'DRAFT_SOURCE_REMOVED'});
 assert.throws(()=>compileFederalDraft(source,[operation,{...operation,id:'again',dependsOn:['remove']}]),{code:'DRAFT_SOURCE_REMOVED'});
 assert.deepEqual(source,before);
});

test('ordinary empty deletion still refuses and old normal revision hashes remain byte stable',()=>{
 const source=complete(sourceFor());source.scopes=[{id:'document',label:'all',start:0,end:source.text.length,sha256:source.sha256}];
 const deletion=opFor(source,{scopeId:'document',kind:'delete',expectedText:source.text});
 assert.throws(()=>compileFederalDraft(source,[deletion]),{code:'DRAFT_WHOLE_SOURCE_REPEAL_UNSUPPORTED'});
 assert.throws(()=>compileFederalDraft(source,[deletion,remove(source,{dependsOn:[deletion.id],expectedTextSha256:emptySha})]),{code:'DRAFT_NO_CHANGE'});
 const old=sourceFor(),draft=compileFederalDraft(old,[opFor(old)]);
 assert.equal(draft.revisionSha256,'bf0c1a4ca0239d9440e59a9b434b8266f85ecb02ef9b99059aa5248f78be06eb');
 assert.equal(Object.hasOwn(draft,'resultKind'),false);
});
