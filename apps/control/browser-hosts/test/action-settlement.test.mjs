/** Approved-effect settlement over the REAL metadata reader contract and scripted Core ports. Proves the
 * wrapper appends once, settles only for a PREPARED approval, and never calls consume. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {browserPreparationFromRequest,BROWSER_APPROVAL_REQUEST_SCHEMA,browserPreparationProposalId}
 from '../../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';
import {createBrowserActionRecorder} from '../action-settlement.mjs';

const NOW=1700000000000;
const binding={tenantId:'tenant',actorId:'actor',conversationId:'22222222-2222-4222-8222-222222222222',
 runId:'33333333-3333-4333-8333-333333333333',attemptId:'44444444-4444-4444-8444-444444444444',
 workerId:'55555555-5555-4555-8555-555555555555',writerFence:7};
const scopes=[{tenantId:'tenant',kind:'client',resourceId:'66666666-6666-4666-8666-666666666666',policyRevision:'p1'}];
const toolUseId='toolu_01HZX';
const subject={schema:'meri-browser-action/1',binding,server:'capiov2-browser',tool:'click',toolUseId,
 inputSha256:hash({tool:'click'}),pageOrigin:'https://app.example',policySha256:'a'.repeat(64)};
const request={schema:BROWSER_APPROVAL_REQUEST_SCHEMA,subject,subjectSha256:hash(subject),input:{tool:'click'},
 requestedAtMs:NOW-1000,expiresAtMs:NOW+600000};
const preparation=browserPreparationFromRequest(request);
const proposalId=browserPreparationProposalId({binding,toolUseId});

function fixture({saved}={}){
 const calls={record:0,result:0,status:0,consumes:0};
 const event={eventId:browserActionReceiptEventId(),type:'browser.receipt',binding,data:{},createdAt:new Date(NOW).toISOString()};
 const metadata={async read(){return saved===undefined?null:saved;}};
 const recorder=createBrowserActionRecorder({metadata,
  record:async()=>{calls.record++;return {eventId:event.eventId,recorded:true,event};},
  result:async value=>{calls.result++;calls.resultValue=value;return {status:{permissive:false}};},
  status:async()=>{calls.status++;return {status:{permissive:false,proposalId,
   consumption:{state:'COMPLETED',result:{outcome:'COMPLETED',result:calls.resultValue.result}}}};},
  now:()=>NOW});
 const value={binding,scopes,sessionId:'77777777-7777-4777-8777-777777777777',toolUseId,action:'click',
  urlHost:'app.example',atMs:NOW,outcome:'ok',reference:null};
 return {recorder,value,calls,event};
}
function browserActionReceiptEventId(){
 return 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
}
const prepared={record:{binding,request:preparation}};

test('an observation without a PREPARED approval appends and never calls Core result',async()=>{
 const f=fixture();
 const out=await f.recorder.recordAction(f.value);
 assert.equal(out.recorded,true);
 assert.equal(out.settlement,null);
 assert.equal(f.calls.record,1);
 assert.equal(f.calls.result,0,'no fabricated approved-effect result');
});

test('a PREPARED approval settles the acknowledged event exactly once',async()=>{
 const f=fixture({saved:prepared});
 const out=await f.recorder.recordAction(f.value);
 assert.equal(f.calls.result,1);
 assert.equal(f.calls.record,1);
 assert.equal(out.settlement.outcome,'COMPLETED');
 assert.equal(out.settlement.result.eventId,f.event.eventId);
 const sent=f.calls.resultValue;
 assert.equal(sent.proposalId,proposalId);
 assert.equal(sent.subjectSha256,hash(subject));
 assert.equal(f.calls.consumes,0,'settlement never consumes');
});

test('a foreign prepared approval is refused and the event stays provenance',async()=>{
 const foreign={record:{binding:{...binding,runId:'88888888-8888-4888-8888-888888888888'},request:preparation}};
 const f=fixture({saved:foreign});
 await assert.rejects(f.recorder.recordAction(f.value),/BROWSER_ACTION_SETTLEMENT_REFUSED/u);
 assert.equal(f.calls.result,0);
});
