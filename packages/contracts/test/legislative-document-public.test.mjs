/** Developer-only actual preparer/Core-client -> physical generated public receiver crossing. Synthetic Core HTTP. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {receiveIntentsResponse} from '../dist/intents-application.mjs';
import {createLegislativeDocumentCoreClient} from '../../../apps/runtime/native-authority/legislative-document-client.mjs';
import {createLegislativeDocumentPreparer} from '../../../apps/control/intents/legislative-document-preparer.mjs';
import {createIntentApprovalOwner} from '../../../apps/control/intents/approval.mjs';
import {canonicalSha256 as hash} from '../validate.mjs';
import {productFailure} from '../../../apps/control/product-access/errors.mjs';
const id=n=>String(n).padStart(8,'0')+'-0000-4000-8000-'+String(n).padStart(12,'0');
const binding={tenantId:'synthetic-tenant',actorId:'synthetic-actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const scopes=[{tenantId:binding.tenantId,kind:'private-user',resourceId:binding.actorId,policyRevision:'p1'}];
const now=()=>Date.parse('2026-10-27T10:00:00.000Z'),deliveryId='sdk:'+'1'.repeat(64);
const core=JSON.parse(readFileSync(new URL('./legislative-document-core-fixture.json',import.meta.url),'utf8'));
async function fixture(briefing){
 const source=core.cases[briefing?0:1],{operation,input}=source;
 let retained;
 const client=createLegislativeDocumentCoreClient({origin:'https://core.example.test',getCredentials:async()=>({credential:'t'.repeat(40),expiresAtMs:now()+300000}),getServiceSecret:async()=>'s'.repeat(40),reservedCredentials:()=>new Set(),now,maxRequestMs:5000,
  fetchImpl:async(_url,init)=>{const body=JSON.parse(init.body);assert.deepEqual(body.request,source.request);retained={version:'0.1.0',proposalId:id(7),status:'proposed',operation,request:source.request,context:{conversationId:binding.conversationId,selectedClientId:null,identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64)},createdAt:new Date(now()).toISOString(),expiresAt:new Date(now()+60000).toISOString(),receipt:null,effect:null};return Response.json(retained);}});
 const prepared=await createLegislativeDocumentPreparer({operation,binding,scopes,selectedClientId:null,client,currentRights:async()=>({scopes,expiresAtMs:now()+60000}),policyRevision:'p1',now,deadlineMs:now()+60000}).prepare({arguments:input,deliveryId});
 return {state:'prepared',kind:'legislative_document_action',operation:{id:operation,version:'0.2.0'},deliveryId,createdAt:prepared.proposal.createdAt,proposal:prepared.proposal,result:retained};
}
async function page(item){return receiveIntentsResponse('list',200,JSON.stringify({conversationId:binding.conversationId,intents:[item],next:null}),{request:{conversationId:binding.conversationId}});}
for(const briefing of [true,false])test(`actual ${briefing?'briefing without optional client/session':'cross-session research'} producer crosses the generated public receiver`,async()=>{
 const item=await fixture(briefing),received=await page(item);assert.deepEqual(received.intents[0],item);
 for(const effect of ['complete','selection_only']){
  const result={...item.result,status:'succeeded',effect,receipt:core.cases[briefing?0:1][effect==='complete'?'complete':'selectionOnly']};
  assert.deepEqual((await page({...item,result})).intents[0].result,result);
  const request={conversationId:binding.conversationId,deliveryId,proposalId:item.proposal.proposalId,commandSha256:item.proposal.commandSha256,decision:'approved'};
  const response={status:'legislative_document_decided',deliveryId,proposalId:request.proposalId,result};
  assert.deepEqual(await receiveIntentsResponse('decide',200,JSON.stringify(response),{request,proposal:item.proposal}),response);
 }
});
test('public receiver refuses operation/request/receipt substitution and never accepts a fake complete document',async()=>{
 const item=await fixture(false);
 const complete={...item,result:{...item.result,status:'succeeded',effect:'complete',receipt:{state:'complete',selectionId:'selection-1',documentId:'draft-1',location:'/workspace/draft/draft-1',reused:false,request:item.proposal.request}}};
 for(const alter of [v=>{v.result.operation='prepare_legiwatch_briefing';},v=>{v.result.receipt.location='/workspace/draft/other-draft-1';},v=>{v.result.effect='selection_only';},v=>{v.result.context.contextRevision='d'.repeat(64);},v=>{v.result.receipt.documentId=null;},v=>{v.proposal.request.extra=true;}]){
  const bad=structuredClone(complete);alter(bad);await assert.rejects(()=>page(bad));
 }
 const unknown={...item,result:{...item.result,status:'outcome_unknown',effect:'unknown'}};assert.equal((await page(unknown)).intents[0].result.receipt,null);
});
for(const field of ['proposalId','commandSha256','journalBinding'])test(`approval refuses substituted ${field} before the Core decision owner`,async()=>{
 const item=await fixture(false),{proposal}=item;let calls=0;
 const entry={state:'PREPARED',deliveryId,createdAt:item.createdAt,record:{operation:item.operation,argumentsSha256:hash(core.cases[1].input)},outcome:{result:{status:'approval_required',proposal},release:{binding,scopes}}};
 if(field==='journalBinding')entry.outcome.release={binding:{...binding,actorId:'another-actor'},scopes};
 const owner=createIntentApprovalOwner({enabled:true,now,limits:{maxRequestMs:5000},journal:{read:async()=>entry,list:async()=>({entries:[entry],next:null})},legislativeDocument:{read:async()=>item.result,decide:async()=>{calls++;return item.result;}}});
 const request={conversationId:binding.conversationId,deliveryId,proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,decision:'approved'};
 if(field!=='journalBinding')request[field]=field==='proposalId'?id(99):'f'.repeat(64);
 await assert.rejects(()=>owner.decide({principal:{tenantId:binding.tenantId,actorId:binding.actorId,clientIds:[]},request}),error=>productFailure(error)?.code===(field==='journalBinding'?'INTENT_JOURNAL_UNAVAILABLE':'INTENT_MISMATCH'));
 assert.equal(calls,0);
});
test('approval correlates omitted model scopes with canonical Core null scopes and releases only that result',async()=>{
 const item=await fixture(false),{proposal}=item;let calls=0;
 const entry={state:'PREPARED',deliveryId,createdAt:item.createdAt,record:{operation:item.operation,argumentsSha256:hash(core.cases[1].input)},outcome:{result:{status:'approval_required',proposal},release:{binding,scopes}}};
 const result={...item.result,status:'succeeded',effect:'selection_only',receipt:core.cases[1].selectionOnly};
 const owner=createIntentApprovalOwner({enabled:true,now,limits:{maxRequestMs:5000},journal:{read:async()=>entry,list:async()=>({entries:[entry],next:null})},legislativeDocument:{read:async()=>result,decide:async({proposal:actual})=>{assert.deepEqual(actual,proposal);calls++;return result;}}});
 const principal={tenantId:binding.tenantId,actorId:binding.actorId,clientIds:[]};
 const request={conversationId:binding.conversationId,deliveryId,proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,decision:'approved'};
 const decided=await owner.decide({principal,request});
 assert.deepEqual(await receiveIntentsResponse('decide',200,JSON.stringify(decided),{request,proposal}),decided);
 assert.equal(calls,1);
 const listed=await owner.list({principal,request:{conversationId:binding.conversationId}});
 assert.deepEqual((await receiveIntentsResponse('list',200,JSON.stringify(listed),{request:{conversationId:binding.conversationId}})).intents[0].result,result);
 assert.equal(calls,1);
});
