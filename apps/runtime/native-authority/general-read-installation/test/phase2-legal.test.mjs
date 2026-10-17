/** Phase-2 source/runtime separation over canonical owners and synthetic current qualification. No live installation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {NATIVE_READS_SCHEMA_VERSION as schemaVersion,nativeReadConfigurationSha256} from '../../../../../packages/contracts/runtime-0.2/reads.mjs';
import {prepareGeneralReadFamilyHandlers} from '../../../../gateway/general-reads/integration.mjs';
import {executionCatalogSha256} from '../../../../gateway/catalog/installed-catalog.mjs';
import {storedCase,requests} from '../../../../gateway/sources/research-legal-legislation/test/fixture.mjs';
import {installationReadOperations} from '../runtime.mjs';
import {installationFixture} from './fixture.mjs';

const search={id:'search_legislative_research',version:'0.2.0'},held={id:'get_legal_reference',version:'0.2.0'},key=op=>`${op.id}@${op.version}`;
const make=()=>installationFixture({scene:storedCase(search.id)});
function noSource(f){assert.equal(f.wire.length,0);assert.equal(f.stateOwner.nativeCredentials,0);assert.equal(f.stateOwner.secrets,0);assert.equal(f.state.reservations.size,0);}

test('legal source kernel retains both handlers while the installation Map and actual prepared runtime contain search only',async()=>{
 const f=await make();
 try{
  const prepared=await prepareGeneralReadFamilyHandlers({familyIds:[f.family]}),kernel=prepared.create({families:{[f.family]:f.transport},now:f.now,newId:randomUUID});
  assert.deepEqual([...kernel.keys()],[key(search),key(held)]);
  const eligible=installationReadOperations().filter(row=>row.family===f.family).map(row=>row.operation);assert.deepEqual(eligible,[search]);
  const installed=f.preparation.createTaskHandlers(f.tuple);assert.deepEqual([...installed.keys()],[key(search)]);assert.equal(installed.has(key(held)),false);noSource(f);
  const available=await f.client.readAvailability();assert.deepEqual(available.installation.operations,[search]);assert.deepEqual(available.discovery.operations,[search]);noSource(f);
  const raw=await f.client.execute({operation:search,arguments:f.request,deliveryId:'installation:legal-search'}),output=JSON.parse(raw);
  assert.deepEqual(output.operation,search);assert.equal(f.wire.length,1);assert.equal([...f.state.reservations.values()][0].state,'SETTLED');assert.equal([...f.state.produced.values()][0].completion.resultSha256,hash(output));
 }finally{f.scope.abort();}
});

test('current qualification claiming the held legal-reference sibling fails against the filtered measured handler registry',async()=>{
 const f=await make();
 try{
  f.stateComposition.portsMutator=ports=>{const original=ports.gateway.readCurrentInstallation;
   ports.gateway.readCurrentInstallation=async proof=>{const receipt=structuredClone(await original(proof));
    receipt.operations.push({operation:held,descriptorSha256:hash(resolveOperationContract(held).descriptor),handlerSourceSha256:f.handlers.get(key(held)).sourceSha256,qualificationReceiptId:receipt.operations[0].qualificationReceiptId});
    receipt.executionCatalogSha256=executionCatalogSha256(receipt);return receipt;
   };
  };
  const gateway=f.preparation.createReadsRuntime(f.tuple);await assert.rejects(gateway.readAvailability(),{message:'UNAVAILABLE'});assert.ok(f.stateComposition.qualifierCalls.length>0);noSource(f);
 }finally{f.scope.abort();}
});

test('approved legal-reference read and overclaimed current inventories cannot bypass exact SDK operation eligibility',async()=>{
 const f=await make();let dispatched=0;
 try{
  const approvedReads={...f.tuple.approvedReads,operations:[search,held]};
  f.stateOwner.entryMutator=entry=>entry.readConfigurationSha256=nativeReadConfigurationSha256(approvedReads);
  const prepared=f.prepared({approvedReads,createReadsRuntime:inner=>{
   const gateway=f.preparation.createReadsRuntime({...f.tuple,...inner});
   return {async readAvailability(options){const snapshot=await gateway.readAvailability(options);return {...snapshot,installation:{...snapshot.installation,operations:[search,held]},discovery:{...snapshot.discovery,operations:[search,held]}};},async execute(call){dispatched++;return gateway.execute(call);}};
  }}),request={schemaVersion,binding:f.binding},snapshot=await prepared.owner.handle('availability',request,f.tuple.taskCapability);
  assert.deepEqual(snapshot.installation.operations,[search]);assert.deepEqual(snapshot.discovery.operations,[search]);assert.ok(f.stateOwner.entryReads>0);
  await assert.rejects(prepared.owner.handle('execute',{...request,operation:held,arguments:requests[held.id],deliveryId:'installation:held-legal-reference',installationId:snapshot.installation.installationId,executionCatalogSha256:snapshot.installation.executionCatalogSha256},f.tuple.taskCapability),{message:'UNAVAILABLE'});
  assert.equal(dispatched,0);noSource(f);
 }finally{f.scope.abort();}
});
