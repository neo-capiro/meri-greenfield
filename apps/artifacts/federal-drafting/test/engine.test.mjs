import test from 'node:test';
import assert from 'node:assert/strict';
import {compileFederalDraft,textSha256} from '../engine.mjs';
import {sourceFor,opFor} from './fixtures.mjs';

test('replacement is confined to its exact scope; literal duplicates elsewhere remain unchanged',()=>{
 const source=sourceFor(),before=structuredClone(source),draft=compileFederalDraft(source,[opFor(source)]);
 assert.equal(draft.outputs.consolidated,'Synthetic Federal Act\nSEC. 1. Payment is $150.\nSEC. 2. Payment is $100.\nEnd.\n');
 assert.deepEqual(source,before);assert.equal(draft.approval,'unapproved');
 assert.match(draft.outputs.operative,/section 1, strike "\$100" and insert "\$150"/);
 assert.equal(draft.outputs.segments.filter(s=>s.kind!=='insert').map(s=>s.text).join(''),source.text);
 assert.equal(draft.outputs.segments.filter(s=>s.kind!=='delete').map(s=>s.text).join(''),draft.outputs.consolidated);
 assert.equal(draft.outputHashes.consolidated,textSha256(draft.outputs.consolidated));
 assert.ok(draft.findings.filter(f=>['numbering','cross-references','arithmetic','substantive-law'].includes(f.category)).every(f=>f.status==='unresolved'));
 assert.equal(draft.source.coverage.complete,false);
});

test('ordered insert and delete check exact intermediate scope hashes and require explicit dependencies',()=>{
 const source=sourceFor(),first=opFor(source,{kind:'insert',position:'before',expectedText:'Payment',text:'Annual '}),intermediate='SEC. 1. Annual Payment is $100.\n';
 const second=opFor(source,{id:'op-2',kind:'delete',expectedText:'Annual ',expectedScopeSha256:textSha256(intermediate),dependsOn:['op-1']});
 // A net no-op is refused even when each intermediate operation was meaningful.
 assert.throws(()=>compileFederalDraft(source,[first,second]),{code:'DRAFT_NO_CHANGE'});
 const third=opFor(source,{id:'op-3',dependsOn:['op-2']});
 const draft=compileFederalDraft(source,[first,second,third]);assert.match(draft.outputs.consolidated,/Payment is \$150/);
 assert.throws(()=>compileFederalDraft(source,[first,{...second,dependsOn:[]}]),{code:'DRAFT_DEPENDENCY_REQUIRED'});
 assert.throws(()=>compileFederalDraft(source,[first,{...second,expectedScopeSha256:source.scopes[0].sha256}]),{code:'DRAFT_ANCESTOR_CHANGED'});
});

test('missing and duplicate anchors, stale source/scope, unknown parser, and overlapping scopes fail without mutation',()=>{
 for(const duplicate of [false,true]){
  const source=sourceFor([duplicate?'$100 and $100\n':'Amount unavailable\n']),before=structuredClone(source);
  assert.throws(()=>compileFederalDraft(source,[opFor(source)]),{code:duplicate?'DRAFT_TARGET_AMBIGUOUS':'DRAFT_TARGET_MISSING'});assert.deepEqual(source,before);
 }
 const source=sourceFor(),op=opFor(source);
 assert.throws(()=>compileFederalDraft({...source,text:source.text+' changed'},[op]),{code:'DRAFT_SOURCE_MISMATCH'});
 assert.throws(()=>compileFederalDraft({...source,parserVersion:'guessed-xml/1'},[op]),{code:'DRAFT_SOURCE_MISMATCH'});
 assert.throws(()=>compileFederalDraft({...source,scopes:[source.scopes[0],{...source.scopes[1],start:source.scopes[0].start}]},[op]),{code:'DRAFT_SCOPE_INVALID'});
 assert.throws(()=>compileFederalDraft({...source,publishedAt:'2026-02-30'},[op]),{code:'DRAFT_SOURCE_INVALID'});
});

test('a bad second operation leaves the original and the caller operation list unchanged',()=>{
 const source=sourceFor(),ops=[opFor(source),opFor(source,{id:'op-2',scopeId:'section-2',expectedText:'missing'})],original=structuredClone({source,ops});
 assert.throws(()=>compileFederalDraft(source,ops),{code:'DRAFT_TARGET_MISSING',operationId:'op-2'});
 assert.deepEqual({source,ops},original);
});

test('exact Unicode/CRLF source and literal redline marker characters survive comparison without normalization',()=>{
 const source=sourceFor(['SEC. 1. 😀 [-text-] {+source+}\r\n']),op=opFor(source,{expectedText:'😀',text:'😁'}),draft=compileFederalDraft(source,[op]);
 const parts=draft.outputs.redline.split('\n').slice(2).filter(Boolean).map(line=>JSON.parse(line));
 assert.equal(parts.filter(p=>p.kind!=='insert').map(p=>p.text).join(''),source.text);
 assert.equal(parts.filter(p=>p.kind!=='delete').map(p=>p.text).join(''),source.text.replace('😀','😁'));
 for(const part of parts)assert.equal(Buffer.from(part.text).toString('utf8'),part.text);
});

test('every edit creates a distinct unapproved revision and invalid/no-op instructions are refused',()=>{
 const source=sourceFor(),a=compileFederalDraft(source,[opFor(source)]),b=compileFederalDraft(source,[opFor(source,{text:'$175'})]);
 assert.notEqual(a.revisionSha256,b.revisionSha256);assert.equal(b.approval,'unapproved');assert.ok(Object.isFrozen(b.outputs));
 for(const over of [{text:'$100'},{dependsOn:['future']},{expectedTextSha256:'0'.repeat(64)},{kind:'delete',text:'not allowed'},{kind:'insert',position:'somewhere'}])
  assert.throws(()=>compileFederalDraft(source,[{...opFor(source),...over}]));
});
