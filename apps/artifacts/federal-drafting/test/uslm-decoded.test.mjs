/** Pure compiler tests; synthetic schema receipts here are not an actual XSD validation claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceFor} from './fixtures.mjs';
import {XML} from './uslm-text-runs-fixture.mjs';
import {deriveUslmScopes} from '../uslm-source.mjs';
import {federalDraftSource,compileFederalDraft,textSha256 as sha} from '../engine.mjs';
import {USLM_SCHEMA_PROFILE,USLM_SCHEMA_SHA256} from '../../../../packages/contracts/federal-workbench/schema-receipt.mjs';
import {applyDecodedXmlEdit} from '../../../../packages/contracts/federal-workbench/xml-text-runs.mjs';
const profile='federal-uslm-xml/3';
const sourceForXml=(text=XML)=>federalDraftSource({...sourceFor(),text,sha256:sha(text),parserVersion:profile,coverage:{complete:true,limitations:['Synthetic pure compiler fixture; no actual XSD claim.']},
 validation:{profile:USLM_SCHEMA_PROFILE,schemaSha256:USLM_SCHEMA_SHA256,sourceSha256:sha(text),bytes:Buffer.byteLength(text),valid:true},scopes:deriveUslmScopes(text,profile).scopes});
const operation=(source,scope,over={})=>({id:'a',kind:'replace',scopeId:scope.id,expectedScopeSha256:scope.sha256,
 expectedText:'A & B 😀',expectedTextSha256:sha('A & B 😀'),text:'Changed < & 😀',dependsOn:[],textMode:'decoded-xml',...over});

test('decoded entity replacement preserves every raw byte outside its mapped span',()=>{
 const source=sourceForXml(),scope=source.scopes.find(s=>s.textRun?.decoded.startsWith('A & B'));
 const result=compileFederalDraft(source,[operation(source,scope)]);
 assert.equal(result.outputs.consolidated,XML.replace('A &amp; B &#x1F600;','Changed &lt; &amp; 😀'));
 assert.equal(result.outputs.segments.filter(s=>s.kind!=='insert').map(s=>s.text).join(''),XML);
 assert.equal(result.outputs.segments.filter(s=>s.kind!=='delete').map(s=>s.text).join(''),result.outputs.consolidated);
 assert.equal(source.text,XML);
});

test('decoded chaining keeps raw intermediate hashes and dependency custody',()=>{
 const source=sourceForXml(),scope=source.scopes.find(s=>s.textRun?.decoded.startsWith('A & B'));
 const first=operation(source,scope),next=applyDecodedXmlEdit(source.text.slice(scope.start,scope.end),scope.textRun.kind,first);
 const second=operation(source,scope,{id:'b',kind:'insert',expectedText:'< &',expectedTextSha256:sha('< &'),text:' + ',position:'after',expectedScopeSha256:sha(next.text),dependsOn:['a']});
 const result=compileFederalDraft(source,[first,second]);
 assert.equal(result.outputs.consolidated,XML.replace('A &amp; B &#x1F600;','Changed &lt; &amp; +  😀'));
 assert.throws(()=>compileFederalDraft(source,[first,{...second,dependsOn:[]}]),{code:'DRAFT_DEPENDENCY_REQUIRED'});
 assert.throws(()=>compileFederalDraft(source,[first,{...second,expectedScopeSha256:scope.sha256}]),{code:'DRAFT_ANCESTOR_CHANGED'});
 const removal={id:'remove',kind:'remove_source_text',expectedSourceSha256:source.sha256,expectedTextSha256:sha(result.outputs.consolidated),dependsOn:['b']};
 assert.equal(compileFederalDraft(source,[first,second,removal]).outputs.consolidated,'');
});

test('a decoded anchor cannot cross an intervening reference or operate on an element scope',()=>{
 const source=sourceForXml(),scope=source.scopes.find(s=>s.textRun?.decoded.startsWith('A & B'));
 const target=scope.textRun.decoded+'reference';
 assert.throws(()=>compileFederalDraft(source,[operation(source,scope,{expectedText:target,expectedTextSha256:sha(target)})]),{code:'DRAFT_TARGET_MISSING'});
 const element=source.scopes.find(s=>s.id==='us:bill:1:s1');
 assert.throws(()=>compileFederalDraft(source,[operation(source,element)]),{code:'DRAFT_TEXT_RUN_REQUIRED'});
});

test('CDATA decoded edits preserve delimiters and reject unrepresentable content atomically',()=>{
 const source=sourceForXml(),scope=source.scopes.find(s=>s.textRun?.kind==='cdata');
 const op=operation(source,scope,{expectedText:'<literal>',expectedTextSha256:sha('<literal>'),text:'<changed>'});
 const result=compileFederalDraft(source,[op]);assert.equal(result.outputs.consolidated,XML.replace('<literal>','<changed>'));
 assert.throws(()=>compileFederalDraft(source,[{...op,text:']]>'}]));assert.equal(source.text,XML);
});

test('raw-run operations remain raw; adding markup does not silently create a decoded target',()=>{
 const source=sourceForXml(),scope=source.scopes.find(s=>s.textRun?.decoded.startsWith('A & B'));
 const {textMode,...raw}=operation(source,scope,{expectedText:'A &amp; B',expectedTextSha256:sha('A &amp; B'),text:'<i>new</i>'});
 const first=compileFederalDraft(source,[raw]);assert.equal(first.outputs.consolidated,XML.replace('A &amp; B','<i>new</i>'));
 const current=source.text.slice(scope.start,scope.end).replace('A &amp; B','<i>new</i>');
 const decoded=operation(source,scope,{id:'b',expectedScopeSha256:sha(current),expectedText:'new',expectedTextSha256:sha('new'),dependsOn:['a']});
 assert.throws(()=>compileFederalDraft(source,[raw,decoded]),{code:'DRAFT_XML_TEXT_MAPPING_INVALID'});
});
