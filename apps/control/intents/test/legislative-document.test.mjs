/** Focused synthetic check of the governed legislative-document composition.
 * No network, no live Core/Intel/DB/model: one stubbed Core transport exercises prepare -> approval -> read
 * and proves the receipt never upgrades a saved selection into a completed document, and that an unknown
 * effect is observed instead of retried. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {legislativeDocumentValidators as validators, resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createLegislativeDocumentCoreClient} from '../../../../apps/runtime/native-authority/legislative-document-client.mjs';
import {createLegislativeDocumentPreparer} from '../legislative-document-preparer.mjs';
import {createIntentApprovalOwner} from '../approval.mjs';
import {productFailure} from '../../product-access/errors.mjs';

const BRIEFING='prepare_legiwatch_briefing',RESEARCH='save_legislative_research';
const id=n=>String(n).padStart(8,'0')+'-0000-4000-8000-'+String(n).padStart(12,'0');
const hex=n=>String(n).padStart(64,'a').slice(-64);
const binding={tenantId:'tenant',actorId:'actor',conversationId:id(3),runId:id(2),attemptId:id(4),workerId:id(5),writerFence:1};
const scopes=[{tenantId:'tenant',kind:'client',resourceId:id(9),policyRevision:hex(1)}];
const selectedClientId=id(9);
const now=()=>Date.parse('2026-10-27T10:00:00.000Z');
const deadlineMs=now()+60000;
const token='t'.repeat(40);

function briefingInput(over={}){
  return {clientId:selectedClientId,folderId:id(8),jurisdiction:'FL',sessionKey:'2026-regular',template:'research_update',
    title:'Session briefing',analysis:'Cited analysis.',cutoff:'2026-10-26T00:00:00.000Z',timezone:'America/New_York',
    sources:[{kind:'news',id:'n1',revision:hex(3)}],
    citations:[{kind:'news',id:'n1',revision:hex(3),locator:'body',start:0,end:4,quote:'text'}],...over};
}
function researchInput(over={}){
  return {clientId:selectedClientId,jurisdiction:'FL',sessionKey:'2026-regular',title:'Research draft',analysis:'Cited analysis.',
    documents:[{id:'d1',revision:hex(4)}],
    citations:[{documentId:'d1',revision:hex(4),locator:'sec-1',start:0,end:4,quote:'text'}],...over};
}

/** One stubbed Core transport: returns the exact read result for the current phase. */
function coreClient({onPrepare,onRead,onDecide}){
  const calls=[];
  const fetchImpl=async(_url,init)=>{
    const body=JSON.parse(init.body);calls.push({body,method:init.method});
    const value=body.decision!==undefined?onDecide(body):body.proposalId!==undefined?onRead(body):onPrepare(body);
    return new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});
  };
  const client=createLegislativeDocumentCoreClient({origin:'https://core.example.test',getCredentials:async()=>({credential:token,expiresAtMs:now()+300000}),
    getServiceSecret:async()=>'s'.repeat(40),reservedCredentials:()=>new Set(),now,fetchImpl,maxRequestMs:5000});
  return {client,calls};
}
function coreResult({operation,request,status='proposed',receipt=null,effect=null}){
  return {version:'0.1.0',proposalId:id(7),status,operation,request,context:{conversationId:binding.conversationId,selectedClientId,
    identityRevision:hex(5),membershipRevision:hex(6),contextRevision:hex(7)},createdAt:new Date(now()).toISOString(),
    expiresAt:new Date(now()+60000).toISOString(),receipt,effect};
}
function preparerFor(operation,client){
  return createLegislativeDocumentPreparer({operation,binding,scopes,selectedClientId,client,now,
    currentRights:async()=>({scopes,expiresAtMs:now()+60000}),policyRevision:hex(1),deadlineMs});
}

test('the legislative approval owner preserves pre-send refusals and unknown sent decisions',async()=>{
 const input=briefingInput(),{client}=coreClient({onPrepare:body=>coreResult({operation:BRIEFING,request:body.request})});
 const prepared=await preparerFor(BRIEFING,client).prepare({arguments:input,deliveryId:id(11)}),p=prepared.proposal;
 const entry={state:'PREPARED',record:{operation:{id:BRIEFING,version:'0.2.0'},argumentsSha256:hash(validators.normalizeInput(BRIEFING,input))},outcome:{result:prepared,release:{binding,scopes}}};
 for(const effect of ['none','unknown']){
  const owner=createIntentApprovalOwner({journal:{read:async()=>entry,list:async()=>({entries:[],next:null})},legislativeDocument:{read:async()=>null,decide:async()=>{throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED',effect});}},now,limits:{maxRequestMs:5000},enabled:true});
  await assert.rejects(owner.decide({principal:{tenantId:binding.tenantId,actorId:binding.actorId,clientIds:[selectedClientId]},request:{conversationId:binding.conversationId,deliveryId:'sdk:'+'1'.repeat(64),proposalId:p.proposalId,commandSha256:p.commandSha256,decision:'approved'}}),e=>productFailure(e)?.code===(effect==='none'?'APPROVER_REFUSED':'APPROVAL_DECISION_UNKNOWN')&&productFailure(e)?.outcome===(effect==='none'?'NOT_DISPATCHED':'UNKNOWN'));
 }
});

test('both operations are registered as one governed owner in the canonical catalog',()=>{
  for(const [operation,input,group] of [[BRIEFING,briefingInput(),'LegislativeDocumentBriefingInput'],[RESEARCH,researchInput(),'LegislativeDocumentResearchInput']]){
    const contract=resolveOperationContract({id:operation,version:'0.2.0'});
    assert.equal(contract.binding.group,'legislative-document-action');
    assert.equal(contract.binding.input,group);
    assert.equal(contract.descriptor.sideEffect,'source-command');
    assert.equal(contract.descriptor.approvalBoundary,'immutable-proposal');
    assert.equal(contract.descriptor.handler,null);
    assert.equal(contract.descriptor.retry.maxRetries,0);
    assert.equal(contract.descriptor.retry.unknownOutcome,'reconcile-before-retry');
    const normalized=contract.normalizeInput(input);
    assert.deepEqual(normalized.input,validators.normalizeInput(operation,input));
  }
});

test('the declared 150-citation briefing bound is the canonical one, not the generic 100-element ceiling',()=>{
  const citations=Array.from({length:150},(_,i)=>({kind:'news',id:'n'+i,revision:hex(i),locator:'body',start:0,end:4,quote:'text'}));
  const input=briefingInput({citations});
  const normalized=validators.normalizeInput(BRIEFING,input);
  assert.equal(normalized.citations.length,150);
  assert.equal(validators.isAction(BRIEFING),true);
  assert.throws(()=>validators.normalizeInput(BRIEFING,briefingInput({citations:citations.concat([citations[0]])})),/INVALID_RESULT/u);
  // the owner's real cross-session contract is admitted and preserved verbatim, not refused
  const cross=validators.normalizeInput(RESEARCH,researchInput({allowCrossBill:true,rightSessionKey:'2026-special',
    documents:[{id:'d1',revision:hex(4),sessionKey:'2026-special'}]}));
  assert.equal(cross.allowCrossBill,true);
  assert.equal(cross.rightSessionKey,'2026-special');
  assert.equal(cross.documents[0].sessionKey,'2026-special');
  // and a client-omitted briefing (the declared "client-less folder" form) is admitted
  const clientless=briefingInput({clientId:undefined});delete clientless.clientId;
  assert.equal('clientId' in validators.normalizeInput(BRIEFING,clientless),false);
});

test('prepare -> approval -> read is explicit, immutable and bound to the current conversation',async()=>{
  const input=briefingInput();
  let prepared;
  const {client,calls}=coreClient({onPrepare:(body)=>{prepared=body.request;return coreResult({operation:BRIEFING,request:body.request});},
    onRead:(body)=>coreResult({operation:BRIEFING,request:prepared,status:'approved'}),
    onDecide:()=>coreResult({operation:BRIEFING,request:prepared,status:'approved'})});
  const p=await preparerFor(BRIEFING,client).prepare({arguments:input,deliveryId:id(11)});
  assert.equal(p.status,'approval_required');
  assert.equal(p.proposal.kind,'legislative_document_action');
  assert.equal(p.proposal.operation,BRIEFING);
  assert.equal(p.proposal.commandSha256,hash(Object.fromEntries(Object.entries(p.proposal).filter(([k])=>k!=='commandSha256'))));
  assert.equal(calls[0].body.tool,BRIEFING);
  assert.equal(calls[0].body.context.conversationId,binding.conversationId);
  // deterministic proposal-derived requestKey: the same delivery never creates a second draft
  const again=await preparerFor(BRIEFING,coreClient({onPrepare:(body)=>coreResult({operation:BRIEFING,request:body.request})}).client)
    .prepare({arguments:input,deliveryId:id(11)});
  assert.equal(again.proposal.request.requestKey,p.proposal.request.requestKey);
  // a different conversation scope is refused before any effect
  await assert.rejects(()=>preparerFor(BRIEFING,coreClient({onPrepare:(body)=>coreResult({operation:BRIEFING,request:body.request})}).client)
    .prepare({arguments:briefingInput({clientId:id(99)}),deliveryId:id(12)}),error=>error.code==='ACCESS_DENIED'&&error.effect==='none');
  // malformed arguments are refused before any owner call, as a definite (replayable) failure
  await assert.rejects(()=>preparerFor(BRIEFING,coreClient({onPrepare:()=>{throw Error('never called');}}).client).prepare({arguments:{},deliveryId:id(13)}),error=>error.code==='INVALID_ARGUMENTS'&&error.effect==='none');
  const decided=await client.decide({proposal:p.proposal,decision:'approved',deadlineMs});
  assert.equal(decided.status,'approved');
  const read=await client.read({proposal:p.proposal,deadlineMs});
  assert.equal(validators.coreResult(BRIEFING,read,p.proposal).effect,null);
});

test('a completed draft and a selection-only save stay distinct, and an unknown effect is only observed',async()=>{
  const input=researchInput();
  let prepared;
  const make=(status,extra)=>({onPrepare:(body)=>{prepared=body.request;return coreResult({operation:RESEARCH,request:body.request});},
    onRead:()=>{const r=coreResult({operation:RESEARCH,request:prepared,status,...extra});
      return extra&&extra.receipt?{...r,receipt:{...extra.receipt,request:prepared}}:r;}});
  // complete: the owner returned the exported document
  {
    const {client}=coreClient(make('succeeded',{receipt:{state:'complete',selectionId:'sel-1',documentId:'draft-1',location:'/workspace/draft/draft-1',reused:false,request:prepared},effect:'complete'}));
    const p=await preparerFor(RESEARCH,client).prepare({arguments:input,deliveryId:id(21)});
    const read=validators.coreResult(RESEARCH,await client.read({proposal:p.proposal,deadlineMs}),p.proposal);
    assert.equal(read.effect,'complete');
    assert.equal(read.receipt.documentId,'draft-1');
  }
  // selection only: canonical selection saved, no document, never relabelled
  {
    const {client}=coreClient(make('succeeded',{receipt:{state:'selection_only',selectionId:'sel-2',documentId:null,location:null,reused:false,request:prepared},effect:'selection_only'}));
    const p=await preparerFor(RESEARCH,client).prepare({arguments:input,deliveryId:id(22)});
    const read=validators.coreResult(RESEARCH,await client.read({proposal:p.proposal,deadlineMs}),p.proposal);
    assert.equal(read.effect,'selection_only');
    assert.equal(read.receipt.documentId,null);
    assert.equal(read.receipt.location,null);
  }
  // a `complete` claim without the exported document is refused, not accepted
  {
    const {client}=coreClient(make('succeeded',{receipt:{state:'complete',selectionId:'sel-3',documentId:null,location:null,reused:false,request:prepared},effect:'complete'}));
    const p=await preparerFor(RESEARCH,client).prepare({arguments:input,deliveryId:id(23)});
    await assert.rejects(async()=>validators.coreResult(RESEARCH,{...coreResult({operation:RESEARCH,request:prepared,status:'succeeded'}),
      receipt:{state:'complete',selectionId:'sel-3',documentId:null,location:null,reused:false,request:prepared},effect:'complete'},p.proposal),/INVALID_RESULT/u);
  }
  // unknown: reported as unknown and never retried by this layer
  {
    const {client,calls}=coreClient(make('outcome_unknown',{effect:'unknown'}));
    const p=await preparerFor(RESEARCH,client).prepare({arguments:input,deliveryId:id(24)});
    const read=validators.coreResult(RESEARCH,await client.read({proposal:p.proposal,deadlineMs}),p.proposal);
    assert.equal(read.status,'outcome_unknown');
    assert.equal(read.effect,'unknown');
    assert.equal(read.receipt,null);
    assert.equal(calls.filter(c=>c.body.decision!==undefined).length,0);
  }
});
