/** Local proposal: immutable preview-attempt custody. A claim survives every uncertain effect and is never reused for dispatch. */
const fail=code=>{throw Object.assign(new Error(code),{code});};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
export const PREVIEW_CLAIM_VERSION='meri.artifact-preview-claim.proposal-1';
export function previewClaim(v,version,allocation,context,createdAt){
 const value={claimVersion:PREVIEW_CLAIM_VERSION,versionId:version.versionId,artifactId:version.artifactId,tenantId:version.binding.tenantId,conversationId:version.binding.conversationId,
  sourceVersionSha256:v.hash(version),sourceSha256:version.object.sha256,binding:v.snapshot(context.binding),scopes:v.snapshot(version.scopes),deadlineMs:context.deadlineMs,
  previewId:allocation?.versionId,objectId:allocation?.objectId,createdAt};
 if(!UUID.test(value.previewId??'')||!UUID.test(value.objectId??''))fail('ARTIFACT_PREVIEW_CLAIM');return v.snapshot(value);
}
export function verifyPreviewClaim(v,claim,version){
 if(!claim||claim.claimVersion!==PREVIEW_CLAIM_VERSION||claim.versionId!==version.versionId||claim.artifactId!==version.artifactId||claim.tenantId!==version.binding.tenantId||claim.conversationId!==version.binding.conversationId||
  claim.sourceVersionSha256!==v.hash(version)||claim.sourceSha256!==version.object.sha256||v.hash(claim.scopes)!==v.hash(version.scopes)||!UUID.test(claim.previewId??'')||!UUID.test(claim.objectId??''))fail('ARTIFACT_PREVIEW_CLAIM');
 return v.snapshot(claim);
}
