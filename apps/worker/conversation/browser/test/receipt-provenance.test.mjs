/** Site-workflow output provenance: receipts of a workflow run name the exact selection; the shared receipt contract
 * admits exactly that selection shape and nothing else; an ordinary run records no provenance field. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createReceiptHook} from '../receipts.mjs';
import {assertBrowserActionReceiptData,assertBrowserDownloadReceiptData} from '../../../../../packages/contracts/runtime-0.2/browser-receipt-semantics.mjs';
import {binding} from '../../../../control/conversations/test/store-fixture.mjs';
const selection={siteId:'records-portal',workflowId:'export-filings',version:3,manifestSha256:'c'.repeat(64)};
const paths={output:'/w/conversation/.browser/output'};
const post=(id='toolu_01')=>({hook_event_name:'PostToolUse',session_id:'00000000-0000-4000-8000-0000000000aa',tool_name:'mcp__meri_browser__browser_navigate',tool_use_id:id,
 tool_input:{url:'https://records.example/x'},tool_response:{content:[{type:'text',text:'### Result\nDone'}]}});
async function record(siteWorkflow){
 const receipts=[],hook=createReceiptHook({binding,paths,cwd:'/w/conversation',server:'meri_browser',tools:['browser_navigate'],receipts:{async record(r){receipts.push(r);}},now:()=>1_700_000_000_000,...(siteWorkflow===undefined?{}:{siteWorkflow})});
 assert.deepEqual(await hook(post(),'toolu_01',{signal:new AbortController().signal}),{});
 return receipts[0];
}

test('a workflow run records the exact selection on its action receipts and the contract admits it',async()=>{
 const receipt=await record(selection);
 assert.deepEqual(receipt.siteWorkflow,selection);
 assert.deepEqual(assertBrowserActionReceiptData(receipt).siteWorkflow,selection);
 selection.version=4;assert.equal(receipt.siteWorkflow.version,3,'the receipt holds its own copy of the selection');selection.version=3;
});

test('an ordinary run records no provenance field',async()=>{
 const receipt=await record(undefined);
 assert.equal(Object.hasOwn(receipt,'siteWorkflow'),false);
 assert.equal(Object.hasOwn(assertBrowserActionReceiptData(receipt),'siteWorkflow'),false);
});

test('the contract refuses a malformed or widened selection on action and download receipts',async()=>{
 const action=await record(selection);
 const download={schema:'meri-browser-receipt/1',kind:'browser.download',binding,urlHost:'records.example',atMs:1_700_000_000_000,reference:'v1',sha256:'a'.repeat(64),bytes:10,mimeType:'application/pdf',siteWorkflow:selection};
 assert.deepEqual(assertBrowserDownloadReceiptData(download).siteWorkflow,selection);
 for(const bad of [{...selection,version:0},{...selection,siteId:'Bad Site'},{...selection,manifestSha256:'z'.repeat(64)},{...selection,extra:true},{siteId:'a-b',workflowId:'c-d',version:1},null,'records-portal']){
  assert.throws(()=>assertBrowserActionReceiptData({...action,siteWorkflow:bad}),{code:'BROWSER_RECEIPT_REFUSED'});
  assert.throws(()=>assertBrowserDownloadReceiptData({...download,siteWorkflow:bad}),{code:'BROWSER_RECEIPT_REFUSED'});
 }
});
