/** Synthetic Core and journal boundaries; real preparation, decision/history and wire validators. No deployed acceptance. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createWatchCoreClient} from '../../../runtime/native-authority/watch-client.mjs';
import {createWatchPreparer} from '../watch-preparer.mjs';
import {createIntentApprovalOwner} from '../approval.mjs';
import {watchValidators,validateShape,resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
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
const operation='watch_action';
function watchBinding(request){return hash({family:request.family,clientId:request.clientId,targetKind:request.targetKind,targetKey:request.targetKey,operation:request.operation,expectedVersion:request.expectedVersion});}
function setup(){
 const binding={...seedBinding,tenantId:id(80),actorId:id(81)},clientId=id(5),scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:clientId,policyRevision:'p1'}];
 const request={family:'legiwatch_keyword',clientId,targetKind:'keyword_rule',targetKey:'rule-1',operation:'pause',expectedVersion:4,sourceRevision:null,reason:null,enabled:null};
 const state={paths:[],prepares:0,effects:0,loseCreate:false,loseDecide:false,scopeRevoked:false,proposal:null,corrupt:false};
 const client=createWatchCoreClient({origin:'https://core.invalid',now:()=>NOW,getServiceSecret:async()=>'synthetic-service',reservedCredentials:async()=>new Set(),getCredentials:async()=>({credential:'synthetic-attended',expiresAtMs:NOW+60000}),async fetchImpl(url,init){
  const path=new URL(url).pathname,body=JSON.parse(init.body);state.paths.push(path);
  assert.equal(init.headers.authorization,'Bearer synthetic-attended');assert.equal(init.headers['x-internal-service-secret'],'synthetic-service');assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');assert.ok(Number(init.headers['x-meri-deadline-at'])>NOW);
  if(path.endsWith('/prepare_watch_action')){state.prepares++;state.proposal={version:'0.1.0',proposalId:id(10),status:'proposed',request:body.request,context:{...body.context,identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64)},createdAt:new Date(NOW).toISOString(),expiresAt:new Date(NOW+50000).toISOString(),receipt:null};if(state.loseCreate)throw Error('lost prepare');}
  if(path.endsWith('/decide_watch_action')){if(state.proposal.status==='proposed'){
   if(body.decision==='rejected')state.proposal.status='dismissed';else {state.effects++;state.proposal.status='succeeded';state.proposal.receipt={request:state.proposal.request,owner:request.family,binding:watchBinding(request),operation:request.operation,targetKey:request.targetKey,identity:'rule-1',state:'paused',version:5,deliveryEnabled:false,eventId:null,alreadyInState:false};}
   if(state.loseDecide)throw Error('lost outcome');}
  }
  if(path.endsWith('/inspect_watch_state'))return Response.json({version:'0.1.0',state:{family:body.target.family,clientId:body.target.clientId,targetKind:body.target.targetKind,targetKey:body.target.targetKey,identity:'rule-1',state:'paused',version:4,deliveryEnabled:false,facts:{folderCount:2}}});
  const response=structuredClone(state.proposal);if(state.corrupt)response.request.targetKey='rule-2';if(state.corruptTime)response.expiresAt=new Date(NOW+55000).toISOString();return Response.json(response);
 }});
 const preparer=createWatchPreparer({binding,scopes,selectedClientId:clientId,client,now:()=>NOW,deadlineMs:NOW+60000,policyRevision:'p1',currentRights:async()=>({scopes:state.scopeRevoked?[]:scopes,expiresAtMs:NOW+60000})});
 const m=mount({binding,scopes,preparers:[preparer]}),principal={tenantId:binding.tenantId,actorId:binding.actorId,clientIds:[clientId]};
 const owner=createIntentApprovalOwner({journal:m.store.port,watch:{read:client.read,decide:client.decide},now:()=>NOW,limits:{maxRequestMs:5000},enabled:true});
 const call={operation:{id:operation,version:'0.2.0'},arguments:request,deliveryId:delivery(1)};
 const decideRequest=(p,decision='approved')=>({conversationId:binding.conversationId,deliveryId:delivery(1),proposalId:p.proposalId,commandSha256:p.commandSha256,decision});
 return {state,binding,scopes,request,call,client,owner,principal,store:m.store,decideRequest,prepare:()=>m.mount.prepare(call),prepareWith:(args,n)=>m.mount.prepare({...call,arguments:args,deliveryId:'sdk:'+String(n).padStart(64,'0')}),list:()=>owner.list({principal,request:{conversationId:binding.conversationId}}),decide:(p,decision='approved')=>owner.decide({principal,request:decideRequest(p,decision)})};
}
test('canonical intent mount prepares once and explicit approval records the owner receipt once',async()=>{
 const f=setup(),prepared=await f.prepare(),p=prepared.proposal;
 assert.equal(f.state.effects,0);assert.deepEqual(await f.prepare(),prepared);assert.equal(f.state.prepares,1);
 assert.equal(assertPreparedResult('watch',f.call.operation,prepared,f.binding,{scopes:f.scopes,nowMs:NOW}).reference,p.proposalId);
 assert.equal((await f.list()).intents[0].result.status,'proposed');
 const result=await f.decide(p);assert.equal(f.state.effects,1);
 await receiveIntentsResponse('decide',200,JSON.stringify(result),{request:f.decideRequest(p),proposal:p});
 await f.decide(p);assert.equal(f.state.effects,1);assert.equal(f.state.prepares,1);
 const history=await f.list();assert.equal(history.intents[0].result.status,'succeeded');
 const receipt=history.intents[0].result.receipt;assert.equal(receipt.targetKey,'rule-1');assert.equal(receipt.operation,'pause');assert.equal(receipt.state,'paused');
 watchValidators.receipt(receipt,p.request);
});
test('lost prepare acknowledgement stays UNKNOWN without another POST',async()=>{
 const f=setup();f.state.loseCreate=true;await assert.rejects(f.prepare());assert.equal(f.state.prepares,1);
 const before=f.state.paths.filter(p=>p.endsWith('/prepare_watch_action')).length;await assert.rejects(f.prepare());
 assert.equal(f.state.paths.filter(p=>p.endsWith('/prepare_watch_action')).length,before);
});
test('lost effect acknowledgement is recovered by read without re-dispatch',async()=>{
 const f=setup(),{proposal}=await f.prepare(),p=proposal;f.state.loseDecide=true;await assert.rejects(f.decide(p));
 const before=f.state.paths.filter(p=>p.endsWith('/decide_watch_action')).length;f.state.loseDecide=false;
 const history=await f.list();assert.equal(history.intents[0].result.status,'succeeded');
 assert.equal(f.state.paths.filter(p=>p.endsWith('/decide_watch_action')).length,before);assert.equal(f.state.effects,1);
});
test('rejected decision dispatches no owner effect',async()=>{
 const f=setup(),{proposal}=await f.prepare();await f.decide(proposal,'rejected');
 assert.equal(f.state.effects,0);assert.equal((await f.list()).intents[0].result.status,'dismissed');
});
test('inspect reads owner state without preparing or deciding anything',async()=>{
 const f=setup();
 const target={family:'legiwatch_keyword',clientId:id(5),targetKind:'keyword_rule',targetKey:'rule-1'};
 const observed=await f.client.inspect({binding:f.binding,selectedClientId:id(5),target,deadlineMs:NOW+10000});
 assert.equal(observed.state.state,'paused');assert.equal(observed.state.identity,'rule-1');
 assert.deepEqual(f.state.paths,['/api/clio/tools/inspect_watch_state']);
 assert.equal(f.state.prepares,0);assert.equal(f.state.effects,0);
});
test('a foreign selector, an injected requestKey or a tampered digest is refused',async()=>{
 const f=setup();
 const foreign={...f.request,clientId:id(9)};
 await assert.rejects(createWatchPreparer({binding:f.binding,scopes:f.scopes,selectedClientId:id(5),client:f.client,now:()=>NOW,deadlineMs:NOW+60000,policyRevision:'p1',currentRights:async()=>({scopes:f.scopes,expiresAtMs:NOW+60000})}).prepare({arguments:foreign,deliveryId:delivery(1)}));
 // The canonical proposal claim is server-derived: a requestKey in the model's own
 // arguments is refused by the preparer's closed normalization, before any POST.
 const injected=createWatchPreparer({binding:f.binding,scopes:f.scopes,selectedClientId:id(5),client:f.client,now:()=>NOW,deadlineMs:NOW+60000,policyRevision:'p1',currentRights:async()=>({scopes:f.scopes,expiresAtMs:NOW+60000})});
 const before=f.state.paths.length;
 await assert.rejects(injected.prepare({arguments:{...f.request,requestKey:'meri-watch-injected'},deliveryId:delivery(2)}));
 assert.equal(f.state.paths.length,before);
 const {proposal}=await f.prepare();
 await assert.rejects(f.client.read({proposal:{...proposal,commandSha256:'f'.repeat(64)}}));
});
test('catalog maps one prepare-only operation',async()=>{
 const f=setup(),p=await f.prepare(),c=resolveOperationContract(f.call.operation);
 c.assertOutput(p,{request:f.request});
 assert.throws(()=>assertPreparedResult('watch',f.call.operation,{status:'executed',proposal:p.proposal},f.binding,{scopes:f.scopes,nowMs:NOW}));
});

test('advertised model WatchInput accepts the preparer arguments and refuses a caller request key',()=>{
 const f=setup();validateShape('WatchInput',f.request);
 assert.throws(()=>validateShape('WatchInput',{...f.request,requestKey:'caller-request-key'}));
});
test('generated watch receiver enforces canonical family verb target and delivery constraints',async()=>{
 const f=setup();await f.prepare();const base=await f.list(),request={conversationId:f.binding.conversationId};
 await receiveIntentsResponse('list',200,JSON.stringify(base),{request});
 for(const changed of [
  {family:'client_watchlist',targetKind:'client_tracker_watchlist',operation:'unsubscribe'},
  {family:'defense_budget_target',targetKind:'pe',operation:'pause'},
  {targetKind:'prospect'},
  {operation:'set_delivery',enabled:null},
  {operation:'pause',enabled:true},
 ]){
  const value=structuredClone(base),item=value.intents[0];Object.assign(item.proposal.request,changed);
  const {commandSha256,...bound}=item.proposal;item.proposal.commandSha256=hash(bound);item.result.request=structuredClone(item.proposal.request);
  assert.throws(()=>watchValidators.request(item.proposal.request));
  await assert.rejects(receiveIntentsResponse('list',200,JSON.stringify(value),{request}));
 }
});
test('pre-call refusals settle FAILED and replay the same refusal without a Core call',async()=>{
 const f=setup();
 for(const [n,args,code] of [[7,{},'INVALID_ARGUMENTS'],[8,{...f.request,clientId:id(6)},'ACCESS_DENIED']]){
  await assert.rejects(f.prepareWith(args,n),{code});await assert.rejects(f.prepareWith(args,n),{code});
  assert.equal([...f.store.rows.values()].filter(r=>r.state==='FAILED').length,n-6);
 }
 assert.equal(f.state.prepares,0);
});
