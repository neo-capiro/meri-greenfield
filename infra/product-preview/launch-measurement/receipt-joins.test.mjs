import test from 'node:test';
import assert from 'node:assert/strict';
import {joinMeasurement,joinArtifactDownloads,measurementStartRequest,artifactPrefix,ARTIFACT_NAMES,PROJECT_ROLE_ARN,hash,CLI,MODULE,RUNNER,GATES} from './receipt-joins.mjs';
/** The measured commit as the operator passes it (--source-commit); synthetic here. */
const SOURCE_COMMIT='3dc993ef81846730ac696bb482b653162da8920c';
function fixture(){
 const h=n=>String(n).repeat(64),digest='sha256:'+h(7),repository='967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker';
 const request={schemaVersion:2,sourceCommit:SOURCE_COMMIT,dockerfileSha256:h(1),nodeImageUri:'public.ecr.aws/docker/library/node@sha256:'+h(2),nodeVersion:'v24.21.0',runtimeBaseImageUri:'cgr.dev/chainguard/wolfi-base@sha256:'+h(3),runtimePackagesSha256:h(4),runnerSha256:h(5),runtimeUser:'1000:1000',verifierSha256:h(6),producerSha256:h(8),archive:{bucket:'approved-bucket',key:'exact.zip',versionId:'version-one',sha256:h(1)},manifest:{sha256:h(2)},ecrRepositoryUri:repository,imageTag:'product-'+SOURCE_COMMIT+'-'+'a'.repeat(32),codeBuildProjectArn:'arn:aws:codebuild:us-east-1:967807252336:project/meri-greenfield-qualification-build'};
 const image=repository+'@'+digest,runner={contract:'meri.runner-entrypoint.v1',path:RUNNER,runnerSha256:h(5),bytes:17250};
 const native={schemaVersion:1,status:'RUNTIME_NATIVE_VERIFIED',nodeVersion:request.nodeVersion,glibcVersion:'2.44',swcTarget:'x86_64-unknown-linux-gnu',swcNativeSha256:h(1),temporalNativeSha256:h(2),swcCacheIndependent:true,temporalNativeLoaded:true};
 const packages={schemaVersion:1,status:'RUNTIME_PACKAGES_VERIFIED',nodeVersion:request.nodeVersion,glibcVersion:'2.44',runtimeBaseImageUri:request.runtimeBaseImageUri,runtimePackagesSha256:request.runtimePackagesSha256};
 const receipt={...request,sourceVersion:'version-one',archiveSha256:h(1),sourceManifestSha256:h(2),imageDigest:digest,buildId:'product-build-id',scanStatus:'COMPLETE',runnerMeasurement:runner,executableSha256:h(9),nativeCompatibility:native,runtimePackageMeasurement:packages};
 const platform={os:'linux',arch:'x64',node:'v24.21.0',uid:1000},platformPackage={name:'@anthropic-ai/claude-agent-sdk-linux-x64',version:'0.3.295'};
 const executable={path:CLI,sha256:h(4),bytes:100};
 const launch={schema:'meri.first-chat-launch-measurement.v2',platform,versions:{sdk:'0.3.295',cli:'2.1.295',platformPackage},module:{sha256:h(6)},runner:{path:RUNNER,sha256:h(5),bytes:17250},executable,launchTemplate:{command:CLI},launchTemplateRunInvariant:true,gates:Object.fromEntries(GATES.map(k=>[k,'PASS'])),sdkOptions:{schema:'meri.sdk-options-template.v1',runInvariant:true,sha256:h(3),secondProbeSha256:h(3)},skills:{digest:h(2)},inputs:{capabilityProfileSha256:null},generalReadInstallation:{measurement:{operations:[{id:'inventory'}]},measurementSha256:h(8)}};
 const readback={platform:{...platform,gid:1000},sdkVersion:'0.3.295',platformPackage,module:{path:'/opt/meri/'+MODULE,sha256:h(6)},runner,nodeExecutable:{path:'/usr/local/bin/node',sha256:h(9)},executable:{...executable,isFile:true,executable:true,cliVersionMarker:true}};
 const plan={schema:'meri.operator-launch-measurement-plan.v1',request,productReceipt:receipt,image,attempt:'a'.repeat(32),projectRoleArn:PROJECT_ROLE_ARN,planSha256:h(1),buildspecSha256:hash('approved-buildspec'),sourcePins:{[MODULE]:{sha256:h(6)},[RUNNER]:{bytes:17250}},expected:{sdkOptionsSha256:h(3),skills:launch.skills,inputs:launch.inputs,generalReadInstallation:launch.generalReadInstallation}};
 const build=id=>({id,buildStatus:'SUCCEEDED',buildComplete:true,timeoutInMinutes:10,queuedTimeoutInMinutes:5,autoRetryConfig:{autoRetryLimit:0,autoRetryNumber:0},projectName:'meri-greenfield-qualification-build',serviceRole:plan.projectRoleArn,sourceVersion:'version-one',source:{type:'S3',location:'approved-bucket/exact.zip',buildspec:'approved-buildspec'},environment:{type:'LINUX_CONTAINER',privilegedMode:true,computeType:'BUILD_GENERAL1_SMALL',image:'aws/codebuild/standard:7.0'}});
 const operator={productBuild:build(receipt.buildId),measurementBuild:build('measurement-build-id'),ecrImage:{imageDigest:digest,imageTags:[request.imageTag]},ecrScan:{imageId:{imageDigest:digest},imageScanStatus:{status:'COMPLETE'},imageScanFindings:{findingSeverityCounts:{}}}};
 operator.productBuild.timeoutInMinutes=30;operator.measurementStart={id:'measurement-build-id'};plan.productBuildspecSha256=hash('approved-buildspec');
 operator.measurementBuild.artifacts={location:'arn:aws:s3:::'+request.archive.bucket+'/'+artifactPrefix(plan)};
 const provenance={schema:'meri.operator-launch-measurement-result.v1',buildId:'measurement-build-id',planSha256:plan.planSha256,attempt:plan.attempt,image,sourceCommit:SOURCE_COMMIT,sourceVersion:'version-one',cleanup:'COMPLETE',inspection:{RepoDigests:[image],Os:'linux',Architecture:'amd64',Size:123,Config:{User:'node',WorkingDir:'/opt/meri',Entrypoint:['node','apps/runtime/cli.mjs'],Labels:{'org.opencontainers.image.revision':SOURCE_COMMIT,'org.opencontainers.image.base.name':request.runtimeBaseImageUri,'io.meri.node.base':request.nodeImageUri,'io.meri.runtime.packages.sha256':request.runtimePackagesSha256}}}};
 // Real evidence is separately parsed JSON: destroy fixture aliases too, so a
 // tamper to an observed object cannot also mutate its independent expectation.
 return JSON.parse(JSON.stringify({plan,launch,readback,native,packages,provenance,operator,sourceCommit:SOURCE_COMMIT}));
}
test('complete synthetic evidence joins without turning absent C features into activation',()=>{
 const result=joinMeasurement(fixture());assert.equal(result.status,'MEASUREMENT_JOINS_MATCH_ONLY');assert.equal(result.enabledCapabilityProfile,false);assert.equal(result.activeReadSubset,false);
});
for(const [name,change]of [
 ['foreign digest despite matching runner',v=>{v.provenance.inspection.RepoDigests=['foreign@sha256:'+'7'.repeat(64)];}],
 ['module tamper',v=>{v.launch.module.sha256='0'.repeat(64);}],
 ['runner byte count mismatch',v=>{v.readback.runner.bytes++;}],
 ['Node hash substituted for native CLI',v=>{v.launch.executable.sha256=v.plan.productReceipt.executableSha256;}],
 ['Windows platform',v=>{v.launch.platform.os='win32';}],
 ['wrong native package',v=>{v.readback.platformPackage.name='@anthropic-ai/claude-agent-sdk-linux-x64-musl';}],
 ['failed launch gate',v=>{v.launch.gates.executable='FAIL';}],
 ['missing launch invariance',v=>{delete v.launch.launchTemplateRunInvariant;}],
 ['invented active read subset',v=>{v.launch.inputs.activeReadOperationsSha256='0'.repeat(64);}],
 ['full inventory truncation',v=>{v.launch.generalReadInstallation.measurement.operations=[];}],
 ['native compatibility tamper',v=>{v.native.temporalNativeLoaded=false;}],
 ['unknown cleanup',v=>{v.provenance.cleanup='UNKNOWN';}],
 ['another operator source commit',v=>{v.sourceCommit='0'.repeat(40);}],
 ['failed authenticated build',v=>{v.operator.measurementBuild.buildStatus='FAILED';}],
 ['wrong immutable source version',v=>{v.operator.measurementBuild.sourceVersion='other';}],
 ['changed actual override',v=>{v.operator.measurementBuild.source.buildspec='changed';}],
 ['HIGH finding',v=>{v.operator.ecrScan.imageScanFindings.findingSeverityCounts.HIGH=1;}],
 ['wrong source commit',v=>{v.provenance.sourceCommit='9acbfe7168eb4e9c1e2c3acb02e2a28d08bbd262';}],
 ['expanded measurement timeout',v=>{v.operator.measurementBuild.timeoutInMinutes=60;}],
 ['automatic retry enabled',v=>{v.operator.measurementBuild.autoRetryConfig.autoRetryLimit=1;}],
 ['unsubmitted build substitution',v=>{v.operator.measurementStart.id='another-build';}],
 ['nonterminal producer',v=>{v.operator.productBuild.buildComplete=false;}],
 ['same build reused',v=>{v.plan.productReceipt.buildId='measurement-build-id';v.operator.productBuild.id='measurement-build-id';}],
 ['different existing project',v=>{v.plan.request.codeBuildProjectArn+='-other';}],
 ['different role',v=>{v.plan.projectRoleArn+='-other';}],
 ['foreign artifact prefix',v=>{v.operator.measurementBuild.artifacts.location+='/other';}],
])test('refuses '+name,()=>{const value=fixture();change(value);assert.throws(()=>joinMeasurement(value),/MEASUREMENT_JOIN_REFUSED/);});
test('the source commit is an exact 40-hex operator argument, never defaulted',()=>{
 for(const commit of [undefined,'3dc993ef','3DC993EF81846730AC696BB482B653162DA8920C'])assert.throws(()=>joinMeasurement({...fixture(),sourceCommit:commit}),/--source-commit must be 40 lowercase hex/);
});

function downloadFixture(){
 const {plan}=fixture(),buildId='measurement-build-id';
 const resultBytes=Object.fromEntries(ARTIFACT_NAMES.map(name=>[name,Buffer.from('{"synthetic":true}\n')]));
 const downloads={schema:'meri.measurement-artifact-downloads.v1',buildId,files:ARTIFACT_NAMES.map(name=>({name,bucket:plan.request.archive.bucket,key:artifactPrefix(plan)+'/'+name,versionId:'selected-version',bytes:resultBytes[name].length,sha256:hash(resultBytes[name])}))};
 return {plan,buildId,downloads,resultBytes};
}
test('six selected-version artifact byte joins',()=>assert.equal(joinArtifactDownloads(downloadFixture()),true));
for(const [name,change]of [
 ['artifact stale build',v=>{v.downloads.buildId='other';}],
 ['artifact wrong key',v=>{v.downloads.files[0].key+='other';}],
 ['artifact wrong bucket',v=>{v.downloads.files[0].bucket='other';}],
 ['artifact null version',v=>{v.downloads.files[0].versionId='null';}],
 ['artifact missing file',v=>{v.downloads.files.pop();}],
 ['artifact substituted bytes',v=>{v.resultBytes[ARTIFACT_NAMES[0]]=Buffer.from('tamper');}],
])test('refuses '+name,()=>{const value=downloadFixture();change(value);assert.throws(()=>joinArtifactDownloads(value),/MEASUREMENT_JOIN_REFUSED/);});
test('submission has only bounded existing-project measurement overrides',()=>{
 const {plan}=fixture(),request=measurementStartRequest(plan,'spec');
 assert.equal(request.projectName,'meri-greenfield-qualification-build');assert.equal(request.timeoutInMinutesOverride,10);assert.equal(request.queuedTimeoutInMinutesOverride,5);assert.equal(request.autoRetryLimitOverride,0);assert.equal(request.sourceVersion,plan.request.archive.versionId);assert.equal(request.artifactsOverride.path,artifactPrefix(plan));assert.equal(request.artifactsOverride.location,plan.request.archive.bucket);assert.equal(request.buildspecOverride,'spec');assert.equal(Object.hasOwn(request,'environmentVariablesOverride'),false);
});
