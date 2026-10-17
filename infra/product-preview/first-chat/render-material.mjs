#!/usr/bin/env node
/** Meri first-chat preview: render the exact static material for control, temporal-worker, temporal-issuer, model-owner
 * and model-proxy from (a) deployment-inputs.json, (b) the private PKI/login directory, (c) Core values, (d) the Meri
 * runtime values and (e) the Stage 3 task-definition/service ARNs.
 *
 * Every rendered role is checked with the repository's own validators and material plans before anything is written:
 * config.mjs validateConfiguration and the cli.mjs product gates (control, temporal-worker), prepared-candidate-config,
 * temporal-issuer-cli parseTemporalIssuerRuntimeConfiguration, owner-entrypoint validateProductOwnerConfiguration,
 * proxy startup-config, material-init-plan compileProductMaterialPlan and material-init validateStaticProductDelivery.
 * Any value still starting with PENDING_ refuses.
 *
 * Circularity: control/worker/owner/proxy/issuer configs pin task-definition ARNs (family:revision) and the task
 * definitions pin these configs' hashes. ARNs are plain inputs: the deployer passes the revision each family WILL get
 * (a new family starts at :1 and only increments on re-registration), renders, then registers exactly once per family
 * and verifies the returned ARN equals the input. A mismatch means re-render with the actual revisions.
 *
 * Output (a NEW directory outside the repository, 0700/0600): <role>/config.json (exact bytes), <role>/bundle.json
 * (SECRET: Secrets Manager SecretString for MERI_STATIC_MATERIAL_BUNDLE), <role>/expected.json (MERI_STATIC_MATERIAL_EXPECTED)
 * and summary.json (non-secret pins and task-definition wiring). Importing this module performs no IO.
 *
 * Input shapes (all closed; see the parse* functions):
 *  core-values.json   {coreOrigin, frontendOrigin, tenantId, actorId, clientId (uuid), identityCredentialPath (local file, copied byte-exact)}
 *  runtime-values.json {schemaVersion:1, versions:{sdk,cli,contracts,skillsDigest,checkpointFormat},
 *    preparationIntent:{configParentDirectory, secureStorageDirectory, launchTemplate:{command,args,env}, executableSha256, sdkOptionsSha256, runnerSha256?},
 *      sdkOptionsSha256 is the run-invariant SDK option template hash (apps/runtime/native-authority/sdk-option-template.mjs), carried
 *      unchanged into the static candidate and every dynamic run (runner-query.mjs checks each run's per-run values against its intent).
 *    allocation:{manifest (SkillManifest incl. budgets), catalogSha256, scheduleRevision, operations:[{operation,chargeMicrousd}]},
 *    runtime:{maxTurns, maxOutputBytes}, qualification:{attempt, policyRevision (64 hex, Meri-owned)}, plan?, multiRun?:{runWindowMs}}
 *  stage3.json {schemaVersion:1, taskDefinitions:{control,'temporal-worker','temporal-issuer','model-owner','model-proxy',runner} (family:revision ARNs),
 *    services:{control,'temporal-worker','model-owner','model-proxy','temporal-issuer'?}, network:{control|temporal-worker|model-owner|model-proxy:
 *    {subnets,securityGroups} (the exact service ENI sets), runner:{subnet,securityGroups}}}
 *  private dir: <stem>.pem / <stem>.key.pem from pki.py, pins.json, db-logins.json {control, modelOwner, issuer} (password string or {password}). */
import {createHash,createPrivateKey,createPublicKey,randomBytes,randomUUID,X509Certificate} from 'node:crypto';
import {readFile,mkdir,writeFile,lstat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import nodePath,{join,relative,resolve,isAbsolute} from 'node:path';
import {syncBuiltinESMExports} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {validateConfiguration,compileControlTaskRouterConfiguration} from '../../../apps/runtime/config.mjs';
import {productWorkerTrustsPinnedServerCa} from '../../../apps/runtime/cli.mjs';
import {compilePreparedCandidateConfiguration} from '../../../apps/runtime/prepared-candidate-config.mjs';
import {parseTemporalIssuerRuntimeConfiguration} from '../../../apps/runtime/temporal-issuer-cli.mjs';
import {compileProductMaterialPlan} from '../../../apps/runtime/material-init-plan.mjs';
import {validateStaticProductDelivery} from '../../../apps/runtime/material-init.mjs';
import {RUNNER_SDK_CA_FILE} from '../../../apps/runtime/native-authority/preparation-intent.mjs';
import {productRunnerMeasurement} from '../../../apps/runtime/native-authority/ecs-prepared-task-proof.mjs';
import {runOwnerOperations} from '../../../packages/contracts/runtime-0.2/validate.mjs';
import {sdkSessionOperations} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {validateProductOwnerConfiguration} from '../../../apps/proxy/product/owner-entrypoint.mjs';
import {parseProductProxyStartupConfiguration,PRODUCT_PROXY_PRICING_REVISION} from '../../../apps/proxy/product/startup-config.mjs';

export const SOURCE_ROOT=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const ACCOUNT='967807252336',REGION='us-east-1',ECS=`arn:aws:ecs:${REGION}:${ACCOUNT}:`;
export const ROLES=Object.freeze(['control','temporal-worker','temporal-issuer','model-owner','model-proxy']);
export const RUNTIME_USERS=Object.freeze({control:'1000:1000','temporal-worker':'1000:1000','temporal-issuer':'1000:1000','model-owner':'1000:1000','model-proxy':'10001:10001'});
export const CONTAINER_NAMES=Object.freeze({control:'control','temporal-worker':'temporal-worker','temporal-issuer':'temporal-issuer','model-owner':'model-owner','model-proxy':'model-proxy',runner:'worker'});
/** Task-local /run/meri inventory. Every path is a direct child, as material-init-plan requires. */
export const PATHS=Object.freeze({
 control:'/run/meri/control.json',worker:'/run/meri/worker.json',issuer:'/run/meri/issuer.json',owner:'/run/meri/owner.json',proxy:'/run/meri/proxy.json',
 database:'/run/meri/database.uri',identity:'/run/meri/identity',taskCapability:'/run/meri/task-capability',
 controlCapability:'/run/meri/control-capability',proxyCapability:'/run/meri/proxy-capability',
 temporalCa:'/run/meri/temporal-ca.pem',temporalCert:'/run/meri/temporal-client.pem',temporalKey:'/run/meri/temporal-client.key',
 issuerJwks:'/run/meri/issuer-jwks.json',issuerCa:'/run/meri/issuer-ca.pem',issuerClientCa:'/run/meri/issuer-client-ca.pem',
 runnerCa:'/run/meri/runner-ca.pem',runnerCaKey:'/run/meri/runner-ca.key',controlCa:'/run/meri/control-ca.pem',
 issuerDatabase:'/run/meri/issuer-database.uri',issuerServerCert:'/run/meri/issuer-server.crt',issuerServerKey:'/run/meri/issuer-server.key',
 issuerClientCaKey:'/run/meri/issuer-client-ca.key',
 ownerCa:'/run/meri/owner-bridge-ca.pem',ownerCert:'/run/meri/owner-server.pem',ownerKey:'/run/meri/owner-server.key',
 proxyServerCert:'/run/meri/proxy-server.pem',proxyServerKey:'/run/meri/proxy-server.key',proxyOwnerCa:'/run/meri/proxy-owner-ca.pem',
 proxyOwnerCert:'/run/meri/proxy-owner-client.pem',proxyOwnerKey:'/run/meri/proxy-owner-client.key'});
const TEMPORAL_IDENTITY=Object.freeze({directory:'/run/meri-temporal/identity',keyFile:'/run/meri-temporal/identity/client-key.pem',certFile:'/run/meri-temporal/identity/client-cert.pem',tokenFile:'/run/meri-temporal/token.json'});
const IDENTITIES=Object.freeze({control:{subject:'meri-temporal-control:v1',workloadPrincipal:'meri-workload-control:v1'},'temporal-worker':{subject:'meri-temporal-worker:v1',workloadPrincipal:'meri-workload-worker:v1'}});
const DAY_MS=86400000;
/** Defaults for bounded timing values. Each is inside the validator range it is named after. */
export const DEFAULTS=Object.freeze({validityDays:7,taskRouterZone:'runner.meri.internal',deploymentRevision:'first-chat-preview-1',
 materialDirectory:'/tmp/meri-material',workspaceRoot:'/workspace',plan:Object.freeze({purpose:'meri-first-chat-preview'})});

export const fail=(code,detail)=>{throw Object.assign(Error(detail?`${code}: ${detail}`:code),{code});};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const hex64=/^[a-f0-9]{64}$/u,uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
function record(value,name,required=[],optional=[]){
 if(value===null||typeof value!=='object'||Array.isArray(value))fail('RENDER_INPUT_REFUSED',`${name} must be an object`);
 for(const key of required)if(!Object.hasOwn(value,key))fail('RENDER_INPUT_REFUSED',`${name}.${key} is required`);
 for(const key of Object.keys(value))if(![...required,...optional].includes(key))fail('RENDER_INPUT_REFUSED',`${name}.${key} is not an accepted field`);
 return value;
}
/** Fail closed on any value that is still a placeholder anywhere in a supplied input. */
export function assertNoPending(value,name){
 const walk=(v,path)=>{
  if(typeof v==='string'){if(/^PENDING_/u.test(v)||v.includes('PENDING_'))fail('RENDER_PENDING_VALUE',path);}
  else if(Array.isArray(v))v.forEach((x,i)=>walk(x,`${path}[${i}]`));
  else if(v&&typeof v==='object')for(const [k,x] of Object.entries(v))walk(x,`${path}.${k}`);
 };walk(value,name);
}
function origin(value,name){let u;try{u=new URL(value);}catch{fail('RENDER_INPUT_REFUSED',`${name} is not a URL`);}
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/'||u.origin!==value)fail('RENDER_INPUT_REFUSED',`${name} must be a bare https origin`);return value;}
const imageDigest=uri=>{const m=/^967807252336\.dkr\.ecr\.us-east-1\.amazonaws\.com\/[a-z0-9]+(?:[._/-][a-z0-9]+)*@sha256:([a-f0-9]{64})$/u.exec(uri);if(!m)fail('RENDER_INPUT_REFUSED',`image ${uri} is not a digest-pinned ECR URI`);return m[1];};
const taskDefinitionArn=(value,name)=>{if(typeof value!=='string'||!/^arn:aws:ecs:us-east-1:967807252336:task-definition\/[A-Za-z0-9_-]+:[1-9][0-9]*$/u.test(value))fail('RENDER_INPUT_REFUSED',`${name} must be a task-definition ARN with an explicit revision`);return value;};
const serviceArn=(value,cluster,name)=>{if(typeof value!=='string'||!new RegExp(`^arn:aws:ecs:us-east-1:967807252336:service/${cluster}/[A-Za-z0-9_-]{1,255}$`,'u').test(value))fail('RENDER_INPUT_REFUSED',`${name} must be a service ARN in cluster ${cluster}`);return value;};
const ids=(values,kind,name,{min=1,max=16}={})=>{if(!Array.isArray(values)||values.length<min||values.length>max||new Set(values).size!==values.length||values.some(v=>typeof v!=='string'||!new RegExp(`^${kind}-[a-f0-9]{8,17}$`,'u').test(v)))fail('RENDER_INPUT_REFUSED',`${name} must be ${min}..${max} unique ${kind} ids`);return [...values];};
const revisionOf=arn=>Number(arn.slice(arn.lastIndexOf(':')+1));

/** Non-secret Stage 3 identifiers. */
export function parseStage3(raw,{clusterName}){
 const s=record(raw,'stage3',['schemaVersion','taskDefinitions','services','network']);
 if(s.schemaVersion!==1)fail('RENDER_INPUT_REFUSED','stage3.schemaVersion must be 1');
 const t=record(s.taskDefinitions,'stage3.taskDefinitions',[...ROLES,'runner']);
 for(const role of Object.keys(t))taskDefinitionArn(t[role],`stage3.taskDefinitions.${role}`);
 if(new Set(Object.values(t)).size!==Object.keys(t).length)fail('RENDER_INPUT_REFUSED','task definitions must be distinct');
 const sv=record(s.services,'stage3.services',['control','temporal-worker','model-owner','model-proxy'],['temporal-issuer']);
 for(const role of Object.keys(sv))serviceArn(sv[role],clusterName,`stage3.services.${role}`);
 if(new Set(Object.values(sv)).size!==Object.keys(sv).length)fail('RENDER_INPUT_REFUSED','services must be distinct');
 const n=record(s.network,'stage3.network',['control','temporal-worker','model-owner','model-proxy','runner']);
 const network={};
 for(const role of ['control','temporal-worker','model-owner','model-proxy']){const r=record(n[role],`stage3.network.${role}`,['subnets','securityGroups']);
  network[role]={subnets:ids(r.subnets,'subnet',`stage3.network.${role}.subnets`),securityGroups:ids(r.securityGroups,'sg',`stage3.network.${role}.securityGroups`,{max:5})};}
 const r=record(n.runner,'stage3.network.runner',['subnet','securityGroups']);
 network.runner={subnet:ids([r.subnet],'subnet','stage3.network.runner.subnet')[0],securityGroups:ids(r.securityGroups,'sg','stage3.network.runner.securityGroups',{max:5})};
 return {taskDefinitions:{...t},services:{...sv},network};
}

/** Core-owned values. The identity credential is read from a local file path and copied byte-exact. */
export function parseCoreValues(raw){
 const c=record(raw,'core',['coreOrigin','frontendOrigin','tenantId','actorId','clientId','identityCredentialPath']);
 assertNoPending(c,'core');
 origin(c.coreOrigin,'core.coreOrigin');origin(c.frontendOrigin,'core.frontendOrigin');
 for(const k of ['tenantId','actorId'])if(typeof c[k]!=='string'||c[k].length<1||c[k].length>128)fail('RENDER_INPUT_REFUSED',`core.${k} must be 1..128 characters`);
 if(!uuid.test(c.clientId))fail('RENDER_INPUT_REFUSED','core.clientId must be a lowercase UUID');
 if(typeof c.identityCredentialPath!=='string'||!isAbsolute(c.identityCredentialPath))fail('RENDER_INPUT_REFUSED','core.identityCredentialPath must be an absolute local path');
 return {...c};
}

/** Meri-owned runtime bindings derived from the reviewed image and budget owner (not Core, not secret). */
export function parseRuntimeValues(raw){
 const r=record(raw,'runtime',['schemaVersion','versions','preparationIntent','allocation','runtime','qualification'],['plan','multiRun']);
 assertNoPending(r,'runtime');
 if(r.schemaVersion!==1)fail('RENDER_INPUT_REFUSED','runtime.schemaVersion must be 1');
 const v=record(r.versions,'runtime.versions',['sdk','cli','contracts','skillsDigest','checkpointFormat']);
 const p=record(r.preparationIntent,'runtime.preparationIntent',['configParentDirectory','secureStorageDirectory','launchTemplate','executableSha256','sdkOptionsSha256'],['runnerSha256']);
 for(const k of ['executableSha256','sdkOptionsSha256',...(p.runnerSha256===undefined?[]:['runnerSha256'])])if(!hex64.test(p[k]))fail('RENDER_INPUT_REFUSED',`runtime.preparationIntent.${k} must be 64 hex`);
 const lt=record(p.launchTemplate,'runtime.preparationIntent.launchTemplate',['command','args','env']);
 if(lt.env.NODE_EXTRA_CA_CERTS!==undefined&&lt.env.NODE_EXTRA_CA_CERTS!==RUNNER_SDK_CA_FILE)fail('RENDER_INPUT_REFUSED',`launchTemplate.env.NODE_EXTRA_CA_CERTS must be ${RUNNER_SDK_CA_FILE}`);
 if(lt.env.CLAUDE_SECURESTORAGE_CONFIG_DIR!==undefined&&lt.env.CLAUDE_SECURESTORAGE_CONFIG_DIR!==p.secureStorageDirectory)fail('RENDER_INPUT_REFUSED','launchTemplate.env.CLAUDE_SECURESTORAGE_CONFIG_DIR must equal secureStorageDirectory');
 const a=record(r.allocation,'runtime.allocation',['manifest','catalogSha256','scheduleRevision','operations']);
 if(!hex64.test(a.catalogSha256)||!hex64.test(a.scheduleRevision))fail('RENDER_INPUT_REFUSED','allocation catalogSha256/scheduleRevision must be 64 hex');
 const rt=record(r.runtime,'runtime.runtime',['maxTurns','maxOutputBytes']);
 const q=record(r.qualification,'runtime.qualification',['attempt','policyRevision']);
 if(!Number.isSafeInteger(q.attempt)||q.attempt<1||q.attempt>2147483647||!hex64.test(q.policyRevision))fail('RENDER_INPUT_REFUSED','qualification.attempt 1..2^31-1 and policyRevision 64 hex');
 if(r.multiRun!==undefined)record(r.multiRun,'runtime.multiRun',[],['runWindowMs']);
 return {versions:{...v},preparationIntent:{...p,launchTemplate:{command:lt.command,args:[...lt.args],env:{...lt.env}}},allocation:a,runtime:rt,qualification:{...q},plan:r.plan??DEFAULTS.plan,multiRun:r.multiRun??{}};
}

export function parseDeploymentInputs(raw){
 const d=record(raw,'deployment',['schemaVersion','account','region','clusterArn','vpcId','privateSubnetIds','images','foundation','privateEdge','names','proxyClientSubject','temporalClients','origins','temporal','issuer','database','checkpoint','model','secrets','pinsDer','pinsPem','core']);
 if(d.schemaVersion!==1||d.account!==ACCOUNT||d.region!==REGION)fail('RENDER_INPUT_REFUSED','deployment account/region');
 // Core-owned placeholders in deployment-inputs are superseded by the core values file; everything else must be final.
 const {core:_core,origins,...rest}=d;void _core;const {coreOrigin:_c,frontendOrigin:_f,...finalOrigins}=origins;void _c;void _f;
 assertNoPending({...rest,origins:finalOrigins},'deployment');
 const cluster=/^arn:aws:ecs:us-east-1:967807252336:cluster\/([A-Za-z0-9_-]{1,255})$/u.exec(d.clusterArn);if(!cluster)fail('RENDER_INPUT_REFUSED','deployment.clusterArn');
 if(d.model.pricingRevision!==PRODUCT_PROXY_PRICING_REVISION)fail('RENDER_INPUT_REFUSED','deployment.model.pricingRevision differs from the proxy PRICING_REVISION');
 const jwk=d.issuer.publicJwk,jwkSha=sha(JSON.stringify({kty:jwk.kty,kid:jwk.kid,alg:jwk.alg,use:jwk.use,n:jwk.n,e:jwk.e}));
 if(jwkSha!==d.issuer.publicJwkSha256||jwk.kid!==d.issuer.kid)fail('RENDER_INPUT_REFUSED','deployment.issuer.publicJwkSha256 does not match the canonical JWK');
 for(const commit of [d.images.nodeRuntimeSourceCommit,d.images.proxySourceCommit])if(!/^[a-f0-9]{40}$/u.test(commit))fail('RENDER_INPUT_REFUSED','image source commits must be 40 hex');
 imageDigest(d.images.nodeRuntime);imageDigest(d.images.proxy);
 return {...d,clusterName:cluster[1]};
}

/** Throwaway-free private reader: only certificate/key PEMs, pins.json and db-logins.json named here are read. */
const PKI_CERTS=['server-ca','issuer-server','proxy-server','control-private','issuer-client-ca','runner-ca','owner-bridge-ca','owner-server','proxy-owner-client',
 'temporal-frontend-ca','temporal-client-ca','temporal-client-control','temporal-client-worker'];
const PKI_KEYS=['issuer-server','proxy-server','issuer-client-ca','runner-ca','owner-server','proxy-owner-client','temporal-client-control','temporal-client-worker'];
export async function readPrivateDirectory(directory,{readBytes=readFile}={}){
 if(typeof directory!=='string'||!isAbsolute(directory))fail('RENDER_INPUT_REFUSED','private directory must be absolute');
 const certs={},keys={};
 for(const stem of PKI_CERTS)certs[stem]=await readBytes(join(directory,`${stem}.pem`));
 for(const stem of PKI_KEYS)keys[stem]=await readBytes(join(directory,`${stem}.key.pem`));
 const pins=JSON.parse((await readBytes(join(directory,'pins.json'))).toString('utf8'));
 const logins=JSON.parse((await readBytes(join(directory,'db-logins.json'))).toString('utf8'));
 return {certs,keys,pins,logins};
}

function password(logins,key,role){
 const v=logins?.[key];
 if(typeof v==='string'&&v.length>0)return v;
 if(v&&typeof v==='object'&&typeof v.password==='string'&&v.password.length>0){
  for(const name of ['username','user','role'])if(v[name]!==undefined&&v[name]!==role)fail('RENDER_PRIVATE_REFUSED',`db-logins.${key} names a different role`);
  return v.password;
 }
 fail('RENDER_PRIVATE_REFUSED',`db-logins.${key} has no password`);
}
const dsn=(role,secret,host,port,database)=>`postgresql://${encodeURIComponent(role)}:${encodeURIComponent(secret)}@${host}:${port}/${database}?sslmode=verify-full`;
const capabilityToken=()=>'meri-cap.'+randomBytes(32).toString('base64url');

/** Chain/SAN/key checks plus deployment pins. Returns DER/PEM pins and the earliest notAfter of every certificate used. */
function verifyPki(d,pki){
 const x={},pins={der:{},pem:{}};let notAfterMs=Number.MAX_SAFE_INTEGER;
 for(const stem of PKI_CERTS){
  let cert;try{cert=new X509Certificate(pki.certs[stem]);}catch{fail('RENDER_PRIVATE_REFUSED',`${stem}.pem is not a certificate`);}
  x[stem]=cert;pins.der[stem]=sha(cert.raw);pins.pem[stem]=sha(pki.certs[stem]);
  if(d.pinsDer[stem]!==pins.der[stem]||d.pinsPem[stem]!==pins.pem[stem])fail('RENDER_PRIVATE_REFUSED',`${stem} does not match deployment-inputs pins`);
  const p=pki.pins?.certificates?.[stem];if(!p||p.der!==pins.der[stem]||p.pem!==pins.pem[stem])fail('RENDER_PRIVATE_REFUSED',`${stem} does not match pins.json`);
  notAfterMs=Math.min(notAfterMs,Date.parse(cert.validTo));
 }
 const issued=(leaf,ca)=>{if(!x[leaf].checkIssued(x[ca])||!x[leaf].verify(x[ca].publicKey)||x[leaf].ca)fail('RENDER_PRIVATE_REFUSED',`${leaf} is not a leaf issued by ${ca}`);};
 for(const ca of ['server-ca','issuer-client-ca','runner-ca','owner-bridge-ca','temporal-frontend-ca','temporal-client-ca'])if(!x[ca].ca)fail('RENDER_PRIVATE_REFUSED',`${ca} is not a CA`);
 for(const [leaf,ca,san] of [['issuer-server','server-ca',d.names.issuer],['proxy-server','server-ca',d.names.proxy],['control-private','server-ca',d.names.control_private],['owner-server','owner-bridge-ca',d.names.owner]]){
  issued(leaf,ca);if(x[leaf].subjectAltName!==`DNS:${san}`)fail('RENDER_PRIVATE_REFUSED',`${leaf} SAN must be DNS:${san}`);}
 issued('proxy-owner-client','owner-bridge-ca');if(x['proxy-owner-client'].subject!==`CN=${d.proxyClientSubject}`)fail('RENDER_PRIVATE_REFUSED','proxy-owner-client subject');
 for(const role of ['control','worker']){issued(`temporal-client-${role}`,'temporal-client-ca');if(x[`temporal-client-${role}`].subject!==`CN=${d.temporalClients[role]}`)fail('RENDER_PRIVATE_REFUSED',`temporal-client-${role} subject`);}
 for(const stem of PKI_KEYS){
  let pub;try{pub=createPublicKey(createPrivateKey(pki.keys[stem])).export({type:'spki',format:'der'});}catch{fail('RENDER_PRIVATE_REFUSED',`${stem}.key.pem is not a private key`);}
  if(!pub.equals(x[stem].publicKey.export({type:'spki',format:'der'})))fail('RENDER_PRIVATE_REFUSED',`${stem}.key.pem does not match ${stem}.pem`);
 }
 return {pins,notAfterMs};
}

/** Git blob bytes are the image's raw entrypoint bytes (no newline conversion). */
export function runnerSha256AtCommit(commit,{sourceRoot=SOURCE_ROOT}={}){
 try{return sha(execFileSync('git',['-C',sourceRoot,'cat-file','blob',`${commit}:${productRunnerMeasurement.path}`],{maxBuffer:4*1024*1024,stdio:['ignore','pipe','ignore']}));}
 catch{return null;}
}

function expectedEnvelope(role,image,sourceCommit,files){
 const contract={schemaVersion:1,role,runtimeUser:RUNTIME_USERS[role],sourceCommit,imageDigest:'sha256:'+imageDigest(image),
  sha256ByPath:Object.fromEntries([...files].map(([path,bytes])=>[path,sha(bytes)]))};
 return {...contract,materialContractSha256:canonicalSha256(contract)};
}
const bundleOf=files=>({files:[...files].map(([path,bytes])=>({path,base64:Buffer.from(bytes).toString('base64')}))});

/** Same predicates as apps/runtime/cli.mjs main() for MERI_PRODUCT_PREVIEW_REQUIRED=1 (the CLI evaluates them inline). */
export function assertProductCliGates(role,c,environment){
 const common=c.temporal.authorization!==undefined&&c.temporal.tokenWriter?.enabled===true&&c.temporal.issuerDelivery!==undefined&&c.temporal.issuerBootstrap?.enabled===true;
 if(role==='control'&&!(common&&c.privateHttp!==undefined&&c.nativeCandidate!==undefined&&c.taskRouter?.enabled===true&&c.taskRouter.poststart?.enabled===true))fail('RENDER_GATE_REFUSED','PRODUCT_LISTENER_REFUSED');
 if(role==='temporal-worker'&&!(common&&c.native.preparedKickoff===true&&c.native.loopback===false&&c.native.origin.startsWith('https://')&&c.http.port===8081&&productWorkerTrustsPinnedServerCa(c,environment)))fail('RENDER_GATE_REFUSED','PRODUCT_WORKER_REFUSED');
}

/** Pure render (reads only the private material passed in). Returns every role's exact bytes plus the non-secret summary. */
export function renderMaterial({deployment,core,runtime,stage3,private:pki,identityCredential,nowMs=Date.now(),validityDays=DEFAULTS.validityDays,
 taskRouterZone=DEFAULTS.taskRouterZone,deploymentRevision=DEFAULTS.deploymentRevision,sourceRoot=SOURCE_ROOT}){
 const d=parseDeploymentInputs(deployment),k=parseCoreValues(core),r=parseRuntimeValues(runtime),s=parseStage3(stage3,{clusterName:d.clusterName});
 if(!Number.isSafeInteger(nowMs)||nowMs<1)fail('RENDER_INPUT_REFUSED','nowMs');
 if(!Number.isFinite(validityDays)||validityDays<=0)fail('RENDER_INPUT_REFUSED','validityDays must be positive');
 if(!/^[A-Za-z0-9_-]{1,128}$/u.test(deploymentRevision))fail('RENDER_INPUT_REFUSED','deploymentRevision');
 if(!Buffer.isBuffer(identityCredential)||identityCredential.length<1||identityCredential.length>32768)fail('RENDER_INPUT_REFUSED','identity credential must be 1..32768 bytes');
 if(identityCredential.toString('utf8').includes('PENDING_'))fail('RENDER_PENDING_VALUE','identity credential');
 const {pins,notAfterMs}=verifyPki(d,pki);
 // Absolute expiries. schedule/serviceTasks/pricing/proxy = now + validity; grants and the static deadline additionally
 // must stay <= startup now + maxRuntimeSeconds (native-allocation-admission), so they use min(validity, maxRuntime).
 const validityMs=Math.round(validityDays*DAY_MS),expiresAtMs=nowMs+validityMs;
 if(expiresAtMs>=notAfterMs)fail('RENDER_VALIDITY_REFUSED',`validity ends after the earliest certificate notAfter ${new Date(notAfterMs).toISOString()}`);
 const f=d.foundation,o=d.origins,controlPrivate=origin(d.privateEdge.controlPrivateOrigin,'privateEdge.controlPrivateOrigin');
 if(controlPrivate!==`https://${d.names.control_private}`)fail('RENDER_INPUT_REFUSED','control private origin must be https://names.control_private');
 const issuerOrigin=origin(o.issuerOrigin,'origins.issuerOrigin');
 if(issuerOrigin!==`https://${d.names.issuer}:8445`)fail('RENDER_INPUT_REFUSED','issuer origin must be https://names.issuer:8445');
 if(o.temporalAddress!==`${d.names.temporal_frontend}:7233`)fail('RENDER_INPUT_REFUSED','temporal address must be names.temporal_frontend:7233');
 if(o.proxyUrl!==`https://${d.names.proxy}:8443`||o.ownerOrigin!==`https://${d.names.owner}:8444`)fail('RENDER_INPUT_REFUSED','proxy/owner origins');
 const nodeImage=d.images.nodeRuntime,nodeDigest=imageDigest(nodeImage),proxyImage=d.images.proxy;
 // Runner measurement: an explicit value must equal the git blob at the image's source commit when that commit is present.
 const measured=runnerSha256AtCommit(d.images.nodeRuntimeSourceCommit,{sourceRoot});
 const runnerSha256=r.preparationIntent.runnerSha256??measured;
 if(!runnerSha256)fail('RENDER_INPUT_REFUSED','runnerSha256 is not supplied and the node runtime source commit is not available locally');
 if(measured&&measured!==runnerSha256)fail('RENDER_INPUT_REFUSED','runnerSha256 differs from apps/runtime/conversation-runner.mjs at the node runtime source commit');
 // The issuer pins each role's exact ENI security-group set (task-authority.mjs roles.<role>.securityGroupIds, sameSet with the
 // peer ENI) and one shared subnet list. Both are the Stage 3 service network values, so they cannot drift apart.
 const issuerSubnets=[...d.privateSubnetIds];
 for(const role of ['control','temporal-worker'])if(s.network[role].subnets.some(id=>!issuerSubnets.includes(id)))fail('RENDER_INPUT_REFUSED',`stage3.network.${role}.subnets must be within deployment privateSubnetIds`);
 if(!issuerSubnets.includes(s.network.runner.subnet))fail('RENDER_INPUT_REFUSED','stage3.network.runner.subnet must be one of deployment privateSubnetIds');

 // Fresh capability tokens and static binding.
 const tokens={task:capabilityToken(),control:capabilityToken(),proxy:capabilityToken()};
 const capabilityBytes=Object.fromEntries(Object.entries(tokens).map(([key,value])=>[key,Buffer.from(value,'utf8')]));
 const binding={tenantId:k.tenantId,actorId:k.actorId,conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1};
 const versions={imageDigest:'sha256:'+nodeDigest,...r.versions};
 const budgets=r.allocation.manifest.budgets;
 if(!budgets||!Number.isSafeInteger(budgets.maxRuntimeSeconds))fail('RENDER_INPUT_REFUSED','allocation.manifest.budgets.maxRuntimeSeconds');
 const runtimeMs=budgets.maxRuntimeSeconds*1000,grantExpiresAtMs=nowMs+Math.min(validityMs,runtimeMs);
 const runWindowMs=r.multiRun.runWindowMs??Math.min(runtimeMs,86400000);
 if(runWindowMs>runtimeMs)fail('RENDER_INPUT_REFUSED','multiRun.runWindowMs must be <= maxRuntimeSeconds*1000 (per-run admission refuses otherwise)');
 const allocation={run:{tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId},
  manifest:r.allocation.manifest,manifestSha256:canonicalSha256(r.allocation.manifest),catalogSha256:r.allocation.catalogSha256,budgets,
  schedule:{revision:r.allocation.scheduleRevision,expiresAt:new Date(expiresAtMs).toISOString(),operations:r.allocation.operations}};
 const taskGrantId=randomUUID(),modelGrantId=randomUUID();
 // prepared-candidate.mjs assertFirstRunGrantBindings: one intent for the task capability under grantId, one other for the proxy capability.
 const grantIntents=[{grantId:taskGrantId,capabilitySha256:sha(capabilityBytes.task),expiresAtMs:grantExpiresAtMs},
  {grantId:modelGrantId,capabilitySha256:sha(capabilityBytes.proxy),expiresAtMs:grantExpiresAtMs}];
 const policyRevision=r.qualification.policyRevision;
 const secureStorageDirectory=r.preparationIntent.secureStorageDirectory;
 const preparationIntent={workspace:`${DEFAULTS.workspaceRoot}/${binding.conversationId}`,configParentDirectory:r.preparationIntent.configParentDirectory,secureStorageDirectory,
  launchTemplate:{command:r.preparationIntent.launchTemplate.command,args:r.preparationIntent.launchTemplate.args,
   env:{...r.preparationIntent.launchTemplate.env,CLAUDE_SECURESTORAGE_CONFIG_DIR:secureStorageDirectory,NODE_EXTRA_CA_CERTS:RUNNER_SDK_CA_FILE}},
  executableSha256:r.preparationIntent.executableSha256,imageSha256:nodeDigest,runnerSha256,sdkOptionsSha256:r.preparationIntent.sdkOptionsSha256,
  authoritySha256:canonicalSha256({scopes:[{kind:'client',tenantId:binding.tenantId,resourceId:k.clientId,policyRevision}],selectedClientId:k.clientId,policyRevision})};
 const nativeCandidate={
  identity:{origin:k.coreOrigin,credentialFile:PATHS.identity,commandContext:{binding,clientResolution:{reference:k.clientId,clientId:k.clientId}}},
  runtime:{binding,versions,proxyUrl:o.proxyUrl,model:d.model.profileId,deadlineMs:grantExpiresAtMs,maxTurns:r.runtime.maxTurns,maxCostMicroUSD:d.model.perRunMaxCostMicroUSD,maxOutputBytes:r.runtime.maxOutputBytes},
  proxyCredentialFile:PATHS.proxyCapability,plan:r.plan,preparationIntent,allocationJson:JSON.stringify(allocation),
  qualification:{attempt:r.qualification.attempt,policyRevision},grantIntents,grantId:taskGrantId,
  operations:[...Object.keys(runOwnerOperations),...sdkSessionOperations.map(op=>'runner/session/'+op)],
  taskCapabilityFile:PATHS.taskCapability,controlCapabilityFile:PATHS.controlCapability,
  taskRequest:{cluster:d.clusterArn,taskDefinition:s.taskDefinitions.runner,
   networkConfiguration:{awsvpcConfiguration:{subnets:[s.network.runner.subnet],securityGroups:s.network.runner.securityGroups,assignPublicIp:'DISABLED'}},
   overrides:{containerOverrides:[{name:CONTAINER_NAMES.runner,command:['start'],environment:[]}]}},
  containerName:CONTAINER_NAMES.runner,taskOrigin:controlPrivate,taskHttp:{hostname:'0.0.0.0',port:8080,frontendOrigin:controlPrivate},
  objects:{bucket:d.checkpoint.bucket,prefix:d.checkpoint.prefix,expectedBucketOwner:ACCOUNT,kmsKeyId:d.checkpoint.kmsKeyArn},
  multiRun:{runWindowMs,materialDirectory:DEFAULTS.materialDirectory,dynamicInitialRuns:true}};

 const authorization={tokenFile:TEMPORAL_IDENTITY.tokenFile,namespace:d.temporal.namespace,audience:d.temporal.audience,issuer:issuerOrigin+'/',refreshMs:5000,maxLifetimeMs:60000};
 const revisionLabel=role=>`${role}-td${revisionOf(s.taskDefinitions[role])}`;
 const peer=role=>({peerSubjectCn:role==='control'?d.temporalClients.control:d.temporalClients.worker,peerUriBase:`spiffe://${d.names.issuer.split('.').slice(1).join('.')}/temporal/${role}/`});
 function temporal(role){
  const id=IDENTITIES[role],delivery={schemaVersion:1,issuerOrigin,namespace:d.temporal.namespace,audience:d.temporal.audience,identity:{role,...id},
   publicKey:{kid:d.issuer.kid,alg:'RS256',jwkSha256:d.issuer.publicJwkSha256,manifestFile:PATHS.issuerJwks},
   tls:{serverName:d.names.issuer,issuerCaFile:PATHS.issuerCa,clientCertFile:TEMPORAL_IDENTITY.certFile,clientKeyFile:TEMPORAL_IDENTITY.keyFile},requestTimeoutMs:3000,maxReplyBytes:16384};
  return {address:o.temporalAddress,namespace:d.temporal.namespace,taskQueue:d.temporal.taskQueue,tls:{caFile:PATHS.temporalCa,certFile:PATHS.temporalCert,keyFile:PATHS.temporalKey},
   authorization,tokenWriter:{enabled:true,role,...id,maxRequestMs:5000,authorization},issuerDelivery:delivery,
   issuerBootstrap:{enabled:true,configuration:{schemaVersion:1,role,clusterArn:d.clusterArn,revision:revisionLabel(role),issuerOrigin,serverName:d.names.issuer,...peer(role),
    serverCaSha256:pins.der['server-ca'],clientCaSha256:pins.der['issuer-client-ca'],requestTimeoutMs:12000,totalTimeoutMs:30000,maxReplyBytes:16384},
    serverCaFile:PATHS.issuerCa,clientCaFile:PATHS.issuerClientCa,directory:TEMPORAL_IDENTITY.directory,keyFile:TEMPORAL_IDENTITY.keyFile,certFile:TEMPORAL_IDENTITY.certFile}};
 }
 const limits={startupMs:30000,shutdownMs:10000,requestMs:3000,requestBytes:131072};
 const control={version:1,profile:'isolated-preview',sourceEnabled:false,limits,
  native:{origin:controlPrivate,capabilityFile:PATHS.controlCapability,loopback:false,maxResponseBytes:2097152},
  http:{hostname:'0.0.0.0',port:8080,frontendOrigin:k.frontendOrigin},database:{connectionFile:PATHS.database},temporal:temporal('control'),
  sessions:{mode:'process-local',replicas:1,maxSessions:100,maxTtlMs:300000},versions,nativeCandidate,
  privateHttp:{hostname:'0.0.0.0',port:8082,frontendOrigin:controlPrivate},
  taskRouter:{enabled:true,runnerCaFile:PATHS.runnerCa,zone:taskRouterZone,vpcId:d.vpcId,poststart:{enabled:true,runnerCaKeyFile:PATHS.runnerCaKey,controlCaFile:PATHS.controlCa}}};
 const worker={version:1,profile:'isolated-preview',sourceEnabled:false,limits,
  native:{origin:controlPrivate,capabilityFile:PATHS.controlCapability,loopback:false,maxResponseBytes:2097152,preparedKickoff:true},
  http:{hostname:'0.0.0.0',port:8081,frontendOrigin:k.frontendOrigin},temporal:temporal('temporal-worker')};

 const db=d.database,logins=pki.logins;
 const controlDsn=Buffer.from(dsn(db.roles.control,password(logins,'control',db.roles.control),db.host,db.port,db.database));
 const ownerDsn=Buffer.from(dsn(db.roles.owner,password(logins,'modelOwner',db.roles.owner),db.host,db.port,db.database));
 const issuerDsn=Buffer.from(dsn(db.roles.issuer,password(logins,'issuer',db.roles.issuer),db.host,db.port,db.database));
 const jwks=Buffer.from(JSON.stringify({keys:[d.issuer.publicJwk]}));
 // allowPrimaryInProgress: control and worker bootstrap their Temporal identity during their own startup, while their
 // service's PRIMARY deployment is still IN_PROGRESS. Control is attached to target groups, so ECS can only mark its
 // rollout COMPLETED once control is healthy, which needs this certificate first; requiring COMPLETED deadlocks every
 // fresh deployment (observed live 2026-10-17). Task identity, revision, image, roles and SGs are still exact.
 const issuerRolePin=role=>({subject:IDENTITIES[role].subject,workloadPrincipal:IDENTITIES[role].workloadPrincipal,...peer(role),
  serviceArn:s.services[role],taskDefinitionArn:s.taskDefinitions[role],containerName:CONTAINER_NAMES[role],imageUri:nodeImage,
  taskRoleArn:role==='control'?f.ControlTaskRoleArn:null,executionRoleArn:role==='control'?f.ControlExecutionRoleArn:f.WorkerExecutionRoleArn,revision:revisionLabel(role),
  securityGroupIds:s.network[role].securityGroups,allowPrimaryInProgress:true});
 const issuer={schemaVersion:1,database:{connectionFile:PATHS.issuerDatabase,connectionSha256:sha(issuerDsn)},
  issuer:{schemaVersion:1,service:{schemaVersion:1,issuerOrigin,kid:d.issuer.kid,namespace:d.temporal.namespace,audience:d.temporal.audience,maxRequestMs:5000,bootstrapMaxRequestMs:10000,maxBodyBytes:4096,currentnessLeaseMs:20000},
   taskAuthority:{schemaVersion:1,clusterArn:d.clusterArn,vpcId:d.vpcId,privateSubnetIds:issuerSubnets,maxLeaseMs:8000,
    roles:{control:issuerRolePin('control'),'temporal-worker':issuerRolePin('temporal-worker')}},
   signer:{schemaVersion:1,keyArn:d.issuer.signingKeyArn,kid:d.issuer.kid,publicJwk:d.issuer.publicJwk,publicJwkSha256:d.issuer.publicJwkSha256},
   listen:{host:'0.0.0.0',port:8445},tls:{keyFile:PATHS.issuerServerKey,certFile:PATHS.issuerServerCert,caFile:PATHS.issuerClientCa},
   bootstrap:{caKeyFile:PATHS.issuerClientCaKey,caSha256:pins.der['issuer-client-ca']},registrationRole:d.issuer.registrationRole,startupTimeoutMs:60000}};
 if(issuer.issuer.registrationRole!==db.roles.issuer)fail('RENDER_INPUT_REFUSED','issuer.registrationRole must equal database.roles.issuer');

 const pairPin=(role,image,taskRole,executionRole)=>({clusterArn:d.clusterArn,serviceArn:s.services[role],taskDefinitionArn:s.taskDefinitions[role],containerName:CONTAINER_NAMES[role],
  imageUri:image,taskRoleArn:taskRole,executionRoleArn:executionRole,vpcId:d.vpcId,subnetIds:s.network[role].subnets,securityGroupIds:s.network[role].securityGroups});
 const serviceTasks={schemaVersion:2,deploymentRevision,expiresAtMs,ownerCertSha256:pins.der['owner-server'],proxyCertSha256:pins.der['proxy-owner-client'],
  owner:pairPin('model-owner',nodeImage,f.OwnerTaskRoleArn,f.OwnerExecutionRoleArn),proxy:pairPin('model-proxy',proxyImage,f.ProxyTaskRoleArn,f.ProxyExecutionRoleArn)};
 const controlBytes=Buffer.from(JSON.stringify(control));
 const owner={schemaVersion:1,sourceEnabled:false,enabled:true,controlConfigurationFile:PATHS.control,controlConfigurationSha256:sha(controlBytes),nativeCredentialFileSha256:sha(identityCredential),
  tls:{origin:o.ownerOrigin,serverName:d.names.owner,caFile:PATHS.ownerCa,certFile:PATHS.ownerCert,keyFile:PATHS.ownerKey,certSha256:pins.der['owner-server'],issuerSha256:pins.der['owner-bridge-ca']},
  clientPolicy:{clientCertSha256:pins.der['proxy-owner-client'],clientSubject:d.proxyClientSubject,deploymentRevision,issuerSha256:pins.der['owner-bridge-ca'],selectedClientId:k.clientId},
  serviceTasks,pricing:{modelId:d.model.modelId,profileId:d.model.profileId,revision:d.model.pricingRevision,validUntilMs:expiresAtMs,
   actualInputMicroUSDPerK:d.model.actualInputMicroUSDPerK,reserveInputMicroUSDPerK:d.model.reserveInputMicroUSDPerK,outputMicroUSDPerK:d.model.outputMicroUSDPerK,
   maxInputTokens:d.model.maxInputTokens,maxOutputTokens:d.model.maxOutputTokens},
  limits:{maxRequestMs:3000,maxFactBytes:131072,maxLeaseMs:30000}};
 const ref=(path,bytes)=>({path,sha256:sha(bytes)});
 const proxy={schemaVersion:1,enabled:true,deploymentRevision,expiresAtMs,pricingRevision:PRODUCT_PROXY_PRICING_REVISION,
  serverTls:{certificateFile:ref(PATHS.proxyServerCert,pki.certs['proxy-server']),privateKeyFile:ref(PATHS.proxyServerKey,pki.keys['proxy-server']),certificateSha256:pins.der['proxy-server']},
  ownerPeer:{origin:o.ownerOrigin,server_name:d.names.owner,server_cert_sha256:pins.der['owner-server'],server_issuer_sha256:pins.der['owner-bridge-ca'],
   client_cert_sha256:pins.der['proxy-owner-client'],client_subject:d.proxyClientSubject,max_exchange_ms:3000},
  ownerTls:{caFile:ref(PATHS.proxyOwnerCa,pki.certs['owner-bridge-ca']),certificateFile:ref(PATHS.proxyOwnerCert,pki.certs['proxy-owner-client']),privateKeyFile:ref(PATHS.proxyOwnerKey,pki.keys['proxy-owner-client'])},
  serviceTasks};

 const configs={control,'temporal-worker':worker,'temporal-issuer':issuer,'model-owner':owner,'model-proxy':proxy};
 const configBytes={control:controlBytes,...Object.fromEntries(Object.entries(configs).filter(([role])=>role!=='control').map(([role,value])=>[role,Buffer.from(JSON.stringify(value))]))};
 const temporalFiles=role=>[[PATHS.temporalCa,pki.certs['temporal-frontend-ca']],[PATHS.temporalCert,pki.certs[`temporal-client-${role==='control'?'control':'worker'}`]],
  [PATHS.temporalKey,pki.keys[`temporal-client-${role==='control'?'control':'worker'}`]],[PATHS.issuerJwks,jwks],[PATHS.issuerCa,pki.certs['server-ca']],[PATHS.issuerClientCa,pki.certs['issuer-client-ca']]];
 const files={
  control:new Map([[PATHS.control,controlBytes],[PATHS.database,controlDsn],[PATHS.identity,identityCredential],[PATHS.taskCapability,capabilityBytes.task],
   [PATHS.controlCapability,capabilityBytes.control],[PATHS.proxyCapability,capabilityBytes.proxy],...temporalFiles('control'),
   [PATHS.runnerCa,pki.certs['runner-ca']],[PATHS.runnerCaKey,pki.keys['runner-ca']],[PATHS.controlCa,pki.certs['server-ca']]]),
  'temporal-worker':new Map([[PATHS.worker,configBytes['temporal-worker']],[PATHS.controlCapability,capabilityBytes.control],...temporalFiles('temporal-worker')]),
  'temporal-issuer':new Map([[PATHS.issuer,configBytes['temporal-issuer']],[PATHS.issuerDatabase,issuerDsn],[PATHS.issuerServerKey,pki.keys['issuer-server']],
   [PATHS.issuerServerCert,pki.certs['issuer-server']],[PATHS.issuerClientCa,pki.certs['issuer-client-ca']],[PATHS.issuerClientCaKey,pki.keys['issuer-client-ca']]]),
  // The owner reads control.json's database path and identity credential; its database file carries the owner login.
  'model-owner':new Map([[PATHS.owner,configBytes['model-owner']],[PATHS.control,controlBytes],[PATHS.database,ownerDsn],[PATHS.identity,identityCredential],
   [PATHS.ownerCa,pki.certs['owner-bridge-ca']],[PATHS.ownerCert,pki.certs['owner-server']],[PATHS.ownerKey,pki.keys['owner-server']]]),
  'model-proxy':new Map([[PATHS.proxy,configBytes['model-proxy']],[PATHS.proxyServerCert,pki.certs['proxy-server']],[PATHS.proxyServerKey,pki.keys['proxy-server']],
   [PATHS.proxyOwnerCa,pki.certs['owner-bridge-ca']],[PATHS.proxyOwnerCert,pki.certs['proxy-owner-client']],[PATHS.proxyOwnerKey,pki.keys['proxy-owner-client']]])};
 const image=role=>role==='model-proxy'?[proxyImage,d.images.proxySourceCommit]:[nodeImage,d.images.nodeRuntimeSourceCommit];
 const roles={};
 for(const role of ROLES){
  const [img,commit]=image(role),expected=expectedEnvelope(role,img,commit,files[role]),bundle=bundleOf(files[role]);
  roles[role]={config:configs[role],configBytes:configBytes[role],configSha256:sha(configBytes[role]),configPath:{control:PATHS.control,'temporal-worker':PATHS.worker,'temporal-issuer':PATHS.issuer,'model-owner':PATHS.owner,'model-proxy':PATHS.proxy}[role],
   expected,bundle,image:img,sourceCommit:commit};
 }
 const workerEnvironment={NODE_EXTRA_CA_CERTS:PATHS.issuerCa};
 validateRendered(roles,{workerEnvironment});
 const summary=summarize({d,k,r,s,roles,pins,binding,nativeCandidate,taskGrantId,modelGrantId,grantExpiresAtMs,expiresAtMs,nowMs,validityDays,notAfterMs,runtimeMs,runWindowMs,
  taskRouterZone,deploymentRevision,controlPrivate,workerEnvironment,runnerSha256,policyRevision,allocation});
 return {roles,summary};
}

/** The material is Linux material: validators that use node:path (preparation-intent, config file checks) must see POSIX path
 * semantics, which on a Windows review host means temporarily binding node:path to path.posix around a SYNCHRONOUS body.
 * On Linux this is the identity. No IO or await may happen inside fn. */
export function withPosixPaths(fn){
 if(nodePath===nodePath.posix)return fn();
 const saved={};for(const [key,value] of Object.entries(nodePath.posix))if(typeof value==='function'){saved[key]=nodePath[key];nodePath[key]=value;}
 syncBuiltinESMExports();
 try{const result=fn();if(result&&typeof result.then==='function')throw Error('withPosixPaths body must be synchronous');return result;}
 finally{Object.assign(nodePath,saved);syncBuiltinESMExports();}
}
/** Every repository validator and material plan, on the exact rendered bytes. Throws on the first refusal. */
export function validateRendered(roles,options){return withPosixPaths(()=>validateRenderedLinux(roles,options));}
function validateRenderedLinux(roles,{workerEnvironment}){
 const parse=role=>JSON.parse(roles[role].configBytes.toString('utf8'));
 for(const role of ['control','temporal-worker']){
  const c=parse(role);
  try{validateConfiguration(c,role);}catch(error){fail('RENDER_VALIDATION_REFUSED',`${role} validateConfiguration ${error.code??error.message}`);}
  assertProductCliGates(role,c,workerEnvironment);
  if(role==='control'){
   try{compilePreparedCandidateConfiguration(c.nativeCandidate,c.versions);compileControlTaskRouterConfiguration(c);}catch(error){fail('RENDER_VALIDATION_REFUSED',`control prepared candidate ${error.message}`);}
  }
 }
 try{parseTemporalIssuerRuntimeConfiguration(parse('temporal-issuer'));}catch(error){fail('RENDER_VALIDATION_REFUSED',`temporal-issuer ${error.code??error.message}`);}
 try{const o=validateProductOwnerConfiguration(parse('model-owner'));if(o.enabled!==true)fail('RENDER_VALIDATION_REFUSED','owner disabled');}catch(error){fail('RENDER_VALIDATION_REFUSED',`model-owner ${error.message}`);}
 try{parseProductProxyStartupConfiguration(parse('model-proxy'));}catch(error){fail('RENDER_VALIDATION_REFUSED',`model-proxy ${error.message}`);}
 for(const role of ROLES){
  const controlConfiguration=role==='model-owner'?parse('control'):undefined;
  let plan;try{plan=compileProductMaterialPlan({role,configuration:parse(role),runtimeUser:RUNTIME_USERS[role],...(controlConfiguration?{controlConfiguration}:{})});}
  catch(error){fail('RENDER_VALIDATION_REFUSED',`${role} material plan ${error.code??error.message}`);}
  const paths=plan.requiredFiles.map(file=>file.path).sort(),delivered=Object.keys(roles[role].expected.sha256ByPath).sort();
  if(JSON.stringify(paths)!==JSON.stringify(delivered))fail('RENDER_VALIDATION_REFUSED',`${role} inventory differs from the plan`);
  try{validateStaticProductDelivery({expected:roles[role].expected,bundle:roles[role].bundle});}catch(error){fail('RENDER_VALIDATION_REFUSED',`${role} static delivery ${error.code??error.message}`);}
  const expectedBytes=Buffer.byteLength(JSON.stringify(roles[role].expected),'utf8'),bundleBytes=Buffer.byteLength(JSON.stringify(roles[role].bundle),'utf8');
  if(expectedBytes>8192||bundleBytes>65536)fail('RENDER_VALIDATION_REFUSED',`${role} expected ${expectedBytes}/8192 or bundle ${bundleBytes}/65536 bytes`);
  if(roles[role].configBytes.length>32768)fail('RENDER_VALIDATION_REFUSED',`${role} config exceeds 32768 bytes`);
 }
}

function summarize(x){
 const {d,s,roles,pins}=x,env=(name,value)=>({name,value});
 const init=role=>({containerName:'material-init',image:role==='model-proxy'?d.images.nodeRuntime:roles[role].image,user:role==='model-proxy'?'0:0':RUNTIME_USERS[role],
  entryPoint:['node','apps/runtime/material-init-cli.mjs'],command:['write'],
  environment:[env('MERI_STATIC_MATERIAL_EXPECTED',JSON.stringify(roles[role].expected))],
  secrets:[{name:'MERI_STATIC_MATERIAL_BUNDLE',valueFrom:`${d.secrets[{control:'control/material','temporal-worker':'worker/material','temporal-issuer':'issuer/material','model-owner':'owner/material','model-proxy':'proxy/material'}[role]]}:::<VersionId of the PutSecretValue with ${role}/bundle.json>`}]});
 const wiring={
  control:{family:s.taskDefinitions.control,containerName:'control',image:roles.control.image,user:'1000:1000',entryPoint:['node','apps/runtime/cli.mjs'],command:['control','--config',PATHS.control],
   environment:[env('MERI_PRODUCT_PREVIEW_REQUIRED','1')],ports:[8080,8082],volumes:{'/run/meri':'material (read-only)','/run/meri-temporal':'temporal-token (writable, empty)','/tmp':'tmp (writable; holds multiRun.materialDirectory)','/workspace':'workspace'},init:init('control')},
  'temporal-worker':{family:s.taskDefinitions['temporal-worker'],containerName:'temporal-worker',image:roles['temporal-worker'].image,user:'1000:1000',entryPoint:['node','apps/runtime/cli.mjs'],command:['temporal-worker','--config',PATHS.worker],
   environment:[env('MERI_PRODUCT_PREVIEW_REQUIRED','1'),env('NODE_EXTRA_CA_CERTS',x.workerEnvironment.NODE_EXTRA_CA_CERTS)],ports:[8081],volumes:{'/run/meri':'material (read-only)','/run/meri-temporal':'temporal-token (writable, empty)'},init:init('temporal-worker')},
  'temporal-issuer':{family:s.taskDefinitions['temporal-issuer'],containerName:'temporal-issuer',image:roles['temporal-issuer'].image,user:'1000:1000',entryPoint:['node','apps/runtime/temporal-issuer-cli.mjs'],
   command:['--config',PATHS.issuer,'--config-sha256',roles['temporal-issuer'].configSha256],environment:[env('MERI_TEMPORAL_ISSUER_REQUIRED','1')],ports:[8445],volumes:{'/run/meri':'material (read-only)'},init:init('temporal-issuer')},
  'model-owner':{family:s.taskDefinitions['model-owner'],containerName:'model-owner',image:roles['model-owner'].image,user:'1000:1000',entryPoint:['node','apps/proxy/product/owner-entrypoint.mjs'],command:['--config',PATHS.owner],
   environment:[env('MERI_PRODUCT_OWNER_REQUIRED','1'),env('MERI_PRODUCT_OWNER_CONFIG_SHA256',roles['model-owner'].configSha256)],ports:[8444],volumes:{'/run/meri':'material (read-only)'},init:init('model-owner')},
  'model-proxy':{family:s.taskDefinitions['model-proxy'],containerName:'model-proxy',image:roles['model-proxy'].image,user:'10001:10001',command:['--config',PATHS.proxy,'--config-sha256',roles['model-proxy'].configSha256],
   environment:[env('MERI_PRODUCT_PROXY_REQUIRED','1')],ports:[8443],volumes:{'/run/meri':'material (read-only)'},init:init('model-proxy')},
  runner:{family:s.taskDefinitions.runner,containerName:CONTAINER_NAMES.runner,image:d.images.nodeRuntime,user:'1000:1000',entryPoint:['node','apps/runtime/runner-poststart-cli.mjs'],command:['start'],
   environment:[env('MERI_RUNNER_SHA256',x.runnerSha256),env('MERI_PRODUCT_PREVIEW_REQUIRED','1'),env('MERI_POSTSTART_CONTROL_ORIGIN',x.controlPrivate),
    env('MERI_POSTSTART_CA_BASE64',roles.control.bundle.files.find(f=>f.path===PATHS.controlCa).base64),env('MERI_POSTSTART_CA_SHA256',pins.pem['server-ca'])],ports:[8080]}};
 return {schemaVersion:1,generatedAtMs:x.nowMs,
  validity:{validityDays:x.validityDays,notAfterMs:x.expiresAtMs,notAfter:new Date(x.expiresAtMs).toISOString(),grantAndDeadlineMs:x.grantExpiresAtMs,
   earliestCertificateNotAfter:new Date(x.notAfterMs).toISOString(),
   maxima:{scheduleExpiresAt:'no validator upper bound (Date.parse); past value refuses new chats',serviceTasksAndPricing:'> owner/proxy startup now, <= 9007199254740991 (Python proxy bound)',
    grantIntentsAndDeadline:`<= control/owner startup Date.now() + budgets.maxRuntimeSeconds*1000 (${x.runtimeMs} ms); a past value is accepted`,
    runWindowMs:`60000..min(86400000, maxRuntimeSeconds*1000) = ${x.runWindowMs}`,certificates:'every value is capped below the earliest certificate notAfter'}},
  roles:Object.fromEntries(ROLES.map(role=>[role,{configPath:roles[role].configPath,configSha256:roles[role].configSha256,materialContractSha256:roles[role].expected.materialContractSha256,
   fileCount:roles[role].bundle.files.length,bundleBytes:Buffer.byteLength(JSON.stringify(roles[role].bundle)),expectedBytes:Buffer.byteLength(JSON.stringify(roles[role].expected)),
   runtimeUser:RUNTIME_USERS[role],imageDigest:roles[role].expected.imageDigest,sourceCommit:roles[role].sourceCommit,taskDefinitionArn:s.taskDefinitions[role],
   sha256ByPath:roles[role].expected.sha256ByPath}])),
  taskDefinitionConfigPins:{MERI_PRODUCT_OWNER_CONFIG_SHA256:roles['model-owner'].configSha256,proxyConfigSha256:roles['model-proxy'].configSha256,issuerConfigSha256:roles['temporal-issuer'].configSha256,
   controlConfigSha256:roles.control.configSha256,workerConfigSha256:roles['temporal-worker'].configSha256},
  runnerPoststart:{MERI_POSTSTART_CONTROL_ORIGIN:x.controlPrivate,MERI_POSTSTART_CA_BASE64:wiring.runner.environment[3].value,MERI_POSTSTART_CA_SHA256:pins.pem['server-ca'],
   MERI_RUNNER_SHA256:x.runnerSha256,launchTemplateNodeExtraCaCerts:RUNNER_SDK_CA_FILE},
  worker:{NODE_EXTRA_CA_CERTS:x.workerEnvironment.NODE_EXTRA_CA_CERTS},
  taskRouter:{zone:x.taskRouterZone,runnerLeafSan:`<32-hex ECS task id>.${x.taskRouterZone}`,dns:'not required: control connects to the task private IPv4 with SNI = the SAN (runner-tls-client.mjs)'},
  deploymentRevision:x.deploymentRevision,
  staticCandidate:{binding:x.binding,clientId:x.k.clientId,policyRevision:x.policyRevision,qualificationAttempt:x.r.qualification.attempt,
   taskGrantId:x.taskGrantId,modelGrantId:x.modelGrantId,grantCapabilitySha256:x.nativeCandidate.grantIntents.map(g=>({grantId:g.grantId,capabilitySha256:g.capabilitySha256})),
   allocationSha256:canonicalSha256(x.allocation),manifestSha256:x.allocation.manifestSha256,runWindowMs:x.runWindowMs},
  pinsDer:pins.der,pinsPem:pins.pem,wiring};
}

/** Writes into a NEW directory that must be outside the repository. Files are 0600, directories 0700. */
export async function writeRendered(out,{roles,summary},{sourceRoot=SOURCE_ROOT}={}){
 const target=resolve(out),rel=relative(sourceRoot,target);
 if(!rel||!rel.startsWith('..')&&!isAbsolute(rel))fail('RENDER_OUTPUT_REFUSED','output directory must be outside the repository');
 try{await lstat(target);fail('RENDER_OUTPUT_REFUSED','output directory already exists');}catch(error){if(error.code==='RENDER_OUTPUT_REFUSED')throw error;}
 await mkdir(target,{recursive:false,mode:0o700});
 const put=(path,text)=>writeFile(path,text,{mode:0o600,flag:'wx'});
 for(const role of ROLES){
  const dir=join(target,role);await mkdir(dir,{mode:0o700});
  await put(join(dir,'config.json'),roles[role].configBytes);
  await put(join(dir,'bundle.json'),JSON.stringify(roles[role].bundle));
  await put(join(dir,'expected.json'),JSON.stringify(roles[role].expected));
 }
 await put(join(target,'summary.json'),JSON.stringify(summary,null,1)+'\n');
 return target;
}

const USAGE=`Usage: node infra/product-preview/first-chat/render-material.mjs \\
  --deployment-inputs infra/product-preview/first-chat/deployment-inputs.json --private <pki-dir> \\
  --core <core-values.json> --runtime <runtime-values.json> --stage3 <stage3.json> --out <new-dir-outside-repo> \\
  [--validity-days 7] [--now-ms <epoch ms>] [--zone runner.meri.internal] [--deployment-revision first-chat-preview-1]
Prints only the non-secret summary path and config hashes. Exit 0 rendered; 2 arguments/inputs/validation refused.`;
export async function main(argv=process.argv.slice(2)){
 if(argv.length===0||argv.includes('--help')){process.stdout.write(USAGE+'\n');return argv.length?0:2;}
 const a={};for(let i=0;i<argv.length;i+=2){if(!argv[i].startsWith('--')||argv[i+1]===undefined){process.stderr.write(USAGE+'\n');return 2;}a[argv[i].slice(2)]=argv[i+1];}
 const json=async path=>JSON.parse(await readFile(path,'utf8'));
 try{
  for(const key of ['deployment-inputs','private','core','runtime','stage3','out'])if(!a[key])fail('RENDER_ARGUMENTS',`--${key} is required`);
  const core=await json(a.core),pki=await readPrivateDirectory(resolve(a.private));
  const rendered=renderMaterial({deployment:await json(a['deployment-inputs']),core,runtime:await json(a.runtime),stage3:await json(a.stage3),private:pki,
   identityCredential:await readFile(parseCoreValues(core).identityCredentialPath),
   ...(a['now-ms']?{nowMs:Number(a['now-ms'])}:{}),...(a['validity-days']?{validityDays:Number(a['validity-days'])}:{}),
   ...(a.zone?{taskRouterZone:a.zone}:{}),...(a['deployment-revision']?{deploymentRevision:a['deployment-revision']}:{})});
  const out=await writeRendered(a.out,rendered);
  process.stdout.write(JSON.stringify({status:'MERI_FIRST_CHAT_MATERIAL_RENDERED',out,summary:join(out,'summary.json'),configSha256:rendered.summary.taskDefinitionConfigPins})+'\n');
  return 0;
 }catch(error){
  // Only fixed codes and field paths: no material, password or token is ever part of a message.
  const message=typeof error?.code==='string'&&/^RENDER_/u.test(error.code)?error.message:
   typeof error?.code==='string'&&/^E[A-Z]+$/u.test(error.code)&&typeof error.path==='string'?`RENDER_INPUT_UNREADABLE ${error.code} ${error.path}`:
   error instanceof SyntaxError?'RENDER_INPUT_REFUSED: an input file is not JSON':'RENDER_REFUSED';
  process.stderr.write(message+'\n');return 2;
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await main();
