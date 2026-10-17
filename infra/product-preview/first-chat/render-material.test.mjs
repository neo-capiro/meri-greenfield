/** Focused render test on THROWAWAY material only: pki.py writes a fresh PKI into a temp directory, database passwords and the
 * Core identity credential are synthetic, and every output goes to the OS temp directory. Run with
 * MERI_REVIEW_SOURCE_ROOT=<worktree root> (the shared fixture harness requires it) and Python 3 with `cryptography`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderMaterial,readPrivateDirectory,writeRendered,main,withPosixPaths,SOURCE_ROOT,ROLES,RUNTIME_USERS,PATHS} from './render-material.mjs';
import {productControlFixture} from '../../../apps/proxy/product/test/control-fixture.mjs';
import {validateConfiguration} from '../../../apps/runtime/config.mjs';
import {productWorkerTrustsPinnedServerCa} from '../../../apps/runtime/cli.mjs';
import {compilePreparedCandidateConfiguration} from '../../../apps/runtime/prepared-candidate-config.mjs';
import {parseTemporalIssuerRuntimeConfiguration,startTemporalIssuerRuntime} from '../../../apps/runtime/temporal-issuer-cli.mjs';
import {compileProductMaterialPlan} from '../../../apps/runtime/material-init-plan.mjs';
import {validateStaticProductDelivery} from '../../../apps/runtime/material-init.mjs';
import {assertFirstRunGrantBindings} from '../../../apps/runtime/prepared-candidate.mjs';
import {validateProductOwnerConfiguration} from '../../../apps/proxy/product/owner-entrypoint.mjs';
import {parseProductProxyStartupConfiguration} from '../../../apps/proxy/product/startup-config.mjs';

const here=fileURLToPath(new URL('.',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
const python=process.env.MERI_TEST_PYTHON??'python';
const TD=name=>`arn:aws:ecs:us-east-1:967807252336:task-definition/meri-product-preview-${name}:1`;
const SVC=name=>`arn:aws:ecs:us-east-1:967807252336:service/capiro-dev/meri-product-preview-${name}`;
const FAKE_PASSWORDS={control:'synthetic-control:p@ss/word?#',modelOwner:'synthetic-owner-pass',issuer:'synthetic-issuer-pass'};
const IDENTITY='synthetic-core-identity-bearer-not-real';

let work,pkiDir,inputs;
async function setup(){
 if(inputs)return inputs;
 work=await mkdtemp(join(tmpdir(),'meri-render-test-'));pkiDir=join(work,'pki');
 const generated=spawnSync(python,['-I',join(here,'pki.py'),pkiDir,'--days','30'],{encoding:'utf8',timeout:120000});
 assert.equal(generated.status,0,'throwaway pki.py run');
 await writeFile(join(pkiDir,'db-logins.json'),JSON.stringify(FAKE_PASSWORDS));
 await writeFile(join(work,'identity'),IDENTITY);
 const pins=JSON.parse(await readFile(join(pkiDir,'pins.json'),'utf8')).certificates;
 const deployment=JSON.parse(await readFile(join(here,'deployment-inputs.json'),'utf8'));
 deployment.images.nodeRuntime='967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:'+'7'.repeat(64);
 deployment.pinsDer=Object.fromEntries(Object.entries(pins).map(([k,v])=>[k,v.der]));deployment.pinsPem=Object.fromEntries(Object.entries(pins).map(([k,v])=>[k,v.pem]));
 const core={coreOrigin:'https://core.synthetic.invalid',frontendOrigin:'https://frontend.synthetic.invalid',tenantId:'synthetic-tenant',actorId:'synthetic-actor',
  clientId:'11111111-1111-4111-8111-000000000005',identityCredentialPath:join(work,'identity')};
 const seed=productControlFixture().seed.allocation;
 const budgets={maxTurns:20,maxToolCalls:20,maxRecoveryAttempts:0,maxRuntimeSeconds:3600,maxCostMicroUSD:2000000,maxOutputBytes:1048576};
 const runtime={schemaVersion:1,versions:{sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'},
  preparationIntent:{configParentDirectory:'/tmp/sdk-config',secureStorageDirectory:'/tmp/sdk-secure',launchTemplate:{command:'/usr/local/bin/node',args:['/app/synthetic-cli.js'],env:{}},
   executableSha256:'c'.repeat(64),sdkOptionsSha256:'d'.repeat(64)},
  allocation:{manifest:{...structuredClone(seed.manifest),budgets},catalogSha256:seed.catalogSha256,scheduleRevision:'e'.repeat(64),operations:seed.schedule.operations},
  runtime:{maxTurns:20,maxOutputBytes:1048576},qualification:{attempt:1,policyRevision:'f'.repeat(64)}};
 const subnets=deployment.privateSubnetIds;
 const stage3={schemaVersion:1,
  taskDefinitions:{control:TD('control'),'temporal-worker':TD('temporal-worker'),'temporal-issuer':TD('issuer'),'model-owner':TD('owner'),'model-proxy':TD('proxy'),runner:TD('runner')},
  services:{control:SVC('control'),'temporal-worker':SVC('temporal-worker'),'temporal-issuer':SVC('issuer'),'model-owner':SVC('owner'),'model-proxy':SVC('proxy')},
  network:{control:{subnets:[...subnets],securityGroups:['sg-05a350c100574b21f','sg-0c3da023e9e8fb292','sg-0d5b5286baf28242e']},
   'temporal-worker':{subnets:[...subnets],securityGroups:['sg-00111cd0e475badfa','sg-0c3da023e9e8fb292']},
   'model-owner':{subnets:[...subnets],securityGroups:['sg-05f76fcb9a014a73e','sg-0d5b5286baf28242e']},
   'model-proxy':{subnets:[...subnets],securityGroups:['sg-02c3cc26b435e2516']},
   runner:{subnet:subnets[0],securityGroups:['sg-098fc4f2ac89aa943']}}};
 inputs={deployment,core,runtime,stage3};return inputs;
}
async function render(change=x=>x,options={}){
 const i=structuredClone(await setup());change(i);
 return renderMaterial({...i,private:await readPrivateDirectory(pkiDir),identityCredential:Buffer.from(IDENTITY),...options});
}
test.after(async()=>{if(work)await rm(work,{recursive:true,force:true});});

test('all five roles render from throwaway PKI and pass every repository validator and material plan',async t=>{
 const {roles,summary}=await render();
 t.diagnostic('fileCount/bundleBytes/expectedBytes '+JSON.stringify(Object.fromEntries(ROLES.map(r=>[r,[summary.roles[r].fileCount,summary.roles[r].bundleBytes,summary.roles[r].expectedBytes]]))));
 const parsed=role=>JSON.parse(roles[role].configBytes.toString('utf8'));
 // Linux material: validators see POSIX node:path semantics (identity on Linux; a synchronous rebinding on a Windows host).
 const control=parsed('control');
 withPosixPaths(()=>{
 for(const role of ['control','temporal-worker'])assert.ok(validateConfiguration(parsed(role),role));
 compilePreparedCandidateConfiguration(control.nativeCandidate,control.versions);
 assert.equal(productWorkerTrustsPinnedServerCa(parsed('temporal-worker'),{NODE_EXTRA_CA_CERTS:PATHS.issuerCa}),true);
 parseTemporalIssuerRuntimeConfiguration(parsed('temporal-issuer'));
 assert.equal(validateProductOwnerConfiguration(parsed('model-owner')).enabled,true);
 parseProductProxyStartupConfiguration(parsed('model-proxy'));
 for(const role of ROLES){
  const plan=compileProductMaterialPlan({role,configuration:parsed(role),runtimeUser:RUNTIME_USERS[role],...(role==='model-owner'?{controlConfiguration:control}:{})});
  assert.deepEqual(plan.requiredFiles.map(f=>f.path).sort(),Object.keys(roles[role].expected.sha256ByPath).sort(),role);
  const receipt=validateStaticProductDelivery({expected:roles[role].expected,bundle:roles[role].bundle});
  assert.equal(receipt.fileCount,roles[role].bundle.files.length);assert.equal(receipt.role,role);
  assert.equal(roles[role].expected.sha256ByPath[roles[role].configPath],sha(roles[role].configBytes));
  // A changed byte anywhere is refused by the real receiver.
  const tampered=structuredClone(roles[role].bundle);tampered.files[0].base64=Buffer.from('tampered').toString('base64');
  assert.throws(()=>validateStaticProductDelivery({expected:roles[role].expected,bundle:tampered}),/STATIC_INIT_/u);
 }
 });
 // Runtime grant rule (prepared-candidate.mjs) on the delivered capability files.
 const file=path=>Buffer.from(roles.control.bundle.files.find(f=>f.path===path).base64,'base64').toString('utf8');
 assertFirstRunGrantBindings(control.nativeCandidate.grantIntents,control.nativeCandidate.grantId,{control:file(PATHS.controlCapability),task:file(PATHS.taskCapability),proxy:file(PATHS.proxyCapability)});
 // Owner pins the exact control.json bytes and identity file; the owner database file is the owner login, control's is control's.
 const owner=parsed('model-owner'),ownerFile=path=>Buffer.from(roles['model-owner'].bundle.files.find(f=>f.path===path).base64,'base64');
 assert.equal(owner.controlConfigurationSha256,roles.control.configSha256);assert.ok(ownerFile(PATHS.control).equals(roles.control.configBytes));
 assert.equal(owner.nativeCredentialFileSha256,sha(IDENTITY));
 assert.match(ownerFile(PATHS.database).toString(),/^postgresql:\/\/meri_model_budget_owner:/u);assert.match(file(PATHS.database),/^postgresql:\/\/meri_control_runtime:synthetic-control%3Ap%40ss%2Fword%3F%23@/u);
 // Topology pins.
 assert.equal(control.temporal.issuerBootstrap.configuration.serverCaSha256,summary.pinsDer['server-ca']);
 assert.equal(control.temporal.issuerBootstrap.configuration.clientCaSha256,summary.pinsDer['issuer-client-ca']);
 assert.equal(roles.control.expected.sha256ByPath[PATHS.controlCa],summary.runnerPoststart.MERI_POSTSTART_CA_SHA256);
 assert.equal(roles['temporal-worker'].expected.sha256ByPath[PATHS.issuerCa],summary.runnerPoststart.MERI_POSTSTART_CA_SHA256);
 assert.equal(control.nativeCandidate.preparationIntent.launchTemplate.env.NODE_EXTRA_CA_CERTS,'/run/meri/poststart/bootstrap/control-ca.pem');
 assert.equal(summary.taskDefinitionConfigPins.MERI_PRODUCT_OWNER_CONFIG_SHA256,roles['model-owner'].configSha256);
 assert.equal(summary.roles['temporal-issuer'].taskDefinitionArn,TD('issuer'));
 const authority=parsed('temporal-issuer').issuer.taskAuthority;
 assert.equal(Object.hasOwn(authority,'securityGroupIds'),false);assert.deepEqual(authority.privateSubnetIds,inputs.deployment.privateSubnetIds);
 assert.deepEqual(authority.roles.control.securityGroupIds,['sg-05a350c100574b21f','sg-0c3da023e9e8fb292','sg-0d5b5286baf28242e']);
 assert.deepEqual(authority.roles['temporal-worker'].securityGroupIds,['sg-00111cd0e475badfa','sg-0c3da023e9e8fb292']);
 assert.equal(authority.roles['temporal-worker'].taskRoleArn,null);assert.equal(authority.roles['temporal-worker'].containerName,'temporal-worker');
 assert.deepEqual(control.nativeCandidate.taskRequest.networkConfiguration.awsvpcConfiguration,{subnets:[inputs.deployment.privateSubnetIds[0]],securityGroups:['sg-098fc4f2ac89aa943'],assignPublicIp:'DISABLED'});
 // The summary carries no secret: no password, capability token, identity credential or private key.
 const text=JSON.stringify(summary);
 for(const secret of [...Object.values(FAKE_PASSWORDS),IDENTITY,file(PATHS.taskCapability),file(PATHS.controlCapability),file(PATHS.proxyCapability),'PRIVATE KEY'])assert.equal(text.includes(secret),false);
 for(const role of ROLES)assert.equal(JSON.stringify(roles[role].expected).includes('PRIVATE KEY'),false);
});

test('temporal-issuer runtime admits the delivered database file and exact config bytes without any connection',async()=>{
 const {roles}=await render(),issuer=roles['temporal-issuer'],files=new Map(issuer.bundle.files.map(f=>[f.path,Buffer.from(f.base64,'base64')]));
 const pools=[];
 const runtime=await startTemporalIssuerRuntime({configurationBytes:issuer.configBytes,configurationSha256:issuer.configSha256,environment:{MERI_TEMPORAL_ISSUER_REQUIRED:'1'},testOwners:{
  readMaterial:async path=>Buffer.from(files.get(path)),
  createPool:options=>{pools.push(options);return {async connect(){throw Error('no connection in tests');},async end(){}};},
  createEntrypoint:()=>{let up=false;return {async start(){up=true;},available:()=>up,async close(){up=false;return {unsettledOperations:0};}};}}});
 assert.equal(runtime.available(),true);await runtime.close();
 assert.equal(pools.length,1);assert.match(pools[0].connectionString,/^postgresql:\/\/meri_temporal_issuer_service:[^@]+@capiro-dev-data-.*:5432\/capiro\?sslmode=verify-full$/u);
});

test('the actual cli.mjs product gates admit control and worker (startup then fails off-Linux, exit 3, not configuration exit 2)',async()=>{
 const {roles}=await render(),dir=await mkdtemp(join(work,'cli-'));
 // On a Windows host the child binds node:path normalize to POSIX (the one host-dependent call on these Linux paths, preparation-intent.mjs).
 const windows=process.platform==='win32',shim='data:text/javascript,'+encodeURIComponent('import p from "node:path";import {syncBuiltinESMExports} from "node:module";for(const [k,v] of Object.entries(p.posix))if(typeof v==="function")if(k==="normalize")p[k]=v;syncBuiltinESMExports();');
 const run=(role,file,env)=>spawnSync(process.execPath,[...(windows?['--import',shim]:[]),join(SOURCE_ROOT,'apps/runtime/cli.mjs'),role,'--config',file],{encoding:'utf8',timeout:60000,cwd:SOURCE_ROOT,
  env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,MERI_PRODUCT_PREVIEW_REQUIRED:'1',...env}});
 for(const [role,name] of [['control','control.json'],['temporal-worker','worker.json']]){
  const file=join(dir,name);await writeFile(file,roles[role].configBytes);
  const r=run(role,file,role==='temporal-worker'?{NODE_EXTRA_CA_CERTS:PATHS.issuerCa}:{});
  assert.equal(r.stderr.includes('RUNTIME_CONFIGURATION'),false,`${role} gate: ${r.stderr}`);assert.equal(r.status,3,`${role}: ${r.stderr}`);
 }
 // Negative: the worker without the pinned server CA trust is refused by the gate itself.
 const refused=run('temporal-worker',join(dir,'worker.json'),{});assert.equal(refused.status,2);assert.match(refused.stderr,/RUNTIME_CONFIGURATION/u);
});

test('Python parse_product_proxy_startup accepts the exact proxy.json bytes and pin',async()=>{
 const {roles}=await render(),file=join(work,'proxy.json');await writeFile(file,roles['model-proxy'].configBytes);
 const script='import sys\nfrom apps.proxy.product.startup_config import parse_product_proxy_startup\nraw=open(sys.argv[1],"rb").read()\nparse_product_proxy_startup(raw,sys.argv[2])\nprint("PROXY_STARTUP_ACCEPTED")\n';
 const ok=spawnSync(python,['-c',script,file,roles['model-proxy'].configSha256],{cwd:SOURCE_ROOT,encoding:'utf8',timeout:60000});
 assert.equal(ok.status,0,ok.stderr);assert.match(ok.stdout,/PROXY_STARTUP_ACCEPTED/u);
 const bad=spawnSync(python,['-c',script,file,'0'.repeat(64)],{cwd:SOURCE_ROOT,encoding:'utf8',timeout:60000});assert.notEqual(bad.status,0);
});

test('fail closed: PENDING values, foreign subnet, mismatched pins, validity beyond certificates',async()=>{
 await assert.rejects(render(i=>{i.deployment.images.nodeRuntime='PENDING_N4 (image)';}),{code:'RENDER_PENDING_VALUE'});
 await assert.rejects(render(i=>{i.core.tenantId='PENDING_CORE';}),{code:'RENDER_PENDING_VALUE'});
 await assert.rejects(render(i=>{i.runtime.preparationIntent.executableSha256='PENDING_IMAGE';}),{code:'RENDER_PENDING_VALUE'});
 await assert.rejects(render(i=>{i.stage3.network.runner.subnet='subnet-0123456789abcdef0';}),{code:'RENDER_INPUT_REFUSED'});
 await assert.rejects(render(i=>{i.deployment.pinsDer['server-ca']='0'.repeat(64);}),{code:'RENDER_PRIVATE_REFUSED'});
 await assert.rejects(render(i=>{i.stage3.taskDefinitions.control=i.stage3.taskDefinitions.control.replace(/:1$/u,'');}),{code:'RENDER_INPUT_REFUSED'});
 await assert.rejects(render(x=>x,{validityDays:31}),{code:'RENDER_VALIDITY_REFUSED'});
 await assert.rejects(render(i=>{i.runtime.preparationIntent.runnerSha256='0'.repeat(64);}),{code:'RENDER_INPUT_REFUSED'});
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
