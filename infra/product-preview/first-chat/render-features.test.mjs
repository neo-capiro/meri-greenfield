/** Product-family activation (`features`) in render-material.mjs and the G3 profile plumbing in runtime-values.mjs, on THROWAWAY
 * material only (the shared fixture: pki.py PKI in a temp directory, synthetic passwords, bearer and Core secrets).
 *
 * The default render is compared byte for byte with the render module as committed at BASE (the reviewed first chat), under the same
 * deterministic randomness, so no `features` (or an empty block) provably changes nothing.
 *
 * Reads secret delivery needs one runtime change that is proposed, not made here: apps/runtime/material-init-plan.mjs must list the
 * reads secret files in control's inventory (otherwise the render refuses "control inventory differs from the plan"). When the source
 * plan lacks it, this file loads the plan with exactly that proposed line (a load hook, no file is edited); once the real change lands
 * the hook is a no-op. Run with MERI_REVIEW_SOURCE_ROOT=<worktree root> and Python 3 with `cryptography`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto,{createHash} from 'node:crypto';
import {registerHooks,syncBuiltinESMExports} from 'node:module';
import {execFileSync} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

const PLAN_ANCHOR="  if(c.downloadLinks?.enabled)add(c.downloadLinks.keyFile,'download-signing-key');\n";
export const PROPOSED_PLAN_LINE="  if(c.reads?.enabled===true){add(c.reads.serviceSecretFile,'reads-service-secret');if(c.reads.readModeServiceSecretFile!==undefined)add(c.reads.readModeServiceSecretFile,'reads-read-mode-service-secret');}\n";
let planPatched=false;
registerHooks({load(url,context,next){
 const result=next(url,context);
 if(!url.endsWith('/apps/runtime/material-init-plan.mjs'))return result;
 const source=String(result.source);if(source.includes('c.reads'))return result;
 if(!source.includes(PLAN_ANCHOR))throw Error('material-init-plan.mjs changed: update the reads proposal in render-features.test.mjs');
 planPatched=true;return {...result,source:source.replace(PLAN_ANCHOR,PLAN_ANCHOR+PROPOSED_PLAN_LINE)};
}});
const here=fileURLToPath(new URL('.',import.meta.url));
const R=await import('./render-material.mjs');
const {renderMaterial,readPrivateDirectory,readFeatureSecrets,withPosixPaths,parseFeatures,capabilityProfileOf,PATHS,ROLES,RUNTIME_USERS,SECRET_ARN,SOURCE_ROOT,main}=R;
const {createRenderFixture,IDENTITY,FAKE_PASSWORDS}=await import('./render-material.fixture.mjs');
const RV=await import('./runtime-values.mjs');
const {validateConfiguration}=await import('../../../apps/runtime/config.mjs');
const {compileProductMaterialPlan}=await import('../../../apps/runtime/material-init-plan.mjs');
const {validateStaticProductDelivery}=await import('../../../apps/runtime/material-init.mjs');
const {validateProductOwnerConfiguration}=await import('../../../apps/proxy/product/owner-entrypoint.mjs');
const {PROPOSED_PREVIEW_CAPABILITY_PLATFORM,NO_CAPABILITY_PLATFORM,createConfiguredRunCapabilityPolicy}=await import('../../../apps/runtime/product-ports/capability-policy.mjs');
const {canonicalSha256}=await import('../../../packages/contracts/validate.mjs');

/** The reviewed first-chat render this branch must reproduce exactly when no feature is set. */
export const BASE='eaf2b4ac';
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

/** Deterministic randomBytes/randomUUID for the duration of one synchronous render (the render's only entropy). */
function seeded(fn){
 const saved={randomBytes:crypto.randomBytes,randomUUID:crypto.randomUUID};let n=0;
 crypto.randomBytes=size=>{n++;return createHash('sha512').update(`bytes:${n}`).digest().subarray(0,size);};
 crypto.randomUUID=()=>{n++;const h=sha(`uuid:${n}`);return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
 syncBuiltinESMExports();
 try{return fn();}finally{Object.assign(crypto,saved);syncBuiltinESMExports();}
}
let pki;
async function inputs(change=x=>x){const i=structuredClone(await fixture.setup());pki??=await readPrivateDirectory(fixture.pkiDir);change(i);return i;}
async function render(change,options={},module=R){
 const i=await inputs(change);
 return seeded(()=>module.renderMaterial({...i,private:pki,identityCredential:Buffer.from(IDENTITY),nowMs:NOW,sourceRoot:SOURCE_ROOT,...options}));
}
const withFeatures=(features,runtime)=>i=>{i.deployment.features=structuredClone(features);if(runtime)runtime(i.runtime);};
const config=(rendered,role)=>JSON.parse(rendered.roles[role].configBytes.toString('utf8'));
const bytesOf=rendered=>Object.fromEntries(ROLES.map(role=>[role,{config:rendered.roles[role].configBytes.toString('base64'),
 bundle:JSON.stringify(rendered.roles[role].bundle),expected:JSON.stringify(rendered.roles[role].expected)}]));
let defaults;
async function baseline(){return defaults??=await render();}

/** The render module exactly as committed at BASE, importing this tree's validators (absolute specifiers), or null without git. */
async function baseModule(){
 let source;try{source=execFileSync('git',['-C',SOURCE_ROOT,'show',`${BASE}:infra/product-preview/first-chat/render-material.mjs`],{encoding:'utf8',maxBuffer:8*1024*1024,stdio:['ignore','pipe','ignore']});}catch{return null;}
 const dir=await mkdtemp(join(tmpdir(),'meri-render-base-')),file=join(dir,'render-material.base.mjs');
 await writeFile(file,source.replaceAll("'../../../",`'${pathToFileURL(SOURCE_ROOT).href.replace(/\/?$/u,'/')}`));
 try{return await import(pathToFileURL(file).href);}finally{await rm(dir,{recursive:true,force:true});}
}

test('no features (absent or {}) renders byte-identical material and summary to the reviewed render at BASE',async t=>{
 const base=await baseModule();if(!base){t.skip(`git object ${BASE} unavailable`);return;}
 const reviewed=await render(x=>x,{},base),current=await baseline(),empty=await render(withFeatures({}));
 for(const other of [current,empty]){
  assert.deepEqual(bytesOf(other),bytesOf(reviewed));
  assert.equal(JSON.stringify(other.summary),JSON.stringify(reviewed.summary));
 }
 // The comparison is meaningful: the seeded render is stable and the fixture really renders the full material.
 assert.equal(JSON.stringify(bytesOf(await render())),JSON.stringify(bytesOf(current)));
 assert.equal(Object.hasOwn(current.summary,'features'),false);
 for(const key of ['userPreferences','tenantSettings','intents','routines','retention','artifacts','downloadLinks','capabilityPlatform','reads'])assert.equal(Object.hasOwn(config(current,'control'),key),false);
});

/** Control differs from the default by exactly `keys` (and the owner only by control's hash); the other roles are identical. */
function assertOnly(rendered,keys,{worker={},extraControlFiles=[]}={}){
 const d=defaults,control=config(rendered,'control'),base=config(d,'control');
 const strip=(c,names)=>Object.fromEntries(Object.entries(c).filter(([k])=>!names.includes(k)));
 // New keys are appended after every first-chat key, in the fixed order; sourceEnabled is the existing key flipped.
 assert.deepEqual(Object.keys(control),[...Object.keys(base),...keys.filter(k=>k!=='sourceEnabled')]);
 assert.equal(control.sourceEnabled,keys.includes('sourceEnabled'));
 assert.deepEqual(strip(control,[...keys,'nativeCandidate','sourceEnabled']),strip(base,['nativeCandidate','sourceEnabled']));
 assert.deepEqual(strip(control.nativeCandidate,['approvedReads']),base.nativeCandidate);
 assert.deepEqual(config(rendered,'temporal-worker'),{...config(d,'temporal-worker'),...worker});
 for(const role of ['temporal-issuer','model-proxy'])assert.ok(rendered.roles[role].configBytes.equals(d.roles[role].configBytes),role);
 const owner=config(rendered,'model-owner');assert.deepEqual({...owner,controlConfigurationSha256:null},{...config(d,'model-owner'),controlConfigurationSha256:null});
 assert.equal(owner.controlConfigurationSha256,rendered.roles.control.configSha256);assert.equal(owner.sourceEnabled,false);
 const paths=r=>Object.keys(r.roles.control.expected.sha256ByPath);
 assert.deepEqual(paths(rendered),[...paths(d),...extraControlFiles]);
 for(const role of ['temporal-issuer','model-proxy',...(Object.keys(worker).length?[]:['temporal-worker'])])assert.deepEqual(rendered.roles[role].expected,d.roles[role].expected);
 assert.deepEqual(Object.keys(rendered.roles['temporal-worker'].expected.sha256ByPath),Object.keys(d.roles['temporal-worker'].expected.sha256ByPath));
 // Every repository validator and plan ran inside the render; re-check the two the features touch, on the exact bytes.
 withPosixPaths(()=>{validateConfiguration(control,'control');validateProductOwnerConfiguration(owner);
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
 assert.equal(control.sourceEnabled,true);assert.equal(config(on,'model-owner').sourceEnabled,false);
 withPosixPaths(()=>validateConfiguration(config(on,'temporal-worker'),'temporal-worker'));
});

test('artifacts, retention custody and download links render their keys; the link key is control-only, fresh and never in JSON',async()=>{
 await baseline();
 const plain=assertOnly(await render(withFeatures({artifacts:ARTIFACTS})),['artifacts']);
 assert.deepEqual(plain.artifacts,ARTIFACTS);
 assert.deepEqual(assertOnly(await render(withFeatures({artifacts:{enabled:false}})),['artifacts']).artifacts,{enabled:false});
 const custody=assertOnly(await render(withFeatures({retention:{enabled:true},artifacts:ARTIFACTS})),['retention','artifacts']);
 assert.equal(custody.artifacts.tenantId,'synthetic-tenant');
 const links=await render(withFeatures({retention:{enabled:true},artifacts:ARTIFACTS,downloadLinks:{enabled:true,ttlMs:60000}}));
 const control=assertOnly(links,['retention','artifacts','downloadLinks'],{extraControlFiles:[PATHS.downloadLinkKey]});
 assert.deepEqual(control.downloadLinks,{enabled:true,keyFile:PATHS.downloadLinkKey,ttlMs:60000});
 const key=Buffer.from(links.roles.control.bundle.files.find(f=>f.path===PATHS.downloadLinkKey).base64,'base64');
 assert.ok(key.length>=32);assert.equal(links.roles.control.expected.sha256ByPath[PATHS.downloadLinkKey],sha(key));
 assertNotInJson(links,key.toString('utf8'));
 assert.equal(links.roles['model-owner'].bundle.files.some(f=>f.path===PATHS.downloadLinkKey),false);
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

test('reads: the Core service secrets come from the exact ARNs, travel only in control material (0600, digest-pinned), never in JSON',async t=>{
 await baseline();
 if(planPatched)t.diagnostic('material-init-plan.mjs loaded WITH the proposed reads inventory line (runtime change not in source yet)');
 const rendered=await render(withFeatures({sourceEnabled:true,reads:READS}),{featureSecrets:featureSecrets()});
 const control=assertOnly(rendered,['sourceEnabled','reads'],{worker:{sourceEnabled:true},extraControlFiles:[PATHS.readsServiceSecret,PATHS.readsReadModeServiceSecret]});
 assert.deepEqual(control.reads,{enabled:true,serviceSecretFile:PATHS.readsServiceSecret,readModeServiceSecretFile:PATHS.readsReadModeServiceSecret,defaultCongress:119});
 assert.deepEqual(control.nativeCandidate.approvedReads,APPROVED_READS);
 assert.deepEqual({...control.nativeCandidate,approvedReads:undefined},{...config(defaults,'control').nativeCandidate,approvedReads:undefined});
 const files=new Map(rendered.roles.control.bundle.files.map(f=>[f.path,Buffer.from(f.base64,'base64')]));
 assert.equal(files.get(PATHS.readsServiceSecret).toString(),SECRET.service);assert.equal(files.get(PATHS.readsReadModeServiceSecret).toString(),SECRET.readMode);
 assert.equal(rendered.roles.control.expected.sha256ByPath[PATHS.readsServiceSecret],sha(SECRET.service));
 for(const secret of Object.values(SECRET)){assertNotInJson(rendered,secret);
  for(const role of ROLES.filter(r=>r!=='control'))assert.equal(JSON.stringify(rendered.roles[role].bundle).includes(Buffer.from(secret).toString('base64')),false,role);}
 assert.deepEqual(rendered.summary.features.secretFiles[PATHS.readsServiceSecret],{feature:'reads.serviceSecret',secretArn:ARN.service,versionId:VERSION,sha256:sha(SECRET.service)});
 assert.deepEqual(rendered.summary.features.controlKeys,['reads']);
 // A tampered secret byte is refused by the real receiver.
 const tampered=structuredClone(rendered.roles.control.bundle);tampered.files.find(f=>f.path===PATHS.readsServiceSecret).base64=Buffer.from('other-secret').toString('base64');
 assert.throws(()=>withPosixPaths(()=>validateStaticProductDelivery({expected:rendered.roles.control.expected,bundle:tampered})),/STATIC_INIT_/u);
 // Without the optional read-mode secret only the service secret is delivered.
 const one=await render(withFeatures({sourceEnabled:true,reads:{enabled:true,serviceSecretArn:ARN.service}}),{featureSecrets:{'reads.serviceSecret':featureSecrets()['reads.serviceSecret']}});
 assert.deepEqual(config(one,'control').reads,{enabled:true,serviceSecretFile:PATHS.readsServiceSecret});
 assert.equal(Object.hasOwn(config(one,'control').nativeCandidate,'approvedReads'),false);
 assert.deepEqual(assertOnly(await render(withFeatures({reads:{enabled:false}})),['reads']).reads,{enabled:false});
});

test('capability platform renders verbatim only with the matching G3 measurement pin',async()=>{
 await baseline();
 const profile=capabilityProfileOf(PROPOSED_PREVIEW_CAPABILITY_PLATFORM);
 assert.equal(profile.profileSha256,createConfiguredRunCapabilityPolicy({capabilityPlatform:PROPOSED_PREVIEW_CAPABILITY_PLATFORM}).profileSha256);
 const pinned=await render(withFeatures({capabilityPlatform:PROPOSED_PREVIEW_CAPABILITY_PLATFORM},runtime=>{runtime.capabilityProfileSha256=profile.profileSha256;}));
 const control=assertOnly(pinned,['capabilityPlatform']);
 assert.deepEqual(control.capabilityPlatform,structuredClone(PROPOSED_PREVIEW_CAPABILITY_PLATFORM));
 assert.equal(createConfiguredRunCapabilityPolicy(control).profileSha256,profile.profileSha256);assert.equal(pinned.summary.features.capabilityProfileSha256,profile.profileSha256);
 // Unmeasured profile, a pin for a different profile, or a pin without a profile: every run would refuse SDK_OPTIONS_REFUSED.
 await assert.rejects(render(withFeatures({capabilityPlatform:PROPOSED_PREVIEW_CAPABILITY_PLATFORM})),{code:'RENDER_INPUT_REFUSED',message:/G3/u});
 await assert.rejects(render(withFeatures({capabilityPlatform:PROPOSED_PREVIEW_CAPABILITY_PLATFORM},r=>{r.capabilityProfileSha256='a'.repeat(64);})),{code:'RENDER_INPUT_REFUSED'});
 await assert.rejects(render(x=>{x.runtime.capabilityProfileSha256=profile.profileSha256;}),{code:'RENDER_INPUT_REFUSED',message:/G3/u});
 // A platform that enables nothing resolves to no profile, so the first-chat options (and pin) still hold.
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
 await refused(({artifacts:{...ARTIFACTS,bucket:'meri-greenfield-qual-checkpoint-967807252336-us-east-1',prefix:'product-preview'}}));
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
 // Secret files: exactly the needed keys, the same ARN, a VersionId, exact token bytes, never the identity bearer.
 const on={sourceEnabled:true,reads:READS},secrets=change=>{const s=featureSecrets();change(s);return {featureSecrets:s};};
 await refused(on);await refused(on,'RENDER_INPUT_REFUSED',secrets(s=>{delete s['reads.readModeServiceSecret'];}));
 await refused({intents:{enabled:true}},'RENDER_INPUT_REFUSED',{featureSecrets:featureSecrets()});
 await refused(on,'RENDER_INPUT_REFUSED',secrets(s=>{s['reads.serviceSecret'].secretArn=ARN.readMode;}));
 await refused(on,'RENDER_INPUT_REFUSED',secrets(s=>{s['reads.serviceSecret'].versionId='AWSCURRENT';}));
 await refused(on,'RENDER_PRIVATE_REFUSED',secrets(s=>{s['reads.serviceSecret'].bytes=Buffer.from(SECRET.service+'\n');}));
 await refused(on,'RENDER_PRIVATE_REFUSED',secrets(s=>{s['reads.serviceSecret'].bytes=Buffer.alloc(0);}));
 await refused(on,'RENDER_PRIVATE_REFUSED',secrets(s=>{s['reads.serviceSecret'].bytes=Buffer.from(IDENTITY);}));
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

test('runtime values: the capability profile reaches the measurement and the assembled pin; without the feature nothing changes',async()=>{
 const policy=JSON.parse(await readFile(join(here,'policy.json'),'utf8')),deployment=(await inputs()).deployment,policyRevision=RV.policyRevisionOf(policy);
 const moduleBytes=await readFile(join(SOURCE_ROOT,RV.MEASUREMENT_MODULE)),profile=capabilityProfileOf(PROPOSED_PREVIEW_CAPABILITY_PLATFORM);
 const featured={...structuredClone(deployment),features:{capabilityPlatform:structuredClone(PROPOSED_PREVIEW_CAPABILITY_PLATFORM)}};
 // Default: identical arguments, inputs and override with or without an empty features block.
 assert.deepEqual(RV.measurementArguments({policy,deployment:{...deployment,features:{}},policyRevision}),RV.measurementArguments({policy,deployment,policyRevision}));
 assert.equal(Object.hasOwn(RV.measurementInputs({policy,deployment,policyRevision}),'capabilityProfileSha256'),false);
 // Featured: the exact profile travels as one argument and its digest is a receipt input.
 const args=RV.measurementArguments({policy,deployment:featured,policyRevision}),at=args.indexOf('--capability-profile');
 assert.ok(at>0);const sent=JSON.parse(Buffer.from(args[at+1],'base64url').toString('utf8'));
 assert.equal(canonicalSha256(sent),profile.profileSha256);assert.equal(RV.measurementInputs({policy,deployment:featured,policyRevision}).capabilityProfileSha256,profile.profileSha256);
 assert.throws(()=>RV.measurementOverrides({moduleBytes,policy,deployment:featured,policyRevision}),/use --shipped/u);
 const shipped=RV.measurementOverrides({moduleBytes,policy,deployment:featured,policyRevision,mode:'shipped'});
 assert.ok(Buffer.byteLength(JSON.stringify(shipped))<=8192);assert.match(shipped.containerOverrides[0].command[0],/'--capability-profile' '[A-Za-z0-9_-]+'/u);
 // G3: the measurement module projects the profile (capabilities/measured-options.mjs), so its source template differs from the
 // first-chat one and assembly no longer refuses on projection; only the receipt decides. An empty receipt refuses on its schema, and the
 // committed first-chat receipt (measured without the profile) on its capabilityProfileSha256 input, never pinning unmeasured options.
 const {probeTemplateSha256}=await import(pathToFileURL(join(SOURCE_ROOT,RV.MEASUREMENT_MODULE)).href),{capabilityProfileSha256:_,...plain}=RV.measurementInputs({policy,deployment:featured,policyRevision});
 assert.notEqual(await probeTemplateSha256({...plain,capabilityProfile:profile.profile},{root:SOURCE_ROOT}),await probeTemplateSha256(plain,{root:SOURCE_ROOT}));
 const allocationFile=JSON.parse(await readFile(join(here,'allocation.json'),'utf8')),committedReceipt=JSON.parse(await readFile(join(here,'launch-measurement-receipt.json'),'utf8'));
 await assert.rejects(RV.runtimeValues({receipt:{},allocation:allocationFile,policy,deployment:featured,requireLinux:false}),{code:'RUNTIME_VALUES_REFUSED',message:/receipt\.schema/u});
 await assert.rejects(RV.runtimeValues({receipt:committedReceipt,allocation:allocationFile,policy,deployment:featured,requireLinux:false}),{code:'RUNTIME_VALUES_REFUSED',message:/capabilityProfileSha256/u});
 const assembled=RV.assembleRuntimeValues({receipt:{versions:{sdk:'0.3.295',cli:'2.1.295'},skills:{digest:'b'.repeat(64)},launchTemplate:{command:'/x',args:[],env:{}},executable:{sha256:'c'.repeat(64)},
  sdkOptions:{sha256:'d'.repeat(64)},runner:{sha256:'e'.repeat(64)}},allocation:(await inputs()).runtime.allocation,policy,policyRevision,capabilityProfileSha256:profile.profileSha256});
 assert.equal(assembled.capabilityProfileSha256,profile.profileSha256);assert.equal(R.parseRuntimeValues(assembled).capabilityProfileSha256,profile.profileSha256);
 assert.throws(()=>R.parseRuntimeValues({...assembled,capabilityProfileSha256:'xyz'}),{code:'RENDER_INPUT_REFUSED'});
});

test('Stage 3: feature material rides the existing control/material secret; templates carry digests, never the secret',async()=>{
 const {STAGE3_FAMILIES,nextRevisions,stage3RenderInput,buildStage3Bindings,synthesizeStage3}=await import('./stage3-bindings.mjs');
 const {parseLatestTsv}=await import('./stage3-deploy.mjs');
 const foundationOutputs=JSON.parse(await readFile(join(here,'foundation-outputs.json'),'utf8'));
 const features={sourceEnabled:true,retention:{enabled:true},artifacts:ARTIFACTS,downloadLinks:{enabled:true},reads:READS};
 const i=await inputs(withFeatures(features));
 const stage3=stage3RenderInput({deployment:i.deployment,foundationOutputs,revisions:nextRevisions(parseLatestTsv(Object.values(STAGE3_FAMILIES).map(f=>`${f}\tNone\n${f}\tNone`).join('\n')))});
 const rendered=await render(x=>{withFeatures(features)(x);x.stage3=stage3;},{featureSecrets:featureSecrets()});
 const versions=Object.fromEntries(ROLES.map((role,n)=>[role,`${n+1}`.repeat(8)+'-aaaa-4bbb-8ccc-'+`${n+1}`.repeat(12)]));
 const p=i.deployment.privateEdge,bindings=buildStage3Bindings({deployment:i.deployment,foundationOutputs,
  privateEdgeOutputs:{ControlPrivateOrigin:p.controlPrivateOrigin,ControlPrivateTargetGroupArn:p.controlPrivateTargetGroupArn,PrivateAlbSecurityGroupId:p.privateAlbSecurityGroupId},
  renderSummary:rendered.summary,renderedExpected:Object.fromEntries(ROLES.map(role=>[role,rendered.roles[role].expected])),secretVersions:versions,imageScans:{proxy:'c'.repeat(64),nodeRuntime:'d'.repeat(64)}});
 const {bodies}=synthesizeStage3(bindings),key=rendered.roles.control.bundle.files.find(f=>f.path===PATHS.downloadLinkKey).base64;
 assert.equal(bindings.app.materialDelivery.control.valueFrom,`${i.deployment.secrets['control/material']}:::${versions.control}`);
 for(const path of [PATHS.readsServiceSecret,PATHS.readsReadModeServiceSecret,PATHS.downloadLinkKey])assert.ok(bodies.app.includes(path),path);
 for(const body of Object.values(bodies))for(const secret of [...Object.values(SECRET),Buffer.from(key,'base64').toString('utf8')])assert.equal(body.includes(secret),false);
});

test('artifacts.authority renders the Core artifact authority origin and reuses the reads service secret file; without reads it refuses',async()=>{
 await baseline();
 const rendered=await render(withFeatures({sourceEnabled:true,reads:READS,artifacts:{...ARTIFACTS,authority:{enabled:true}}}),{featureSecrets:featureSecrets()});
 const control=config(rendered,'control');
 assert.deepEqual(control.artifacts,{...ARTIFACTS,authority:{origin:control.nativeCandidate.identity.origin,serviceSecretFile:PATHS.readsServiceSecret}});
 await assert.rejects(render(withFeatures({artifacts:{...ARTIFACTS,authority:{enabled:true}}})),/needs features.reads enabled/u);
 await assert.rejects(render(withFeatures({artifacts:{enabled:false,authority:{enabled:true}}})),/RENDER_INPUT_REFUSED/u);
 assert.deepEqual(config(await render(withFeatures({artifacts:ARTIFACTS})),'control').artifacts,ARTIFACTS);
});

test('memory renders the control memory block at the Core origin with the reads service secret file; without reads it refuses',async()=>{
 await baseline();
 const rendered=await render(withFeatures({sourceEnabled:true,reads:READS,memory:{enabled:true}}),{featureSecrets:featureSecrets()});
 const control=config(rendered,'control');
 assert.deepEqual(control.memory,{enabled:true,origin:control.nativeCandidate.identity.origin,serviceSecretFile:PATHS.readsServiceSecret});
 assert.deepEqual(assertOnly(await render(withFeatures({memory:{enabled:false}})),['memory']).memory,{enabled:false});
 await assert.rejects(render(withFeatures({memory:{enabled:true}})),/needs features.reads enabled/u);
 await assert.rejects(render(withFeatures({memory:{enabled:'yes'}})),/RENDER_INPUT_REFUSED/u);
});
