/** Product-family activation with native SDK deployment material. Uses the real
 * material planner and throwaway PKI/secrets; no patched source or launch receipt.
 * Run with MERI_REVIEW_SOURCE_ROOT=<worktree root> and Python cryptography. */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto,{createHash} from 'node:crypto';
import {syncBuiltinESMExports} from 'node:module';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here=fileURLToPath(new URL('.',import.meta.url));
const R=await import('./render-material.mjs');
const {renderMaterial,readPrivateDirectory,readFeatureSecrets,withPosixPaths,parseFeatures,PATHS,ROLES,RUNTIME_USERS,SECRET_ARN,SOURCE_ROOT,main}=R;
const {createRenderFixture,addScheduleBindings,IDENTITY,FAKE_PASSWORDS}=await import('./render-material.fixture.mjs');
const RV=await import('./runtime-values.mjs');
const {validateConfiguration}=await import('../../../apps/runtime/config.mjs');
const {compileProductMaterialPlan}=await import('../../../apps/runtime/material-init-plan.mjs');
const {validateStaticProductDelivery}=await import('../../../apps/runtime/material-init.mjs');
const {PROPOSED_PREVIEW_CAPABILITY_PLATFORM,NO_CAPABILITY_PLATFORM}=await import('../../../apps/runtime/product-ports/capability-policy.mjs');
const {canonicalSha256}=await import('../../../packages/contracts/validate.mjs');

const NOW=Date.now();
const sha=b=>createHash('sha256').update(b).digest('hex');
const fixture=createRenderFixture();test.after(()=>fixture.cleanup());
const ARN={service:'arn:aws:secretsmanager:us-east-1:967807252336:secret:meri/preview/core/internal_service_secret-Ab12Cd',
 readMode:'arn:aws:secretsmanager:us-east-1:967807252336:secret:meri/preview/core/read_mode_service_secret-Zz98Yx'};
const SECRET={service:'synthetic-core-internal-service-secret-0001',readMode:'synthetic-core-read-mode-secret-0002'};
const VERSION='0f1e2d3c-4b5a-4968-8776-655443322110';
const ARTIFACTS={enabled:true,region:'us-east-1',bucket:'meri-preview-artifacts-967807252336-us-east-1',prefix:'product-preview/artifacts',expectedBucketOwner:'967807252336',
 kmsKeyId:'arn:aws:kms:us-east-1:967807252336:key/11111111-2222-4333-8444-555555555555'};
const APPROVED_READS={schemaVersion:'meri-native-general-reads/1',enabled:true,operations:[{id:'read_bill_text',version:'0.2.0'}],maxExecuteMs:20000,maxRequestBytes:65536,maxResponseBytes:1048576};
const READS={enabled:true,serviceSecretArn:ARN.service,readModeServiceSecretArn:ARN.readMode,defaultCongress:119,approvedReads:APPROVED_READS};
const featureSecrets=()=>({'reads.serviceSecret':{secretArn:ARN.service,versionId:VERSION,bytes:Buffer.from(SECRET.service)},
 'reads.readModeServiceSecret':{secretArn:ARN.readMode,versionId:VERSION,bytes:Buffer.from(SECRET.readMode)}});

test('Objective activation renders the control start owner and matching Temporal activities',async()=>{
 await baseline();
 const objectiveGeneration={runs:{enabled:true},start:{enabled:true,windowMs:900000}};
 const rendered=await render(withFeatures({sourceEnabled:true,reads:READS,objectiveGeneration}),{featureSecrets:featureSecrets()});
 const control=assertOnly(rendered,['sourceEnabled','reads','objectiveGeneration'],{worker:{sourceEnabled:true,objectiveGeneration:{runs:{enabled:true}}},extraControlFiles:[PATHS.readsServiceSecret,PATHS.readsReadModeServiceSecret]});
 assert.deepEqual(control.objectiveGeneration,objectiveGeneration);
 withPosixPaths(()=>validateConfiguration(config(rendered,'temporal-worker'),'temporal-worker'));
 assert.throws(()=>parseFeatures({objectiveGeneration}),/needs features.reads enabled/u);
 assert.throws(()=>parseFeatures({objectiveGeneration:{start:{enabled:true,windowMs:900000}}}),/RENDER_INPUT_REFUSED/u);
});

test('artifact activation preserves the configured image executor through material rendering',async()=>{
 await baseline();
 const executor={pythonExecutable:'/usr/bin/python3.13',nodeExecutable:'/usr/local/bin/node',pptxModulePath:'/opt/meri/apps/artifacts/generation/node_modules/pptxgenjs',tempRoot:'/tmp',timeoutMs:30000};
 const rendered=await render(withFeatures({sourceEnabled:true,reads:READS,artifacts:{...ARTIFACTS,authority:{enabled:true},executor}}),{featureSecrets:featureSecrets()});
 const control=assertOnly(rendered,['sourceEnabled','reads','artifacts'],{worker:{sourceEnabled:true},extraControlFiles:[PATHS.readsServiceSecret,PATHS.readsReadModeServiceSecret]});
 assert.deepEqual(control.artifacts.executor,executor);
 assert.deepEqual(control.artifacts.authority,{origin:control.agentcore.identity.origin,serviceSecretFile:PATHS.readsServiceSecret});
 assert.throws(()=>parseFeatures({artifacts:{...ARTIFACTS,executor:{...executor,pythonExecutable:'relative/python'}}}),/RENDER_INPUT_REFUSED/u);
 assert.throws(()=>parseFeatures({artifacts:{enabled:false,executor}}),/RENDER_INPUT_REFUSED/u);
});

test('artifact authority rejects a mistyped enabled flag instead of silently disabling it',()=>{
 assert.throws(()=>parseFeatures({artifacts:{...ARTIFACTS,authority:{enabled:'true'}}}),/must be a boolean/u);
});

test('artifact renderer material binds the selected image and explicit PDF intent without claiming native qualification',async()=>{
 await baseline();const executor={pythonExecutable:'/usr/bin/python3.13',nodeExecutable:'/usr/local/bin/node',pptxModulePath:'/opt/meri/apps/artifacts/generation/node_modules/pptxgenjs',tempRoot:'/tmp',timeoutMs:30000};
 const artifacts={...ARTIFACTS,authority:{enabled:true},executor,renderer:{enabled:true},pdfAdmission:true};
 const rendered=await render(withFeatures({sourceEnabled:true,retention:{enabled:true},reads:READS,artifacts}),{featureSecrets:featureSecrets()});
 const control=config(rendered,'control');assert.equal(control.artifacts.renderer.enabled,true);assert.equal(control.artifacts.renderer.imageDigest,control.versions.imageDigest);assert.equal(control.artifacts.pdfAdmission,true);
 assert.equal(Object.hasOwn(control.artifacts.renderer,'sandbox'),false);assert.equal(Object.hasOwn(control.artifacts.renderer,'admission'),false);
 for(const change of [{renderer:{enabled:'true'}},{renderer:{enabled:true,imageDigest:'sha256:'+'a'.repeat(64)}},{renderer:{enabled:false}},{pdfAdmission:'true'}])
  assert.throws(()=>parseFeatures({sourceEnabled:true,retention:{enabled:true},reads:READS,artifacts:{...artifacts,...change}}));
 assert.throws(()=>parseFeatures({sourceEnabled:true,reads:READS,artifacts}),/needs authority, executor and retention/u);
});

test('retention rendering carries the existing explicit Trash purge switch to control only',async()=>{
 await baseline();
 const rendered=await render(withFeatures({sourceEnabled:true,retention:{enabled:true,purge:{enabled:true}}}));
 const control=assertOnly(rendered,['sourceEnabled','retention'],{worker:{sourceEnabled:true}});
 assert.deepEqual(control.retention,{enabled:true,purge:{enabled:true}});
 withPosixPaths(()=>validateConfiguration(control,'control'));
 assert.deepEqual(parseFeatures({retention:{enabled:true,purge:{enabled:false}}}).retention,{enabled:true,purge:{enabled:false}});
 for(const purge of [{enabled:'true'},{enabled:true,bypassRetention:true},{}])
  assert.throws(()=>parseFeatures({retention:{enabled:true,purge}}),/RENDER_INPUT_REFUSED/u);
});

/** Deterministic randomBytes/randomUUID for the duration of one synchronous render (the render's only entropy). */
function seeded(fn){
 const saved={randomBytes:crypto.randomBytes,randomUUID:crypto.randomUUID};let n=0;
 crypto.randomBytes=size=>{n++;return createHash('sha512').update(`bytes:${n}`).digest().subarray(0,size);};
 crypto.randomUUID=()=>{n++;const h=sha(`uuid:${n}`);return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
 syncBuiltinESMExports();
 try{return fn();}finally{Object.assign(crypto,saved);syncBuiltinESMExports();}
}
let pki;
async function inputs(change=x=>x){const i=structuredClone(await fixture.setup());delete i.deployment.features;pki??=await readPrivateDirectory(fixture.pkiDir,{scheduleWorker:true});change(i);return i;}
async function render(change,options={},module=R){
 const i=await inputs(change);
 return seeded(()=>module.renderMaterial({...i,private:pki,nowMs:NOW,sourceRoot:SOURCE_ROOT,...options}));
}
const withFeatures=(features,runtime)=>i=>{
 i.deployment.features=structuredClone(features);
 if(features.reads?.enabled===true&&features.capabilityPlatform===undefined){
  const platform=structuredClone(PROPOSED_PREVIEW_CAPABILITY_PLATFORM),operations=features.reads.approvedReads?.operations??[];
  for(const policy of [platform.maximum,platform.defaults,...Object.values(platform.roleCeilings)]){policy.generalReads=operations.length>0;policy.activeReadOperations=structuredClone(operations);}
  i.deployment.features.capabilityPlatform=platform;
 }
 if(runtime)runtime(i.runtime);
};
const config=(rendered,role)=>JSON.parse(rendered.roles[role].configBytes.toString('utf8'));
const bytesOf=rendered=>Object.fromEntries(ROLES.map(role=>[role,{config:rendered.roles[role].configBytes.toString('base64'),
 bundle:JSON.stringify(rendered.roles[role].bundle),expected:JSON.stringify(rendered.roles[role].expected)}]));
let defaults;
async function baseline(){return defaults??=await render();}

test('absent and empty features render the same two application service roles',async()=>{
 const current=await baseline(),empty=await render(withFeatures({}));
 assert.deepEqual(bytesOf(empty),bytesOf(current));
 assert.deepEqual(empty.summary,current.summary);
 assert.deepEqual(ROLES,['control','temporal-worker']);
 // The comparison is meaningful: the seeded render is stable and the fixture really renders the full material.
 assert.equal(JSON.stringify(bytesOf(await render())),JSON.stringify(bytesOf(current)));
 assert.equal(Object.hasOwn(current.summary,'features'),false);
 assert.deepEqual(config(current,'control').telemetry,{environment:'Preview'});
 const candidate=config(current,'control').agentcore;
 assert.equal(Object.hasOwn(candidate,'model'),false);
 assert.deepEqual(candidate.identity,{origin:'https://core.synthetic.invalid'});
 for(const key of ['grantIntents','grantId','taskRequest','commandContext'])assert.equal(Object.hasOwn(candidate,key),false);
 assert.equal(Object.hasOwn(candidate,'modelCapabilityFile'),false);
 for(const key of ['userPreferences','tenantSettings','intents','routines','retention','artifacts','downloadLinks','capabilityPlatform','reads'])assert.equal(Object.hasOwn(config(current,'control'),key),false);
});

/** Control differs from the default by exactly `keys`; unrelated service material stays identical. */
function assertOnly(rendered,keys,{worker={},extraControlFiles=[]}={}){
 const d=defaults,control=config(rendered,'control'),base=config(d,'control');
 if(control.capabilityPlatform!==undefined&&!keys.includes('capabilityPlatform'))keys=[...keys,'capabilityPlatform'];
 const strip=(c,names)=>Object.fromEntries(Object.entries(c).filter(([k])=>!names.includes(k)));
 // New keys are appended after every first-chat key, in the fixed order; sourceEnabled is the existing key flipped.
 assert.deepEqual(Object.keys(control).sort(),[...Object.keys(base),...keys.filter(k=>k!=='sourceEnabled')].sort());
 assert.equal(control.sourceEnabled,keys.includes('sourceEnabled'));
 assert.deepEqual(strip(control,[...keys,'agentcore','sourceEnabled']),strip(base,['agentcore','sourceEnabled']));
 assert.deepEqual(strip(control.agentcore,['approvedReads']),base.agentcore);
 assert.deepEqual(config(rendered,'temporal-worker'),{...config(d,'temporal-worker'),...worker});
 const paths=r=>Object.keys(r.roles.control.expected.sha256ByPath);
 assert.deepEqual(paths(rendered),[...paths(d),...extraControlFiles]);
 for(const role of (Object.keys(worker).length?[]:['temporal-worker']))assert.deepEqual(rendered.roles[role].expected,d.roles[role].expected);
 assert.deepEqual(Object.keys(rendered.roles['temporal-worker'].expected.sha256ByPath),Object.keys(d.roles['temporal-worker'].expected.sha256ByPath));
 // Every repository validator and plan ran inside the render; re-check the two the features touch, on the exact bytes.
 withPosixPaths(()=>{validateConfiguration(control,'control');
  const plan=compileProductMaterialPlan({role:'control',configuration:control,runtimeUser:RUNTIME_USERS.control});
  assert.deepEqual(plan.requiredFiles.map(f=>f.path).sort(),paths(rendered).sort());
  assert.ok(plan.requiredFiles.every(f=>f.mode==='0600'&&f.path.startsWith('/run/meri/')));
  assert.equal(validateStaticProductDelivery({expected:rendered.roles.control.expected,bundle:rendered.roles.control.bundle}).role,'control');});
 return control;
}

test('each simple family renders exactly its own control key',async()=>{
 await baseline();
 for(const key of ['userPreferences','tenantSettings','intents','routines'])for(const enabled of [true,false]){
  const control=assertOnly(await render(withFeatures({[key]:{enabled}})),[key]);assert.deepEqual(control[key],{enabled});
 }
 assert.deepEqual(assertOnly(await render(withFeatures({retention:{enabled:true}})),['retention']).retention,{enabled:true});
});

test('G1 sourceEnabled renders into control and the temporal worker only (the runner receives it from control)',async()=>{
 await baseline();
 assert.equal(JSON.stringify(bytesOf(await render(withFeatures({sourceEnabled:false})))),JSON.stringify(bytesOf(defaults)));
 const on=await render(withFeatures({sourceEnabled:true}));
 const control=assertOnly(on,['sourceEnabled'],{worker:{sourceEnabled:true}});
 assert.equal(control.sourceEnabled,true);
 withPosixPaths(()=>validateConfiguration(config(on,'temporal-worker'),'temporal-worker'));
});

test('artifacts, retention custody and download links render their keys; the link key is control-only, fresh and never in JSON',async()=>{
 await baseline();
 const plain=assertOnly(await render(withFeatures({artifacts:ARTIFACTS})),['artifacts']);
 assert.deepEqual(plain.artifacts,ARTIFACTS);
 assert.deepEqual(assertOnly(await render(withFeatures({artifacts:{enabled:false}})),['artifacts']).artifacts,{enabled:false});
 const custody=assertOnly(await render(withFeatures({retention:{enabled:true},artifacts:ARTIFACTS})),['retention','artifacts']);
 assert.equal(Object.hasOwn(custody.artifacts,'tenantId'),false);
 const links=await render(withFeatures({retention:{enabled:true},artifacts:ARTIFACTS,downloadLinks:{enabled:true,ttlMs:60000}}));
 const control=assertOnly(links,['retention','artifacts','downloadLinks'],{extraControlFiles:[PATHS.downloadLinkKey]});
 assert.deepEqual(control.downloadLinks,{enabled:true,keyFile:PATHS.downloadLinkKey,ttlMs:60000});
 const key=Buffer.from(links.roles.control.bundle.files.find(f=>f.path===PATHS.downloadLinkKey).base64,'base64');
 assert.ok(key.length>=32);assert.equal(links.roles.control.expected.sha256ByPath[PATHS.downloadLinkKey],sha(key));
 assertNotInJson(links,key.toString('utf8'));
 for(const role of ROLES.filter(role=>role!=='control'))assert.equal(links.roles[role].bundle.files.some(f=>f.path===PATHS.downloadLinkKey),false);
 const again=await fixture.render(withFeatures({retention:{enabled:true},artifacts:ARTIFACTS,downloadLinks:{enabled:true}}));
 assert.notEqual(again.roles.control.expected.sha256ByPath[PATHS.downloadLinkKey],links.roles.control.expected.sha256ByPath[PATHS.downloadLinkKey]);
 assert.deepEqual(links.summary.features.generatedFiles[PATHS.downloadLinkKey]!==undefined,true);
});

/** No rendered JSON (any config, expected.json, the summary) carries `secret`, plain or base64. Bundles are the secret channel. */
function assertNotInJson(rendered,secret){
 const forms=[secret,Buffer.from(secret).toString('base64'),Buffer.from(secret).toString('base64url')];
 const texts=[...ROLES.flatMap(role=>[rendered.roles[role].configBytes.toString('utf8'),JSON.stringify(rendered.roles[role].expected)]),JSON.stringify(rendered.summary)];
 for(const text of texts)for(const form of forms)assert.equal(text.includes(form),false);
}

test('reads: the Core service secrets come from the exact ARNs, travel only in control material (0600, digest-pinned), never in JSON',async()=>{
 await baseline();
 const rendered=await render(withFeatures({sourceEnabled:true,reads:READS}),{featureSecrets:featureSecrets()});
 const control=assertOnly(rendered,['sourceEnabled','reads'],{worker:{sourceEnabled:true},extraControlFiles:[PATHS.readsServiceSecret,PATHS.readsReadModeServiceSecret]});
 assert.deepEqual(control.reads,{enabled:true,serviceSecretFile:PATHS.readsServiceSecret,readModeServiceSecretFile:PATHS.readsReadModeServiceSecret,defaultCongress:119});
 assert.deepEqual(control.agentcore.approvedReads,APPROVED_READS);
 assert.deepEqual({...control.agentcore,approvedReads:undefined},{...config(defaults,'control').agentcore,approvedReads:undefined});
 const files=new Map(rendered.roles.control.bundle.files.map(f=>[f.path,Buffer.from(f.base64,'base64')]));
 assert.equal(files.get(PATHS.readsServiceSecret).toString(),SECRET.service);assert.equal(files.get(PATHS.readsReadModeServiceSecret).toString(),SECRET.readMode);
 assert.equal(rendered.roles.control.expected.sha256ByPath[PATHS.readsServiceSecret],sha(SECRET.service));
 for(const secret of Object.values(SECRET)){assertNotInJson(rendered,secret);
  for(const role of ROLES.filter(r=>r!=='control'))assert.equal(JSON.stringify(rendered.roles[role].bundle).includes(Buffer.from(secret).toString('base64')),false,role);}
 assert.deepEqual(rendered.summary.features.secretFiles[PATHS.readsServiceSecret],{feature:'reads.serviceSecret',secretArn:ARN.service,versionId:VERSION,sha256:sha(SECRET.service)});
 assert.deepEqual(rendered.summary.features.controlKeys,['capabilityPlatform','reads']);
 // A tampered secret byte is refused by the real receiver.
 const tampered=structuredClone(rendered.roles.control.bundle);tampered.files.find(f=>f.path===PATHS.readsServiceSecret).base64=Buffer.from('other-secret').toString('base64');
 assert.throws(()=>withPosixPaths(()=>validateStaticProductDelivery({expected:rendered.roles.control.expected,bundle:tampered})),/STATIC_INIT_/u);
 // Without the optional read-mode secret only the service secret is delivered.
 const one=await render(withFeatures({sourceEnabled:true,reads:{enabled:true,serviceSecretArn:ARN.service}}),{featureSecrets:{'reads.serviceSecret':featureSecrets()['reads.serviceSecret']}});
 assert.deepEqual(config(one,'control').reads,{enabled:true,serviceSecretFile:PATHS.readsServiceSecret});
 assert.equal(Object.hasOwn(config(one,'control').agentcore,'approvedReads'),false);
 assert.deepEqual(assertOnly(await render(withFeatures({reads:{enabled:false}})),['reads']).reads,{enabled:false});
});

test('retired read installation, discovery, delegation and runtime measurement inputs refuse',async()=>{
 await baseline();
 for(const key of ['installation','discovery','delegation'])for(const enabled of [true,false])await assert.rejects(render(withFeatures({sourceEnabled:true,reads:{...READS,[key]:{enabled}}}),{featureSecrets:featureSecrets()}),{code:'RENDER_INPUT_REFUSED'});
 await assert.rejects(render(withFeatures({sourceEnabled:true,reads:READS},runtime=>{runtime.generalReadInstallation={measurement:{},measurementSha256:'0'.repeat(64)};}),{featureSecrets:featureSecrets()}),{code:'RENDER_INPUT_REFUSED'});
});

test('capability platform keeps product capabilities without an SDK launch pin',async()=>{
 await baseline();
 const rendered=await render(withFeatures({capabilityPlatform:PROPOSED_PREVIEW_CAPABILITY_PLATFORM}));
 const control=assertOnly(rendered,['capabilityPlatform']);
 assert.deepEqual(control.capabilityPlatform,structuredClone(PROPOSED_PREVIEW_CAPABILITY_PLATFORM));
 assert.equal(Object.hasOwn(rendered.summary.features,'capabilityProfileSha256'),false);
 assert.equal(Object.hasOwn(control.agentcore,'capabilityProfileSha256'),false);
 // Retired deployment fields fail at the boundary; they cannot restore measured SDK options.
 await assert.rejects(render(withFeatures({capabilityPlatform:PROPOSED_PREVIEW_CAPABILITY_PLATFORM},r=>{r.capabilityProfileSha256='a'.repeat(64);})),{code:'RENDER_INPUT_REFUSED'});
 assert.deepEqual(assertOnly(await render(withFeatures({capabilityPlatform:NO_CAPABILITY_PLATFORM})),['capabilityPlatform']).capabilityPlatform,structuredClone(NO_CAPABILITY_PLATFORM));
});

test('fail closed: unknown, malformed or inconsistent feature inputs and secret files',async()=>{
 const refused=(features,code='RENDER_INPUT_REFUSED',options={},runtime)=>assert.rejects(render(withFeatures(features,runtime),options),{code});
 await refused({search:{enabled:true}});
 await refused({intents:{enabled:'yes'}});await refused({intents:{enabled:true,extra:1}});await refused({intents:true});
 await refused({sourceEnabled:'true'});await refused({retention:{enabled:false}});
 await refused({artifacts:{...ARTIFACTS,region:'us-west-2'}});await refused({artifacts:{...ARTIFACTS,expectedBucketOwner:'111111111111'}});
 await refused({artifacts:{...ARTIFACTS,kmsKeyId:'alias/meri-artifacts'}});await refused({artifacts:{...ARTIFACTS,bucket:'Bad_Bucket'}});
 await refused({artifacts:{...ARTIFACTS,prefix:'trailing/'}});await refused({artifacts:{...ARTIFACTS,tenantId:'synthetic-tenant'}});
 await refused({artifacts:{enabled:false,bucket:ARTIFACTS.bucket}});await refused({artifacts:{enabled:true,bucket:ARTIFACTS.bucket}});
 await refused({downloadLinks:{enabled:true}});await refused({artifacts:ARTIFACTS,downloadLinks:{enabled:true}});
 await refused({retention:{enabled:true},artifacts:ARTIFACTS,downloadLinks:{enabled:true,ttlMs:999}});await refused({downloadLinks:{enabled:false,ttlMs:60000}});
 await refused({capabilityPlatform:{maximum:{},defaults:{generalReads:true},roleCeilings:{}}});
 await refused({intents:{enabled:'PENDING_OWNER'}},'RENDER_PENDING_VALUE');
 // reads: G1, exact ARNs, no Meri material secret, disabled names nothing.
 await refused({reads:READS},'RENDER_INPUT_REFUSED',{featureSecrets:featureSecrets()});
 for(const arn of [ARN.service.replace(/-Ab12Cd$/u,''),ARN.service.replace('us-east-1','us-west-2'),ARN.service.replace('967807252336','111111111111'),'meri/preview/core/internal-service-secret',
  ARN.service+' ','arn:aws:secretsmanager:us-east-1:967807252336:secret:meri/preview/control/material-OhIfMV'])
  await assert.rejects(render(withFeatures({sourceEnabled:true,reads:{...READS,serviceSecretArn:arn}}),{featureSecrets:featureSecrets()}),{code:'RENDER_INPUT_REFUSED',message:/^RENDER_INPUT_REFUSED: features\.reads\.serviceSecretArn must/u});
 await refused({sourceEnabled:true,reads:{...READS,readModeServiceSecretArn:ARN.service}});
 await refused({reads:{enabled:false,serviceSecretArn:ARN.service}});await refused({sourceEnabled:true,reads:{...READS,defaultCongress:0}},'RENDER_INPUT_REFUSED',{featureSecrets:featureSecrets()});
 await refused({sourceEnabled:true,reads:{...READS,approvedReads:{...APPROVED_READS,enabled:'yes'}}},'RENDER_INPUT_REFUSED',{featureSecrets:featureSecrets()});
 // Secret files: exactly the needed keys, the same ARN, a VersionId and exact token bytes.
 const on={sourceEnabled:true,reads:READS},secrets=change=>{const s=featureSecrets();change(s);return {featureSecrets:s};};
 await refused(on);await refused(on,'RENDER_INPUT_REFUSED',secrets(s=>{delete s['reads.readModeServiceSecret'];}));
 await refused({intents:{enabled:true}},'RENDER_INPUT_REFUSED',{featureSecrets:featureSecrets()});
 await refused(on,'RENDER_INPUT_REFUSED',secrets(s=>{s['reads.serviceSecret'].secretArn=ARN.readMode;}));
 await refused(on,'RENDER_INPUT_REFUSED',secrets(s=>{s['reads.serviceSecret'].versionId='AWSCURRENT';}));
 await refused(on,'RENDER_PRIVATE_REFUSED',secrets(s=>{s['reads.serviceSecret'].bytes=Buffer.from(SECRET.service+'\n');}));
 await refused(on,'RENDER_PRIVATE_REFUSED',secrets(s=>{s['reads.serviceSecret'].bytes=Buffer.alloc(0);}));
 await refused(on,'RENDER_PENDING_VALUE',secrets(s=>{s['reads.serviceSecret'].bytes=Buffer.from('PENDING_CORE');}));
});

test('ARN pattern is exact: complete suffixed secret ARNs in this account and region only',()=>{
 for(const ok of [ARN.service,ARN.readMode,'arn:aws:secretsmanager:us-east-1:967807252336:secret:INTERNAL_SERVICE_SECRET-a1B2c3'])assert.match(ok,SECRET_ARN);
 for(const bad of ['arn:aws:secretsmanager:us-east-1:967807252336:secret:meri/preview/core/internal_service_secret','arn:aws:secretsmanager:us-east-1:967807252336:secret:name-abc12',
  'arn:aws:secretsmanager:us-east-1:967807252336:secret:name-abcdefg','arn:aws-us-gov:secretsmanager:us-east-1:967807252336:secret:name-abcdef',
  'arn:aws:secretsmanager:us-east-2:967807252336:secret:name-abcdef','arn:aws:secretsmanager:us-east-1:96780725233:secret:name-abcdef',
  'arn:aws:secretsmanager:us-east-1:967807252336:secret:name-abcdef:SecretString:key::','arn:aws:secretsmanager:us-east-1:967807252336:secret:-abcdef',
  ` ${ARN.service}`,`${ARN.service}\n`,'arn:aws:ssm:us-east-1:967807252336:parameter/name-abcdef'])assert.doesNotMatch(bad,SECRET_ARN);
 assert.equal(parseFeatures(undefined),null);assert.deepEqual(parseFeatures({}),{});
});

test('CLI: --feature-secrets reads each secret file by path and the render writes no secret outside the bundles',async()=>{
 const i=await inputs(withFeatures({sourceEnabled:true,reads:{enabled:true,serviceSecretArn:ARN.service}}));
 const work=await mkdtemp(join(fixture.work,'cli-features-')),files={};
 for(const [name,value] of [['deployment',i.deployment],['core',i.core],['runtime',i.runtime],['stage3',i.stage3]]){files[name]=join(work,`${name}.json`);await writeFile(files[name],JSON.stringify(value));}
 const secretFile=join(work,'core-service-secret');await writeFile(secretFile,SECRET.service);
 const map={'reads.serviceSecret':{secretArn:ARN.service,versionId:VERSION,path:secretFile}};await writeFile(join(work,'feature-secrets.json'),JSON.stringify(map));
 assert.deepEqual(await readFeatureSecrets(map),{'reads.serviceSecret':{secretArn:ARN.service,versionId:VERSION,bytes:Buffer.from(SECRET.service)}});
 await assert.rejects(readFeatureSecrets({'reads.serviceSecret':{...map['reads.serviceSecret'],path:'relative/secret'}}),{code:'RENDER_INPUT_REFUSED'});
 await assert.rejects(readFeatureSecrets({'reads.other':map['reads.serviceSecret']}),{code:'RENDER_INPUT_REFUSED'});
 const args=['--deployment-inputs',files.deployment,'--private',fixture.pkiDir,'--core',files.core,'--runtime',files.runtime,'--stage3',files.stage3];
 const capture=async argv=>{const out=[],err=[],o=process.stdout.write.bind(process.stdout),e=process.stderr.write.bind(process.stderr);
  process.stdout.write=t=>{out.push(String(t));return true;};process.stderr.write=t=>{err.push(String(t));return true;};
  try{return {code:await main(argv),out:out.join(''),err:err.join('')};}finally{process.stdout.write=o;process.stderr.write=e;}};
 const missing=await capture([...args,'--out',join(work,'refused')]);
 assert.equal(missing.code,2);assert.match(missing.err,/featureSecrets\.reads\.serviceSecret is required/u);assert.equal(missing.err.includes(SECRET.service),false);
 const ok=await capture([...args,'--feature-secrets',join(work,'feature-secrets.json'),'--out',join(work,'rendered')]);
 assert.equal(ok.code,0,ok.err);assert.equal(ok.out.includes(SECRET.service),false);
 for(const name of ['summary.json',...ROLES.flatMap(role=>[`${role}/config.json`,`${role}/expected.json`])])assert.equal((await readFile(join(work,'rendered',name),'utf8')).includes(SECRET.service),false,name);
 const bundle=JSON.parse(await readFile(join(work,'rendered','control','bundle.json'),'utf8'));
 assert.equal(Buffer.from(bundle.files.find(f=>f.path===PATHS.readsServiceSecret).base64,'base64').toString(),SECRET.service);
});

test('approved reads allow valid narrowed role capabilities and reject invalid approved reads',async()=>{
 const platform=structuredClone(PROPOSED_PREVIEW_CAPABILITY_PLATFORM),operations=[...structuredClone(APPROVED_READS.operations),{id:'search_congress_bills',version:'0.2.0'}];
 for(const policy of [platform.maximum,platform.defaults,...Object.values(platform.roleCeilings)]){policy.generalReads=true;policy.activeReadOperations=structuredClone(operations);}
 platform.roleCeilings.standard_user.activeReadOperations=structuredClone(APPROVED_READS.operations);
 const approvedReads={...structuredClone(APPROVED_READS),operations};
 const features={sourceEnabled:true,capabilityPlatform:platform,reads:{...structuredClone(READS),approvedReads}};
 const rendered=await render(withFeatures(features),{featureSecrets:featureSecrets()});
 assert.deepEqual(config(rendered,'control').agentcore.approvedReads,approvedReads);
 assert.deepEqual(config(rendered,'control').capabilityPlatform.roleCeilings.standard_user.activeReadOperations,APPROVED_READS.operations);
 const bad=structuredClone(features);bad.reads.approvedReads.operations=[{id:'unknown_read',version:'0.2.0'}];
 await assert.rejects(render(withFeatures(bad),{featureSecrets:featureSecrets()}),/features\.reads\.approvedReads/);
 const policy=JSON.parse(await readFile(join(here,'policy.json'),'utf8'));
 assert.deepEqual(RV.parsePolicy(policy),policy);
 for(const extra of [{maxTurns:20},{model:'deployment-model'}])assert.throws(()=>RV.parsePolicy({...policy,runtime:{...policy.runtime,...extra}}),{code:'RUNTIME_VALUES_REFUSED'});
});

test('the complete 87-read roster survives all six rendered control lists',async()=>{
 const example=JSON.parse(await readFile(new URL('deployment-inputs.json',import.meta.url),'utf8'));
 const operations=[...example.features.reads.approvedReads.operations,...[
  'get_certification_status','get_state_rule_status','search_sam_opportunities','get_research_portfolio_share_links',
 ].map(id=>({id,version:'0.2.0'}))];
 assert.equal(operations.length,87);assert.equal(new Set(operations.map(x=>x.id)).size,87);
 const rendered=await render(withFeatures({sourceEnabled:true,reads:{...READS,approvedReads:{...APPROVED_READS,operations}},userPreferences:{enabled:true},tenantSettings:{enabled:true},intents:{enabled:true}}),{featureSecrets:featureSecrets()});
 const control=config(rendered,'control'),platform=control.capabilityPlatform;
 for(const list of [control.agentcore.approvedReads.operations,platform.maximum.activeReadOperations,platform.defaults.activeReadOperations,...Object.values(platform.roleCeilings).map(x=>x.activeReadOperations)])assert.deepEqual(list,operations);
 assert.ok(rendered.roles.control.configBytes.length<=40*1024);
 assert.ok(Buffer.byteLength(JSON.stringify(rendered.roles.control.bundle))<=65536);
});

test('Stage 3: feature material rides the existing control/material secret; templates carry digests, never the secret',async()=>{
 const {STAGE3_FAMILIES,nextRevisions,stage3RenderInput,buildStage3Bindings,synthesizeStage3}=await import('./stage3-bindings.mjs');
 const {parseLatestTsv}=await import('./stage3-deploy.mjs');
 await fixture.setup();const foundationOutputs=fixture.foundationOutputs;
 const features={sourceEnabled:true,retention:{enabled:true},artifacts:ARTIFACTS,downloadLinks:{enabled:true},reads:READS};
 const i=await inputs(withFeatures(features));
 const stage3=stage3RenderInput({deployment:i.deployment,foundationOutputs,revisions:nextRevisions(parseLatestTsv(Object.values(STAGE3_FAMILIES).map(f=>`${f}\tNone\n${f}\tNone`).join('\n')))});
 const rendered=await render(x=>{withFeatures(features)(x);x.stage3=stage3;},{featureSecrets:featureSecrets()});
 const versions=Object.fromEntries(ROLES.map((role,n)=>[role,`${n+1}`.repeat(8)+'-aaaa-4bbb-8ccc-'+`${n+1}`.repeat(12)]));
 const p=i.deployment.privateEdge,bindings=buildStage3Bindings({deployment:i.deployment,foundationOutputs,
  privateEdgeOutputs:{ControlPrivateOrigin:p.controlPrivateOrigin,ControlPrivateTargetGroupArn:p.controlPrivateTargetGroupArn,PrivateAlbSecurityGroupId:p.privateAlbSecurityGroupId},
  renderSummary:rendered.summary,renderedExpected:Object.fromEntries(ROLES.map(role=>[role,rendered.roles[role].expected])),secretVersions:versions,imageScans:{nodeRuntime:'d'.repeat(64)},
  liveAppTemplate:{Resources:{controlService:{Properties:{LoadBalancers:[{ContainerPort:8080,TargetGroupArn:foundationOutputs.ControlTargetGroupArn}]}}}}});
 const {bodies}=synthesizeStage3(bindings),key=rendered.roles.control.bundle.files.find(f=>f.path===PATHS.downloadLinkKey).base64;
 assert.equal(bindings.app.materialDelivery.control.valueFrom,`${i.deployment.secrets['control/material']}:::${versions.control}`);
 for(const path of [PATHS.readsServiceSecret,PATHS.readsReadModeServiceSecret,PATHS.downloadLinkKey])assert.ok(bodies.app.includes(path),path);
 for(const body of Object.values(bodies))for(const secret of [...Object.values(SECRET),Buffer.from(key,'base64').toString('utf8')])assert.equal(body.includes(secret),false);
});

test('artifacts.authority renders the Core artifact authority origin and reuses the reads service secret file; without reads it refuses',async()=>{
 await baseline();
 const rendered=await render(withFeatures({sourceEnabled:true,reads:READS,artifacts:{...ARTIFACTS,authority:{enabled:true}}}),{featureSecrets:featureSecrets()});
 const control=config(rendered,'control');
 assert.deepEqual(control.artifacts,{...ARTIFACTS,authority:{origin:control.agentcore.identity.origin,serviceSecretFile:PATHS.readsServiceSecret}});
 await assert.rejects(render(withFeatures({artifacts:{...ARTIFACTS,authority:{enabled:true}}})),/needs features.reads enabled/u);
 await assert.rejects(render(withFeatures({artifacts:{enabled:false,authority:{enabled:true}}})),/RENDER_INPUT_REFUSED/u);
 assert.deepEqual(config(await render(withFeatures({artifacts:ARTIFACTS})),'control').artifacts,ARTIFACTS);
});

test('memory renders the control memory block at the Core origin with the reads service secret file; without reads it refuses',async()=>{
 await baseline();
 const rendered=await render(withFeatures({sourceEnabled:true,reads:READS,memory:{enabled:true}}),{featureSecrets:featureSecrets()});
 const control=config(rendered,'control');
 assert.deepEqual(control.memory,{enabled:true,origin:control.agentcore.identity.origin,serviceSecretFile:PATHS.readsServiceSecret});
 assert.deepEqual(assertOnly(await render(withFeatures({memory:{enabled:false}})),['memory']).memory,{enabled:false});
 await assert.rejects(render(withFeatures({memory:{enabled:true}})),/needs features.reads enabled/u);
 await assert.rejects(render(withFeatures({memory:{enabled:'yes'}})),/RENDER_INPUT_REFUSED/u);
});

test('routines.core retains its Core origin and grant pins; retired task execution trust is refused',async()=>{
 await baseline();
 const {generateKeyPairSync}=await import('node:crypto');const jwk=i=>({...generateKeyPairSync('ed25519').publicKey.export({format:'jwk'}),kid:'k'+i});
 const execution={issuer:'capiro-core:execution',keys:[jwk(1)]},core={cancellationProof:{issuer:'capiro-core:routines',kid:'cancel-1',publicKey:(({kty,crv,x})=>({kty,crv,x}))(jwk(2))},unattendedGrant:{issuer:'capiro-core:routines',kid:'grant-1',publicKey:(({kty,crv,x})=>({kty,crv,x}))(jwk(3))}};
 const rendered=await render(withFeatures({sourceEnabled:true,reads:READS,intents:{enabled:true},routines:{enabled:true,core}}),{featureSecrets:featureSecrets()});
 const control=config(rendered,'control'),origin=control.agentcore.identity.origin;
 assert.deepEqual(control.intents,{enabled:true});
 assert.deepEqual(control.routines,{enabled:true,core:{origin,serviceSecretFile:PATHS.readsServiceSecret,...core}});
 const task={taskId:'11111111-1111-4111-8111-000000000009',version:1},workflow={taskQueue:'meri-schedule-worker',workflowIdPrefix:'meri/routine/'};
 const targeted=await render(i=>{withFeatures({sourceEnabled:true,reads:READS,routines:{enabled:true,core,task,workflow}})(i);addScheduleBindings(i);},{featureSecrets:featureSecrets()});
 assert.deepEqual(config(targeted,'control').routines,{enabled:true,core:{origin,serviceSecretFile:PATHS.readsServiceSecret,...core},task,workflow});
 await assert.rejects(render(withFeatures({routines:{enabled:false,task}})),/needs features.routines.enabled true/u);
 await assert.rejects(render(withFeatures({routines:{enabled:true,workflow:{...workflow,taskQueue:'bad queue'}}})),/features.routines.workflow target/u);
 assert.deepEqual(config(await render(withFeatures({intents:{enabled:true},routines:{enabled:false}})),'control').intents,{enabled:true});
 await assert.rejects(render(withFeatures({intents:{enabled:true,execution}})),/features.intents/u);
 await assert.rejects(render(withFeatures({sourceEnabled:true,reads:READS,routines:{enabled:false,core}}),{featureSecrets:featureSecrets()}),/needs features.routines.enabled true/u);
 await assert.rejects(render(withFeatures({sourceEnabled:true,reads:READS,intents:{enabled:true,execution:{issuer:'x',keys:[{kty:'RSA',kid:'k'}]}}}),{featureSecrets:featureSecrets()}),/features.intents/u);
 await assert.rejects(render(withFeatures({sourceEnabled:true,reads:READS,routines:{enabled:true,core:{cancellationProof:{...core.cancellationProof,kid:core.unattendedGrant.kid},unattendedGrant:core.unattendedGrant}}}),{featureSecrets:featureSecrets()}),/routines-configuration/u);
});

test('intents.core renders the Core approval forwarder block (origin and reads secret file) for native decisions and execution',async()=>{
 await baseline();
 const rendered=await render(withFeatures({sourceEnabled:true,reads:READS,intents:{enabled:true,core:{enabled:true}}}),{featureSecrets:featureSecrets()});
 const control=config(rendered,'control');
 assert.deepEqual(control.intents,{enabled:true,core:{origin:control.agentcore.identity.origin,serviceSecretFile:PATHS.readsServiceSecret}});
 await assert.rejects(render(withFeatures({intents:{enabled:true,core:{enabled:true}}})),/needs features.reads enabled/u);
 await assert.rejects(render(withFeatures({sourceEnabled:true,reads:READS,intents:{enabled:false,core:{enabled:true}}}),{featureSecrets:featureSecrets()}),/needs features.intents.enabled true/u);
});
