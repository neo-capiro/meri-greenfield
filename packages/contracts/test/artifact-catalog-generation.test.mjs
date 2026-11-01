import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bindArtifactCatalog} from '../generate-artifact-catalog.mjs';
import {CATALOG_OPERATION_BINDINGS as bindings} from '../retrieval-0.2/catalog-validation.mjs';
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const schema=read('../artifacts-0.2/artifact.schema.json'),catalog=read('../retrieval-0.3/catalog.json'),sha='a'.repeat(64);
const artifactIds=new Set(bindings.filter(b=>b.group==='artifacts').map(b=>b.id+'@'+b.version));
test('artifact closure changes only exact registered schema hashes and never mutates its input',()=>{
 const snapshot=structuredClone(catalog),result=bindArtifactCatalog(catalog,schema,sha);
 assert.deepEqual(catalog,snapshot);
 for(let i=0;i<catalog.operations.length;i++){
  const before=catalog.operations[i],after=result.operations[i];
  if(artifactIds.has(before.operation.id+'@'+before.operation.version)){
   assert.equal(after.inputSchema.sha256,sha);assert.equal(after.outputSchema.sha256,sha);
   after.inputSchema.sha256=before.inputSchema.sha256;after.outputSchema.sha256=before.outputSchema.sha256;
  }
 }
 assert.deepEqual(result,catalog);
});
test('missing, duplicate and unregistered artifact rows refuse before generation',()=>{
 const row=catalog.operations.find(r=>artifactIds.has(r.operation.id+'@'+r.operation.version));
 const missing=structuredClone(catalog);missing.operations=missing.operations.filter(r=>r.operation.id!==row.operation.id);
 assert.throws(()=>bindArtifactCatalog(missing,schema,sha),/Missing artifact catalog/);
 const duplicate=structuredClone(catalog);duplicate.operations.push(structuredClone(row));
 assert.throws(()=>bindArtifactCatalog(duplicate,schema,sha),/Duplicate catalog/);
 const unexpected=structuredClone(catalog);unexpected.operations.push({...structuredClone(row),operation:{id:'unregistered',version:'0.2.0'}});
 assert.throws(()=>bindArtifactCatalog(unexpected,schema,sha),/Unexpected artifact/);
 assert.throws(()=>bindArtifactCatalog(catalog,schema,sha,[...bindings,...bindings.filter(b=>b.group==='artifacts')]),/duplicate artifact/);
});
test('unexpected schema identity or missing definition cannot be legitimized by repinning',()=>{
 assert.throws(()=>bindArtifactCatalog(catalog,{...schema,$id:'urn:unexpected'},sha),/Unexpected artifact schema/);
 assert.throws(()=>bindArtifactCatalog(catalog,{...schema,$defs:{}},sha),/Unexpected artifact schema/);
});
