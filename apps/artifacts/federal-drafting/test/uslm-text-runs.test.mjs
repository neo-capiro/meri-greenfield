import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {deriveUslmStructure,deriveUslmScopes,assertUslmResult} from '../uslm-source.mjs';
import {decodeXmlTextRun,mapDecodedRange,encodeDecodedText} from '../../../../packages/contracts/federal-workbench/xml-text-runs.mjs';
import {XML} from './uslm-text-runs-fixture.mjs';
const sha=text=>createHash('sha256').update(text).digest('hex');
const profile='federal-uslm-xml/3',namespace='http://schemas.gpo.gov/xml/uslm';
const wrap=text=>`<bill xmlns="${namespace}">${text}</bill>`;
const nodes=root=>{const all=[],pending=[root];while(pending.length){const node=pending.pop();all.push(node);if(node.children)pending.push(...node.children.toReversed());}return all;};

test('existing parser1/2 outputs remain byteexact against pre-refactor base28da snapshots',async()=>{
 const official=await readFile(new URL('../uslm-schema/test/fixtures/BILLS-114hres99eh.xml',import.meta.url),'utf8');
 const expected={synthetic:['6677bfe09c839aff25c7ad1bd66d541f18de4f4dc196767f270ac9b6bba7f4b7','78e7954b9728a61cff58de9ca876ca41f857c83d4dbb8aaaf1b0f88c1d1e3d2f'],
  official:['921cf4e7ee735d4c6d9be8aeb8d2ebb735fb2783771dafdbb63b83dc2d31f5a7','ef8c71b2e0a7f9bd74dcf4830aca39791535bdab33ea121929d03fcb1e4a854d']};
 for(const [name,text] of [['synthetic',XML],['official',official]])for(let version=1;version<=2;version++)
  assert.equal(sha(JSON.stringify(deriveUslmScopes(text,`federal-uslm-xml/${version}`))),expected[name][version-1]);
});

test('one SAX structure retains lexical spans, namespaces, decoded attributes and separated text runs',()=>{
 const {root}=deriveUslmStructure(XML),all=nodes(root),runs=all.filter(node=>node.type==='text');
 assert.equal(root.local,'bill');assert.equal(root.uri,namespace);assert.equal(root.start,XML.indexOf('<bill'));
 assert.equal(root.end,XML.indexOf('</bill>')+'</bill>'.length);assert.equal(Object.isFrozen(root.children),true);
 assert.equal(all.find(node=>node.local==='b').uri,'http://www.w3.org/1999/xhtml');
 assert.deepEqual(all.find(node=>node.local==='ref').attributes,[{name:'href',uri:'',local:'href',value:'/other'}]);
 assert.deepEqual(runs.map(run=>run.decoded),['\n','A & B 😀\nC\nD','reference',' tail','<literal>&\n😀',' end',' foreign ','\t\r<>"\'A\n']);
 assert.equal(runs[1].start,XML.indexOf('A &amp;'));assert.equal(runs[1].end,XML.indexOf('<ref'));
 const cdata=runs.find(run=>run.kind==='cdata');assert.equal(cdata.start,XML.indexOf('<![CDATA[')+9);
 assert.equal(cdata.end,XML.indexOf(']]>'));assert.equal(XML.slice(cdata.start,cdata.end),'<literal>&\r\n😀');
 for(const run of runs){
  const raw=XML.slice(run.start,run.end);assert.equal(run.spans.map(span=>raw.slice(span.rawStart,span.rawEnd)).join(''),raw);
  assert.equal(run.spans.map(span=>decodeXmlTextRun(raw.slice(span.rawStart,span.rawEnd),run.kind).decoded).join(''),run.decoded);
  assert.deepEqual(decodeXmlTextRun(raw,run.kind,run.decoded),{kind:run.kind,decoded:run.decoded,spans:run.spans});
 }
});

test('parser3 emits declared element scopes and every nonempty whitespace/text run in lexical preorder',()=>{
 const {scopes}=deriveUslmScopes(XML,profile);
 assert.deepEqual(scopes.map(scope=>scope.id),['document','run:1','us:bill:1:s1','run:2','run:3','run:4','run:5','run:6','run:7','xml:second','run:8']);
 assert.deepEqual(scopes.find(scope=>scope.id==='run:3').ancestorPath,['document','us:bill:1:s1']);
 assert.deepEqual(scopes.at(-1).ancestorPath,['document','xml:second']);
 for(let index=0;index<scopes.length;index++){
  const scope=scopes[index];assert.equal(scope.sha256,sha(XML.slice(scope.start,scope.end)));
  if(index)assert.ok(scope.start>=scopes[index-1].start);
  if(scope.textRun)assert.equal(decodeXmlTextRun(XML.slice(scope.start,scope.end),scope.textRun.kind).decoded,scope.textRun.decoded);
 }
 const separate=deriveUslmScopes(wrap('before<ref>link</ref>after<!--cut-->last<?pi a?>end<![CDATA[]]>'),profile).scopes.filter(s=>s.textRun);
 assert.deepEqual(separate.map(scope=>scope.textRun.decoded),['before','link','after','last','end']);
 assert.equal(separate.some(scope=>scope.textRun.decoded.includes('beforelink')),false);
 assert.equal(separate.every(scope=>scope.end>scope.start),true);
});

test('decoded ranges map complete entities and normalized newlines without splitting supplementary scalars',()=>{
 const raw='A&amp;&#x1F600;\r\nZ';assert.equal(decodeXmlTextRun(raw).decoded,'A&😀\nZ');
 assert.deepEqual(mapDecodedRange(raw,'text',1,4),{start:1,end:15});
 assert.deepEqual(mapDecodedRange(raw,'text',2,4),{start:6,end:15});
 assert.deepEqual(mapDecodedRange(raw,'text',4,5),{start:15,end:17});
 assert.deepEqual(mapDecodedRange(raw,'text',6,6),{start:18,end:18});
 for(const range of [[2,3],[3,4],[-1,1],[4,3],[0,7],[0,1.5]])assert.throws(()=>mapDecodedRange(raw,'text',...range),{code:'DRAFT_XML_TEXT_MAPPING_INVALID'});
 assert.throws(()=>mapDecodedRange('😀','text',0,1));
 assert.throws(()=>decodeXmlTextRun('&amp;','text','different SAX result'));
});

test('every scalar-aligned decoded replacement reconstructs the desired text and keeps unrelated raw spans',()=>{
 for(const [raw,kind,replacement] of [['A&amp;&#x1F600;\r\nZ','text','<&😀\r'],['A😀\r\n<&Z','cdata','<new&😀\n']]){
  const decoded=decodeXmlTextRun(raw,kind).decoded,boundaries=[0];let at=0;for(const char of decoded){at+=char.length;boundaries.push(at);}
  for(const start of boundaries)for(const end of boundaries.filter(end=>end>=start)){
   const mapped=mapDecodedRange(raw,kind,start,end),encoded=encodeDecodedText(replacement,kind);
   const revised=raw.slice(0,mapped.start)+encoded+raw.slice(mapped.end);
   assert.equal(decodeXmlTextRun(revised,kind).decoded,decoded.slice(0,start)+replacement+decoded.slice(end));
  }
 }
 assert.equal(encodeDecodedText('&<>\r'),'&amp;&lt;&gt;&#13;');assert.equal(encodeDecodedText('<&>','cdata'),'<&>');
 for(const value of [']]>', 'carriage\r'])assert.throws(()=>encodeDecodedText(value,'cdata'));
 for(const value of ['\0','\ud800','\uffff'])assert.throws(()=>encodeDecodedText(value));
});

test('CDATA edits retain delimiters and normal-text escaping cannot introduce markup',()=>{
 const text=wrap('left<![CDATA[hello 😀]]>right'),run=deriveUslmScopes(text,profile).scopes.find(s=>s.textRun?.kind==='cdata');
 const raw=text.slice(run.start,run.end),mapped=mapDecodedRange(raw,'cdata',0,5);
 const revised=text.slice(0,run.start+mapped.start)+encodeDecodedText('<&>','cdata')+text.slice(run.start+mapped.end);
 assert.equal(revised,wrap('left<![CDATA[<&> 😀]]>right'));
 assert.deepEqual(nodes(deriveUslmStructure(revised).root).filter(n=>n.type==='text').map(n=>n.decoded),['left','<&> 😀','right']);
 assert.equal(nodes(deriveUslmStructure(wrap(encodeDecodedText('<ref>new</ref>'))).root).filter(n=>n.type==='element').length,1);
});

test('XML1.0 invalid entities/characters, ID collisions and structural XML1.1 refuse without changing old profiles',()=>{
 for(const raw of ['&unknown;','&#0;','&#xD800;','&#x110000;','&amp','&#X41;','<tag>','bad]]>','\udfff'])assert.throws(()=>decodeXmlTextRun(raw));
 assert.throws(()=>deriveUslmScopes(wrap('<section identifier="run:1">text</section>'),profile),{code:'DRAFT_USLM_IDENTIFIER_DUPLICATE'});
 const xml11='<?xml version="1.1"?>'+wrap('text');assert.doesNotThrow(()=>deriveUslmScopes(xml11,'federal-uslm-xml/2'));
 assert.throws(()=>deriveUslmStructure(xml11),{code:'DRAFT_XML_VERSION_UNSUPPORTED'});
 const large=wrap('<content>x</content>'.repeat(1024));
 assert.throws(()=>assertUslmResult(large,{uri:namespace,local:'bill'},1024,profile),{code:'DRAFT_OUTPUT_LIMIT'});
 const deep=wrap('<content>'.repeat(1500)+'text'+'</content>'.repeat(1500));
 assert.equal(deriveUslmScopes(deep,profile).scopes.length,2);
});
