/** MO-05 governed Research Portfolio actions over synthetic Core action-proposal and journal boundaries; real preparation, decision/history and wire validators. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createResearchActionCoreClient} from '../../../runtime/native-authority/research-action-client.mjs';
import {createResearchActionPreparers} from '../research-action-preparer.mjs';
import {createIntentApprovalOwner} from '../approval.mjs';
import {researchActionValidators} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {RESEARCH_ACTION_INTENTS} from '../../../../packages/contracts/retrieval-0.2/research-portfolio-action-validation.mjs';
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
const REQUESTS=binding=>({
 manage_research_portfolio:{conversationId:binding.conversationId,action:'portfolio_archive',parameters:{expectedRevision:3},confirmed:true},
 create_research_portfolio_snapshot:{conversationId:binding.conversationId,name:'Q1 review',expectedRevision:3},
 request_research_portfolio_output:{conversationId:binding.conversationId,snapshotId:id(6)},
 save_research_portfolio_output_to_client:{conversationId:binding.conversationId,outputId:id(7),clientId:id(5)},
 watch_research_portfolio:{conversationId:binding.conversationId},
 update_research_portfolio_change_state:{conversationId:binding.conversationId,eventId:id(8),action:'acknowledged'},
 create_research_portfolio_bookmark:{conversationId:binding.conversationId,targetKind:'snapshot',targetId:id(6),label:'Reviewed'},
 add_research_portfolio_review_note:{conversationId:binding.conversationId,reviewId:id(9),body:'Supporting evidence attached.',expectedRevision:2},
 prepare_research_portfolio_brief:{conversationId:binding.conversationId,confirmed:true},
 prepare_research_portfolio_meeting:{conversationId:binding.conversationId,confirmed:true,selectedReviewIds:[id(9)]},
});
const SUMMARY={manage_research_portfolio:{ok:true,portfolioId:id(10),resultingRevision:4},create_research_portfolio_snapshot:{ok:true,snapshotId:id(11),portfolioRevision:3},request_research_portfolio_output:{ok:true,jobId:id(12),status:'queued'},
 save_research_portfolio_output_to_client:{ok:true,attachmentId:id(13),openPath:'/clients/files'},watch_research_portfolio:{ok:true,id:id(14)},update_research_portfolio_change_state:{ok:true,id:id(8)},
 create_research_portfolio_bookmark:{ok:true,id:id(15)},add_research_portfolio_review_note:{ok:true,id:id(16)},prepare_research_portfolio_brief:{ok:true,artifactId:id(17)},prepare_research_portfolio_meeting:{ok:true,artifactId:id(18)}};
function setup(operation='create_research_portfolio_snapshot',{selected=true}={}){
 const binding={...seedBinding,tenantId:id(80),actorId:id(81)},clientId=id(5),scopes=[selected?{tenantId:binding.tenantId,kind:'client',resourceId:clientId,policyRevision:'p1'}:{tenantId:binding.tenantId,kind:'private-user',resourceId:binding.actorId,policyRevision:'p1'}];
 const request=REQUESTS(binding)[operation];
 const state={paths:[],effects:0,prepares:0,loseCreate:false,loseApprove:false,proposal:null,scopeRevoked:false,bodies:[]};
 const client=createResearchActionCoreClient({origin:'https://core.invalid',now:()=>NOW,getServiceSecret:async()=>'service-secret',reservedCredentials:async()=>new Set(),
  getCredentials:async()=>({credential:'user-session',expiresAtMs:NOW+60000}),async fetchImpl(url,init){
   const path=new URL(url).pathname,body=init.body===undefined?null:JSON.parse(init.body);state.paths.push({path,method:init.method});state.bodies.push(body);
   assert.equal(init.headers.authorization,'Bearer user-session');assert.equal(init.headers['x-internal-service-secret'],'service-secret');assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');
   if(path==='/api/clio/action-proposals'&&init.method==='POST'){
    state.prepares++;assert.equal(body.version,1);assert.deepEqual(body.currentTurn,{tenantId:binding.tenantId,userId:binding.actorId,conversationId:binding.conversationId,selectedClientId:selected?clientId:null});
    assert.equal(body.proposal.tool,operation);assert.equal(body.proposal.surface,'chat');assert.equal(body.proposal.conversationId,binding.conversationId);
    state.proposal={proposalId:id(10),status:'proposed',tool:operation,preview:{label:'Run '+operation,fields:{action:body.proposal.input.action??null,name:body.proposal.input.name??null},...(body.proposal.input.clientId?{client:{id:body.proposal.input.clientId,name:'Example client'}}:{}),riskTier:null,leavesFirm:false,reversible:true,counts:{},reason:'This action requires explicit approval.'},createdAt:new Date(NOW).toISOString(),expiresAt:new Date(NOW+50000).toISOString(),resultSummary:null};
    if(state.loseCreate)throw Error('lost');return Response.json({disposition:'pending_approval',proposal:state.proposal},{status:201});
   }
   if(path.endsWith('/approve')){const fresh=state.proposal.status==='proposed';if(fresh){state.effects++;state.proposal.status='succeeded';state.proposal.resultSummary=SUMMARY[operation];}
    if(state.loseApprove)throw Error('lost');return Response.json(state.proposal,{status:201});}
   if(path.endsWith('/dismiss')){state.proposal.status='dismissed';return Response.json(state.proposal,{status:201});}
   assert.equal(init.method,'GET');return Response.json([state.proposal]);
  }});
 const preparers=createResearchActionPreparers({binding,scopes,selectedClientId:selected?clientId:null,client,now:()=>NOW,deadlineMs:NOW+60000,policyRevision:'p1',currentRights:async()=>({scopes:state.scopeRevoked?[]:scopes,expiresAtMs:NOW+60000})});
 const m=mount({binding,scopes,preparers}),principal={tenantId:binding.tenantId,actorId:binding.actorId,clientIds:[clientId]};
 const owner=createIntentApprovalOwner({journal:m.store.port,researchAction:{read:client.read,decide:client.decide},now:()=>NOW,limits:{maxRequestMs:5000},enabled:true});
 const call={operation:{id:operation,version:'0.2.0'},arguments:request,deliveryId:delivery(1)};
 const decideRequest=(p,decision='approved')=>({conversationId:binding.conversationId,deliveryId:delivery(1),proposalId:p.proposalId,commandSha256:p.commandSha256,decision});
 return {state,binding,scopes,request,call,owner,principal,store:m.store,decideRequest,prepare:(c=call)=>m.mount.prepare(c),list:()=>owner.list({principal,request:{conversationId:binding.conversationId}}),decide:(p,decision='approved')=>owner.decide({principal,request:decideRequest(p,decision)})};
}
test('every governed action prepares once through Core, binds the delivery key, and a fresh approval releases the bounded receipt once',async()=>{
 for(const operation of RESEARCH_ACTION_INTENTS){
  const f=setup(operation),prepared=await f.prepare(),p=prepared.proposal;
  assert.equal(p.kind,'research_action');assert.equal(p.operation,operation);assert.equal(f.state.effects,0);
  const expectedKey='meri-rp-'+hash({binding:f.binding,deliveryId:delivery(1)});
  if(operation==='manage_research_portfolio')assert.equal(p.request.parameters.idempotencyKey,expectedKey);
  else if(!['watch_research_portfolio','update_research_portfolio_change_state'].includes(operation))assert.equal(p.request.operationKey,expectedKey);
  assert.deepEqual(f.state.bodies[0].proposal.input,p.request);
  assert.deepEqual(await f.prepare(),prepared);assert.equal(f.state.prepares,1);
  assert.equal(assertPreparedResult('research-action',f.call.operation,prepared,f.binding,{scopes:f.scopes,nowMs:NOW}).reference,p.proposalId);
  const before=await f.list();assert.equal(before.intents[0].kind,'research_action');assert.equal(before.intents[0].result.proposalStatus,'proposed');
  await receiveIntentsResponse('list',200,JSON.stringify(before),{request:{conversationId:f.binding.conversationId}});
  const first=await f.decide(p);assert.equal(first.status,'research_action_decided');assert.equal(first.proposalStatus,'succeeded');assert.deepEqual(first.resultSummary,SUMMARY[operation]);
  await receiveIntentsResponse('decide',200,JSON.stringify(first),{request:f.decideRequest(p),proposal:p});
  await assert.rejects(receiveIntentsResponse('decide',200,JSON.stringify({...first,proposalStatus:'proposed'}),{request:f.decideRequest(p),proposal:p}));
  assert.equal(f.state.effects,1);const again=await f.decide(p);assert.equal(again.proposalStatus,'succeeded');assert.equal(f.state.effects,1);
  const after=await f.list();assert.equal(after.intents[0].result.proposalStatus,'succeeded');assert.deepEqual(after.intents[0].result.resultSummary,SUMMARY[operation]);
  await receiveIntentsResponse('list',200,JSON.stringify(after),{request:{conversationId:f.binding.conversationId}});
 }
});
test('lost preparation acknowledgement never repeats a Core proposal',async()=>{
 const f=setup();f.state.loseCreate=true;await assert.rejects(f.prepare(),{code:'UNKNOWN'});f.state.loseCreate=false;
 await assert.rejects(f.prepare(),{code:'UNKNOWN'});assert.equal(f.state.prepares,1);assert.equal(f.state.effects,0);
});
test('lost approval response remains unknown and a repeat observes the single effect',async()=>{
 const f=setup(),{proposal}=await f.prepare();f.state.loseApprove=true;await assert.rejects(f.decide(proposal),/APPROVAL_DECISION_UNKNOWN/);f.state.loseApprove=false;
 const retry=await f.decide(proposal);assert.equal(retry.proposalStatus,'succeeded');assert.equal(f.state.effects,1);
});
test('rejection dismisses without effect and carries no result summary',async()=>{
 const f=setup('manage_research_portfolio'),{proposal}=await f.prepare();
 const rejected=await f.decide(proposal,'rejected');assert.equal(rejected.proposalStatus,'dismissed');assert.equal(rejected.resultSummary,undefined);assert.equal(f.state.effects,0);
 await receiveIntentsResponse('decide',200,JSON.stringify(rejected),{request:f.decideRequest(proposal,'rejected'),proposal});
});
test('foreign client, model-supplied keys, altered digest, withheld scope and revoked rights refuse before any Core effect',async()=>{
 const foreign=setup('save_research_portfolio_output_to_client');
 await assert.rejects(foreign.prepare({...foreign.call,arguments:{...foreign.request,clientId:id(6)}}),{code:'ACCESS_DENIED'});assert.equal(foreign.state.prepares,0);
 const keyed=setup('manage_research_portfolio');
 await assert.rejects(keyed.prepare({...keyed.call,arguments:{...keyed.request,parameters:{expectedRevision:3,idempotencyKey:'mine'}}}),{code:'INVALID_ARGUMENTS'});assert.equal(keyed.state.prepares,0);
 const revoked=setup();revoked.state.scopeRevoked=true;await assert.rejects(revoked.prepare(),{code:'ACCESS_DENIED'});assert.equal(revoked.state.prepares,0);
 const f=setup(),{proposal}=await f.prepare();
 await assert.rejects(f.decide({...proposal,commandSha256:'0'.repeat(64)}),/INTENT_MISMATCH/);
 await assert.rejects(f.owner.decide({principal:{...f.principal,clientIds:[]},request:f.decideRequest(proposal)}),/INTENT_SCOPE_WITHHELD/);
 const withheld=await f.owner.list({principal:{...f.principal,clientIds:[]},request:{conversationId:f.binding.conversationId}});assert.equal(withheld.intents[0].withheld,true);
 await receiveIntentsResponse('list',200,JSON.stringify(withheld),{request:{conversationId:f.binding.conversationId}});
 assert.throws(()=>researchActionValidators.assertProposal({...proposal,oneTimeResult:{sharePath:'/share/'+'a'.repeat(64)}}));assert.equal(f.state.effects,0);
});
test('a general (private-user) conversation prepares with a null selected client',async()=>{
 const f=setup('watch_research_portfolio',{selected:false}),{proposal}=await f.prepare();assert.equal(proposal.scopes[0].kind,'private-user');
 assert.equal((await f.decide(proposal)).proposalStatus,'succeeded');
});
