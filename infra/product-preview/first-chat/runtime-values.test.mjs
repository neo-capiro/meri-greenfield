/** runtime-values.mjs on THROWAWAY material: the receipt is a real host measurement (same module the image runs) whose only
 * Linux-specific facts (platform, CLI executable path/hash, Linux path gates) are replaced by clearly synthetic Linux values,
 * because the claude CLI is platform-specific. The assembled runtime.json then goes through render-material's full validation
 * with the shared throwaway PKI fixture. Run with MERI_REVIEW_SOURCE_ROOT=<worktree root> and Python 3 with `cryptography`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {measureFirstChatLaunch} from '../../../apps/runtime/build/first-chat-launch-measurement.mjs';
import {runtimeValues,policyRevisionOf,measurementOverrides,embeddedNodeArguments,decodeEmbeddedModule,measurementArguments,MEASUREMENT_MODULE,CONTAINER,main} from './runtime-values.mjs';
import {SOURCE_ROOT,withPosixPaths} from './render-material.mjs';
import {createRenderFixture} from './render-material.fixture.mjs';
import {compilePreparedCandidateConfiguration} from '../../../apps/runtime/prepared-candidate-config.mjs';
import {allocation as parseAllocation} from '../../../apps/gateway/budget/tool-budget-binding.mjs';

const here=fileURLToPath(new URL('.',import.meta.url)),json=async name=>JSON.parse(await readFile(join(here,name),'utf8'));
const fixture=createRenderFixture();test.after(()=>fixture.cleanup());
const LINUX_CLI='/opt/meri/apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude';
let base;
async function committed(){
 if(base)return structuredClone(base);
 const policy=await json('policy.json'),allocation=await json('allocation.json'),deployment=(await fixture.setup()).deployment,policyRevision=policyRevisionOf(policy);
 const host=await measureFirstChatLaunch({proxyUrl:deployment.origins.proxyUrl,model:deployment.model.profileId,maxTurns:policy.runtime.maxTurns,maxCostMicroUSD:deployment.model.perRunMaxCostMicroUSD,
  maxOutputBytes:policy.runtime.maxOutputBytes,configParentDirectory:policy.runnerLayout.configParentDirectory,secureStorageDirectory:policy.runnerLayout.secureStorageDirectory,policyRevision},{root:SOURCE_ROOT});
 // SYNTHETIC Linux facts only; every other receipt value is the host measurement.
 const receipt={...host,platform:{os:'linux',arch:'x64',node:host.platform.node,uid:1000},executable:{path:LINUX_CLI,sha256:'9'.repeat(64),bytes:host.executable.bytes},
  launchTemplate:{...host.launchTemplate,command:LINUX_CLI},gates:Object.fromEntries(Object.keys(host.gates).map(k=>[k,'PASS']))};
 base={policy,allocation,deployment,receipt,policyRevision};return structuredClone(base);
}
const assemble=async(change=x=>x,options={})=>{const v=await committed();change(v);return runtimeValues({...v,...options});};

test('committed allocation.json and policy.json are self-consistent and admitted by the gateway allocation parser',async()=>{
 const {policy,allocation}=await committed();
 assert.equal(policy.allocationSha256,canonicalSha256(allocation));assert.match(policyRevisionOf(policy),/^[a-f0-9]{64}$/u);
 assert.deepEqual(allocation.manifest.budgets,{maxTurns:3,maxToolCalls:1,maxRecoveryAttempts:0,maxRuntimeSeconds:900,maxCostMicroUSD:2000000,maxOutputBytes:262144});
 assert.equal(allocation.scheduleRevision,canonicalSha256(allocation.operations));
 // Worst-case model hold per call (product-model-budget.mjs) at the D1 envelope; maxTurns of them fit inside the per-run cap.
 const hold=Math.ceil((6600*65536+16500*8192)/1000);assert.ok(hold*allocation.manifest.budgets.maxTurns<=2000000&&hold*(allocation.manifest.budgets.maxTurns+1)>2000000);
 const run={tenantId:'t',actorId:'a',conversationId:'00000000-0000-4000-8000-000000000001',runId:'00000000-0000-4000-8000-000000000002'};
 parseAllocation(JSON.stringify({run,manifest:allocation.manifest,manifestSha256:canonicalSha256(allocation.manifest),catalogSha256:allocation.catalogSha256,budgets:allocation.manifest.budgets,
  schedule:{revision:allocation.scheduleRevision,expiresAt:'2100-01-01T00:00:00.000Z',operations:allocation.operations}}));
});

test('assembled runtime.json renders all five roles through every render-material validator with throwaway PKI',async()=>{
 const {runtime,policyRevision,skillsDigest}=await assemble();
 const {roles,summary}=await fixture.render(i=>{i.runtime=runtime;});
 const control=JSON.parse(roles.control.configBytes.toString('utf8')),c=control.nativeCandidate,{receipt}=await committed();
 assert.equal(c.qualification.policyRevision,policyRevision);assert.equal(control.versions.skillsDigest,skillsDigest);
 assert.equal(c.preparationIntent.executableSha256,receipt.executable.sha256);assert.equal(c.preparationIntent.sdkOptionsSha256,receipt.sdkOptions.sha256);
 assert.equal(c.preparationIntent.runnerSha256,receipt.runner.sha256);assert.deepEqual(c.preparationIntent.launchTemplate,receipt.launchTemplate);
 assert.equal(c.preparationIntent.configParentDirectory,'/run/meri');assert.equal(c.preparationIntent.secureStorageDirectory,'/run/meri/sdk-secure');
 assert.deepEqual(JSON.parse(c.allocationJson).budgets,runtime.allocation.manifest.budgets);assert.equal(c.runtime.maxTurns,3);assert.equal(c.runtime.maxOutputBytes,262144);
 assert.equal(c.runtime.maxCostMicroUSD,2000000);assert.equal(c.multiRun.runWindowMs,900000);assert.equal(summary.staticCandidate.policyRevision,policyRevision);
 withPosixPaths(()=>compilePreparedCandidateConfiguration(c,control.versions));
});

test('fail closed: non-template SDK option pin, foreign platform, drifted inputs, skills, allocation or envelope',async()=>{
 const refused=(change,code='RUNTIME_VALUES_REFUSED',options={})=>assert.rejects(assemble(change,options),{code});
 // A per-run (probe) value, a template the runner gate did not admit, or one the source options code does not reproduce.
 await refused(v=>{v.receipt.sdkOptions.runInvariant=false;v.receipt.sdkOptions.secondProbeSha256='a'.repeat(64);});
 await refused(v=>{v.receipt.sdkOptions.schema=undefined;});
 await refused(v=>{v.receipt.gates.runnerSdkOptions='FAIL: SDK_OPTIONS_REFUSED';});
 await refused(v=>{delete v.receipt.gates.runnerSdkOptions;});
 await refused(v=>{v.receipt.sdkOptions.sha256=v.receipt.sdkOptions.secondProbeSha256='b'.repeat(64);});
 await refused(v=>{v.receipt.schema='meri.first-chat-launch-measurement.v1';});
 await refused(v=>{v.receipt.platform.os='win32';});
 await refused(v=>{v.receipt.platform.uid=0;});
 await refused(v=>{v.receipt.gates.matchPreparedDescriptor='FAIL: x';});
 await refused(v=>{v.receipt.inputs.maxTurns=4;});
 await refused(v=>{v.receipt.inputs.policyRevision='0'.repeat(64);});
 await refused(v=>{v.receipt.skills.digest='a'.repeat(64);});
 await refused(v=>{v.receipt.launchTemplate.env.ANTHROPIC_AUTH_TOKEN='leak';});
 await refused(v=>{v.receipt.launchTemplate.command='/usr/bin/other';});
 await refused(v=>{v.allocation.manifest.budgets.maxToolCalls=2;});
 await refused(v=>{v.allocation.scheduleRevision='0'.repeat(64);});
 await refused(v=>{v.policy.runtime.maxTurns=4;});
 await refused(v=>{v.policy.model.maxOutputTokens=16384;});
 await refused(v=>{v.deployment.model.perRunMaxCostMicroUSD=3000000;});
 await refused(v=>{const a=v.allocation;a.manifest.budgets.maxCostMicroUSD=1000000;v.policy.allocationSha256=canonicalSha256(a);});
});

test('measurement override embeds the exact committed module, fits ECS limits, and its loader produces a receipt for the policy inputs',async()=>{
 const {policy,deployment,policyRevision}=await committed(),moduleBytes=await readFile(join(SOURCE_ROOT,MEASUREMENT_MODULE));
 const overrides=measurementOverrides({moduleBytes,policy,deployment,policyRevision});
 assert.ok(Buffer.byteLength(JSON.stringify(overrides))<=8192);assert.equal(overrides.containerOverrides[0].name,CONTAINER);
 const command=overrides.containerOverrides[0].command[0],decoded=decodeEmbeddedModule(command);
 assert.ok(decoded.bytes.equals(moduleBytes));assert.match(command,/^set -euo pipefail; umask 077; exec -c \/usr\/local\/bin\/node /u);
 const shipped=measurementOverrides({moduleBytes,policy,deployment,policyRevision,mode:'shipped'}).containerOverrides[0].command[0];
 assert.match(shipped,/exec -c \/usr\/local\/bin\/node 'apps\/runtime\/build\/first-chat-launch-measurement\.mjs'/u);
 // The embedded loader end to end on this host: write directory and image root redirected, injected secret dropped.
 const dir=await mkdtemp(join(tmpdir(),'meri-measure-'));
 try{
  const args=embeddedNodeArguments({moduleBytes,policy,deployment,policyRevision,root:SOURCE_ROOT,directory:join(dir,'measure')});
  const r=spawnSync(process.execPath,args,{encoding:'utf8',timeout:120000,env:{...(process.platform==='win32'?{SystemRoot:process.env.SystemRoot}:{}),PGPASSWORD:'synthetic-secret'}});
  assert.equal(r.status,0,r.stderr);const receipt=JSON.parse(r.stdout);
  assert.deepEqual(measurementArguments({policy,deployment,policyRevision,root:SOURCE_ROOT}).filter((_,i)=>i%2===1).slice(0,9).map(String),
   [receipt.inputs.proxyUrl,receipt.inputs.model,String(receipt.inputs.maxTurns),String(receipt.inputs.maxCostMicroUSD),String(receipt.inputs.maxOutputBytes),
    receipt.inputs.configParentDirectory,receipt.inputs.secureStorageDirectory,receipt.inputs.policyRevision,SOURCE_ROOT]);
  assert.equal(r.stdout.includes('synthetic-secret'),false);
  const tampered=[...args];tampered[4]='0'.repeat(64);assert.equal(spawnSync(process.execPath,tampered,{encoding:'utf8',timeout:60000}).status,3);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('CLI assemble writes runtime-values.json, refuses the removed acknowledgement flag; policy-revision prints canonicalSha256(policy.json)',async()=>{
 const {receipt,policyRevision}=await committed(),dir=await mkdtemp(join(tmpdir(),'meri-runtime-values-'));
 const capture=async argv=>{const out=[],err=[],o=process.stdout.write.bind(process.stdout),e=process.stderr.write.bind(process.stderr);
  process.stdout.write=t=>{out.push(String(t));return true;};process.stderr.write=t=>{err.push(String(t));return true;};
  try{return {code:await main(argv),out:out.join(''),err:err.join('')};}finally{process.stdout.write=o;process.stderr.write=e;}};
 try{
  const {writeFile}=await import('node:fs/promises');const receiptFile=join(dir,'receipt.json'),deploymentFile=join(dir,'deployment.json');
  await writeFile(receiptFile,JSON.stringify(receipt));await writeFile(deploymentFile,JSON.stringify((await committed()).deployment));
  // The escape hatch is gone: the flag is now an unknown argument (usage, exit 2) and writes nothing.
  const refused=await capture(['assemble','--receipt',receiptFile,'--deployment-inputs',deploymentFile,'--out',join(dir,'a.json'),'--acknowledge-per-run-sdk-options']);
  assert.equal(refused.code,2);assert.match(refused.err,/Usage:/u);
  const ok=await capture(['assemble','--receipt',receiptFile,'--deployment-inputs',deploymentFile,'--out',join(dir,'b.json')]);
  assert.equal(ok.code,0,ok.err);assert.equal(JSON.parse(ok.out).policyRevision,policyRevision);
  assert.equal(JSON.parse(await readFile(join(dir,'b.json'),'utf8')).qualification.policyRevision,policyRevision);
  const revision=await capture(['policy-revision']);assert.equal(revision.code,0);assert.equal(revision.out.trim(),policyRevision);
 }finally{await rm(dir,{recursive:true,force:true});}
});
