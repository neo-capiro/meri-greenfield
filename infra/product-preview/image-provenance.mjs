/**
 * Compare independently supplied product-image metadata before a reviewed build
 * can be considered for the disabled preview manifest. This makes no AWS calls
 * and does not prove the source ZIP bytes, builder execution, or runtime behavior.
 * The caller must independently authenticate the CodeBuild and producer records,
 * verify the archive bytes against the S3 object version, and measure the runner.
 * Preview policy requires a completed scan with zero HIGH and CRITICAL findings;
 * a different policy requires a separately reviewed source change.
 */
const sha=/^[a-f0-9]{64}$/u;
const imageDigest=/^sha256:[a-f0-9]{64}$/u;
const commit=/^[a-f0-9]{40}$/u;
const digestUri=/^[^@\s]+@sha256:[a-f0-9]{64}$/u;
const ecrUri=/^967807252336\.dkr\.ecr\.us-east-1\.amazonaws\.com\/[a-z0-9._/-]+$/u;
const projectArn=/^arn:aws:codebuild:us-east-1:967807252336:project\/[A-Za-z0-9_-]+$/u;
const refuse=reason=>{throw Error(`PRODUCT_IMAGE_${reason}`);};
function exact(value,keys){
 if(value===null||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype||
    keys.some(key=>!Object.hasOwn(value,key))||Object.keys(value).some(key=>!keys.includes(key)))refuse('EVIDENCE_SHAPE_REFUSED');
 return value;
}
function same(left,right,reason){if(left!==right)refuse(reason);}

/**
 * All arguments are narrow, nonsecret projections supplied by the review owner.
 * A matching result is a metadata join only, not an image or deployment admission.
 */
export function compareProductImageMetadata(evidence){
 const {pin,build,producer,ecr,manifest}=exact(evidence,['pin','build','producer','ecr','manifest']);
 const p=exact(pin,['sourceCommit','archiveSha256','dockerfileSha256','nodeImageUri','sourceVersion','codeBuildProjectArn','ecrRepositoryUri']);
 const b=exact(build,['id','projectArn','status','sourceVersion']);
 const r=exact(producer,['buildId','sourceVersion','sourceCommit','archiveSha256','dockerfileSha256','nodeImageUri','imageDigest','runnerSha256']);
 const e=exact(ecr,['repositoryUri','imageDigest','scanStatus','findingSeverityCounts']);
 const m=exact(manifest,['imageUri','runnerSha256']);
 if(!commit.test(p.sourceCommit)||![p.archiveSha256,p.dockerfileSha256,r.runnerSha256].every(v=>sha.test(v))||!imageDigest.test(r.imageDigest)||
    !digestUri.test(p.nodeImageUri)||!projectArn.test(p.codeBuildProjectArn)||!ecrUri.test(p.ecrRepositoryUri)||
    typeof p.sourceVersion!=='string'||p.sourceVersion.length<1||p.sourceVersion.length>256||/[\x00-\x1f\x7f]/u.test(p.sourceVersion)||
    typeof b.id!=='string'||!b.id.startsWith(p.codeBuildProjectArn.split('/')[1]+':')||!/^.+:[a-f0-9-]{36}$/u.test(b.id)||
    !imageDigest.test(e.imageDigest)||!ecrUri.test(e.repositoryUri)||!digestUri.test(m.imageUri)||!sha.test(m.runnerSha256))refuse('BINDING_REFUSED');
 same(b.projectArn,p.codeBuildProjectArn,'PROJECT_MISMATCH');
 same(b.status,'SUCCEEDED','BUILD_NOT_SUCCEEDED');
 same(b.sourceVersion,p.sourceVersion,'SOURCE_VERSION_MISMATCH');
 same(r.buildId,b.id,'BUILD_ID_MISMATCH');
 same(r.sourceVersion,p.sourceVersion,'PRODUCER_SOURCE_VERSION_MISMATCH');
 same(r.sourceCommit,p.sourceCommit,'SOURCE_COMMIT_MISMATCH');
 same(r.archiveSha256,p.archiveSha256,'ARCHIVE_SHA_MISMATCH');
 same(r.dockerfileSha256,p.dockerfileSha256,'DOCKERFILE_SHA_MISMATCH');
 same(r.nodeImageUri,p.nodeImageUri,'NODE_BASE_MISMATCH');
 same(e.repositoryUri,p.ecrRepositoryUri,'REPOSITORY_MISMATCH');
 same(e.imageDigest,r.imageDigest,'ECR_DIGEST_MISMATCH');
 same(m.imageUri,`${p.ecrRepositoryUri}@${e.imageDigest}`,'MANIFEST_IMAGE_MISMATCH');
 same(m.runnerSha256,r.runnerSha256,'RUNNER_SHA_MISMATCH');
 same(e.scanStatus,'COMPLETE','SCAN_NOT_COMPLETE');
 const counts=e.findingSeverityCounts;
 if(counts===null||typeof counts!=='object'||Array.isArray(counts)||Object.getPrototypeOf(counts)!==Object.prototype||
    Object.values(counts).some(n=>!Number.isSafeInteger(n)||n<0)||
    (counts.CRITICAL??0)>0||(counts.HIGH??0)>0)refuse('SCAN_FINDINGS_HOLD');
 return Object.freeze({status:'METADATA_MATCH_ONLY',sourceCommit:p.sourceCommit,archiveSha256:p.archiveSha256,imageUri:m.imageUri,runnerSha256:m.runnerSha256});
}
