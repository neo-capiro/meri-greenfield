/** Exercise actual historical deep comparisons; do not replace their predicate. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';import {SourceTextModule,SyntheticModule} from 'node:vm';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;assert.ok(root);
const bindingsUrl=pathToFileURL(root+'/packages/contracts/retrieval-0.2/catalog-validation.mjs').href;
const catalogModule=await import(bindingsUrl);
const {expectedExistingBinding}=await import(pathToFileURL(root+'/packages/contracts/test/backend-execution-expectations.mjs'));
const rows=[
 ['retrieval-backend-next-independent.test.mjs','all139 originals and67 prior descriptors/callbacks survive exactly four new mappings'],
 ['retrieval-civic-integration-independent.test.mjs','all original139 rows,56 descriptors and callback implementations survive seven exact additions'],
 ['retrieval-observed-integration-independent.test.mjs','original139 rows and63 descriptors/callbacks survive exactly four full mappings'],
 ['retrieval-reference-integration-independent.test.mjs','exact PR28 descriptors and callback source survive in single registry with full original inventory'],
];
async function actualComparison(file,target,mutate){
 const url=pathToFileURL(root+'/packages/contracts/test/'+file).href,source=readFileSync(new URL(url),'utf8');let selected;
 const changed=catalogModule.CATALOG_OPERATION_BINDINGS.map(binding=>{
  if(binding.id!=='read_client_documents'||!mutate)return binding;
  const copy={...binding};mutate(copy);return copy;
 });
 const cache=new Map(),module=new SourceTextModule(source,{identifier:url,initializeImportMeta(meta){meta.url=url;}});
 await module.link(async(specifier)=>{
  if(cache.has(specifier))return cache.get(specifier);let exports;
  const resolved=specifier.startsWith('.')?new URL(specifier,url).href:specifier;
  if(specifier==='node:test')exports={default:(name,fn)=>{if(name===target){assert.equal(selected,undefined);selected=fn;}}};
  else if(resolved===bindingsUrl)exports={...catalogModule,CATALOG_OPERATION_BINDINGS:changed};
  else if(resolved.endsWith('.json'))exports={default:JSON.parse(readFileSync(new URL(resolved)))};
  else exports=await import(resolved);
  const synthetic=new SyntheticModule(Object.keys(exports),function(){for(const [name,value]of Object.entries(exports))this.setExport(name,value);},{identifier:resolved});cache.set(specifier,synthetic);return synthetic;
 });
 await module.evaluate();assert.equal(typeof selected,'function');return selected;
}
for(const [file,target]of rows){
 test(file+': exact candidate accepts complete historical comparison',async()=>assert.doesNotThrow(await actualComparison(file,target)));
 for(const [name,change]of [
  ['missing metadata',b=>delete b.dispatchProfile],['wrong metadata',b=>b.dispatchProfile='client-documents/2'],
  ['extra metadata',b=>b.extraProfileAuthority=true],['normalize callback mutation',b=>b.normalize=function changed(){return {}; }],
  ['output callback mutation',b=>b.outputAssert=function weakened(){return true;}],
 ])test(file+': actual deep comparison refuses '+name,async()=>assert.throws(await actualComparison(file,target,change),{code:'ERR_ASSERTION'}));
}
for(const id of ['read_monday_client_boards','search_memory','get_client_context','find_contacts','resolve_entity','read_client_documents'])test(id+': helper cannot silently overwrite an existing historical profile',()=>{
 const input=id==='find_contacts'?'TenantContactsInput':id==='resolve_entity'?'EntityCandidatesInput':'UnusedForThisGuard';
 assert.throws(()=>expectedExistingBinding({id,input,dispatchProfile:'unaccepted-existing-profile'}),/Historical snapshot already has a dispatch profile/);
});
