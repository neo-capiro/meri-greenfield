import test from 'node:test';
import assert from 'node:assert/strict';
import wire from './fixtures/federal-draft-source.wire.json' with {type:'json'};
import {resolveOperationContract} from '../retrieval-0.2/validate.mjs';
const contract=resolveOperationContract({id:'read_federal_draft_source',version:'0.2.0'});
test('actual PostgreSQL-backed Core wire retains exact source and uncertainty',()=>{
 assert.doesNotThrow(()=>contract.assertOutput(wire.response,{request:wire.request}));
 assert.deepEqual(contract.normalizeInput(wire.request).input,wire.request);
});
for(const [label,mutate] of [
 ['text corruption',r=>{r.source.text+='x';}],
 ['revision substitution',r=>{r.source.revisionId='22222222-2222-4222-8222-222222222222';}],
 ['retained hash substitution',r=>{r.source.versionHash='a'.repeat(64);}],
 ['publisher substitution',r=>{r.source.provider='congress.gov';}],
 ['invented normalization',r=>{r.coverage.textNormalization='none';}],
 ['invented legal currency',r=>{r.currency.legalCurrency='current-law';}],
 ['enrolled interpreted as enacted',r=>{r.currency.enactment='enacted';}],
 ['raw content leak',r=>{r.source.rawContent='private';}],
 ['partial source',r=>{r.coverage.complete=false;}],
 ['ambiguous date',r=>{r.source.publishedAt='01/02/2026';}],
 ['oversized UTF-8',r=>{r.source.text='€'.repeat(50000);}],
])test(label,()=>{const r=structuredClone(wire.response);mutate(r);assert.throws(()=>contract.assertOutput(r,{request:wire.request}));});
test('unavailability preserves exact selection and cannot carry source bytes',()=>{
 const result={tool:'read_federal_draft_source',authoritativeOwner:'federal_evidence_current',currentStatus:'unavailable',reason:'exact_current_source_unavailable',selection:wire.request};
 assert.doesNotThrow(()=>contract.assertOutput(result,{request:wire.request}));
 assert.throws(()=>contract.assertOutput({...result,source:wire.response.source},{request:wire.request}));
 assert.throws(()=>contract.assertOutput({...result,selection:{...wire.request,versionCode:'ih'}},{request:wire.request}));
});
test('input cannot fetch arbitrary URLs or carry authority and requires every pin',()=>{
 for(const patch of [{sourceUrl:'https://example.com'},{tenantId:'forged'},{billId:'H.R. 1'},{versionHash:'A'.repeat(64)}])
  assert.throws(()=>contract.normalizeInput({...wire.request,...patch}));
 for(const key of Object.keys(wire.request)){const input={...wire.request};delete input[key];assert.throws(()=>contract.normalizeInput(input));}
 assert.throws(()=>contract.normalizeInput(wire.request,{defaultCongress:119}));
});
