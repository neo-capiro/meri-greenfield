import test from 'node:test';
import assert from 'node:assert/strict';
import {compareProductImageMetadata} from './image-provenance.mjs';

const digest=character=>character.repeat(64);
function evidence(){
 const projectArn='arn:aws:codebuild:us-east-1:967807252336:project/meri-product-preview-build';
 const repositoryUri='967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/product-runtime';
 const imageDigest=`sha256:${digest('d')}`;
 const measurement={contract:'meri.runner-entrypoint.v1',path:'apps/runtime/conversation-runner.mjs',runnerSha256:digest('f'),bytes:1234};
 const runtimeBaseImageUri=`cgr.dev/chainguard/wolfi-base@sha256:${digest('1')}`;
 const runtimePackageMeasurement={schemaVersion:1,status:'RUNTIME_PACKAGES_VERIFIED',runtimeBaseImageUri,runtimePackagesSha256:digest('2'),installedPackageSetSha256:digest('3'),nodeVersion:'v24.21.0',glibcVersion:'2.41'};
 const nativeMeasurement={schemaVersion:1,status:'RUNTIME_NATIVE_VERIFIED',nodeVersion:'v24.21.0',glibcVersion:'2.41',swcTarget:'x86_64-unknown-linux-gnu',swcNativeSha256:digest('4'),temporalNativeSha256:digest('5'),swcCacheIndependent:true,temporalNativeLoaded:true};
 return {
  pin:{schemaVersion:2,sourceCommit:'a'.repeat(40),archiveSha256:digest('b'),dockerfileSha256:digest('c'),nodeImageUri:`public.ecr.aws/docker/library/node@sha256:${digest('e')}`,nodeVersion:'v24.21.0',runtimeBaseImageUri,runtimePackagesSha256:digest('2'),sourceVersion:'s3-version-one',codeBuildProjectArn:projectArn,ecrRepositoryUri:repositoryUri},
  build:{id:'meri-product-preview-build:12345678-1234-1234-1234-123456789abc',projectArn,status:'SUCCEEDED',sourceVersion:'s3-version-one'},
  producer:{buildId:'meri-product-preview-build:12345678-1234-1234-1234-123456789abc',sourceVersion:'s3-version-one',sourceCommit:'a'.repeat(40),archiveSha256:digest('b'),dockerfileSha256:digest('c'),nodeImageUri:`public.ecr.aws/docker/library/node@sha256:${digest('e')}`,nodeVersion:'v24.21.0',runtimeBaseImageUri,runtimePackagesSha256:digest('2'),installedPackageSetSha256:digest('3'),glibcVersion:'2.41',runtimePackageMeasurement,nativeCompatibility:{...nativeMeasurement},imageDigest,runnerSha256:digest('f'),runnerMeasurement:{...measurement}},
  ecr:{repositoryUri,imageDigest,scanStatus:'COMPLETE',findingSeverityCounts:{MEDIUM:2}},
  manifest:{imageUri:`${repositoryUri}@${imageDigest}`,runnerSha256:digest('f')},measurement,nativeMeasurement
 };
}

test('joins a selected source pin, S3 build version, producer result, ECR digest and disabled manifest without claiming qualification',()=>{
 const result=compareProductImageMetadata(evidence());
 assert.deepEqual(result,{status:'METADATA_MATCH_ONLY',sourceCommit:'a'.repeat(40),archiveSha256:digest('b'),imageUri:evidence().manifest.imageUri,runnerSha256:digest('f'),runtimeBaseImageUri:evidence().pin.runtimeBaseImageUri,runtimePackagesSha256:digest('2'),installedPackageSetSha256:digest('3'),swcNativeSha256:digest('4'),temporalNativeSha256:digest('5')});
});
test('requires independent entrypoint measurement and rejects altered object, hash or byte count',()=>{
 for(const mutate of [v=>{delete v.measurement;},v=>{v.measurement.path='apps/runtime/cli.mjs';},v=>{v.measurement.runnerSha256=digest('0');},v=>{v.measurement.bytes++;},v=>{v.producer.runnerMeasurement.runnerSha256=digest('0');},v=>{v.producer.runnerMeasurement.contract='environment-declaration';}]){const value=evidence();mutate(value);assert.throws(()=>compareProductImageMetadata(value),/PRODUCT_IMAGE_/u);}
});
test('rejects a different S3 source version even when source and image declarations match',()=>{
 const value=evidence();value.build.sourceVersion='s3-version-other';
 assert.throws(()=>compareProductImageMetadata(value),/PRODUCT_IMAGE_SOURCE_VERSION_MISMATCH/u);
});
test('rejects a different archive hash and an incomplete producer receipt',()=>{
 const archive=evidence();archive.producer.archiveSha256=digest('0');
 assert.throws(()=>compareProductImageMetadata(archive),/PRODUCT_IMAGE_ARCHIVE_SHA_MISMATCH/u);
 const incomplete=evidence();delete incomplete.producer.dockerfileSha256;
 assert.throws(()=>compareProductImageMetadata(incomplete),/PRODUCT_IMAGE_EVIDENCE_SHAPE_REFUSED/u);
});
test('rejects a producer digest that differs from ECR, and a manifest runner hash that differs from measurement',()=>{
 const image=evidence();image.ecr.imageDigest=`sha256:${digest('0')}`;
 assert.throws(()=>compareProductImageMetadata(image),/PRODUCT_IMAGE_ECR_DIGEST_MISMATCH/u);
 const runner=evidence();runner.manifest.runnerSha256=digest('0');
 assert.throws(()=>compareProductImageMetadata(runner),/PRODUCT_IMAGE_RUNNER_SHA_MISMATCH/u);
});
test('keeps floating bases and nonempty critical or high scan findings on hold',()=>{
 const base=evidence();base.pin.nodeImageUri='node:24';
 assert.throws(()=>compareProductImageMetadata(base),/PRODUCT_IMAGE_BINDING_REFUSED/u);
 const scan=evidence();scan.ecr.findingSeverityCounts.HIGH=1;
 assert.throws(()=>compareProductImageMetadata(scan),/PRODUCT_IMAGE_SCAN_FINDINGS_HOLD/u);
});
test('requires exact runtime base, lock, installed set and measured libc joins',()=>{
 for(const mutate of [v=>{v.pin.schemaVersion=1;},v=>{v.pin.runtimeBaseImageUri='wolfi:latest';},v=>{v.producer.runtimeBaseImageUri=v.pin.nodeImageUri;},v=>{v.producer.runtimePackagesSha256=digest('0');},v=>{v.producer.runtimePackageMeasurement.installedPackageSetSha256=digest('0');},v=>{v.producer.glibcVersion='2.99';},v=>{delete v.producer.runtimePackageMeasurement;},v=>{delete v.nativeMeasurement;},v=>{v.nativeMeasurement.swcNativeSha256=digest('0');},v=>{v.producer.nativeCompatibility.temporalNativeLoaded=false;}]){
  const value=evidence();mutate(value);assert.throws(()=>compareProductImageMetadata(value),/PRODUCT_IMAGE_/u);
 }
});
