/** Real session owner, current-run selector and forwarder; synthetic history/Core ports. */
import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createActionSessionOwner} from '../../../control/action-host/session/owner.mjs';
import {currentDocumentSession} from '../../artifacts/selected-documents.mjs';
import {createCoreApprovalForwarder,CORE_APPROVAL_ROUTES} from '../approval-forwarder.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function fixture(){
 const source={tenantId:id(1),actorId:id(2),conversationId:id(3),runId:id(4),attemptId:id(5),workerId:id(6),writerFence:1};
 const scopes=[{tenantId:source.tenantId,kind:'client',resourceId:id(7),policyRevision:'test-policy'}],principal={tenantId:source.tenantId,actorId:source.actorId};
 const command={contractVersion:'0.2.0',commandId:id(8),binding:source,action:'document.draft',arguments:{preparationSha256:'a'.repeat(64),artifactRequestSha256:'b'.repeat(64),sourceContextSha256:'c'.repeat(64),baseVersionId:null,title:'Selected document',format:'docx'},attachments:[],scopes,idempotencyKey:'synthetic-selected-document'};
 const state={clock:Date.parse('2026-10-24T12:00:00Z'),context:{binding:source,scopes,selectedClientId:id(7)},revoked:false,requests:[],latest:{binding:source,scopes,state:'completed'},pendingTurn:null,secretHook:null,responseHook:null};
 const now=()=>state.clock,proposal={proposalId:id(9),command,commandSha256:hash(command),createdAt:new Date(now()).toISOString(),expiresAt:new Date(now()+600000).toISOString(),requiredApprover:principal};
 const sessions=createActionSessionOwner({mode:'process-local',now,limits:{maxSessions:8,maxRequestMs:3000,maxTtlMs:1000,maxFactBytes:65536},
  async verifyIdentity({credential}){if(state.revoked||!['synthetic-original','synthetic-current'].includes(credential))throw Error('REFUSED');return {principal:{tenantId:state.context.binding.tenantId,actorId:state.context.binding.actorId},identityRevision:'fixture',checkedAtMs:now(),expiresAtMs:now()+60000};},
  async resolveContext({identity}){if(state.revoked)throw Error('REFUSED');return {...structuredClone(state.context),identitySha256:hash(identity),contextRevision:'fixture',checkedAtMs:now(),expiresAtMs:now()+60000};}});
 const original=await sessions.issue({identityCredential:'synthetic-original'});state.clock+=1001;
 const target={...source,runId:id(20),attemptId:id(21),workerId:id(22),writerFence:2};state.latest={binding:target,scopes,state:'completed'};state.context={...state.context,binding:target};
 const current=await sessions.issue({identityCredential:'synthetic-current'}),store={history:{async transcript(){return {latestRun:structuredClone(state.latest),pendingTurn:state.pendingTurn};}}};
 const decision={proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,decision:'approved',approver:principal,decidedAt:new Date(now()).toISOString(),expiresAt:proposal.expiresAt,policyRevision:scopes[0].policyRevision};
 const forwarder=createCoreApprovalForwarder({origin:'https://core.synthetic.invalid',nativeCredentials:sessions,now,maxRequestMs:3000,readProposal:async()=>structuredClone(proposal),
  selectDocumentBinding:async({proposal,signal,deadlineMs})=>{const s=await currentDocumentSession({store,sessions,now,proposal,signal,check:()=>{signal?.throwIfAborted();if(now()>=deadlineMs)throw Error('DEADLINE');}});return {binding:s.binding,selectedClientId:s.selectedClientId};},
  getServiceSecret:async()=>{await state.secretHook?.();return 'synthetic-service-secret';},
  fetchImpl:async(url,init)=>{state.requests.push({url,headers:init.headers,body:JSON.parse(init.body)});await state.responseHook?.();return new Response(JSON.stringify({decision,revoked:url.endsWith('/revoke'),checkedAtMs:0}),{headers:{'content-type':'application/json'}});}});
 const selection={proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,binding:source};
 return {source,target,scopes,principal,state,sessions,original,current,proposal,forwarder,selection,now,record:()=>forwarder.record({proposal,decision:'approved',approver:principal,binding:source}),close:()=>sessions.close()};
}
test('expired original session and later canonical current session approve/read/revoke the original document proposal',async()=>{
 const f=await fixture();try{
  assert.throws(()=>f.sessions.nativeCredentialFor({binding:f.source,selectedClientId:id(7)}));
  assert.equal((await f.record()).decision.proposalId,f.proposal.proposalId);await f.forwarder.decision(f.selection);await f.forwarder.revoke({...f.selection,approver:f.principal});
  assert.equal(f.state.requests.length,3);assert.deepEqual(f.state.requests.map(r=>new URL(r.url).pathname),[CORE_APPROVAL_ROUTES.record,CORE_APPROVAL_ROUTES.decision,CORE_APPROVAL_ROUTES.revoke]);
  for(const r of f.state.requests){assert.equal(r.headers.authorization,'Bearer synthetic-current');assert.deepEqual(r.body.binding,f.source);assert.equal(r.headers['x-internal-service-secret'],'synthetic-service-secret');}
 }finally{f.close();}
});
for(const change of ['foreign tenant','foreign actor','foreign conversation','foreign client','missing','revoked','expired','cancelled','pending','older fence'])test(`document approval refuses ${change} current session/run before Core`,async()=>{
 const f=await fixture();try{
  if(change==='foreign tenant')f.state.latest.binding.tenantId=id(90);
  if(change==='foreign actor')f.state.latest.binding.actorId=id(90);
  if(change==='foreign conversation')f.state.latest.binding.conversationId=id(90);
  if(change==='foreign client')f.state.latest.scopes=[{...f.scopes[0],resourceId:id(90)}];
  if(change==='missing')f.state.latest.binding.runId=id(90);
  if(change==='revoked')f.sessions.revoke(f.current.credential);
  if(change==='expired')f.state.clock+=1001;
  if(change==='cancelled')f.state.latest.state='cancelled';if(change==='pending')f.state.pendingTurn={};
  if(change==='older fence')f.state.latest.binding.writerFence=0;
  await assert.rejects(f.record());assert.equal(f.state.requests.length,0);
 }finally{f.close();}
});
for(const phase of ['secret','response'])test(`current run changes during ${phase} await cannot release a document decision`,async()=>{
 const f=await fixture();try{f.state[phase==='secret'?'secretHook':'responseHook']=()=>{f.state.latest.binding.runId=id(90);};await assert.rejects(f.record());assert.equal(f.state.requests.length,phase==='secret'?0:1);}finally{f.close();}
});
