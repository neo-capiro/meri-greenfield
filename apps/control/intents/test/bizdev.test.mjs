/** Synthetic Core and journal boundaries; real preparation, decision/release and public wire validators. No deployed acceptance. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createBizdevCoreClient} from '../../../runtime/native-authority/bizdev-client.mjs';
import {createBizdevPreparer} from '../bizdev-preparer.mjs';
import {createIntentApprovalOwner} from '../approval.mjs';
import {bizdevValidators,resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createIntentMount} from '../mount.mjs';
import {assertPreparedResult} from '../../../worker/conversation/intents/prepared.mjs';
import {binding as seedBinding,id} from '../../conversations/test/store-fixture.mjs';
import {receiveIntentsResponse} from '../../../../packages/contracts/dist/intents-application.mjs';
const NOW=1800000000000,delivery=n=>'sdk:'+String(n).padStart(64,'0'),operation='save_business_development_brief';
const sections=()=>({companyAndFirmImplication:{text:'firm implication',citationIndexes:[1,0,1]},verifiedEvidence:{text:'verified evidence',citationIndexes:[0]},judgment:{text:'judgment',citationIndexes:[]},practicalAction:{text:'practical action',citationIndexes:[2]},missingInformation:{text:'missing information',citationIndexes:[]}});
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
function setup({linked=true}={}){
 const binding={...seedBinding,tenantId:id(80),actorId:id(81)},conversationId=binding.conversationId,clientId=id(5),linkedClientId=linked?clientId:null,scopeVersion='a'.repeat(64);
 const scopes=[{tenantId:binding.tenantId,kind:linked?'client':'private-user',resourceId:linked?clientId:binding.actorId,policyRevision:'p1'}];
 const request={conversationId,expectedVersionNumber:2,title:'Updated brief',sections:sections()};
 const state={paths:[],prepares:0,effects:0,loseCreate:false,loseDecide:false,scopeRevoked:false,credential:'synthetic-attended',proposal:null,corrupt:false,outcome:null};
 const client=createBizdevCoreClient({origin:'https://core.invalid',now:()=>NOW,getServiceSecret:async()=>'synthetic-service',reservedCredentials:async()=>new Set(),getCredentials:async()=>({credential:state.credential,expiresAtMs:NOW+60000}),async fetchImpl(url,init){
  const path=new URL(url).pathname,body=JSON.parse(init.body);state.paths.push(path);
  assert.equal(init.headers.authorization,'Bearer synthetic-attended');assert.equal(init.headers['x-internal-service-secret'],'synthetic-service');assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');assert.ok(Number(init.headers['x-meri-deadline-at'])>NOW);
  assert.equal(body.version,1);assert.equal(body.context.conversationId,conversationId);
  if(path.endsWith('/prepare_business_development_brief')){state.prepares++;state.proposal={version:'0.1.0',proposalId:id(10),status:'proposed',request:body.request,context:{conversationId,prospectId:id(7),prospectName:'Synthetic Prospect',canonicalOrganizationId:null,linkedClientId,scopeVersion},createdAt:new Date(NOW).toISOString(),expiresAt:new Date(NOW+50000).toISOString(),receipt:null};if(state.loseCreate)throw Error('lost prepare');}
  if(path.endsWith('/decide_business_development_brief')){
   if(body.decision==='rejected')state.proposal.status='dismissed';
   else if(state.outcome==='refused')state.proposal.status='failed_terminal';
   else if(state.outcome==='unknown')state.proposal.status='outcome_unknown';
   else{state.effects++;state.proposal.status='succeeded';state.proposal.receipt={request:state.proposal.request,binding:'d'.repeat(64),tool:operation,status:'saved',generatedAt:new Date(NOW).toISOString(),brief:{id:id(30),title:'Updated brief',status:'draft',currentVersionNumber:3,updatedAt:new Date(NOW).toISOString()},version:{id:id(31),versionNumber:3,createdAt:new Date(NOW).toISOString(),citationCount:3},reused:false,prospectName:'Synthetic Prospect'};}
   if(state.loseDecide)throw Error('lost outcome');}
  const response=structuredClone(state.proposal);if(state.corrupt)response.request.expectedVersionNumber=9;return Response.json(response);
 }});
 const preparer=createBizdevPreparer({binding,scopes,client,now:()=>NOW,deadlineMs:NOW+60000,policyRevision:'p1',currentRights:async()=>({scopes:state.scopeRevoked?[]:scopes,expiresAtMs:NOW+60000})});
 const m=mount({binding,scopes,preparers:[preparer]}),principal={tenantId:binding.tenantId,actorId:binding.actorId,clientIds:linked?[clientId]:[]};
 const owner=createIntentApprovalOwner({journal:m.store.port,bizdev:{read:client.read,decide:client.decide},now:()=>NOW,limits:{maxRequestMs:5000},enabled:true});
 const call={operation:{id:operation,version:'0.2.0'},arguments:request,deliveryId:delivery(1)};
 const decideRequest=(p,decision='approved')=>({conversationId,deliveryId:delivery(1),proposalId:p.proposalId,commandSha256:p.commandSha256,decision});
 return {state,binding,scopes,request,call,client,owner,principal,store:m.store,conversationId,linkedClientId,decideRequest,prepare:()=>m.mount.prepare(call),list:()=>owner.list({principal,request:{conversationId}}),decide:(p,decision='approved')=>owner.decide({principal,request:decideRequest(p,decision)})};
}
test('the prospect conversation prepares once and approval releases the exact saved version',async()=>{
 const f=setup(),{proposal,status}=await f.prepare(),p=status==='approval_required'?proposal:null;
 assert.equal(p.operation,operation);assert.deepEqual(p.scopes,f.scopes);
 assert.equal(assertPreparedResult('bizdev',f.call.operation,{status:'approval_required',proposal:p},f.binding,{scopes:f.scopes,nowMs:NOW}).reference,p.proposalId);
 const listed=(await f.list()).intents;
 await receiveIntentsResponse('list',200,JSON.stringify(await f.list()),{request:{conversationId:f.conversationId}});
 assert.equal(listed[0].kind,'bizdev_action');assert.equal(listed[0].proposal.commandSha256,p.commandSha256);
 const result=await f.decide(p);
 await receiveIntentsResponse('decide',200,JSON.stringify(result),{request:f.decideRequest(p),proposal:p});
 assert.equal(result.result.status,'succeeded');assert.equal(result.result.receipt.version.versionNumber,3);assert.equal(result.result.receipt.brief.currentVersionNumber,3);
 assert.equal(f.state.effects,1);assert.equal(f.state.prepares,1);
});
test('an unlinked prospect runs under the actor scope and never as a general client scope',async()=>{
 const f=setup({linked:false}),{proposal}=await f.prepare();
 assert.equal(proposal.context.linkedClientId,null);assert.equal(proposal.scopes[0].kind,'private-user');assert.equal(proposal.scopes[0].resourceId,f.binding.actorId);
 // The same proposal under a client scope is refused: a null client is not treated as canonical General.
 assert.throws(()=>bizdevValidators.assertProposal({...proposal,scopes:[{...proposal.scopes[0],kind:'client',resourceId:id(5)}]}));
 assert.throws(()=>bizdevValidators.assertProposal({...proposal,context:{...proposal.context,linkedClientId:id(5)}}));
});
test('lost prepare acknowledgement stays UNKNOWN without another POST',async()=>{
 const f=setup();f.state.loseCreate=true;await assert.rejects(f.prepare());assert.equal(f.state.prepares,1);assert.equal(f.state.paths.filter(p=>p.endsWith('/prepare_business_development_brief')).length,1);
});
test('lost effect acknowledgement recovers by read without another effect',async()=>{
 const f=setup(),{proposal}=await f.prepare();f.state.loseDecide=true;
 await assert.rejects(f.decide(proposal));
 assert.equal(f.state.effects,1);
 // The released Core state is what recovers the outcome; the lost decision is
 // never resent and no second effect is produced.
 const reread=await f.client.read({proposal});
 assert.equal(reread.status,'succeeded');assert.equal(reread.receipt.version.versionNumber,3);
 assert.equal(f.state.effects,1);
 assert.equal(f.state.paths.filter(p=>p.endsWith('/decide_business_development_brief')).length,1);
});
test('a refused or unconfirmed owner outcome is released unchanged and never relabelled',async()=>{
 for(const outcome of ['refused','unknown']){
  const f=setup(),{proposal}=await f.prepare();f.state.outcome=outcome;
  const result=await f.decide(proposal);
  await receiveIntentsResponse('decide',200,JSON.stringify(result),{request:f.decideRequest(proposal),proposal});
  assert.equal(result.result.receipt,null);
  assert.equal(result.result.status,outcome==='refused'?'failed_terminal':'outcome_unknown');
  // A receipt is never invented for one of these, and an unconfirmed status can not carry one.
  assert.throws(()=>bizdevValidators.coreResult({...result.result,status:'succeeded'},proposal));
 }
});
test('dismiss never writes a saved version',async()=>{
 const f=setup(),{proposal}=await f.prepare();const result=await f.decide(proposal,'rejected');
 assert.equal(result.result.status,'dismissed');assert.equal(result.result.receipt,null);assert.equal(f.state.effects,0);
});
test('a foreign conversation, an injected request key and a tampered digest refuse',async()=>{
 const f=setup(),{proposal}=await f.prepare();
 assert.throws(()=>bizdevValidators.assertProposal({...proposal,commandSha256:'f'.repeat(64)}));
 assert.throws(()=>bizdevValidators.assertProposal({...proposal,context:{...proposal.context,conversationId:id(99)}}));
 assert.throws(()=>bizdevValidators.request({...f.request,requestKey:'short'}));
 await assert.rejects(createBizdevPreparer({binding:{...f.binding,conversationId:id(99)},scopes:f.scopes,client:f.client,now:()=>NOW,deadlineMs:NOW+60000,policyRevision:'p1',currentRights:async()=>({scopes:f.scopes,expiresAtMs:NOW+60000})}).prepare(f.call));
});
test('a revoked run scope and an expired deadline never reach Core',async()=>{
 const f=setup();f.state.scopeRevoked=true;await assert.rejects(f.prepare());assert.equal(f.state.paths.length,0);
 const g=setup(),before=g.client;
 await assert.rejects(createBizdevPreparer({binding:g.binding,scopes:g.scopes,client:before,now:()=>NOW,deadlineMs:NOW,policyRevision:'p1',currentRights:async()=>({scopes:g.scopes,expiresAtMs:NOW+60000})}).prepare(g.call));
 assert.equal(g.state.paths.length,0);
});
test('the catalog maps one prepare-only operation and an applied result is refused',async()=>{
 const f=setup(),{proposal}=await f.prepare();
 const contract=resolveOperationContract(f.call.operation);contract.assertOutput({status:'approval_required',proposal},{request:f.request});
 assert.throws(()=>assertPreparedResult('bizdev',f.call.operation,{status:'executed',proposal},f.binding,{scopes:f.scopes,nowMs:NOW}));
});
test('an identical re-prepare derives the same request key and one proposal',async()=>{
 const f=setup();const first=await f.prepare();const second=await f.prepare();
 assert.equal(first.proposal.request.requestKey,second.proposal.request.requestKey);
 assert.equal(second.proposal.commandSha256,first.proposal.commandSha256);
});
