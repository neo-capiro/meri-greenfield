/** The legal comparison is a deterministic function of exact source and operations: the same typed segments, in the
 * same order, with the same bytes and hashes, on every run and regardless of request key order. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {compileFederalDraft,textSha256} from '../engine.mjs';
import {sourceFor,opFor} from './fixtures.mjs';
import {scopedSource,slice} from './scoped-fixture.mjs';
import {uslmSource,opFor as uslmOp,slice as uslmSlice,S1,A,B} from './uslm-fixture.mjs';

const reorder=value=>Array.isArray(value)?value.map(reorder):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().reverse().map(k=>[k,reorder(value[k])])):value;
function deterministic(source,ops){
 const first=compileFederalDraft(source,ops),second=compileFederalDraft(structuredClone(source),structuredClone(ops)),shuffled=compileFederalDraft(reorder(source),reorder(ops));
 assert.deepEqual(second,first);assert.deepEqual(shuffled.outputs,first.outputs);assert.equal(shuffled.revisionSha256,first.revisionSha256);
 assert.equal(first.outputs.redline.split('\n').slice(2).filter(Boolean).map(line=>JSON.stringify(JSON.parse(line))).join('\n'),first.outputs.segments.map(s=>JSON.stringify(s)).join('\n'));
 assert.equal(first.outputHashes.redline,textSha256(first.outputs.redline));
 return first;
}

test('nested sections: sibling edits under one ancestor keep every unchanged gap, including CRLF and Unicode, as unchanged spans',()=>{
 const source=scopedSource(),draft=deterministic(source,[opFor(source,{id:'a1',scopeId:'a',text:'$150'}),opFor(source,{id:'b1',scopeId:'b',kind:'delete',expectedText:'Pay '})]);
 assert.deepEqual(draft.outputs.segments,[
  {kind:'unchanged',text:'Act\r\nSEC. 1.\r\n(a) Pay $1'},{kind:'delete',text:'0'},{kind:'insert',text:'5'},{kind:'unchanged',text:'0. 😀\r\n(b) '},
  {kind:'delete',text:'Pay '},{kind:'unchanged',text:'$100.\r\nSEC. 2. Review.\r\n'}]);
 assert.equal(draft.outputs.consolidated,'Act\r\nSEC. 1.\r\n(a) Pay $150. 😀\r\n(b) $100.\r\nSEC. 2. Review.\r\n');
});

test('overlapping ranges: an ancestor edit across a child boundary and a later dependent child edit compare against the original once',()=>{
 const source=scopedSource(),cross=opFor(source,{id:'cross',scopeId:'s1',expectedText:'😀\r\n(b) Pay',text:'😀 and (b) pay'});
 const later=opFor(source,{id:'later',scopeId:'s2',expectedText:'Review',text:'Report',dependsOn:['cross']});
 const draft=deterministic(source,[cross,later]);
 assert.deepEqual(draft.outputs.segments,[
  {kind:'unchanged',text:'Act\r\nSEC. 1.\r\n(a) Pay $100. 😀'},{kind:'delete',text:'\r\n(b) P'},{kind:'insert',text:' and (b) p'},
  {kind:'unchanged',text:'ay $100.\r\nSEC. 2. Re'},{kind:'delete',text:'view'},{kind:'insert',text:'port'},{kind:'unchanged',text:'.\r\n'}]);
 const parentThenChild=[opFor(source,{id:'a1',scopeId:'a'}),
  opFor(source,{id:'p1',scopeId:'s1',expectedText:'$150',text:'$175',expectedScopeSha256:textSha256(slice(source,'s1').replace('$100','$150')),dependsOn:['a1']}),
  opFor(source,{id:'a2',scopeId:'a',expectedText:'$175',text:'$200',expectedScopeSha256:textSha256(slice(source,'a').replace('$100','$175')),dependsOn:['p1']})];
 assert.deepEqual(deterministic(source,parentThenChild).outputs.segments.filter(s=>s.kind!=='unchanged'),[{kind:'delete',text:'1'},{kind:'insert',text:'2'}]);
});

test('whole-section repeal: a flat section and a nested USLM subsection each leave exactly one delete span',()=>{
 const flat=sourceFor(),repeal=opFor(flat,{scopeId:'section-2',kind:'delete',expectedText:'SEC. 2. Payment is $100.\n'});
 const draft=deterministic(flat,[repeal]);
 assert.deepEqual(draft.outputs.segments,[{kind:'unchanged',text:'Synthetic Federal Act\nSEC. 1. Payment is $100.\n'},{kind:'delete',text:'SEC. 2. Payment is $100.\n'},{kind:'unchanged',text:'End.\n'}]);
 assert.equal(draft.outputs.consolidated,'Synthetic Federal Act\nSEC. 1. Payment is $100.\nEnd.\n');
 assert.match(draft.outputs.operative,/In section 2, strike "SEC\. 2\. Payment is \$100\.\\n"\./u);
 const uslm=uslmSource(),removal=uslmOp(uslm,{id:'r',scopeId:S1,kind:'delete',expectedText:uslmSlice(uslm,B)}),edit=uslmOp(uslm,{id:'e',scopeId:A,expectedText:'$100',text:'$1'});
 const nested=deterministic(uslm,[removal,edit]);
 assert.deepEqual(nested.outputs.segments.filter(s=>s.kind!=='unchanged'),[{kind:'delete',text:'00'},{kind:'delete',text:uslmSlice(uslm,B)}]);
 assert.equal(nested.outputs.segments.filter(s=>s.kind==='unchanged').map(s=>s.text).join(''),uslm.text.replace('00 😀',' 😀').replace(uslmSlice(uslm,B),''));
});

test('the same amendment on a different source snapshot is a different revision with a different redline citation',()=>{
 const a=sourceFor(),b={...sourceFor(),sourceVersion:'introduced-2',sourceUrl:'https://legislation.example/act/introduced-2'};
 const first=compileFederalDraft(a,[opFor(a)]),second=compileFederalDraft(b,[opFor(b)]);
 assert.deepEqual(second.outputs.segments,first.outputs.segments);assert.equal(second.outputs.consolidated,first.outputs.consolidated);
 assert.notEqual(second.outputs.redline,first.outputs.redline);assert.notEqual(second.revisionSha256,first.revisionSha256);
 assert.match(first.outputs.redline,new RegExp('^Source: Synthetic Act; Synthetic federal publisher; version introduced-1; published 2026-10-28; https://legislation.example/act/introduced-1; SHA-256 '+a.sha256+'\\n','u'));
});
