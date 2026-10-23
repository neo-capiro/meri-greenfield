/** Retained read assets use the existing catalog and installation issuer. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {skillsDigest,generalReadInstallation} from './read-assets.mjs';
import {measureGeneralReadInstallation,createGeneralReadInstallationIssuer,GENERAL_READ_INSTALLATION_MEASUREMENT_SCHEMA} from '../../gateway/general-reads/installation-issuer.mjs';
import {installationReadOperations} from '../native-authority/general-read-installation/runtime.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
const root=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
test('skill assets are verified through the existing catalog owner',async()=>{
 const result=await skillsDigest({root});
 assert.match(result.digest,/^[a-f0-9]{64}$/u);assert.ok(result.count>0);
 assert.equal(result.catalogSha256,canonicalSha256(catalog));
});
test('generalReadInstallation is the deterministic P2 measurement over the catalog and installable operations, and the control issuer accepts exactly it',async()=>{
 const g=await generalReadInstallation({root}),again=await generalReadInstallation({root}),skills=await skillsDigest({root});
 assert.deepEqual(Object.keys(g),['measurement','measurementSha256']);assert.match(g.measurementSha256,/^[a-f0-9]{64}$/u);
 assert.equal(canonicalSha256(g.measurement),g.measurementSha256);assert.deepEqual(again,{measurement:g.measurement,measurementSha256:g.measurementSha256});
 // The same value the composer's issuer re-measures: the runtime catalog and installationReadOperations() of this tree.
 const direct=await measureGeneralReadInstallation({catalogJson:JSON.stringify(catalog),operations:installationReadOperations()});
 assert.equal(direct.measurementSha256,g.measurementSha256);
 assert.equal(g.measurement.schema,GENERAL_READ_INSTALLATION_MEASUREMENT_SCHEMA);assert.equal(g.measurement.baseCatalogSha256,skills.catalogSha256);
 assert.equal(g.measurement.operations.length,installationReadOperations().length);assert.ok(g.measurement.operations.length>=1&&g.measurement.operations.length<=128);
 const keys=g.measurement.operations.map(o=>`${o.operation.id}@${o.operation.version}`);assert.deepEqual(keys,[...keys].sort((a,b)=>a.localeCompare(b)));
 for(const row of g.measurement.operations){assert.deepEqual(Object.keys(row),['operation','family','descriptorSha256','handlerSourceSha256']);assert.match(row.handlerSourceSha256,/^[a-f0-9]{64}$/u);assert.match(row.descriptorSha256,/^[a-f0-9]{64}$/u);}
 const issuer=createGeneralReadInstallationIssuer({catalogJson:JSON.stringify(catalog),now:Date.now,enabled:true,measurement:g.measurement,measurementSha256:g.measurementSha256});
 assert.equal(issuer.enabled,true);assert.match(issuer.installationId,/^[a-f0-9-]{36}$/u);
 assert.throws(()=>createGeneralReadInstallationIssuer({catalogJson:JSON.stringify(catalog),now:Date.now,enabled:true,measurement:g.measurement,measurementSha256:'0'.repeat(64)}),/GENERAL_READ_INSTALLATION_REFUSED/u);
});

test('explicit active P2 operations measure an exact canonical subset while preserving the full desired inventory',async()=>{
 const rows=installationReadOperations(),activeReadOperations=[rows.at(-1).operation,rows[0].operation];
 const full=await generalReadInstallation({root}),active=await generalReadInstallation({root,activeReadOperations});
 const direct=await measureGeneralReadInstallation({catalogJson:JSON.stringify(catalog),operations:[rows[0],rows.at(-1)]});
 assert.equal(full.measurement.operations.length,rows.length);assert.equal(active.measurement.operations.length,2);
 assert.deepEqual(active.measurement.operations.map(row=>row.operation),[rows[0].operation,rows.at(-1).operation].sort((a,b)=>`${a.id}@${a.version}`.localeCompare(`${b.id}@${b.version}`)));
 assert.equal(active.measurementSha256,direct.measurementSha256);assert.notEqual(active.measurementSha256,full.measurementSha256);
 assert.equal((await generalReadInstallation({root,activeReadOperations:activeReadOperations.toReversed()})).measurementSha256,active.measurementSha256);
 for(const rejected of [[],[rows[0].operation,rows[0].operation],[{...rows[0].operation,version:'9.9.9'}],[{id:'not_an_installable_read',version:'0.2.0'}],[{...rows[0].operation,family:rows[0].family}]])
  await assert.rejects(generalReadInstallation({root,activeReadOperations:rejected}),/READ_ASSETS_REFUSED/u);
});
