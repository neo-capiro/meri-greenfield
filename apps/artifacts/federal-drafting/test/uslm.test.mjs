import test from 'node:test';
import assert from 'node:assert/strict';
import {compileFederalDraft,federalDraftSource,textSha256} from '../engine.mjs';
import {deriveUslmScopes,assertUslmResult,FEDERAL_USLM_XML_PARSER} from '../uslm-source.mjs';
import {projectNativeFederalSource,prepareNativeFederalDraft} from '../native-source.mjs';
import {USLM_TEXT,uslmSource,opFor,slice,S1,A,B,S2,S3} from './uslm-fixture.mjs';
import official from '../../../../packages/contracts/test/fixtures/federal-draft-source.wire.json' with {type:'json'};

function compile(source,ops,expected){
 const snapshot=structuredClone({source,ops}),draft=compileFederalDraft(source,ops);
 assert.equal(draft.outputs.consolidated,expected);
 assert.equal(draft.outputs.segments.filter(p=>p.kind!=='insert').map(p=>p.text).join(''),source.text);
 assert.equal(draft.outputs.segments.filter(p=>p.kind!=='delete').map(p=>p.text).join(''),expected);
 assert.deepEqual({source,ops},snapshot);assert.equal(draft.parserVersion,FEDERAL_USLM_XML_PARSER);
 assert.doesNotThrow(()=>assertUslmResult(draft.outputs.consolidated,deriveUslmScopes(source.text).root));
 return draft;
}
function officialXml(text){
 const selection={...official.request,textHash:textSha256(text)},result=structuredClone(official.response);
 result.source.text=text;result.source.textHash=selection.textHash;return {selection,result};
}

test('USLM identity is the declared identifier tree over exact element spans, with BOM-safe UTF-16 offsets',()=>{
 for(const text of [USLM_TEXT,'﻿'+USLM_TEXT]){
  const {root,scopes}=deriveUslmScopes(text);
  assert.deepEqual(root,{uri:'http://xml.house.gov/schemas/uslm/1.0',local:'bill'});
  assert.deepEqual(scopes.map(s=>[s.id,s.label,s.ancestorPath]),[
   ['document','bill /us/bill/119/hr/1',[]],[S1,'section /us/bill/119/hr/1/s1',['document']],[A,'subsection /us/bill/119/hr/1/s1/a',['document',S1]],
   [B,'subsection /us/bill/119/hr/1/s1/b',['document',S1]],[S2,'section /us/bill/119/hr/1/s2',['document']],[S3,'section /us/bill/119/hr/1/s3',['document']]]);
  for(const scope of scopes){const raw=text.slice(scope.start,scope.end);assert.match(raw,/^<[a-z]+ [^]*(>|\/>)$/u);assert.equal(textSha256(raw),scope.sha256);}
  assert.equal(text.slice(scopes[5].start,scopes[5].end),'<section identifier="/us/bill/119/hr/1/s3"/>');
  assert.equal(text.slice(scopes[0].start,scopes[0].end),text.slice(text.indexOf('<bill'),text.lastIndexOf('>')+1));
 }
});

test('declared USLM scopes must equal the derived identity exactly; plain text and XML cannot swap parser identities',()=>{
 const source=uslmSource();assert.doesNotThrow(()=>federalDraftSource(source));
 for(const [code,mutate] of [['DRAFT_USLM_SCOPES_MISMATCH',s=>{s.scopes[2].label='renamed';}],['DRAFT_USLM_SCOPES_MISMATCH',s=>{s.scopes.splice(5,1);}],
  ['DRAFT_USLM_SCOPES_MISMATCH',s=>{s.scopes[1].id='section-1';s.scopes[2].ancestorPath[1]='section-1';s.scopes[3].ancestorPath[1]='section-1';}]]){
  const changed=structuredClone(source);mutate(changed);assert.throws(()=>federalDraftSource(changed),{code});
 }
 const plain=uslmSource();plain.text='SEC. 1. Plain.\n';plain.sha256=textSha256(plain.text);plain.scopes=[{id:'document',label:'all',start:0,end:plain.text.length,sha256:plain.sha256,ancestorPath:[]}];
 assert.throws(()=>federalDraftSource(plain),{code:'DRAFT_SOURCE_FORMAT_UNSUPPORTED'});
 const flat={...uslmSource(),parserVersion:'federal-plain-text/1',scopes:[{id:'document',label:'all',start:0,end:USLM_TEXT.length,sha256:textSha256(USLM_TEXT)}]};
 assert.throws(()=>federalDraftSource(flat),{code:'DRAFT_SOURCE_FORMAT_UNSUPPORTED'});
});

test('exact markup edits inside an identified subsection leave every other byte unchanged and stay well-formed',()=>{
 const source=uslmSource(),a=opFor(source,{scopeId:A,expectedText:'$100',text:'$150'});
 const draft=compile(source,[a],source.text.replace('Pay $100 😀','Pay $150 😀'));
 assert.match(draft.outputs.operative,/In subsection \/us\/bill\/119\/hr\/1\/s1\/a, strike "\$100" and insert "\$150"\./u);
 assert.deepEqual(draft.outputs.segments.filter(p=>p.kind!=='unchanged'),[{kind:'delete',text:'0'},{kind:'insert',text:'5'}]);
 assert.throws(()=>compileFederalDraft(source,[opFor(source,{scopeId:S1,expectedText:'$100',text:'$150'})]),{code:'DRAFT_TARGET_AMBIGUOUS'});
 const entity=opFor(source,{scopeId:A,expectedText:'&amp; report',text:'&amp; record'});
 compile(source,[entity],source.text.replace('&amp; report','&amp; record'));
});

test('markup that breaks the document refuses with DRAFT_XML_RESULT_MALFORMED and no output',()=>{
 const source=uslmSource(),before=structuredClone(source);
 for(const text of ['<','Pay & file','</content>']){
  assert.throws(()=>compileFederalDraft(source,[opFor(source,{scopeId:A,expectedText:'report',text})]),{code:'DRAFT_XML_RESULT_MALFORMED',operationId:null});
 }
 assert.throws(()=>compileFederalDraft(source,[opFor(source,{scopeId:'document',expectedText:'<bill xmlns="http://xml.house.gov/schemas/uslm/1.0"',text:'<act xmlns="http://xml.house.gov/schemas/uslm/1.0"'}),
  opFor(source,{id:'op-2',scopeId:'document',expectedText:'</bill>',text:'</act>',dependsOn:['op-1'],expectedScopeSha256:textSha256(slice(source,'document').replace('<bill xmlns="http://xml.house.gov/schemas/uslm/1.0"','<act xmlns="http://xml.house.gov/schemas/uslm/1.0"'))})]),{code:'DRAFT_XML_RESULT_MALFORMED'});
 assert.deepEqual(source,before);
});

test('whole-subsection repeal removes the element; the consumed identity cannot be reused while siblings remain usable',()=>{
 const source=uslmSource(),repeal=opFor(source,{id:'repeal',scopeId:S1,kind:'delete',expectedText:slice(source,B)});
 const expected=source.text.replace(slice(source,B),'');
 const draft=compile(source,[repeal],expected);
 assert.deepEqual(draft.outputs.segments.filter(p=>p.kind!=='unchanged'),[{kind:'delete',text:slice(source,B)}]);
 assert.throws(()=>compileFederalDraft(source,[repeal,opFor(source,{id:'after',scopeId:B,expectedText:'$100',text:'$1',dependsOn:['repeal']})]),{code:'DRAFT_SCOPE_INVALIDATED',operationId:'after'});
 compile(source,[repeal,opFor(source,{id:'sibling',scopeId:A,expectedText:'$100',text:'$1'})],expected.replace('Pay $100 😀','Pay $1 😀'));
 // The whole source of a USLM document is its root element; removing it is a proposed repeal, not an amendment.
 assert.throws(()=>compileFederalDraft(source,[opFor(source,{scopeId:'document',kind:'delete',expectedText:slice(source,'document')})]),{code:'DRAFT_WHOLE_SOURCE_REPEAL_UNSUPPORTED',operationId:null});
});

test('official USLM extractions import as structured sources only through the workbench; the frozen SDK tool stays flat',()=>{
 const {selection,result}=officialXml(USLM_TEXT);
 const projected=projectNativeFederalSource(selection,result,{structured:true});
 assert.equal(projected.parserVersion,FEDERAL_USLM_XML_PARSER);assert.equal(projected.coverage.complete,true);
 assert.deepEqual(projected.scopes.map(s=>s.id),['document',S1,A,B,S2,S3]);
 assert.throws(()=>projectNativeFederalSource(selection,result),{code:'DRAFT_SOURCE_FORMAT_UNSUPPORTED'});
 assert.throws(()=>prepareNativeFederalDraft(selection,result,[opFor(projected,{scopeId:A,expectedText:'$100',text:'$150'})]),{code:'DRAFT_SOURCE_FORMAT_UNSUPPORTED'});
 const plain=officialXml(official.response.source.text);
 assert.equal(projectNativeFederalSource(plain.selection,plain.result,{structured:true}).parserVersion,'federal-plain-text/1');
 for(const [text,code] of [['<html><body>bill</body></html>','DRAFT_USLM_NAMESPACE_UNSUPPORTED'],['<!DOCTYPE bill SYSTEM "https://invalid.example/dtd"><bill/>','DRAFT_XML_DOCTYPE_UNSUPPORTED'],
  ['<?xml version="1.0"?><bill xmlns="http://xml.house.gov/schemas/uslm/1.0">','DRAFT_XML_MALFORMED'],['<?xml version="1.0" encoding="ISO-8859-1"?><bill xmlns="http://xml.house.gov/schemas/uslm/1.0"/>','DRAFT_XML_ENCODING_UNSUPPORTED'],
  ['<bill xmlns="http://xml.house.gov/schemas/uslm/1.0"><section identifier="/s1"/><section identifier="/s1"/></bill>','DRAFT_USLM_IDENTIFIER_DUPLICATE'],
  ['<bill xmlns="http://xml.house.gov/schemas/uslm/1.0"><section identifier="/s 1"/></bill>','DRAFT_USLM_IDENTIFIER_INVALID']]){
  const x=officialXml(text);assert.throws(()=>projectNativeFederalSource(x.selection,x.result,{structured:true}),{code});
 }
});
