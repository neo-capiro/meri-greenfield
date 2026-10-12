// Explicit next reviewed additions; prior descriptor values and hashes remain unchanged.
const nextIds = ["search_sec_filings", "search_fara_registrations", "search_lda_filings", "search_acquisition_personnel", "get_acquisition_person", "get_bill_status", "search_floor_votes", "search_congress_bills", "read_bill_text", "get_committee_roster", "list_members", "get_pe_contractors", "get_pe_bills", "get_pe_report_language", "get_state_rule_status", "get_certification_status", "search_intel_articles", "list_global_datasets", "get_representation", "get_state_bill_status", "search_state_floor_votes", "query_regulatory_dockets", "find_contacts", "resolve_entity", "search_tracked_bills", "query_intelligence", "search_public_web", "scrape_web_page", "search_sam_opportunities", "get_florida_budget_project", "query_outreach", "search_program_elements", "get_program_element", "get_pe_budget_timeline"];
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import catalog from '../retrieval-0.2/catalog.json' with {type:'json'};
import {assertCatalog, resolveOperationContract} from '../retrieval-0.2/validate.mjs';
import {canonicalSha256} from '../validate.mjs';

const additions = ['search_funding_opportunities','get_funding_opportunity_requirements','get_funding_opportunity',
  'get_opportunity_client_context','get_opportunity_government_landscape','read_client_documents',
  'query_economic_data','search_federal_grants','search_federal_awards','get_district_nexus_context',
  'get_district_nexus_changes','search_state_bills','get_state_legislator','search_cbo_cost_estimates',
  'search_gao_reports','search_crs_reports'];
const funding = additions.slice(0,5), district = additions.slice(9,11);
const U='11111111-1111-4111-8111-111111111111', R='22222222-2222-4222-8222-222222222222';
const stamp='2026-10-12T00:00:00.000Z', resolve=id=>resolveOperationContract({id,version:'0.2.0'});
const context=()=>({binding:{tenantId:'synthetic',actorId:'reader',conversationId:U,runId:U,attemptId:U,workerId:U,writerFence:1},
  subject:{tenantId:'synthetic',actorId:'reader',kind:'client',entityType:'client',entityIds:['client'],rosterVersionId:null,
    policyRevision:'policy',authorizationDecisionId:U,scopes:[{tenantId:'synthetic',kind:'client',resourceId:'client',policyRevision:'policy'}]}});
function request(id) {
  if(funding.includes(id))return id==='search_funding_opportunities'||id==='get_opportunity_client_context'?{clientId:U}:{clientId:U,source:'sam_gov',sourceRecordId:R};
  if(id==='read_client_documents')return {clientId:'client'};
  if(district.includes(id))return {clientId:'client',state:' ca ',district:'00'};
  return {};
}
function options(id) {
  if(funding.includes(id))return {asOf:stamp};
  if(id==='read_client_documents'||district.includes(id))return context();
  if(['search_federal_grants','search_federal_awards'].includes(id))return {evidenceAccuracyMode:'off'};
  return {};
}
function output(id) {
  if(funding.includes(id))return {tool:id,state:'disabled',explanation:'Synthetic disabled source.',asOf:stamp,data:null};
  if(id==='read_client_documents')return {...context(),data:{tool:id,generatedAt:stamp,clientId:'client',
    coverage:{total:0,returned:0,truncated:false,nextCursor:null,complete:true,paginationComplete:true,query:null,queryAppliesTo:'fileName'},note:'A listing is not a content read.',documents:[]}};
  if(district.includes(id))return {...context(),data:{available:false,reason:'feature_disabled'}};
  if(id==='query_economic_data')return {tool:id,source:'census',generatedAt:stamp,data:[]};
  if(id==='search_federal_grants')return {tool:id,generatedAt:stamp,asOf:stamp,total:0,data:[]};
  if(id==='search_federal_awards')return {tool:id,generatedAt:stamp,total:0,page:1,pageSize:20,hasMore:false,nextPage:null,paginationLimitReached:false,data:[]};
  if(id==='search_state_bills')return {tool:id,generatedAt:stamp,total:0,data:[],note:'No state bill on record matches that. Say so explicitly — do not describe a bill from memory.'};
  if(id==='get_state_legislator')return {tool:id,generatedAt:stamp,matchesFound:0,matches:[],note:'Provide a legislator name or an OpenStates/LegiScan id.'};
  if(id==='search_cbo_cost_estimates')return {tool:id,generatedAt:stamp,estimatesFound:0,estimates:[],note:'No CBO cost estimates matched. Say so explicitly — do not estimate or guess a score.'};
  return {tool:id,generatedAt:stamp,total:0,data:[]};
}

test('reviewed continuation preserves139 originals and the exact prior21 descriptors',()=>{
  assertCatalog(catalog);assert.equal(catalog.catalogVersion,'0.2.10');
  assert.equal(catalog.originals.length,139);assert.equal(catalog.originals.filter(x=>x.disposition==='selected').length,96);
  assert.equal(catalog.originals.filter(x=>x.disposition==='deferred').length,43);
  assert.equal(catalog.operations.length,71);assert.equal(catalog.originals.filter(x=>x.state==='mapped').length,70);
  assert.equal(catalog.originals.filter(x=>x.disposition==='selected'&&x.state==='pending').length,26);
  const baseline=JSON.parse(readFileSync(new URL('../../../docs/qualification/candidates/read-continuation-20261012/integration/pr24-catalog-baseline.json',import.meta.url)));
  assert.deepEqual(catalog.operations.filter(x=>!additions.includes(x.operation.id)&&!nextIds.includes(x.operation.id)),baseline.operations);
  for(const old of baseline.originals)assert.deepEqual(catalog.originals.find(x=>x.id===old.id),
    (additions.includes(old.id)||nextIds.includes(old.id))?{...old,state:'mapped',replacement:{id:old.id,version:'0.2.0'}}:old);
});

for(const id of additions) {
  test(`canonical continuation routes normalized selection and exact context: ${id}`,()=>{
    const contract=resolve(id),raw=request(id),ctx=options(id),selected=contract.normalizeInput(raw,ctx);
    assert.deepEqual(selected.request,raw);assert.equal(selected.argumentsSha256,canonicalSha256(selected.input));
    assert.ok(Object.isFrozen(selected.input));assert.ok(Object.isFrozen(selected.request));
    const page=output(id);assert.deepEqual(contract.assertOutput(page,{...ctx,request:raw}),page);
    assert.throws(()=>contract.assertOutput(page,ctx));
    assert.throws(()=>contract.normalizeInput({...raw,authorized:true},ctx));
    assert.throws(()=>contract.normalizeInput(raw,{...ctx,foreign:true}));
    assert.throws(()=>contract.assertOutput({...page,authority:'verified'},{...ctx,request:raw}));
  });
  test(`canonical continuation pins unavailable schemas and rejects promotion: ${id}`,()=>{
    const {descriptor,binding}=resolve(id),raw=readFileSync(new URL(`../retrieval-0.2/${binding.group}.schema.json`,import.meta.url));
    const schema=JSON.parse(raw),sha256=createHash('sha256').update(raw).digest('hex');
    for(const [field,name] of [['inputSchema',binding.input],['outputSchema',binding.output]])
      assert.deepEqual(descriptor[field],{id:`${schema.$id}#/$defs/${name}`,sha256});
    assert.equal(descriptor.handler,null);assert.equal(descriptor.availability,'unimplemented');
    assert.equal(descriptor.qualification,'pending');assert.equal(descriptor.retry.maxRetries,0);
    for(const modify of [x=>x.inputSchema.sha256='0'.repeat(64),x=>x.handler={module:'synthetic/read.mjs',export:'read',sourceSha256:'0'.repeat(64)},
      x=>{x.availability='enabled';x.qualification='qualified';}]){
      const changed=structuredClone(catalog);modify(changed.operations.find(x=>x.operation.id===id));assert.throws(()=>assertCatalog(changed));
    }
  });
}
test('funding callback strips resolver request and enforces trusted observation clock',()=>{
  for(const id of funding){const raw=request(id),page=output(id);
    assert.throws(()=>resolve(id).normalizeInput(raw));
    assert.throws(()=>resolve(id).normalizeInput({...raw,asOf:stamp},options(id)));
    assert.throws(()=>resolve(id).assertOutput(page,{asOf:'2026-10-13T00:00:00.000Z',request:raw}));
  }
  for(const invalid of [{},{clientId:'synthetic'}])assert.throws(()=>resolve(funding[0]).normalizeInput(invalid,{asOf:stamp}));
});
test('policy context is mandatory for grants/awards and excluded from model arguments',()=>{
  for(const id of ['search_federal_grants','search_federal_awards']){
    assert.throws(()=>resolve(id).normalizeInput({}));
    assert.throws(()=>resolve(id).normalizeInput({evidenceAccuracyMode:'enforce'},options(id)));
    for(const evidenceAccuracyMode of ['off','shadow','enforce'])resolve(id).normalizeInput({},{evidenceAccuracyMode});
  }
  assert.throws(()=>resolve('query_economic_data').normalizeInput({},{evidenceAccuracyMode:'off'}));
});
test('document/district callbacks require complete current lineage including output binding',()=>{
  for(const id of ['read_client_documents',...district]){
    assert.throws(()=>resolve(id).normalizeInput(request(id)));
    const changed=output(id);changed.binding.writerFence++;
    assert.throws(()=>resolve(id).assertOutput(changed,{...options(id),request:request(id)}));
  }
});
test('all new callbacks preserve canonical inert admission without getter effects',()=>{
  let effects=0;const hostile={};Object.defineProperty(hostile,'query',{enumerable:true,get(){effects++;return 'x';}});
  for(const id of additions){assert.throws(()=>resolve(id).normalizeInput(hostile,options(id)));assert.throws(()=>resolve(id).assertOutput(hostile,{...options(id),request:request(id)}));}
  assert.equal(effects,0);
});
