/** Approved-effect settlement through the REAL owners: the real preparation producer + metadata reader,
 * the real receipt producer over the real conversation store fixture, and the REAL Core approval forwarder
 * over an inert HTTP boundary. Only SQL rows and the Core HTTP answer are scripted. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createExecutionJournal} from '../../conversations/execution-journal.mjs';
import {DEFAULT_BROWSER_POLICY} from '../../../worker/conversation/browser/policy.mjs';
import {createBrowserPreparationProducer} from '../../commands/approval-metadata/browser-preparation-producer.mjs';
import {createPostgresApprovalMetadataReader,createPostgresApprovalMetadataStore}
 from '../../commands/approval-metadata/postgres-store.mjs';
import {createMetadataPoolFixture,createMetadataPolicyFixture,id,NOW} from '../../commands/approval-metadata/test/fixture.mjs';
import {createBrowserReceiptProducer} from '../browser-receipts.mjs';
import {createPostgresConversationStore} from '../../conversations/postgres-store.mjs';
import {storeFixture,binding,versions} from '../../conversations/test/store-fixture.mjs';
import {MODEL_CATALOG} from '../../../../packages/contracts/test/model-selection-fixture.mjs';
import {browserPreparationProposalId,BROWSER_APPROVAL_REQUEST_SCHEMA}
 from '../../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';
import {browserActionReceiptEventId} from '../../../../packages/contracts/runtime-0.2/browser-receipt.mjs';
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

function bigBrowserPolicy(){return {...DEFAULT_BROWSER_POLICY,enabled:true};}

async function setup({seed=true}={}){
 const sql=createMetadataPoolFixture();
 const policySha=hash(bigBrowserPolicy());
 const request={...originalRequest,subject:{...subject,policySha256:policySha}};
 request.subjectSha256=hash(request.subject);
 const store=createPostgresApprovalMetadataStore({pool:sql.pool});
 const policy=createMetadataPolicyFixture({binding,scopes,requiredApprover:{tenantId:binding.tenantId,actorId:binding.actorId},
  expiresAt:new Date(NOW+600000).toISOString()});
 const journal={async withCurrentRun(_key,cb){return cb({current:{scopes,policyRevision:'scopes[0]',deadlineMs:NOW+600000}});}};
 journal.withCurrentRun=async(_key,cb)=>cb({current:{scopes,policyRevision:'p1',deadlineMs:NOW+600000}});
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
 return createPostgresConversationStore({pool:f.pool,modelCatalog:MODEL_CATALOG});
}

/** The REAL forwarder with an inert Core boundary; the /result answer is scripted canonically. */
function forwarder(requests,{failResult=false}={}){
 return createCoreApprovalForwarder({origin:'https://core.example',now:()=>NOW,maxRequestMs:3000,
  nativeCredentials:{nativeCredentialFor:()=>({credential:'synthetic-bearer',expiresAtMs:NOW+600000})},
  getServiceSecret:async()=>'synthetic-service-secret',
  readProposal:async()=>{throw Error('generic path');},
  readBrowserPreparation:async()=>{throw Error('not used');},
  selectBrowserBinding:async()=>{throw Error('not used');},
  fetchImpl:async(url,init)=>{
   const body=JSON.parse(init.body);requests.push({url,body,headers:{...init.headers}});
   if(failResult&&url.endsWith('/result'))throw Error('SYNTHETIC_RESULT_ACK_LOST');
   if(url.endsWith('/result'))return Response.json({permissive:false,status:{schema:'meri-browser-approval-status/1',
    proposalId:body.proposalId,subjectSha256:body.subjectSha256,toolUseId,permissive:false,unknown:true,
    consumption:{state:'COMPLETED',result:body.result}}},{status:200,headers:{'content-type':'application/json'}});
   throw Error('unexpected route '+url);}});
}

function recorderFor(f,requests,opts){
 const producer=createBrowserReceiptProducer({store:conversationStore(),now:()=>NOW});
 const fw=forwarder(requests,opts);
 return {producer,recorder:createBrowserActionRecorder({metadata:f.reader,
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

test('a lost result acknowledgement is UNKNOWN and keeps the saved event provenance',async()=>{
 const f=await setup(),requests=[];
 const {recorder}=recorderFor(f,requests,{failResult:true});
 await assert.rejects(recorder.recordAction(action),error=>{
  assert.equal(error.code,'BROWSER_ACTION_SETTLEMENT_UNKNOWN');
  assert.equal(typeof error.eventId,'string');
  return true;});
});

test('a corrupt stored preparation is refused without a Core call',async()=>{
 const f=await setup();
 f.sql.rows.clear();
 const saved=[...f.sql.rows.values()][0];
 const {recorder}=recorderFor(f,[]);
 // Remove the row: an undefined read is UNKNOWN, never absence.
 const payload=f.sql.rows;
 const recorder2=createBrowserActionRecorder({metadata:{async read(){return undefined;}},
  record:async()=>({eventId:browserActionReceiptEventId({binding,sessionId,toolUseId}),recorded:true,
   event:{eventId:browserActionReceiptEventId({binding,sessionId,toolUseId}),type:'browser.receipt',binding,
    data:{...action,schema:'meri-browser-receipt/1',kind:'browser.action',toolUseId,reference:null},
    createdAt:new Date(NOW).toISOString()}}),
  result:async()=>{throw Error('must not call');},now:()=>NOW});
 await assert.rejects(recorder2.recordAction(action),/BROWSER_ACTION_SETTLEMENT_UNKNOWN/u);
});
