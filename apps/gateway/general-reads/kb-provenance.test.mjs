/** Passive import-closure measurement after the KB/shared-transport change. No source or native credential execution. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {createGeneralReadFamilyHandlers} from './integration.mjs';
import {familyCase} from './test/family-cases.mjs';

const changedImports=[
 'apps/gateway/general-reads/families/client-knowledge-search.mjs',
 'apps/gateway/sources/client-knowledge-search/handler.mjs',
 'apps/gateway/sources/client-knowledge-search/request-context.mjs',
 'apps/gateway/sources/retained-reads/native-handler.mjs',
 'apps/gateway/sources/retained-reads/http-transport.mjs',
 'packages/contracts/native-read-observation-0.2/schema.json',
 'packages/contracts/native-read-observation-0.2/validate.mjs',
];
for(const [family,id] of [['dataset-metadata','list_global_datasets'],['research-portfolio','get_research_portfolio'],['client-knowledge-search','query_knowledge_graph']])
 test(`${family}: changed static KB and shared imports are measured exactly once before any credential/source call`,async()=>{
  const scene=familyCase(family,id),handlers=await createGeneralReadFamilyHandlers({families:{[family]:scene.transport},now:scene.now,newId:randomUUID});
  assert.ok(handlers.size>0);
  for(const handler of handlers.values()){
   assert.equal(handler.sourceSha256,canonicalSha256(handler.sourceFiles));
   for(const label of changedImports){
    const entries=handler.sourceFiles.filter(entry=>entry.label===label);assert.equal(entries.length,1,label);
    const actual=createHash('sha256').update(readFileSync(new URL(`../../../${label}`,import.meta.url))).digest('hex');
    assert.equal(entries[0].sha256,actual,label);
   }
   assert.equal(Object.hasOwn(handler,'qualificationReceiptId'),false);
  }
  assert.equal(scene.wire.length,0);assert.equal((scene.state.credentialOwnerCalls??[]).length,0);
 });
