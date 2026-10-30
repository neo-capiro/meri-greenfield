/** The settlement OWNER's own interface rules, over scripted ports: ok/error outcome, canonical event
 * identity, observation vs UNKNOWN, and result-answer correlation. The real-owner and forwarder proofs live in
 * action-settlement-forwarder.test.mjs and receipt-wire.test.mjs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {browserPreparationFromRequest,BROWSER_APPROVAL_REQUEST_SCHEMA,browserPreparationProposalId}
 from '../../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';
import {browserActionReceiptEventId} from '../../../../packages/contracts/runtime-0.2/browser-receipt.mjs';
import {createBrowserActionRecorder} from '../action-settlement.mjs';

const NOW=1700000000000;
const binding={tenantId:'tenant',actorId:'actor',conversationId:'22222222-2222-4222-8222-222222222222',
 runId:'33333333-3333-4333-8333-333333333333',attemptId:'44444444-4444-4444-8444-444444444444',
 workerId:'55555555-5555-4555-8555-555555555555',writerFence:7};
const scopes=[{tenantId:'tenant',kind:'client',resourceId:'66666666-6666-4666-8666-666666666666',policyRevision:'p1'}];
const toolUseId='toolu_01HZX',sessionId='77777777-7777-4777-8777-777777777777';
const input={tool:'click',arguments:{}};
const subject={schema:'meri-browser-action/1',binding,server:'capiov2-browser',tool:'click',toolUseId,
 inputSha256:hash(input),pageOrigin:'https://app.example',policySha256:'a'.repeat(64)};
const request={schema:BROWSER_APPROVAL_REQUEST_SCHEMA,subject,subjectSha256:hash(subject),input,
 requestedAtMs:NOW-1000,expiresAtMs:NOW+600000};
const preparation=browserPreparationFromRequest(request);
const proposalId=browserPreparationProposalId({binding,toolUseId});
const eventId=browserActionReceiptEventId({binding,sessionId,toolUseId});
const receiptFor=(overrides={})=>({schema:'meri-browser-receipt/1',kind:'browser.action',binding,sessionId,
 toolUseId,action:'click',urlHost:'app.example',atMs:NOW,reference:null,outcome:'ok',...overrides});
const value={binding,scopes,sessionId,toolUseId,action:'click',urlHost:'app.example',atMs:NOW,outcome:'ok',reference:null};

function fixture({saved,statusFor}={}){
 const calls={record:0,result:0,resultBody:null};
 const event=Object.freeze({contractVersion:'0.1.0',eventId,type:'browser.receipt',binding,
  sequence:4,createdAt:new Date(NOW).toISOString(),scopes,data:receiptFor()});
 const recorder=createBrowserActionRecorder({
  metadata:{async read(){return saved===undefined?null:saved;}},
  record:async()=>{calls.record++;return {eventId,recorded:true,event};},
  result:async body=>{calls.result++;calls.resultBody=body;
   return {permitted:false,status:{schema:'meri-browser-approval-status/1',proposalId,subjectSha256:hash(subject),
    toolUseId,permissive:false,unknown:true,consumption:{state:'COMPLETED',
     result:{outcome:body.outcome,result:body.result}}}};},
  now:()=>NOW});
 return {recorder,calls,event};
}
const prepared={record:{binding,proposalId,request:preparation},commandSha256:undefined};

test('an observation without a PREPARED approval appends and never calls Core result',async()=>{
 const f=fixture({saved:undefined});
 const out=await f.recorder.recordAction(value);
 assert.equal(out.recorded,true);
 assert.equal(out.settlement,null);
 assert.equal(f.calls.result,0);
});

// The PREPARED approved-effect path cannot be faked here: assertBrowserPreparationDigests needs a REAL
// canonical record, so that case is proven over the real owners in action-settlement-forwarder.test.mjs.
test('a foreign prepared approval is refused and the event stays provenance',async()=>{
 const foreign={record:{binding:{...binding,runId:'88888888-8888-4888-8888-888888888888'},
  proposalId,request:preparation}};
 const f=fixture({saved:foreign});
 await assert.rejects(f.recorder.recordAction(value),/BROWSER_ACTION_SETTLEMENT_REFUSED/u);
 assert.equal(f.calls.result,0);
});
