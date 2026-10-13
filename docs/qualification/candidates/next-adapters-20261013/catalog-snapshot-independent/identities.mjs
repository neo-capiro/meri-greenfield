import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;assert.ok(root);
const {canonicalSha256:hash}=await import(pathToFileURL(root+'/packages/contracts/validate.mjs'));
const {resolveOperationContract}=await import(pathToFileURL(root+'/packages/contracts/retrieval-0.2/validate.mjs'));
const prior=JSON.parse(readFileSync(root+'/docs/qualification/candidates/vertical-source-20261012/vertical-final-review/pr37-identities.json'));
const resolve=id=>resolveOperationContract({id,version:'0.2.0'});
const serialize=x=>JSON.parse(JSON.stringify(x,(_k,v)=>typeof v==='function'?{source:v.toString()}:v));
const bindings=prior.bindings.map(old=>{const serial=serialize(resolve(old.id).binding);return {id:old.id,original:old.sha256,current:hash(serial),serial};});
const deltas=bindings.filter(row=>row.original!==row.current);assert.equal(deltas.length,1);assert.equal(deltas[0].id,'actions.query');
const action=deltas[0],{dispatchProfile,...remaining}=action.serial;
assert.equal(dispatchProfile,'actions-complete/1');assert.equal(hash(remaining),action.original);
assert.equal(action.original,'f86b3316cd727bd6edfd6bd1c544f2fba5ae2269814b150a28cda4e999ebcfca');
assert.equal(action.current,'7db58f4c6274657311825cff0017bcff49e1d0aa52a20dfe99d27a989d30a587');
const descriptorDeltas=[];let footnotes=0;
for(const old of prior.operations){const actual=structuredClone(resolve(old.id).descriptor);
 if(['get_research_portfolio','get_research_portfolio_changes'].includes(old.id)){
  assert.equal(actual.limitations.at(-1),'Projected Portfolio evidence has its own get_research_evidence binding; this detail/changes operation does not return it.');
  actual.limitations[actual.limitations.length-1]=prior.oldPortfolioLimitation;footnotes++;
 }
 if(hash(actual)!==old.sha256)descriptorDeltas.push(old.id);
}assert.deepEqual(descriptorDeltas,[]);assert.equal(footnotes,2);
console.log(JSON.stringify({result:'PASS_EXACT_HISTORICAL_IDENTITIES',descriptorCount:prior.operations.length,bindingCount:bindings.length,descriptorDeltas,originalPortfolioFootnotesRetained:footnotes,bindingDeltaCount:deltas.length,actionQuery:{original:action.original,current:action.current,dispatchProfile,remainingFullBindingHash:hash(remaining),remainingBinding:remaining}}));
