/** Synthetic material only: no private deployment files or AWS access. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {parseDeploymentInputs,SOURCE_ROOT} from './render-material.mjs';
import {createRenderFixture} from './render-material.fixture.mjs';

const inputs=JSON.parse(await readFile(new URL('./deployment-inputs.json',import.meta.url),'utf8'));
test('deployment telemetry label defaults only when absent and accepts only Preview or Production',()=>{
 assert.deepEqual(parseDeploymentInputs(inputs).telemetry,{environment:'Preview'});
 assert.deepEqual(parseDeploymentInputs({...inputs,telemetry:{environment:'Production'}}).telemetry,{environment:'Production'});
 for(const telemetry of [null,{},'Preview',{environment:'preview'},{environment:'Preview',enabled:true}])assert.throws(()=>parseDeploymentInputs({...inputs,telemetry}));
});

test('rendered control carries its environment and leaves OTel disabled',async()=>{
 const fixture=createRenderFixture();
 try{
  const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:SOURCE_ROOT,encoding:'utf8'}).trim();
  for(const environment of ['Preview','Production']){
   const {roles}=await fixture.render(i=>{i.deployment.images.nodeRuntimeSourceCommit=sourceCommit;if(environment==='Production')i.deployment.telemetry={environment};});
   const c=JSON.parse(roles.control.configBytes);assert.deepEqual(c.telemetry,{environment});
   assert.equal(c.telemetry.enabled,undefined);assert.equal(c.telemetry.endpoint,undefined);
   for(const role of ['temporal-worker','temporal-issuer'])assert.equal(JSON.parse(roles[role].configBytes).telemetry,undefined);
  }
 }finally{await fixture.cleanup();}
});
