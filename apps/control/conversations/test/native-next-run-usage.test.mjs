/** Canonical native journal -> service -> accounting, scripted SQL only. */
import test from 'node:test';import assert from 'node:assert/strict';
import {nativeFixture,binding,scopes,id,check,rowKey} from './native-next-run-fixture.mjs';
import {createConversationService} from '../service.mjs';
import {sdkUsageSnapshot} from '../usage.mjs';
import {hash} from '../boundary.mjs';
import {versions} from './lifecycle-fixture.mjs';
const payload=(inputTokens=150,sessionId=id(800))=>({usage:sdkUsageSnapshot({type:'result',session_id:sessionId,total_cost_usd:inputTokens/1000,modelUsage:{'us.anthropic.claude-sonnet-4-6':{inputTokens,outputTokens:20,cacheReadInputTokens:200,cacheCreationInputTokens:40,webSearchRequests:0,costUSD:inputTokens/1000,provider:'bedrock',costBasis:'list'}}}),toolsUsed:{tools:[],omitted:0}});
async function fixture(){const x=await nativeFixture();await x.running(binding);x.seed(binding);await x.f.store.recordUsage({binding,scopes,input:payload(100)},check);await x.f.store.append(binding,x.status('completed'),check);await x.settle(binding);
 const target=(await x.select()).binding;await x.accept(target);await x.running(target);const now=Date.now();
 const sessions={async authenticateSession(){return {principal:{tenantId:target.tenantId,actorId:target.actorId,conversationId:target.conversationId,runId:target.runId},checkedAtMs:now,expiresAtMs:now+30000};},async readCurrentState({authentication}){return {authenticationSha256:hash(authentication),binding:target,scopes,selectedClientId:id(5),checkedAtMs:now,expiresAtMs:now+30000};}};
 const service=createConversationService({sessions,store:x.f.store,dispatcher:{start:async()=>{},cancel:async()=>{}},versions,now:()=>now});
 return {...x,target,service,parent:()=>x.f.state.runs.get(rowKey(binding)),current:()=>x.f.state.runs.get(rowKey(target)),record:(input=payload())=>service.recordUsage({credential:'synthetic-current-target',binding:target,input})};
}
test('native service charges cumulative delta50000 after first100000, exactly once across replay',async()=>{const x=await fixture();try{
 assert.equal(x.parent().sdk_charge_micro_usd,100000);assert.deepEqual(await x.record(),{status:'recorded',reason:null,replayed:false});assert.equal(x.current().sdk_charge_micro_usd,50000);assert.equal(x.current().sdk_usage.parentRunId,binding.runId);
 assert.equal((await x.record()).replayed,true);await assert.rejects(x.record(payload(151)),/SDK_USAGE_REPLAY_REFUSED/);assert.equal(x.current().sdk_charge_micro_usd,50000);
 }finally{x.f.close();}});
for(const [cause,mutate,input,reason] of [
 ['missing baseline',x=>{x.parent().sdk_usage=null;},payload(),'baseline_unavailable'],
 ['counter reset',()=>{},payload(99),'counters_reset'],
 ['changed session',()=>{},payload(150,id(999)),'baseline_mismatch'],
 ['missing result',()=>{},{usage:null,toolsUsed:{tools:[],omitted:0}},'result_unavailable'],
])test(`native accounting marks ${cause} unavailable, never zero-cost or full cumulative recharge`,async()=>{const x=await fixture();try{mutate(x);assert.deepEqual(await x.record(input),{status:'unavailable',reason,replayed:false});assert.equal(x.current().sdk_charge_micro_usd,null);assert.equal((await x.record(input)).replayed,true);}finally{x.f.close();}});
for(const [name,mutate] of Object.entries({
 'foreign tenant':s=>{s.binding.tenantId='foreign';},'foreign actor':s=>{s.binding.actorId='foreign';},'foreign conversation':s=>{s.binding.conversationId=id(999);},'forged owner hash':s=>{s.ownerSha256='f'.repeat(64);},'forged session':s=>{s.key.sessionId=id(999);},'forged count':s=>{s.entriesCount++;},
}))test(`native usage rejects ${name} against the existing immutable reservation`,async()=>{const x=await fixture();try{const lineage={...structuredClone((await x.lineage(x.target)).nextTurn),mode:'resume'};mutate(lineage.sdkSession);await assert.rejects(x.f.store.recordUsage({binding:x.target,scopes,input:payload(),lineage},check));assert.equal(x.current().sdk_usage,undefined);}finally{x.f.close();}});
test('unknown native usage COMMIT is recovered by exact input replay with no second debit',async()=>{const x=await fixture();try{x.f.faults.onCommit=()=>{if(x.current().sdk_usage){x.f.faults.onCommit=null;throw Error('lost usage COMMIT acknowledgement');}};await assert.rejects(x.record(),/SDK_USAGE_COMMIT_UNKNOWN/);assert.equal(x.current().sdk_charge_micro_usd,50000);assert.equal((await x.record()).replayed,true);}finally{x.f.close();}});
