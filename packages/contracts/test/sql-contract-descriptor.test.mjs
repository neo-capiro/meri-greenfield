import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../validate.mjs';
import {resolveOperationContract} from '../retrieval-0.2/validate.mjs';
import {capiroDataPage,privateCapiroDataPage,nextGenerationPage} from '../../../apps/gateway/sources/capiro-data/test/fixture.mjs';
import {withSqlContract} from '../../../apps/gateway/sources/capiro-data/test/sql-contract-fixture.mjs';
const scope={capiroDataScope:{clientId:null,identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64)}};
for(const version of ['0.2.0','0.3.0'])for(const privateSource of [false,true])test(`${version} descriptor binds grammar, limits and exact ${privateSource?'private':'public'} relation metadata`,()=>{
 const contract=resolveOperationContract({id:'describe_capiro_data',version});
 const page=withSqlContract(nextGenerationPage((privateSource?privateCapiroDataPage:capiroDataPage)('describe_capiro_data')));
 const request=privateSource?{source:'client_records',relations:['client_objectives']}:{relations:['program_elements']};
 const options={request,...(privateSource?scope:{})};
 assert.deepEqual(contract.assertOutput(page,options),page);
 for(const mutate of [p=>p.contract.revisionSha256='0'.repeat(64),p=>p.contract.source=privateSource?'public':'client_records',p=>p.contract.version='capiro.sql-contract/2',p=>p.contract.grammar.version='postgresql-select/2',p=>p.contract.grammar.extra=true,p=>p.contract.extra=true,p=>p.contract.grammar.blockedFunctions.push('future_function'),p=>p.contract.columnCountLimit=32,p=>p.contract.limits.maxColumns=32,p=>p.relations[0].description+=' changed',p=>p.relations[0].fields[0].description+=' changed']){
  const bad=structuredClone(page);mutate(bad);assert.throws(()=>contract.assertOutput(bad,options));
 }
 // Grammar is Core-owned data. A changed exact-name list with a matching digest is consumed, not a second gate.
 const changed=structuredClone(page);changed.contract.grammar.blockedFunctions.push('future_function');
 const {revisionSha256,...body}=changed.contract;changed.contract.revisionSha256=canonicalSha256({...body,relations:changed.relations});
 assert.deepEqual(contract.assertOutput(changed,options),changed);
 const legacy=structuredClone(page);delete legacy.contract;assert.deepEqual(contract.assertOutput(legacy,options),legacy);
 const reordered=Object.fromEntries(Object.entries(page).reverse());assert.deepEqual(contract.assertOutput(reordered,options),page);
});
test('shared Core/Meri digest vector is stable without generatedAt and binds arrays in order',()=>{
 const page=withSqlContract(nextGenerationPage(capiroDataPage('describe_capiro_data')));
 assert.equal(page.contract.revisionSha256,'9e9d961098d6dbecf431e9efa4a649325bc9ffa650c68c41cae379486d88357c');
 page.generatedAt='2026-11-01T01:00:00.000Z';assert.equal(withSqlContract(page).contract.revisionSha256,page.contract.revisionSha256);
 page.relations[0].fields.reverse();assert.notEqual(withSqlContract(page).contract.revisionSha256,page.contract.revisionSha256);
});
