/** Offline source mapping controls. No SDK/compiler/provider/DB/process spawning. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
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

test('96 selected and43 excluded are reconciled separately from31 registered operations',()=>{
 assert.equal(snapshot.rows.length,96);assert.equal(snapshot.counts.selectedSourceReads,82);assert.equal(snapshot.counts.selectedProductOrGoverned,14);
 assert.equal(snapshot.counts.registeredGeneralOperations,31);assert.equal(snapshot.counts.registeredFamilies,19);
 assert.equal(snapshot.counts.generalSelectedSourceReads,29);assert.equal(snapshot.counts.generalSelectedProductStateReads,1);assert.equal(snapshot.counts.generalHistoricalOperations,1);
 assert.equal(snapshot.counts.excludedCapabilities,43);assert.equal(snapshot.counts.live,0);
});
test('every existing selected source adapter already has general exposure; remaining53 are genuine adapter gaps',()=>{
 assert.deepEqual(snapshot.existingAdaptersWithoutGeneralExposure,[]);assert.equal(snapshot.counts.existingSourceAdaptersWithoutGeneralExposure,0);
 assert.equal(snapshot.counts.missingSourceAdapters,53);assert.equal(snapshot.counts.missingAdaptersDeclaredBySkills,35);assert.equal(snapshot.counts.missingAdaptersWithoutSkillDeclaration,18);
 const gaps=snapshot.rows.filter(row=>row.kind==='source-read'&&row.state==='adapter-missing');
 for(const gap of gaps){assert.deepEqual(gap.adapterPaths,[]);assert.deepEqual(gap.generalOperations,[]);assert.deepEqual(gap.sourceAdmittedSkills,[]);assert.ok(Array.isArray(gap.requiredContextKeys));}
 assert.deepEqual(snapshot.missingAdapterFamilies.flatMap(row=>row.operations).sort(),gaps.map(row=>row.operation).sort());
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

test('five approved published slices become source adapters while qualification and live availability remain closed',()=>{
 const rows=snapshot.rows.filter(row=>row.backendProducer?.localImplementation);assert.equal(rows.length,5);assert.equal(snapshot.counts.locallyImplementedPendingIntegration,0);assert.equal(snapshot.counts.publishedFamilySourceAdopted,5);
 assert.equal(snapshot.counts.registeredGeneralOperations,31);assert.equal(snapshot.counts.missingSourceAdapters,53);assert.equal(snapshot.counts.live,0);
 for(const entry of rows){const local=entry.backendProducer.localImplementation;assert.equal(local.status,'source-adopted-pending-qualification');
  assert.equal(local.sourceAdopted,true);assert.equal(local.qualified,false);assert.equal(local.live,false);assert.match(local.publication,/Approved unchanged slice published/);
  assert.equal(local.adoptionCommit,'9a0ea1cf4e8c60b9722b05d0f30005536e718776');
  assert.equal(entry.state,'adapter-present');assert.ok(entry.adapterPaths.some(path=>path.endsWith('/handler.mjs')));assert.deepEqual(entry.generalOperations,[entry.operation]);
 }
});
test('current source provenance measures declared canonical paths without claiming qualification',()=>{
 assert.match(snapshot.note,/No qualification/);assert.equal(Object.keys(snapshot.provenance).some(path=>path.includes('node_modules')),false);
 for(const [path,digest] of Object.entries(snapshot.provenance))assert.equal(createHash('sha256').update(readFileSync(new URL(`../../${path}`,import.meta.url))).digest('hex'),digest,path);
 assert.ok(row('get_research_portfolio').adapterPaths.includes('apps/gateway/sources/research-portfolio/handler.mjs'));
 assert.ok(row('get_research_portfolio').adapterPaths.includes('apps/gateway/general-reads/families/research-portfolio.mjs'));
});
test('registering a governed write family refuses instead of expanding the read server',()=>{
 const input=synthetic();input.families={...READ_FAMILIES,'command-tools':{clientScope:'optional'}};refuses(()=>reconcileSourceExposure(input));
});
test('registered family without adapter fails closed',()=>{
 const input=synthetic();input.adapters[0].operations=input.adapters[0].operations.filter(id=>id!=='get_research_portfolio');refuses(()=>reconcileSourceExposure(input));
});
test('a manifest declaration alone never manufactures an adapter or source route',()=>{
 const input=synthetic();input.skills=[{id:'synthetic.skill',operations:['get_bill_status']}];input.admittedSkills=['synthetic.skill'];
 const result=reconcileSourceExposure(input).rows.find(row=>row.id==='get_bill_status');assert.deepEqual(result.declaredBySkills,['synthetic.skill']);assert.deepEqual(result.sourceAdmittedSkills,[]);assert.equal(result.state,'adapter-missing');
});
test('duplicate adapter claims and changed selected scope refuse',()=>{
 const input=synthetic();input.adapters.push({operations:[registered[0]],paths:['duplicate']});refuses(()=>reconcileSourceExposure(input));
 const changed=synthetic();changed.catalog.originals=changed.catalog.originals.filter(row=>row.disposition!=='selected'||row.id!==snapshot.rows[0].id);refuses(()=>reconcileSourceExposure(changed));
});
test('a duplicate canonical binding refuses rather than choosing an arbitrary adapter family',()=>{
 const input=synthetic();input.bindings=[...input.bindings,input.bindings[0]];refuses(()=>reconcileSourceExposure(input));
});
test('targeted refresh preserves all139 historical rows, exclusions, source provenance and gates',()=>{
 const historical=JSON.parse(readFileSync(new URL('../../docs/coordination/ledgers/scope-ledger.json',import.meta.url),'utf8'));
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
