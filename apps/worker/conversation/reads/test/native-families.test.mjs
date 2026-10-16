/** Actual canonical schema conversion, synthetic literals only. No SDK import/query, native or model calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {advertisedArguments} from '../schema.mjs';
import {READ_FAMILIES} from '../families.mjs';
for(const [family,id,request] of [
 ['public-reports','search_cbo_cost_estimates',{billId:'HR-1',congress:119}],
 ['public-reports','search_gao_reports',{query:'Oversight'}],['public-reports','search_crs_reports',{query:'Policy'}],
 ['acquisition-personnel','search_acquisition_personnel',{query:'Synthetic'}],
 ['acquisition-personnel','get_acquisition_person',{id:'abcdefab-1234-0000-0000-000000000001'}],
])test(`${id}: canonical worker schema preserves literals and excludes authority/context`,()=>{
 const contract=resolveOperationContract({id,version:'0.2.0'}),converted=advertisedArguments(contract.descriptor.inputSchema);
 assert.equal(READ_FAMILIES[family].clientScope,'optional');assert.equal(converted.mode,'canonical');assert.deepEqual(converted.arguments.parse(request),request);
 for(const extra of [{tenantId:'foreign'},{actorRole:'capiro_admin'},{membershipRevision:'a'.repeat(64)},{normalizationContext:{}},{input:request}])assert.equal(converted.arguments.safeParse({...request,...extra}).success,false);
});
