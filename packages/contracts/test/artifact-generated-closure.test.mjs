/** Consumer behavior of the generated boundary, without claiming runtime authority or XML parsing. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {receiveDocumentRequest,receiveDocumentResponse} from '@capiro/meri-contracts/document-application';
const bytes=value=>new TextEncoder().encode(JSON.stringify(value));
const xml={deliveryId:'xml-public',request:{operation:'create_word',format:'xml',title:'Draft',content:{text:'<bill>text</bill>'}}};
test('generated document boundary admits the XML request shape and refuses empty text',()=>{
 assert.deepEqual(receiveDocumentRequest('create',bytes(xml)),xml);
 assert.throws(()=>receiveDocumentRequest('create',bytes({...xml,request:{...xml.request,content:{text:''}}})));
});
test('generated Word schema carries bounded quotation depth and explicit formatting marks',()=>{
 const word={deliveryId:'word-public',request:{operation:'create_word',format:'docx',title:'Draft',content:{blocks:[{kind:'paragraph',quoteDepth:8,runs:[{text:'Provision',strike:true,underline:true}]}]}}};
 assert.deepEqual(receiveDocumentRequest('create',bytes(word)),word);
 word.request.content.blocks[0].quoteDepth=9;
 assert.throws(()=>receiveDocumentRequest('create',bytes(word)));
});
test('generated receiver preserves both parent-conflict 409 NOT_DISPATCHED contracts',async()=>{
 const request=receiveDocumentRequest('create',bytes(xml));
 for(const code of ['ARTIFACT_STALE_PARENT','CONFLICT']){
  const response={error:{code,outcome:'NOT_DISPATCHED'}};
  assert.deepEqual(await receiveDocumentResponse('create',409,bytes(response),request),response);
  await assert.rejects(receiveDocumentResponse('create',200,bytes(response),request));
 }
});
