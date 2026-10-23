import test from 'node:test';
import assert from 'node:assert/strict';
import {createRunReadDelegation} from '../delegation.mjs';
import {composeDelegatedNativeCredentials} from '../native-credentials.mjs';
import {createReadDelegationCoreClient} from '../core-client.mjs';
import {delegationCoreFixture} from './fixture.mjs';
import {composeGeneralReadAllocation} from '../../../../gateway/budget/general-read-allocation.mjs';
import {GENERAL_READ_DEFAULT_RUN_BUDGETS} from '../../../../gateway/budget/general-read-manifest.mjs';
import {tokenRequest,assertCurrentReceipt} from '../contract.mjs';
const uuid=d=>`${d.repeat(8)}-${d.repeat(4)}-4${d.repeat(3)}-8${d.repeat(3)}-${d.repeat(12)}`;
const now=()=>1800000000000,policyRevision='9'.repeat(64),a=uuid('a'),b=uuid('d');
const binding={tenantId:uuid('b'),actorId:uuid('c'),conversationId:uuid('1'),runId:uuid('2'),attemptId:uuid('3'),workerId:uuid('4'),writerFence:1};
const principal={tenantId:binding.tenantId,actorId:binding.actorId},scopes=[{...principal,kind:'private-user',resourceId:binding.actorId,policyRevision}].map(({actorId,...scope})=>scope);
const operation={id:'search_tracked_bills',version:'0.2.0'},origin='https://core.example.invalid';
function fixture(){
 const core=delegationCoreFixture({now,binding,clientId:null,runDeadlineMs:now()+1800000,principal,reservations:new Map(),liveBearers:new Set(['SYNTHETIC_LIVE']),authority:async()=>{throw Error('no bearer fallback');},tools:async()=>Response.json({})});
 core.state.clientIds=[a,b];
 const client=createReadDelegationCoreClient({origin,now,enabled:true,fetchImpl:core.fetchImpl,getServiceSecret:async()=>'SYNTHETIC_SERVICE'});
 const allocation=composeGeneralReadAllocation({run:{...principal,conversationId:binding.conversationId,runId:binding.runId},operations:[operation],runBudgets:GENERAL_READ_DEFAULT_RUN_BUDGETS,catalogSha256:'c'.repeat(64),scheduleRevision:'d'.repeat(64),expiresAt:new Date(now()+1800000).toISOString()}).allocation;
 const delegation=createRunReadDelegation({binding,scopes,allocationJson:JSON.stringify(allocation),runDeadlineMs:now()+1800000,client,now,liveCredentialFor:async()=>({credential:'SYNTHETIC_LIVE',expiresAtMs:now()+60000})});
 const credentials=composeDelegatedNativeCredentials({delegation,client,now});
 const handle=(callKey,targetClientId)=>credentials.getNativeCredential({callKey,targetClientId,deadlineMs:now()+3000});
 return {core,client,delegation,credentials,handle};
}
test('General v2 uses explicit server origin and per-call targets, preserving independent current client walls',async()=>{
 const f=fixture(),first=await f.handle('a',a),second=await f.handle('b',b);
 const current=await f.credentials.coreAuthority.readCurrent({credential:first.credential,deadlineMs:now()+3000});
 assert.deepEqual(current.clientIds,[a,b]);
 const context=await f.credentials.coreAuthority.readConversation({credential:first.credential,conversationId:binding.conversationId,clientId:null,deadlineMs:now()+3000});
 assert.equal(context.selectedClientId,null);
 assert.equal([...f.core.state.delegations.values()][0].request.scopeKind,'general');
 assert.equal([...f.core.state.delegations.values()][0].request.schemaVersion,2);
 assert.notEqual(first.credential,second.credential);
 await assert.rejects(f.handle('a',b),/ACCESS_DENIED/);
 await assert.rejects(f.handle('a',null),/ACCESS_DENIED/);
 f.core.state.clientIds=[b];
 await assert.rejects(f.credentials.coreAuthority.readCurrent({credential:first.credential,deadlineMs:now()+3000}));
 assert.deepEqual((await f.credentials.coreAuthority.readCurrent({credential:second.credential,deadlineMs:now()+3000})).clientIds,[b]);
});
test('legacy clientless conversation cannot obtain a General delegation and has no bearer fallback',async()=>{
 const f=fixture();f.core.state.generalEligible=false;await assert.rejects(f.handle('a',a));
 assert.equal(f.core.state.delegations.size,0);
 assert.throws(()=>composeDelegatedNativeCredentials({delegation:f.delegation,client:f.client,now,fallback:{coreAuthority:{origin},getNativeCredential:async()=>({credential:'SYNTHETIC_LIVE'})}}),/CONFIGURATION/);
});
test('current receipt binds v2 kind, origin owner, exact target and current roster',()=>{
 const receipt={schemaVersion:2,scopeKind:'general',targetClientId:a,delegationId:uuid('5'),principal,identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),actorRole:'standard_user',clientIds:[a,b],checkedAtMs:now(),expiresAtMs:now()+1000,conversation:{conversationId:binding.conversationId,selectedClientId:null,scopeKind:'general',contextRevision:'c'}};
 const facts={delegationId:receipt.delegationId,binding,clientId:null,targetClientId:a,conversation:true,started:now(),now};
 assert.equal(assertCurrentReceipt(receipt,facts).targetClientId,a);
 for(const mutate of [r=>r.schemaVersion=1,r=>r.scopeKind='client',r=>r.targetClientId=b,r=>r.principal={...principal,actorId:uuid('6')},r=>r.clientIds=[b],r=>r.conversation.scopeKind='prospect',r=>r.conversation.selectedClientId=a]){
  const wrong=structuredClone(receipt);mutate(wrong);assert.throws(()=>assertCurrentReceipt(wrong,facts));
 }
});
test('General null target only admits current and passive memory, never client reads or proposals',()=>{
 const request={schemaVersion:2,targetClientId:null,kind:'tool',callKey:'memory',path:'/api/clio/tools/search_memory',bodySha256:'a'.repeat(64),operation:{id:'search_memory',version:'0.2.0'},argumentsSha256:'b'.repeat(64),correlationSha256:'c'.repeat(64)};
 assert.equal(tokenRequest(request).targetClientId,null);
 assert.throws(()=>tokenRequest({...request,operation,path:'/api/clio/tools/search_tracked_bills',correlationSha256:undefined}));
 assert.throws(()=>tokenRequest({...request,operation:{id:'memory.list_own_proposals',version:'0.1.0'},path:'/api/clio/tools/memory.list_own_proposals'}));
});
