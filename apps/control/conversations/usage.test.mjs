import test from 'node:test';
import assert from 'node:assert/strict';
import {accountSdkUsage,sdkUsageSnapshot} from './usage.mjs';

const session='10000000-0000-4000-8000-000000000001',fork='10000000-0000-4000-8000-000000000002';
const model='us.anthropic.claude-sonnet-4-6';
const counters={inputTokens:10,outputTokens:20,cacheReadInputTokens:30,cacheCreationInputTokens:0,webSearchRequests:0,costUSD:0.001,provider:'bedrock',costBasis:'list'};
const result=(changes={},modelChanges={})=>({type:'result',session_id:session,total_cost_usd:0.001,modelUsage:{[model]:{...counters,...modelChanges}},...changes});
test('records native full-pipeline estimate once, never counts thinking twice or uses main-loop usage',()=>{
 const value=accountSdkUsage({mode:'new',result:result({usage:{input_tokens:999999},result:'private',thinking:'private'},{thinkingTokens:20})});
 assert.equal(value.status,'recorded');assert.equal(value.chargeMicroUsd,1000);assert.equal(value.sdkEstimateUsd,0.001);
 assert.equal(JSON.stringify(value).includes('private'),false);assert.equal(JSON.stringify(value).includes('thinking'),false);
});
test('resume/fork subtract exact parent cumulative totals including subagent counters',()=>{
 const baseline=sdkUsageSnapshot(result());
 for(const mode of ['resume','fork']){
  const value=accountSdkUsage({mode,parentSessionId:session,baseline,result:result({session_id:mode==='fork'?fork:session,total_cost_usd:0.002},{inputTokens:20,outputTokens:40,cacheReadInputTokens:60,costUSD:0.002})});
  assert.equal(value.chargeMicroUsd,1000);assert.equal(value.sdkEstimateUsd,0.001);assert.deepEqual(value.delta[model],{inputTokens:10,outputTokens:20,cacheReadInputTokens:30,cacheCreationInputTokens:0,webSearchRequests:0});
 }
});
test('missing result, lineage or baseline is unavailable, not free',()=>{
 for(const input of [{mode:'new',result:null},{result:result()},{mode:'resume',parentSessionId:session,result:result()}]){
  const value=accountSdkUsage(input);assert.equal(value.status,'unavailable');assert.equal(value.chargeMicroUsd,null);
 }
});
test('wrong parent, same-session fork, other-session resume and unexpected new baseline refuse',()=>{
 const baseline=sdkUsageSnapshot(result());
 for(const input of [{mode:'resume',parentSessionId:fork,baseline,result:result()},{mode:'fork',parentSessionId:session,baseline,result:result()},{mode:'resume',parentSessionId:session,baseline,result:result({session_id:fork})},{mode:'new',baseline,result:result()}])assert.equal(accountSdkUsage(input).reason,'baseline_mismatch');
});
test('counter/model deletion and crash/reset cost are explicit',()=>{
 const baseline=sdkUsageSnapshot(result());
 for(const next of [result({}, {outputTokens:19}),result({total_cost_usd:0}),result({modelUsage:{other:{...counters}}})])assert.equal(accountSdkUsage({mode:'resume',parentSessionId:session,baseline,result:next}).reason,'counters_reset');
});
test('whole-pipeline cache writes use bound native 5m configuration, not main-loop usage',()=>{
 const value=accountSdkUsage({mode:'new',result:result({usage:{cache_creation:{ephemeral_5m_input_tokens:10,ephemeral_1h_input_tokens:0}}},{cacheCreationInputTokens:10})});
 assert.equal(value.status,'recorded');assert.equal(value.chargeMicroUsd,1000);assert.equal(value.sdkEstimateUsd,0.001);assert.equal(value.delta[model].cacheCreationInputTokens,10);
});
test('missing or incompatible native cache/pricing basis cannot silently reprice a parent session',()=>{
 for(const mutate of [v=>{delete v.basis;},v=>{v.basis.cacheWriteTtl='1h';},v=>{v.basis.priceRevision='old';},v=>{v.basis.sdk='0.3.294';}]){
  const baseline=sdkUsageSnapshot(result());mutate(baseline);
  assert.equal(accountSdkUsage({mode:'resume',parentSessionId:session,baseline,result:result()}).reason,'baseline_configuration_mismatch');
 }
 assert.equal(accountSdkUsage({mode:'new',result:result(),basis:{}}).reason,'configuration_mismatch');
});
test('previous cache creation is not billed again when resume only adds cache reads',()=>{
 const previous=result({}, {cacheCreationInputTokens:10});
 const value=accountSdkUsage({mode:'resume',parentSessionId:session,baseline:sdkUsageSnapshot(previous),result:result({total_cost_usd:0.002},{cacheCreationInputTokens:10,cacheReadInputTokens:31,costUSD:0.002})});
 assert.equal(value.chargeMicroUsd,1000);assert.equal(value.delta[model].cacheCreationInputTokens,0);assert.equal(value.delta[model].cacheReadInputTokens,1);
});
test('unknown provider/basis and invalid counts never become a charge',()=>{
 for(const next of [result({}, {provider:'anthropic'}),result({}, {costBasis:'managed'}),result({}, {costBasis:'unknown'}),result({}, {inputTokens:-1}),result({}, {inputTokens:1.5})]){
  const value=accountSdkUsage({mode:'new',result:next});assert.equal(value.status,'unavailable');assert.equal(value.chargeMicroUsd,null);
 }
});
test('caller cannot mutate native counters through projection; output has no SDK content',()=>{
 const native=result({result:'secret',errors:['secret']});native.modelUsage[model].unknown='secret';
 const projected=sdkUsageSnapshot(native);projected.models[model].inputTokens=123;
 assert.equal(native.modelUsage[model].inputTokens,10);assert.equal(JSON.stringify(projected).includes('secret'),false);
});
