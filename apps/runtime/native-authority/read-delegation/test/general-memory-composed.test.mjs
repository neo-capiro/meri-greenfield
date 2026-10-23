/** Real Meri delegation, credential relay, signed page adapter, mandatory helper and canonical output validators; synthetic Core wire only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {createClientKnowledgeFixture} from '../../../../gateway/sources/client-knowledge/test/fixtures.mjs';
import {createSignedMemoryHttpAdapter} from '../../../../gateway/sources/client-knowledge/memory-signed-http-adapter.mjs';
import {createClientKnowledgeReadHandler} from '../../../../gateway/sources/client-knowledge/handler.mjs';
import {createRetainedReadCredentialRelay} from '../../retained-read-credential-relay.mjs';
import {createRunReadDelegation} from '../delegation.mjs';
import {composeDelegatedNativeCredentials} from '../native-credentials.mjs';
import {createReadDelegationCoreClient} from '../core-client.mjs';
import {composeGeneralReadAllocation} from '../../../../gateway/budget/general-read-allocation.mjs';
import {GENERAL_READ_DEFAULT_RUN_BUDGETS} from '../../../../gateway/budget/general-read-manifest.mjs';
import {delegationCoreFixture} from './fixture.mjs';
const origin='https://core.synthetic.invalid',callKey='owned_general_memory';
function fixture(){
 const f=createClientKnowledgeFixture('search_memory'),now=()=>f.state.now,policy='a'.repeat(64),binding=f.binding;
 for(const value of [f.claims,f.subject,f.authority,f.authority.decision,...f.claims.scopes,...f.subject.scopes,...f.authority.decision.scopes])value.policyRevision=policy;
 const deadline=now()+10000,allocation=composeGeneralReadAllocation({run:{tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId},operations:[f.operation],runBudgets:GENERAL_READ_DEFAULT_RUN_BUDGETS,assumptions:[{id:'rerankDisabled',configKey:'RETRIEVAL_RERANK_ENABLED',configValue:'false',coreSourceCommit:'a'.repeat(40),coreImageDigest:'sha256:'+'b'.repeat(64),configurationSha256:'c'.repeat(64)}],catalogSha256:'c'.repeat(64),scheduleRevision:'d'.repeat(64),expiresAt:new Date(deadline).toISOString()}).allocation;
 const principal={tenantId:binding.tenantId,actorId:binding.actorId},wire=[],control={afterPage:null,afterHelper:null,mutateResult:null};
 const reservations=new Map([[callKey,{state:'UNKNOWN',run_id:binding.runId,operation:f.operation,arguments_sha256:hash(f.input())}]]);
 const core=delegationCoreFixture({now,binding,clientId:null,runDeadlineMs:deadline,principal,reservations,liveBearers:new Set(['SYNTHETIC_LIVE']),authority:async()=>assert.fail('no bearer fallback'),
  async tools(url,init){wire.push({url,init});const body=JSON.parse(init.body);
   if(url.endsWith('/search_memory')){const page=f.page(body.input);control.mutateResult?.(page);control.afterPage?.();return Response.json(page,{headers:{'x-meri-memory-page-proof':'SYNTHETIC_BOUND_PAGE_PROOF'}});}
   assert.ok(url.endsWith('/search_memory_eligibility'));const result=f.eligibility({...body,deadlineMs:Math.min(body.deadlineMs,now()+5000)});control.afterHelper?.();return Response.json(result);
  }});
 const client=createReadDelegationCoreClient({origin,now,enabled:true,fetchImpl:core.fetchImpl,getServiceSecret:async()=>'SYNTHETIC_SERVICE'});
 const delegation=createRunReadDelegation({binding,scopes:f.claims.scopes,allocationJson:JSON.stringify(allocation),runDeadlineMs:deadline,client,now,liveCredentialFor:async()=>({credential:'SYNTHETIC_LIVE',expiresAtMs:deadline})});
 const nativeCredentials=composeDelegatedNativeCredentials({delegation,client,now});
 const relay=createRetainedReadCredentialRelay({task:{binding,scopes:f.claims.scopes,grant:{qualificationBinding:{policyRevision:policy}},original:{binding,expiresAtMs:deadline},allocation,approvedReads:{operations:[f.operation]}},nativeCredentials,getServiceSecret:async()=>'SYNTHETIC_SERVICE',now});
 const adapter=createSignedMemoryHttpAdapter({endpoints:{search_memory:origin+'/api/clio/tools/search_memory'},getCredentials:relay,getEligibilityCredentials:relay.getMemoryEligibilityCredentials,fetchImpl:core.fetchImpl,now});
 const handler=createClientKnowledgeReadHandler({operation:f.operation,adapter,now}),limits=[];
 return {f,core,wire,control,delegation,execute:()=>handler({...f.call(),invocationId:callKey,limitReleaseDeadline:expiry=>limits.push(expiry)}),limits};
}
test('General signed memory uses v2 null-target origin, exact parent and one eligibility child without client provenance',async()=>{
 const x=fixture();const result=JSON.parse(await x.execute());assert.equal(result.subject.kind,'personal');assert.equal(result.result.records[0].payload.scope,'firm');assert.equal(x.wire.length,2);
 const d=[...x.core.state.delegations.values()][0];assert.equal(d.request.scopeKind,'general');assert.equal(d.clientId,null);
 const tokens=[...x.core.state.tokens.values()];assert.deepEqual(tokens.map(t=>t.kind),['tool','memory_eligibility']);assert.ok(tokens.every(t=>t.request.schemaVersion===2&&t.request.targetClientId===null&&t.consumed));
 assert.notEqual(tokens[0].token,tokens[1].token);assert.equal(x.limits.length,1);assert.equal(JSON.stringify(result).includes('SYNTHETIC_BOUND_PAGE_PROOF'),false);
});
test('General memory revocation before page, between page/helper and at helper release returns no result',async()=>{
 for(const stage of ['before','page','helper']){const x=fixture();if(stage==='before')x.core.state.memberActive=false;else x.control[stage==='page'?'afterPage':'afterHelper']=()=>{x.core.state.generalEligible=false;};await assert.rejects(x.execute());assert.equal(x.limits.length,0);assert.equal(x.wire.length,stage==='before'?0:stage==='page'?1:2);}
});
test('General signed parent containing client memory is refused before eligibility token issuance',async()=>{
 const x=fixture();x.control.mutateResult=p=>{p.records[0].payload.scope='client';p.records[0].payload.clientId=x.f.clientId;p.records[0].entityRef={type:'client',id:x.f.clientId};p.results[0].clientId=x.f.clientId;};
 await assert.rejects(x.execute());assert.equal(x.wire.length,1);assert.equal([...x.core.state.tokens.values()].filter(t=>t.kind==='memory_eligibility').length,0);
});
