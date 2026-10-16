/** Local proposal: immutable preview-attempt custody. A claim survives every uncertain effect and is never reused for dispatch. */
const fail=code=>{throw Object.assign(new Error(code),{code});};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
const KEYS=['claimVersion','versionId','artifactId','tenantId','conversationId','sourceVersionSha256','sourceSha256','binding','scopes','deadlineMs','previewId','objectId','createdAt'];
export const PREVIEW_CLAIM_VERSION='meri.artifact-preview-claim.proposal-1';
export function previewClaim(v,version,allocation,context,createdAt){
 const value={claimVersion:PREVIEW_CLAIM_VERSION,versionId:version.versionId,artifactId:version.artifactId,tenantId:version.binding.tenantId,conversationId:version.binding.conversationId,
  sourceVersionSha256:v.hash(version),sourceSha256:version.object.sha256,binding:v.snapshot(context.binding),scopes:v.snapshot(version.scopes),deadlineMs:context.deadlineMs,
  previewId:allocation?.versionId,objectId:allocation?.objectId,createdAt};
 return verifyPreviewClaim(v,value,version);
}
export function verifyPreviewClaim(v,value,version){
 let claim;try{claim=v.snapshot(value);
  if(!claim||Object.keys(claim).length!==KEYS.length||KEYS.some(key=>!Object.hasOwn(claim,key)))fail('ARTIFACT_PREVIEW_CLAIM');
  // Reuse canonical RunBinding/Scope/deadline validation. This packet retains historical authority; it does not remint a context.
  v.context({binding:claim.binding,scopes:claim.scopes,deadlineMs:claim.deadlineMs,evidence:[],assets:[],maxBytes:1});
  const created=Date.parse(claim.createdAt);
  if(typeof claim.createdAt!=='string'||!Number.isSafeInteger(created)||created<0||new Date(created).toISOString()!==claim.createdAt||claim.deadlineMs<=created||
   claim.binding.tenantId!==claim.tenantId||claim.binding.conversationId!==claim.conversationId)fail('ARTIFACT_PREVIEW_CLAIM');
 }catch{fail('ARTIFACT_PREVIEW_CLAIM');}
 if(!claim||claim.claimVersion!==PREVIEW_CLAIM_VERSION||claim.versionId!==version.versionId||claim.artifactId!==version.artifactId||claim.tenantId!==version.binding.tenantId||claim.conversationId!==version.binding.conversationId||
  claim.sourceVersionSha256!==v.hash(version)||claim.sourceSha256!==version.object.sha256||v.hash(claim.scopes)!==v.hash(version.scopes)||!UUID.test(claim.previewId??'')||!UUID.test(claim.objectId??''))fail('ARTIFACT_PREVIEW_CLAIM');
 return claim;
}
