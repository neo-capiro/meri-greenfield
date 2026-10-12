// Explicit subsequent reviewed mappings; prior descriptors and original assertions are preserved.
const referenceIds = ["get_committee_roster", "list_members", "get_pe_contractors", "get_pe_bills", "get_pe_report_language", "get_state_rule_status", "get_certification_status", "search_intel_articles", "list_global_datasets", "get_representation", "get_state_bill_status", "search_state_floor_votes", "query_regulatory_dockets", "find_contacts", "resolve_entity", "search_tracked_bills", "query_intelligence", "search_public_web", "scrape_web_page", "search_sam_opportunities", "get_florida_budget_project"];
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import catalog from '../retrieval-0.2/catalog.json' with {type:'json'};
import {assertCatalog,resolveOperationContract} from '../retrieval-0.2/validate.mjs';
import {canonicalSha256} from '../validate.mjs';

const additions=['search_sec_filings','search_fara_registrations','search_lda_filings',
  'search_acquisition_personnel','get_acquisition_person','get_bill_status','search_floor_votes',
  'search_congress_bills','read_bill_text'];
const resolve=id=>resolveOperationContract({id,version:'0.2.0'}),stamp='2026-10-12T00:00:00.000Z';
const personnel=additions.slice(3,5),congress=additions.slice(5),uuid='11111111-1111-1111-1111-111111111111';
const request=id=>id==='get_acquisition_person'?{id:uuid}:id==='read_bill_text'?{billId:'H.R. 1'}:{};
const context=id=>personnel.includes(id)?{actorRole:'standard_user'}:congress.includes(id)?{defaultCongress:119}:{};
function person(){return{id:uuid,fullName:'Synthetic person',nameKey:'synthetic-person',programOfRecord:null,service:null,organization:null,title:null,role:null,
  pePrimary:null,peSecondary:[],emailDomain:null,publicProfileUrl:null,confidence:0.5,status:'unknown',
  firstSeenAt:stamp,lastSeenAt:stamp,email:null,phone:null,parentOffice:null,department:null,metadata:{},sources:[]};}
function output(id){
  const page={tool:id,generatedAt:stamp};
  if(additions.slice(0,2).includes(id))return{...page,total:0,data:[]};
  if(id==='search_lda_filings')return{...page,total:0,page:1,limit:15,data:[]};
  if(id==='search_acquisition_personnel')return{...page,data:[],total:0,page:1,limit:20};
  if(id==='get_acquisition_person')return{...page,person:person()};
  if(id==='get_bill_status'){
    const schema=JSON.parse(readFileSync(new URL('../retrieval-0.2/federal-legislation.schema.json',import.meta.url)));
    return{...page,authoritativeOwner:'congress_bill_status',currentStatus:'invalid_request',found:false,note:schema.$defs.FederalInvalidBillNote.const};
  }
  if(id==='search_floor_votes'){
    const schema=JSON.parse(readFileSync(new URL('../retrieval-0.2/federal-legislation.schema.json',import.meta.url)));
    return{...page,votesFound:0,votes:[],note:schema.$defs.FederalNoVotesNote.const};
  }
  if(id==='search_congress_bills')return{...page,total:0,page:1,limit:20,data:[]};
  return{tool:id,authoritativeOwner:'federal_evidence_current',currentStatus:'unavailable',billId:'119-hr-1',
    requestedVersionCode:null,found:false,coverage:{complete:true,truncated:false,nextCursor:null},
    note:'No current complete bill-text revision is available for 119-hr-1.'};
}
test('nine selected contracts preserve exact prior37 descriptors and139 original boundaries',()=>{
  assertCatalog(catalog);assert.equal(catalog.catalogVersion,'0.2.9');assert.equal(catalog.operations.length,67);
  const baseline=JSON.parse(readFileSync(new URL('../../../docs/qualification/candidates/read-continuation-20261012/integration-next/pr26-catalog-baseline.json',import.meta.url)));
  assert.deepEqual(catalog.operations.filter(row=>!additions.includes(row.operation.id)&&!referenceIds.includes(row.operation.id)),baseline.operations);
  for(const old of baseline.originals)assert.deepEqual(catalog.originals.find(row=>row.id===old.id),
    (additions.includes(old.id)||referenceIds.includes(old.id))?{...old,state:'mapped',replacement:{id:old.id,version:'0.2.0'}}:old);
  assert.equal(catalog.originals.length,139);assert.equal(catalog.originals.filter(x=>x.disposition==='selected').length,96);
  assert.equal(catalog.originals.filter(x=>x.disposition==='deferred').length,43);
  assert.equal(catalog.originals.filter(x=>x.state==='mapped').length,66);
  assert.equal(catalog.originals.filter(x=>x.disposition==='selected'&&x.state==='pending').length,30);
});
for(const id of additions){
  test(`next canonical normalized request, closed context and result: ${id}`,()=>{
    const contract=resolve(id),raw=request(id),ctx=context(id),result=contract.normalizeInput(raw,ctx);
    assert.deepEqual(result.request,raw);assert.equal(result.argumentsSha256,canonicalSha256(result.input));
    assert.ok(Object.isFrozen(result.input));assert.ok(Object.isFrozen(result.request));
    const page=output(id);assert.deepEqual(contract.assertOutput(page,{...ctx,request:raw}),page);
    assert.throws(()=>contract.assertOutput(page,ctx));
    assert.throws(()=>contract.normalizeInput({...raw,authorized:true},ctx));
    assert.throws(()=>contract.normalizeInput(raw,{...ctx,foreign:true}));
    assert.throws(()=>contract.assertOutput({...page,verified:true},{...ctx,request:raw}));
  });
  test(`next canonical raw schema pins and null-handler refusal: ${id}`,()=>{
    const {descriptor,binding}=resolve(id),bytes=readFileSync(new URL(`../retrieval-0.2/${binding.group}.schema.json`,import.meta.url));
    const schema=JSON.parse(bytes),sha256=createHash('sha256').update(bytes).digest('hex');
    for(const [field,name]of[['inputSchema',binding.input],['outputSchema',binding.output]])
      assert.deepEqual(descriptor[field],{id:`${schema.$id}#/$defs/${name}`,sha256});
    assert.equal(descriptor.handler,null);assert.equal(descriptor.availability,'unimplemented');
    assert.equal(descriptor.qualification,'pending');assert.equal(descriptor.retry.maxRetries,0);
    for(const mutate of [x=>x.inputSchema.sha256='0'.repeat(64),x=>x.handler={module:'synthetic/read.mjs',export:'read',sourceSha256:'0'.repeat(64)},
      x=>{x.availability='enabled';x.qualification='qualified';}]){
      const altered=structuredClone(catalog);mutate(altered.operations.find(x=>x.operation.id===id));assert.throws(()=>assertCatalog(altered));
    }
  });
}
test('current role is mandatory and rechecked before personnel contact release',()=>{
  for(const id of personnel){assert.throws(()=>resolve(id).normalizeInput(request(id)));assert.throws(()=>resolve(id).normalizeInput({...request(id),actorRole:'capiro_admin'},context(id)));}
  const id='get_acquisition_person',raw=request(id),page=output(id);page.person.email='synthetic@example.invalid';
  resolve(id).normalizeInput(raw,{actorRole:'capiro_admin'});
  resolve(id).assertOutput(page,{actorRole:'capiro_admin',request:raw});
  assert.throws(()=>resolve(id).assertOutput(page,{actorRole:'standard_user',request:raw}));
});
test('default Congress is trusted explicit context for both cohesive congressional families',()=>{
  for(const id of congress){assert.throws(()=>resolve(id).normalizeInput(request(id)));assert.throws(()=>resolve(id).normalizeInput({...request(id),defaultCongress:119},context(id)));}
  for(const id of ['get_bill_status','read_bill_text']){
    assert.equal(resolve(id).normalizeInput({billId:'H.R. 1'},{defaultCongress:119}).input.billId,'119-hr-1');
    assert.equal(resolve(id).normalizeInput({billId:'H.R. 1'},{defaultCongress:120}).input.billId,'120-hr-1');
  }
  assert.throws(()=>resolve('read_bill_text').assertOutput(output('read_bill_text'),{defaultCongress:120,request:request('read_bill_text')}));
});
test('all next canonical callbacks reject hostile getters without effects',()=>{
  let effects=0;const hostile={};Object.defineProperty(hostile,'query',{enumerable:true,get(){effects++;return'x';}});
  for(const id of additions){assert.throws(()=>resolve(id).normalizeInput(hostile,context(id)));assert.throws(()=>resolve(id).assertOutput(hostile,{...context(id),request:request(id)}));}
  assert.equal(effects,0);
});
