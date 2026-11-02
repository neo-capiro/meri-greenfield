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

const SONNET='us.anthropic.claude-sonnet-4-6',OPUS='us.anthropic.claude-opus-4-6-v1',bedrock=(modelId,effort)=>({provider:'bedrock',modelId,effort});
test('the served catalog offers Sonnet and Opus at null/low/medium/high/max; every other pair, including xhigh, is refused at admission',async()=>{
 const policy=await json('policy.json'),{models}=policy.models;
 assert.deepEqual(policy.models.defaultSelection,bedrock(SONNET,null));
 assert.deepEqual(models,[
  {provider:'bedrock',modelId:SONNET,label:'Claude Sonnet 4.6',efforts:[null,'low','medium','high','max'],available:true,unavailableReason:null},
  {provider:'bedrock',modelId:OPUS,label:'Claude Opus 4.6',efforts:[null,'low','medium','high','max'],available:true,unavailableReason:null},
 ],'the committed catalog is the rendered control /models member');
 assert.equal(Object.hasOwn(policy,'pendingModels'),false);
 for(const selection of [bedrock(SONNET,null),bedrock(SONNET,'low'),bedrock(SONNET,'medium'),bedrock(SONNET,'high'),bedrock(SONNET,'max'),bedrock(OPUS,null),bedrock(OPUS,'low'),bedrock(OPUS,'medium'),bedrock(OPUS,'high'),bedrock(OPUS,'max')])
  assert.deepEqual(availableModelSelection(policy.models,selection),selection,JSON.stringify(selection));
 for(const selection of [bedrock(SONNET,'xhigh'),bedrock(OPUS,'xhigh'),bedrock('us.anthropic.claude-opus-4-6',null),bedrock('us.anthropic.claude-opus-4-6','high'),{provider:'claude-api',modelId:'claude-sonnet-4-6',effort:null}])
  assert.throws(()=>availableModelSelection(policy.models,selection),{code:'MODEL_SELECTION_UNAVAILABLE'},JSON.stringify(selection));
 assert.throws(()=>availableModelSelection(policy.models,bedrock(SONNET,'ultra')),{code:'MODEL_SELECTION_INVALID'},'a word outside the contract vocabulary is invalid, not merely unserved');
 // The runtime values carry the catalog as written; a retired pending-row key is an unexpected field, not a silent no-op.
 assert.deepEqual(parseRuntimeValues(structuredClone(await parserFixture())).models,policy.models);
 const pending=structuredClone(policy);pending.pendingModels=[];assert.throws(()=>parsePolicy(pending),{code:'RUNTIME_VALUES_REFUSED'});
 // A row Release adds before qualification is refused until it flips available:true and clears the reason.
 const held=structuredClone(policy);held.models.models.push({provider:'bedrock',modelId:'us.anthropic.claude-synthetic-held',label:'Synthetic held',efforts:[null,'high'],available:false,unavailableReason:'model_unqualified'});
 assert.equal(parsePolicy(held),held);assert.throws(()=>availableModelSelection(held.models,bedrock('us.anthropic.claude-synthetic-held','high')),{code:'MODEL_SELECTION_UNAVAILABLE'});
 const flipped=structuredClone(held);flipped.models.models[2].available=true;flipped.models.models[2].unavailableReason=null;
 assert.deepEqual(availableModelSelection(flipped.models,bedrock('us.anthropic.claude-synthetic-held','high')),bedrock('us.anthropic.claude-synthetic-held','high'));
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
