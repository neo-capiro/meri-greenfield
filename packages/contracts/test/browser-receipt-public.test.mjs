/** Public browser receipt receiving boundary.
 *
 * Proves the ACTUAL generated public union admits the browser receipt event, and that the browser-safe
 * semantics reject a foreign binding/scope or a malformed receipt. No Node crypto is imported by the
 * semantics module itself; this test runs in Node and uses the real validators.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv/dist/2020.js';
import formats from 'ajv-formats';
import original from '../meri.schema.json' with {type:'json'};
import billText from '../native-bill-text-source.schema.json' with {type:'json'};
import hearing from '../native-hearing-source.schema.json' with {type:'json'};
import uploadSource from '../native-upload-source.schema.json' with {type:'json'};
import userQuestion from '../native-user-question-event.schema.json' with {type:'json'};
import hearingMedia from '../native-hearing-media.schema.json' with {type:'json'};
import hearingResult from '../retrieval-0.2/public-domain-hearings.schema.json' with {type:'json'};
const hearingsMaybe=hearingResult;
import hearingRecords from '../retrieval-0.2/public-domain-hearing-records.schema.json' with {type:'json'};
import outreach from '../retrieval-0.2/outreach-query.schema.json' with {type:'json'};
import {conversationSchema} from '../conversation-application/schema.mjs';
import {historySchema} from '../conversation-history/schema.mjs';
import {assertBrowserReceiptEventSemantics,BROWSER_RECEIPT_EVENT}
 from '../runtime-0.2/browser-receipt-semantics.mjs';
import {browserActionReceiptEventId,assertBrowserReceipt} from '../runtime-0.2/browser-receipt.mjs';

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),
 workerId:id(4),writerFence:1};
const scopes=[{tenantId:'tenant',kind:'client',resourceId:id(5),policyRevision:'p1'}];
const receipt={schema:'meri-browser-receipt/1',kind:'browser.action',binding,sessionId:id(6),
 toolUseId:'toolu_01HZX',action:'browser_click',urlHost:'app.capiro.example',atMs:1700000000000,
 reference:null,outcome:'ok'};
const event=()=>({contractVersion:'0.1.0',
 eventId:browserActionReceiptEventId({binding,sessionId:receipt.sessionId,toolUseId:receipt.toolUseId}),
 binding,sequence:3,createdAt:new Date(1700000000000).toISOString(),scopes,type:BROWSER_RECEIPT_EVENT,
 data:receipt});

function ajv(){const instance=new Ajv({strict:true,allErrors:false});formats(instance);
 instance.addSchema(original);
 for(const schema of [billText,hearing,hearingMedia,hearingsMaybe,hearingRecords,outreach,uploadSource,userQuestion])if(schema)instance.addSchema(schema);
 instance.addSchema(conversationSchema());return instance;}
const validate=(schemaName,value)=>ajv().compile({
 $ref:'urn:meri:conversation-application:0.4.0#/$defs/'+schemaName});
function historyAjv(){const instance=new Ajv({strict:true,allErrors:false});formats(instance);
 instance.addSchema(original);
 for(const schema of [billText,hearing,hearingMedia,hearingResult,hearingRecords,outreach,uploadSource,
  userQuestion])instance.addSchema(schema);
 const history=historySchema();instance.addSchema(history);return instance;}
const historyEventId=id=>historySchema().$id+'#/$defs/ConversationHistoryEvent';

test('the public conversation union admits a validated browser receipt event',()=>{
 const value=event();
 assert.equal(validate('ConversationEvent')(value),true,'ConversationEvent must admit browser.receipt');
 const history={sequence:3,event:value};
 assert.equal(historyAjv().compile({$ref:historyEventId()})(history),true,
  'ConversationHistoryEvent must admit browser.receipt');
});

test('a receipt is admitted only while its exact binding and scopes are the admitted run',()=>{
 const accepted=assertBrowserReceiptEventSemantics(event(),{binding,scopes});
 assert.equal(accepted.type,'browser.receipt');
 assert.equal(accepted.data.kind,'browser.action');
 assert.equal(accepted.data.outcome,'ok');
 const foreign=event();
 foreign.binding={...binding,runId:id(9)};
 foreign.data={...receipt,binding:foreign.binding};
 assert.throws(()=>assertBrowserReceiptEventSemantics(foreign,{binding,scopes}),
  /BROWSER_RECEIPT_BINDING_MISMATCH/u);
 const foreignScope=event();
 foreignScope.scopes=[{...scopes[0],policyRevision:'p2'}];
 assert.throws(()=>assertBrowserReceiptEventSemantics(foreignScope,{binding,scopes}),
  /BROWSER_RECEIPT_SCOPE_MISMATCH/u);
 const otherTenant=event();
 otherTenant.binding={...binding,tenantId:'other'};
 otherTenant.data={...receipt,binding:otherTenant.binding};
 otherTenant.scopes=[{...scopes[0],tenantId:'other'}];
 assert.throws(()=>assertBrowserReceiptEventSemantics(otherTenant,{binding,scopes}),
  /BROWSER_RECEIPT_SCOPE_MISMATCH|BROWSER_RECEIPT_BINDING_MISMATCH/u);
});

test('the receipt field rules stay closed and are shared with the Node owner',()=>{
 const accepted=assertBrowserReceipt(receipt);
 assert.equal(accepted.kind,'browser.action');
 assert.throws(()=>assertBrowserReceipt({...receipt,outcome:'completed'}),/BROWSER_RECEIPT_REFUSED/u);
 assert.throws(()=>assertBrowserReceipt({...receipt,extra:'x'}),/BROWSER_RECEIPT_REFUSED/u);
 assert.throws(()=>assertBrowserReceipt({...receipt,schema:'meri-browser-receipt/2'}),/BROWSER_RECEIPT_REFUSED/u);
 const download={schema:'meri-browser-receipt/1',kind:'browser.download',binding,urlHost:'files.example',
  atMs:1700000000000,reference:'downloads/r-1',sha256:'a'.repeat(64),bytes:12,mimeType:'application/pdf'};
 assert.equal(assertBrowserReceipt(download).kind,'browser.download');
 assert.throws(()=>assertBrowserReceipt({...download,bytes:null}),/BROWSER_RECEIPT_REFUSED/u);
});
