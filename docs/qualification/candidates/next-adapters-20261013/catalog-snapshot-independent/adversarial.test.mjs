/** Execute the actual repaired assertion body with controlled dependency variants. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {SourceTextModule,SyntheticModule} from 'node:vm';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;
assert.ok(root,'Exact reviewed source root required');
const file=root+'/packages/contracts/test/vertical-final-integration-independent.test.mjs';
const url=pathToFileURL(file).href;
const source=readFileSync(file,'utf8');
const canonical=await import(pathToFileURL(root+'/packages/contracts/retrieval-0.2/validate.mjs'));
const target='final all84 prior descriptors and callback bodies retain two Portfolio footnotes and accepted action dispatch metadata';
async function actualAssertion(change){
 // Use the ordinary Node realm: canonical inert DTO admission deliberately
 // refuses objects from foreign realms. This is assertion injection, not a sandbox.
 let selected;
 const register=(name,fn)=>{if(name===target){assert.equal(selected,undefined);selected=fn;}};
 const cache=new Map();
 const module=new SourceTextModule(source,{identifier:url,initializeImportMeta(meta){meta.url=url;}});
 await module.link(async(specifier)=>{
  if(cache.has(specifier))return cache.get(specifier);
  let exports;
  if(specifier==='node:test')exports={default:register};
  else if(new URL(specifier,url).href===pathToFileURL(root+'/packages/contracts/retrieval-0.2/validate.mjs').href){
   exports={...canonical,resolveOperationContract(reference){
    const resolved=canonical.resolveOperationContract(reference);
    return change?change(reference.id,resolved):resolved;
   }};
  }else exports=await import(specifier.startsWith('.')?new URL(specifier,url).href:specifier);
  const synthetic=new SyntheticModule(Object.keys(exports),function(){for(const [name,value]of Object.entries(exports))this.setExport(name,value);},{identifier:specifier});
  cache.set(specifier,synthetic);return synthetic;
 });
 await module.evaluate();assert.equal(typeof selected,'function');return selected;
}
test('Unmodified repaired assertion accepts actual catalog and every original callback identity',async()=>{const check=await actualAssertion();assert.doesNotThrow(check);});
const bindingChange=mutate=>(id,resolved)=>{if(id!=='actions.query')return resolved;const binding={...resolved.binding};mutate(binding);return {...resolved,binding};};
for(const [name,mutate]of [
 ['missing exact dispatch profile',b=>delete b.dispatchProfile],
 ['wrong dispatch profile',b=>b.dispatchProfile='actions-complete/2'],
 ['changed normalize function source',b=>b.normalize=function changedNormalizer(){return {input:'substituted'};}],
 ['changed output assertion source',b=>b.outputAssert=function weakenedOutputAssertion(){return true;}],
 ['extra binding metadata',b=>b.unacceptedMetadata=true],
 ['changed context members',b=>b.contextKeys=[...b.contextKeys,'unacceptedContext']],
])test('Actual repaired assertion still refuses '+name,async()=>{
 const check=await actualAssertion(bindingChange(mutate));assert.throws(check,{code:'ERR_ASSERTION'});
});
test('Accepted field exclusion is confined to actions.query',async()=>{
 const prior=JSON.parse(readFileSync(root+'/docs/qualification/candidates/vertical-source-20261012/vertical-final-review/pr37-identities.json'));
 const other=prior.bindings.find(b=>b.id!=='actions.query'&&!canonical.resolveOperationContract({id:b.id,version:'0.2.0'}).binding.dispatchProfile).id;
 let altered=false;
 const check=await actualAssertion((id,resolved)=>{
  if(id!==other)return resolved;
  altered=true;return {...resolved,binding:{...resolved.binding,dispatchProfile:'actions-complete/1'}};
 });
 assert.throws(check,{code:'ERR_ASSERTION'});assert.equal(altered,true);
});
test('Original exact Portfolio footnote assertions remain enforced',async()=>{
 const check=await actualAssertion((id,resolved)=>id!=='get_research_portfolio'?resolved:{...resolved,descriptor:{...resolved.descriptor,limitations:[...resolved.descriptor.limitations.slice(0,-1),'unreviewed footnote']}});
 assert.throws(check,{code:'ERR_ASSERTION'});
});
