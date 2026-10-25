/** Existing producer contexts, bound to original JSON; no authority is carried here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeReadObservation,encodeNativeReadObservation,decodeNativeReadObservation} from '../validate.mjs';
const instant='2026-10-25T00:00:00.000Z';
const contexts={get_certification_status:{comparisonLocale:'en-US'},get_state_rule_status:{stageAsOf:instant,commentAsOf:instant},
 search_sam_opportunities:{asOf:instant,sourceStatusAsOf:instant,sourceHealthAsOf:instant,evidenceAccuracyMode:'off'}};
for(const [id,context] of Object.entries(contexts))test(`${id}: exact producer context and original request survive the carrier`,()=>{
 const correlation={operation:{id,version:'0.2.0'},request:{query:'  Synthetic  '}};
 const value=createNativeReadObservation({...correlation,context});
 const carrier=encodeNativeReadObservation(value,correlation);
 assert.deepEqual(decodeNativeReadObservation(carrier,correlation),value);
 for(const changed of [{...correlation,request:{query:'Synthetic'}},{...correlation,operation:{id,version:'0.2.1'}}])
  assert.throws(()=>decodeNativeReadObservation(carrier,changed),/NATIVE_READ_OBSERVATION_REFUSED/);
 for(const wrong of [{},...Object.values(contexts).filter(c=>c!==context),{...context,tenantId:'injected'}])
  assert.throws(()=>createNativeReadObservation({...correlation,context:wrong}),/NATIVE_READ_OBSERVATION_REFUSED/);
});
test('secondary contexts reject noncanonical locale, invalid clocks and invented policy',()=>{
 for(const [id,context] of [
  ['get_certification_status',{comparisonLocale:'en-us'}],['get_certification_status',{comparisonLocale:'zz-ZZ'}],
  ['get_state_rule_status',{stageAsOf:'2026-02-30T00:00:00.000Z',commentAsOf:instant}],
  ['search_sam_opportunities',{...contexts.search_sam_opportunities,sourceHealthAsOf:'yesterday'}],
  ['search_sam_opportunities',{...contexts.search_sam_opportunities,evidenceAccuracyMode:'auto'}],
 ])assert.throws(()=>createNativeReadObservation({operation:{id,version:'0.2.0'},request:{},context}),/NATIVE_READ_OBSERVATION_REFUSED/);
});
