/** Synthetic Core and journal boundaries; real preparation, decision/history and wire validators. No deployed acceptance. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createClientRecordCoreClient} from '../../../runtime/native-authority/client-record-client.mjs';
import {createClientRecordPreparer} from '../client-record-preparer.mjs';
import {createIntentApprovalOwner} from '../approval.mjs';
import {resolveOperationContract,clientRecordValidators as frozen0_2} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {clientRecordValidators} from '../../../../packages/contracts/retrieval-0.3/client-record-action-validation.mjs';
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
function setup(operation='update_client_profile',sourced=false){
 const binding={...seedBinding,tenantId:id(80),actorId:id(81)},clientId=id(5),scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:clientId,policyRevision:'p1'}];
 const provenance={name:{sourceUrl:'https://sam.gov/entity/acme',confidence:'high'}};
 const request=operation==='create_client'?{name:'New client',skipLdaCheck:true,...(sourced?{provenance}:{})}:{clientId,description:'Approved detail',people:[{name:'Person'}]};
 const state={paths:[],versions:[],prepares:0,effects:0,loseCreate:false,loseDecide:false,scopeRevoked:false,credential:'synthetic-attended',proposal:null,corrupt:false,corruptTime:false,denied:false,preflight:{duplicate:'clear',capacity:'allowed'}};
 const client=createClientRecordCoreClient({origin:'https://core.invalid',now:()=>NOW,getServiceSecret:async()=>'synthetic-service',reservedCredentials:async()=>new Set(),getCredentials:async()=>({credential:state.credential,expiresAtMs:NOW+60000}),async fetchImpl(url,init){
  const path=new URL(url).pathname,body=JSON.parse(init.body);state.paths.push(path);
  assert.equal(init.headers.authorization,'Bearer synthetic-attended');assert.equal(init.headers['x-internal-service-secret'],'synthetic-service');assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');assert.ok(Number(init.headers['x-meri-deadline-at'])>NOW);
  assert.equal(body.version,2);state.versions.push(path);
  if(state.denied)return Response.json({error:'denied'},{status:403});
  if(path.endsWith('/prepare_client_record_action')){state.prepares++;state.proposal={version:'0.1.0',proposalId:id(10),status:'proposed',request:body.request,context:{...body.context,identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64)},createdAt:new Date(NOW).toISOString(),expiresAt:new Date(NOW+50000).toISOString(),receipt:null,preflight:body.version>=2?state.preflight:undefined};if(state.loseCreate)throw Error('lost prepare');}
  if(path.endsWith('/decide_client_record_action')){if(state.proposal.status==='proposed'){
   if(body.decision==='rejected')state.proposal.status='dismissed';else {state.effects++;state.proposal.status='succeeded';state.proposal.receipt=operation==='create_client'?{request:state.proposal.request,outcome:'created',created:true,client:{id:id(8),name:request.name,website:null},ldaMatch:null}:{request:state.proposal.request,outcome:'partially_updated',tool:operation,updated:true,clientId,clientName:'Sample',fieldsWritten:['description'],facilitiesCreated:[],capabilitiesCreated:[],peopleCreated:[],peopleUpdated:['Person'],skipped:[],rowErrors:['Facility failure']};}}
   if(state.loseDecide)throw Error('lost outcome');}
  const response=structuredClone(state.proposal);if(state.corrupt)response.request.input.name='tampered';if(state.corruptTime)response.expiresAt=new Date(NOW+55000).toISOString();return Response.json(response);
 }});
 const preparer=createClientRecordPreparer({operation,binding,scopes,selectedClientId:clientId,client,now:()=>NOW,deadlineMs:NOW+60000,policyRevision:'p1',currentRights:async()=>({scopes:state.scopeRevoked?[]:scopes,expiresAtMs:NOW+60000})});
 const m=mount({binding,scopes,preparers:[preparer]}),principal={tenantId:binding.tenantId,actorId:binding.actorId,clientIds:[clientId]};
 const owner=createIntentApprovalOwner({journal:m.store.port,clientRecord:{read:client.read,decide:client.decide},now:()=>NOW,limits:{maxRequestMs:5000},enabled:true});
 // The caller must name the exact version the owner prepares: create_client is 0.3.0, update_client_profile 0.2.0.
 const call={operation:{id:operation,version:preparer.operation.version},arguments:request,deliveryId:delivery(1)};
 const decideRequest=(p,decision='approved')=>({conversationId:binding.conversationId,deliveryId:delivery(1),proposalId:p.proposalId,commandSha256:p.commandSha256,decision});
 return {state,binding,scopes,request,call,client,owner,principal,store:m.store,mount:m.mount,provenance,decideRequest,prepare:()=>m.mount.prepare(call),prepareWith:(args,n)=>m.mount.prepare({...call,arguments:args,deliveryId:'sdk:'+String(n).padStart(64,'0')}),list:()=>owner.list({principal,request:{conversationId:binding.conversationId}}),decide:(p,decision='approved')=>owner.decide({principal,request:decideRequest(p,decision)})};
}
test('canonical intent mount prepares once and explicit approval preserves partial profile outcome',async()=>{
 const f=setup(),prepared=await f.prepare(),p=prepared.proposal;
 assert.equal(f.state.effects,0);assert.deepEqual(await f.prepare(),prepared);assert.equal(f.state.prepares,1);
 assert.equal(assertPreparedResult('client-record',f.call.operation,prepared,f.binding,{scopes:f.scopes,nowMs:NOW}).reference,p.proposalId);
 const listed=await f.list();assert.equal(listed.intents[0].result.status,'proposed');
 await receiveIntentsResponse('list',200,JSON.stringify(listed),{request:{conversationId:f.binding.conversationId}});
 const result=await f.decide(p);assert.equal(result.result.receipt.outcome,'partially_updated');assert.equal(f.state.effects,1);
 await receiveIntentsResponse('decide',200,JSON.stringify(result),{request:f.decideRequest(p),proposal:p});
 await f.decide(p);assert.equal(f.state.effects,1);assert.equal(f.state.prepares,1);
});
test('lost prepare acknowledgement stays UNKNOWN without another POST',async()=>{
 const f=setup();f.state.loseCreate=true;await assert.rejects(f.prepare(),{code:'UNKNOWN'});f.state.loseCreate=false;await assert.rejects(f.prepare(),{code:'UNKNOWN'});assert.equal(f.state.prepares,1);assert.equal(f.state.effects,0);
});
test('lost effect acknowledgement recovers by read without redispatch',async()=>{
 const f=setup(),{proposal}=await f.prepare();f.state.loseDecide=true;await assert.rejects(f.decide(proposal),/APPROVAL_DECISION_UNKNOWN/);
 const before=f.state.paths.filter(p=>p.endsWith('/decide_client_record_action')).length;f.state.loseDecide=false;const history=await f.list();assert.equal(history.intents[0].result.status,'succeeded');assert.equal(f.state.paths.filter(p=>p.endsWith('/decide_client_record_action')).length,before);assert.equal(f.state.effects,1);
});
test('dismiss never changes a client record',async()=>{const f=setup(),{proposal}=await f.prepare();assert.equal((await f.decide(proposal,'rejected')).result.status,'dismissed');assert.equal(f.state.effects,0);});
test('foreign selector, injected request key and tampered command digest refuse',async()=>{
 const f=setup();assert.throws(()=>clientRecordValidators.normalizeInput('update_client_profile',{...f.request,requestKey:'caller-chosen'}));assert.throws(()=>clientRecordValidators.normalizeInput('update_client_profile',{...f.request,expectedVersion:0}));
 const {proposal}=await f.prepare();await assert.rejects(f.decide({...proposal,commandSha256:'0'.repeat(64)}),/INTENT_MISMATCH/);assert.equal(f.state.effects,0);
});
test('revoked principal withholds history and refuses a decision before Core',async()=>{
 const f=setup(),{proposal}=await f.prepare(),principal={...f.principal,clientIds:[]},before=f.state.paths.length;
 const list=await f.owner.list({principal,request:{conversationId:f.binding.conversationId}});assert.equal(list.intents[0].withheld,true);
 await assert.rejects(f.owner.decide({principal,request:f.decideRequest(proposal)}),/INTENT_SCOPE_WITHHELD/);assert.equal(f.state.paths.length,before);
});
test('different owner request is never released as the prepared receipt',async()=>{const f=setup(),{proposal}=await f.prepare();f.state.corrupt=true;await assert.rejects(f.client.read({proposal}));assert.equal((await f.list()).intents[0].result,'unavailable');f.state.corrupt=false;f.state.corruptTime=true;await assert.rejects(f.client.read({proposal}));});
test('expired deadline makes no HTTP call',async()=>{const f=setup(),before=f.state.paths.length;await assert.rejects(f.client.prepare({binding:f.binding,selectedClientId:f.request.clientId,request:{operation:'update_client_profile',input:f.request},deadlineMs:NOW}));assert.equal(f.state.paths.length,before);});
test('catalog maps one prepare-only operation and worker rejects an applied result',async()=>{const f=setup(),p=await f.prepare();const c=resolveOperationContract(f.call.operation);c.assertOutput(p,{request:f.request});assert.throws(()=>assertPreparedResult('client-record',f.call.operation,{status:'executed',proposal:p.proposal},f.binding,{scopes:f.scopes,nowMs:NOW}));});

test('created-client receipt crosses actual generated public receiver without inventing enrichment completion',async()=>{
 const f=setup('create_client'),{proposal}=await f.prepare();const result=await f.decide(proposal);
 assert.equal(result.result.receipt.outcome,'created');assert.equal(result.result.receipt.ldaMatch,null);
 await receiveIntentsResponse('decide',200,JSON.stringify(result),{request:f.decideRequest(proposal),proposal});
 const corrupt=structuredClone(result);corrupt.result.receipt.client.name='Other';
 await assert.rejects(receiveIntentsResponse('decide',200,JSON.stringify(corrupt),{request:f.decideRequest(proposal),proposal}));
});
test('partial-result relabeling and wrong immutable context are rejected by the real public receiver',async()=>{
 const f=setup(),{proposal}=await f.prepare(),result=await f.decide(proposal);
 for(const key of ['outcome','context']){const bad=structuredClone(result);if(key==='outcome')bad.result.receipt.outcome='updated';else bad.result.context.membershipRevision='d'.repeat(64);
 await assert.rejects(receiveIntentsResponse('decide',200,JSON.stringify(bad),{request:f.decideRequest(proposal),proposal}));}
});
test('input requires actual profile changes and UTF16/UTF8 bounds before preparation',async()=>{
 assert.throws(()=>clientRecordValidators.normalizeInput('update_client_profile',{clientId:id(5),people:[]}));
 assert.throws(()=>clientRecordValidators.normalizeInput('create_client',{name:'😀'.repeat(151)}));
 assert.throws(()=>clientRecordValidators.normalizeInput('update_client_profile',{clientId:id(5),people:Array.from({length:50},()=>({name:'Person',notes:'漢'.repeat(2000)}))}));
});
test('a sourced create proposal keeps its provenance through preparation, review and one canonical created receipt',async()=>{
 const f=setup('create_client',true),prepared=await f.prepare(),p=prepared.proposal;
 assert.deepEqual(p.request.input.provenance,f.provenance);
 assert.equal(assertPreparedResult('client-record',f.call.operation,prepared,f.binding,{scopes:f.scopes,nowMs:NOW}).reference,p.proposalId);
 assert.equal(f.state.effects,0);
 const listed=await f.list();assert.deepEqual(listed.intents[0].result.preflight,{duplicate:'clear',capacity:'allowed'});
 await receiveIntentsResponse('list',200,JSON.stringify(listed),{request:{conversationId:f.binding.conversationId}});
 const result=await f.decide(p);
 assert.equal(result.result.receipt.outcome,'created');assert.equal(result.result.receipt.client.name,'New client');
 assert.deepEqual(result.result.request.input.provenance,f.provenance);
 await receiveIntentsResponse('decide',200,JSON.stringify(result),{request:f.decideRequest(p),proposal:p});
 assert.equal(f.state.effects,1);assert.equal(f.state.prepares,1);
});
test('the bounded preflight is review evidence only: a denied verdict still prepares, still needs explicit approval and never creates',async()=>{
 const f=setup('create_client',true);f.state.preflight={duplicate:'possible',capacity:'denied'};
 const prepared=await f.prepare();assert.equal(f.state.effects,0);assert.equal(f.state.prepares,1);
 const listed=await f.list();assert.deepEqual(listed.intents[0].result.preflight,{duplicate:'possible',capacity:'denied'});
 const again=await f.prepare();assert.equal(again.proposal.proposalId,prepared.proposal.proposalId);assert.equal(again.proposal.commandSha256,prepared.proposal.commandSha256);assert.equal(f.state.prepares,1);
 assert.equal((await f.decide(prepared.proposal,'rejected')).result.status,'dismissed');assert.equal(f.state.effects,0);
});
test('malformed, excessive or foreign provenance refuses before any HTTP call',async()=>{
 const f=setup('create_client'),before=f.state.paths.length,at='https://sam.gov/x';
 const bad=[{uei:{sourceUrl:at,confidence:'high'}},{name:{sourceUrl:at,confidence:'high',extra:1}},{name:{sourceUrl:at}},{name:{sourceUrl:'',confidence:'high'}},{name:{sourceUrl:'https://sam.gov/'+'x'.repeat(2049),confidence:'high'}},{name:{sourceUrl:at,confidence:'certain'}}];
 for(const provenance of bad)await assert.rejects(f.client.prepare({binding:f.binding,selectedClientId:null,request:{operation:'create_client',input:{name:'New client',skipLdaCheck:true,provenance}},deadlineMs:NOW+60000}));
 assert.equal(f.state.paths.length,before);
});
test('the frozen 0.2 owner still reads an ordinary answer and refuses the new fields',async()=>{
 const ordinary={version:'0.1.0',proposalId:id(10),request:{operation:'create_client',input:{name:'New client',skipLdaCheck:true}},context:{conversationId:id(1),selectedClientId:null,identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64)},createdAt:new Date(NOW).toISOString(),expiresAt:new Date(NOW+50000).toISOString(),status:'proposed',receipt:null};
 assert.doesNotThrow(()=>frozen0_2.coreResult(ordinary));
 assert.throws(()=>frozen0_2.coreResult({...ordinary,preflight:{duplicate:'clear',capacity:'allowed'}}));
 assert.throws(()=>frozen0_2.normalizeInput('create_client',{name:'New client',provenance:{name:{sourceUrl:'https://sam.gov/x',confidence:'high'}}}));
 assert.doesNotThrow(()=>clientRecordValidators.coreResult({...ordinary,preflight:{duplicate:'clear',capacity:'allowed'}}));
 assert.doesNotThrow(()=>clientRecordValidators.normalizeInput('create_client',{name:'New client',provenance:{name:{sourceUrl:'https://sam.gov/x',confidence:'high'}}}));
});
test('the same delivery key with a different payload is a conflict, never a second proposal',async()=>{
 const f=setup('create_client',true),prepared=await f.prepare();
 await assert.rejects(f.mount.prepare({...f.call,arguments:{...f.request,provenance:{name:{sourceUrl:'https://sam.gov/other',confidence:'low'}}}}),/CONFLICT/);
 assert.equal(f.state.prepares,1);
 assert.equal((await f.prepare()).proposal.proposalId,prepared.proposal.proposalId);
});
test('pre-call refusals settle FAILED and replay the same refusal without a Core call',async()=>{
 const f=setup();
 for(const [n,args,code] of [[7,{},'INVALID_ARGUMENTS'],[8,{...f.request,clientId:id(6)},'ACCESS_DENIED']]){
  await assert.rejects(f.prepareWith(args,n),{code});await assert.rejects(f.prepareWith(args,n),{code});
  assert.equal([...f.store.rows.values()].filter(r=>r.state==='FAILED').length,n-6);
 }
 assert.equal(f.state.prepares,0);
});
