import test from 'node:test';
import assert from 'node:assert/strict';
import {applyDecodedXmlEdit,decodeXmlTextRun} from '../../../../packages/contracts/federal-workbench/xml-text-runs.mjs';

test('decoded entity replacement maps current raw span and returns canonical next mapping',()=>{
 const raw='A &amp; &#x1F600; B',op={id:'caller-owned',scopeId:'run:1',dependsOn:[],expectedScopeSha256:'caller-checked',textMode:'decoded',
  kind:'replace',expectedText:'& 😀',text:'<new> 😀\r'};
 const result=applyDecodedXmlEdit(raw,'text',op);
 assert.deepEqual(result,{text:'A &lt;new&gt; 😀&#13; B',start:2,end:17,replacement:'&lt;new&gt; 😀&#13;',textRun:decodeXmlTextRun('A &lt;new&gt; 😀&#13; B')});
 assert.equal(Object.isFrozen(result),true);assert.equal(result.textRun.decoded,'A <new> 😀\r B');
});

test('subsequent edit derives positions anew from changed raw representation',()=>{
 const first=applyDecodedXmlEdit('X &amp; Y','text',{kind:'replace',expectedText:'&',text:'😀 & <'});
 const second=applyDecodedXmlEdit(first.text,'text',{kind:'replace',expectedText:'😀 & <',text:'plain',textRun:{spans:'untrusted caller metadata'}});
 assert.equal(second.text,'X plain Y');assert.equal(second.textRun.decoded,'X plain Y');
 assert.equal(second.start,2);assert.equal(second.end,first.text.length-2);
});

test('insertion is zero-width at exact decoded anchor boundary and deletion omits text',()=>{
 const before=applyDecodedXmlEdit('A &#65; B','text',{kind:'insert',expectedText:'A B',text:'<',position:'before'});
 assert.equal(before.text,'A &lt;&#65; B');assert.equal(before.start,2);assert.equal(before.end,2);
 const after=applyDecodedXmlEdit('A &#65; B','text',{kind:'insert',expectedText:'A B',text:'&',position:'after'});
 assert.equal(after.text,'A &#65; B&amp;');assert.equal(after.start,9);assert.equal(after.end,9);
 const removed=applyDecodedXmlEdit('A &#x1F600; B','text',{kind:'delete',expectedText:'😀'});
 assert.equal(removed.text,'A  B');assert.equal(removed.replacement,'');assert.deepEqual(removed.textRun,decodeXmlTextRun('A  B'));
 const empty=applyDecodedXmlEdit('&amp;','text',{kind:'delete',expectedText:'&'});
 assert.equal(empty.text,'');assert.deepEqual(empty.textRun,{kind:'text',decoded:'',spans:[]});
});

test('unique decoded anchors include overlapping occurrences and cannot split supplementary scalars',()=>{
 assert.throws(()=>applyDecodedXmlEdit('aaa','text',{kind:'replace',expectedText:'aa',text:'b'}),{code:'DRAFT_TARGET_AMBIGUOUS'});
 assert.throws(()=>applyDecodedXmlEdit('&#65;A','text',{kind:'replace',expectedText:'A',text:'b'}),{code:'DRAFT_TARGET_AMBIGUOUS'});
 assert.throws(()=>applyDecodedXmlEdit('one','text',{kind:'delete',expectedText:'missing'}),{code:'DRAFT_TARGET_MISSING'});
 assert.throws(()=>applyDecodedXmlEdit('😀','text',{kind:'delete',expectedText:'\ud83d'}),{code:'DRAFT_OPERATION_INVALID'});
});

test('relevant operation fields are strict without rejecting caller-owned metadata',()=>{
 const operations=[null,[],{kind:'other',expectedText:'A'},
  {kind:'replace',expectedText:'',text:'B'},{kind:'replace',expectedText:'A',text:''},
  {kind:'replace',expectedText:'A',text:'A'},{kind:'replace',expectedText:'A',text:'B',position:'before'},
  {kind:'replace',expectedText:'A',text:'\ud800'},{kind:'replace',expectedText:'A',text:'\0'},
  {kind:'delete',expectedText:'A',text:undefined},{kind:'delete',expectedText:'A',position:'before'},
  {kind:'insert',expectedText:'A',text:'B'},{kind:'insert',expectedText:'A',text:'B',position:'middle'}];
 for(const op of operations)assert.throws(()=>applyDecodedXmlEdit('A','text',op),{code:'DRAFT_OPERATION_INVALID'});
 const accessor={kind:'delete',get expectedText(){throw Error('must not evaluate');}};
 assert.throws(()=>applyDecodedXmlEdit('A','text',accessor),{code:'DRAFT_OPERATION_INVALID'});
});

test('CDATA keeps literal inserted content and refuses terminator or normalization changes at joins',()=>{
 const result=applyDecodedXmlEdit('A & 😀','cdata',{kind:'replace',expectedText:'&',text:'<literal>'});
 assert.equal(result.text,'A <literal> 😀');assert.equal(result.textRun.kind,'cdata');
 assert.throws(()=>applyDecodedXmlEdit('A','cdata',{kind:'replace',expectedText:'A',text:']]>'}),{code:'DRAFT_XML_TEXT_MAPPING_INVALID'});
 assert.throws(()=>applyDecodedXmlEdit(']]A','cdata',{kind:'replace',expectedText:'A',text:'>'}),{code:'DRAFT_XML_TEXT_MAPPING_INVALID'});
 for(const kind of ['text','cdata']){
  assert.throws(()=>applyDecodedXmlEdit('A\rZ',kind,{kind:'insert',expectedText:'Z',text:'\n',position:'before'}),{code:'DRAFT_XML_TEXT_MAPPING_INVALID'});
  assert.throws(()=>applyDecodedXmlEdit('A\rX\nZ',kind,{kind:'delete',expectedText:'X'}),{code:'DRAFT_XML_TEXT_MAPPING_INVALID'});
 }
});
