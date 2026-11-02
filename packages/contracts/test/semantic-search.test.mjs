import test from 'node:test';
import assert from 'node:assert/strict';
import wire from './fixtures/semantic-search.wire.json' with {type:'json'};
import {resolveOperationContract} from '../retrieval-0.2/validate.mjs';
import {SEMANTIC_SEARCH_FAMILIES} from '../retrieval-0.2/semantic-search-validation.mjs';
const contract=id=>resolveOperationContract({id,version:'0.2.0'});
const CASES=[['semantic_search_bills',wire.bills],['semantic_search_grants',wire.grants],['semantic_search_contract_opportunities',wire.contractOpportunities]];
for(const [id,vector] of CASES)test(`${id} admits the Core result shape bound to its request`,()=>{
 const c=contract(id);
 assert.equal(c.binding.group,'semantic-search');
 assert.doesNotThrow(()=>c.assertOutput(vector.response,{request:vector.request}));
 assert.deepEqual(c.normalizeInput(vector.request).input,{limit:10,...vector.request});
});
test('an empty page is admitted and says the indexed records held no close match, with the unindexed count',()=>{
 assert.doesNotThrow(()=>contract('semantic_search_bills').assertOutput(wire.empty.response,{request:wire.empty.request}));
 assert.equal(wire.empty.response.total,0);assert.deepEqual(wire.empty.response.coverage,{indexedRecords:43424,totalRecords:48497});
 assert.match(wire.empty.response.notes[2],/No close match among the indexed congress bill records .* 5073 records are not indexed yet, not that no such record exists/);
});
test('the three reads share one input shape but refuse filters their family does not apply',()=>{
 assert.throws(()=>contract('semantic_search_bills').normalizeInput({query:'water',agency:'EPA'}));
 assert.throws(()=>contract('semantic_search_grants').normalizeInput({query:'water',congress:119}));
 assert.throws(()=>contract('semantic_search_grants').normalizeInput({query:'water',status:'open'}));
 assert.throws(()=>contract('semantic_search_contract_opportunities').normalizeInput({query:'water',status:'posted'}));
 assert.deepEqual(contract('semantic_search_grants').normalizeInput({query:'  clean   water ',status:'Posted'}).input,{query:'clean water',status:'posted',limit:10});
 for(const patch of [{query:'ab'},{query:'x'.repeat(2001)},{limit:0},{limit:26},{limit:'5'},{congress:50},{dateFrom:'2026-1-1'},{dateFrom:'2026-02-01',dateTo:'2026-01-01'},{tenantId:'forged'},{clientId:'00000003-0000-4000-8000-000000000001'}])
  assert.throws(()=>contract('semantic_search_bills').normalizeInput({query:'water',...patch}),JSON.stringify(patch));
 assert.throws(()=>contract('semantic_search_contract_opportunities').normalizeInput({query:'water',naics:'33a'}));
 assert.throws(()=>contract('semantic_search_bills').normalizeInput({query:'water'},{defaultCongress:119}));
 assert.deepEqual(Object.keys(SEMANTIC_SEARCH_FAMILIES),CASES.map(([id])=>id));
});
const mutate=(label,id,vector,change)=>test(label,()=>{
 const {request,response}=structuredClone(vector);contract(id).assertOutput(response,{request});change(response,request);
 assert.throws(()=>contract(id).assertOutput(response,{request}));
});
mutate('another tool answered','semantic_search_bills',wire.bills,r=>{r.tool='semantic_search_grants';});
mutate('query drift','semantic_search_bills',wire.bills,r=>{r.query='something else';});
mutate('total is not the page size','semantic_search_bills',wire.bills,r=>{r.total=2;});
mutate('page exceeds the requested limit','semantic_search_bills',wire.bills,(r,q)=>{q.limit=1;r.results.push({...structuredClone(r.results[0]),reference:'congress_bill:119-hr-2',record:{...r.results[0].record,id:'119-hr-2'}});r.total=2;});
mutate('reference does not name the record','semantic_search_bills',wire.bills,r=>{r.results[0].reference='congress_bill:119-hr-2';});
mutate('reference of another family','semantic_search_bills',wire.bills,r=>{r.results[0].reference='federal_grant:119-hr-1';});
mutate('duplicate record','semantic_search_bills',wire.bills,r=>{r.results.push(structuredClone(r.results[0]));r.total=2;});
mutate('score below the declared floor','semantic_search_bills',wire.bills,r=>{r.results[0].score=0.2;});
mutate('ranking out of order','semantic_search_grants',wire.grants,r=>{r.results.push({...structuredClone(r.results[0]),reference:'federal_grant:SYN-GRANT-000002',score:0.9,record:{...r.results[0].record,id:'SYN-GRANT-000002'}});r.total=2;});
mutate('bill outside the requested Congress','semantic_search_bills',wire.bills,r=>{r.results[0].record.congress=118;});
mutate('grant outside the requested status','semantic_search_grants',wire.grants,r=>{r.results[0].record.status='closed';});
mutate('inactive notice without includeInactive','semantic_search_contract_opportunities',wire.contractOpportunities,r=>{r.results[0].record.active=false;});
mutate('notice outside the NAICS prefix','semantic_search_contract_opportunities',wire.contractOpportunities,r=>{r.results[0].record.naicsCode='541511';});
mutate('a record of another family','semantic_search_grants',wire.grants,r=>{r.results[0].record=wire.bills.response.results[0].record;r.results[0].reference='federal_grant:119-hr-1';});
mutate('unexpected authority material','semantic_search_bills',wire.bills,r=>{r.credentials='forged';});
mutate('coverage missing','semantic_search_bills',wire.bills,r=>{delete r.coverage;});
mutate('more indexed than stored records','semantic_search_bills',wire.bills,r=>{r.coverage.indexedRecords=r.coverage.totalRecords+1;});
mutate('negative coverage','semantic_search_bills',wire.bills,r=>{r.coverage.totalRecords=-1;});
mutate('record with an extra field','semantic_search_bills',wire.bills,r=>{r.results[0].record.tenantId='forged';});
test('inactive notices are admitted only when the request asked for them',()=>{
 const {request,response}=structuredClone(wire.contractOpportunities);response.results[0].record.active=false;
 assert.doesNotThrow(()=>contract('semantic_search_contract_opportunities').assertOutput(response,{request:{...request,includeInactive:true}}));
});
