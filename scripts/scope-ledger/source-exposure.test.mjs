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
import {GENERAL_READ_ADAPTER_FAMILIES,prepareGeneralReadFamilyHandlers} from '../../apps/gateway/general-reads/integration.mjs';
import {installationReadOperations} from '../../apps/runtime/native-authority/general-read-installation/runtime.mjs';
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {storedCase as trackedCase} from '../../apps/gateway/sources/tracked-bills/test/fixture.mjs';
import {storedCase as hearingCase,clientId as hearingClient} from '../../apps/gateway/sources/public-domain-hearings/test/fixture.mjs';
import {loadSourceExposure,reconcileSourceExposure} from './source-exposure.mjs';
import {generateExposure,runCli} from './cli.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url)),snapshot=loadSourceExposure(root);
const row=id=>snapshot.rows.find(row=>row.id===id),registered=snapshot.generalRegistration.flatMap(row=>row.operations);
function synthetic(){return {catalog:structuredClone(catalog),bindings:CATALOG_OPERATION_BINDINGS,families:READ_FAMILIES,
 adapters:[{operations:[...registered],paths:['synthetic adapter path']}],skills:[],admittedSkills:[],provenance:{}};}
const refuses=work=>assert.throws(work,error=>error.code==='SOURCE_EXPOSURE_INVALID');
// PR132 candidate source (Core PR68 read-mode observation): registered after the PR119/PR125 accounting checkpoints.
const PR132_MODE_READS=['search_federal_grants','search_federal_awards','search_program_elements','get_program_element','get_pe_budget_timeline'];
function projectPR119(ids){
 const tree='b1f79a9832393053c2db64cc9437bad8d59fc8e4';
 const base=JSON.parse(execFileSync('git',['show',`${tree}:docs/coordination/ledgers/scope-ledger.json`],{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024})).sourceExposure;
 const before=JSON.stringify(base),input=synthetic();input.provenance=structuredClone(base.provenance);
 input.backendMapping=JSON.parse(readFileSync(new URL('./backend-producers.json',import.meta.url),'utf8'));
 input.families=Object.fromEntries(base.generalRegistration.map(entry=>[entry.family,{...READ_FAMILIES[entry.family],operationIds:[...entry.operations]}]));
 input.adapters=base.rows.filter(entry=>entry.adapterPaths.length).map(entry=>({operations:[...new Set([entry.operation,...entry.generalOperations])],paths:[...entry.adapterPaths],
  ...(entry.state==='adapter-partial'?{partialOperations:[entry.operation]}:{}),}));
 const assets=JSON.parse(readFileSync(new URL('../../packages/skills/assets.json',import.meta.url),'utf8')).assets;
 // One row per skill identity (bill_watch has 1.0.0 and the plugin-admissible 1.0.1): the union of each version's operations, as source-exposure.mjs does.
 const bySkill=new Map();
 for(const asset of assets){const manifest=JSON.parse(readFileSync(new URL(`../../packages/skills/${asset.manifestPath}`,import.meta.url),'utf8'));
  const row=bySkill.get(manifest.skillId)??{id:manifest.skillId,operations:[]};for(const operation of manifest.allowedOperations)if(!row.operations.includes(operation.id))row.operations.push(operation.id);bySkill.set(manifest.skillId,row);}
 input.skills=[...bySkill.values()];
 input.admittedSkills=[...base.admittedSkills];assert.deepEqual(reconcileSourceExposure(input).rows,base.rows);
 for(const adapter of input.adapters)if(adapter.operations.some(id=>ids.includes(id)))delete adapter.partialOperations;
 for(const family of new Set(base.rows.filter(entry=>ids.includes(entry.operation)).map(entry=>entry.family)))input.families[family]=READ_FAMILIES[family];
 const projected=reconcileSourceExposure(input);assert.equal(JSON.stringify(base),before);return {base,projected};
}
function assertOnlyReadPromotions(base,projected,ids){
 for(const previous of base.rows){const next=projected.rows.find(entry=>entry.id===previous.id);
  if(ids.includes(previous.operation)){
   assert.equal(previous.state,'adapter-partial');assert.deepEqual(previous.generalOperations,[]);assert.equal(next.state,'adapter-present');assert.deepEqual(next.generalOperations,[previous.operation]);
   const {state:ignoredState,generalOperations:ignoredOperations,...unchanged}=next,{state:oldState,generalOperations:oldOperations,...oldFields}=previous;
   assert.deepEqual(unchanged,oldFields,previous.operation);
  }else assert.deepEqual(next,previous,previous.operation);
 }
}

test('96 selected and43 excluded are reconciled separately from76 registered operations',()=>{
 assert.equal(snapshot.rows.length,96);assert.equal(snapshot.counts.selectedSourceReads,82);assert.equal(snapshot.counts.selectedProductOrGoverned,14);
 assert.equal(snapshot.counts.registeredGeneralOperations,76);assert.equal(snapshot.counts.registeredFamilies,42);
 assert.equal(snapshot.counts.generalSelectedSourceReads,74);assert.equal(snapshot.counts.generalSelectedProductStateReads,1);assert.equal(snapshot.counts.generalHistoricalOperations,1);
 assert.equal(snapshot.counts.excludedCapabilities,43);assert.equal(snapshot.counts.live,0);
});
test('missing complete coverage counts three incomplete adapters and five absent adapters exactly once',()=>{
 assert.deepEqual(snapshot.existingAdaptersWithoutGeneralExposure,[]);assert.equal(snapshot.counts.existingSourceAdaptersWithoutGeneralExposure,0);
 assert.equal(snapshot.counts.completeSourceAdapters,74);assert.equal(snapshot.counts.partialSourceAdapters,3);assert.equal(snapshot.counts.absentSourceAdapters,5);
 assert.equal(snapshot.counts.missingSourceAdapters,8);assert.equal(snapshot.counts.missingAdaptersDeclaredBySkills,4);assert.equal(snapshot.counts.missingAdaptersWithoutSkillDeclaration,4);
 assert.equal(snapshot.counts.completeSourceAdapters+snapshot.counts.partialSourceAdapters+snapshot.counts.absentSourceAdapters,82);
 const gaps=snapshot.rows.filter(row=>row.kind==='source-read'&&row.state!=='adapter-present');
 for(const gap of gaps){if(gap.state==='adapter-missing')assert.deepEqual(gap.adapterPaths,[]);else assert.ok(gap.adapterPaths.length);assert.deepEqual(gap.generalOperations,[]);assert.deepEqual(gap.sourceAdmittedSkills,[]);assert.ok(Array.isArray(gap.requiredContextKeys));}
 assert.deepEqual(snapshot.missingAdapterFamilies.flatMap(row=>row.operations).sort(),gaps.map(row=>row.operation).sort());
});

test('economic, PR132 mode-candidate and complete semantic/graph SDK families require actual canonical adapters',()=>{
 for(const id of ['query_economic_data','query_knowledge_graph','search_client_knowledge']){
  assert.equal(row(id).state,'adapter-present');assert.deepEqual(row(id).generalOperations,[id]);assert.ok(row(id).adapterPaths.some(path=>path.includes('/general-reads/families/')));
 }
 // PR132 candidate source: registered only through the canonical mode-observation adapters, each requiring the trusted evidence mode.
 for(const [family,ids] of [['public-data',['search_federal_grants','search_federal_awards']],['program-elements',['search_program_elements','get_program_element','get_pe_budget_timeline']]])for(const id of ids){
  const entry=row(id);assert.equal(entry.state,'adapter-present');assert.deepEqual(entry.generalOperations,[id]);assert.equal(registered.includes(id),true);assert.deepEqual(entry.requiredContextKeys,['evidenceAccuracyMode']);
  for(const path of [`apps/gateway/sources/${family}/handler.mjs`,`apps/gateway/sources/${family}/request-context.mjs`,`apps/gateway/general-reads/families/${family}.mjs`,'apps/runtime/native-authority/native-read-credentials/read-mode-observation.mjs','packages/contracts/native-read-observation-0.2/validate.mjs'])assert.ok(entry.adapterPaths.includes(path),`${id}: ${path}`);
  const input=synthetic();input.adapters[0].partialOperations=[id];refuses(()=>reconcileSourceExposure(input));
 }
 assert.deepEqual(snapshot.generalRegistration.find(row=>row.family==='public-data').operations,['query_economic_data','search_federal_awards','search_federal_grants']);
 assert.deepEqual(snapshot.generalRegistration.find(row=>row.family==='program-elements').operations,['get_pe_budget_timeline','get_program_element','search_program_elements']);
 assert.deepEqual(snapshot.generalRegistration.find(row=>row.family==='client-knowledge-search').operations,['query_knowledge_graph','search_client_knowledge']);
});

test('bounded curated source declarations name twenty-three operations and three partial input/resource reads',()=>{
 const families=['public-data','program-elements','client-knowledge-search','state-status-votes','tracked-bills','public-domain-hearings','research-legal-legislation','research-legal-news','outreach-query','business-development','funding-opportunities'];
 const declared=JSON.parse(readFileSync(new URL('../general-reads/adapters.json',import.meta.url),'utf8')).adapters.filter(adapter=>families.includes(adapter.family));
 assert.equal(declared.length,11);assert.equal(declared.flatMap(adapter=>adapter.operations).length,23);assert.equal(declared.flatMap(adapter=>adapter.partialOperations??[]).length,3);
 for(const adapter of declared){
  const text=adapter.declaredIn.map(path=>readFileSync(new URL(`../../${path}`,import.meta.url),'utf8')).join('\n');
  for(const id of adapter.operations)assert.ok(text.includes(`'${id}'`)||text.includes(`${id}:'/api/clio/tools/${id}'`),`${adapter.path}: ${id}`);
 }
});

test('the three incomplete input/resource operations keep source evidence outside SDK exposure',()=>{
 const expected=['get_legal_reference','search_legiwatch_news','query_outreach'].sort();
 assert.deepEqual(snapshot.partialAdapterFamilies.flatMap(row=>row.operations).sort(),expected);
 assert.equal(snapshot.counts.partialSourceAdaptersWithoutGeneralExposure,3);assert.equal(snapshot.partialAdapterFamilies.length,3);
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
 ],[82,74,3,5,8,8,76,42,4,4,43,0]);
 assert.deepEqual(projected.partialAdapterFamilies.map(entry=>[entry.family,entry.operations.length]),[
  ['outreach-query',1],['research-legal-legislation',1],['research-legal-news',1],
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

test('PR119 projection promotes exactly the four state/tracked/hearing reads and preserves every other row field',()=>{
 const ids=['get_state_bill_status','search_state_floor_votes','search_tracked_bills','search_committee_hearings'],{base,projected}=projectPR119(ids);
 assert.deepEqual([projected.counts.completeSourceAdapters,projected.counts.partialSourceAdapters,projected.counts.absentSourceAdapters,
  projected.counts.missingSourceAdapters,projected.missingAdapterFamilies.length,projected.counts.missingAdaptersDeclaredBySkills,projected.counts.missingAdaptersWithoutSkillDeclaration,
  projected.counts.registeredGeneralOperations,projected.counts.registeredFamilies,projected.counts.live],[68,4,10,14,10,9,5,70,40,0]);
 assertOnlyReadPromotions(base,projected,ids);
 const deltas={registeredGeneralOperations:4,registeredFamilies:3,generalSelectedSourceReads:4,completeSourceAdapters:4,partialSourceAdapters:-4,
  partialSourceAdaptersWithoutGeneralExposure:-4,missingSourceAdapters:-4,missingAdaptersDeclaredBySkills:-2,missingAdaptersWithoutSkillDeclaration:-2};
 for(const [key,value] of Object.entries(base.counts))assert.equal(projected.counts[key],value+(deltas[key]??0),key);
 for(const field of ['schema','note','provenance','backendProducerEvidence','admittedSkills','existingAdaptersWithoutGeneralExposure','missingAdapterAction'])assert.deepEqual(projected[field],base[field],field);
});

test('PR119 five-read projection adds only complete legal search beyond the retained four-read checkpoint',()=>{
 const ids=['get_state_bill_status','search_state_floor_votes','search_tracked_bills','search_committee_hearings','search_legislative_research'];
 const {base,projected}=projectPR119(ids);assertOnlyReadPromotions(base,projected,ids);
 // The shared public-data adapter now also declares its mode-request files, so only the economic row's adapter paths grow.
 const settled=entry=>entry.operation==='query_economic_data'?{...entry,adapterPaths:null}:entry;
 assert.deepEqual(projected.rows.filter(entry=>!PR132_MODE_READS.includes(entry.operation)).map(settled),snapshot.rows.filter(entry=>!PR132_MODE_READS.includes(entry.operation)).map(settled));
 const economic=projected.rows.find(entry=>entry.operation==='query_economic_data');assert.ok(economic.adapterPaths.every(path=>row('query_economic_data').adapterPaths.includes(path)));
 for(const id of PR132_MODE_READS){const before=projected.rows.find(entry=>entry.operation===id),after=row(id);assert.equal(before.state,'adapter-missing',id);assert.deepEqual(before.generalOperations,[]);assert.equal(after.state,'adapter-present',id);assert.deepEqual(after.generalOperations,[id]);}
 assert.deepEqual([projected.counts.completeSourceAdapters,projected.counts.partialSourceAdapters,projected.counts.absentSourceAdapters,
  projected.counts.missingSourceAdapters,projected.missingAdapterFamilies.length,projected.counts.missingAdaptersDeclaredBySkills,projected.counts.missingAdaptersWithoutSkillDeclaration,
  projected.counts.registeredGeneralOperations,projected.counts.registeredFamilies,projected.counts.live],[69,3,10,13,10,9,4,71,41,0]);
 const deltas={registeredGeneralOperations:5,registeredFamilies:4,generalSelectedSourceReads:5,completeSourceAdapters:5,partialSourceAdapters:-5,
  partialSourceAdaptersWithoutGeneralExposure:-5,missingSourceAdapters:-5,missingAdaptersDeclaredBySkills:-2,missingAdaptersWithoutSkillDeclaration:-3};
 for(const [key,value] of Object.entries(base.counts))assert.equal(projected.counts[key],value+(deltas[key]??0),key);
 for(const field of ['schema','note','provenance','backendProducerEvidence','admittedSkills','existingAdaptersWithoutGeneralExposure','missingAdapterAction'])assert.deepEqual(projected[field],base[field],field);
 const held=projected.rows.find(entry=>entry.operation==='get_legal_reference');assert.equal(held.state,'adapter-partial');assert.deepEqual(held.generalOperations,[]);
});

test('legal search alone is SDK/runtime eligible while the private canonical reference sibling remains source-only',async()=>{
 const family='research-legal-legislation',search='search_legislative_research',reference='get_legal_reference';
 const declared=JSON.parse(readFileSync(new URL('../general-reads/adapters.json',import.meta.url),'utf8')).adapters.find(entry=>entry.family===family);
 assert.deepEqual(declared.operations,[search,reference]);assert.deepEqual(declared.partialOperations,[reference]);
 assert.deepEqual(READ_FAMILIES[family],{clientScope:'optional',operationIds:[search]});assert.deepEqual(snapshot.generalRegistration.find(entry=>entry.family===family).operations,[search]);
 assert.equal(row(search).state,'adapter-present');assert.deepEqual(row(search).generalOperations,[search]);assert.equal(row(reference).state,'adapter-partial');assert.deepEqual(row(reference).generalOperations,[]);
 for(const id of [search,reference])assert.ok(row(id).adapterPaths.includes('apps/gateway/sources/research-legal-legislation/request-context.mjs'));
 const owner=readFileSync(new URL('../../apps/runtime/native-authority/native-read-credentials/source-read-context.mjs',import.meta.url),'utf8');
 // c0d6e507/1fc1b0cf: legal search, the source-only reference sibling and legal news all capture native client names through one owner; SDK exposure stays search-only.
 assert.match(owner,/contract\.binding\.group==='research-legal-legislation'\|\|contract\.binding\.group==='research-legal-news'\)reference=captureResearchClientReference\(request\)/);
 assert.match(owner,/assertLegalRawRequest\(contract\.descriptor\.operation,request\)/);
 const eligible=installationReadOperations();assert.equal(eligible.length,76);assert.deepEqual(eligible.filter(entry=>entry.family===family).map(entry=>entry.operation.id),[search]);
 let effects=0;const inactive=()=>{effects++;throw Error('PASSIVE_COMPOSITION_EXECUTED');};
 const prepared=await prepareGeneralReadFamilyHandlers({familyIds:[family]}),handlers=prepared.create({families:{[family]:{origin:'https://synthetic.example.invalid',getCredentials:inactive,fetchImpl:inactive}},now:()=>0,newId:inactive});
 assert.deepEqual([...handlers.keys()].sort(),[`${reference}@0.2.0`,`${search}@0.2.0`].sort());
 for(const path of ['apps/gateway/sources/research-legal-legislation/handler.mjs','apps/gateway/sources/research-legal-legislation/request-context.mjs','apps/worker/conversation/reads/families.mjs']){
  const measured=handlers.get(`${search}@0.2.0`).sourceFiles.find(entry=>entry.label===path);
  assert.equal(measured?.sha256,createHash('sha256').update(readFileSync(new URL(`../../${path}`,import.meta.url))).digest('hex'),path);
 }
 const supported=new Set(eligible.map(entry=>`${entry.operation.id}@${entry.operation.version}`));assert.deepEqual([...handlers.keys()].filter(key=>supported.has(key)),[`${search}@0.2.0`]);
 const runtime=readFileSync(new URL('../../apps/runtime/native-authority/general-read-installation/runtime.mjs',import.meta.url),'utf8');assert.match(runtime,/\.filter\(\(\[key\]\)=>supported\.has\(key\)\)/);
 assert.equal(effects,0);
});

test('the first four-read accounting report, frozen manifest and all initial/final receipts remain immutable',()=>{
 const expected={
  'ledger-refresh-initial.txt':'13175956423a3502febc0283076db55858571036689f69d27e1370be82231e39',
  'ledger-refresh-initial.json':'7a79079bbf3076ee08ecdc663eb2b1898d4f8dafa70586c7d79ce3c0936c08d9',
  'ledger-tests-initial.txt':'4816f0885e0da14cd8963a6a039af8f97769e052d5b946366ebb187ba85bc7ab',
  'ledger-tests-initial.json':'6d4fcc237be8229fca940d0a91466d19c91929d2d7b25b883a27355378a4c5df',
  'ledger-tests-final.txt':'fc97bc07376ffa2faecc1c8bb3c723622fd388809993f582b591534f7fd1a2e2',
  'ledger-tests-final.json':'50a88b46621110d80992a0337c6cdcad38d9c2e640e16cc5123ab3457efbf8db',
  'ledger-check-final.txt':'8b837b64308d965176c95139e6a20169abb16abf949abf93ed6126324a6c12ce',
  'ledger-check-final.json':'13dbea2291cf71b090e549041020d0037207ac43adeedf664a7473b253ec1531',
  'ledger-frozen-files.json':'ab77a2b3e4d1898cd5af1ae09162a0a9101d705fd632c6780c5d627184b9b8ea',
 };
 for(const [name,sha256] of Object.entries(expected))assert.equal(createHash('sha256').update(readFileSync(new URL(`../../docs/coordination/reports/read-completion-next-20261017/${name}`,import.meta.url))).digest('hex'),sha256,name);
 assert.equal(createHash('sha256').update(readFileSync(new URL('../../docs/coordination/reports/CODEX-READ-COMPLETION-NEXT-LEDGER-20261017.md',import.meta.url))).digest('hex'),'46e267ed11f7871698bc206054fe14028832dde965a37c511ef54b9161f33d17');
});

test('complete state/tracked/hearing registration preserves exact client policies and canonical helper ownership',()=>{
 const expected={'state-status-votes':{ids:['get_state_bill_status','search_state_floor_votes'],scope:'optional'},
  'tracked-bills':{ids:['search_tracked_bills'],scope:'required'},'public-domain-hearings':{ids:['search_committee_hearings'],scope:'optional'}};
 const adapters=JSON.parse(readFileSync(new URL('../general-reads/adapters.json',import.meta.url),'utf8')).adapters;
 for(const [family,{ids,scope}] of Object.entries(expected)){
  const adapter=adapters.find(entry=>entry.family===family);assert.deepEqual(adapter.operations,ids);assert.equal(Object.hasOwn(adapter,'partialOperations'),false);
  assert.deepEqual(READ_FAMILIES[family],{clientScope:scope});assert.deepEqual(snapshot.generalRegistration.find(entry=>entry.family===family).operations,ids);
  for(const id of ids){assert.equal(row(id).state,'adapter-present');assert.deepEqual(row(id).generalOperations,[id]);assert.ok(row(id).adapterPaths.includes(`apps/gateway/general-reads/families/${family}.mjs`));}
 }
 assert.ok(row('get_state_bill_status').adapterPaths.includes('apps/gateway/sources/state-status-votes/request-context.mjs'));
 assert.ok(row('search_committee_hearings').adapterPaths.includes('apps/gateway/sources/public-domain-hearings/request-context.mjs'));
 const reference=readFileSync(new URL('../../apps/runtime/native-authority/native-read-credentials/client-reference.mjs',import.meta.url),'utf8');
 assert.match(reference,/ROUTE='\/api\/clio\/clients\/check-ref'/);assert.match(reference,/body:JSON.stringify\(\{ref:call.reference\}\)/);
 const owner=readFileSync(new URL('../../apps/runtime/native-authority/native-read-credentials/owner.mjs',import.meta.url),'utf8');assert.match(owner,/readClientReference/);
 const state=adapters.find(entry=>entry.family==='state-status-votes').adapterChecks.join(' ');assert.match(state,/all frozen canonical, designation, missing and invalid/);assert.match(state,/separate qualification/);
});

test('44 canonical constructors include explicit mail composition and measured native helper source without credential effects',async()=>{
 assert.equal(GENERAL_READ_ADAPTER_FAMILIES.length,44);assert.equal(new Set(GENERAL_READ_ADAPTER_FAMILIES).size,44);
 for(const family of ['mail','state-status-votes','tracked-bills','public-domain-hearings','program-elements'])assert.ok(GENERAL_READ_ADAPTER_FAMILIES.includes(family));
 let effects=0;const inactive=()=>{effects++;throw Error('PASSIVE_COMPOSITION_EXECUTED');},native={origin:'https://synthetic.example.invalid',getCredentials:inactive,fetchImpl:inactive};
 const mailIds=['mail.list_messages','mail.search_messages','mail.read_thread'],mail={endpoints:Object.fromEntries(mailIds.map((id,index)=>[id,`https://synthetic.example.invalid/mail/${index}`])),getCredentials:inactive,fetchImpl:inactive};
 const prepared=await prepareGeneralReadFamilyHandlers({familyIds:['mail','state-status-votes','tracked-bills','public-domain-hearings']});
 const handlers=prepared.create({families:{mail,'state-status-votes':native,'tracked-bills':native,'public-domain-hearings':native},now:()=>0,newId:inactive});
 assert.deepEqual([...handlers.keys()].sort(),[...mailIds,'get_state_bill_status','search_state_floor_votes','search_tracked_bills','search_committee_hearings'].map(id=>`${id}@0.2.0`).sort());
 const measured=['apps/runtime/native-authority/native-read-credentials/client-reference.mjs','apps/runtime/native-authority/native-read-credentials/source-read-context.mjs',
  'apps/gateway/sources/state-status-votes/request-context.mjs','apps/gateway/sources/public-domain-hearings/request-context.mjs'];
 for(const id of ['get_state_bill_status','search_tracked_bills','search_committee_hearings'])for(const path of measured){const source=handlers.get(`${id}@0.2.0`).sourceFiles.find(entry=>entry.label===path);
  assert.equal(source?.sha256,createHash('sha256').update(readFileSync(new URL(`../../${path}`,import.meta.url))).digest('hex'),`${id}/${path}`);}
 const mailSources=handlers.get('mail.list_messages@0.2.0').sourceFiles;
 for(const path of ['apps/gateway/general-reads/families/mail.mjs','apps/gateway/sources/mail/handler.mjs','apps/gateway/sources/mail/http-adapter.mjs','apps/gateway/sources/mail/request-context.mjs'])assert.ok(mailSources.some(entry=>entry.label===path),path);
 assert.equal(effects,0);
});

test('named tracked/hearing adapters require per-call ownership and retain original proof while forwarding only the selected UUID',async()=>{
 const reference='Synthetic Client',seed=hearingCase(),scenes=[trackedCase('search_tracked_bills',{request:{clientId:` ${reference} `}}),
  hearingCase('search_committee_hearings',{request:{clientId:` ${reference} `},context:{tenantId:seed.authority.binding.tenantId,clientResolution:{reference,clientId:hearingClient}}})];
 for(const f of scenes){const call=f.call();await assert.rejects(f.handler()(call),{message:'UNAVAILABLE'});assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
  let captured;const execute=f.handler({getCredentials:undefined,credentialsForCall:(operation,original)=>{captured={operation,original};return f.transport.getCredentials;}});
  await execute(call);assert.equal(captured.original,call);assert.deepEqual(captured.operation,f.operation);assert.equal(f.wire.length,1);
  assert.equal(f.wire[0].body.clientId,call.input.clientId??call.normalizationContext.clientResolution.clientId);
  assert.equal(f.credentialCalls[0].requestSha256,canonicalSha256(f.arguments));assert.deepEqual(f.credentialCalls[0].normalizationContext,f.normalizationContext);
  assert.equal(f.arguments.clientId,` ${reference} `);
 }
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
 assert.equal(snapshot.missingAdapterFamilies.length,8);assert.equal(snapshot.counts.live,0);
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
 const input=synthetic();input.adapters[0].operations=input.adapters[0].operations.filter(id=>id!=='search_federal_grants');
 input.families={...input.families,'public-data':{clientScope:'optional',operationIds:['search_federal_grants']}};
 refuses(()=>reconcileSourceExposure(input));
});

test('partialOperations must be unique nonempty IDs contained in that adapter declaration',()=>{
 for(const partialOperations of [['get_bill_status'],['search_sam_opportunities','search_sam_opportunities'],[],null,'query_economic_data',[42]]){
  const input=synthetic();input.adapters.push({operations:['search_sam_opportunities'],partialOperations,paths:['partial adapter']});
  refuses(()=>reconcileSourceExposure(input));
 }
 const input=synthetic();input.adapters.push({operations:['search_sam_opportunities'],partialOperations:['search_sam_opportunities'],paths:['partial adapter']});
 const result=reconcileSourceExposure(input),entry=result.rows.find(row=>row.id==='search_sam_opportunities');
 assert.equal(entry.state,'adapter-partial');assert.deepEqual(entry.adapterPaths,['partial adapter']);assert.deepEqual(entry.generalOperations,[]);
});

test('registering an incomplete operation refuses even with a valid canonical operationIds subset',()=>{
 const input=synthetic();input.adapters.push({operations:['get_business_development_evidence'],partialOperations:['get_business_development_evidence'],paths:['restricted business-development adapter']});
 input.families={...input.families,'business-development':{clientScope:'optional',operationIds:['get_business_development_context','get_business_development_evidence']}};
 refuses(()=>reconcileSourceExposure(input));
 const existing=synthetic();existing.adapters[0].partialOperations=['query_economic_data'];refuses(()=>reconcileSourceExposure(existing));
});

test('renderer calls partial coverage missing complete implementation and never calls it exposed',()=>{
 const markdown=generateExposure(root).markdown;
 assert.match(markdown,/74 complete \+ 3 partial \+ 5 absent = 82/);
 assert.match(markdown,/Partial source adapters withheld from SDK exposure \| 3/);
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
 for(const base of ['b1f79a9832393053c2db64cc9437bad8d59fc8e4','a1c0ca277a0eda6ac2a29622c21cc38829990e0b','e1a6cc9b55501191f56142bf684e3782d94534cd','a945196efcd417a2ed09bcbacfae876acbefd2c3','615a5467ffa555f913ad49258b3919723ecf207d','e1845c3b0d7caa8fd3309ad96f6cb4e17f25ccce','08f65a79b99e5b269a8c7f7e82b6b8de225caae8']){
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
 for(const name of ['CODEX-KB-COMPLETION-20261017.md','CODEX-KB-COMPLETION-LEDGER-20261017.md','CODEX-KB-COMPLETION-OUTLINE-20261017.md','CODEX-KB-COMPLETION-REVIEW-20261017.md']){
  const path=`docs/coordination/reports/${name}`;
  assert.deepEqual(readFileSync(new URL(`../../${path}`,import.meta.url)),execFileSync('git',['show',`b1f79a9832393053c2db64cc9437bad8d59fc8e4:${path}`],{cwd:root,maxBuffer:2*1024*1024}),`${path} immutable PR119 report`);
 }
 const publishedAdapters=JSON.parse(execFileSync('git',['show','a1c0ca277a0eda6ac2a29622c21cc38829990e0b:scripts/general-reads/adapters.json'],{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024})).adapters;
 const currentAdapters=JSON.parse(readFileSync(new URL('../general-reads/adapters.json',import.meta.url),'utf8')).adapters;
 assert.deepEqual(currentAdapters.find(entry=>entry.family==='funding-opportunities'),publishedAdapters.find(entry=>entry.family==='funding-opportunities'),'funding Core51c dependency and qualification boundary');
 const kbAdapters=JSON.parse(execFileSync('git',['show','b1f79a9832393053c2db64cc9437bad8d59fc8e4:scripts/general-reads/adapters.json'],{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024})).adapters;
 assert.deepEqual(currentAdapters.find(entry=>entry.family==='client-knowledge-search'),kbAdapters.find(entry=>entry.family==='client-knowledge-search'),'semantic KB Core59 dependency and qualification boundary');
 assert.deepEqual(next.sourceExposure,snapshot);
});
test('committed current exposure regenerates exactly with a scoped drift check',async()=>{
 const generated=generateExposure(root);
 assert.equal(generated.json,readFileSync(new URL('../../docs/coordination/ledgers/scope-ledger.json',import.meta.url),'utf8'));
 assert.equal(generated.markdown,readFileSync(new URL('../../docs/coordination/ledgers/MERI-FINAL-SCOPE-LEDGER-20261015.md',import.meta.url),'utf8'));
 assert.equal(await runCli(['--check-exposure'],{root,out(){},err(){}}),0);
});
