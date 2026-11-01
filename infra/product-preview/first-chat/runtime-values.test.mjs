import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parsePolicy,policyRevisionOf,runtimeValues,main} from './runtime-values.mjs';
import {parseRuntimeValues} from './render-material.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {availableModelSelection} from '../../../packages/contracts/model-selection.mjs';
const json=async name=>JSON.parse(await readFile(new URL(name,import.meta.url),'utf8'));
const parserFixture=async()=>({...await json('runtime-values.json'),models:(await json('policy.json')).models});

test('policy carries execution limits and the explicit qualified model catalog',async()=>{
 const policy=await json('policy.json');assert.equal(parsePolicy(policy),policy);assert.equal(policyRevisionOf(policy),canonicalSha256(policy));
 for(const change of [p=>p.model={},p=>p.runtime.maxTurns=3,p=>p.allocation={},p=>p.runnerLayout={},p=>p.runtime.runWindowMs=59999,p=>p.runtime.runWindowMs=28800001,p=>p.runtime.maxOutputBytes=0,p=>p.runtime.maxOutputBytes=1048577]){
  const p=structuredClone(policy);change(p);assert.throws(()=>parsePolicy(p));
 }
});

test('the served catalog offers Sonnet at its default effort only; Opus and explicit Sonnet efforts stay unavailable until Release flips them',async()=>{
 const policy=await json('policy.json'),{models}=policy.models,sonnet=models.find(m=>m.modelId==='us.anthropic.claude-sonnet-4-6'),opus=models.find(m=>m.modelId==='us.anthropic.claude-opus-4-6-v1');
 assert.deepEqual(policy.models.defaultSelection,{provider:'bedrock',modelId:'us.anthropic.claude-sonnet-4-6',effort:null});
 assert.deepEqual(sonnet,{provider:'bedrock',modelId:'us.anthropic.claude-sonnet-4-6',label:'Claude Sonnet 4.6',efforts:[null],available:true,unavailableReason:null},'the live-proven Sonnet row is byte-for-byte the retained catalog row');
 assert.deepEqual(opus,{provider:'bedrock',modelId:'us.anthropic.claude-opus-4-6-v1',label:'Claude Opus 4.6',efforts:[null,'high','max'],available:false,unavailableReason:'model_unqualified'});
 assert.deepEqual(policy.pendingModels,[{provider:'bedrock',modelId:'us.anthropic.claude-sonnet-4-6',label:'Claude Sonnet 4.6',efforts:['high','max'],available:false,unavailableReason:'model_unqualified'}]);
 for(const selection of [{provider:'bedrock',modelId:'us.anthropic.claude-opus-4-6-v1',effort:null},{provider:'bedrock',modelId:'us.anthropic.claude-opus-4-6-v1',effort:'high'},{provider:'bedrock',modelId:'us.anthropic.claude-sonnet-4-6',effort:'high'},{provider:'bedrock',modelId:'us.anthropic.claude-sonnet-4-6',effort:'max'},{provider:'claude-api',modelId:'claude-sonnet-4-6',effort:null}])
  assert.throws(()=>availableModelSelection(policy.models,selection),{code:'MODEL_SELECTION_UNAVAILABLE'},JSON.stringify(selection));
 assert.deepEqual(availableModelSelection(policy.models,policy.models.defaultSelection),policy.models.defaultSelection);
 // The runtime values and served configuration carry `models` only; pending rows never reach the catalog.
 const values=structuredClone(await parserFixture());assert.equal(Object.hasOwn(parseRuntimeValues(values),'pendingModels'),false);
 const flipped=structuredClone(policy);flipped.models.models[1].available=true;flipped.models.models[1].unavailableReason=null;
 assert.equal(parsePolicy(flipped),flipped,'Release flips a row by setting available:true and clearing the reason');
 assert.deepEqual(availableModelSelection(flipped.models,{provider:'bedrock',modelId:'us.anthropic.claude-opus-4-6-v1',effort:'max'}),{provider:'bedrock',modelId:'us.anthropic.claude-opus-4-6-v1',effort:'max'});
 const merged=structuredClone(policy);merged.models.models[0].efforts=[null,'high','max'];merged.pendingModels=[];
 assert.equal(parsePolicy(merged),merged,'Release flips pending Sonnet efforts by moving them onto the served row');
 assert.deepEqual(availableModelSelection(merged.models,{provider:'bedrock',modelId:'us.anthropic.claude-sonnet-4-6',effort:'high'}).effort,'high');
 for(const change of [
  p=>p.pendingModels=[{...p.pendingModels[0],available:true,unavailableReason:null}],
  p=>p.pendingModels=[{...p.pendingModels[0],efforts:[null]}],
  p=>p.pendingModels=[{...p.pendingModels[0],efforts:['high','high']}],
  p=>p.pendingModels=[p.pendingModels[0],p.pendingModels[0]],
  p=>p.pendingModels=[{...p.pendingModels[0],efforts:['medium','ultra']}],
  p=>p.pendingModels=[{...p.pendingModels[0],secretArn:'hidden'}],
  p=>p.pendingModels=[{...p.pendingModels[0],provider:'openai'}],
  p=>p.pendingModels={},
  p=>p.pendingModels=null,
 ]){const p=structuredClone(policy);change(p);assert.throws(()=>parsePolicy(p),{code:'RUNTIME_VALUES_REFUSED'});}
 const none=structuredClone(policy);delete none.pendingModels;assert.equal(parsePolicy(none),none,'a policy without pending rows is still a policy');
});

test('runtime parser requires the catalog and refuses retired task allocation, launch and old fixed-model inputs',async()=>{
 const source=await parserFixture();parseRuntimeValues(source);
 for(const key of ['preparationIntent','allocation','qualification','generalReadInstallation','model','launchTemplate','executableSha256','sdkOptionsSha256']){
  const copy=structuredClone(source);copy[key]={};assert.throws(()=>parseRuntimeValues(copy));
 }
 for(const change of [v=>v.runtime.maxTurns=3,v=>v.schemaVersion=1,v=>v.versions.sdk='foreign',v=>v.versions.cli='foreign',v=>v.versions.skillsDigest='foreign',v=>v.policyRevision='foreign']){
  const copy=structuredClone(source);change(copy);assert.throws(()=>parseRuntimeValues(copy));
 }
});

test('assembler refuses a foreign image source before projecting any material',async()=>{
 await assert.rejects(runtimeValues({policy:await json('policy.json'),deployment:{images:{nodeRuntimeSourceCommit:'0'.repeat(40)}}}),/clean image checkout/);
});

test('runtime parser rejects missing policy and execution bounds',async()=>{
 const source=await parserFixture();
 for(const key of ['versions','runtime','policyRevision','models']){const copy=structuredClone(source);delete copy[key];assert.throws(()=>parseRuntimeValues(copy));}
 for(const key of ['runWindowMs','maxOutputBytes']){const copy=structuredClone(source);delete copy.runtime[key];assert.throws(()=>parseRuntimeValues(copy));}
});

test('CLI refuses retired measurement, receipt and allocation commands',async()=>{
 assert.equal(await main(['measurement-override']),2);
 assert.equal(await main(['assemble','--receipt','retired.json','--out','unused.json']),2);
 assert.equal(await main(['assemble','--allocation','retired.json','--out','unused.json']),2);
});
