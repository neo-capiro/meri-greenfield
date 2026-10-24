import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createConversationIdentity} from '../conversation-identity.mjs';
import {createActionSessionOwner} from '../../control/action-host/session/owner.mjs';
import {createCoreMembershipGate} from '../../control/product-access/core-membership.mjs';
import {createInitialRunBindingJournal} from '../../control/conversations/initial-run-binding-journal.mjs';
import {initialInputFixture} from '../../control/conversations/test/initial-input-fixture.mjs';
import {binding,id,versions} from '../../control/conversations/test/application-fixture.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {receiveConversationInitialInputRequest,receiveConversationInitialInputResponse} from '../../../packages/contracts/dist/conversation-initial-input.mjs';
import {assertInputContext,expectedContext} from '../../../packages/contracts/conversation-input/semantics.mjs';
import {assertOriginalInputFacts} from '../../control/conversations/initial-input-facts.mjs';

const conversationId=id(710),clientId=id(5),policyRevision='general-policy',origin='https://core.synthetic.invalid';
const bytes=v=>new TextEncoder().encode(JSON.stringify(v));
function fixture(change={}){
 const f=initialInputFixture(),now=f.now,store=f.store();let serial=720;
 const state={status:200,receipt:{},calls:[],...change};
 const fetchImpl=async(url,options)=>{
  state.calls.push({url:String(url),body:JSON.parse(options.body),authorization:options.headers.authorization});
  assert.equal(new URL(url).pathname,'/api/clio/application-authority/current');
  if(state.status!==200)return Response.json({error:'denied'},{status:state.status});
  if(state.resolve)return state.resolve(JSON.parse(options.body),options.headers.authorization);
  return Response.json({principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64),
   role:'standard_user',permissions:[],clientIds:[],conversationId,selectedClientId:null,checkedAtMs:now(),expiresAtMs:now()+120000,...state.receipt});
 };
 const initialBindings=createInitialRunBindingJournal({pool:f.pool,now,newId:()=>id(serial++)});
 const identity=createConversationIdentity({store,identity:{origin,fetchImpl,},
  qualification:{policyRevision},now,limits:{maxRequestMs:3000,maxFactBytes:131072},initialBindings,
  nextRunOwner:{async selectRun(){assert.fail('No successor before the first input');},async currentRun(){assert.fail('No successor before the first input');}},
  configurationSha256:'a'.repeat(64),versions,proposeInitialExpiry:()=>now()+900000,factWindowMs:900000});
 const membership=createCoreMembershipGate({origin,fetchImpl,identityContext:identity,now,limits:{maxRequestMs:3000,maxFactBytes:262144}});
 const sessions=createActionSessionOwner({mode:'process-local',verifyIdentity:identity.verifyIdentity,resolveContext:identity.resolveContext,withAuthority:identity.withAuthority,membership:{admit:membership.admit,recheck:membership.recheck},now,
  limits:{maxSessions:10,maxRequestMs:3000,maxTtlMs:120000,maxFactBytes:131072},refusals(step,error){state.refusal={step,code:error.code,message:error.message,cause:error.reason};}});
 const issue=async()=>{try{return await sessions.issue({identityCredential:'original-user-bearer',hints:{conversationId,clientId:null}});}catch(error){throw new Error(JSON.stringify(state.refusal),{cause:error});}};
 return {...f,state,sessions,initialBindings,identity,issue};
}

test('one control configuration admits two tenants, two actors and their independently owned clients and General conversations',async()=>{
 const f=fixture(),actors=[{tenantId:'synthetic-tenant-a',actorId:'synthetic-actor-a'},{tenantId:'synthetic-tenant-b',actorId:'synthetic-actor-b'}];
 const records=actors.flatMap((principal,n)=>[id(810+n*10),id(811+n*10),null].map((selectedClientId,i)=>({principal,selectedClientId,conversationId:id(850+n*10+i),bearer:'Bearer synthetic-user-'+n})));
 const issued=[];
 f.state.resolve=(request,bearer)=>{
  const record=records.find(r=>r.conversationId===request.conversationId&&r.bearer===bearer&&r.selectedClientId===request.clientId);
  if(!record)return Response.json({error:'denied'},{status:403});
  return Response.json({principal:record.principal,conversationId:record.conversationId,selectedClientId:record.selectedClientId,identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64),role:'standard_user',permissions:[],clientIds:records.filter(r=>r.bearer===bearer&&r.selectedClientId!==null).map(r=>r.selectedClientId),checkedAtMs:f.now(),expiresAtMs:f.now()+120000});
 };
 try{
  for(const record of records){
   const input={identityCredential:record.bearer.slice(7),hints:{conversationId:record.conversationId,clientId:record.selectedClientId}};
   const session=await f.sessions.issue(input),authentication=await f.sessions.authenticateSession({credential:session.credential}),current=await f.sessions.readCurrentState({authentication});
   assert.equal(current.binding.tenantId,record.principal.tenantId);assert.equal(current.binding.actorId,record.principal.actorId);assert.equal(current.binding.conversationId,record.conversationId);
   assert.deepEqual(current.scopes,[{kind:record.selectedClientId===null?'private-user':'client',tenantId:record.principal.tenantId,resourceId:record.selectedClientId??record.principal.actorId,policyRevision}]);
   const duplicate=await f.sessions.issue(input);assert.equal(duplicate.context.runId,session.context.runId);f.sessions.revoke(duplicate.credential);
   issued.push({record,current,session});
  }
  assert.equal(f.bindings.length,6);assert.equal(new Set(issued.map(x=>x.current.binding.runId)).size,6);
  for(const record of records){
   const wrong=record.bearer==='Bearer synthetic-user-0'?'synthetic-user-1':'synthetic-user-0';
   await assert.rejects(f.sessions.issue({identityCredential:wrong,hints:{conversationId:record.conversationId,clientId:record.selectedClientId}}));
   await assert.rejects(f.sessions.issue({identityCredential:record.bearer.slice(7),hints:{conversationId:record.conversationId,clientId:id(999)}}));
  }
  assert.equal(f.bindings.length,6,'foreign requests create no new durable originals');
  const a=issued[0],b=issued[3];
  assert.throws(()=>f.sessions.nativeCredentialFor({binding:{...a.current.binding,actorId:b.current.binding.actorId},selectedClientId:a.record.selectedClientId}));
  assert.throws(()=>f.sessions.nativeCredentialFor({binding:{...a.current.binding,tenantId:b.current.binding.tenantId},selectedClientId:a.record.selectedClientId}));
 }finally{f.sessions.close();}
});

test('an in-flight Core observation refresh cannot change its principal or conversation scope',async t=>{
 let elapsed=0;t.mock.method(performance,'now',()=>elapsed);
 for(const change of [{principal:{tenantId:'other-tenant',actorId:binding.actorId}},{principal:{tenantId:binding.tenantId,actorId:'other-actor'}},{conversationId:id(999)},{selectedClientId:clientId,clientIds:[clientId]}]){
  const f=fixture();elapsed=0;
  try{await assert.rejects(f.identity.withAuthority({credential:'original-user-bearer',hints:{conversationId,clientId:null},deadlineMs:f.now()+30000},async()=>{
   await f.identity.readMembership();f.state.receipt=change;elapsed=20001;await f.identity.readMembership();
  }));assert.equal(f.bindings.length,0);}finally{f.sessions.close();}
 }
});

test('General session uses real current owner and durable original; empty client roster is not admission by itself',async()=>{
 const f=fixture();try{
  const issued=await f.issue();assert.equal(issued.context.selectedClientId,null);assert.equal(f.state.calls.length,1);
  assert.deepEqual(f.state.calls[0].body,{conversationId,clientId:null});assert.equal(f.state.calls[0].authorization,'Bearer original-user-bearer');
  const authentication=await f.sessions.authenticateSession({credential:issued.credential});
  const current=await f.sessions.readCurrentState({authentication});
  assert.deepEqual(current.scopes,[{kind:'private-user',tenantId:binding.tenantId,resourceId:binding.actorId,policyRevision}]);
  assert.equal(f.bindings.length,1);assert.equal(f.bindings[0].record.selectedClientId,null);
  assert.equal(f.sessions.nativeCredentialFor({binding:current.binding,selectedClientId:null}).credential,'original-user-bearer');
  const duplicate=await f.issue();assert.equal(duplicate.context.runId,issued.context.runId);assert.equal(f.bindings.length,1);
  f.state.status=403;await assert.rejects(f.sessions.authenticateSession({credential:issued.credential}));
  await assert.rejects(f.sessions.authenticateSession({credential:duplicate.credential}));
  assert.throws(()=>f.sessions.nativeCredentialFor({binding:current.binding,selectedClientId:null}));
 }finally{f.sessions.close();}
});

for(const [name,change] of [
 ['Core membership refusal',{status:403}],['unavailable Core',{status:503}],
 ['foreign owned conversation',{receipt:{conversationId:id(799)}}],
 ['client-bound conversation',{receipt:{selectedClientId:clientId,clientIds:[clientId]}}],['expired current receipt',{receipt:{expiresAtMs:1}}],
])test(`General ${name} cannot claim a binding or issue a session`,async()=>{
 const f=fixture(change);try{await assert.rejects(f.issue());assert.equal(f.bindings.length,0);assert.equal(f.sessions.status().sessions,0);}finally{f.sessions.close();}
});

test('General original input is persisted and public-correlated to the exact actor-private scope',async()=>{
 const f=initialInputFixture();f.advance(Date.now()-f.now());const scopes=[{kind:'private-user',tenantId:binding.tenantId,resourceId:binding.actorId,policyRevision}];
 const p=await f.proposal({context:{scopes,selectedClientId:null}}),store=f.store();
 const allocated=await store.initialInputs.claim(p.facts,()=>{});
 const context={tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId,clientId:null};
 const request=receiveConversationInitialInputRequest(bytes(p.input));
 const response=await receiveConversationInitialInputResponse(200,bytes({allocation:allocated.allocation,state:allocated.state,created:allocated.created}),request,context,{now:f.now});
 assert.equal(response.allocation.selectedClientId,null);
 await store.initialInputs.accept(p.acceptance,()=>{});
 const saved=await store.read(binding,{after:0,limit:1},()=>{});assert.deepEqual(saved.run.scopes,scopes);
 assertInputContext(saved,expectedContext(context));
 for(const mutate of [v=>v.scopes[0].resourceId='other',v=>v.scopes[0].kind='client',v=>v.scopes.push({...scopes[0],kind:'tenant'}),v=>delete v.selectedClientId]){
  const bad=structuredClone(p.facts);mutate(bad);assert.throws(()=>assertOriginalInputFacts(bad));
 }
 assert.throws(()=>assertInputContext(saved,expectedContext({...context,actorId:'other'})));
 assert.throws(()=>assertInputContext(saved,expectedContext({...context,clientId})));
 assert.equal(hash(saved.run.binding),hash(binding));
});
