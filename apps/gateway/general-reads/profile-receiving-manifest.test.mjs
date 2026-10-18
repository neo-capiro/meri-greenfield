/** Profile 0.3.0 P2 source closure, measured without invoking a source or credential. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {measureGeneralReadFamilySources} from './integration.mjs';
import {measureGeneralReadInstallation} from './installation-issuer.mjs';

const root=new URL('../../../',import.meta.url);
const shared=[
 'apps/worker/conversation/reads/schema.mjs',
 'packages/contracts/retrieval-0.2/validate.mjs',
 'packages/contracts/retrieval-0.2/catalog-validation.mjs',
 'packages/contracts/retrieval-0.2/catalog.json',
 'packages/contracts/retrieval-0.2/client-knowledge-profile-v03.schema.json',
 'packages/contracts/retrieval-0.2/client-knowledge-profile-v03-validation.mjs',
 'apps/gateway/sources/client-evidence/handler.mjs',
 'apps/gateway/sources/client-evidence/http-adapter.mjs',
 'apps/gateway/sources/client-evidence/request-context.mjs',
 'apps/gateway/sources/identity-contacts/handler.mjs',
 'apps/gateway/sources/identity-contacts/http-adapter.mjs',
 'apps/gateway/sources/identity-contacts/request-context.mjs',
 'apps/gateway/sources/meetings/handler.mjs',
 'apps/gateway/sources/meetings/http-adapter.mjs',
 'apps/gateway/sources/meetings/request-context.mjs',
];

test('profile and another installed family measure the shared 0.3.0 contract and worker schema bytes',async()=>{
 const manifests=await measureGeneralReadFamilySources({familyIds:['client-knowledge-profile','dataset-metadata']});
 for(const [family,manifest] of manifests){
  assert.equal(manifest.sourceSha256,canonicalSha256(manifest.sourceFiles),family);
  for(const label of shared){
   const entries=manifest.sourceFiles.filter(entry=>entry.label===label);
   assert.equal(entries.length,1,`${family}: ${label}`);
   assert.equal(entries[0].sha256,createHash('sha256').update(await readFile(new URL(label,root))).digest('hex'),label);
  }
 }
});

test('P2 issuer measures the successor profile operation with its family source manifest',async()=>{
 const manifest=(await measureGeneralReadFamilySources({familyIds:['client-knowledge-profile']})).get('client-knowledge-profile');
 const operation={id:'get_client_context',version:'0.3.0'};
 const installed=await measureGeneralReadInstallation({catalogJson:JSON.stringify(catalog),operations:[{operation,family:'client-knowledge-profile'}]});
 const profileRows=installed.measurement.operations.filter(row=>row.operation.id==='get_client_context');
 assert.deepEqual(profileRows,[{operation,family:'client-knowledge-profile',
  descriptorSha256:canonicalSha256(resolveOperationContract(operation).descriptor),handlerSourceSha256:manifest.sourceSha256}]);
 assert.equal(canonicalSha256(installed.measurement),installed.measurementSha256);
});
