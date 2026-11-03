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
 assert.deepEqual(Object.keys(SEMANTIC_SEARCH_FAMILIES),[...CASES.map(([id])=>id),'semantic_search_dibbs_solicitations','semantic_search_sbir_topics']);
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
test('funding results carry the passage citation and attachment coverage; a result from the earlier Core shape stays admitted',()=>{
 const grant=wire.grants.response.results[0];
 assert.equal(grant.passage.sourceTable,'opportunity_attachment');assert.equal(typeof grant.passage.fileName,'string');
 assert.deepEqual(Object.keys(grant.documents),['attachments','withText','truncated','indexed']);
 assert.equal(grant.record.openForApplications,true);assert.equal(wire.contractOpportunities.response.results[0].record.currentNotice,true);
 assert.match(wire.grants.response.notes.join(' '),/UTF-16 offsets into the normalized extracted text, not page numbers/);
 for(const [id,vector] of CASES.slice(1)){
  const {request,response}=structuredClone(vector);
  for(const row of response.results){delete row.passage;delete row.documents;delete row.record.openForApplications;delete row.record.responseDateDesc;delete row.record.currentNotice;}
  assert.doesNotThrow(()=>contract(id).assertOutput(response,{request}),id);
 }
});
mutate('a bill result with a passage','semantic_search_bills',wire.bills,r=>{r.results[0].passage=structuredClone(wire.grants.response.results[0].passage);});
mutate('attachment coverage above the attachments','semantic_search_grants',wire.grants,r=>{r.results[0].documents.withText=5;});
mutate('passage from an unknown table','semantic_search_grants',wire.grants,r=>{r.results[0].passage.sourceTable='raw_jsonb';});
mutate('passage offsets that are not counts','semantic_search_contract_opportunities',wire.contractOpportunities,r=>{r.results[0].passage.start=-1;});
mutate('grant open flag that is not a boolean','semantic_search_grants',wire.grants,r=>{r.results[0].record.openForApplications='yes';});
// --- Active DIBBS / SBIR bindings (submitted SCRUM250 d00691 wire, projected fixtures) --------------------------
const DIBBS='semantic_search_dibbs_solicitations',SBIR='semantic_search_sbir_topics';
const activeCase=id=>{const vector=wire[id===DIBBS?'dibbs':'sbirTopics'];return {request:structuredClone(vector.request),response:structuredClone(vector.response)};};
test('the active DIBBS read admits the submitted shape and keeps the archived-text provenance',()=>{
 const {request,response}=activeCase(DIBBS),c=contract(DIBBS);
 assert.equal(c.binding.group,'semantic-search');
 assert.doesNotThrow(()=>c.assertOutput(response,{request}));
 assert.deepEqual(c.normalizeInput(request).input,{limit:5,...request});
 const row=response.results[0];
 assert.equal(row.reference,`tango_dibbs_solicitation:${row.record.id}`);
 assert.equal(row.passage.binding,'archived_content_sha256');
 assert.equal(row.passage.canonicalRecordId,row.record.id);assert.equal(row.passage.providerRecordId,row.record.providerId);
 assert.equal(row.passage.extractionMethod,'local_parser');assert.equal(typeof row.passage.truncated,'boolean');
 assert.notEqual(row.passage.documentHash,row.passage.attachmentContentSha256);
 assert.deepEqual(Object.keys(row.documents),['attachments','withText','truncated','indexed']);
 assert.equal(row.record.agency,'Defense Logistics Agency');assert.equal(row.record.currentSolicitation,true);
});
test('the active SBIR read admits the provider synopsis and carries no documents block',()=>{
 const {request,response}=activeCase(SBIR),c=contract(SBIR);
 assert.doesNotThrow(()=>c.assertOutput(response,{request}));
 const row=response.results[0];
 assert.equal(row.reference,`tango_sbir_topic:${row.record.id}`);
 assert.equal(Object.hasOwn(row,'documents'),false,'SBIR publishes no attachment coverage');
 assert.equal(row.passage.sourceTable,'tango_sbir_topic');assert.equal(row.passage.binding,'provider_topic_id');
 assert.equal(row.passage.attachmentContentSha256,null);assert.equal(row.passage.archivedAt,null);
 assert.equal(row.passage.extractionMethod,null);assert.equal(row.passage.truncated,null);
 assert.equal(row.record.activity,'Open','the provider activity spelling is preserved, never lowercased');
});
test('the active descriptors pin the active input and their own output definitions',()=>{
 const dibbs=contract(DIBBS).descriptor,sbir=contract(SBIR).descriptor;
 for(const d of [dibbs,sbir]){
  assert.equal(d.inputSchema.id,'urn:meri:retrieval:semantic-search:0.2.0#/$defs/ActiveSemanticSearchInput');
  assert.equal(d.inputSchema.sha256,d.outputSchema.sha256,'one shared document, one pin');
 }
 assert.equal(dibbs.outputSchema.id,'urn:meri:retrieval:semantic-search:0.2.0#/$defs/SemanticDibbsOutput');
 assert.equal(sbir.outputSchema.id,'urn:meri:retrieval:semantic-search:0.2.0#/$defs/SemanticSbirTopicOutput');
});
test('the old three descriptors keep their definitions while the shared document grows',()=>{
 for(const [id] of CASES){
  const d=contract(id).descriptor;
  assert.equal(d.inputSchema.id,'urn:meri:retrieval:semantic-search:0.2.0#/$defs/SemanticSearchInput');
  assert.equal(d.outputSchema.id,'urn:meri:retrieval:semantic-search:0.2.0#/$defs/SemanticSearchOutput');
 }
});
test('the active reads refuse a filter their family does not apply and any unknown argument',()=>{
 for(const patch of [{status:'posted'},{congress:119},{naics:'541512'},{includeInactive:true},{tenantId:'forged'},{clientId:'00000003-0000-4000-8000-000000000001'}])
  assert.throws(()=>contract(DIBBS).normalizeInput({query:'radios',...patch}),JSON.stringify(patch));
 assert.throws(()=>contract(SBIR).normalizeInput({query:'radios',dateFrom:'2027-01-01',dateTo:'2026-01-01'}));
});
test('the active reads measure the normalized query in UTF-16 units, not schema code points',()=>{
 const c=contract(DIBBS);
 assert.doesNotThrow(()=>c.normalizeInput({query:'🔧'.repeat(1000)}));   // 2,000 UTF-16 units
 assert.throws(()=>c.normalizeInput({query:'🔧'.repeat(1001)}));         // 2,002 units, 1,001 code points
 assert.throws(()=>c.normalizeInput({query:'  a  '}));                   // collapses to one unit
 assert.deepEqual(c.normalizeInput({query:'  ruggedized   radio '}).input,{query:'ruggedized radio',limit:10});
});
const activeMutate=(label,id,change)=>test(label,()=>{
 const {request,response}=activeCase(id);contract(id).assertOutput(response,{request});change(response,request);
 assert.throws(()=>contract(id).assertOutput(response,{request}));
});
activeMutate('another tool answered the active page',DIBBS,r=>{r.tool=SBIR;});
activeMutate('the active page total is not its size',DIBBS,r=>{r.total=2;});
activeMutate('the active page exceeds the requested limit',DIBBS,(r,q)=>{q.limit=1;r.results.push(structuredClone(r.results[0]));r.total=2;});
activeMutate('a canonical reference of another family',DIBBS,r=>{r.results[0].reference=`tango_sbir_topic:${r.results[0].record.id}`;});
activeMutate('the passage names another canonical record',DIBBS,r=>{r.results[0].passage.canonicalRecordId='5f8c1d2e-0000-4000-8000-000000000000';});
activeMutate('the passage names another provider record',DIBBS,r=>{r.results[0].passage.providerRecordId='SPE7M826T9999';});
activeMutate('the text and archive hashes are equated',DIBBS,r=>{r.results[0].passage.documentHash=r.results[0].passage.attachmentContentSha256;});
activeMutate('a DIBBS passage bound by the provider key',DIBBS,r=>{r.results[0].passage.binding='provider_topic_id';});
activeMutate('a DIBBS passage from the SBIR table',DIBBS,r=>{r.results[0].passage.sourceTable='tango_sbir_topic';});
activeMutate('a DIBBS passage without the archived byte hash',DIBBS,r=>{r.results[0].passage.attachmentContentSha256=null;});
activeMutate('an active solicitation with no attachment coverage',DIBBS,r=>{r.results[0].documents.attachments=0;});
activeMutate('an SBIR passage claiming archived bytes',SBIR,r=>{r.results[0].passage.attachmentContentSha256='b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1';});
activeMutate('an SBIR passage claiming an archive time',SBIR,r=>{r.results[0].passage.archivedAt='2026-11-02T09:40:00.000Z';});
activeMutate('an SBIR result carrying a documents block',SBIR,r=>{r.results[0].documents={attachments:1,withText:1,truncated:0,indexed:1};});
activeMutate('a passage whose chunk ends before it starts',DIBBS,r=>{r.results[0].passage.start=20;r.results[0].passage.end=10;});
activeMutate('published scores that increase down the page',DIBBS,r=>{r.results.push({...structuredClone(r.results[0]),reference:'tango_dibbs_solicitation:5f8c1d2e-9a4b-4c6d-8e7f-0a1b2c3d4e60',score:0.9,record:{...structuredClone(r.results[0].record),id:'5f8c1d2e-9a4b-4c6d-8e7f-0a1b2c3d4e60'}});r.total=2;});
test('an inclusive close-date bound cannot be satisfied by an unknown date',()=>{
 const {request,response}=activeCase(DIBBS);
 const unknown=structuredClone(response);unknown.results[0].record.closeDate=null;
 assert.doesNotThrow(()=>contract(DIBBS).assertOutput(unknown,{request:{query:request.query}}),'an unbound read leaves the date unknown');
 assert.throws(()=>contract(DIBBS).assertOutput(unknown,{request}));
 const late=structuredClone(response);late.results[0].record.closeDate='2027-12-31';
 assert.throws(()=>contract(DIBBS).assertOutput(late,{request}));
});
test('a DIBBS quantity stays an exact decimal string and is never coerced',()=>{
 const {request,response}=activeCase(DIBBS);
 assert.equal(response.results[0].record.quantity,'12.000');
 const numeric=structuredClone(response);numeric.results[0].record.quantity=12;
 assert.throws(()=>contract(DIBBS).assertOutput(numeric,{request}));
 const grouped=structuredClone(response);grouped.results[0].record.quantity='1,200';
 assert.throws(()=>contract(DIBBS).assertOutput(grouped,{request}));
});
test('an empty active page keeps the family denominator and is a success, not a refusal',()=>{
 const {request,response}=wire.emptyActive;
 assert.doesNotThrow(()=>contract(DIBBS).assertOutput(response,{request}));
 assert.equal(response.total,0);assert.ok(response.coverage.totalRecords>response.coverage.indexedRecords,'missing records stay in the denominator');
 assert.match(response.notes[2],/No close match among the indexed active DIBBS solicitations/);
 const bad=structuredClone(response);bad.coverage.indexedRecords=bad.coverage.totalRecords+1;
 assert.throws(()=>contract(DIBBS).assertOutput(bad,{request}));
});
