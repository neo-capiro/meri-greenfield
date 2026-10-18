/** Host-side checks of the in-image measurement module. The CLI executable on this host is not the Linux image's, so the
 * Linux-only launch gates are expected to FAIL here; everything else (descriptor capture, the run-invariant SDK option template
 * replayed through the real runner-query gate, runner and skills measurement, environment scrub) is exercised for real. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {measureFirstChatLaunch,probeRun,scrubEnvironment,skillsDigest,generalReadInstallation,PROBES,RECEIPT_SCHEMA} from './first-chat-launch-measurement.mjs';
import {createPreparedRunnerQuery} from '../native-authority/runner-query.mjs';
import {measureProductRunner} from '../native-authority/ecs-prepared-task-proof.mjs';
import {measureGeneralReadInstallation,createGeneralReadInstallationIssuer,GENERAL_READ_INSTALLATION_MEASUREMENT_SCHEMA} from '../../gateway/general-reads/installation-issuer.mjs';
import {installationReadOperations} from '../native-authority/general-read-installation/runtime.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};

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

test('sdkOptionsSha256 is one run-invariant template hash runner-query.mjs admits for every probe run and refuses on any other option',async()=>{
 const r=await measured();assert.equal(r.sdkOptions.runInvariant,true);assert.equal(r.sdkOptions.sha256,r.sdkOptions.secondProbeSha256);
 assert.equal(r.sdkOptions.schema,'meri.sdk-options-template.v1');assert.equal(r.gates.runnerSdkOptions,'PASS');
 assert.notEqual(r.sdkOptions.probes[0].workspace,r.sdkOptions.probes[1].workspace);assert.notEqual(r.sdkOptions.probes[0].sdkConfigDirectory,r.sdkOptions.probes[1].sdkConfigDirectory);
 const gate=run=>createPreparedRunnerQuery({sdkOptions:{sdkOptionsSha256:r.sdkOptions.sha256,run},processClientFactory:()=>({}),prepare:()=>{throw Error('not reached');}});
 const first=await probeRun(inputs,{root}),second=await probeRun(inputs,{root,binding:PROBES[1]});
 // Two runs (different conversationId/runId: cwd, CLAUDE_CONFIG_DIR and request context differ) pass with the one configured value.
 for(const p of [first,second])assert.equal(typeof gate(p.run)({prompt:'p',options:p.options})[Symbol.asyncIterator],'function');
 // A run's options against another run's facts, or with a changed option, are refused synchronously by query().
 assert.throws(()=>gate(first.run)({prompt:'p',options:second.options}),/SDK_OPTIONS_REFUSED/u);
 assert.throws(()=>gate(first.run)({prompt:'p',options:{...first.options,model:'other-model'}}),/SDK_OPTIONS_REFUSED/u);
});

test('runner and skills values equal the repository measurement functions; the environment scrub drops injected secrets',async()=>{
 const r=await measured();
 assert.equal(r.runner.sha256,(await measureProductRunner({root})).runnerSha256);
 assert.deepEqual(r.skills,await skillsDigest({root}));assert.equal(r.skills.count,15);
 const env={PGPASSWORD:'x',PGUSER:'u',MERI_D2_CONTROL_PASSWORD:'y',AWS_SESSION_TOKEN:'z',DATABASE_URL:'d',ANTHROPIC_API_KEY:'k',PATH:'/usr/bin',HOME:'/home/node'};
 scrubEnvironment(env);assert.deepEqual(env,{PATH:'/usr/bin',HOME:'/home/node'});
});

test('generalReadInstallation is the deterministic P2 measurement over the catalog and installable operations, and the control issuer accepts exactly it',async()=>{
 const r=await measured(),g=r.generalReadInstallation,again=await generalReadInstallation({root});
 assert.deepEqual(Object.keys(g),['measurement','measurementSha256']);assert.match(g.measurementSha256,/^[a-f0-9]{64}$/u);
 assert.equal(canonicalSha256(g.measurement),g.measurementSha256);assert.deepEqual(again,{measurement:g.measurement,measurementSha256:g.measurementSha256});
 // The same value the composer's issuer re-measures: the runtime catalog and installationReadOperations() of this tree.
 const direct=await measureGeneralReadInstallation({catalogJson:JSON.stringify(catalog),operations:installationReadOperations()});
 assert.equal(direct.measurementSha256,g.measurementSha256);
 assert.equal(g.measurement.schema,GENERAL_READ_INSTALLATION_MEASUREMENT_SCHEMA);assert.equal(g.measurement.baseCatalogSha256,r.skills.catalogSha256);
 assert.equal(g.measurement.operations.length,installationReadOperations().length);assert.ok(g.measurement.operations.length>=1&&g.measurement.operations.length<=128);
 const keys=g.measurement.operations.map(o=>`${o.operation.id}@${o.operation.version}`);assert.deepEqual(keys,[...keys].sort((a,b)=>a.localeCompare(b)));
 for(const row of g.measurement.operations){assert.deepEqual(Object.keys(row),['operation','family','descriptorSha256','handlerSourceSha256']);assert.match(row.handlerSourceSha256,/^[a-f0-9]{64}$/u);assert.match(row.descriptorSha256,/^[a-f0-9]{64}$/u);}
 const issuer=createGeneralReadInstallationIssuer({catalogJson:JSON.stringify(catalog),now:Date.now,enabled:true,measurement:g.measurement,measurementSha256:g.measurementSha256});
 assert.equal(issuer.enabled,true);assert.match(issuer.installationId,/^[a-f0-9-]{36}$/u);
 assert.throws(()=>createGeneralReadInstallationIssuer({catalogJson:JSON.stringify(catalog),now:Date.now,enabled:true,measurement:g.measurement,measurementSha256:'0'.repeat(64)}),/GENERAL_READ_INSTALLATION_REFUSED/u);
 // Still one JSON line, and the field is additive: every pre-existing receipt key keeps its value.
 assert.equal(JSON.stringify(r).includes('\n'),false);
 for(const key of ['schema','platform','inputs','versions','executable','launchTemplate','launchTemplateRunInvariant','sdkOptions','runner','skills','gates','module','scope'])assert.ok(Object.hasOwn(r,key),key);
});

test('explicit active P2 operations measure an exact canonical subset while preserving the full desired inventory',async()=>{
 const rows=installationReadOperations(),activeReadOperations=[rows.at(-1).operation,rows[0].operation];
 const full=await generalReadInstallation({root}),active=await generalReadInstallation({root,activeReadOperations});
 const direct=await measureGeneralReadInstallation({catalogJson:JSON.stringify(catalog),operations:[rows[0],rows.at(-1)]});
 assert.equal(full.measurement.operations.length,rows.length);assert.equal(active.measurement.operations.length,2);
 assert.deepEqual(active.measurement.operations.map(row=>row.operation),[rows[0].operation,rows.at(-1).operation].sort((a,b)=>`${a.id}@${a.version}`.localeCompare(`${b.id}@${b.version}`)));
 assert.equal(active.measurementSha256,direct.measurementSha256);assert.notEqual(active.measurementSha256,full.measurementSha256);
 assert.equal((await generalReadInstallation({root,activeReadOperations:activeReadOperations.toReversed()})).measurementSha256,active.measurementSha256);
 for(const rejected of [[],[rows[0].operation,rows[0].operation],[{...rows[0].operation,version:'9.9.9'}],[{id:'not_an_installable_read',version:'0.2.0'}],[{...rows[0].operation,family:rows[0].family}]])
  await assert.rejects(generalReadInstallation({root,activeReadOperations:rejected}),/MEASUREMENT_REFUSED/u);
});

test('a measured general-read profile requires the reviewed exact active operation list',async()=>{
 const [first,second]=installationReadOperations().slice(0,2).map(row=>row.operation);
 await assert.rejects(measureFirstChatLaunch({...inputs,capabilityProfile:{generalReads:true,activeReadOperations:[first]}},{root}),/active read operations required/u);
 await assert.rejects(measureFirstChatLaunch({...inputs,capabilityProfile:{generalReads:true,activeReadOperations:[first]},activeReadOperations:[second]},{root}),/active read operations differ/u);
 const malformed=run([fileURLToPath(module),'--active-read-operations','not=base64']);assert.equal(malformed.status,2);assert.equal(malformed.stdout,'');
});

test('an explicit active measurement pins its selected rows and retains the complete inventory separately',async()=>{
 const activeReadOperations=[installationReadOperations()[0].operation],r=await measureFirstChatLaunch({...inputs,activeReadOperations},{root});
 assert.equal(r.inputs.activeReadOperationsSha256,canonicalSha256(activeReadOperations));
 assert.deepEqual(r.generalReadInstallation.measurement.operations.map(row=>row.operation),activeReadOperations);
 assert.equal(r.generalReadInventory.measurement.operations.length,installationReadOperations().length);
 assert.equal(r.generalReadInventory.measurementSha256,(await generalReadInstallation({root})).measurementSha256);
 assert.notEqual(r.generalReadInventory.measurementSha256,r.generalReadInstallation.measurementSha256);
 const legacy=await measured();assert.equal(Object.hasOwn(legacy.inputs,'activeReadOperationsSha256'),false);assert.equal(Object.hasOwn(legacy,'generalReadInventory'),false);
});
