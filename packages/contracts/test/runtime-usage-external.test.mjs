/** The narrow external-provider field on the private run usage DTO. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {assertUsageInput} from '../runtime-0.2/usage.mjs';

const sdk={sessionId:'11111111-1111-4111-8111-111111111111',sdkEstimateUsd:0.1,
 models:{'us.anthropic.claude-sonnet-4-6':{inputTokens:100,outputTokens:20,cacheReadInputTokens:0,cacheCreationInputTokens:0,webSearchRequests:0,sdkEstimateUsd:0.1,provider:'bedrock',costBasis:'list'}},
 basis:{sdk:'0.1.0',cli:'0.1.0',provider:'bedrock',cacheWriteTtl:'5m',priceRevision:'r1'}};
const tools={tools:[],omitted:0};
const facts=(over={})=>({provider:'agentcore-web-search',attempts:1,estimateMicroUsd:7005,billedMicroUsd:null,outcome:'completed',
 calls:[{provider:'agentcore-web-search',attempts:1,outcome:'completed',estimateMicroUsd:7005,billedMicroUsd:null}],truncated:false,...over});

test('external provider facts are accepted beside the existing SDK and tool audit fields',()=>{
 const input=assertUsageInput({usage:sdk,toolsUsed:tools,externalSearch:facts()});
 assert.equal(input.externalSearch.estimateMicroUsd,7005);
 assert.equal(input.externalSearch.billedMicroUsd,null);
 assert.equal(input.usage.sdkEstimateUsd,0.1,'the SDK snapshot is untouched');
 assert.equal(assertUsageInput({usage:sdk,toolsUsed:tools}).externalSearch,undefined,'absence stays absent');
});

test('invalid or invented external facts are refused',()=>{
 for(const bad of [facts({billedMicroUsd:0}),facts({billedMicroUsd:7005}),facts({attempts:-1}),facts({estimateMicroUsd:-1}),
  facts({outcome:'billed'}),facts({calls:[{provider:'other',attempts:1,outcome:'completed',estimateMicroUsd:7005,billedMicroUsd:null}]}),
  facts({calls:[{provider:'agentcore-web-search',attempts:0,outcome:'completed',estimateMicroUsd:0,billedMicroUsd:null}]}),
  facts({provider:''}),facts({truncated:'no'}),{...facts(),extra:1}]){
  assert.throws(()=>assertUsageInput({usage:sdk,toolsUsed:tools,externalSearch:bad}),/RUNTIME_USAGE_REFUSED|INVALID_COMMAND/u,'refused: '+JSON.stringify(bad));
 }
});
