/** Synthetic Core and journal boundaries; real preparation, decision/history and wire validators. No deployed acceptance. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createResearchSharingCoreClient} from '../../../runtime/native-authority/research-sharing-client.mjs';
import {createResearchSharingPreparers} from '../research-sharing-preparer.mjs';
import {createIntentApprovalOwner} from '../approval.mjs';
import {researchShareValidators,resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
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
const publish='publish_research_portfolio_share_link',revoke='revoke_research_portfolio_share_link',list='get_research_portfolio_share_links';
function setup(operation=publish){
 const binding={...seedBinding,tenantId:id(80),actorId:id(81)},clientId=id(5),scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:clientId,policyRevision:'p1'}];
 const request=operation===publish?{conversationId:binding.conversationId,snapshotId:id(6),designId:id(7),clientId,branding:false}:{conversationId:binding.conversationId,linkId:id(8)};
 const state={paths:[],effects:0,prepares:0,credentials:'user-session',loseCreate:false,loseApprove:false,proposal:null,scopeRevoked:false,extra:false};
 const settings={portfolioId:id(9),enabled:true,tenantEnabled:true,pinSet:true,pinUpdatedAt:null,activeLinkCount:0,updatedAt:null};
 const client=createResearchSharingCoreClient({origin:'https://core.invalid',now:()=>NOW,getServiceSecret:async()=>'service-secret',reservedCredentials:async()=>new Set(),
  getCredentials:async()=>({credential:state.credentials,expiresAtMs:NOW+60000}),async fetchImpl(url,init){
   const path=new URL(url).pathname,body=init.body===undefined?null:JSON.parse(init.body);state.paths.push({path,method:init.method,body});
   assert.equal(init.headers.authorization,'Bearer user-session');assert.equal(init.headers['x-internal-service-secret'],'service-secret');assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');
   if(path==='/api/clio/tools/'+list){assert.deepEqual(body,{version:1,input:{conversationId:binding.conversationId},currentTurn:{tenantId:binding.tenantId,userId:binding.actorId,conversationId:binding.conversationId,selectedClientId:clientId}});return Response.json({sharing:settings,links:[]});}
   if(path.endsWith('/share-preview'))return Response.json({dashboard:{schemaVersion:1},previewHash:'b'.repeat(64),designVersion:2},{status:201});
   if(path==='/api/clio/action-proposals'&&init.method==='POST'){
    state.prepares++;assert.equal(body.version,1);assert.deepEqual(body.currentTurn,{tenantId:binding.tenantId,userId:binding.actorId,conversationId:binding.conversationId,selectedClientId:clientId});
    state.proposal={proposalId:id(10),status:'proposed',tool:operation,preview:{label:operation===publish?'Publish client share link':'Revoke client share link',fields:body.proposal.input,client:{id:clientId,name:'Example client'}},createdAt:new Date(NOW).toISOString(),expiresAt:new Date(NOW+50000).toISOString()};
    if(state.loseCreate)throw Error('lost');return Response.json({disposition:'pending_approval',proposal:state.proposal},{status:201});
   }
   if(path.endsWith('/approve')){
    const fresh=state.proposal.status==='proposed';if(fresh)state.effects++;state.proposal.status='succeeded';
    if(state.loseApprove)throw Error('lost');return Response.json({...state.proposal,...(fresh&&operation===publish?{oneTimeResult:{sharePath:'/share/'+'c'.repeat(64),shownOnce:true}}:{})},{status:201});
   }
   if(path.endsWith('/dismiss')){state.proposal.status='dismissed';return Response.json(state.proposal,{status:201});}
   assert.equal(init.method,'GET');return Response.json([state.proposal]);
  }});
 const preparers=createResearchSharingPreparers({binding,scopes,selectedClientId:clientId,client,now:()=>NOW,deadlineMs:NOW+60000,policyRevision:'p1',currentRights:async()=>({scopes:state.scopeRevoked?[]:scopes,expiresAtMs:NOW+60000})});
 const m=mount({binding,scopes,preparers}),principal={tenantId:binding.tenantId,actorId:binding.actorId,clientIds:[clientId]};
 const owner=createIntentApprovalOwner({journal:m.store.port,sharing:{read:client.read,decide:client.decide},now:()=>NOW,limits:{maxRequestMs:5000},enabled:true});
 const call={operation:{id:operation,version:'0.2.0'},arguments:request,deliveryId:delivery(1)};
 return {state,binding,scopes,request,call,owner,principal,store:m.store,prepare:()=>m.mount.prepare(call),list:()=>owner.list({principal,request:{conversationId:binding.conversationId}}),decide:(p,decision='approved')=>owner.decide({principal,request:{conversationId:binding.conversationId,deliveryId:delivery(1),proposalId:p.proposalId,commandSha256:p.commandSha256,decision}})};
}
test('publish fetches and binds canonical preview, prepares once, and only fresh approval returns capability',async()=>{
 const f=setup(),prepared=await f.prepare(),p=prepared.proposal;
 assert.equal(p.request.previewHash,'b'.repeat(64));assert.equal(p.request.expectedDesignVersion,2);
 assert.equal(f.state.effects,0);assert.deepEqual(await f.prepare(),prepared);assert.equal(f.state.prepares,1);
 assert.equal(assertPreparedResult('research-sharing',f.call.operation,prepared,f.binding,{scopes:f.scopes,nowMs:NOW}).reference,p.proposalId);
 const before=await f.list();assert.equal(before.intents[0].proposalStatus,'proposed');
 await receiveIntentsResponse('list',200,JSON.stringify(before),{request:{conversationId:f.binding.conversationId}});
 const first=await f.decide(p);assert.equal(first.status,'research_share_decided');assert.equal(first.oneTimeResult.shownOnce,true);
 const expectation={proposal:p,request:{conversationId:f.binding.conversationId,deliveryId:delivery(1),proposalId:p.proposalId,commandSha256:p.commandSha256,decision:'approved'}};
 await receiveIntentsResponse('decide',200,JSON.stringify(first),expectation);
 await assert.rejects(receiveIntentsResponse('decide',200,JSON.stringify({...first,proposalStatus:'proposed'}),expectation));
 const leaked=structuredClone(before);leaked.intents[0].oneTimeResult=first.oneTimeResult;
 await assert.rejects(receiveIntentsResponse('list',200,JSON.stringify(leaked),{request:{conversationId:f.binding.conversationId}}));
 assert.equal((await f.decide(p)).oneTimeResult,undefined);assert.equal(f.state.effects,1);
 const after=await f.list();assert.equal(after.intents[0].proposalStatus,'succeeded');
 assert.equal(JSON.stringify(after).includes('/share/'),false);assert.equal(JSON.stringify([...f.store.rows]).includes('/share/'),false);
});
test('lost preparation acknowledgement never repeats a Core proposal',async()=>{
 const f=setup();f.state.loseCreate=true;await assert.rejects(f.prepare(),{code:'UNKNOWN'});f.state.loseCreate=false;
 await assert.rejects(f.prepare(),{code:'UNKNOWN'});assert.equal(f.state.prepares,1);assert.equal(f.state.effects,0);
});
test('lost approval response remains unknown; retry cannot recover capability',async()=>{
 const f=setup(),{proposal}=await f.prepare();f.state.loseApprove=true;await assert.rejects(f.decide(proposal),/APPROVAL_DECISION_UNKNOWN/);f.state.loseApprove=false;
 const retry=await f.decide(proposal);assert.equal(retry.proposalStatus,'succeeded');assert.equal(retry.oneTimeResult,undefined);assert.equal(f.state.effects,1);
});
test('revoke is governed, dismissal never performs an effect',async()=>{
 const f=setup(revoke),{proposal}=await f.prepare();assert.equal(f.state.paths.length,1);
 assert.equal((await f.decide(proposal,'rejected')).proposalStatus,'dismissed');assert.equal(f.state.effects,0);
});
test('foreign client, altered digest, raw address and model-supplied preview authority refuse',async()=>{
 const f=setup(),{proposal}=await f.prepare();
 for(const bad of [{...f.request,previewHash:'a'.repeat(64)},{...f.request,portfolioId:id(90)},{...f.request,pin:'123456'}])assert.throws(()=>researchShareValidators.normalizeInput(publish,bad));
 assert.throws(()=>researchShareValidators.assertProposal({...proposal,sharePath:'/share/'+'a'.repeat(64)}));
 await assert.rejects(f.decide({...proposal,commandSha256:'0'.repeat(64)}),/INTENT_MISMATCH/);
 await assert.rejects(f.owner.decide({principal:{...f.principal,clientIds:[]},request:{conversationId:f.binding.conversationId,deliveryId:delivery(1),proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,decision:'approved'}}),/INTENT_SCOPE_WITHHELD/);
 const c=resolveOperationContract({id:list,version:'0.2.0'});assert.equal(c.normalizeInput({conversationId:f.binding.conversationId}).input.conversationId,f.binding.conversationId);
 assert.throws(()=>c.assertOutput({sharing:{},links:[],oneTimeResult:{sharePath:'/share/x'}},{request:{conversationId:f.binding.conversationId}}));assert.equal(f.state.effects,0);
});
