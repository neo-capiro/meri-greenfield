/** Shared THROWAWAY render inputs for render-material.test.mjs and runtime-values.test.mjs: pki.py writes a fresh PKI into a
 * temp directory, database passwords are synthetic, and every output stays in the OS temp
 * directory. Needs MERI_REVIEW_SOURCE_ROOT=<worktree root> and Python 3 with `cryptography` (MERI_TEST_PYTHON overrides). */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderMaterial,readPrivateDirectory} from './render-material.mjs';
import {MODEL_CATALOG} from '../../../packages/contracts/test/model-selection-fixture.mjs';

const here=fileURLToPath(new URL('.',import.meta.url));
export const python=process.env.MERI_TEST_PYTHON??'python';
export const TD=name=>`arn:aws:ecs:us-east-1:967807252336:task-definition/meri-product-preview-${name}:1`;
export const SVC=name=>`arn:aws:ecs:us-east-1:967807252336:service/capiro-dev/meri-product-preview-${name}`;
export const FAKE_PASSWORDS={control:'synthetic-control:p@ss/word?#'};
export const IDENTITY='synthetic-core-identity-bearer-not-real';

/** One throwaway PKI/input set per process. `work` and `pkiDir` are exposed for tests that write their own files. */
export function createRenderFixture(){
 const state={};
 async function setup(){
  if(state.inputs)return state.inputs;
  state.work=await mkdtemp(join(tmpdir(),'meri-render-test-'));state.pkiDir=join(state.work,'pki');
  const generated=spawnSync(python,['-I',join(here,'pki.py'),state.pkiDir,'--days','30'],{encoding:'utf8',timeout:120000});
  assert.equal(generated.status,0,'throwaway pki.py run');
  await writeFile(join(state.pkiDir,'db-logins.json'),JSON.stringify(FAKE_PASSWORDS));
  const pins=JSON.parse(await readFile(join(state.pkiDir,'pins.json'),'utf8')).certificates;
  const deployment=JSON.parse(await readFile(join(here,'deployment-inputs.json'),'utf8'));
  // The committed foundation readback remains historical evidence.
  state.foundationOutputs=JSON.parse(await readFile(join(here,'foundation-outputs.json'),'utf8'));
  deployment.images.nodeRuntime='967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:'+'7'.repeat(64);
  deployment.pinsDer=Object.fromEntries(Object.entries(pins).map(([k,v])=>[k,v.der]));deployment.pinsPem=Object.fromEntries(Object.entries(pins).map(([k,v])=>[k,v.pem]));
  deployment.agentcore={runtimeArn:'arn:aws:bedrock-agentcore:us-east-1:967807252336:runtime/meri_preview-synthetic',runtimeVersion:'2',qualifier:'preview'};
  const core={coreOrigin:'https://core.synthetic.invalid',frontendOrigin:'https://frontend.synthetic.invalid'};
  const runtime={schemaVersion:2,versions:{sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'},
   runtime:{runWindowMs:900000,maxOutputBytes:1048576},policyRevision:'f'.repeat(64),models:structuredClone(MODEL_CATALOG)};
  const subnets=deployment.privateSubnetIds;
  const stage3={schemaVersion:1,
   taskDefinitions:{control:TD('control'),'temporal-worker':TD('temporal-worker')},
   services:{control:SVC('control'),'temporal-worker':SVC('temporal-worker')},
   network:{control:{subnets:[...subnets],securityGroups:['sg-05a350c100574b21f','sg-0d5b5286baf28242e']},
    'temporal-worker':{subnets:[...subnets],securityGroups:['sg-00111cd0e475badfa']}}};
  state.inputs={deployment,core,runtime,stage3};return state.inputs;
 }
 async function render(change=x=>x,options={}){
  const i=structuredClone(await setup());change(i);
  return renderMaterial({...i,private:await readPrivateDirectory(state.pkiDir),...options});
 }
 async function cleanup(){if(state.work)await rm(state.work,{recursive:true,force:true});}
 return {setup,render,cleanup,get work(){return state.work;},get pkiDir(){return state.pkiDir;},get inputs(){return state.inputs;},get foundationOutputs(){return state.foundationOutputs;}};
}
