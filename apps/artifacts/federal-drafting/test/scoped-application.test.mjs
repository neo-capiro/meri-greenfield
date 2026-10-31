import test from 'node:test';
import assert from 'node:assert/strict';
import {compileFederalDraft,federalDraftSource,textSha256} from '../engine.mjs';
import {scopedSource,opFor,slice} from './scoped-fixture.mjs';
import {projectNativeFederalSource} from '../native-source.mjs';
import official from '../../../../packages/contracts/test/fixtures/federal-draft-source.wire.json' with {type:'json'};

function compile(source,ops,expected){
 const snapshot=structuredClone({source,ops}),draft=compileFederalDraft(source,ops);
 assert.equal(draft.outputs.consolidated,expected);
 assert.equal(draft.outputs.segments.filter(p=>p.kind!=='insert').map(p=>p.text).join(''),source.text);
 assert.equal(draft.outputs.segments.filter(p=>p.kind!=='delete').map(p=>p.text).join(''),expected);
 assert.equal(draft.outputHashes.consolidated,textSha256(expected));
 assert.deepEqual({source,ops},snapshot);assert.equal(draft.approval,'unapproved');
 return draft;
}
test('declared hierarchy disambiguates identical text and preserves CRLF, Unicode and all source gaps',()=>{
 const source=scopedSource();
 compile(source,[opFor(source,{scopeId:'a'})],source.text.replace('$100','$150'));
 assert.throws(()=>compileFederalDraft(source,[opFor(source,{scopeId:'s1'})]),{code:'DRAFT_TARGET_AMBIGUOUS'});
});
test('nested scopes require exact preorder ancestry; crossing, alias siblings and wrong paths refuse',()=>{
 for(const mutate of [s=>s.scopes[2].ancestorPath=['document'],s=>s.scopes[3].start--,s=>s.scopes.reverse(),s=>s.scopes[3]={...s.scopes[2],id:'alias'}]){
  const source=scopedSource();mutate(source);assert.throws(()=>federalDraftSource(source));
 }
 const source=scopedSource();source.scopes[2].start=source.text.indexOf('😀')+1;
 assert.throws(()=>federalDraftSource(source),{code:'DRAFT_SCOPE_INVALID'});
 const crossing=scopedSource();crossing.scopes[0].end=crossing.text.indexOf('Review')+3;
 crossing.scopes[0].sha256=textSha256(crossing.text.slice(0,crossing.scopes[0].end));
 assert.throws(()=>federalDraftSource(crossing),{code:'DRAFT_SCOPE_INVALID'});
});
test('independent sibling edits shift exact locations; ancestor needs both dependency branches',()=>{
 const source=scopedSource(),a=opFor(source,{id:'a1',scopeId:'a',text:'$1500'}),b=opFor(source,{id:'b1',scopeId:'b',text:'$250'});
 const intermediate=source.text.replace('$100','$1500').replace('$100','$250');
 const parent=opFor(source,{id:'parent',scopeId:'document',expectedText:'Review',text:'Report',expectedScopeSha256:textSha256(intermediate),dependsOn:['a1','b1']});
 const draft=compile(source,[a,b,parent],intermediate.replace('Review','Report'));
 assert.ok(draft.outputs.segments.filter(p=>p.kind==='unchanged').some(p=>p.text.includes('😀\r\n(b) Pay ')));
 assert.throws(()=>compileFederalDraft(source,[a,b,{...parent,dependsOn:['b1']}]),{code:'DRAFT_DEPENDENCY_REQUIRED',operationId:'parent'});
 assert.throws(()=>compileFederalDraft(source,[a,b,{...parent,expectedScopeSha256:source.sha256}]),{code:'DRAFT_ANCESTOR_CHANGED'});
});
test('transitive dependencies bind an overlapping parent edit followed by a child edit',()=>{
 const source=scopedSource(),a=opFor(source,{id:'a1',scopeId:'a'});
 const parent=opFor(source,{id:'p1',scopeId:'s1',expectedText:'$150',text:'$175',expectedScopeSha256:textSha256(slice(source,'s1').replace('$100','$150')),dependsOn:['a1']});
 const child=opFor(source,{id:'a2',scopeId:'a',expectedText:'$175',text:'$200',expectedScopeSha256:textSha256(slice(source,'a').replace('$100','$175')),dependsOn:['p1']});
 compile(source,[a,parent,child],source.text.replace('$100','$200'));
 assert.throws(()=>compileFederalDraft(source,[a,parent,{...child,dependsOn:['a1']}]),{code:'DRAFT_DEPENDENCY_REQUIRED'});
});
test('parent insert at a child boundary belongs outside child; child insertion expands its ancestors',()=>{
 const source=scopedSource(),insert=opFor(source,{id:'p1',scopeId:'s1',kind:'insert',position:'before',expectedText:'(a)',text:'New heading.\r\n'});
 compile(source,[insert,opFor(source,{id:'a1',scopeId:'a'})],source.text.replace('(a)','New heading.\r\n(a)').replace('$100','$150'));
 const first=opFor(source,{id:'a1',scopeId:'a',kind:'insert',position:'after',expectedText:'😀',text:' Added.'});
 const second=opFor(source,{id:'p1',scopeId:'s1',expectedText:'$100. Added.',text:'unused',dependsOn:['a1'],expectedScopeSha256:textSha256(slice(source,'s1').replace('😀','😀 Added.'))});
 assert.throws(()=>compileFederalDraft(source,[first,second]),{code:'DRAFT_TARGET_MISSING'});
 compile(source,[first],source.text.replace('😀','😀 Added.'));
});
test('ancestor deletion invalidates consumed descendants; cannot revive an old identity with matching payload',()=>{
 const source=scopedSource(),remove=opFor(source,{id:'p1',scopeId:'s1',kind:'delete',expectedText:slice(source,'a')});
 compile(source,[remove],source.text.replace(slice(source,'a'),''));
 assert.throws(()=>compileFederalDraft(source,[remove,opFor(source,{id:'a1',scopeId:'a',dependsOn:['p1']})]),{code:'DRAFT_SCOPE_INVALIDATED'});
 const replace={...remove,kind:'replace',text:'(a) Replaced $100.\r\n'};
 assert.throws(()=>compileFederalDraft(source,[replace,opFor(source,{id:'a1',scopeId:'a',dependsOn:['p1']})]),{code:'DRAFT_SCOPE_INVALIDATED'});
});

test('surviving children and indirect descendants cannot target through an invalidated declared ancestor',()=>{
 const source=scopedSource(),b=source.scopes.find(s=>s.id==='b'),start=source.text.indexOf('$100',b.start);
 source.scopes.splice(4,0,{id:'b-amount',label:'amount in section 1(b)',start,end:start+4,sha256:textSha256('$100'),ancestorPath:['document','s1','b']});
 const crossing=opFor(source,{id:'cross-parent',scopeId:'document',expectedText:'Act\r\nSEC. 1.',text:'New introduction.'});
 const independent=opFor(source,{id:'independent',scopeId:'s2',expectedText:'Review',text:'Report',dependsOn:['cross-parent']});
 for(const scopeId of ['s1','a','b','b-amount']){
  for(const dependsOn of [[],['cross-parent'],['independent']]){
   const ops=[crossing,...(dependsOn.includes('independent')?[independent]:[]),opFor(source,{id:'use-child',scopeId,text:'$200',dependsOn})];
   const before=structuredClone({source,ops});
   assert.throws(()=>compileFederalDraft(source,ops),{code:'DRAFT_SCOPE_INVALIDATED',operationId:'use-child'});
   assert.deepEqual({source,ops},before);
  }
 }
 // An unrelated subtree with a valid path remains usable after the same edit.
 compile(source,[crossing,independent],source.text.replace('Act\r\nSEC. 1.','New introduction.').replace('Review','Report'));
});

test('crossing the end of an ancestor also invalidates untouched earlier child paths',()=>{
 const source=scopedSource(),crossing=opFor(source,{id:'cross-end',scopeId:'document',expectedText:'(b) Pay $100.\r\nSEC. 2.',text:'New ending.'});
 const child=opFor(source,{id:'use-earlier-child',scopeId:'a',text:'$200',dependsOn:['cross-end']});
 const before=structuredClone({source,ops:[crossing,child]});
 assert.throws(()=>compileFederalDraft(source,[crossing,child]),{code:'DRAFT_SCOPE_INVALIDATED',operationId:'use-earlier-child'});
 assert.deepEqual({source,ops:[crossing,child]},before);
});
test('a cross-boundary edit invalidates both touched descendants and yields no partial package on later failure',()=>{
 const source=scopedSource(),op=opFor(source,{id:'p1',scopeId:'s1',expectedText:'😀\r\n(b)',text:'combined'});
 const before=structuredClone(source);
 compile(source,[op],source.text.replace('😀\r\n(b)','combined'));
 for(const scopeId of ['a','b'])assert.throws(()=>compileFederalDraft(source,[op,opFor(source,{id:'next',scopeId,dependsOn:['p1']})]),{code:'DRAFT_SCOPE_INVALIDATED'});
 assert.deepEqual(source,before);
});
test('XML/USLM/HTML cannot be mislabeled as the native flat editing baseline',()=>{
 for(const text of ['<?xml version="1.0"?><bill/>','\uFEFF  <bill xmlns="http://xml.house.gov/schemas/uslm/1.0"/>','<!--note--><bill/>','<!DOCTYPE bill SYSTEM "https://invalid.example/dtd"><bill/>','<html><body>bill</body></html>']){
  const selection={...official.request,textHash:textSha256(text)},result=structuredClone(official.response);
  result.source.text=text;result.source.textHash=selection.textHash;
  assert.throws(()=>projectNativeFederalSource(selection,result),{code:'DRAFT_SOURCE_FORMAT_UNSUPPORTED'});
 }
});
test('whole-source removal stays refused until an empty-result export contract exists',()=>{
 const source=scopedSource();
 assert.throws(()=>compileFederalDraft(source,[opFor(source,{scopeId:'document',kind:'delete',expectedText:source.text})]),{code:'DRAFT_EMPTY_RESULT'});
});

test('revising inserted text back to its original bytes removes that redline while preserving another edit',()=>{
 const source=scopedSource(),first=opFor(source,{id:'a1',scopeId:'a'});
 const restore=opFor(source,{id:'a2',scopeId:'a',expectedText:'$150',text:'$100',expectedScopeSha256:textSha256(slice(source,'a').replace('$100','$150')),dependsOn:['a1']});
 const other=opFor(source,{id:'b1',scopeId:'b',text:'$200'});
 const expected=source.text.replace('(b) Pay $100','(b) Pay $200');
 const draft=compile(source,[first,restore,other],expected);
 assert.deepEqual(draft.outputs.segments.filter(p=>p.kind!=='unchanged'),[{kind:'delete',text:'1'},{kind:'insert',text:'2'}]);
});
