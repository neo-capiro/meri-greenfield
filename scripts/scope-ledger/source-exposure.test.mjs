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

test('96 selected and43 excluded are reconciled separately from66 registered operations',()=>{
 assert.equal(snapshot.rows.length,96);assert.equal(snapshot.counts.selectedSourceReads,82);assert.equal(snapshot.counts.selectedProductOrGoverned,14);
 assert.equal(snapshot.counts.registeredGeneralOperations,66);assert.equal(snapshot.counts.registeredFamilies,37);
 assert.equal(snapshot.counts.generalSelectedSourceReads,64);assert.equal(snapshot.counts.generalSelectedProductStateReads,1);assert.equal(snapshot.counts.generalHistoricalOperations,1);
 assert.equal(snapshot.counts.excludedCapabilities,43);assert.equal(snapshot.counts.live,0);
});
test('missing complete coverage counts eight incomplete adapters and ten absent adapters exactly once',()=>{
 assert.deepEqual(snapshot.existingAdaptersWithoutGeneralExposure,[]);assert.equal(snapshot.counts.existingSourceAdaptersWithoutGeneralExposure,0);
 assert.equal(snapshot.counts.completeSourceAdapters,64);assert.equal(snapshot.counts.partialSourceAdapters,8);assert.equal(snapshot.counts.absentSourceAdapters,10);
 assert.equal(snapshot.counts.missingSourceAdapters,18);assert.equal(snapshot.counts.missingAdaptersDeclaredBySkills,11);assert.equal(snapshot.counts.missingAdaptersWithoutSkillDeclaration,7);
 assert.equal(snapshot.counts.completeSourceAdapters+snapshot.counts.partialSourceAdapters+snapshot.counts.absentSourceAdapters,82);
 const gaps=snapshot.rows.filter(row=>row.kind==='source-read'&&row.state!=='adapter-present');
 for(const gap of gaps){if(gap.state==='adapter-missing')assert.deepEqual(gap.adapterPaths,[]);else assert.ok(gap.adapterPaths.length);assert.deepEqual(gap.generalOperations,[]);assert.deepEqual(gap.sourceAdmittedSkills,[]);assert.ok(Array.isArray(gap.requiredContextKeys));}
 assert.deepEqual(snapshot.missingAdapterFamilies.flatMap(row=>row.operations).sort(),gaps.map(row=>row.operation).sort());
});

test('economic subset and complete semantic/graph SDK family require actual canonical adapters',()=>{
 for(const id of ['query_economic_data','query_knowledge_graph','search_client_knowledge']){
  assert.equal(row(id).state,'adapter-present');assert.deepEqual(row(id).generalOperations,[id]);assert.ok(row(id).adapterPaths.some(path=>path.includes('/general-reads/families/')));
 }
 for(const id of ['search_federal_grants','search_federal_awards']){
  assert.equal(row(id).state,'adapter-missing');assert.deepEqual(row(id).adapterPaths,[]);assert.deepEqual(row(id).generalOperations,[]);assert.equal(registered.includes(id),false);
 }
 assert.deepEqual(snapshot.generalRegistration.find(row=>row.family==='public-data').operations,['query_economic_data']);
 assert.deepEqual(snapshot.generalRegistration.find(row=>row.family==='client-knowledge-search').operations,['query_knowledge_graph','search_client_knowledge']);
});

test('bounded curated source declarations name eighteen operations and eight partial input/resource reads',()=>{
 const families=['public-data','client-knowledge-search','state-status-votes','tracked-bills','public-domain-hearings','research-legal-legislation','research-legal-news','outreach-query','business-development','funding-opportunities'];
 const declared=JSON.parse(readFileSync(new URL('../general-reads/adapters.json',import.meta.url),'utf8')).adapters.filter(adapter=>families.includes(adapter.family));
 assert.equal(declared.length,10);assert.equal(declared.flatMap(adapter=>adapter.operations).length,18);assert.equal(declared.flatMap(adapter=>adapter.partialOperations??[]).length,8);
 for(const adapter of declared){
  const text=adapter.declaredIn.map(path=>readFileSync(new URL(`../../${path}`,import.meta.url),'utf8')).join('\n');
  for(const id of adapter.operations)assert.ok(text.includes(`'${id}'`),`${adapter.path}: ${id}`);
 }
});

test('the eight incomplete input/resource operations keep source evidence outside SDK exposure',()=>{
 const expected=['get_state_bill_status','search_state_floor_votes','search_tracked_bills','search_committee_hearings','search_legislative_research','get_legal_reference','search_legiwatch_news','query_outreach'].sort();
 assert.deepEqual(snapshot.partialAdapterFamilies.flatMap(row=>row.operations).sort(),expected);
 assert.equal(snapshot.counts.partialSourceAdaptersWithoutGeneralExposure,8);assert.equal(snapshot.partialAdapterFamilies.length,6);
 for(const id of expected){const entry=row(id);assert.equal(entry.state,'adapter-partial');assert.ok(entry.adapterPaths.includes(`apps/gateway/sources/${entry.family}/handler.mjs`));assert.ok(entry.adapterPaths.includes(`apps/gateway/general-reads/families/${entry.family}.mjs`));assert.deepEqual(entry.generalOperations,[]);assert.equal(registered.includes(id),false);}
});

test('only complete BD context and recent changes are promoted; evidence remains absent and SDK-held',()=>{
 const ids=['get_business_development_context','get_business_development_recent_changes'];
 const declared=JSON.parse(readFileSync(new URL('../general-reads/adapters.json',import.meta.url),'utf8')).adapters.find(adapter=>adapter.family==='business-development');
 assert.deepEqual(declared.operations,ids);assert.equal(Object.hasOwn(declared,'partialOperations'),false);
 assert.match(declared.adapterChecks.join(' '),/personal.*coherent tenant\/private-user scopes/);
 assert.match(declared.adapterChecks.join(' '),/client authority retains the exact native identity\/context receipt/);
 assert.doesNotMatch(declared.adapterChecks.join(' '),/HTTP proves|PARTIAL_RESOURCE/);
 for(const id of ids){const entry=row(id);assert.equal(entry.state,'adapter-present');assert.ok(entry.adapterPaths.includes('apps/gateway/sources/business-development/request-context.mjs'));assert.deepEqual(entry.generalOperations,[id]);assert.equal(registered.includes(id),true);}
 const held=row('get_business_development_evidence');assert.equal(held.state,'adapter-missing');assert.deepEqual(held.adapterPaths,[]);assert.deepEqual(held.generalOperations,[]);
 assert.deepEqual(READ_FAMILIES['business-development'].operationIds,ids);
 assert.deepEqual(snapshot.generalRegistration.find(entry=>entry.family==='business-development').operations,ids);
 const input=synthetic();input.families={...input.families,'business-development':{clientScope:'optional'}};refuses(()=>reconcileSourceExposure(input));
});

test('all five complete funding sources are SDK-exposed only under the actual required-client family policy',()=>{
 const ids=['search_funding_opportunities','get_funding_opportunity_requirements','get_funding_opportunity','get_opportunity_client_context','get_opportunity_government_landscape'];
 const declared=JSON.parse(readFileSync(new URL('../general-reads/adapters.json',import.meta.url),'utf8')).adapters.find(adapter=>adapter.family==='funding-opportunities');
 assert.deepEqual(declared.operations,ids);assert.equal(Object.hasOwn(declared,'partialOperations'),false);
 assert.match(declared.adapterChecks.join(' '),/51c157444ac43035eeb489ff46aee5a4e89ba3ac \/ tree 54af881dddef397db0ff215d6eb2a72d74c0d1bd/);
 assert.match(declared.adapterChecks.join(' '),/qualification issuer must bind.*actual deployed build/);
 assert.match(declared.adapterChecks.join(' '),/does not automatically detect Core protocol\/build compatibility/);
 assert.equal(READ_FAMILIES['funding-opportunities']?.clientScope,'required');
 assert.deepEqual(snapshot.generalRegistration.find(entry=>entry.family==='funding-opportunities')?.operations,[...ids].sort());
 for(const id of ids){
  const entry=row(id);assert.equal(entry.state,'adapter-present');assert.deepEqual(entry.requiredContextKeys,['asOf']);assert.deepEqual(entry.generalOperations,[id]);assert.deepEqual(entry.sourceAdmittedSkills,[]);
  assert.ok(entry.adapterPaths.includes('packages/contracts/native-read-observation-0.2/validate.mjs'));assert.ok(entry.adapterPaths.includes('apps/gateway/sources/funding-opportunities/request-context.mjs'));
  const input=synthetic();input.adapters[0].partialOperations=[id];refuses(()=>reconcileSourceExposure(input));
 }
 const input=synthetic();input.adapters[0].partialOperations=ids;refuses(()=>reconcileSourceExposure(input));
});

test('funding completion projection preserves other incomplete reads and does not promote current source',()=>{
 const ids=['search_funding_opportunities','get_funding_opportunity_requirements','get_funding_opportunity','get_opportunity_client_context','get_opportunity_government_landscape'];
 const before=JSON.stringify(snapshot),input=synthetic();
 input.adapters=snapshot.rows.filter(entry=>entry.adapterPaths.length&&(entry.kind==='source-read'||entry.generalOperations.length)).map(entry=>({
  operations:[...new Set([entry.operation,...entry.generalOperations])],paths:[...entry.adapterPaths],
  ...(entry.state==='adapter-partial'?{partialOperations:[entry.operation]}:{}),
 }));
 const skillIds=[...new Set(snapshot.rows.flatMap(entry=>entry.declaredBySkills))];
 input.skills=skillIds.map(id=>({id,operations:[...new Set(snapshot.rows.filter(entry=>entry.declaredBySkills.includes(id)).flatMap(entry=>[entry.operation,...entry.sourceAdmittedOperations]))]}));
 input.admittedSkills=[...snapshot.admittedSkills];
 const baseline=reconcileSourceExposure(input);
 for(const key of ['completeSourceAdapters','partialSourceAdapters','absentSourceAdapters','registeredGeneralOperations','registeredFamilies','missingAdaptersDeclaredBySkills','missingAdaptersWithoutSkillDeclaration'])assert.equal(baseline.counts[key],snapshot.counts[key],key);
 for(const adapter of input.adapters)if(adapter.operations.some(id=>ids.includes(id)))delete adapter.partialOperations;
 input.families={...input.families,'funding-opportunities':{clientScope:'required',operationIds:ids}};
 const projected=reconcileSourceExposure(input);
 assert.deepEqual([
  projected.counts.selectedSourceReads,projected.counts.completeSourceAdapters,projected.counts.partialSourceAdapters,projected.counts.absentSourceAdapters,
  projected.counts.missingSourceAdapters,projected.missingAdapterFamilies.length,projected.counts.registeredGeneralOperations,projected.counts.registeredFamilies,
  projected.counts.missingAdaptersDeclaredBySkills,projected.counts.missingAdaptersWithoutSkillDeclaration,projected.counts.excludedCapabilities,projected.counts.live,
 ],[82,64,8,10,18,13,66,37,11,7,43,0]);
 assert.deepEqual(projected.partialAdapterFamilies.map(entry=>[entry.family,entry.operations.length]),[
  ['outreach-query',1],['public-domain-hearings',1],['research-legal-legislation',2],['research-legal-news',1],['state-status-votes',2],['tracked-bills',1],
 ]);
 for(const id of ids){const entry=projected.rows.find(entry=>entry.operation===id);assert.equal(entry.state,'adapter-present');assert.deepEqual(entry.generalOperations,[id]);assert.deepEqual(entry.requiredContextKeys,['asOf']);assert.deepEqual(entry.sourceAdmittedSkills,[]);}
 for(const entry of snapshot.rows.filter(entry=>!ids.includes(entry.operation))){const next=projected.rows.find(next=>next.id===entry.id);assert.equal(next.state,entry.state,entry.operation);assert.deepEqual(next.generalOperations,entry.generalOperations,entry.operation);}
 assert.equal(JSON.stringify(snapshot),before);
});

test('semantic KB completion projection preserves graph, funding and all other read coverage',()=>{
 const tree='a1c0ca277a0eda6ac2a29622c21cc38829990e0b';
 const base=JSON.parse(execFileSync('git',['show',`${tree}:docs/coordination/ledgers/scope-ledger.json`],{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024})).sourceExposure;
 const id='search_client_knowledge',before=JSON.stringify(base),input=synthetic();
 input.families=Object.fromEntries(base.generalRegistration.map(entry=>[entry.family,{clientScope:READ_FAMILIES[entry.family].clientScope,operationIds:[...entry.operations]}]));
 input.adapters=base.rows.filter(entry=>entry.adapterPaths.length&&(entry.kind==='source-read'||entry.generalOperations.length)).map(entry=>({
  operations:[...new Set([entry.operation,...entry.generalOperations])],paths:[...entry.adapterPaths],
  ...(entry.state==='adapter-partial'?{partialOperations:[entry.operation]}:{}),
 }));
 const skillIds=[...new Set(base.rows.flatMap(entry=>entry.declaredBySkills))];
 input.skills=skillIds.map(skill=>({id:skill,operations:[...new Set(base.rows.filter(entry=>entry.declaredBySkills.includes(skill)).flatMap(entry=>[entry.operation,...entry.sourceAdmittedOperations]))]}));
 input.admittedSkills=[...base.admittedSkills];
 const baseline=reconcileSourceExposure(input);
 for(const key of ['completeSourceAdapters','partialSourceAdapters','absentSourceAdapters','registeredGeneralOperations','registeredFamilies','missingAdaptersDeclaredBySkills','missingAdaptersWithoutSkillDeclaration'])assert.equal(baseline.counts[key],base.counts[key],key);
 input.adapters.push({operations:[id],paths:['synthetic complete semantic source adapter']});
 input.families={...input.families,'client-knowledge-search':{clientScope:'optional',requiredClientOperations:[id],operationIds:['query_knowledge_graph',id]}};
 const projected=reconcileSourceExposure(input),entry=projected.rows.find(entry=>entry.operation===id);
 assert.deepEqual([
  projected.counts.selectedSourceReads,projected.counts.completeSourceAdapters,projected.counts.partialSourceAdapters,projected.counts.absentSourceAdapters,
  projected.counts.missingSourceAdapters,projected.missingAdapterFamilies.length,projected.counts.registeredGeneralOperations,projected.counts.registeredFamilies,
  projected.counts.missingAdaptersDeclaredBySkills,projected.counts.missingAdaptersWithoutSkillDeclaration,projected.counts.excludedCapabilities,projected.counts.live,
 ],[82,64,8,10,18,13,66,37,11,7,43,0]);
 assert.equal(entry.state,'adapter-present');assert.deepEqual(entry.generalOperations,[id]);assert.deepEqual(entry.requiredContextKeys,['asOf']);assert.deepEqual(entry.sourceAdmittedSkills,[]);
 for(const previous of base.rows.filter(entry=>entry.operation!==id)){const next=projected.rows.find(next=>next.id===previous.id);assert.equal(next.state,previous.state,previous.operation);assert.deepEqual(next.generalOperations,previous.generalOperations,previous.operation);}
 assert.equal(JSON.stringify(base),before);
});

test('actual complete semantic and graph rows retain distinct clock and SDK client-scope policies',()=>{
 const semantic='search_client_knowledge',graph='query_knowledge_graph',policy=READ_FAMILIES['client-knowledge-search'];
 const declared=JSON.parse(readFileSync(new URL('../general-reads/adapters.json',import.meta.url),'utf8')).adapters.find(entry=>entry.family==='client-knowledge-search');
 assert.deepEqual(declared.operations,[semantic,graph]);assert.equal(Object.hasOwn(declared,'partialOperations'),false);
 assert.match(declared.adapterChecks.join(' '),/59efe08f2f3429918758eef30539e9dde4dbb868 \/ tree c2babd8e0d386b1c9f18ed32ebcd4472d5ebf486/);
 assert.match(declared.adapterChecks.join(' '),/finite six-operation private carrier/);
 assert.match(declared.adapterChecks.join(' '),/qualification issuer must bind.*actual native build, origin\/configuration/);
 assert.equal(policy.clientScope,'optional');assert.deepEqual(policy.requiredClientOperations,[semantic]);assert.equal(Object.hasOwn(policy,'operationIds'),false);
 assert.deepEqual(snapshot.generalRegistration.find(entry=>entry.family==='client-knowledge-search').operations,[graph,semantic]);
 for(const id of [semantic,graph]){const entry=row(id);assert.equal(entry.state,'adapter-present');assert.deepEqual(entry.generalOperations,[id]);assert.deepEqual(entry.sourceAdmittedSkills,[]);}
 assert.deepEqual(row(semantic).requiredContextKeys,['asOf']);assert.deepEqual(row(graph).requiredContextKeys,[]);
 for(const path of ['apps/gateway/sources/client-knowledge-search/request-context.mjs','packages/contracts/native-read-observation-0.2/validate.mjs','packages/contracts/native-read-observation-0.2/schema.json'])assert.ok(row(semantic).adapterPaths.includes(path),path);
 const input=synthetic();input.adapters[0].partialOperations=[semantic];refuses(()=>reconcileSourceExposure(input));
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
 assert.equal(snapshot.missingAdapterFamilies.length,13);assert.equal(snapshot.counts.live,0);
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

test('registering an incomplete operation refuses even with a valid canonical operationIds subset',()=>{
 const input=synthetic();input.adapters.push({operations:['get_state_bill_status'],partialOperations:['get_state_bill_status'],paths:['restricted state adapter']});
 input.families={...input.families,'state-status-votes':{clientScope:'optional',operationIds:['get_state_bill_status']}};
 refuses(()=>reconcileSourceExposure(input));
 const existing=synthetic();existing.adapters[0].partialOperations=['query_economic_data'];refuses(()=>reconcileSourceExposure(existing));
});

test('renderer calls partial coverage missing complete implementation and never calls it exposed',()=>{
 const markdown=generateExposure(root).markdown;
 assert.match(markdown,/64 complete \+ 8 partial \+ 10 absent = 82/);
 assert.match(markdown,/Partial source adapters withheld from SDK exposure \| 8/);
 assert.match(markdown,/Every complete source adapter already present is SDK-exposed/);
 assert.match(markdown,/Partial adapter family \| Incomplete operations \(not SDK-exposed\)/);
 assert.match(markdown,/restricted input\/resource coverage or a pending native bridge/);
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
test('targeted refresh preserves all eight historical fields from current base, PR107, PR106 and earlier base08f65a79',()=>{
 const generated=generateExposure(root),next=generated.ledger;
 const withoutExposure=text=>{
  const start=text.indexOf('### Current selected read source exposure'),end=text.indexOf('### Historical accounting bridge',start);
  assert.ok(start>=0&&end>start);return text.slice(0,start)+text.slice(end);
 };
 for(const base of ['a1c0ca277a0eda6ac2a29622c21cc38829990e0b','e1a6cc9b55501191f56142bf684e3782d94534cd','a945196efcd417a2ed09bcbacfae876acbefd2c3','615a5467ffa555f913ad49258b3919723ecf207d','e1845c3b0d7caa8fd3309ad96f6cb4e17f25ccce','08f65a79b99e5b269a8c7f7e82b6b8de225caae8']){
  const historical=JSON.parse(execFileSync('git',['show',`${base}:docs/coordination/ledgers/scope-ledger.json`],{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024}));
  for(const field of ['capabilities','ownerDirection','coverageOrigin','provenance','counts','gates','excludedReferences','ownershipGraph']){
   assert.deepEqual(next[field],historical[field],`${base}/${field}`);
   assert.equal(JSON.stringify(next[field]),JSON.stringify(historical[field]),`${base}/${field} serialization`);
  }
  const markdown=execFileSync('git',['show',`${base}:docs/coordination/ledgers/MERI-FINAL-SCOPE-LEDGER-20261015.md`],{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024});
  assert.equal(withoutExposure(generated.markdown),withoutExposure(markdown),`${base}/Markdown outside current exposure`);
  for(const path of ['docs/coordination/ledgers/TOOL-COVERAGE-96.csv','docs/coordination/proposals/general-reads/inventory.json']){
   assert.deepEqual(readFileSync(new URL(`../../${path}`,import.meta.url)),execFileSync('git',['show',`${base}:${path}`],{cwd:root,maxBuffer:2*1024*1024}),`${base}/${path}`);
  }
 }
 for(const path of ['read-statuses.json','read-statuses.md'].map(name=>`docs/coordination/handoffs/meri-read-lane-20261017/${name}`)){
  assert.deepEqual(readFileSync(new URL(`../../${path}`,import.meta.url)),execFileSync('git',['show',`e1a6cc9b55501191f56142bf684e3782d94534cd:${path}`],{cwd:root,maxBuffer:2*1024*1024}),`${path} immutable PR110 handoff snapshot`);
 }
 for(const name of ['CODEX-FUNDING-COMPLETION-20261017.md','CODEX-FUNDING-COMPLETION-LEDGER-20261017.md','CODEX-FUNDING-COMPLETION-OUTLINE-20261017.md','CODEX-FUNDING-COMPLETION-REVIEW-20261017.md']){
  const path=`docs/coordination/reports/${name}`;
  assert.deepEqual(readFileSync(new URL(`../../${path}`,import.meta.url)),execFileSync('git',['show',`a1c0ca277a0eda6ac2a29622c21cc38829990e0b:${path}`],{cwd:root,maxBuffer:2*1024*1024}),`${path} immutable PR118 report`);
 }
 const publishedAdapters=JSON.parse(execFileSync('git',['show','a1c0ca277a0eda6ac2a29622c21cc38829990e0b:scripts/general-reads/adapters.json'],{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024})).adapters;
 const currentAdapters=JSON.parse(readFileSync(new URL('../general-reads/adapters.json',import.meta.url),'utf8')).adapters;
 assert.deepEqual(currentAdapters.find(entry=>entry.family==='funding-opportunities'),publishedAdapters.find(entry=>entry.family==='funding-opportunities'),'funding Core51c dependency and qualification boundary');
 assert.deepEqual(next.sourceExposure,snapshot);
});
test('committed current exposure regenerates exactly with a scoped drift check',async()=>{
 const generated=generateExposure(root);
 assert.equal(generated.json,readFileSync(new URL('../../docs/coordination/ledgers/scope-ledger.json',import.meta.url),'utf8'));
 assert.equal(generated.markdown,readFileSync(new URL('../../docs/coordination/ledgers/MERI-FINAL-SCOPE-LEDGER-20261015.md',import.meta.url),'utf8'));
 assert.equal(await runCli(['--check-exposure'],{root,out(){},err(){}}),0);
});
