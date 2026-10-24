/** Focused render test on THROWAWAY material only: pki.py writes a fresh PKI into a temp directory, database passwords and the
 * Core identity credential are synthetic, and every output goes to the OS temp directory. Run with
 * MERI_REVIEW_SOURCE_ROOT=<worktree root> (the shared fixture harness requires it) and Python 3 with `cryptography`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,X509Certificate} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {writeRendered,main,withPosixPaths,parseDeploymentInputs,SOURCE_ROOT,ROLES,RUNTIME_USERS,PATHS} from './render-material.mjs';
import {createRenderFixture,TD,FAKE_PASSWORDS,IDENTITY,python} from './render-material.fixture.mjs';
import {validateConfiguration} from '../../../apps/runtime/config.mjs';
import {productWorkerTrustsPinnedServerCa} from '../../../apps/runtime/cli.mjs';
import {CONTROL_NODE_CA_FILE,productControlTrustsCompositeCa} from '../../../apps/runtime/control-ca-bundle.mjs';
import {compileAgentCoreConfiguration} from '../../../apps/runtime/agentcore-configuration.mjs';
import {compileProductMaterialPlan} from '../../../apps/runtime/material-init-plan.mjs';
import {validateStaticProductDelivery} from '../../../apps/runtime/material-init.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const fixture=createRenderFixture();
let work,pkiDir,inputs;
async function setup(){inputs=await fixture.setup();work=fixture.work;pkiDir=fixture.pkiDir;return inputs;}
async function render(change,options){await setup();return fixture.render(change,options);}
test.after(()=>fixture.cleanup());

test('the current input example remains pending and PKI produces only retained control and Temporal material',async()=>{
 const example=JSON.parse(await readFile(new URL('./deployment-inputs.json',import.meta.url),'utf8'));
 assert.throws(()=>parseDeploymentInputs(example),{code:'RENDER_PENDING_VALUE'});
 assert.deepEqual(example.agentcore,{runtimeArn:'PENDING_QUALIFIED_AGENTCORE_RUNTIME_ARN',runtimeVersion:'PENDING_QUALIFIED_AGENTCORE_RUNTIME_VERSION',qualifier:'preview'});
 assert.deepEqual(Object.keys(example.origins).sort(),['controlPublicOrigin','temporalAddress']);
 for(const key of ['core','checkpoint'])assert.equal(Object.hasOwn(example,key),false);
 assert.ok(Object.keys(example.foundation).every(key=>!/^(Runner|Owner|Proxy|Issuer)/u.test(key)));
 await setup();
 const names=await readdir(pkiDir),pins=JSON.parse(await readFile(join(pkiDir,'pins.json'),'utf8')).certificates;
 assert.ok(names.every(name=>!name.startsWith('runner-')));
 assert.equal(Object.hasOwn(pins,'runner-ca'),false);
 for(const stem of ['server-ca','control-private','temporal-frontend-ca','temporal-frontend','temporal-client-ca','temporal-client-control','temporal-client-worker','temporal-client-schedule','temporal-internode-ca','temporal-internode']){
  assert.ok(names.includes(`${stem}.pem`),stem);assert.ok(names.includes(`${stem}.key.pem`),stem);assert.ok(pins[stem],stem);
 }
 const clientCa=new X509Certificate(await readFile(join(pkiDir,'temporal-client-ca.pem')));
 for(const role of ['control','worker','schedule']){
  const cert=new X509Certificate(await readFile(join(pkiDir,`temporal-client-${role}.pem`)));
  assert.equal(cert.subject,`CN=meri-temporal-${role}`);assert.equal(cert.ca,false);
  assert.equal(cert.checkIssued(clientCa),true);assert.equal(cert.verify(clientCa.publicKey),true);
  assert.deepEqual(cert.keyUsage,['1.3.6.1.5.5.7.3.2']);
 }
 assert.equal(names.some(name=>name.startsWith('issuer-')),false);
 const again=spawnSync(python,['-I',join(SOURCE_ROOT,'infra/product-preview/first-chat/pki.py'),pkiDir],{encoding:'utf8',timeout:120000});
 assert.notEqual(again.status,0,'existing private directory must never be overwritten');
});

test('both application roles render from throwaway PKI and pass every repository validator and material plan',async t=>{
 const {roles,summary}=await render();
 t.diagnostic('fileCount/bundleBytes/expectedBytes '+JSON.stringify(Object.fromEntries(ROLES.map(r=>[r,[summary.roles[r].fileCount,summary.roles[r].bundleBytes,summary.roles[r].expectedBytes]]))));
 const parsed=role=>JSON.parse(roles[role].configBytes.toString('utf8'));
 // Linux material: validators see POSIX node:path semantics (identity on Linux; a synchronous rebinding on a Windows host).
 const control=parsed('control');
 withPosixPaths(()=>{
 for(const role of ['control','temporal-worker'])assert.ok(validateConfiguration(parsed(role),role));
 compileAgentCoreConfiguration(control.agentcore);
 assert.equal(productWorkerTrustsPinnedServerCa(parsed('temporal-worker'),{NODE_EXTRA_CA_CERTS:PATHS.serverCa}),true);
 assert.equal(productControlTrustsCompositeCa(summary.control),true);
 assert.deepEqual(summary.wiring.control.environment.find(e=>e.name==='NODE_EXTRA_CA_CERTS'),{name:'NODE_EXTRA_CA_CERTS',value:CONTROL_NODE_CA_FILE});
 assert.deepEqual(summary.wiring.control.init.command,['write','--control-node-ca']);
 for(const role of ROLES){
  const plan=compileProductMaterialPlan({role,configuration:parsed(role),runtimeUser:RUNTIME_USERS[role]});
  assert.deepEqual(plan.requiredFiles.map(f=>f.path).sort(),Object.keys(roles[role].expected.sha256ByPath).sort(),role);
  const receipt=validateStaticProductDelivery({expected:roles[role].expected,bundle:roles[role].bundle});
  assert.equal(receipt.fileCount,roles[role].bundle.files.length);assert.equal(receipt.role,role);
  assert.equal(roles[role].expected.sha256ByPath[roles[role].configPath],sha(roles[role].configBytes));
  // A changed byte anywhere is refused by the real receiver.
  const tampered=structuredClone(roles[role].bundle);tampered.files[0].base64=Buffer.from('tampered').toString('base64');
  assert.throws(()=>validateStaticProductDelivery({expected:roles[role].expected,bundle:tampered}),/STATIC_INIT_/u);
 }
 });
 // Delivered control capability stays private; user authority is not rendered.
 const file=path=>Buffer.from(roles.control.bundle.files.find(f=>f.path===path).base64,'base64').toString('utf8');
 assert.ok(file(PATHS.controlCapability).length>=32);
 assert.match(file(PATHS.database),/^postgresql:\/\/meri_control_runtime:synthetic-control%3Ap%40ss%2Fword%3F%23@/u);
 assert.deepEqual(control.agentcore.identity,{origin:inputs.core.coreOrigin});
 for(const key of ['nativeCandidate','taskRouter','commandContext'])assert.equal(Object.hasOwn(control,key),false);
 for(const key of ['identity','taskCapability','runnerCa','runnerCaKey','controlCa','readsInstallationMeasurement'])assert.equal(Object.hasOwn(PATHS,key),false);
 assert.deepEqual(Object.keys(roles),['control','temporal-worker']);
 // Native TLS only; the same server CA anchors the private control channel.
 assert.deepEqual(Object.keys(control.temporal).sort(),['address','namespace','taskQueue','tls']);
 assert.equal(control.native.serverCaSha256,summary.pinsDer['server-ca']);
 assert.equal(control.native.serverCaFile,PATHS.serverCa);
 assert.equal(roles.control.expected.sha256ByPath[PATHS.serverCa],roles['temporal-worker'].expected.sha256ByPath[PATHS.serverCa]);
 assert.equal(Object.hasOwn(summary,'runnerPoststart'),false);
 assert.equal(Object.hasOwn(summary.taskDefinitionConfigPins,'MERI_PRODUCT_OWNER_CONFIG_SHA256'),false);
 assert.equal(Object.hasOwn(summary.roles,'temporal-issuer'),false);
 assert.deepEqual(summary.agentcore,{...inputs.deployment.agentcore,policyRevision:control.agentcore.policyRevision,runWindowMs:control.agentcore.runWindowMs});
 // The summary carries no secret: no password, capability token, identity credential or private key.
 const text=JSON.stringify(summary);
 for(const secret of [...Object.values(FAKE_PASSWORDS),IDENTITY,file(PATHS.controlCapability),'PRIVATE KEY'])assert.equal(text.includes(secret),false);
 for(const role of ROLES)assert.equal(JSON.stringify(roles[role].expected).includes('PRIVATE KEY'),false);
});

test('the actual cli.mjs product gates admit control and worker (startup then fails off-Linux, exit 3, not configuration exit 2)',async()=>{
 const {roles}=await render(),dir=await mkdtemp(join(work,'cli-'));
 // On a Windows host the child binds node:path normalize to POSIX (the one host-dependent call on these Linux paths, preparation-intent.mjs).
 const windows=process.platform==='win32',shim='data:text/javascript,'+encodeURIComponent('import p from "node:path";import {syncBuiltinESMExports} from "node:module";for(const [k,v] of Object.entries(p.posix))if(typeof v==="function")if(k==="normalize")p[k]=v;syncBuiltinESMExports();');
 const run=(role,file,env)=>spawnSync(process.execPath,[...(windows?['--import',shim]:[]),join(SOURCE_ROOT,'apps/runtime/cli.mjs'),role,'--config',file],{encoding:'utf8',timeout:60000,cwd:SOURCE_ROOT,
  env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,MERI_PRODUCT_PREVIEW_REQUIRED:'1',...env}});
 for(const [role,name] of [['control','control.json'],['temporal-worker','worker.json']]){
  const file=join(dir,name);await writeFile(file,roles[role].configBytes);
  const r=run(role,file,role==='temporal-worker'?{NODE_EXTRA_CA_CERTS:PATHS.serverCa}:{});
  if(role==='control'){assert.equal(r.status,2,'control refuses without the init-created composite');assert.match(r.stderr,/RUNTIME_CONFIGURATION/u);}
  else {assert.equal(r.stderr.includes('RUNTIME_CONFIGURATION'),false,`${role} gate: ${r.stderr}`);assert.equal(r.status,3,`${role}: ${r.stderr}`);}
 }
 // Negative: the worker without the pinned server CA trust is refused by the gate itself.
 const refused=run('temporal-worker',join(dir,'worker.json'),{});assert.equal(refused.status,2);assert.match(refused.stderr,/RUNTIME_CONFIGURATION/u);
});

test('fail closed: PENDING values, foreign subnet, mismatched pins, validity beyond certificates',async()=>{
 await assert.rejects(render(i=>{i.deployment.images.nodeRuntime='PENDING_N4 (image)';}),{code:'RENDER_PENDING_VALUE'});
 await assert.rejects(render(i=>{i.core.coreOrigin='PENDING_CORE';}),{code:'RENDER_PENDING_VALUE'});
 await assert.rejects(render(i=>{i.runtime.versions.skillsDigest='PENDING_IMAGE';}),{code:'RENDER_PENDING_VALUE'});
 await assert.rejects(render(i=>{i.stage3.network.control.subnets=['subnet-0123456789abcdef0'];}),{code:'RENDER_INPUT_REFUSED'});
 await assert.rejects(render(i=>{i.deployment.pinsDer['server-ca']='0'.repeat(64);}),{code:'RENDER_PRIVATE_REFUSED'});
 await assert.rejects(render(i=>{i.stage3.taskDefinitions.control=i.stage3.taskDefinitions.control.replace(/:1$/u,'');}),{code:'RENDER_INPUT_REFUSED'});
 await assert.rejects(render(x=>x,{validityDays:31}),{code:'RENDER_VALIDITY_REFUSED'});
 await assert.rejects(render(i=>{i.runtime.allocation={};}),{code:'RENDER_INPUT_REFUSED'});
 await assert.rejects(render(i=>{i.core.tenantId='retired-deployment-principal';}),{code:'RENDER_INPUT_REFUSED'});
 await assert.rejects(render(i=>{i.deployment.core={tenantId:'retired-deployment-principal'};}),{code:'RENDER_INPUT_REFUSED'});
 await assert.rejects(render(i=>{i.deployment.origins.coreOrigin='https://ignored.invalid';}),{code:'RENDER_INPUT_REFUSED'});
 await assert.rejects(render(i=>{i.deployment.issuer={};}),{code:'RENDER_INPUT_REFUSED'});
 await assert.rejects(render(i=>{i.deployment.temporal.audience='retired';}),{code:'RENDER_INPUT_REFUSED'});
 await assert.rejects(render(i=>{i.deployment.origins.issuerOrigin='https://retired.invalid';}),{code:'RENDER_INPUT_REFUSED'});
 // The renderer preserves source provenance; source checkout verification belongs to runtime-values and shipping.
 await assert.rejects(render(i=>{i.deployment.images.nodeRuntimeSourceCommit='invalid';}),{code:'RENDER_INPUT_REFUSED'});
});

test('CLI writes a new 0700 directory outside the repository and refuses one inside it',async()=>{
 const i=await setup(),files={};
 for(const [name,value] of [['deployment',i.deployment],['core',i.core],['runtime',i.runtime],['stage3',i.stage3]]){files[name]=join(work,`${name}.json`);await writeFile(files[name],JSON.stringify(value));}
 const out=join(work,'rendered'),args=['--deployment-inputs',files.deployment,'--private',pkiDir,'--core',files.core,'--runtime',files.runtime,'--stage3',files.stage3];
 const writes=[];const original=process.stdout.write.bind(process.stdout);process.stdout.write=t=>{writes.push(String(t));return true;};
 let code;try{code=await main([...args,'--out',out]);}finally{process.stdout.write=original;}
 assert.equal(code,0);assert.match(writes.join(''),/MERI_FIRST_CHAT_MATERIAL_RENDERED/u);
 assert.deepEqual((await readdir(out)).sort(),[...ROLES,'summary.json'].sort());
 for(const role of ROLES){
  assert.deepEqual((await readdir(join(out,role))).sort(),['bundle.json','config.json','expected.json']);
  const expected=JSON.parse(await readFile(join(out,role,'expected.json'),'utf8')),bundle=JSON.parse(await readFile(join(out,role,'bundle.json'),'utf8'));
  assert.equal(withPosixPaths(()=>validateStaticProductDelivery({expected,bundle})).role,role);
 }
 await assert.rejects(writeRendered(join(SOURCE_ROOT,'infra','rendered-should-not-exist'),await render()),{code:'RENDER_OUTPUT_REFUSED'});
 await assert.rejects(writeRendered(out,await render()),{code:'RENDER_OUTPUT_REFUSED'});
});

// Schedule deployment is separate; this verifies the retained runtime/material owner can receive its native TLS role.
test('schedule-worker canonical configuration and material retain pinned native TLS without an issuer',async()=>{
 const {roles}=await render(),control=JSON.parse(roles.control.configBytes),worker=JSON.parse(roles['temporal-worker'].configBytes);
 const schedule={...worker,sourceEnabled:false,versions:control.versions,database:control.database,
  http:{...worker.http,port:8083},temporal:{...worker.temporal,taskQueue:'meri-schedules'},
  scheduledDispatch:{enabled:true,conversationTaskQueue:worker.temporal.taskQueue,maxConcurrentActivities:1}};
 delete schedule.native.preparedKickoff;
 withPosixPaths(()=>{
  assert.ok(validateConfiguration(schedule,'schedule-worker'));
  const plan=compileProductMaterialPlan({role:'schedule-worker',configuration:schedule,runtimeUser:'1000:1000'});
  assert.deepEqual(plan.requiredFiles.map(f=>f.path).sort(),['/run/meri/schedule-worker.json',PATHS.database,PATHS.controlCapability,PATHS.temporalCa,PATHS.temporalCert,PATHS.temporalKey,PATHS.serverCa].sort());
  assert.equal(plan.requiresTokenRotation,false);assert.equal(plan.dynamicMaterialDirectory,null);
 });
});
