/** Synthetic production-source interleaving: two canonical stores, one put, durable tombstone during final authority. No DB/provider. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {v} from '../storage/boundary.mjs';import {createArtifactPreviewService} from '../preview/service.mjs';import {custodyFixture} from './preview-custody-fixture.mjs';
test('synthetic duplicate-claim recovery refuses a tombstone acknowledged during the later current-authority check',async()=>{
 const f=custodyFixture(),store=f.create();let duplicateRecovery=false,tombstoned=false;
 const previews={...store,async claim(attempt,signal){
  // Victim's first read was missing. Another real service/store wins and commits before victim conditionally claims.
  await f.publish(f.create());const result=await store.claim(attempt,signal);assert.equal(result.claimed,false);duplicateRecovery=true;return result;
 }};
 const artifacts={async download(){return {version:structuredClone(f.version),bytes:Buffer.from(f.bytes)};},async inspect(){
  if(duplicateRecovery&&!tombstoned){tombstoned=true;const row=(await f.durable().snapshot()).rows[0];await f.durable().tombstone(row.claim,{reason:'synthetic duplicate release race',atMs:f.state.now});}
  return {version:structuredClone(f.version)};
 }};
 const service=createArtifactPreviewService({validators:v,artifacts,objects:f.objects,previews,ids:()=>({objectId:randomUUID(),versionId:randomUUID()}),now:()=>f.state.now});
 await assert.rejects(service.publish(f.version.versionId,f.context),e=>e.code==='ARTIFACT_EFFECT_UNKNOWN'&&e.cause.code==='ARTIFACT_PREVIEW_TOMBSTONED');
 assert.equal(tombstoned,true);assert.equal(f.state.puts,1,'duplicate recovery must never dispatch another put');
 await assert.rejects(f.create().read(f.version.versionId),/TOMBSTONED/);assert.equal((await f.create().custody())[0].state,'TOMBSTONE');
});
