/** Host-side checks of the in-image measurement module. The CLI executable on this host is not the Linux image's, so the
 * Linux-only launch gates are expected to FAIL here; everything else (descriptor capture, per-run SDK option pins replayed
 * through the real runner-query gate, runner and skills measurement, environment scrub) is exercised for real. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {measureFirstChatLaunch,probeOptions,scrubEnvironment,skillsDigest,PROBES,RECEIPT_SCHEMA} from './first-chat-launch-measurement.mjs';
import {createPreparedRunnerQuery} from '../native-authority/runner-query.mjs';
import {measureProductRunner} from '../native-authority/ecs-prepared-task-proof.mjs';

const root=resolve(fileURLToPath(new URL('../../../',import.meta.url))),module=new URL('./first-chat-launch-measurement.mjs',import.meta.url);
const inputs={proxyUrl:'https://proxy.meri.internal:8443',model:'us.anthropic.claude-sonnet-4-6',maxTurns:3,maxCostMicroUSD:2000000,maxOutputBytes:262144,
 configParentDirectory:'/run/meri',secureStorageDirectory:'/run/meri/sdk-secure',policyRevision:'e'.repeat(64)};
const run=args=>spawnSync(process.execPath,args,{encoding:'utf8',timeout:60000,env:{PATH:process.env.PATH??'',...(process.platform==='win32'?{SystemRoot:process.env.SystemRoot}:{})}});
let receipt;const measured=async()=>receipt??=await measureFirstChatLaunch(inputs,{root});

test('importing the module performs no measurement or output; help and argument refusal exit 0/2 without stdout receipts',()=>{
 const imported=run(['--input-type=module','-e',`import(${JSON.stringify(module.href)}).then(m=>{if(typeof m.main!=='function')process.exitCode=3;});`]);
 assert.equal(imported.status,0,imported.stderr);assert.equal(imported.stdout,'');assert.equal(imported.stderr,'');
 const help=run([fileURLToPath(module),'--help']);assert.equal(help.status,0);assert.match(help.stdout,/Exit0 receipt printed/u);
 for(const args of [['--proxy-url'],['--unknown','x'],['--max-turns','3']]){const r=run([fileURLToPath(module),...args]);assert.equal(r.status,2,args.join(' '));assert.equal(r.stdout,'');}
});

test('descriptor capture yields a credential-free launch template bound to the policy inputs',async()=>{
 const r=await measured();
 assert.equal(r.schema,RECEIPT_SCHEMA);assert.equal(r.versions.sdk,'0.3.295');assert.equal(r.versions.cli,'2.1.295');
 const {command,args,env}=r.launchTemplate;
 assert.equal(command,r.executable.path);assert.match(r.executable.sha256,/^[a-f0-9]{64}$/u);
 assert.ok(args.includes('--max-turns=3')&&args.includes('--model=us.anthropic.claude-sonnet-4-6')&&args.includes('--max-budget-usd=2'));
 assert.equal(Object.hasOwn(env,'CLAUDE_CONFIG_DIR'),false);assert.equal(Object.hasOwn(env,'ANTHROPIC_AUTH_TOKEN'),false);
 assert.equal(env.ANTHROPIC_BASE_URL,'https://proxy.meri.internal:8443/');assert.equal(env.NODE_EXTRA_CA_CERTS,'/run/meri/poststart/bootstrap/control-ca.pem');
 assert.equal(env.CLAUDE_SECURESTORAGE_CONFIG_DIR,'/run/meri/sdk-secure');assert.equal(env.CLAUDE_CODE_MAX_OUTPUT_TOKENS,'8192');
 assert.equal(JSON.stringify(r).includes('meri-measurement-synthetic-credential'),false,'the probe credential never reaches the receipt');
 for(const k of ['commandIsRealpath','runnerCaTrust','secureStorage'])assert.equal(r.gates[k],'PASS',k);
 if(process.platform==='linux')for(const [k,v] of Object.entries(r.gates))assert.equal(v,'PASS',k);
});

test('sdkOptionsSha256 is what runner-query.mjs admits for the probe run and refuses for any other run',async()=>{
 const r=await measured();assert.equal(r.sdkOptions.perRun,true);assert.notEqual(r.sdkOptions.sha256,r.sdkOptions.secondProbeSha256);
 const gate=()=>createPreparedRunnerQuery({sdkOptionsSha256:r.sdkOptions.sha256,processClientFactory:()=>({}),prepare:()=>{throw Error('not reached');}});
 const accepted=gate()({prompt:'p',options:await probeOptions(inputs,{root})});assert.equal(typeof accepted[Symbol.asyncIterator],'function');
 // Another run (new conversationId/runId: cwd and CLAUDE_CONFIG_DIR differ) is refused synchronously by query().
 const second=await probeOptions(inputs,{root,binding:PROBES[1]});
 assert.throws(()=>gate()({prompt:'p',options:second}),/SDK_OPTIONS_REFUSED/u);
});

test('runner and skills values equal the repository measurement functions; the environment scrub drops injected secrets',async()=>{
 const r=await measured();
 assert.equal(r.runner.sha256,(await measureProductRunner({root})).runnerSha256);
 assert.deepEqual(r.skills,await skillsDigest({root}));assert.equal(r.skills.count,14);
 const env={PGPASSWORD:'x',PGUSER:'u',MERI_D2_CONTROL_PASSWORD:'y',AWS_SESSION_TOKEN:'z',DATABASE_URL:'d',ANTHROPIC_API_KEY:'k',PATH:'/usr/bin',HOME:'/home/node'};
 scrubEnvironment(env);assert.deepEqual(env,{PATH:'/usr/bin',HOME:'/home/node'});
});
