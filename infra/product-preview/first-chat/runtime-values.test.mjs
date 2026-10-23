import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parsePolicy,parseAllocationFile,policyRevisionOf,activeReadOperationsOf,runtimeValues,main} from './runtime-values.mjs';
import {parseRuntimeValues} from './render-material.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
const json=async name=>JSON.parse(await readFile(new URL(name,import.meta.url),'utf8'));

test('native material retains read allocation and layout without a deployment model policy',async()=>{
 const policy=await json('policy.json'),allocation=await json('allocation.json');
 assert.equal(parsePolicy(policy),policy);
 assert.deepEqual(await parseAllocationFile(allocation,policy),allocation);
 assert.equal(policyRevisionOf(policy),canonicalSha256(policy));
 for(const change of [p=>{p.model={};},p=>{p.runtime.maxTurns=3;},p=>{p.runnerLayout.workspaceRoot='/foreign';},p=>{p.runnerLayout.configParentDirectory='/';}]){
  const p=structuredClone(policy);change(p);assert.throws(()=>parsePolicy(p));
 }
 const altered=structuredClone(allocation);altered.operations.pop();
 await assert.rejects(parseAllocationFile(altered,policy));
});

test('runtime parser refuses the retired launch and model-limit inputs',async()=>{
 const source=await json('runtime-values.json');parseRuntimeValues(source);
 for(const key of ['launchTemplate','executableSha256','sdkOptionsSha256']){
  const copy=structuredClone(source);copy.preparationIntent[key]='retired';
  assert.throws(()=>parseRuntimeValues(copy));
 }
 const copy=structuredClone(source);copy.runtime.maxTurns=3;
 assert.throws(()=>parseRuntimeValues(copy));
});

test('assembler refuses a foreign image source before projecting any material',async()=>{
 await assert.rejects(runtimeValues({allocation:await json('allocation.json'),policy:await json('policy.json'),deployment:{images:{nodeRuntimeSourceCommit:'0'.repeat(40)}}}),/clean image checkout/u);
});

test('disabled read installation has no generated material',()=>{
 assert.equal(activeReadOperationsOf({}),null);
 assert.equal(activeReadOperationsOf({features:{reads:{enabled:false}}}),null);
});

test('CLI refuses retired measurement and receipt commands',async()=>{
 assert.equal(await main(['measurement-override']),2);
 assert.equal(await main(['assemble','--receipt','retired.json','--out','unused.json']),2);
});
