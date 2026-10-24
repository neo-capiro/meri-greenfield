import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parsePolicy,policyRevisionOf,runtimeValues,main} from './runtime-values.mjs';
import {parseRuntimeValues} from './render-material.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
const json=async name=>JSON.parse(await readFile(new URL(name,import.meta.url),'utf8'));
const parserFixture=async()=>({...await json('runtime-values.json'),models:(await json('policy.json')).models});

test('policy carries execution limits and the explicit qualified model catalog',async()=>{
 const policy=await json('policy.json');assert.equal(parsePolicy(policy),policy);assert.equal(policyRevisionOf(policy),canonicalSha256(policy));
 for(const change of [p=>p.model={},p=>p.runtime.maxTurns=3,p=>p.allocation={},p=>p.runnerLayout={},p=>p.runtime.runWindowMs=59999,p=>p.runtime.runWindowMs=28800001,p=>p.runtime.maxOutputBytes=0,p=>p.runtime.maxOutputBytes=1048577]){
  const p=structuredClone(policy);change(p);assert.throws(()=>parsePolicy(p));
 }
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
