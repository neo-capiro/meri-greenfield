import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve,sep,basename} from 'node:path';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {prepareGeneralReadInstallation} from '../runtime.mjs';
import {installationFixture} from './fixture.mjs';

const noSource=f=>{assert.equal(f.wire.length,0);assert.equal(f.stateOwner.secrets,0);assert.equal(f.state.reservations.size,0);};
test('real prepared reads synchronously receives the admitted tuple and traverses current qualifier/native credentials/settlement',async()=>{
 const f=await installationFixture();
 try{
  const availability=await f.client.readAvailability();assert.deepEqual(availability.installation.operations,[f.operation]);assert.ok(f.stateComposition.qualifierCalls.length>0);
  const passed=f.stateComposition.tupleInputs[0];assert.equal(typeof passed.taskVerifier.verify,'function');assert.equal(passed.taskCapability,f.tuple.taskCapability);assert.deepEqual(passed.approvedReads,f.tuple.approvedReads);
  const before=f.stateOwner.entryReads,raw=await f.client.execute({operation:f.operation,arguments:f.request,deliveryId:'installation:prepared:1'}),result=JSON.parse(raw);
  assert.ok(f.stateOwner.entryReads>before);assert.deepEqual(result.binding,f.binding);assert.deepEqual(f.wire[0].body,f.contract.normalizeInput(f.request,{defaultCongress:119}).input);assert.equal(f.stateOwner.secretProof.requestSha256,hash(f.request));assert.deepEqual(f.request,{billId:'H.R. 1'});assert.equal(f.wire.length,1);assert.ok(f.stateOwner.secrets>0);
  const [reservation]=f.state.reservations.values(),[receipt]=f.state.produced.values();assert.equal(reservation.state,'SETTLED');assert.equal(receipt.completion.resultSha256,hash(result));assert.equal(reservation.output_bytes,Buffer.byteLength(raw));
 }finally{f.scope.abort();}
});

test('prepared handlers and native credential closures are fresh on every task construction',async()=>{
 const f=await installationFixture();try{
  const first=f.preparation.createTaskHandlers(f.tuple),second=f.preparation.createTaskHandlers(f.tuple),key=`${f.operation.id}@${f.operation.version}`;
  assert.notEqual(first,second);assert.notEqual(first.get(key).execute,second.get(key).execute);assert.deepEqual(first.get(key).sourceFiles,second.get(key).sourceFiles);assert.notEqual(f.stateComposition.tupleInputs[0],f.stateComposition.tupleInputs[1]);noSource(f);
 }finally{f.scope.abort();}
});

test('missing trusted owners or disabled source is unavailable without native credentials or source IO',async()=>{
 for(const mode of ['installation','discovery','authority','native','source','tuple-source','task-ports']){
  const f=await installationFixture();try{
   f.stateComposition.portsMutator=p=>{if(mode==='installation')delete p.gateway.readCurrentInstallation;if(mode==='discovery')delete p.gateway.discoveryOwner;if(mode==='authority')delete p.gateway.authority;if(mode==='native')delete p.nativeCredentials;if(mode==='source')p.gateway.sourceEnabled=false;};
   const factory=mode==='task-ports'?await prepareGeneralReadInstallation({familyIds:[f.family],newId:randomUUID}):f.preparation;
   const gateway=factory.createReadsRuntime({...f.tuple,...(mode==='tuple-source'?{sourceEnabled:false}:{})});await assert.rejects(gateway.readAvailability(),{message:'UNAVAILABLE'});noSource(f);assert.equal(f.stateOwner.nativeCredentials,0);
  }finally{f.scope.abort();}
 }
});

test('local tuple, producer, capability, scopes and configuration correlation cannot manufacture task authority',async()=>{
 for(const mode of ['binding','allocation','grant','credential','scope','producer','read-config']){
  const f=await installationFixture();try{
   const tuple={...f.tuple};if(mode==='binding')tuple.binding={...tuple.binding,actorId:'foreign'};if(mode==='allocation')tuple.allocationJson='{}';if(mode==='grant')tuple.grantId='00000000-0000-4000-8000-000000000000';if(mode==='scope')tuple.scopes=[{...tuple.scopes[0],policyRevision:'e'.repeat(64)}];
   if(mode==='credential')f.stateComposition.portsMutator=p=>p.gateway.credential='different-task';if(mode==='producer')f.stateComposition.portsMutator=p=>p.gateway.producerContext={...p.gateway.producerContext,allocationSha256:'e'.repeat(64)};
   if(mode==='read-config')tuple.approvedReads={...tuple.approvedReads,maxRequestBytes:tuple.approvedReads.maxRequestBytes-1};
   if(mode==='read-config'){const gateway=f.preparation.createReadsRuntime(tuple);await assert.rejects(gateway.execute({operation:f.operation,arguments:f.request,deliveryId:'installation:wrong-config'}));}
   else assert.throws(()=>f.preparation.createReadsRuntime(tuple));noSource(f);assert.equal(f.stateOwner.nativeCredentials,0);
  }finally{f.scope.abort();}
 }
});

test('native static or dynamic credential/context substitutes are refused before source effects',async()=>{
 for(const key of ['getCredentials','credentialsForCall','authorizeResultForCall']){
  const f=await installationFixture();f.stateComposition.portsMutator=p=>p.families[f.family][key]=()=>{throw Error('BYPASS');};
  try{assert.throws(()=>f.preparation.createReadsRuntime(f.tuple));noSource(f);assert.equal(f.stateOwner.nativeCredentials,0);}finally{f.scope.abort();}
 }
});

test('async or incomplete task-port composition is refused rather than escaping the synchronous prepared hook',async()=>{
 const f=await installationFixture();try{
  await assert.rejects(prepareGeneralReadInstallation({familyIds:[f.family],newId:randomUUID,taskPorts:async()=>({})}));
  const factory=await prepareGeneralReadInstallation({familyIds:[f.family],newId:randomUUID,taskPorts:()=>Promise.resolve({})});assert.throws(()=>factory.createReadsRuntime(f.tuple));noSource(f);
 }finally{f.scope.abort();}
});

test('current qualifier revocation, discovery revocation and current task/entry expiry cannot release source data',async()=>{
 for(const mode of ['qualification','discovery','task','entry','expiry']){
  const f=await installationFixture();try{
   if(mode==='qualification')f.state.installRevoked=true;if(mode==='discovery')f.state.discoveryMutator=row=>row.operations=[];if(mode==='task')f.state.grant.state='REVOKED';if(mode==='entry')f.stateOwner.entryMutator=row=>row.readConfigurationSha256='e'.repeat(64);if(mode==='expiry')f.state.now=f.deadlineMs;
   await assert.rejects(f.client.execute({operation:f.operation,arguments:f.request,deliveryId:'installation:revoked'}));noSource(f);
  }finally{f.scope.abort();}
 }
});

test('current native authority drift and uncertain source retain UNKNOWN without retry or completed bytes',async()=>{
 for(const mode of ['native','uncertain']){const f=await installationFixture();
  if(mode==='native')f.state.afterSource=()=>f.core.state.membershipRevision='e'.repeat(64);else f.state.responseFactory=()=>{throw Error('SYNTHETIC_SOURCE_UNCERTAIN');};
  try{await assert.rejects(f.client.execute({operation:f.operation,arguments:f.request,deliveryId:'installation:unknown'}));assert.equal(f.wire.length,1);const [reservation]=f.state.reservations.values();assert.equal(reservation.state,'UNKNOWN');assert.equal(reservation.output_bytes,null);assert.equal([...f.state.produced.values()][0].completion,null);}
  finally{f.scope.abort();}
 }
});

test('installation source/receipt drift after the source effect withholds release without redispatch',async()=>{
 const f=await installationFixture();f.state.afterSource=()=>f.state.installRevoked=true;
 try{await assert.rejects(f.client.execute({operation:f.operation,arguments:f.request,deliveryId:'installation:post-source-revoke'}));assert.equal(f.wire.length,1);}finally{f.scope.abort();}
});

test('prepared source hashes cannot bypass the canonical final measurement of actual installed bytes',async()=>{
 const f=await installationFixture(),directory=await mkdtemp(join(tmpdir(),'meri-read-install-'));
 try{
  const target=join(directory,'apps/gateway/general-reads/integration.mjs');await mkdir(dirname(target),{recursive:true});await writeFile(target,'// Deliberately different synthetic installed bytes.\n');
  const prepared=await prepareGeneralReadInstallation({familyIds:[f.family],newId:randomUUID,taskPorts:f.taskPorts,sourceRoot:directory}),gateway=prepared.createReadsRuntime(f.tuple);
  await assert.rejects(gateway.readAvailability(),{message:'UNAVAILABLE'});noSource(f);
 }finally{
  f.scope.abort();const verified=resolve(directory);assert.ok(verified.startsWith(resolve(tmpdir())+sep)&&basename(verified).startsWith('meri-read-install-'));await rm(verified,{recursive:true});
 }
});
