/** Source/installation protocol fixtures only. A matching source hash never establishes native qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {familyReads} from '../../../../worker/conversation/reads/availability.mjs';
import {familyOperations} from '../../../../gateway/general-reads/registration.mjs';
import {prepareGeneralReadFamilyHandlers,createGeneralReadFamilyHandlers,measureGeneralReadFamilySources,GENERAL_READ_ADAPTER_FAMILIES} from '../../../../gateway/general-reads/integration.mjs';
import {CASES,familyCase} from '../../../../gateway/general-reads/test/family-cases.mjs';
import {storedCase as fundingCase} from '../../../../gateway/sources/funding-opportunities/test/fixture.mjs';
import {storedCase as programCase} from '../../../../gateway/sources/program-elements/test/fixture.mjs';
import {createSelectedSkillInstallationOwner} from '../../../../gateway/catalog/selected-installation-owner.mjs';
import {executionCatalogSha256} from '../../../../gateway/catalog/installed-catalog.mjs';
import {setup as selectedFixture} from '../../../../gateway/selected-skills/fixture.mjs';
import {installationReadOperations,prepareGeneralReadInstallation} from '../runtime.mjs';

test('every SDK runtime reference maps to the canonical composed families, including the existing mail constructor',()=>{
 const expected=familyReads().map(row=>({operation:row.operation,family:row.family}));assert.deepEqual(installationReadOperations(),expected);assert.ok(GENERAL_READ_ADAPTER_FAMILIES.includes('mail'));
 assert.deepEqual(familyOperations('mail'),expected.filter(row=>row.family==='mail').map(row=>row.operation));
});

test('selected retained source manifests bind the task composer and local dataset bytes',async()=>{
 const manifests=await measureGeneralReadFamilySources({familyIds:['action-items-complete','dataset-metadata']});
 const labels=['apps/runtime/native-authority/retained-reads/selected-task-ports.mjs',
  'apps/runtime/native-authority/retained-reads/operational-task-ports.mjs',
  'apps/runtime/native-authority/retained-reads/dataset-metadata-port.mjs',
  'apps/runtime/native-authority/retained-reads/configuration.mjs',
  'apps/runtime/native-authority/retained-reads/research-florida-task-ports.mjs',
  'apps/runtime/native-authority/retained-reads/research-evidence-task-port.mjs',
  'apps/runtime/native-authority/retained-reads/task-ports.mjs',
  'apps/runtime/native-authority/retained-reads/core-client.mjs',
  'apps/runtime/native-authority/retained-reads/credential-broker.mjs',
  'apps/runtime/native-authority/retained-reads/mail-monday-task-ports.mjs',
  'apps/gateway/sources/client-knowledge/monday-signed-adapter.mjs',
  'apps/gateway/sources/research-legal-candidates/request-context.mjs',
  'packages/contracts/retrieval-0.2/public-domain-registry.mjs',
  'packages/contracts/retrieval-0.2/public-domain-datasets.json',
  'packages/contracts/retrieval-0.2/operation-contracts.mjs',
  'apps/gateway/dispatch/action-read-context.mjs',
  'apps/gateway/dispatch/operation-context.mjs',
  'apps/gateway/dispatch/dispatch-lifetime.mjs',
  'apps/gateway/dispatch/read-result-envelope.mjs',
  'apps/gateway/dispatch/operation-result.mjs',
  'apps/runtime/native-authority/read-delegation/core-client.mjs',
  'packages/runtime/operation-lifetime.mjs'];
 for(const manifest of manifests.values())for(const label of labels)
  assert.equal(manifest.sourceFiles.filter(row=>row.label===label).length,1,label);
});

test('proposal source manifest binds the durable continuation owner and startup relay',async()=>{
 const manifests=await measureGeneralReadFamilySources({familyIds:['memory-proposals']});
 const rows=manifests.get('memory-proposals').sourceFiles;
 for(const label of ['apps/gateway/dispatch/memory-read-context.mjs',
  'apps/runtime/memory-context-relay.mjs','apps/runtime/control.mjs',
  'apps/control/conversations/postgres-store.mjs',
  'apps/control/conversations/memory-proposal-context-journal.mjs',
  'apps/control/retention/data-classes.mjs','apps/control/retention/inventory.mjs'])
  assert.equal(rows.filter(row=>row.label===label).length,1,label);
});

test('two-phase preparation preserves legacy source records/order/hash and canonical source siblings without granting SDK eligibility',async()=>{
 const families={},ids=[...new Set(installationReadOperations().map(row=>row.family))];let externalCalls=0;
 for(const id of ids){
  if(id==='mail')families[id]={endpoints:Object.fromEntries(familyOperations(id).map(op=>[op.id,`https://mail.example.invalid/${op.id}`])),getCredentials:()=>{externalCalls++;throw Error('UNEXPECTED_CREDENTIAL');},fetchImpl:()=>{externalCalls++;throw Error('UNEXPECTED_FETCH');}};
  else{const pair=CASES.find(([family])=>family===id),scene=id==='funding-opportunities'?fundingCase():id==='program-elements'?programCase():familyCase(...pair);families[id]=scene.transport;}
 }
 const now=()=>1800000000000,prepared=await prepareGeneralReadFamilyHandlers({familyIds:ids});assert.equal(externalCalls,0);
 const first=prepared.create({families,now,newId:randomUUID}),legacy=await createGeneralReadFamilyHandlers({families,now,newId:randomUUID});
 const kernelKeys=ids.flatMap(id=>familyOperations(id).map(op=>`${op.id}@${op.version}`)),eligibleKeys=installationReadOperations().map(row=>`${row.operation.id}@${row.operation.version}`);
 assert.deepEqual([...first.keys()],[...legacy.keys()]);assert.deepEqual([...first.keys()].sort(),kernelKeys.sort());
 assert.deepEqual(kernelKeys.filter(key=>!eligibleKeys.includes(key)),[]);
 for(const id of ['search_legislative_research','get_legal_reference','search_legiwatch_news','query_outreach','search_research_sources'])assert.ok(eligibleKeys.includes(`${id}@0.2.0`),id);
 for(const [key,handler] of first){const prior=legacy.get(key);assert.deepEqual(handler.sourceFiles,prior.sourceFiles);assert.equal(handler.sourceSha256,prior.sourceSha256);assert.equal(handler.sourceSha256,hash(handler.sourceFiles));assert.ok(Object.isFrozen(handler.sourceFiles));assert.equal(new Set(handler.sourceFiles.map(row=>row.label)).size,handler.sourceFiles.length);assert.notEqual(handler.execute,prior.execute);
  for(const label of ['apps/runtime/native-authority/native-read-credentials/client-reference.mjs','apps/runtime/native-authority/general-read-installation/configuration.mjs','apps/runtime/native-authority/general-read-installation/runtime.mjs','apps/gateway/general-reads/families/mail.mjs',
   'apps/runtime/native-authority/native-read-credentials/owner.mjs','apps/runtime/native-authority/native-read-credentials/core-client.mjs','apps/runtime/native-authority/native-read-credentials/source-read-context.mjs',
   'apps/gateway/sources/state-status-votes/handler.mjs','apps/gateway/sources/state-status-votes/request-context.mjs','apps/gateway/sources/tracked-bills/handler.mjs',
   'apps/gateway/sources/public-domain-hearings/handler.mjs','apps/gateway/sources/public-domain-hearings/request-context.mjs','apps/gateway/sources/research-legal-legislation/handler.mjs','apps/worker/conversation/reads/families.mjs'])assert.equal(handler.sourceFiles.filter(row=>row.label===label).length,1,`${key}: ${label}`);
 }
 assert.equal(externalCalls,0);
});

test('prepared family allowlist is finite; partial-only families cannot inherit SDK installation eligibility',async()=>{
 for(const familyIds of [['unknown'],['bill-text','bill-text']])await assert.rejects(prepareGeneralReadFamilyHandlers({familyIds}));
 const prepared=await prepareGeneralReadFamilyHandlers({familyIds:['bill-text']});assert.throws(()=>prepared.create({families:{mail:{}},now:Date.now,newId:randomUUID}));
 const supported=new Set(installationReadOperations().map(row=>row.family));
 assert.ok(GENERAL_READ_ADAPTER_FAMILIES.every(id=>supported.has(id)));
 for(const absent of ['certification-status','rule-status','sam-opportunities','client-knowledge-attachments']){
  assert.equal(supported.has(absent),false);await assert.rejects(prepareGeneralReadInstallation({familyIds:[absent],newId:randomUUID}));
 }
 const empty=await prepareGeneralReadFamilyHandlers({familyIds:[]});assert.equal(empty.create({families:{},now:Date.now,newId:randomUUID}).size,0);assert.equal((await createGeneralReadFamilyHandlers({families:{},now:Date.now,newId:randomUUID})).size,0);
});

test('selected skills consume their own current context and qualification over the canonical prepared handlers',async()=>{
 const f=await selectedFixture(),scene=familyCase('operational-reads','query_tasks'),prepared=await prepareGeneralReadFamilyHandlers({familyIds:['operational-reads']}),handlers=prepared.create({families:{'operational-reads':scene.transport},now:f.now,newId:randomUUID});
 let calls=0;const installation=createSelectedSkillInstallationOwner({...f.installConfig,handlers,async readCurrentInstallation(proof){
  calls++;assert.deepEqual(proof.skill,f.selected.pin);assert.equal(proof.requestSha256,hash(f.request));assert.equal(proof.selectionSha256,hash(f.selection));
  const receipt=f.receipt();receipt.operations=receipt.operations.map(row=>({...row,handlerSourceSha256:handlers.get(`${row.operation.id}@${row.operation.version}`).sourceSha256}));receipt.executionCatalogSha256=executionCatalogSha256(receipt);return receipt;
 }});
 const result=await installation.readForSkill(f.input);assert.equal(calls,1);assert.equal(result.operations[0].descriptorSha256,hash(resolveOperationContract(f.operation).descriptor));assert.equal(result.operations[0].handlerSourceSha256,handlers.get('query_tasks@0.2.0').sourceSha256);
 f.state.selectedClientId='00000000-0000-4000-8000-000000000000';await assert.rejects(installation.readForSkill(f.input));assert.equal(f.wire.length,0);
});

test('a general installation receipt cannot be relabeled into selected-skill qualification',async()=>{
 const f=await selectedFixture(),receipt=f.receipt();for(const key of ['skill','requestSha256','selectionSha256'])delete receipt[key];
 const installation=createSelectedSkillInstallationOwner({...f.installConfig,readCurrentInstallation:async()=>receipt});await assert.rejects(installation.readForSkill(f.input));assert.equal(f.wire.length,0);
});
