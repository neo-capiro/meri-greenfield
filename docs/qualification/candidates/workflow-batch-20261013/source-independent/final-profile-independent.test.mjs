/** Replay the actual current inventory assertion with hostile registry variants. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';import {SourceTextModule,SyntheticModule} from 'node:vm';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;assert.ok(root);
const url=pathToFileURL(root+'/apps/gateway/test/memory-context-independent.test.mjs').href;
const source=readFileSync(new URL(url),'utf8');
const bindingsUrl=pathToFileURL(root+'/packages/contracts/retrieval-0.2/catalog-validation.mjs').href;
const catalogModule=await import(bindingsUrl);
const ids=['search_memory','read_monday_client_boards','get_client_context','find_contacts','resolve_entity','read_client_documents'];
const target='independent: canonical mail and memory profiles are selected; actual15 stay unavailable';
async function runActualInventory(mutate){
 let selected;const rows=catalogModule.CATALOG_OPERATION_BINDINGS.map(row=>({...row}));mutate?.(rows);
 const cache=new Map(),module=new SourceTextModule(source,{identifier:url,initializeImportMeta(meta){meta.url=url;},
  async importModuleDynamically(specifier){const dependency=await linker(specifier);
   if(dependency.status==='unlinked')await dependency.link(()=>{throw Error('Synthetic module has no imports');});
   if(dependency.status==='linked')await dependency.evaluate();return dependency;}});
 const linker=async(specifier)=>{
  const resolved=specifier.startsWith('.')?new URL(specifier,url).href:specifier;
  if(cache.has(resolved))return cache.get(resolved);let exports;
  if(specifier==='node:test')exports={default:(name,fn)=>{if(name===target){assert.equal(selected,undefined);selected=fn;}}};
  else if(resolved===bindingsUrl)exports={...catalogModule,CATALOG_OPERATION_BINDINGS:rows};
  else exports=await import(resolved);
  const synthetic=new SyntheticModule(Object.keys(exports),function(){for(const [name,value]of Object.entries(exports))this.setExport(name,value);},{identifier:resolved});
  cache.set(resolved,synthetic);return synthetic;
 };
 await module.link(linker);await module.evaluate();assert.equal(typeof selected,'function');await selected();
}
test('Actual inventory assertion admits exact metadata and checks every source-disabled catalog row',async()=>runActualInventory());
for(const id of ids)for(const kind of ['missing','wrong'])test('Actual inventory assertion refuses '+kind+' metadata for '+id,async()=>{
 await assert.rejects(runActualInventory(rows=>{const row=rows.find(value=>value.id===id);assert.ok(row);
  if(kind==='missing')delete row.dispatchProfile;else row.dispatchProfile='unaccepted-profile/1';}),{code:'ERR_ASSERTION'});
});
test('Actual inventory assertion refuses an additional profile on another registry entry',async()=>{
 await assert.rejects(runActualInventory(rows=>{const row=rows.find(value=>value.dispatchProfile===undefined);assert.ok(row);row.dispatchProfile='bound-projection/1';}),{code:'ERR_ASSERTION'});
});
