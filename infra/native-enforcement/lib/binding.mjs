// Codex owner completion of REJECTED e6207d7. Pure data; no AWS/network/process/deploy.
import { createHash } from 'node:crypto';
import { validateTaskDefinition,validateCanaryTaskDefinition } from './task-definition.mjs';
import { CANARY_EVIDENCE_KINDS,CANARY_EVIDENCE_PINS,CANARY_EXECUTABLE,CANARY_FAMILY,CANARY_IMAGE,CANARY_IMAGE_CONFIG_SHA256,CANARY_KIND,CANARY_LIMITS,CANARY_LOG_GROUP,CANARY_MACHINE_NAME,CANARY_MANAGED_ROLE_NAME,CANARY_NETWORK,CANARY_PROFILE,CANARY_ROLE_PINS,CANARY_SOURCE_COMMIT,CANARY_TARGET } from './probe-profiles.mjs';
export const TARGET={account:'967807252336',region:'us-east-1'};
export const PLATFORM='1.4.0';
export const NETWORK={vpcId:'vpc-06e1941747e798f0a',subnetId:'subnet-0864c000b771df32c',securityGroupId:'sg-0c4e15bec7adeed1a'};
export const ROLE_PINS={execution:'arn:aws:iam::967807252336:role/MeriGreenfield-QualificationR-ExecutionRole605A040B-kL3yc2CIalc3',worker:'arn:aws:iam::967807252336:role/MeriGreenfield-Qualificatio-EmptyWorkerRole7C03C4DD-nOWJZv6LQdqD'};
export const LIMITS={D:720000,C:900000,calls:512,terminalCalls:544,pages:16,polls:120,candidates:128,owned:4,overflow:6,recordBytes:32768,ledgerBytes:16384,ctxBytes:196608,outputBytes:131072,issueBytes:1024,issues:32,errorChars:512,refChars:2048,refBytes:16384,tokenChars:2048};
export const WIRE_PROFILE='ecs-native_ec2-pascal_sts-pascal_v1';
export const EVIDENCE_KINDS=['source','build','image','inventory','security','taskDefinitions','iam','network','dns','logsKms'];
export const prefix=`arn:aws:ecs:${TARGET.region}:${TARGET.account}:`, rolePrefix=`arn:aws:iam::${TARGET.account}:role/`;
const compiled=new WeakSet();
export const sha256=v=>createHash('sha256').update(v).digest('hex');
export function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';const s=JSON.stringify(v);if(s===undefined)throw Error('undefined canonical value');return s;}
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&canonical(Object.keys(v).sort())===canonical([...keys].sort());
function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
export function check(v,m){if(!v)throw Error(m);}
// Structural compiler, not authentication or owner acceptance. Full raw evidence stays external.
// Final definition/template/input hashes and version are excluded from the binding ID.
export function buildNativeEnforcementAdmission(input={}){
 if(!input.staticPins)return freeze({runtimeEnabled:false,reasons:['missing static pins; default refuses']});
 const p=structuredClone(input.staticPins);
 check(exact(p,['account','region','runUuid','stateMachineName','managedRoleName','clusterArn','taskDefinitionArns','executionRoleArn','workerRoleArn','image','imageConfigSha256','sourceCommit','platformVersion','network','logGroup','kmsKeyArn','taskDefinitionPins','authorityDocuments','wireProfile','timestampEncoding','wireEvidence']),'exact static schema');
 check(p.account===TARGET.account&&p.region===TARGET.region,'foreign account/region');
 check(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(p.runUuid),'canonical v4 UUID');
 check(/^meri-greenfield-native-enforcement-[a-z0-9-]{1,35}$/.test(p.stateMachineName),'new exact machine name');
 check(/^MeriGreenfield-NativeEnforcement-[A-Za-z0-9-]{1,28}$/.test(p.managedRoleName),'new exact managed role');
 check(new RegExp(`^${prefix}cluster/meri-greenfield-[A-Za-z0-9-]{1,180}$`).test(p.clusterArn),'exact cluster ARN');
 check(exact(p.taskDefinitionArns,['sdk','office']),'two definitions');
 for(const k of ['sdk','office'])check(new RegExp(`^${prefix}task-definition/meri-greenfield-qualification-${k}:[1-9][0-9]*$`).test(p.taskDefinitionArns[k]),'exact account/region/family/revision');
 check(p.executionRoleArn===ROLE_PINS.execution&&p.workerRoleArn===ROLE_PINS.worker,'exact retained worker/execution roles');
 check(new RegExp(`^${TARGET.account}\\.dkr\\.ecr\\.${TARGET.region}\\.amazonaws\\.com/meri-greenfield/qualification-worker@sha256:[a-f0-9]{64}$`).test(p.image),'immutable new image');
 check(!['7327f04575b09a633730b0ffe4b5fdeeeffe151a5c0db6dc027cc6edb8960d75','527e6d80d0e0cb9b3369f7f75d22475b96615bee171fb6fb6d57f31ce925d74e'].some(d=>p.image.endsWith(d)),'unadmitted historical image');
 check(/^[a-f0-9]{64}$/.test(p.imageConfigSha256)&&/^[a-f0-9]{40}$/.test(p.sourceCommit),'config/source pins');
 check(p.platformVersion===PLATFORM&&canonical(p.network)===canonical(NETWORK),'exact network/platform');
 check(p.logGroup==='/meri-greenfield/qualification/runtime'&&new RegExp(`^arn:aws:kms:${p.region}:${p.account}:key/[a-f0-9-]{36}$`).test(p.kmsKeyArn),'exact logs/KMS');
 check(p.wireProfile===WIRE_PROFILE&&['iso8601','epoch-seconds'].includes(p.timestampEncoding),'explicit wire profile');
 check(exact(p.taskDefinitionPins,['sdk','office']),'full task-definition records');
 // Full raw task-definition readbacks are retained in the binding; fail-closed structural
 // validation is delegated to the focused task-definition module.
 for(const k of ['sdk','office'])validateTaskDefinition(p.taskDefinitionPins[k],{arn:p.taskDefinitionArns[k],family:`meri-greenfield-qualification-${k}`,revision:Number(p.taskDefinitionArns[k].split(':').at(-1)),image:p.image,logGroup:p.logGroup,region:p.region,executionRoleArn:p.executionRoleArn,workerRoleArn:p.workerRoleArn,probeKind:k,command:`/opt/meri-worker/probes/${k==='sdk'?'sdk-capture':'office-export'}.mjs`});
 check(Array.isArray(p.authorityDocuments)&&p.authorityDocuments.length===10,'complete authority documents');
 const refs=EVIDENCE_KINDS.map(kind=>{
  const docs=p.authorityDocuments.filter(d=>d.kind===kind);check(docs.length===1,'unique authority kind');const d=docs[0];
  check(exact(d,['kind','reference','version','body','sha256'])&&typeof d.body==='string'&&d.body.length>2&&d.body.length<=96*1024*1024&&typeof d.reference==='string'&&d.reference.length>0&&d.reference.length<=LIMITS.refChars&&typeof d.version==='string'&&d.version.length>0&&d.version.length<=LIMITS.refChars,'full versioned evidence');
  const b=JSON.parse(d.body);check(b&&typeof b==='object'&&!Array.isArray(b)&&Object.keys(b).length>0&&sha256(d.body)===d.sha256,'evidence bytes/object');return {kind,reference:d.reference,version:d.version,sha256:d.sha256,bytes:Buffer.byteLength(d.body)};
 });
 const w=p.wireEvidence;check(exact(w,['origin','reference','version','body','sha256'])&&typeof w.body==='string'&&Buffer.byteLength(w.body)<=65536&&sha256(w.body)===w.sha256&&typeof w.reference==='string'&&w.reference.length>0&&w.reference.length<=LIMITS.refChars&&typeof w.version==='string'&&w.version.length>0&&w.version.length<=LIMITS.refChars,'full wire evidence');
 // Aggregate serialized-UTF8 ingress bound on the reference/version metadata that flows
 // into every workflow record, independent of the per-field character limits above.
 check(Buffer.byteLength(canonical(refs),'utf8')<=LIMITS.refBytes,'authority reference aggregate bytes');
 check(Buffer.byteLength(canonical({origin:w.origin,reference:w.reference,version:w.version,sha256:w.sha256}),'utf8')<=LIMITS.refBytes,'wire reference aggregate bytes');
 const wr=JSON.parse(w.body);check(wr.profile===WIRE_PROFILE&&wr.timestampEncoding===p.timestampEncoding&&Array.isArray(wr.listResult?.taskArns)&&Array.isArray(wr.describeResult?.tasks)&&Array.isArray(wr.eniResult?.NetworkInterfaces)&&wr.identityResult?.Account===p.account,'wire profile evidence shape');
 const runtimeEnabled=input.executeAdmitted===true&&w.origin==='OWNER_REVIEWED_ACTUAL_READ_ONLY_INTEGRATION';
 delete p.authorityDocuments;delete p.wireEvidence;p.authorityReferences=refs;p.wireReference={origin:w.origin,reference:w.reference,version:w.version,sha256:w.sha256,bytes:Buffer.byteLength(w.body)};
 const binding=freeze({runtimeEnabled,staticBindingId:sha256(canonical(p)),pins:p,reasons:['STRUCTURAL_PREPARATION_NOT_OWNER_ACCEPTANCE']});compiled.add(binding);return binding;
}

export const isCompiledBinding=binding=>compiled.has(binding);

// ---------------------------------------------------------------------------------------
// Closed canary-only admission factory. Default/missing preparation is refusing/inert. A
// caller cannot obtain authority through a lookalike binding/profile object, a mutation of
// the input after compilation, or arbitrary command/entryPoint/profile options: the only
// accepted static shape is the exact native field set plus one fixed evidence-only field,
// the arn/pin collections must be exactly {canary}, and the canary mode is registered in a
// distinct private provenance map rather than translated into fabricated SDK/Office
// records. `canaryEvidencePins` is a fixed evidence assertion, never command/profile
// authority or a fresh inventory attestation.
// ---------------------------------------------------------------------------------------
const canaryBindings=new WeakMap();
export const isCanaryBinding=binding=>canaryBindings.has(binding);
// Canary boundary assertion: the new fixed canary contract must not inherit mutable authority
// from the shared, deliberately-writable legacy exports. Any drift of the live exports away
// from the frozen reviewed snapshot refuses the canary boundary. Native paths never call this.
export function assertCanaryBoundary(){
 check(canonical(TARGET)===canonical(CANARY_TARGET),'canary boundary: TARGET drift');
 check(canonical(NETWORK)===canonical(CANARY_NETWORK),'canary boundary: NETWORK drift');
 check(canonical(ROLE_PINS)===canonical(CANARY_ROLE_PINS),'canary boundary: ROLE_PINS drift');
 check(canonical(LIMITS)===canonical(CANARY_LIMITS),'canary boundary: LIMITS drift');
 check(canonical(EVIDENCE_KINDS)===canonical(CANARY_EVIDENCE_KINDS),'canary boundary: EVIDENCE_KINDS drift');
 return true;
}
export function buildCanaryEnforcementAdmission(input={}){
 check(input&&typeof input==='object'&&!Array.isArray(input),'canary outer options object');
 check(Object.keys(input).every(k=>k==='staticPins'||k==='executeAdmitted'),'canary outer options keys');
 check(input.executeAdmitted===undefined||typeof input.executeAdmitted==='boolean','canary executeAdmitted boolean');
 if(!Object.prototype.hasOwnProperty.call(input,'staticPins'))return freeze({runtimeEnabled:false,reasons:['missing static pins; default refuses']});
 check(input.staticPins&&typeof input.staticPins==='object'&&!Array.isArray(input.staticPins),'canary staticPins object');
 assertCanaryBoundary();
 const p=structuredClone(input.staticPins);
 check(exact(p,['account','region','runUuid','stateMachineName','managedRoleName','clusterArn','taskDefinitionArns','executionRoleArn','workerRoleArn','image','imageConfigSha256','sourceCommit','platformVersion','network','logGroup','kmsKeyArn','taskDefinitionPins','authorityDocuments','wireProfile','timestampEncoding','wireEvidence','canaryEvidencePins']),'exact canary static schema');
 check(p.account===CANARY_TARGET.account&&p.region===CANARY_TARGET.region,'foreign account/region');
 check(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(p.runUuid),'canonical v4 UUID');
 check(p.stateMachineName===CANARY_MACHINE_NAME,'exact canary machine name');
 check(p.managedRoleName===CANARY_MANAGED_ROLE_NAME,'exact canary managed role');
 check(new RegExp(`^${prefix}cluster/meri-greenfield-[A-Za-z0-9-]{1,180}$`).test(p.clusterArn),'exact cluster ARN');
 check(exact(p.taskDefinitionArns,['canary']),'one canary definition');
 check(new RegExp(`^${prefix}task-definition/${CANARY_FAMILY}:[1-9][0-9]*$`).test(p.taskDefinitionArns.canary),'exact account/region/family/revision');
 check(p.executionRoleArn===CANARY_ROLE_PINS.execution&&p.workerRoleArn===CANARY_ROLE_PINS.worker,'exact retained worker/execution roles');
 check(p.image===CANARY_IMAGE,'exact compiled canary image');
 check(p.imageConfigSha256===CANARY_IMAGE_CONFIG_SHA256,'exact compiled canary image config');
 check(p.sourceCommit===CANARY_SOURCE_COMMIT,'exact compiled canary build source');
 check(p.platformVersion===PLATFORM&&canonical(p.network)===canonical(CANARY_NETWORK),'exact network/platform');
 check(p.logGroup===CANARY_LOG_GROUP&&new RegExp(`^arn:aws:kms:${p.region}:${p.account}:key/[a-f0-9-]{36}$`).test(p.kmsKeyArn),'exact logs/KMS');
 check(p.wireProfile===WIRE_PROFILE&&['iso8601','epoch-seconds'].includes(p.timestampEncoding),'explicit wire profile');
 check(exact(p.taskDefinitionPins,['canary']),'one canary task-definition record');
 validateCanaryTaskDefinition(p.taskDefinitionPins.canary,{arn:p.taskDefinitionArns.canary,family:CANARY_FAMILY,revision:Number(p.taskDefinitionArns.canary.split(':').at(-1)),image:p.image,logGroup:CANARY_LOG_GROUP,region:p.region,executionRoleArn:CANARY_ROLE_PINS.execution,workerRoleArn:CANARY_ROLE_PINS.worker,probeKind:CANARY_KIND});
 const ce=p.canaryEvidencePins;
 check(exact(ce,['inventoryPayloadBytes','inventoryPayloadSha256','resultBytes','resultSha256','executable']),'canary evidence pins schema');
 check(Number.isInteger(ce.inventoryPayloadBytes)&&ce.inventoryPayloadBytes===CANARY_EVIDENCE_PINS.inventoryPayloadBytes,'canary inventory payload bytes');
 check(ce.inventoryPayloadSha256===CANARY_EVIDENCE_PINS.inventoryPayloadSha256,'canary inventory payload sha');
 check(Number.isInteger(ce.resultBytes)&&ce.resultBytes===CANARY_EVIDENCE_PINS.resultBytes,'canary result bytes');
 check(ce.resultSha256===CANARY_EVIDENCE_PINS.resultSha256,'canary result sha');
 check(exact(ce.executable,['path','type','bytes','uid','gid','mode','sha256']),'canary executable schema');
 check(ce.executable.path===CANARY_EXECUTABLE.path&&ce.executable.type===CANARY_EXECUTABLE.type&&Number.isInteger(ce.executable.bytes)&&ce.executable.bytes===CANARY_EXECUTABLE.bytes&&ce.executable.uid===CANARY_EXECUTABLE.uid&&ce.executable.gid===CANARY_EXECUTABLE.gid&&ce.executable.mode===CANARY_EXECUTABLE.mode&&ce.executable.sha256===CANARY_EXECUTABLE.sha256,'canary executable pin');
 check(Array.isArray(p.authorityDocuments)&&p.authorityDocuments.length===10,'complete authority documents');
 const refs=CANARY_EVIDENCE_KINDS.map(kind=>{
  const docs=p.authorityDocuments.filter(d=>d.kind===kind);check(docs.length===1,'unique authority kind');const d=docs[0];
  check(exact(d,['kind','reference','version','body','sha256'])&&typeof d.body==='string'&&d.body.length>2&&d.body.length<=96*1024*1024&&typeof d.reference==='string'&&d.reference.length>0&&d.reference.length<=CANARY_LIMITS.refChars&&typeof d.version==='string'&&d.version.length>0&&d.version.length<=CANARY_LIMITS.refChars,'full versioned evidence');
  const b=JSON.parse(d.body);check(b&&typeof b==='object'&&!Array.isArray(b)&&Object.keys(b).length>0&&sha256(d.body)===d.sha256,'evidence bytes/object');return {kind,reference:d.reference,version:d.version,sha256:d.sha256,bytes:Buffer.byteLength(d.body)};
 });
 const w=p.wireEvidence;check(exact(w,['origin','reference','version','body','sha256'])&&typeof w.body==='string'&&Buffer.byteLength(w.body)<=65536&&sha256(w.body)===w.sha256&&typeof w.reference==='string'&&w.reference.length>0&&w.reference.length<=CANARY_LIMITS.refChars&&typeof w.version==='string'&&w.version.length>0&&w.version.length<=CANARY_LIMITS.refChars,'full wire evidence');
 check(Buffer.byteLength(canonical(refs),'utf8')<=CANARY_LIMITS.refBytes,'authority reference aggregate bytes');
 check(Buffer.byteLength(canonical({origin:w.origin,reference:w.reference,version:w.version,sha256:w.sha256}),'utf8')<=CANARY_LIMITS.refBytes,'wire reference aggregate bytes');
 const wr=JSON.parse(w.body);check(wr.profile===WIRE_PROFILE&&wr.timestampEncoding===p.timestampEncoding&&Array.isArray(wr.listResult?.taskArns)&&Array.isArray(wr.describeResult?.tasks)&&Array.isArray(wr.eniResult?.NetworkInterfaces)&&wr.identityResult?.Account===p.account,'wire profile evidence shape');
 const runtimeEnabled=input.executeAdmitted===true&&w.origin==='OWNER_REVIEWED_ACTUAL_READ_ONLY_INTEGRATION';
 delete p.authorityDocuments;delete p.wireEvidence;p.authorityReferences=refs;p.wireReference={origin:w.origin,reference:w.reference,version:w.version,sha256:w.sha256,bytes:Buffer.byteLength(w.body)};
 p.canaryProfile=CANARY_PROFILE;
 const binding=freeze({runtimeEnabled,staticBindingId:sha256(canonical(p)),pins:p,reasons:['STRUCTURAL_PREPARATION_NOT_OWNER_ACCEPTANCE']});
 canaryBindings.set(binding,CANARY_PROFILE);return binding;
}
