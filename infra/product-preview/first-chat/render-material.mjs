#!/usr/bin/env node
/** Render the shared AgentCore control and native Temporal worker material.
 * User identity is request-scoped and admitted by Core, never a deployment seed.
 * Private inputs remain local and are never written inside the checkout. */
import {createHash,createPrivateKey,createPublicKey,randomBytes,X509Certificate} from 'node:crypto';
import {readFile,mkdir,writeFile,lstat} from 'node:fs/promises';
import nodePath,{join,relative,resolve,isAbsolute} from 'node:path';
import {syncBuiltinESMExports} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {assertModelCatalog} from '../../../packages/contracts/model-selection.mjs';
import {validateConfiguration} from '../../../apps/runtime/config.mjs';
import {productWorkerTrustsPinnedServerCa} from '../../../apps/runtime/cli.mjs';
import {CONTROL_NODE_CA_FILE,productControlTrustsCompositeCa} from '../../../apps/runtime/control-ca-bundle.mjs';
import {compileAgentCoreConfiguration} from '../../../apps/runtime/agentcore-configuration.mjs';
import {compileProductMaterialPlan} from '../../../apps/runtime/material-init-plan.mjs';
import {validateStaticProductDelivery} from '../../../apps/runtime/material-init.mjs';
import {compileCapabilityPlatform,createConfiguredRunCapabilityPolicy} from '../../../apps/runtime/product-ports/capability-policy.mjs';
import {compileRuntimeArtifactsConfiguration} from '../../../apps/runtime/artifacts/configuration.mjs';
import {compileObjectiveGenerationConfiguration} from '../../../apps/runtime/objective-generation/configuration.mjs';
import {assertNativeReadConfiguration} from '../../../packages/contracts/runtime-0.2/reads.mjs';
import {compileIntentsConfiguration} from '../../../apps/runtime/product-ports/intents.mjs';
import {compileRoutinesCoreConfiguration} from '../../../apps/runtime/native-authority/routines-configuration.mjs';

export const SOURCE_ROOT=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const ACCOUNT='967807252336',REGION='us-east-1',ECS=`arn:aws:ecs:${REGION}:${ACCOUNT}:`;
export const ROLES=Object.freeze(['control','temporal-worker']);
export const RUNTIME_USERS=Object.freeze({control:'1000:1000','temporal-worker':'1000:1000'});
export const CONTAINER_NAMES=Object.freeze({control:'control','temporal-worker':'temporal-worker'});
/** Task-local /run/meri inventory. Every path is a direct child, as material-init-plan requires. */
export const PATHS=Object.freeze({
 control:'/run/meri/control.json',worker:'/run/meri/worker.json',
 database:'/run/meri/database.uri',
 controlCapability:'/run/meri/control-capability',
 temporalCa:'/run/meri/temporal-ca.pem',temporalCert:'/run/meri/temporal-client.pem',temporalKey:'/run/meri/temporal-client.key',
 serverCa:'/run/meri/control-ca.pem',
 // Delivered only when the matching feature is rendered (control only).
 readsServiceSecret:'/run/meri/core-service-secret',readsReadModeServiceSecret:'/run/meri/core-read-mode-service-secret',
 downloadLinkKey:'/run/meri/download-link.key'});
const DAY_MS=86400000;
/** Defaults for bounded timing values. Each is inside the validator range it is named after. */
export const DEFAULTS=Object.freeze({validityDays:7,deploymentRevision:'first-chat-preview-1'});

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
 const t=record(s.taskDefinitions,'stage3.taskDefinitions',[...ROLES]);
 for(const role of Object.keys(t))taskDefinitionArn(t[role],`stage3.taskDefinitions.${role}`);
 if(new Set(Object.values(t)).size!==Object.keys(t).length)fail('RENDER_INPUT_REFUSED','task definitions must be distinct');
 const sv=record(s.services,'stage3.services',['control','temporal-worker']);
 for(const role of Object.keys(sv))serviceArn(sv[role],clusterName,`stage3.services.${role}`);
 if(new Set(Object.values(sv)).size!==Object.keys(sv).length)fail('RENDER_INPUT_REFUSED','services must be distinct');
 const n=record(s.network,'stage3.network',['control','temporal-worker']);
 const network={};
 for(const role of ['control','temporal-worker']){const r=record(n[role],`stage3.network.${role}`,['subnets','securityGroups']);
  network[role]={subnets:ids(r.subnets,'subnet',`stage3.network.${role}.subnets`),securityGroups:ids(r.securityGroups,'sg',`stage3.network.${role}.securityGroups`,{max:5})};}
 return {taskDefinitions:{...t},services:{...sv},network};
}

/** Core origins only. User credentials and scope are supplied by authenticated requests. */
export function parseCoreValues(raw){
 const c=record(raw,'core',['coreOrigin','frontendOrigin']);assertNoPending(c,'core');
 origin(c.coreOrigin,'core.coreOrigin');origin(c.frontendOrigin,'core.frontendOrigin');return {...c};
}

/** Immutable source versions and the explicit run/output policy, without task grants. */
export function parseRuntimeValues(raw){
 const r=record(raw,'runtime',['schemaVersion','versions','runtime','policyRevision','models']);assertNoPending(r,'runtime');
 if(r.schemaVersion!==2)fail('RENDER_INPUT_REFUSED','runtime.schemaVersion must be 2');
 const v=record(r.versions,'runtime.versions',['sdk','cli','contracts','skillsDigest','checkpointFormat']);
 const rt=record(r.runtime,'runtime.runtime',['runWindowMs','maxOutputBytes']);
 if(v.sdk!=='0.3.295'||v.cli!=='2.1.295'||v.contracts!=='0.1.0'||v.checkpointFormat!=='0.1.0'||!hex64.test(v.skillsDigest)||!hex64.test(r.policyRevision)||
  !Number.isSafeInteger(rt.runWindowMs)||rt.runWindowMs<60000||rt.runWindowMs>28800000||!Number.isSafeInteger(rt.maxOutputBytes)||rt.maxOutputBytes<1||rt.maxOutputBytes>1048576)fail('RENDER_INPUT_REFUSED','runtime versions/policy bounds');
 return {versions:{...v},runtime:{...rt},policyRevision:r.policyRevision,models:assertModelCatalog(r.models)};
}

/** Product-family activation (header: `features`). Returns null when absent; otherwise the closed, validated entries. Pure. */
export const FEATURE_KEYS=Object.freeze(['sourceEnabled','userPreferences','tenantSettings','intents','routines','retention','artifacts','downloadLinks','capabilityPlatform','reads','memory','objectiveGeneration']);
/** --feature-secrets keys -> the deployment-inputs ARN field each must name. */
export const FEATURE_SECRETS=Object.freeze({'reads.serviceSecret':'serviceSecretArn','reads.readModeServiceSecret':'readModeServiceSecretArn'});
/** Exact (complete, suffixed) Secrets Manager secret ARN in this account and region. A bare name, another account/region/partition, a
 * JSON-key/version suffix or a partial ARN without the 6-character suffix refuses (a name that itself ends in -XXXXXX cannot be told
 * apart syntactically; the operator's describe-secret ARN equality check covers that case). */
export const SECRET_ARN=/^arn:aws:secretsmanager:us-east-1:967807252336:secret:[A-Za-z0-9/_+=.@-]{1,512}-[A-Za-z0-9]{6}$/u;
const SECRET_VERSION=/^[A-Za-z0-9-]{32,64}$/u,KMS_KEY_ARN=/^arn:aws:kms:us-east-1:967807252336:key\/[a-f0-9-]{36}$/u;
/** Same token shape as reads-composer.mjs tokenOf, but exact: no surrounding whitespace is delivered. */
const SECRET_TOKEN=/^[\x21-\x7e]{1,8192}$/u;
export function parseFeatures(raw,{secrets={}}={}){
 if(raw===undefined)return null;
 const f=record(raw,'features',[],FEATURE_KEYS),out={};
 const bool=(v,name)=>{if(typeof v!=='boolean')fail('RENDER_INPUT_REFUSED',`${name} must be a boolean`);return v;};
 const toggle=key=>{const v=record(f[key],`features.${key}`,['enabled']);return {enabled:bool(v.enabled,`features.${key}.enabled`)};};
 if(f.sourceEnabled!==undefined)out.sourceEnabled=bool(f.sourceEnabled,'features.sourceEnabled');
 for(const key of ['userPreferences','tenantSettings'])if(f[key]!==undefined)out[key]=toggle(key);
 // Write-intent execution trust (lane E): the Core issuer and its Ed25519 public JWKs; validated by the control compiler against a
 // placeholder origin and secret path (the rendered values are the Core origin and the reads service secret file).
 if(f.intents!==undefined){const v=record(f.intents,'features.intents',['enabled'],['execution','core']);const enabled=bool(v.enabled,'features.intents.enabled');
  // Approval forwarder (lane L): Core P-INT-10 record/decision at the Core origin with the reads service secret file.
  const core=v.core===undefined?undefined:bool(record(v.core,'features.intents.core',['enabled']).enabled,'features.intents.core.enabled');if(core&&!enabled)fail('RENDER_INPUT_REFUSED','features.intents.core needs features.intents.enabled true');
  if(v.execution!==undefined){if(!enabled)fail('RENDER_INPUT_REFUSED','features.intents.execution needs features.intents.enabled true');const e=record(v.execution,'features.intents.execution',['issuer','keys']);
   try{compileIntentsConfiguration({intents:{enabled:true,execution:{coreOrigin:'https://placeholder.invalid',issuer:e.issuer,keys:structuredClone(e.keys),serviceSecretFile:'/run/meri/placeholder'}}});}catch{fail('RENDER_INPUT_REFUSED','features.intents.execution (apps/runtime/native-authority/execution-capability.mjs compileExecutionTrust)');}
   out.intents={enabled:true,execution:{issuer:e.issuer,keys:structuredClone(e.keys)},...(core?{core:true}:{})};}else out.intents={enabled,...(core?{core:true}:{})};}
 // Routines Core owners (lane B2): the policy-check origin and the Ed25519 pins for the cancellation proof and the unattended grant.
 if(f.routines!==undefined){const v=record(f.routines,'features.routines',['enabled'],['core','task','workflow']);const enabled=bool(v.enabled,'features.routines.enabled');
  let task,workflow;
  if(v.task!==undefined){if(!enabled)fail('RENDER_INPUT_REFUSED','features.routines.task needs features.routines.enabled true');const t=record(v.task,'features.routines.task',['taskId','version']);
   if(typeof t.taskId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(t.taskId)||!Number.isSafeInteger(t.version)||t.version<1)fail('RENDER_INPUT_REFUSED','features.routines.task identity');task={taskId:t.taskId,version:t.version};}
  if(v.workflow!==undefined){if(!enabled)fail('RENDER_INPUT_REFUSED','features.routines.workflow needs features.routines.enabled true');const w=record(v.workflow,'features.routines.workflow',['taskQueue','workflowIdPrefix']);
   if(typeof w.taskQueue!=='string'||!/^[A-Za-z0-9._-]{1,128}$/u.test(w.taskQueue)||typeof w.workflowIdPrefix!=='string'||!/^[A-Za-z0-9._/-]{1,128}$/u.test(w.workflowIdPrefix))fail('RENDER_INPUT_REFUSED','features.routines.workflow target');workflow={taskQueue:w.taskQueue,workflowIdPrefix:w.workflowIdPrefix};}
  if(v.core!==undefined){if(!enabled)fail('RENDER_INPUT_REFUSED','features.routines.core needs features.routines.enabled true');const c=record(v.core,'features.routines.core',[],['cancellationProof','unattendedGrant']);
   try{if(compileRoutinesCoreConfiguration({routines:{enabled:true,core:{origin:'https://placeholder.invalid',serviceSecretFile:'/run/meri/placeholder',...structuredClone(c)}}})===null)throw Error();}catch{fail('RENDER_INPUT_REFUSED','features.routines.core (apps/runtime/native-authority/routines-configuration.mjs)');}
   out.routines={enabled:true,core:structuredClone(c),...(task?{task}:{}),...(workflow?{workflow}:{})};}else out.routines={enabled,...(task?{task}:{}),...(workflow?{workflow}:{})};}
 if(f.retention!==undefined){
  const retention=record(f.retention,'features.retention',['enabled'],['purge']);
  if(!bool(retention.enabled,'features.retention.enabled'))fail('RENDER_INPUT_REFUSED','features.retention.enabled must be true (omit retention to leave it undeclared)');
  const purge=retention.purge===undefined?undefined:{enabled:bool(record(retention.purge,'features.retention.purge',['enabled']).enabled,'features.retention.purge.enabled')};
  out.retention={enabled:true,...(purge===undefined?{}:{purge})};
 }
 if(f.artifacts!==undefined){
  const storage=['region','bucket','prefix','expectedBucketOwner','kmsKeyId'],a=record(f.artifacts,'features.artifacts',['enabled'],[...storage,'authority','executor']);
  if(!bool(a.enabled,'features.artifacts.enabled')){if([...storage,'authority','executor'].some(k=>a[k]!==undefined))fail('RENDER_INPUT_REFUSED','features.artifacts: a disabled store names no storage');out.artifacts={enabled:false};}
  else{
   record(a,'features.artifacts',['enabled',...storage],['authority','executor']);
   // Core artifact current authority (docs/integration/ARTIFACT-CURRENT-AUTHORITY-CONTRACT.md); reuses the reads Core service secret.
   const authority=a.authority===undefined?false:bool(record(a.authority,'features.artifacts.authority',['enabled']).enabled,'features.artifacts.authority.enabled');
   if(a.region!==REGION||a.expectedBucketOwner!==ACCOUNT)fail('RENDER_INPUT_REFUSED',`features.artifacts region/expectedBucketOwner must be ${REGION}/${ACCOUNT}`);
   if(typeof a.kmsKeyId!=='string'||!KMS_KEY_ARN.test(a.kmsKeyId))fail('RENDER_INPUT_REFUSED','features.artifacts.kmsKeyId must be a full KMS key ARN in this account and region');
   try{const {authority:_authority,...store}=a;compileRuntimeArtifactsConfiguration({artifacts:store});}catch{fail('RENDER_INPUT_REFUSED','features.artifacts bucket/prefix (artifacts/configuration.mjs)');}
   out.artifacts={enabled:true,region:a.region,bucket:a.bucket,prefix:a.prefix,expectedBucketOwner:a.expectedBucketOwner,kmsKeyId:a.kmsKeyId,...(authority?{authority:true}:{}),...(a.executor===undefined?{}:{executor:structuredClone(a.executor)})};
  }
 }
 if(f.downloadLinks!==undefined){
  const l=record(f.downloadLinks,'features.downloadLinks',['enabled'],['ttlMs']);
  if(!bool(l.enabled,'features.downloadLinks.enabled')){if(l.ttlMs!==undefined)fail('RENDER_INPUT_REFUSED','features.downloadLinks: ttlMs only with enabled');out.downloadLinks={enabled:false};}
  else{
   if(l.ttlMs!==undefined&&(!Number.isSafeInteger(l.ttlMs)||l.ttlMs<1000||l.ttlMs>300000))fail('RENDER_INPUT_REFUSED','features.downloadLinks.ttlMs must be 1000..300000');
   // download-gate.mjs opens only over composed retention serving and the private artifact store.
   if(out.retention===undefined||out.artifacts?.enabled!==true)fail('RENDER_INPUT_REFUSED','features.downloadLinks needs features.retention and an enabled features.artifacts');
   out.downloadLinks={enabled:true,...(l.ttlMs===undefined?{}:{ttlMs:l.ttlMs})};
  }
 }
 if(f.capabilityPlatform!==undefined){
  try{compileCapabilityPlatform({capabilityPlatform:f.capabilityPlatform});}catch{fail('RENDER_INPUT_REFUSED','features.capabilityPlatform (capability-policy.mjs compileCapabilityPlatform)');}
  out.capabilityPlatform=structuredClone(f.capabilityPlatform);
 }
 if(f.reads!==undefined){
  const fields=['serviceSecretArn','readModeServiceSecretArn','defaultCongress','approvedReads'],r=record(f.reads,'features.reads',['enabled'],fields);
  if(!bool(r.enabled,'features.reads.enabled')){if(fields.some(k=>r[k]!==undefined))fail('RENDER_INPUT_REFUSED','features.reads: disabled reads name no secret, congress or approved reads');out.reads={enabled:false};}
  else{
   if(out.sourceEnabled!==true)fail('RENDER_INPUT_REFUSED','features.reads needs features.sourceEnabled true (G1 gates reads)');
   const material=new Set(Object.values(secrets));
   for(const key of ['serviceSecretArn','readModeServiceSecretArn'])if(r[key]!==undefined||key==='serviceSecretArn'){
    if(typeof r[key]!=='string'||!SECRET_ARN.test(r[key]))fail('RENDER_INPUT_REFUSED',`features.reads.${key} must be an exact Secrets Manager secret ARN in ${ACCOUNT}/${REGION}`);
    if(material.has(r[key]))fail('RENDER_INPUT_REFUSED',`features.reads.${key} must not be a Meri material secret`);
   }
   if(r.readModeServiceSecretArn!==undefined&&r.readModeServiceSecretArn===r.serviceSecretArn)fail('RENDER_INPUT_REFUSED','features.reads secret ARNs must be distinct');
   if(r.defaultCongress!==undefined&&(!Number.isSafeInteger(r.defaultCongress)||r.defaultCongress<1||r.defaultCongress>1000))fail('RENDER_INPUT_REFUSED','features.reads.defaultCongress must be 1..1000');
   let approvedReads;if(r.approvedReads!==undefined)try{approvedReads=structuredClone(assertNativeReadConfiguration(r.approvedReads));}catch{fail('RENDER_INPUT_REFUSED','features.reads.approvedReads (runtime-0.2 assertNativeReadConfiguration)');}
   out.reads={enabled:true,serviceSecretArn:r.serviceSecretArn,...(r.readModeServiceSecretArn===undefined?{}:{readModeServiceSecretArn:r.readModeServiceSecretArn}),
    ...(r.defaultCongress===undefined?{}:{defaultCongress:r.defaultCongress}),...(approvedReads===undefined?{}:{approvedReads})};
  }
 }
 if(f.memory!==undefined){const m=record(f.memory,'features.memory',['enabled']);out.memory={enabled:bool(m.enabled,'features.memory.enabled')};}
 if(f.objectiveGeneration!==undefined){
  let declared;try{declared=compileObjectiveGenerationConfiguration({objectiveGeneration:f.objectiveGeneration},'control');}catch{fail('RENDER_INPUT_REFUSED','features.objectiveGeneration (objective-generation/configuration.mjs)');}
  if(declared.runs&&out.reads?.enabled!==true)fail('RENDER_INPUT_REFUSED','features.objectiveGeneration reuses the reads Core service secret: it needs features.reads enabled');
  out.objectiveGeneration=structuredClone(f.objectiveGeneration);
 }
 if(out.artifacts?.authority===true&&out.reads?.enabled!==true)fail('RENDER_INPUT_REFUSED','features.artifacts.authority reuses the reads Core service secret: it needs features.reads enabled');
 if(out.memory?.enabled===true&&out.reads?.enabled!==true)fail('RENDER_INPUT_REFUSED','features.memory reuses the reads Core service secret: it needs features.reads enabled');
 if(out.intents?.execution!==undefined&&out.reads?.enabled!==true)fail('RENDER_INPUT_REFUSED','features.intents.execution reuses the reads Core service secret: it needs features.reads enabled');
 if(out.intents?.core===true&&out.reads?.enabled!==true)fail('RENDER_INPUT_REFUSED','features.intents.core reuses the reads Core service secret: it needs features.reads enabled');
 if(out.routines?.core!==undefined&&out.reads?.enabled!==true)fail('RENDER_INPUT_REFUSED','features.routines.core reuses the reads Core service secret: it needs features.reads enabled');
 return out;
}
/** The single capability profile every run resolves to under `capabilityPlatform` (G3), or null when the platform is absent or
 * enables nothing. runtime-values.mjs measures the SDK options with exactly this profile; the render pins its digest. */
export function capabilityProfileOf(capabilityPlatform){
 if(capabilityPlatform===undefined)return null;
 const producer=createConfiguredRunCapabilityPolicy({capabilityPlatform});
 return producer.profile===null?null:{profile:producer.profile,profileSha256:producer.profileSha256};
}
/** Operator-supplied secret bytes for the rendered features: exactly the keys the features need, each naming the same ARN as the
 * deployment inputs and the Secrets Manager VersionId it was read at. Values are never echoed in a refusal. */
function featureSecretFiles(features,supplied={}){
 const reads=features.reads?.enabled===true?features.reads:null;
 const needed=Object.entries(FEATURE_SECRETS).filter(([,field])=>reads?.[field]!==undefined).map(([key])=>key);
 const s=record(supplied,'featureSecrets',needed);
 const out={};
 for(const key of needed){
  const e=record(s[key],`featureSecrets.${key}`,['secretArn','versionId','bytes']);
  if(e.secretArn!==reads[FEATURE_SECRETS[key]])fail('RENDER_INPUT_REFUSED',`featureSecrets.${key}.secretArn differs from features.reads.${FEATURE_SECRETS[key]}`);
  if(typeof e.versionId!=='string'||!SECRET_VERSION.test(e.versionId))fail('RENDER_INPUT_REFUSED',`featureSecrets.${key}.versionId must be a Secrets Manager VersionId`);
  if(!Buffer.isBuffer(e.bytes)||!SECRET_TOKEN.test(e.bytes.toString('latin1')))fail('RENDER_PRIVATE_REFUSED',`featureSecrets.${key} must be 1..8192 printable ASCII bytes with no whitespace`);
  if(e.bytes.toString('latin1').includes('PENDING_'))fail('RENDER_PENDING_VALUE',`featureSecrets.${key}`);
  out[key]={secretArn:e.secretArn,versionId:e.versionId,bytes:Buffer.from(e.bytes)};
 }
 return out;
}

export function parseDeploymentInputs(raw){
 const d=record(raw,'deployment',['schemaVersion','account','region','clusterArn','vpcId','privateSubnetIds','images','foundation','privateEdge','names','temporalClients','origins','temporal','database','agentcore','secrets','pinsDer','pinsPem'],['features','telemetry']);
 if(d.schemaVersion!==1||d.account!==ACCOUNT||d.region!==REGION)fail('RENDER_INPUT_REFUSED','deployment account/region');
 // P0 is log-based and always on; this label neither enables OTel nor grants exporter egress.
 const telemetry=d.telemetry===undefined?{environment:'Preview'}:record(d.telemetry,'deployment.telemetry',['environment']);
 if(!['Preview','Production'].includes(telemetry.environment))fail('RENDER_INPUT_REFUSED','deployment.telemetry.environment');
 record(d.origins,'deployment.origins',['temporalAddress','controlPublicOrigin']);
 origin(d.origins.controlPublicOrigin,'deployment.origins.controlPublicOrigin');
 assertNoPending(d,'deployment');
 const cluster=/^arn:aws:ecs:us-east-1:967807252336:cluster\/([A-Za-z0-9_-]{1,255})$/u.exec(d.clusterArn);if(!cluster)fail('RENDER_INPUT_REFUSED','deployment.clusterArn');
 record(d.names,'deployment.names',['control_private','temporal_frontend','temporal_internode']);
 record(d.temporal,'deployment.temporal',['namespace','taskQueue']);
 record(d.temporalClients,'deployment.temporalClients',['control','worker','schedule']);
 for(const role of ['control','worker','schedule'])if(d.temporalClients[role]!==`meri-temporal-${role}`)fail('RENDER_INPUT_REFUSED','Temporal client certificate identity');
 record(d.database.roles,'deployment.database.roles',['control']);
 if(Object.hasOwn(d.secrets,'issuer/material'))fail('RENDER_INPUT_REFUSED','retired issuer material');
 for(const commit of [d.images.nodeRuntimeSourceCommit])if(!/^[a-f0-9]{40}$/u.test(commit))fail('RENDER_INPUT_REFUSED','image source commits must be 40 hex');
 imageDigest(d.images.nodeRuntime);
 return {...d,telemetry:{...telemetry},clusterName:cluster[1],features:parseFeatures(d.features,{secrets:d.secrets})};
}

/** Throwaway-free private reader: only certificate/key PEMs, pins.json and db-logins.json named here are read. */
const PKI_CERTS=['server-ca','control-private',
 'temporal-frontend-ca','temporal-client-ca','temporal-client-control','temporal-client-worker'];
const PKI_KEYS=['temporal-client-control','temporal-client-worker'];
export async function readPrivateDirectory(directory,{readBytes=readFile}={}){
 if(typeof directory!=='string'||!isAbsolute(directory))fail('RENDER_INPUT_REFUSED','private directory must be absolute');
 const certs={},keys={};
 for(const stem of PKI_CERTS)certs[stem]=await readBytes(join(directory,`${stem}.pem`));
 for(const stem of PKI_KEYS)keys[stem]=await readBytes(join(directory,`${stem}.key.pem`));
 const pins=JSON.parse((await readBytes(join(directory,'pins.json'))).toString('utf8'));
 const logins=JSON.parse((await readBytes(join(directory,'db-logins.json'))).toString('utf8'));
 return {certs,keys,pins,logins};
}

/** --feature-secrets: {<FEATURE_SECRETS key>: {secretArn, versionId, path}} -> the same entries with the file bytes (read here, never
 * printed). The operator fetches each value at the recorded VersionId of the exact ARN into private custody outside the repository. */
export async function readFeatureSecrets(raw,{readBytes=readFile}={}){
 const m=record(raw,'featureSecrets',[],Object.keys(FEATURE_SECRETS)),out={};
 for(const [key,value] of Object.entries(m)){
  const e=record(value,`featureSecrets.${key}`,['secretArn','versionId','path']);
  if(typeof e.path!=='string'||!isAbsolute(e.path))fail('RENDER_INPUT_REFUSED',`featureSecrets.${key}.path must be an absolute local path`);
  out[key]={secretArn:e.secretArn,versionId:e.versionId,bytes:await readBytes(e.path)};
 }
 return out;
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
 for(const ca of ['server-ca','temporal-frontend-ca','temporal-client-ca'])if(!x[ca].ca)fail('RENDER_PRIVATE_REFUSED',`${ca} is not a CA`);
 for(const [leaf,ca,san] of [['control-private','server-ca',d.names.control_private]]){
  issued(leaf,ca);if(x[leaf].subjectAltName!==`DNS:${san}`)fail('RENDER_PRIVATE_REFUSED',`${leaf} SAN must be DNS:${san}`);}
 for(const role of ['control','worker']){issued(`temporal-client-${role}`,'temporal-client-ca');if(x[`temporal-client-${role}`].subject!==`CN=${d.temporalClients[role]}`)fail('RENDER_PRIVATE_REFUSED',`temporal-client-${role} subject`);}
 for(const stem of PKI_KEYS){
  let pub;try{pub=createPublicKey(createPrivateKey(pki.keys[stem])).export({type:'spki',format:'der'});}catch{fail('RENDER_PRIVATE_REFUSED',`${stem}.key.pem is not a private key`);}
  if(!pub.equals(x[stem].publicKey.export({type:'spki',format:'der'})))fail('RENDER_PRIVATE_REFUSED',`${stem}.key.pem does not match ${stem}.pem`);
 }
 return {pins,notAfterMs};
}

function expectedEnvelope(role,image,sourceCommit,files){
 const contract={schemaVersion:1,role,runtimeUser:RUNTIME_USERS[role],sourceCommit,imageDigest:'sha256:'+imageDigest(image),
  sha256ByPath:Object.fromEntries([...files].map(([path,bytes])=>[path,sha(bytes)]))};
 return {...contract,materialContractSha256:canonicalSha256(contract)};
}
const bundleOf=files=>({files:[...files].map(([path,bytes])=>({path,base64:Buffer.from(bytes).toString('base64')}))});
/** Same predicates as apps/runtime/cli.mjs main() for MERI_PRODUCT_PREVIEW_REQUIRED=1 (the CLI evaluates them inline). */
export function assertProductCliGates(role,c,environment){
 if(role==='control'&&!(c.privateHttp!==undefined&&c.agentcore!==undefined&&productControlTrustsCompositeCa(environment)))fail('RENDER_GATE_REFUSED','PRODUCT_LISTENER_REFUSED');
 if(role==='temporal-worker'&&!(c.native.preparedKickoff===true&&c.native.loopback===false&&c.native.origin.startsWith('https://')&&c.http.port===8081&&productWorkerTrustsPinnedServerCa(c,environment)))fail('RENDER_GATE_REFUSED','PRODUCT_WORKER_REFUSED');
}

/** Pure render (reads only the private material passed in). Returns every role's exact bytes plus the non-secret summary. */
export function renderMaterial({deployment,core,runtime,stage3,private:pki,nowMs=Date.now(),validityDays=DEFAULTS.validityDays,
 deploymentRevision=DEFAULTS.deploymentRevision,featureSecrets={}}){
 const d=parseDeploymentInputs(deployment),k=parseCoreValues(core),r=parseRuntimeValues(runtime),s=parseStage3(stage3,{clusterName:d.clusterName});
 if(!Number.isSafeInteger(nowMs)||nowMs<1)fail('RENDER_INPUT_REFUSED','nowMs');
 if(!Number.isFinite(validityDays)||validityDays<=0)fail('RENDER_INPUT_REFUSED','validityDays must be positive');
 if(!/^[A-Za-z0-9_-]{1,128}$/u.test(deploymentRevision))fail('RENDER_INPUT_REFUSED','deploymentRevision');
 const features=d.features??{},secretFiles=featureSecretFiles(features,featureSecrets),capability=capabilityProfileOf(features.capabilityPlatform);
 if(capability?.profile.generalReads===true&&canonicalSha256(capability.profile.activeReadOperations)!==canonicalSha256(features.reads?.approvedReads?.operations??[]))fail('RENDER_INPUT_REFUSED','capability profile operations differ from approved reads');
 const {pins,notAfterMs}=verifyPki(d,pki);
 // Certificate validity is independent of each admitted conversation execution.
 const validityMs=Math.round(validityDays*DAY_MS),expiresAtMs=nowMs+validityMs;
 if(expiresAtMs>=notAfterMs)fail('RENDER_VALIDITY_REFUSED',`validity ends after the earliest certificate notAfter ${new Date(notAfterMs).toISOString()}`);
 const f=d.foundation,o=d.origins,controlPrivate=origin(d.privateEdge.controlPrivateOrigin,'privateEdge.controlPrivateOrigin');
 if(controlPrivate!==`https://${d.names.control_private}`)fail('RENDER_INPUT_REFUSED','control private origin must be https://names.control_private');
 if(o.temporalAddress!==`${d.names.temporal_frontend}:7233`)fail('RENDER_INPUT_REFUSED','temporal address must be names.temporal_frontend:7233');
 const nodeImage=d.images.nodeRuntime,nodeDigest=imageDigest(nodeImage);
 for(const role of ROLES)if(s.network[role].subnets.some(id=>!d.privateSubnetIds.includes(id)))fail('RENDER_INPUT_REFUSED',`stage3.network.${role}.subnets must be within deployment privateSubnetIds`);

 // One control-to-worker credential; user authority never comes from this material.
 const capabilityBytes={control:Buffer.from(capabilityToken(),'utf8')};
 const versions={imageDigest:'sha256:'+nodeDigest,...r.versions},policyRevision=r.policyRevision,runWindowMs=r.runtime.runWindowMs;
 const agentcore=compileAgentCoreConfiguration({...record(d.agentcore,'deployment.agentcore',['runtimeArn','runtimeVersion','qualifier']),identity:{origin:k.coreOrigin},policyRevision,runWindowMs,maxOutputBytes:r.runtime.maxOutputBytes,
  ...(features.reads?.approvedReads===undefined?{}:{approvedReads:features.reads.approvedReads})});
 // Product families, each rendered as exactly its own control key, in a fixed order after every first-chat key (absent: none).
 const downloadLinkKey=features.downloadLinks?.enabled===true?Buffer.from(randomBytes(32).toString('base64url'),'utf8'):null;
 const featureKeys={};
 for(const key of ['userPreferences','tenantSettings','retention'])if(features[key]!==undefined)featureKeys[key]={...features[key]};
 if(features.intents!==undefined)featureKeys.intents={...(features.intents.execution===undefined?{enabled:features.intents.enabled}:{enabled:true,execution:{coreOrigin:k.coreOrigin,issuer:features.intents.execution.issuer,keys:structuredClone(features.intents.execution.keys),serviceSecretFile:PATHS.readsServiceSecret}}),...(features.intents.core===true?{core:{origin:k.coreOrigin,serviceSecretFile:PATHS.readsServiceSecret}}:{})};
 if(features.routines!==undefined)featureKeys.routines={enabled:features.routines.enabled,
  ...(features.routines.core===undefined?{}:{core:{origin:k.coreOrigin,serviceSecretFile:PATHS.readsServiceSecret,...structuredClone(features.routines.core)}}),
  ...(features.routines.task===undefined?{}:{task:structuredClone(features.routines.task)}),
  ...(features.routines.workflow===undefined?{}:{workflow:structuredClone(features.routines.workflow)})};
 if(features.artifacts!==undefined){const {authority,...store}=features.artifacts;featureKeys.artifacts=store.enabled?{...store,
  ...(authority?{authority:{origin:k.coreOrigin,serviceSecretFile:PATHS.readsServiceSecret}}:{})}:{enabled:false};}
 if(features.downloadLinks!==undefined)featureKeys.downloadLinks=features.downloadLinks.enabled?{enabled:true,keyFile:PATHS.downloadLinkKey,...(features.downloadLinks.ttlMs===undefined?{}:{ttlMs:features.downloadLinks.ttlMs})}:{enabled:false};
 if(features.capabilityPlatform!==undefined)featureKeys.capabilityPlatform=structuredClone(features.capabilityPlatform);
 // Memory (lane M): review-only proposals over Core M2 at the Core origin, with the same Core service secret file as reads.
 if(features.memory!==undefined)featureKeys.memory=features.memory.enabled?{enabled:true,origin:k.coreOrigin,serviceSecretFile:PATHS.readsServiceSecret}:{enabled:false};
 if(features.objectiveGeneration!==undefined)featureKeys.objectiveGeneration=structuredClone(features.objectiveGeneration);
 if(features.reads!==undefined)featureKeys.reads=features.reads.enabled?{enabled:true,serviceSecretFile:PATHS.readsServiceSecret,
  ...(features.reads.readModeServiceSecretArn===undefined?{}:{readModeServiceSecretFile:PATHS.readsReadModeServiceSecret}),
  ...(features.reads.defaultCongress===undefined?{}:{defaultCongress:features.reads.defaultCongress})}:{enabled:false};
 const sourceEnabled=features.sourceEnabled===true;

 const temporal=()=>({address:o.temporalAddress,namespace:d.temporal.namespace,taskQueue:d.temporal.taskQueue,
  tls:{caFile:PATHS.temporalCa,certFile:PATHS.temporalCert,keyFile:PATHS.temporalKey}});
 // Preserve the qualified outer request budget, inside the frontend proxy's 30 s limit.
 // Current identity composition shares one fresh Core /current receipt within the operation.
 const limits={startupMs:30000,shutdownMs:10000,requestMs:25000,requestBytes:131072};
 const control={version:1,profile:'isolated-preview',sourceEnabled,limits,telemetry:{...d.telemetry},
  native:{origin:controlPrivate,capabilityFile:PATHS.controlCapability,serverCaFile:PATHS.serverCa,serverCaSha256:pins.der['server-ca'],loopback:false,maxResponseBytes:2097152},
  http:{hostname:'0.0.0.0',port:8080,frontendOrigin:k.frontendOrigin},database:{connectionFile:PATHS.database},temporal:temporal(),
  sessions:{mode:'process-local',replicas:1,maxSessions:100,maxTtlMs:300000},versions,agentcore,models:r.models,
  privateHttp:{hostname:'0.0.0.0',port:8082,frontendOrigin:controlPrivate},...featureKeys};
 // G1 applies to control and the Temporal worker; user credentials remain request-scoped.
 const worker={version:1,profile:'isolated-preview',sourceEnabled,limits,
  native:{origin:controlPrivate,capabilityFile:PATHS.controlCapability,serverCaFile:PATHS.serverCa,serverCaSha256:pins.der['server-ca'],loopback:false,maxResponseBytes:2097152,preparedKickoff:true},
  http:{hostname:'0.0.0.0',port:8081,frontendOrigin:k.frontendOrigin},temporal:temporal(),
  ...(features.objectiveGeneration===undefined?{}:{objectiveGeneration:{runs:{enabled:features.objectiveGeneration.runs?.enabled===true}}})};

 const db=d.database,logins=pki.logins;
 const controlDsn=Buffer.from(dsn(db.roles.control,password(logins,'control',db.roles.control),db.host,db.port,db.database));
 const controlBytes=Buffer.from(JSON.stringify(control));
 const configs={control,'temporal-worker':worker};
 const configBytes={control:controlBytes,...Object.fromEntries(Object.entries(configs).filter(([role])=>role!=='control').map(([role,value])=>[role,Buffer.from(JSON.stringify(value))]))};
 const temporalFiles=role=>[[PATHS.temporalCa,pki.certs['temporal-frontend-ca']],[PATHS.temporalCert,pki.certs[`temporal-client-${role==='control'?'control':'worker'}`]],
  [PATHS.temporalKey,pki.keys[`temporal-client-${role==='control'?'control':'worker'}`]],[PATHS.serverCa,pki.certs['server-ca']]];
 const files={
  control:new Map([[PATHS.control,controlBytes],[PATHS.database,controlDsn],
   [PATHS.controlCapability,capabilityBytes.control],...temporalFiles('control'),
   // Feature material, control only and only when rendered: the Core service secrets for reads and the download-link signing key.
   ...(secretFiles['reads.serviceSecret']?[[PATHS.readsServiceSecret,secretFiles['reads.serviceSecret'].bytes]]:[]),
   ...(secretFiles['reads.readModeServiceSecret']?[[PATHS.readsReadModeServiceSecret,secretFiles['reads.readModeServiceSecret'].bytes]]:[]),
   ...(downloadLinkKey?[[PATHS.downloadLinkKey,downloadLinkKey]]:[])]),
  'temporal-worker':new Map([[PATHS.worker,configBytes['temporal-worker']],[PATHS.controlCapability,capabilityBytes.control],...temporalFiles('temporal-worker')]),
 };
 const image=()=>[nodeImage,d.images.nodeRuntimeSourceCommit];
 const roles={};
 for(const role of ROLES){
  const [img,commit]=image(role),expected=expectedEnvelope(role,img,commit,files[role]),bundle=bundleOf(files[role]);
  roles[role]={config:configs[role],configBytes:configBytes[role],configSha256:sha(configBytes[role]),configPath:{control:PATHS.control,'temporal-worker':PATHS.worker}[role],
   expected,bundle,image:img,sourceCommit:commit};
 }
 const workerEnvironment={NODE_EXTRA_CA_CERTS:PATHS.serverCa},controlEnvironment={NODE_EXTRA_CA_CERTS:CONTROL_NODE_CA_FILE};
 validateRendered(roles,{workerEnvironment,controlEnvironment});
 const summary=summarize({d,r,s,roles,pins,agentcore,expiresAtMs,nowMs,validityDays,notAfterMs,runWindowMs,deploymentRevision,controlPrivate,workerEnvironment,controlEnvironment,policyRevision});
 // Non-secret record of what the features rendered (absent without features, so the reviewed summary is unchanged). The secret
 // files are named by path, source ARN, VersionId and sha256 only, so the operator can re-verify the fetched value.
 if(Object.keys(features).length)summary.features={sourceEnabled,controlKeys:Object.keys(featureKeys),approvedReads:features.reads?.approvedReads!==undefined,
  capabilityProfileSha256:capability?.profileSha256??null,
  secretFiles:Object.fromEntries(Object.entries(secretFiles).map(([key,v])=>[key==='reads.serviceSecret'?PATHS.readsServiceSecret:PATHS.readsReadModeServiceSecret,
   {feature:key,secretArn:v.secretArn,versionId:v.versionId,sha256:sha(v.bytes)}])),
  generatedFiles:downloadLinkKey?{[PATHS.downloadLinkKey]:'download-link signing key, fresh per render (32 random bytes, base64url)'}:{}};
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
function validateRenderedLinux(roles,{workerEnvironment,controlEnvironment}){
 const parse=role=>JSON.parse(roles[role].configBytes.toString('utf8'));
 for(const role of ['control','temporal-worker']){
  const c=parse(role);
  try{validateConfiguration(c,role);}catch(error){fail('RENDER_VALIDATION_REFUSED',`${role} validateConfiguration ${error.code??error.message}`);}
  assertProductCliGates(role,c,role==='control'?controlEnvironment:workerEnvironment);
  if(role==='control'){
   try{compileAgentCoreConfiguration(c.agentcore);}catch(error){fail('RENDER_VALIDATION_REFUSED',`control AgentCore configuration ${error.message}`);}
  }
 }
 for(const role of ROLES){
  let plan;try{plan=compileProductMaterialPlan({role,configuration:parse(role),runtimeUser:RUNTIME_USERS[role]});}
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
 const init=role=>({containerName:'material-init',image:roles[role].image,user:RUNTIME_USERS[role],
  entryPoint:['node','apps/runtime/material-init-cli.mjs'],command:role==='control'?['write','--control-node-ca']:['write'],
  environment:[env('MERI_STATIC_MATERIAL_EXPECTED',JSON.stringify(roles[role].expected))],
  secrets:[{name:'MERI_STATIC_MATERIAL_BUNDLE',valueFrom:`${d.secrets[{control:'control/material','temporal-worker':'worker/material'}[role]]}:::<VersionId of the PutSecretValue with ${role}/bundle.json>`}]});
 const wiring={
  control:{family:s.taskDefinitions.control,containerName:'control',image:roles.control.image,user:'1000:1000',entryPoint:['node','apps/runtime/cli.mjs'],command:['control','--config',PATHS.control],
   environment:[env('MERI_PRODUCT_PREVIEW_REQUIRED','1'),env('NODE_EXTRA_CA_CERTS',x.controlEnvironment.NODE_EXTRA_CA_CERTS)],ports:[8080,8082],volumes:{'/run/meri':'material (read-only)','/tmp':'tmp (writable; init writes control CA bundle)','/workspace':'workspace'},init:init('control')},
  'temporal-worker':{family:s.taskDefinitions['temporal-worker'],containerName:'temporal-worker',image:roles['temporal-worker'].image,user:'1000:1000',entryPoint:['node','apps/runtime/cli.mjs'],command:['temporal-worker','--config',PATHS.worker],
   environment:[env('MERI_PRODUCT_PREVIEW_REQUIRED','1'),env('NODE_EXTRA_CA_CERTS',x.workerEnvironment.NODE_EXTRA_CA_CERTS)],ports:[8081],volumes:{'/run/meri':'material (read-only)'},init:init('temporal-worker')},
 };
 return {schemaVersion:1,generatedAtMs:x.nowMs,
  validity:{validityDays:x.validityDays,notAfterMs:x.expiresAtMs,notAfter:new Date(x.expiresAtMs).toISOString(),earliestCertificateNotAfter:new Date(x.notAfterMs).toISOString(),runWindowMs:x.runWindowMs},
  roles:Object.fromEntries(ROLES.map(role=>[role,{configPath:roles[role].configPath,configSha256:roles[role].configSha256,materialContractSha256:roles[role].expected.materialContractSha256,
   fileCount:roles[role].bundle.files.length,bundleBytes:Buffer.byteLength(JSON.stringify(roles[role].bundle)),expectedBytes:Buffer.byteLength(JSON.stringify(roles[role].expected)),
   runtimeUser:RUNTIME_USERS[role],imageDigest:roles[role].expected.imageDigest,sourceCommit:roles[role].sourceCommit,taskDefinitionArn:s.taskDefinitions[role],
   sha256ByPath:roles[role].expected.sha256ByPath}])),
  taskDefinitionConfigPins:{controlConfigSha256:roles.control.configSha256,workerConfigSha256:roles['temporal-worker'].configSha256},
  control:{NODE_EXTRA_CA_CERTS:x.controlEnvironment.NODE_EXTRA_CA_CERTS},worker:{NODE_EXTRA_CA_CERTS:x.workerEnvironment.NODE_EXTRA_CA_CERTS},
  deploymentRevision:x.deploymentRevision,agentcore:{runtimeArn:x.agentcore.runtimeArn,runtimeVersion:x.agentcore.runtimeVersion,qualifier:x.agentcore.qualifier,policyRevision:x.policyRevision,runWindowMs:x.runWindowMs},
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
  [--validity-days 7] [--now-ms <epoch ms>] [--deployment-revision first-chat-preview-1]   [--feature-secrets <feature-secrets.json>]   (only with features.reads: {"reads.serviceSecret":{secretArn,versionId,path}, ...})
Prints only the non-secret summary path and config hashes. Exit 0 rendered; 2 arguments/inputs/validation refused.`;
export async function main(argv=process.argv.slice(2)){
 if(argv.length===0||argv.includes('--help')){process.stdout.write(USAGE+'\n');return argv.length?0:2;}
 const a={};for(let i=0;i<argv.length;i+=2){if(!argv[i].startsWith('--')||argv[i+1]===undefined){process.stderr.write(USAGE+'\n');return 2;}a[argv[i].slice(2)]=argv[i+1];}
 const json=async path=>JSON.parse(await readFile(path,'utf8'));
 try{
  for(const key of ['deployment-inputs','private','core','runtime','stage3','out'])if(!a[key])fail('RENDER_ARGUMENTS',`--${key} is required`);
  const core=await json(a.core),pki=await readPrivateDirectory(resolve(a.private));
  const rendered=renderMaterial({deployment:await json(a['deployment-inputs']),core,runtime:await json(a.runtime),stage3:await json(a.stage3),private:pki,
   ...(a['now-ms']?{nowMs:Number(a['now-ms'])}:{}),...(a['validity-days']?{validityDays:Number(a['validity-days'])}:{}),
   ...(a['deployment-revision']?{deploymentRevision:a['deployment-revision']}:{}),
   ...(a['feature-secrets']?{featureSecrets:await readFeatureSecrets(await json(resolve(a['feature-secrets'])))}:{})});
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
