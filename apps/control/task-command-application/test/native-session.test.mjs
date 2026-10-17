/** Existing opaque native session owner joined to task API; synthetic identity/current-policy/SQL/Core boundaries. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createActionSessionOwner} from '../../action-host/session/owner.mjs';
import {createTaskCommandSessionResolver} from '../native-session.mjs';
import {createTaskCommandApplication} from '../index.mjs';
import {commandComposition,id,canonicalSha256} from '../../intents/test/fixture.mjs';
async function setup(){
 const c=commandComposition({action:'task.update'}),state={revoked:false,revision:'current',issuances:0};
 const sessions=createActionSessionOwner({mode:'process-local',now:()=>c.f.state.now,limits:{maxSessions:2,maxRequestMs:1000,maxTtlMs:10000,maxFactBytes:65536},
  async verifyIdentity(){if(state.revoked)throw Error('membership revoked');return {principal:{tenantId:c.binding.tenantId,actorId:c.binding.actorId},identityRevision:'identity',checkedAtMs:c.f.state.now,expiresAtMs:c.f.state.now+20000};},
  async resolveContext({identity}){return {identitySha256:canonicalSha256(identity),binding:c.binding,scopes:[...c.scopes,{tenantId:c.binding.tenantId,kind:'client',resourceId:id(9),policyRevision:'p1'}],selectedClientId:id(9),contextRevision:state.revision,checkedAtMs:c.f.state.now,expiresAtMs:c.f.state.now+20000};}});
 const issued=await sessions.issue({identityCredential:'synthetic-native'});
 const resolver=createTaskCommandSessionResolver({sessions,commandOptions:c.commandOptions,selectedClientId:id(9),now:()=>c.f.state.now,
  async authorizeExecution({proposal,current}){state.issuances++;state.onIssue?.();return {credential:'synthetic',execution:{...c.f.execution,executorBinding:current.binding,proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:proposal.command.idempotencyKey}};}});
 const app=createTaskCommandApplication({now:()=>c.f.state.now,limits:{maxRequestMs:1000,maxRequestBytes:65536,maxResponseBytes:65536},resolveSession:resolver.resolve});
 const call=(intent,body,credential=issued.credential)=>app.handle(new Request('https://meri.invalid/api/task-commands/'+intent,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(body)}));
 return {...c,state,sessions,issued,resolver,call};
}
test('existing native opaque session prepares and executes only after separate approval, then revocation clears access',async()=>{
 const c=await setup();try{
  const response=await c.call('prepare',{arguments:{taskId:id(21),title:'Updated',status:'open'}});assert.equal(response.status,200);const {proposal}=await response.json();assert.equal(c.f.state.fetches,0);
  assert.notEqual((await c.call('execute',{proposal})).status,200);assert.equal(c.f.state.fetches,0);
  c.approve(proposal);assert.equal((await c.call('execute',{proposal})).status,200);assert.equal(c.f.state.fetches,1);
  c.state.revoked=true;assert.equal((await c.call('execute',{proposal})).status,401);assert.equal(c.f.state.fetches,1);
 }finally{c.sessions.close();}
});

test('revocation while issuing execution capability blocks Core dispatch',async()=>{
 const c=await setup();try{
  const {proposal}=await (await c.call('prepare',{arguments:{taskId:id(21),title:'Updated'}})).json();c.approve(proposal);
  c.state.onIssue=()=>{c.state.revoked=true;};
  const response=await c.call('execute',{proposal});assert.equal(response.status,502);
  assert.deepEqual(await response.json(),{error:{code:'REQUEST_FAILED',outcome:'NOT_DISPATCHED'}});
  assert.equal(c.state.issuances,1);assert.equal(c.f.state.fetches,0);
 }finally{c.sessions.close();}
});

test('revocation after metadata acknowledgement withholds proposal and reports stored outcome',async()=>{
 const c=await setup();try{
  c.hooks.prepare=async(value,owner)=>{const result=await owner.prepare(value);c.state.revoked=true;return result;};
  const response=await c.call('prepare',{arguments:{taskId:id(21),title:'Updated'}});assert.equal(response.status,403);
  assert.deepEqual(await response.json(),{error:{code:'ACCESS_DENIED',outcome:'STORED_NOT_RELEASED'}});
  assert.equal(c.metadataCalls.prepare,1);assert.equal(c.f.state.fetches,0);
 }finally{c.sessions.close();}
});

test('revocation after native effect withholds observed result and preserves known outcome',async()=>{
 const c=await setup();try{
  const {proposal}=await (await c.call('prepare',{arguments:{taskId:id(21),title:'Updated'}})).json();c.approve(proposal);
  c.f.state.fetchHook=async(_url,_options,native)=>{c.state.revoked=true;return new Response(JSON.stringify(native),{headers:{'content-type':'application/json'}});};
  const response=await c.call('execute',{proposal});assert.equal(response.status,403);
  assert.deepEqual(await response.json(),{error:{code:'ACCESS_DENIED',outcome:'RESULT_NOT_RELEASED'}});
  assert.equal(c.f.state.fetches,1);
 }finally{c.sessions.close();}
});
test('native token cannot replace opaque session; changed context and revoked sessions cannot mint execution capabilities',async()=>{
 for(const revoke of [c=>c.sessions.revoke(c.issued.credential),c=>{c.state.revision='changed';}]){
  const c=await setup();try{
   assert.equal((await c.call('prepare',{arguments:{taskId:id(21),title:'Updated'}},'synthetic-native')).status,401);
   const session=await c.resolver.resolve({credential:c.issued.credential,intent:'execute',deadlineMs:c.f.state.now+1000});
   const {proposal}=await c.preparer().prepare({arguments:{taskId:id(21),title:'Updated'}});revoke(c);
   await assert.rejects(session.authorizeExecution({proposal,deadlineMs:c.f.state.now+1000}));assert.equal(c.state.issuances,0);assert.equal(c.f.state.fetches,0);
  }finally{c.sessions.close();}
 }
});
