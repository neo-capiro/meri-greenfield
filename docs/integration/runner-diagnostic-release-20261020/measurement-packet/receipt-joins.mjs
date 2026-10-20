// Pure public-evidence joins. Callers separately authenticate AWS readbacks and
// invoke the canonical source runtime-values assembler. No I/O on import.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const SOURCE_COMMIT='2b4421f612f9fbb728d6da52927aac228d712d40';
export const PROJECT_ARN='arn:aws:codebuild:us-east-1:967807252336:project/meri-greenfield-qualification-build';
export const PROJECT_ROLE_ARN='arn:aws:iam::967807252336:role/MeriGreenfield-QualificationBui-BuilderRoleBBEBFA71-8G97EeNmFM0H';
export const ARTIFACT_NAMES=['launch-measurement.json','launch-readback.json','runtime-native.json','runtime-packages.json','measurement-provenance.json','measurement-diagnostic.json'];
export const CLI='/opt/meri/apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude';
export const MODULE='apps/runtime/build/first-chat-launch-measurement.mjs';
export const RUNNER='apps/runtime/conversation-runner.mjs';
export const GATES=['compileNativePreparationIntent','matchPreparedDescriptor','commandIsRealpath','executable','runnerCaTrust','secureStorage','runnerSdkOptions'];
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const checkedJson=bytes=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
const equal=(a,b,field)=>assert.deepEqual(a,b,`MEASUREMENT_JOIN_REFUSED:${field}`);
const yes=(value,field)=>assert.ok(value,`MEASUREMENT_JOIN_REFUSED:${field}`);
export const artifactPrefix=plan=>'results/launch-measurement/'+SOURCE_COMMIT+'/'+plan.attempt;
export function measurementStartRequest(plan,buildspec){return {projectName:PROJECT_ARN.split('/')[1],sourceTypeOverride:'S3',sourceLocationOverride:plan.request.archive.bucket+'/'+plan.request.archive.key,sourceVersion:plan.request.archive.versionId,buildspecOverride:buildspec,idempotencyToken:plan.attempt,timeoutInMinutesOverride:10,queuedTimeoutInMinutesOverride:5,autoRetryLimitOverride:0,artifactsOverride:{type:'S3',location:plan.request.archive.bucket,path:artifactPrefix(plan),name:'/',namespaceType:'NONE',packaging:'NONE',encryptionDisabled:false}};}
// Records must be produced by the operator from authenticated S3 head/get calls.
// These byte joins cannot authenticate a hand-written record on their own.
export function joinArtifactDownloads({plan,buildId,downloads,resultBytes}){
 equal(downloads.schema,'meri.measurement-artifact-downloads.v1','download schema');equal(downloads.buildId,buildId,'download build id');
 equal(downloads.files.map(x=>x.name).sort(),[...ARTIFACT_NAMES].sort(),'download exact files');
 for(const record of downloads.files){
  equal(record.bucket,plan.request.archive.bucket,'download bucket');equal(record.key,artifactPrefix(plan)+'/'+record.name,'download exact key');
  yes(typeof record.versionId==='string'&&record.versionId.length>0&&record.versionId!=='null','download selected version');
  const bytes=resultBytes[record.name];yes(bytes?.length>0&&bytes.length<=4*1024**2,'download byte bound');
  equal(record.bytes,bytes.length,'download bytes');equal(record.sha256,hash(bytes),'download sha256');
 }
 return true;
}
function scan(value,digest){
 equal(value.imageId.imageDigest,digest,'scan digest');
 equal(value.imageScanStatus.status,'COMPLETE','scan status');
 const counts=value.imageScanFindings?.findingSeverityCounts??{};
 yes(Object.values(counts).every(n=>Number.isSafeInteger(n)&&n>=0),'scan count types');
 equal(counts.HIGH??0,0,'scan high');equal(counts.CRITICAL??0,0,'scan critical');
}
export function joinMeasurement({plan,launch,readback,native,packages,provenance,operator}){
 const p=plan.request,r=plan.productReceipt;
 equal(plan.schema,'meri.operator-launch-measurement-plan.v1','plan schema');
 equal(p.sourceCommit,SOURCE_COMMIT,'source commit');
 equal(p.codeBuildProjectArn,PROJECT_ARN,'existing project');
 equal(plan.projectRoleArn,PROJECT_ROLE_ARN,'existing role');
 equal(plan.image,p.ecrRepositoryUri+'@'+r.imageDigest,'image URI');
 equal(r.scanStatus,'COMPLETE','producer scan');
 yes(/^[a-f0-9]{32}$/.test(plan.attempt),'attempt');
 for(const key of ['sourceCommit','dockerfileSha256','nodeImageUri','nodeVersion','runtimeBaseImageUri','runtimePackagesSha256','runnerSha256','runtimeUser','verifierSha256','producerSha256'])equal(r[key],p[key],'producer '+key);
 equal(r.archiveSha256,p.archive.sha256,'archive hash');equal(r.sourceManifestSha256,p.manifest.sha256,'manifest hash');equal(r.sourceVersion,p.archive.versionId,'source version');
 const build=(b,id,minutes)=>{
  equal(b.id,id,'build id');equal(b.buildStatus,'SUCCEEDED','build success');
  equal(b.buildComplete,true,'build terminal');equal(b.timeoutInMinutes,minutes,'build timeout');equal(b.queuedTimeoutInMinutes,5,'build queue timeout');
  equal(b.projectName,p.codeBuildProjectArn.split('/')[1],'build project');
  equal(b.serviceRole,plan.projectRoleArn,'build role');
  equal(b.sourceVersion,p.archive.versionId,'build source version');
  equal(b.source.type,'S3','source type');equal(b.source.location,p.archive.bucket+'/'+p.archive.key,'source location');
  equal(b.environment.type,'LINUX_CONTAINER','builder platform');equal(b.environment.privilegedMode,true,'builder docker');
  equal(b.environment.computeType,'BUILD_GENERAL1_SMALL','build compute');equal(b.environment.image,'aws/codebuild/standard:7.0','builder image');
  equal(b.autoRetryConfig?.autoRetryLimit??0,0,'build retry limit');equal(b.autoRetryConfig?.autoRetryNumber??0,0,'build retries');
 };
 equal(operator.measurementStart.id,provenance.buildId,'actual submitted build id');
 yes(operator.measurementStart.id!==r.buildId,'distinct build attempts');
 build(operator.productBuild,r.buildId,30);build(operator.measurementBuild,operator.measurementStart.id,10);
 equal(operator.measurementBuild.artifacts.location.replace(/\/$/,''),'arn:aws:s3:::'+p.archive.bucket+'/'+artifactPrefix(plan),'actual artifact prefix');
 equal(hash(operator.measurementBuild.source.buildspec),plan.buildspecSha256,'authenticated override hash');
 equal(hash(operator.productBuild.source.buildspec),plan.productBuildspecSha256,'canonical product recipe hash');
 const detail=operator.ecrImage;
 equal(detail.imageDigest,r.imageDigest,'authenticated ECR digest');
 yes(detail.imageTags?.includes(p.imageTag),'authenticated ECR unique tag');scan(operator.ecrScan,r.imageDigest);
 equal(provenance.schema,'meri.operator-launch-measurement-result.v1','result schema');
 equal(provenance.planSha256,plan.planSha256,'plan bytes');equal(provenance.attempt,plan.attempt,'attempt receipt');
 equal(provenance.image,plan.image,'result image');equal(provenance.sourceCommit,p.sourceCommit,'result commit');
 equal(provenance.sourceVersion,p.archive.versionId,'result source version');equal(provenance.cleanup,'COMPLETE','cleanup');
 const inspection=provenance.inspection;
 yes(inspection.RepoDigests?.includes(plan.image),'RepoDigests');
 equal(inspection.Os,'linux','image os');equal(inspection.Architecture,'amd64','image arch');
 equal(inspection.Config.User,'node','image user');equal(inspection.Config.WorkingDir,'/opt/meri','image workdir');
 equal(inspection.Config.Entrypoint,['node','apps/runtime/cli.mjs'],'image entrypoint');yes(inspection.Size>0&&inspection.Size<=3*1024**3,'image bound');
 for(const [label,value]of Object.entries({'org.opencontainers.image.revision':p.sourceCommit,'org.opencontainers.image.base.name':p.runtimeBaseImageUri,'io.meri.node.base':p.nodeImageUri,'io.meri.runtime.packages.sha256':p.runtimePackagesSha256}))equal(inspection.Config.Labels[label],value,label);
 equal(launch.schema,'meri.first-chat-launch-measurement.v2','launch schema');
 for(const platform of [launch.platform,readback.platform])for(const [key,value]of Object.entries({os:'linux',arch:'x64',node:p.nodeVersion,uid:1000}))equal(platform[key],value,'runtime '+key);
 equal(readback.platform.gid,1000,'gid');
 equal(launch.versions,{sdk:'0.3.295',cli:'2.1.295',platformPackage:{name:'@anthropic-ai/claude-agent-sdk-linux-x64',version:'0.3.295'}},'versions');
 equal(readback.sdkVersion,launch.versions.sdk,'readback SDK');equal(readback.platformPackage,launch.versions.platformPackage,'readback platform package');
 equal(launch.module.sha256,plan.sourcePins[MODULE].sha256,'launch module');equal(readback.module.sha256,launch.module.sha256,'readback module');
 equal(readback.module.path,'/opt/meri/'+MODULE,'module path');
 const expectedRunner={contract:'meri.runner-entrypoint.v1',path:RUNNER,runnerSha256:p.runnerSha256,bytes:plan.sourcePins[RUNNER].bytes};
 equal(readback.runner,expectedRunner,'independent runner');equal(r.runnerMeasurement,expectedRunner,'producer runner');
 equal(launch.runner,{path:RUNNER,sha256:p.runnerSha256,bytes:expectedRunner.bytes},'launch runner');
 equal(readback.nodeExecutable.sha256,r.executableSha256,'Node executable');
 equal(readback.nodeExecutable.path,'/usr/local/bin/node','Node executable path');
 equal(launch.executable.path,CLI,'native CLI path');equal(readback.executable.path,CLI,'native CLI realpath');
 for(const key of ['sha256','bytes'])equal(readback.executable[key],launch.executable[key],'native CLI '+key);
 yes(/^[a-f0-9]{64}$/.test(launch.executable.sha256),'native CLI hash shape');
 yes(Number.isInteger(launch.executable.bytes)&&launch.executable.bytes>0&&launch.executable.bytes<=268435456,'native CLI bound');
 equal(readback.executable.isFile,true,'native file');equal(readback.executable.executable,true,'native executable');equal(readback.executable.cliVersionMarker,true,'native version marker');
 equal(launch.launchTemplate.command,CLI,'launch command');equal(launch.launchTemplateRunInvariant,true,'launch invariant');
 equal(Object.keys(launch.gates).sort(),[...GATES].sort(),'gate set');for(const gate of GATES)equal(launch.gates[gate],'PASS',gate);
 equal(launch.sdkOptions.schema,'meri.sdk-options-template.v1','options schema');equal(launch.sdkOptions.runInvariant,true,'options invariant');equal(launch.sdkOptions.secondProbeSha256,launch.sdkOptions.sha256,'second options probe');
 equal(launch.sdkOptions.sha256,plan.expected.sdkOptionsSha256,'source options');equal(launch.skills,plan.expected.skills,'source skills');
 equal(launch.inputs,plan.expected.inputs,'complete measurement inputs');
 equal(launch.generalReadInstallation,plan.expected.generalReadInstallation,'source installation');
 equal(launch.generalReadInventory,plan.expected.generalReadInventory,'source full inventory');
 equal(native,r.nativeCompatibility,'independent native compatibility');equal(packages,r.runtimePackageMeasurement,'independent runtime packages');
 equal(native.status,'RUNTIME_NATIVE_VERIFIED','native status');equal(native.schemaVersion,1,'native schema');equal(native.nodeVersion,p.nodeVersion,'native Node');equal(native.swcTarget,'x86_64-unknown-linux-gnu','native target');equal(native.swcCacheIndependent,true,'native cache');equal(native.temporalNativeLoaded,true,'native Temporal');
 equal(packages.status,'RUNTIME_PACKAGES_VERIFIED','packages status');equal(packages.schemaVersion,1,'packages schema');equal(packages.nodeVersion,p.nodeVersion,'packages Node');equal(packages.runtimeBaseImageUri,p.runtimeBaseImageUri,'packages base');equal(packages.runtimePackagesSha256,p.runtimePackagesSha256,'packages lock');equal(packages.glibcVersion,native.glibcVersion,'native glibc');
 return {status:'MEASUREMENT_JOINS_MATCH_ONLY',sourceCommit:p.sourceCommit,image:plan.image,measurementBuildId:provenance.buildId,enabledCapabilityProfile:plan.expected.inputs.capabilityProfileSha256!==null,activeReadSubset:plan.expected.inputs.activeReadOperationsSha256!==undefined};
}
