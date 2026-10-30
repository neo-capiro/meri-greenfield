/** Approved-effect settlement through the REAL owners: real preparation producer + metadata reader + real
 * approval metadata READBACK (so the forwarder's browser proposal path really runs), the real receipt producer
 * over the real conversation store fixture, and the REAL Core approval forwarder over an inert HTTP boundary.
 * Only SQL rows and the Core HTTP answer are scripted. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {DEFAULT_BROWSER_POLICY} from '../../../worker/conversation/browser/policy.mjs';
import {createBrowserPreparationProducer} from '../../commands/approval-metadata/browser-preparation-producer.mjs';
import {createPostgresApprovalMetadataReader,createPostgresApprovalMetadataStore}
 from '../../commands/approval-metadata/postgres-store.mjs';
import {createApprovalMetadataReadback} from '../../commands/approval-metadata/readback.mjs';
import {createMetadataPoolFixture,createMetadataPolicyFixture,id,NOW} from '../../commands/approval-metadata/test/fixture.mjs';
import {createBrowserReceiptProducer} from '../browser-receipts.mjs';
import {createPostgresConversationStore} from '../../conversations/postgres-store.mjs';
import {storeFixture,binding,versions} from '../../conversations/test/store-fixture.mjs';
import {MODEL_CATALOG} from '../../../../packages/contracts/test/model-selection-fixture.mjs';
import {browserPreparationProposalId,BROWSER_APPROVAL_REQUEST_SCHEMA}
 from '../../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';
import {createCoreApprovalForwarder} from '../../../runtime/native-authority/approval-forwarder.mjs';
import {createBrowserActionRecorder} from '../action-settlement.mjs';

const scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:'66666666-6666-4666-8666-666666666666',policyRevision:'p1'}];
const toolUseId='toolu_01HZX';
const sessionId='77777777-7777-4777-8777-777777777777';
const input={tool:'click',arguments:{}};
const subject={schema:'meri-browser-action/1',binding,server:'capiov2-browser',tool:'click',toolUseId,
 inputSha256:hash(input),pageOrigin:'https://app.example',policySha256:'a'.repeat(64)};
const originalRequest={schema:BROWSER_APPROVAL_REQUEST_SCHEMA,subject,subjectSha256:hash(subject),input,
 requestedAtMs:NOW-1000,expiresAtMs:NOW+600000};
const proposalId=browserPreparationProposalId({binding,toolUseId});
const bigBrowserPolicy=()=>({...DEFAULT_BROWSER_POLICY,enabled:true});

async function setup({seed=true}={}){
 const sql=createMetadataPoolFixture();
 const policySha=hash(bigBrowserPolicy());
 const request={...originalRequest,subject:{...subject,policySha256:policySha}};
 request.subjectSha256=hash(request.subject);
 const store=createPostgresApprovalMetadataStore({pool:sql.pool});
 const journal=Object.assign({},{async withCurrentRun(_k,cb){return cb({current:{scopes,policyRevision:'p1',deadlineMs:NOW+600000}});}});
 const browserPolicy=async()=>bigBrowserPolicy();
 if(seed){
  const producer=createBrowserPreparationProducer({journal,store,approver:{tenantId:binding.tenantId,actorId:binding.actorId},
   actorRole:'standard_user',browserPolicy,now:()=>NOW,maxRequestMs:30000,newId:()=>proposalId});
  await producer.prepare({request,binding,deadlineMs:NOW+60000});
 }
 const reader=createPostgresApprovalMetadataReader({pool:sql.pool});
 return {sql,reader,request,policySha};
}

function conversationStore(){
 const f=storeFixture();
 const projection={binding,scopes,versions,state:'running',createdAt:new Date(NOW).toISOString(),policyRevision:'p1'};
 const req={requestId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',prompt:'go'};
 f.state.runs.set(`${binding.tenantId}:${binding.conversationId}:${binding.runId}`,{tenant_id:binding.tenantId,
  conversation_id:binding.conversationId,run_id:binding.runId,request_id:req.requestId,projection,
  projection_sha256:hash(projection),request:req,request_sha256:hash(req),last_sequence:3,hold_control_id:null,
  sequence_end:null});
 // Canonical run events 1..3 so the readback's completeness check is satisfied by real rows.
 f.state.events.set(`${binding.tenantId}:${binding.conversationId}:${binding.runId}`,
  ['queued','starting','running'].map((state,n)=>{const event={contractVersion:'0.1.0',eventId:id(21+n),binding,
   sequence:n+1,createdAt:new Date(NOW).toISOString(),scopes,type:'run.status',data:{state,reasonCode:null}};
   return {sequence:event.sequence,event_id:event.eventId,event,event_sha256:hash(event)};}));
 return createPostgresConversationStore({pool:f.pool,modelCatalog:MODEL_CATALOG});
}

/** The REAL forwarder: its browser proposal path uses the real readback, and Core's answer is inert HTTP. */
function forwarder(f,conversation,requests,{failResult=false}={}){
 const readback=createApprovalMetadataReadback({metadata:f.reader,store:conversation,
  retention:{async assertServable(){}},now:()=>NOW,maxRequestMs:3000});
 return createCoreApprovalForwarder({origin:'https://core.example',now:()=>NOW,maxRequestMs:3000,
  nativeCredentials:{nativeCredentialFor:()=>({credential:'synthetic-bearer',expiresAtMs:NOW+600000})},
  getServiceSecret:async()=>'synthetic-service-secret',
  readProposal:async()=>{throw Error('generic path');},
  readBrowserPreparation:async({proposalId,binding,signal})=>readback.read({schemaVersion:1,proposalId,binding,
   ...(signal?{signal}:{})}),
  selectBrowserBinding:async({proposal})=>({binding:proposal.run.binding,
   selectedClientId:proposal.run.scopes[0].resourceId}),
  fetchImpl:async(url,init)=>{
   const body=JSON.parse(init.body);requests.push({url,body,headers:{...init.headers}});
   if(failResult&&url.endsWith('/result'))throw Error('SYNTHETIC_RESULT_ACK_LOST');
   if(url.endsWith('/result'))return Response.json({schema:'meri-browser-approval-status/1',
    proposalId:body.proposalId,subjectSha256:body.subjectSha256,toolUseId,permissive:false,unknown:true,
    consumption:{state:'COMPLETED',result:{outcome:body.outcome,result:body.result}}},
    {status:200,headers:{'content-type':'application/json'}});
   throw Error('unexpected route '+url);}});
}

function recorderFor(f,requests,opts,shared=null){
 const conversation=shared??conversationStore();
 const producer=createBrowserReceiptProducer({store:conversation,now:()=>NOW});
 const fw=forwarder(f,conversation,requests,opts);
 return {producer,conversation,recorder:createBrowserActionRecorder({metadata:f.reader,
  record:value=>producer.appendAction(value),result:value=>fw.browserApprovals.result(value),now:()=>NOW})};
}
const action={binding,scopes,sessionId,toolUseId,action:'click',urlHost:'app.example',atMs:NOW,outcome:'ok',reference:null};

test('a PREPARED approval reports the acknowledged ok receipt to Core result',async()=>{
 const f=await setup(),requests=[];
 const {recorder}=recorderFor(f,requests);
 const out=await recorder.recordAction(action);
 assert.equal(out.recorded,true);
 assert.equal(requests.length,1);
 assert.ok(requests[0].url.endsWith('/api/clio/approvals/native/browser/result'));
 assert.equal(requests[0].body.outcome,'ok');
 assert.equal(requests[0].body.proposalId,proposalId);
 assert.deepEqual(requests[0].body.result,{eventId:out.eventId,event:out.event});
 assert.equal(out.settlement.result.eventId,out.eventId);
});

test('an observation with no preparation never calls Core result',async()=>{
 const f=await setup({seed:false}),requests=[];
 const {recorder}=recorderFor(f,requests);
 const out=await recorder.recordAction(action);
 assert.equal(out.settlement,null);
 assert.equal(requests.length,0,'no Core call for an ordinary observation');
});

test('a lost result acknowledgement is UNKNOWN, reached HTTP, and keeps provenance',async()=>{
 const f=await setup(),requests=[];
 const {recorder}=recorderFor(f,requests,{failResult:true});
 await assert.rejects(recorder.recordAction(action),error=>{
  assert.equal(requests.length,1,'the lost ACK case must reach the inert HTTP boundary');
  assert.equal(error.code,'BROWSER_ACTION_SETTLEMENT_UNKNOWN');
  assert.equal(typeof error.eventId,'string');
  return true;});
});

test('an unavailable Core result port settles as UNKNOWN with the saved event id',async()=>{
 const f=await setup(),requests=[];
 const producer=createBrowserReceiptProducer({store:conversationStore(),now:()=>NOW});
 const recorder=createBrowserActionRecorder({metadata:f.reader,record:value=>producer.appendAction(value),
  result:null,now:()=>NOW});
 await assert.rejects(recorder.recordAction(action),error=>{
  assert.equal(error.code,'BROWSER_ACTION_SETTLEMENT_UNKNOWN');
  assert.equal(typeof error.eventId,'string');
  return true;});
 assert.equal(requests.length,0);
});

test('a changed payload under the same identity conflicts before any Core call',async()=>{
 const f=await setup(),requests=[];
 const {recorder}=recorderFor(f,requests);
 await recorder.recordAction(action);
 const before=requests.length;
 await assert.rejects(recorder.recordAction({...action,outcome:'error'}));
 assert.equal(requests.length,before,'no second Core result request');
});

test('a genuine metadata read failure is UNKNOWN and keeps the event id',async()=>{
 const f=await setup();
 const producer=createBrowserReceiptProducer({store:conversationStore(),now:()=>NOW});
 const recorder=createBrowserActionRecorder({metadata:{async read(){throw Error('SQL_DOWN');}},
  record:value=>producer.appendAction(value),result:async()=>{throw Error('must not call');},now:()=>NOW});
 await assert.rejects(recorder.recordAction(action),error=>{
  assert.equal(error.code,'BROWSER_ACTION_SETTLEMENT_UNKNOWN');
  assert.equal(typeof error.eventId,'string');
  return true;});
});

test('an equal retry after a lost ACK recovers the same event through the idempotent result owner',async()=>{
 const f=await setup();
 const shared=conversationStore();
 const first=[];
 await assert.rejects(recorderFor(f,first,{failResult:true},shared).recorder.recordAction(action));
 const retryRequests=[];
 const retry=await recorderFor(f,retryRequests,{},shared).recorder.recordAction(action);
 assert.equal(retryRequests.length,1,'the retry re-enters Core result idempotently');
 assert.equal(retryRequests[0].body.result.eventId,retry.eventId);
 assert.equal(retry.settlement.result.eventId,retry.eventId);
 // No second action event: the same stored event/createdAt is reused.
 assert.equal(retry.event.createdAt,new Date(NOW).toISOString());
});
