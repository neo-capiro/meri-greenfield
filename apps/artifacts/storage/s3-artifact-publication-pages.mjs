/** Immutable pages share the existing publication purpose, bucket, KMS key and native verifier.
 * Orphan pages cannot publish anything. Neither page writes nor lost ACKs advance the root. */
import {PutObjectCommand} from './s3-sdk.mjs';
import {v,own,same,sha,digest,storageMethod,fail} from './boundary.mjs';
import {createS3ArtifactObjects} from './s3-objects.mjs';
import {readS3ConditionalDocument} from './s3-conditional-document.mjs';
import {ARTIFACT_PUBLICATION_PAGE_NAMESPACE as namespace,verifyPublicationPage} from './artifact-publication-pages.mjs';
export function createS3ArtifactPublicationPages(options){
 const {client,bucket,prefix,expectedBucketOwner,kmsKeyId,tenantId,now,maxRequestMs=15000}=own(options,['client','bucket','prefix','expectedBucketOwner','kmsKeyId','tenantId','now'],['maxRequestMs']);
 createS3ArtifactObjects({client,bucket,prefix,expectedBucketOwner,kmsKeyId,now,maxRequestMs});
 const send=storageMethod(client,'send'),tenantSha256=v.hash(tenantId),parse=value=>verifyPublicationPage(value,tenantId),target=hash=>({Bucket:bucket,Key:`${prefix}/artifact-publication/${tenantSha256}/pages/${digest(hash)}.json`,ExpectedBucketOwner:expectedBucketOwner});
 const nativeRead=(life,hash,versionId)=>readS3ConditionalDocument({send,target:target(hash),tenantSha256,namespace,kmsKeyId,maxIndexBytes:8388608,parse,errorPrefix:'ARTIFACT_PUBLICATION'},life,versionId);
 async function checked(life,hash,versionId){const result=await nativeRead(life,hash,versionId);if(v.hash(result.value)!==hash)fail('ARTIFACT_PUBLICATION_CORRUPT');return result;}
 async function read(life,reference){return (await checked(life,reference.sha256,reference.versionId)).value;}
 async function write(life,value,hash){const page=parse(value);if(v.hash(page)!==digest(hash))fail('ARTIFACT_PUBLICATION_CORRUPT');const bytes=Buffer.from(JSON.stringify(page)),contentSha256=sha(bytes),checksum=Buffer.from(contentSha256,'hex').toString('base64');let response;
  try{response=await life.run(signal=>send(new PutObjectCommand({...target(hash),Body:bytes,ContentLength:bytes.length,ContentType:'application/json',IfNoneMatch:'*',ChecksumAlgorithm:'SHA256',ChecksumSHA256:checksum,ChecksumType:'FULL_OBJECT',ServerSideEncryption:'aws:kms',SSEKMSKeyId:kmsKeyId,BucketKeyEnabled:false,Metadata:{namespace,tenantsha256:tenantSha256,contentsha256:contentSha256}}),{abortSignal:signal}));}
  catch(cause){if(cause?.$metadata?.httpStatusCode===412){const prior=await checked(life,hash);if(!same(prior.value,page))fail('ARTIFACT_PUBLICATION_CORRUPT');return {versionId:prior.versionId};}throw Object.assign(Error('ARTIFACT_PUBLICATION_ACK_UNKNOWN'),{code:'ARTIFACT_PUBLICATION_ACK_UNKNOWN',cause});}
  try{if(typeof response.VersionId!=='string'||!response.VersionId||response.ChecksumSHA256!==checksum||response.ChecksumType!=='FULL_OBJECT'||response.ServerSideEncryption!=='aws:kms'||response.SSEKMSKeyId!==kmsKeyId)fail('ARTIFACT_PUBLICATION_CORRUPT');const back=await checked(life,hash,response.VersionId);if(!same(back.value,page))fail('ARTIFACT_PUBLICATION_CORRUPT');return {versionId:back.versionId};}
  catch(cause){throw Object.assign(Error('ARTIFACT_PUBLICATION_ACK_UNKNOWN'),{code:'ARTIFACT_PUBLICATION_ACK_UNKNOWN',cause});}
 }
 return Object.freeze({read,write});
}
