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

const search={id:'search_legislative_research',version:'0.2.0'},reference={id:'get_legal_reference',version:'0.2.0'},key=op=>`${op.id}@${op.version}`;
const make=()=>installationFixture({scene:storedCase(search.id)});
function noSource(f){assert.equal(f.wire.length,0);assert.equal(f.stateOwner.nativeCredentials,0);assert.equal(f.stateOwner.secrets,0);assert.equal(f.state.reservations.size,0);}

test('both legal source handlers are SDK-eligible while the actual measured installation still grants search only',async()=>{
 const f=await make();
 try{
  const prepared=await prepareGeneralReadFamilyHandlers({familyIds:[f.family]}),kernel=prepared.create({families:{[f.family]:f.transport},now:f.now,newId:randomUUID});
  assert.deepEqual([...kernel.keys()],[key(search),key(reference)]);
  const eligible=installationReadOperations().filter(row=>row.family===f.family).map(row=>row.operation);assert.deepEqual(eligible,[search,reference]);
  const installed=f.preparation.createTaskHandlers(f.tuple);assert.deepEqual([...installed.keys()],[key(search),key(reference)]);noSource(f);
  const available=await f.client.readAvailability();assert.deepEqual(available.installation.operations,[search]);assert.deepEqual(available.discovery.operations,[search]);noSource(f);
  const raw=await f.client.execute({operation:search,arguments:f.request,deliveryId:'installation:legal-search'}),output=JSON.parse(raw);
  assert.deepEqual(output.operation,search);assert.equal(f.wire.length,1);assert.equal([...f.state.reservations.values()][0].state,'SETTLED');assert.equal([...f.state.produced.values()][0].completion.resultSha256,hash(output));
 }finally{f.scope.abort();}
});

test('current qualification cannot claim a legal-reference sibling with a different measured handler source',async()=>{
 const f=await make();
 try{
  f.stateComposition.portsMutator=ports=>{const original=ports.gateway.readCurrentInstallation;
   ports.gateway.readCurrentInstallation=async proof=>{const receipt=structuredClone(await original(proof));
    const actual=f.handlers.get(key(reference)).sourceSha256,incorrect=(actual[0]==='0'?'1':'0')+actual.slice(1);
    receipt.operations.push({operation:reference,descriptorSha256:hash(resolveOperationContract(reference).descriptor),handlerSourceSha256:incorrect,qualificationReceiptId:receipt.operations[0].qualificationReceiptId});
    receipt.executionCatalogSha256=executionCatalogSha256(receipt);return receipt;
   };
  };
  const gateway=f.preparation.createReadsRuntime(f.tuple);await assert.rejects(gateway.readAvailability(),{message:'UNAVAILABLE'});assert.ok(f.stateComposition.qualifierCalls.length>0);noSource(f);
 }finally{f.scope.abort();}
});

test('SDK-eligible approved legal-reference and overclaimed inventories cannot bypass the actual measured installation',async()=>{
 const f=await make();let dispatched=0;
 try{
  const approvedReads={...f.tuple.approvedReads,operations:[search,reference]};
  f.stateOwner.entryMutator=entry=>entry.readConfigurationSha256=nativeReadConfigurationSha256(approvedReads);
  const prepared=f.prepared({approvedReads,createReadsRuntime:inner=>{
   const gateway=f.preparation.createReadsRuntime({...f.tuple,...inner});
   return {async readAvailability(options){const snapshot=await gateway.readAvailability(options);return {...snapshot,installation:{...snapshot.installation,operations:[search,reference]},discovery:{...snapshot.discovery,operations:[search,reference]}};},async execute(call){dispatched++;return gateway.execute(call);}};
  }}),request={schemaVersion,binding:f.binding},snapshot=await prepared.owner.handle('availability',request,f.tuple.taskCapability);
  assert.deepEqual(snapshot.installation.operations,[search,reference]);assert.deepEqual(snapshot.discovery.operations,[search,reference]);assert.ok(f.stateOwner.entryReads>0);
  await assert.rejects(prepared.owner.handle('execute',{...request,operation:reference,arguments:requests[reference.id],deliveryId:'installation:unmeasured-legal-reference',installationId:snapshot.installation.installationId,executionCatalogSha256:snapshot.installation.executionCatalogSha256},f.tuple.taskCapability),{message:'UNAVAILABLE'});
  assert.equal(dispatched,1,'SDK eligibility permits forwarding but the actual gateway installation still refuses');noSource(f);
 }finally{f.scope.abort();}
});

test('legal reference reaches the actual prepared runtime only with its own current installation and selected-client grant',async()=>{
 const clientId='a1234567-b123-4c12-8d12-e123456789ab',request={...requests[reference.id],clientId};
 const f=await installationFixture({scene:storedCase(reference.id,{request})});
 try{
  const available=await f.client.readAvailability();
  assert.deepEqual(available.installation.operations,[reference]);assert.deepEqual(available.discovery.operations,[reference]);noSource(f);
  const output=JSON.parse(await f.client.execute({operation:reference,arguments:request,deliveryId:'installation:legal-reference'}));
  assert.deepEqual(output.operation,reference);assert.equal(output.subject.entityIds[0],clientId);assert.deepEqual(f.wire[0].body,request);
  assert.deepEqual(output.result,JSON.parse(JSON.stringify(f.page)));assert.equal([...f.state.reservations.values()][0].state,'SETTLED');
  assert.equal([...f.state.produced.values()][0].completion.resultSha256,hash(output));
 }finally{f.scope.abort();}
});
