/** Offline source mapping controls. No SDK/compiler/provider/DB/process spawning. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import catalog from '../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {CATALOG_OPERATION_BINDINGS} from '../../packages/contracts/retrieval-0.2/catalog-validation.mjs';
import {READ_FAMILIES} from '../../apps/worker/conversation/reads/families.mjs';
import {loadSourceExposure,reconcileSourceExposure} from './source-exposure.mjs';
import {generateExposure,runCli} from './cli.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url)),snapshot=loadSourceExposure(root);
const row=id=>snapshot.rows.find(row=>row.id===id),registered=snapshot.generalRegistration.flatMap(row=>row.operations);
function synthetic(){return {catalog:structuredClone(catalog),bindings:CATALOG_OPERATION_BINDINGS,families:READ_FAMILIES,
 adapters:[{operations:[...registered],paths:['synthetic adapter path']}],skills:[],admittedSkills:[],provenance:{}};}
const refuses=work=>assert.throws(work,error=>error.code==='SOURCE_EXPOSURE_INVALID');

test('96 selected and43 excluded are reconciled separately from58 registered operations',()=>{
 assert.equal(snapshot.rows.length,96);assert.equal(snapshot.counts.selectedSourceReads,82);assert.equal(snapshot.counts.selectedProductOrGoverned,14);
 assert.equal(snapshot.counts.registeredGeneralOperations,58);assert.equal(snapshot.counts.registeredFamilies,35);
 assert.equal(snapshot.counts.generalSelectedSourceReads,56);assert.equal(snapshot.counts.generalSelectedProductStateReads,1);assert.equal(snapshot.counts.generalHistoricalOperations,1);
 assert.equal(snapshot.counts.excludedCapabilities,43);assert.equal(snapshot.counts.live,0);
});
test('missing complete coverage counts eight restricted adapters and18 absent adapters exactly once',()=>{
 assert.deepEqual(snapshot.existingAdaptersWithoutGeneralExposure,[]);assert.equal(snapshot.counts.existingSourceAdaptersWithoutGeneralExposure,0);
 assert.equal(snapshot.counts.completeSourceAdapters,56);assert.equal(snapshot.counts.partialSourceAdapters,8);assert.equal(snapshot.counts.absentSourceAdapters,18);
 assert.equal(snapshot.counts.missingSourceAdapters,26);assert.equal(snapshot.counts.missingAdaptersDeclaredBySkills,17);assert.equal(snapshot.counts.missingAdaptersWithoutSkillDeclaration,9);
 assert.equal(snapshot.counts.completeSourceAdapters+snapshot.counts.partialSourceAdapters+snapshot.counts.absentSourceAdapters,82);
 const gaps=snapshot.rows.filter(row=>row.kind==='source-read'&&row.state!=='adapter-present');
 for(const gap of gaps){if(gap.state==='adapter-missing')assert.deepEqual(gap.adapterPaths,[]);else assert.ok(gap.adapterPaths.length);assert.deepEqual(gap.generalOperations,[]);assert.deepEqual(gap.sourceAdmittedSkills,[]);assert.ok(Array.isArray(gap.requiredContextKeys));}
 assert.deepEqual(snapshot.missingAdapterFamilies.flatMap(row=>row.operations).sort(),gaps.map(row=>row.operation).sort());
});

test('mixed SDK families expose economic and graph only; loading never manufactures sibling adapters',()=>{
 for(const id of ['query_economic_data','query_knowledge_graph']){
  assert.equal(row(id).state,'adapter-present');assert.deepEqual(row(id).generalOperations,[id]);assert.ok(row(id).adapterPaths.some(path=>path.includes('/general-reads/families/')));
 }
 for(const id of ['search_federal_grants','search_federal_awards','search_client_knowledge']){
  assert.equal(row(id).state,'adapter-missing');assert.deepEqual(row(id).adapterPaths,[]);assert.deepEqual(row(id).generalOperations,[]);assert.equal(registered.includes(id),false);
 }
 assert.deepEqual(snapshot.generalRegistration.find(row=>row.family==='public-data').operations,['query_economic_data']);
 assert.deepEqual(snapshot.generalRegistration.find(row=>row.family==='client-knowledge-search').operations,['query_knowledge_graph']);
});

test('new curated source declarations name exactly ten implemented operations and eight partial inputs',()=>{
 const families=['public-data','client-knowledge-search','state-status-votes','tracked-bills','public-domain-hearings','research-legal-legislation','research-legal-news','outreach-query'];
 const declared=JSON.parse(readFileSync(new URL('../general-reads/adapters.json',import.meta.url),'utf8')).adapters.filter(adapter=>families.includes(adapter.family));
 assert.equal(declared.length,8);assert.equal(declared.flatMap(adapter=>adapter.operations).length,10);assert.equal(declared.flatMap(adapter=>adapter.partialOperations??[]).length,8);
 for(const adapter of declared){
  const text=adapter.declaredIn.map(path=>readFileSync(new URL(`../../${path}`,import.meta.url),'utf8')).join('\n');
  for(const id of adapter.operations)assert.ok(text.includes(`'${id}'`),`${adapter.path}: ${id}`);
 }
});

test('the eight partial-input operations keep source evidence while remaining outside SDK exposure',()=>{
 const expected=['get_state_bill_status','search_state_floor_votes','search_tracked_bills','search_committee_hearings','search_legislative_research','get_legal_reference','search_legiwatch_news','query_outreach'].sort();
 assert.deepEqual(snapshot.partialAdapterFamilies.flatMap(row=>row.operations).sort(),expected);
 assert.equal(snapshot.counts.partialSourceAdaptersWithoutGeneralExposure,8);assert.equal(snapshot.partialAdapterFamilies.length,6);
 for(const id of expected){const entry=row(id);assert.equal(entry.state,'adapter-partial');assert.ok(entry.adapterPaths.includes(`apps/gateway/sources/${entry.family}/handler.mjs`));assert.ok(entry.adapterPaths.includes(`apps/gateway/general-reads/families/${entry.family}.mjs`));assert.deepEqual(entry.generalOperations,[]);assert.equal(registered.includes(id),false);}
});

test('governed data adapter and corrected raw SDK selector are exposed as source only',()=>{
 const entry=row('search_capiro_data');assert.equal(entry.state,'adapter-present');assert.deepEqual(entry.generalOperations,['search_capiro_data']);
 assert.ok(entry.adapterPaths.includes('apps/gateway/sources/data-search/handler.mjs'));
 assert.equal(registered.includes(entry.operation),true);assert.equal(Object.hasOwn(READ_FAMILIES,'data-search'),true);
});
test('only source-admitted original skills can establish a source route',()=>{
 assert.deepEqual(snapshot.admittedSkills,['quick_skill.relationship_brief','quick_skill.commitments_audit']);
 for(const entry of snapshot.rows)for(const skill of entry.sourceAdmittedSkills){assert.ok(snapshot.admittedSkills.includes(skill));assert.ok(entry.declaredBySkills.includes(skill));}
 assert.ok(row('get_bill_status').declaredBySkills.length);assert.deepEqual(row('get_bill_status').sourceAdmittedSkills,[]);
 assert.ok(row('query_tasks').sourceAdmittedSkills.length);
 assert.equal(snapshot.counts.sourceReadsWithCurrentContractDeclarations,52);assert.equal(snapshot.counts.sourceReadsWithHistoricalOnlySkillDeclaration,1);
 assert.equal(snapshot.counts.sourceReadsWithAdmittedSkillSourceRoute,11);
});
test('historical action-items contract is an additional route for one selected successor',()=>{
 assert.equal(row('query_action_items').operation,'actions.query');assert.deepEqual(row('query_action_items').generalOperations,['actions.query','query_action_items']);
 assert.ok(row('query_action_items').sourceAdmittedSkills.length);assert.equal(snapshot.rows.filter(row=>row.id==='query_action_items').length,1);
 assert.equal(row('query_action_items').currentContractDeclared,false);
 assert.deepEqual(row('query_action_items').sourceAdmittedOperations,['query_action_items']);
});
test('read-only product state is counted separately; writes and other product operations stay outside meri_reads',()=>{
 assert.equal(row('list_memory_proposals').kind,'product-or-governed');assert.deepEqual(row('list_memory_proposals').generalOperations,['memory.list_own_proposals']);
 for(const entry of snapshot.rows.filter(row=>row.kind==='product-or-governed'&&row.id!=='list_memory_proposals'))assert.deepEqual(entry.generalOperations,[],entry.id);
 const descriptors=new Map(catalog.operations.map(entry=>[entry.operation.id,entry]));
 for(const operation of registered){assert.equal(descriptors.get(operation).sideEffect,'none');assert.equal(descriptors.get(operation).approvalBoundary,'none');}
});
test('all43 exclusions remain absent from both selected mappings and general registration',()=>{
 for(const original of catalog.originals.filter(row=>row.disposition==='deferred')){assert.equal(row(original.id),undefined);assert.equal(registered.includes(original.id),false);}
});

test('all63 reviewed producer records correlate exact operations, context keys and immutable report pointers',()=>{
 const mapped=snapshot.rows.filter(row=>row.backendProducer);assert.equal(mapped.length,63);assert.equal(snapshot.counts.mappedBackendProducers,63);
 assert.equal(new Set(mapped.map(row=>row.operation)).size,63);assert.equal(new Set(mapped.map(row=>row.family)).size,33);
 assert.equal(snapshot.backendProducerEvidence.backend.commit,'b525032222515d636b0dae2d46e40c7c3d8b5528');
 assert.equal(snapshot.backendProducerEvidence.reviewedIndex.sha256,'c6ebaf2987015db466e88b9d4c550ab77878582ab7142ab256d298ae16ed0def');
 assert.equal(snapshot.backendProducerEvidence.reviewedIndex.originalLocalV2Sha256,'5a498e4cd2e06a118d54bae3e0caba44e9418c524b57f9d27481a51c37c2dad8');
 assert.equal(snapshot.backendProducerEvidence.publication.commit,'384325afaaf7ad34aeb9ff9b2f183d667ee17343');
 for(const entry of mapped){assert.deepEqual(entry.requiredContextKeys,entry.backendProducer.requiredContextKeys);assert.match(entry.backendProducer.evidence.sha256,/^[a-f0-9]{64}$/);}
 assert.match(row('get_acquisition_person').backendProducer.currentContext.join(' '),/ctx.role/);
 assert.ok(snapshot.backendProducerEvidence.constraints.some(value=>value.includes('audit rows')));
 const base=JSON.parse(readFileSync(new URL('./backend-producers.json',import.meta.url),'utf8'));
 for(const mutate of [m=>m.operations.pop(),m=>m.operations[1]=m.operations[0],m=>m.operations[0].requiredContextKeys=['modelAuthority'],m=>m.operations[0].evidence.sha256='0'.repeat(64)]){
  const input=synthetic();input.backendMapping=structuredClone(base);mutate(input.backendMapping);refuses(()=>reconcileSourceExposure(input));
 }
});
test('current source provenance measures declared canonical paths without claiming qualification',()=>{
 assert.match(snapshot.note,/No qualification/);assert.equal(Object.keys(snapshot.provenance).some(path=>path.includes('node_modules')),false);
 for(const [path,digest] of Object.entries(snapshot.provenance))assert.equal(createHash('sha256').update(readFileSync(new URL(`../../${path}`,import.meta.url))).digest('hex'),digest,path);
 assert.ok(row('get_research_portfolio').adapterPaths.includes('apps/gateway/sources/research-portfolio/handler.mjs'));
 assert.ok(row('get_research_portfolio').adapterPaths.includes('apps/gateway/general-reads/families/research-portfolio.mjs'));
});

test('directory source is exposed while retained research/Florida scope and zero-live gates remain explicit',()=>{
 for(const id of ['get_committee_roster','list_members','get_research_portfolio','get_research_portfolio_changes','get_florida_budget_project']){
  assert.equal(row(id).state,'adapter-present');assert.deepEqual(row(id).generalOperations,[id]);
 }
 assert.equal(snapshot.missingAdapterFamilies.length,15);assert.equal(snapshot.counts.live,0);
 assert.ok(row('get_committee_roster').adapterPaths.includes('apps/gateway/sources/legislative-directory/handler.mjs'));
 assert.ok(row('list_members').adapterPaths.includes('apps/gateway/general-reads/families/legislative-directory.mjs'));
});
test('registering a governed write family refuses instead of expanding the read server',()=>{
 const input=synthetic();input.families={...READ_FAMILIES,'command-tools':{clientScope:'optional'}};refuses(()=>reconcileSourceExposure(input));
});
test('registered family without adapter fails closed',()=>{
 const input=synthetic();input.adapters[0].operations=input.adapters[0].operations.filter(id=>id!=='get_research_portfolio');refuses(()=>reconcileSourceExposure(input));
});

test('wrong, foreign, duplicate, nonstring and empty SDK operationIds refuse',()=>{
 for(const operationIds of [[],['query_economic_data','query_economic_data'],['get_bill_status'],['unknown_operation'],[42],null,'query_economic_data',undefined]){
  const input=synthetic();input.families={...input.families,'public-data':{clientScope:'optional',operationIds}};
  refuses(()=>reconcileSourceExposure(input));
 }
 const input=synthetic();input.families={...input.families,'public-data':{clientScope:'optional',operationIds:['search_federal_grants']}};
 refuses(()=>reconcileSourceExposure(input));
});

test('partialOperations must be unique nonempty IDs contained in that adapter declaration',()=>{
 for(const partialOperations of [['get_bill_status'],['search_federal_grants','search_federal_grants'],[],null,'query_economic_data',[42]]){
  const input=synthetic();input.adapters.push({operations:['search_federal_grants'],partialOperations,paths:['partial adapter']});
  refuses(()=>reconcileSourceExposure(input));
 }
 const input=synthetic();input.adapters.push({operations:['search_federal_grants'],partialOperations:['search_federal_grants'],paths:['partial adapter']});
 const result=reconcileSourceExposure(input),entry=result.rows.find(row=>row.id==='search_federal_grants');
 assert.equal(entry.state,'adapter-partial');assert.deepEqual(entry.adapterPaths,['partial adapter']);assert.deepEqual(entry.generalOperations,[]);
});

test('registering a partial-input operation refuses even with a valid canonical operationIds subset',()=>{
 const input=synthetic();input.adapters.push({operations:['get_state_bill_status'],partialOperations:['get_state_bill_status'],paths:['restricted state adapter']});
 input.families={...input.families,'state-status-votes':{clientScope:'optional',operationIds:['get_state_bill_status']}};
 refuses(()=>reconcileSourceExposure(input));
 const existing=synthetic();existing.adapters[0].partialOperations=['query_economic_data'];refuses(()=>reconcileSourceExposure(existing));
});

test('renderer calls partial coverage missing complete implementation and never calls it exposed',()=>{
 const markdown=generateExposure(root).markdown;
 assert.match(markdown,/56 complete \+ 8 partial input \+ 18 absent = 82/);
 assert.match(markdown,/Partial-input source adapters withheld from SDK exposure \| 8/);
 assert.match(markdown,/Every complete source adapter already present is SDK-exposed/);
 assert.match(markdown,/Partial-input adapter family \| Restricted operations \(not SDK-exposed\)/);
 assert.match(markdown,/Family lacking complete adapters/);
 assert.doesNotMatch(markdown,/Every canonical source adapter already present is exposed/);
});
test('a manifest declaration alone never manufactures an adapter or source route',()=>{
 const input=synthetic();input.families={...input.families};delete input.families['federal-legislation'];
 input.adapters[0].operations=input.adapters[0].operations.filter(id=>id!=='get_bill_status');
 input.skills=[{id:'synthetic.skill',operations:['get_bill_status']}];input.admittedSkills=['synthetic.skill'];
 const result=reconcileSourceExposure(input).rows.find(row=>row.id==='get_bill_status');assert.deepEqual(result.declaredBySkills,['synthetic.skill']);assert.deepEqual(result.sourceAdmittedSkills,[]);assert.equal(result.state,'adapter-missing');
});
test('duplicate adapter claims and changed selected scope refuse',()=>{
 const input=synthetic();input.adapters.push({operations:[registered[0]],paths:['duplicate']});refuses(()=>reconcileSourceExposure(input));
 const changed=synthetic();changed.catalog.originals=changed.catalog.originals.filter(row=>row.disposition!=='selected'||row.id!==snapshot.rows[0].id);refuses(()=>reconcileSourceExposure(changed));
});
test('a duplicate canonical binding refuses rather than choosing an arbitrary adapter family',()=>{
 const input=synthetic();input.bindings=[...input.bindings,input.bindings[0]];refuses(()=>reconcileSourceExposure(input));
});
test('targeted refresh preserves all eight historical fields from exact base08f65a79',()=>{
 const historical=JSON.parse(execFileSync('git',['show','08f65a79b99e5b269a8c7f7e82b6b8de225caae8:docs/coordination/ledgers/scope-ledger.json'],{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024}));
 const next=generateExposure(root).ledger;
 for(const field of ['capabilities','ownerDirection','coverageOrigin','provenance','counts','gates','excludedReferences','ownershipGraph'])assert.deepEqual(next[field],historical[field],field);
 assert.deepEqual(next.sourceExposure,snapshot);
});
test('committed current exposure regenerates exactly with a scoped drift check',async()=>{
 const generated=generateExposure(root);
 assert.equal(generated.json,readFileSync(new URL('../../docs/coordination/ledgers/scope-ledger.json',import.meta.url),'utf8'));
 assert.equal(generated.markdown,readFileSync(new URL('../../docs/coordination/ledgers/MERI-FINAL-SCOPE-LEDGER-20261015.md',import.meta.url),'utf8'));
 assert.equal(await runCli(['--check-exposure'],{root,out(){},err(){}}),0);
});
