/** Synthetic material only: no private deployment files or AWS access. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {parseDeploymentInputs,SOURCE_ROOT} from './render-material.mjs';
import {createRenderFixture,python} from './render-material.fixture.mjs';

const inputs=JSON.parse(await readFile(new URL('./deployment-inputs.json',import.meta.url),'utf8'));
test('deployment telemetry label defaults only when absent and accepts only Preview or Production',()=>{
 assert.deepEqual(parseDeploymentInputs(inputs).telemetry,{environment:'Preview'});
 assert.deepEqual(parseDeploymentInputs({...inputs,telemetry:{environment:'Production'}}).telemetry,{environment:'Production'});
 for(const telemetry of [null,{},'Preview',{environment:'preview'},{environment:'Preview',enabled:true}])assert.throws(()=>parseDeploymentInputs({...inputs,telemetry}));
});

test('rendered control, owner and proxy carry one shared environment and leave OTel disabled',async()=>{
 const fixture=createRenderFixture();
 try{
  const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:SOURCE_ROOT,encoding:'utf8'}).trim();
  for(const environment of ['Preview','Production']){
   const {roles}=await fixture.render(i=>{i.deployment.images.nodeRuntimeSourceCommit=sourceCommit;if(environment==='Production')i.deployment.telemetry={environment};});
   for(const role of ['control','model-owner','model-proxy']){
    const c=JSON.parse(roles[role].configBytes);assert.deepEqual(c.telemetry,{environment});
    assert.equal(c.telemetry.enabled,undefined);assert.equal(c.telemetry.endpoint,undefined);
   }
   for(const role of ['temporal-worker','temporal-issuer'])assert.equal(JSON.parse(roles[role].configBytes).telemetry,undefined);
   const proxy=roles['model-proxy'],path=join(fixture.work,`telemetry-${environment}.json`);await writeFile(path,proxy.configBytes);
   const script='import sys\nfrom apps.proxy.product.startup_config import parse_product_proxy_startup\nparse_product_proxy_startup(open(sys.argv[1],"rb").read(),sys.argv[2])\n';
   const result=spawnSync(python,['-c',script,path,proxy.configSha256],{cwd:SOURCE_ROOT,encoding:'utf8',timeout:30000});
   assert.equal(result.status,0,result.stderr);
  }
 }finally{await fixture.cleanup();}
});
