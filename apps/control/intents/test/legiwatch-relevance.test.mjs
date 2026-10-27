/** Synthetic Core and journal boundaries; real preparation, decision/history and wire validators. No deployed acceptance. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createLegiwatchCoreClient} from '../../../runtime/native-authority/legiwatch-client.mjs';
import {createRelevancePreparer as createLegiwatchPreparer} from '../legiwatch-relevance-preparer.mjs';
import {createIntentApprovalOwner} from '../approval.mjs';
import {legiwatchValidators,relevanceValidators,resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createIntentMount} from '../mount.mjs';
import {assertPreparedResult} from '../../../worker/conversation/intents/prepared.mjs';
import {binding as seedBinding,id} from '../../conversations/test/store-fixture.mjs';
import {receiveIntentsResponse} from '../../../../packages/contracts/dist/intents-application.mjs';
const NOW=1800000000000,delivery=n=>'sdk:'+String(n).padStart(64,'0');
function mount({binding,scopes,preparers}){
 const rows=new Map(),key=k=>JSON.stringify(k),clone=structuredClone;
 const port={
  async claim({key:k,record}){const at=key(k);if(rows.has(at))return {claimed:false,entry:clone(rows.get(at))};rows.set(at,{record:clone(record),state:'PENDING',outcome:null});return {claimed:true};},
  async settle({key:k,record,state,outcome}){const row=rows.get(key(k));assert.equal(row.state,'PENDING');assert.equal(hash(record),hash(row.record));Object.assign(row,{state,outcome:clone(outcome)});return clone(row);},
  async read({key:k}){return clone(rows.get(key(k))??null);},
  async list({conversation:c}){return {entries:[...rows].filter(([k])=>{const v=JSON.parse(k);return ['tenantId','actorId','conversationId'].every(n=>v[n]===c[n]);}).map(([k,v])=>({deliveryId:JSON.parse(k).deliveryId,createdAt:new Date(NOW).toISOString(),...clone(v)})),next:null};},
 };
 const resultRelease={async check({selection,selectionSha256}){return {authorized:true,selectionSha256,binding:selection.binding,scopes,checkedAtMs:NOW,expiresAtMs:NOW+60000};}};
 return {store:{rows,port},mount:createIntentMount({binding,preparers,journalStore:port,now:()=>NOW,limits:{maxRequestMs:5000},enabled:true,resultRelease})};
}
const operation='save_legiwatch_relevance';
function setup(){
 const binding={...seedBinding,tenantId:id(80),actorId:id(81)},clientId=id(5),scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:clientId,policyRevision:'p1'}];
 const request={clientId,folderId:id(6),jurisdiction:'US',sessionKey:'119',fields:['title'],billId:'hr1-119',explanation:'Client relevance for review',documentId:'hr1-119:title',start:0,end:4,quote:'bill',previewHash:'a'.repeat(64)};
 const state={paths:[],prepares:0,effects:0,loseCreate:false,loseDecide:false,scopeRevoked:false,credential:'synthetic-attended',proposal:null,corrupt:false,corruptTime:false,denied:false};
 const client=createLegiwatchCoreClient({origin:'https://core.invalid',now:()=>NOW,getServiceSecret:async()=>'synthetic-service',reservedCredentials:async()=>new Set(),getCredentials:async()=>({credential:state.credential,expiresAtMs:NOW+60000}),async fetchImpl(url,init){
  const path=new URL(url).pathname,body=JSON.parse(init.body);state.paths.push(path);
  assert.equal(init.headers.authorization,'Bearer synthetic-attended');assert.equal(init.headers['x-internal-service-secret'],'synthetic-service');assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');assert.ok(Number(init.headers['x-meri-deadline-at'])>NOW);
  if(state.denied)return Response.json({error:'denied'},{status:403});
  if(path.endsWith('/prepare_legiwatch_relevance')){state.prepares++;state.proposal={version:'0.1.0',proposalId:id(10),status:'proposed',request:body.request,context:{...body.context,identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64)},createdAt:new Date(NOW).toISOString(),expiresAt:new Date(NOW+50000).toISOString(),receipt:null};if(state.loseCreate)throw Error('lost prepare');}
  if(path.endsWith('/decide_legiwatch_relevance')){if(state.proposal.status==='proposed'){
   if(body.decision==='rejected')state.proposal.status='dismissed';else {state.effects++;state.proposal.status='succeeded';state.proposal.receipt={request:state.proposal.request,outcome:'suggested',payload:{binding:hash([state.proposal.request.previewHash,state.proposal.request.requestKey]),suggestionId:id(7),version:1,origin:'semantic',state:'pending'}};}}
   if(state.loseDecide)throw Error('lost outcome');}
  const response=structuredClone(state.proposal);if(state.corrupt)response.request.quote='fake';if(state.corruptTime)response.expiresAt=new Date(NOW+55000).toISOString();return Response.json(response);
 }});
 const preparer=createLegiwatchPreparer({binding,scopes,selectedClientId:clientId,client,now:()=>NOW,deadlineMs:NOW+60000,policyRevision:'p1',currentRights:async()=>({scopes:state.scopeRevoked?[]:scopes,expiresAtMs:NOW+60000})});
 const m=mount({binding,scopes,preparers:[preparer]}),principal={tenantId:binding.tenantId,actorId:binding.actorId,clientIds:[clientId]};
 const owner=createIntentApprovalOwner({journal:m.store.port,legiwatch:{read:client.read,decide:client.decide},now:()=>NOW,limits:{maxRequestMs:5000},enabled:true});
 const call={operation:{id:operation,version:'0.2.0'},arguments:request,deliveryId:delivery(1)};
 const decideRequest=(p,decision='approved')=>({conversationId:binding.conversationId,deliveryId:delivery(1),proposalId:p.proposalId,commandSha256:p.commandSha256,decision});
 return {state,binding,scopes,request,call,client,owner,principal,store:m.store,decideRequest,prepare:()=>m.mount.prepare(call),list:()=>owner.list({principal,request:{conversationId:binding.conversationId}}),decide:(p,decision='approved')=>owner.decide({principal,request:decideRequest(p,decision)})};
}
test('canonical intent mount prepares once and explicit approval saves a pending suggestion without automatic assignment',async()=>{
 const f=setup(),prepared=await f.prepare(),p=prepared.proposal;
 assert.equal(f.state.effects,0);assert.deepEqual(await f.prepare(),prepared);assert.equal(f.state.prepares,1);
 assert.equal(assertPreparedResult('legiwatch',f.call.operation,prepared,f.binding,{scopes:f.scopes,nowMs:NOW}).reference,p.proposalId);
 const listed=await f.list();assert.equal(listed.intents[0].result.status,'proposed');
 await receiveIntentsResponse('list',200,JSON.stringify(listed),{request:{conversationId:f.binding.conversationId}});
 const result=await f.decide(p);assert.equal(result.result.receipt.outcome,'suggested');assert.equal(f.state.effects,1);
 await receiveIntentsResponse('decide',200,JSON.stringify(result),{request:f.decideRequest(p),proposal:p});
 await f.decide(p);assert.equal(f.state.effects,1);assert.equal(f.state.prepares,1);
});
test('lost prepare acknowledgement stays UNKNOWN without another POST',async()=>{
 const f=setup();f.state.loseCreate=true;await assert.rejects(f.prepare(),{code:'UNKNOWN'});f.state.loseCreate=false;await assert.rejects(f.prepare(),{code:'UNKNOWN'});assert.equal(f.state.prepares,1);assert.equal(f.state.effects,0);
});
test('lost effect acknowledgement recovers by read without redispatch',async()=>{
 const f=setup(),{proposal}=await f.prepare();f.state.loseDecide=true;await assert.rejects(f.decide(proposal),/APPROVAL_DECISION_UNKNOWN/);
 const before=f.state.paths.filter(p=>p.endsWith('/decide_legiwatch_relevance')).length;f.state.loseDecide=false;const history=await f.list();assert.equal(history.intents[0].result.status,'succeeded');assert.equal(f.state.paths.filter(p=>p.endsWith('/decide_legiwatch_relevance')).length,before);assert.equal(f.state.effects,1);
});
test('dismiss never changes a suggestion',async()=>{const f=setup(),{proposal}=await f.prepare();assert.equal((await f.decide(proposal,'rejected')).result.status,'dismissed');assert.equal(f.state.effects,0);});
test('foreign selector, injected request key and tampered command digest refuse',async()=>{
 const f=setup();assert.throws(()=>relevanceValidators.saveInput({...f.request,requestKey:'caller-chosen'}));assert.throws(()=>relevanceValidators.saveInput({...f.request,end:3}));
 const {proposal}=await f.prepare();await assert.rejects(f.decide({...proposal,commandSha256:'0'.repeat(64)}),/INTENT_MISMATCH/);assert.equal(f.state.effects,0);
});
test('revoked principal withholds history and refuses a decision before Core',async()=>{
 const f=setup(),{proposal}=await f.prepare(),principal={...f.principal,clientIds:[]},before=f.state.paths.length;
 const list=await f.owner.list({principal,request:{conversationId:f.binding.conversationId}});assert.equal(list.intents[0].withheld,true);
 await assert.rejects(f.owner.decide({principal,request:f.decideRequest(proposal)}),/INTENT_SCOPE_WITHHELD/);assert.equal(f.state.paths.length,before);
});
test('different owner request is never released as the prepared receipt',async()=>{const f=setup(),{proposal}=await f.prepare();f.state.corrupt=true;await assert.rejects(f.client.read({proposal}));assert.equal((await f.list()).intents[0].result,'unavailable');f.state.corrupt=false;f.state.corruptTime=true;await assert.rejects(f.client.read({proposal}));});
test('expired deadline makes no HTTP call',async()=>{const f=setup(),before=f.state.paths.length;await assert.rejects(f.client.prepare({binding:f.binding,selectedClientId:f.request.clientId,request:{...f.request,requestKey:'synthetic-key'},deadlineMs:NOW}));assert.equal(f.state.paths.length,before);});
test('catalog maps one prepare-only operation and worker rejects an applied result',async()=>{const f=setup(),p=await f.prepare();const c=resolveOperationContract(f.call.operation);c.assertOutput(p,{request:f.request});assert.throws(()=>assertPreparedResult('legiwatch',f.call.operation,{status:'executed',proposal:p.proposal},f.binding,{scopes:f.scopes,nowMs:NOW}));});
