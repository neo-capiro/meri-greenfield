import test from 'node:test';import assert from 'node:assert/strict';
import {projectRecordedUsage} from '../projection.mjs';
import {payload,savedUsage,request,id} from './fixture.mjs';
test('recording absence, unavailable snapshot and recorded zero remain three distinct facts',()=>{
 const absent=projectRecordedUsage(null,request),unavailable=projectRecordedUsage(savedUsage(payload({unavailable:true})),request),zero=projectRecordedUsage(savedUsage(payload({zero:true})),request);
 assert.equal(absent.recording,'not-recorded');assert.equal(absent.usage,null);assert.equal(absent.toolAudit,null);
 assert.equal(unavailable.recording,'recorded');assert.equal(unavailable.usage.status,'unavailable');assert.equal(unavailable.usage.reason,'result_unavailable');assert.equal(unavailable.usage.cumulative,null);assert.equal(unavailable.usage.runDelta,null);
 assert.equal(zero.usage.status,'recorded');assert.equal(zero.usage.runDelta.sdkEstimateUsd,0);assert.ok(zero.usage.runDelta.modelCounters.every(model=>model.inputTokens===0));assert.equal(zero.usage.providerBilledUsd,null);
});
test('multiple original model estimates stay cumulative and distinct from the existing run delta',()=>{
 const input=payload(),baseline=structuredClone(input.usage);baseline.sdkEstimateUsd=0.1;baseline.models['model.alpha'].sdkEstimateUsd=0.05;baseline.models['model.beta'].sdkEstimateUsd=0.05;
 for(const model of Object.values(baseline.models)){model.inputTokens=10;model.outputTokens=10;model.cacheReadInputTokens=10;model.cacheCreationInputTokens=10;model.webSearchRequests=0;}
 const record=savedUsage(input,{mode:'resume',parentSessionId:baseline.sessionId,baseline}),value=projectRecordedUsage(record,request);
 assert.equal(value.usage.cumulative.sdkEstimateUsd,0.3);assert.equal(value.usage.runDelta.sdkEstimateUsd,0.2);assert.equal(value.usage.cumulative.models[0].sdkEstimateUsd,0.1);assert.equal(value.usage.cumulative.models[1].sdkEstimateUsd,0.2);
 assert.deepEqual(value.usage.cumulative.basis,input.usage.basis);assert.equal(value.usage.runDelta.modelCounters[0].inputTokens,90);assert.equal(value.usage.runDelta.modelCounters[1].inputTokens,190);
 assert.ok(value.usage.runDelta.modelCounters.every(model=>!Object.hasOwn(model,'sdkEstimateUsd')),'no invented per-model run price');
});
test('unknown billing basis retains the recorded estimate without claiming provider billing or zero usage',()=>{
 const input=payload();input.usage.models['model.alpha'].provider='unknown';input.usage.models['model.alpha'].costBasis='unknown';const value=projectRecordedUsage(savedUsage(input),request);
 assert.equal(value.usage.status,'unavailable');assert.equal(value.usage.reason,'rates_unavailable');assert.equal(value.usage.cumulative.models[0].costBasis,'unknown');assert.equal(value.usage.runDelta.sdkEstimateUsd,0.3);assert.equal(value.usage.providerBilledUsd,null);
});

test('provider mismatch remains visible as unavailable with the original provider and estimate',()=>{
 const input=payload();input.usage.models['model.beta'].provider='firstParty';
 const value=projectRecordedUsage(savedUsage(input),request);
 assert.equal(value.usage.status,'unavailable');assert.equal(value.usage.reason,'configuration_mismatch');
 assert.equal(value.usage.cumulative.basis.provider,'bedrock');
 assert.equal(value.usage.cumulative.models[1].provider,'firstParty');
 assert.equal(value.usage.runDelta.sdkEstimateUsd,0.3);assert.equal(value.usage.providerBilledUsd,null);
});
test('native outcomes disclose partial hook coverage and unknown duration, dropping all private join/session identities',()=>{
 const record=savedUsage(payload({omitted:4}));record.parentRunId=id(55);const value=projectRecordedUsage(record,request),text=JSON.stringify(value);
 assert.deepEqual(value.toolAudit,{coverage:'recorded-hooks-only',partial:true,omitted:4,tools:[{name:'Read',executionOutcome:'completed',durationMs:0},{name:'mcp__capiro__read',executionOutcome:'failed',durationMs:null}]});
 for(const secret of [id(50),id(55),'private-tool-audit','inputSha256','chargeMicroUsd','toolUseId','requestId','sessionId','tenantId','actorId','policyRevision'])assert.ok(!text.includes(secret),secret);
});
test('malformed stored envelopes, missing counters, invented fields and mismatched model rows fail closed',()=>{
 const changes=[r=>r.status='other',r=>r.reason='secret',r=>r.inputSha256=['a'.repeat(64)],r=>r.prompt='secret',r=>delete r.cumulative.models['model.alpha'].cacheReadInputTokens,
  r=>r.delta['model.alpha'].inputTokens=-1,r=>r.delta.other=r.delta['model.alpha'],r=>r.delta['model.alpha'].inputTokens=101,
  r=>r.toolsUsed.tools[0].output='secret',r=>r.toolsUsed.omitted=-1,r=>r.toolsUsed.tools[0].tool='<script>',r=>r.toolsUsed.tools[0].durationMs=0.5,r=>r.sdkEstimateUsd=null];
 for(const change of changes){const record=savedUsage();change(record);assert.throws(()=>projectRecordedUsage(record,request),/USAGE_RECORD_CORRUPT/);}
});
