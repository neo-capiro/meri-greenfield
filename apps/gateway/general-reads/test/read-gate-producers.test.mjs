/** P2 installation issuer and P1 discovery producer over the real installation owner, allocation parser and family registry.
 * Synthetic run facts only; nothing is enabled outside these tests. */
import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {assertNativeReadSnapshot} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {createGeneralReadInstallationOwner} from '../installation.mjs';
import {measureGeneralReadInstallation,createGeneralReadInstallationIssuer,digestUuid,GENERAL_READ_INSTALLATION_MEASUREMENT_SCHEMA} from '../installation-issuer.mjs';
import {createGeneralReadDiscoveryProducer} from '../discovery-producer.mjs';
import {durableFamilyFixture} from './durable-fixture.mjs';
import {familyCase} from './family-cases.mjs';

const catalogJson=JSON.stringify(catalog),code=expected=>error=>error?.code===expected||error?.message===expected;
async function installation(){
 const f=await durableFamilyFixture(familyCase('tenant-contacts','find_contacts'));
 const {measurement,measurementSha256}=await measureGeneralReadInstallation({catalogJson,operations:[{operation:f.operation,family:f.family}]});
 const owner=issuer=>createGeneralReadInstallationOwner({binding:f.binding,scopes:f.scopes,handlers:f.handlers,catalogJson,now:f.now,readCurrentInstallation:issuer.readCurrentInstallation});
 return {f,measurement,measurementSha256,owner};
}

test('P2 measurement is deterministic and names the exact handler source the installation owner re-measures',async()=>{
 const x=await installation(),again=await measureGeneralReadInstallation({catalogJson,operations:[{operation:x.f.operation,family:x.f.family}]});
 assert.equal(x.measurement.schema,GENERAL_READ_INSTALLATION_MEASUREMENT_SCHEMA);assert.equal(x.measurement.baseCatalogSha256,canonicalSha256(catalog));
 assert.equal(again.measurementSha256,x.measurementSha256);assert.equal(x.measurement.operations[0].handlerSourceSha256,x.f.handlers.get(`${x.f.operation.id}@${x.f.operation.version}`).sourceSha256);
});

test('P2 enabled issuer receipt is accepted by the real installation owner, which re-measures the source bytes',async()=>{
 const x=await installation(),issuer=createGeneralReadInstallationIssuer({catalogJson,now:x.f.now,enabled:true,measurement:x.measurement,measurementSha256:x.measurementSha256});
 const r=await x.owner(issuer).readCurrent();
 assert.deepEqual(r.operations.map(row=>row.operation),[x.f.operation]);assert.equal(r.installationId,digestUuid('installation',x.measurementSha256));
 assert.ok(r.expiresAtMs-r.checkedAtMs<=60000);assert.equal(r.baseCatalogSha256,canonicalSha256(catalog));
});

test('P2 disabled issuer refuses, and the installation owner reports no installation',async()=>{
 const x=await installation(),issuer=createGeneralReadInstallationIssuer({catalogJson,now:x.f.now});
 assert.equal(issuer.enabled,false);await assert.rejects(issuer.readCurrentInstallation({binding:x.f.binding,scopes:x.f.scopes,policyRevision:x.f.policyRevision}),code('UNAVAILABLE'));
 await assert.rejects(x.owner(issuer).readCurrent(),code('GENERAL_READ_INSTALLATION_REFUSED'));
});

test('P2 refuses construction on a pin mismatch, catalog drift, descriptor drift or an unbounded lifetime',async()=>{
 const x=await installation(),base={catalogJson,now:x.f.now,enabled:true,measurement:x.measurement,measurementSha256:x.measurementSha256};
 assert.throws(()=>createGeneralReadInstallationIssuer({...base,measurementSha256:'0'.repeat(64)}));
 assert.throws(()=>createGeneralReadInstallationIssuer({...base,catalogJson:JSON.stringify({...catalog,operations:catalog.operations.slice(1)})}));
 const drifted=structuredClone(x.measurement);drifted.operations[0].descriptorSha256='0'.repeat(64);
 assert.throws(()=>createGeneralReadInstallationIssuer({...base,measurement:drifted,measurementSha256:canonicalSha256(drifted)}));
 assert.throws(()=>createGeneralReadInstallationIssuer({...base,ttlMs:60001}));
});

test('P2 handler source drift after measurement is refused by the owner on read (revocation on drift)',async()=>{
 const x=await installation(),drifted=structuredClone(x.measurement);drifted.operations[0].handlerSourceSha256='a'.repeat(64);
 const issuer=createGeneralReadInstallationIssuer({catalogJson,now:x.f.now,enabled:true,measurement:drifted,measurementSha256:canonicalSha256(drifted)});
 await assert.rejects(x.owner(issuer).readCurrent(),code('GENERAL_READ_INSTALLATION_REFUSED'));
});

test('P2 revoked operations leave the receipt; revoking every operation refuses',async()=>{
 const x=await installation();
 const issuer=createGeneralReadInstallationIssuer({catalogJson,now:x.f.now,enabled:true,measurement:x.measurement,measurementSha256:x.measurementSha256,revokedOperations:[x.f.operation]});
 await assert.rejects(issuer.readCurrentInstallation({binding:x.f.binding,scopes:x.f.scopes,policyRevision:x.f.policyRevision}));
});

function discoveryFixture(f,{policy={generalReads:true,readFamilies:[f.family]},approved=[f.operation],enabled=true}={}){
 const calls=[],producer=createGeneralReadDiscoveryProducer({binding:f.binding,policyRevision:f.policyRevision,allocationJson:f.allocationJson,
  approvedReads:{schemaVersion:'meri-native-general-reads/1',enabled:true,operations:approved,maxExecuteMs:10000,maxRequestBytes:65536,maxResponseBytes:1048576},
  now:f.now,enabled,capabilityPolicy:{async forRun(input){calls.push(input);return policy;}}});
 return {producer,calls};
}

test('P1 grant is allocation ∩ approved reads ∩ the run capability policy, in the runtime snapshot shape',async()=>{
 const f=await durableFamilyFixture(familyCase('tenant-contacts','find_contacts')),x=discoveryFixture(f);
 const grant=await x.producer.readDiscoveryGrant({binding:f.binding,policyRevision:f.policyRevision});
 assert.deepEqual(grant.operations,[f.operation]);assert.deepEqual(x.calls,[{tenantId:f.binding.tenantId,actorId:f.binding.actorId,conversationId:f.binding.conversationId}]);
 assert.ok(grant.expiresAtMs-grant.checkedAtMs<=60000);
 const snapshot={installation:{installationId:digestUuid('i'),baseCatalogSha256:'a'.repeat(64),executionCatalogSha256:'b'.repeat(64),operations:[f.operation],checkedAtMs:grant.checkedAtMs,expiresAtMs:grant.expiresAtMs},discovery:grant};
 assert.doesNotThrow(()=>assertNativeReadSnapshot(snapshot,{binding:f.binding,policyRevision:f.policyRevision,now:f.now}));
});

test('P1 lists nothing without general reads, outside the policy families, or outside the approved reads',async()=>{
 const f=await durableFamilyFixture(familyCase('tenant-contacts','find_contacts'));
 for(const options of [{policy:null},{policy:{generalReads:false,readFamilies:[f.family]}},{policy:{generalReads:true,readFamilies:['mail']}},{approved:[{id:'find_contacts',version:'9.9.9'}]}]){
  const grant=await discoveryFixture(f,options).producer.readDiscoveryGrant({binding:f.binding,policyRevision:f.policyRevision});
  assert.deepEqual(grant.operations,[],JSON.stringify(options));
 }
});

test('P1 refuses when disabled, for another run binding or policy revision, and without a policy owner when enabled',async()=>{
 const f=await durableFamilyFixture(familyCase('tenant-contacts','find_contacts'));
 await assert.rejects(discoveryFixture(f,{enabled:false}).producer.readDiscoveryGrant({binding:f.binding,policyRevision:f.policyRevision}),code('UNAVAILABLE'));
 const x=discoveryFixture(f);
 await assert.rejects(x.producer.readDiscoveryGrant({binding:{...f.binding,writerFence:f.binding.writerFence+1},policyRevision:f.policyRevision}),code('ACCESS_DENIED'));
 await assert.rejects(x.producer.readDiscoveryGrant({binding:f.binding,policyRevision:'c'.repeat(64)}),code('ACCESS_DENIED'));assert.equal(x.calls.length,0);
 assert.throws(()=>createGeneralReadDiscoveryProducer({binding:f.binding,policyRevision:f.policyRevision,allocationJson:f.allocationJson,
  approvedReads:{enabled:true,operations:[f.operation]},now:f.now,enabled:true}));
});
