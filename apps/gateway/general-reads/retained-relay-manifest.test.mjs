/** P2 source closure for the signed retained read relay; source only, no network or credential. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {measureGeneralReadFamilySources} from './integration.mjs';

const root=new URL('../../../',import.meta.url);
const shared=[
 'apps/gateway/dispatch/tool-dispatch.mjs',
 'apps/gateway/sources/retained-reads/signed-source-operations.mjs',
 'apps/runtime/cli.mjs',
 'apps/runtime/native-authority/reads-composer.mjs',
 'apps/runtime/native-authority/retained-read-credential-relay.mjs',
 'apps/runtime/native-authority/retained-reads/client-scoped-source-task-ports.mjs',
 'apps/runtime/native-authority/read-delegation/contract.mjs',
 'apps/runtime/native-authority/read-delegation/delegation.mjs',
 'apps/runtime/native-authority/read-delegation/native-credentials.mjs',
];
const monday=[
 'apps/gateway/sources/client-knowledge/monday-signed-adapter.mjs',
 'apps/gateway/sources/client-knowledge/monday-signed-handler.mjs',
];

test('P2 measures exact signed relay bytes for unrelated and Monday retained families',async()=>{
 const manifests=await measureGeneralReadFamilySources({familyIds:['client-knowledge-monday','tenant-contacts','dataset-metadata']});
 for(const [family,manifest] of manifests){
  assert.equal(manifest.sourceSha256,canonicalSha256(manifest.sourceFiles),family);
  for(const label of [...shared,...(family==='client-knowledge-monday'?monday:[])]){
   const entries=manifest.sourceFiles.filter(entry=>entry.label===label);
   assert.equal(entries.length,1,`${family}: ${label}`);
   assert.equal(entries[0].sha256,createHash('sha256').update(await readFile(new URL(label,root))).digest('hex'),label);
  }
 }
});
