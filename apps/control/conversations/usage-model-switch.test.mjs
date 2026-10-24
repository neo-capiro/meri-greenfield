import test from 'node:test';import assert from 'node:assert/strict';
import {accountSdkUsage,sdkUsageSnapshot,SDK_USAGE_BASIS,resolveSdkModelConfiguration} from './usage.mjs';
const session='10000000-0000-4000-8000-000000000001',fork='10000000-0000-4000-8000-000000000002';
const bedrock='us.anthropic.claude-sonnet-4-6',api='claude-opus-4-6';
const row=(provider,costUSD,n=10)=>({provider,costBasis:'list',costUSD,inputTokens:n,outputTokens:n,cacheReadInputTokens:n,cacheCreationInputTokens:n,webSearchRequests:1});
const result=(models,total_cost_usd,session_id=session)=>({type:'result',session_id,total_cost_usd,modelUsage:models});
const apiBasis={...SDK_USAGE_BASIS,provider:'claude-api'};
test('three turns across models/providers charge only each native cumulative estimate delta',()=>{
 const first=result({[bedrock]:row('bedrock',0.1)},0.1),second=result({[bedrock]:row('bedrock',0.1),[api]:row('firstParty',0.04)},0.14);
 const initial=accountSdkUsage({mode:'new',result:first});assert.equal(initial.chargeMicroUsd,100000);
 const next=accountSdkUsage({mode:'resume',parentSessionId:session,baseline:initial.cumulative,basis:apiBasis,result:second});assert.equal(next.status,'recorded');assert.equal(next.chargeMicroUsd,40000);assert.equal(next.cumulative.models[api].provider,'firstParty');assert.equal(next.delta[bedrock].inputTokens,0);
 const third=accountSdkUsage({mode:'resume',parentSessionId:session,baseline:next.cumulative,result:result({[bedrock]:row('bedrock',0.125,20),[api]:row('firstParty',0.04)},0.165)});
 assert.equal(third.chargeMicroUsd,25000);assert.equal(third.delta[api].webSearchRequests,0);
});
test('historical pinned baseline is decoded without repricing or mutating prior ledger amounts',()=>{
 const previous=sdkUsageSnapshot(result({[bedrock]:row('bedrock',0.1)},0.1));previous.basis.priceRevision='bedrock-us-sonnet-4-6-2026-10-23';const saved=structuredClone(previous);
 const value=accountSdkUsage({mode:'fork',parentSessionId:session,baseline:previous,basis:apiBasis,result:result({[bedrock]:row('bedrock',0.1),[api]:row('firstParty',0.0000001)},0.1000001,fork)});
 assert.equal(value.chargeMicroUsd,1);assert.deepEqual(previous,saved);assert.equal(value.sdkEstimateUsd,0.0000001);
});
test('provider collision, per-model cost reset, missing model and unknown pricing remain unavailable',()=>{
 const previous=sdkUsageSnapshot(result({[bedrock]:row('bedrock',0.1)},0.1));
 for(const [models,total] of [[{[bedrock]:row('firstParty',0.2)},0.2],[{[bedrock]:row('bedrock',0.09),[api]:row('firstParty',0.1)},0.19],[{[api]:row('firstParty',0.2)},0.2],[{[bedrock]:{...row('bedrock',0.2),costBasis:'unknown'}},0.2]]){
  const value=accountSdkUsage({mode:'resume',parentSessionId:session,baseline:previous,basis:apiBasis,result:result(models,total)});assert.equal(value.status,'unavailable');assert.equal(value.chargeMicroUsd,null);
 }
});
test('loaded configuration forwards admitted provider/model/effort and tenant per-run limits, never credentials',()=>{
 const model=resolveSdkModelConfiguration({provider:'claude-api',modelId:api,effort:'max'},{maxTurns:20,maxBudgetMicroUsd:2000000,monthlyCapMicroUsd:5000000});
 assert.deepEqual(model,{provider:'claude-api',model:api,effort:'max',region:'us-east-1',maxOutputTokens:4096,usageBasis:apiBasis,maxTurns:20,maxCostMicroUSD:2000000});
 assert.throws(()=>resolveSdkModelConfiguration({provider:'other',modelId:api,effort:null},{maxTurns:20,maxBudgetMicroUsd:1}));
});

test('resumed entry with omitted native costBasis retains the documented list-price meaning',()=>{
 const baseline=sdkUsageSnapshot(result({[bedrock]:row('bedrock',0.1)},0.1));
 const old=row('bedrock',0.1);delete old.costBasis;
 const value=accountSdkUsage({mode:'resume',parentSessionId:session,baseline,basis:apiBasis,result:result({[bedrock]:old,[api]:row('firstParty',0.04)},0.14)});
 assert.equal(value.status,'recorded');assert.equal(value.chargeMicroUsd,40000);
});

test('conflicting aggregate/model estimates never satisfy a cap as a free turn',()=>{
 const baseline=sdkUsageSnapshot(result({[bedrock]:row('bedrock',0.1)},0.1));
 for(const input of [
  {mode:'new',result:result({[bedrock]:row('bedrock',0.1)},0)},
  {mode:'resume',parentSessionId:session,baseline,result:result({[bedrock]:row('bedrock',0.2)},0.1)},
  {mode:'resume',parentSessionId:session,baseline:{...baseline,sdkEstimateUsd:0},result:result({[bedrock]:row('bedrock',0.2)},0.2)},
 ]){const value=accountSdkUsage(input);assert.equal(value.reason,'estimate_mismatch');assert.equal(value.chargeMicroUsd,null);}
});

test('native aggregate summation roundoff is tolerated without accepting material discrepancies',()=>{
 const value=accountSdkUsage({mode:'new',result:result({[bedrock]:row('bedrock',0.1),[api]:row('firstParty',0.2)},0.3)});
 assert.equal(value.status,'recorded');assert.equal(value.chargeMicroUsd,300000);
 assert.equal(accountSdkUsage({mode:'new',result:result({[bedrock]:row('bedrock',0.1),[api]:row('firstParty',0.2)},0.30000001)}).reason,'estimate_mismatch');
});
