/** Actual AWS SDK commands; native S3 version identity is never a content digest. */
import {S3Client,PutObjectCommand,GetObjectCommand,HeadObjectCommand,GetBucketVersioningCommand} from '@aws-sdk/client-s3';
import {Readable} from 'node:stream';
import {v,own,data,fail,sha,uuid,digest,scopeFacts,storageLifetime,configuration,storageMethod,bucketIdentity} from './boundary.mjs';
import {createAllocationLookup} from './allocation-lookup.mjs';
const retire=body=>{try{if(body instanceof Readable)body.destroy();else if(body instanceof ReadableStream)Promise.resolve(body.cancel()).catch(()=>{});}catch{}};
const nativeVersion=value=>{if(typeof value!=='string'||value==='null'||!value.length||Buffer.byteLength(value)>1024||!value.isWellFormed())fail('ARTIFACT_S3_VERSION');return value;};
export function createS3ArtifactObjects(options){
 const {client,bucket,prefix,expectedBucketOwner,kmsKeyId,now,maxRequestMs=15000,maxBytes=8388608}=own(options,['client','bucket','prefix','expectedBucketOwner','kmsKeyId','now'],['maxRequestMs','maxBytes']);
 configuration(now,maxRequestMs);const send=storageMethod(client,'send');bucketIdentity(bucket,expectedBucketOwner);if(
  typeof prefix!=='string'||! /^[A-Za-z0-9][A-Za-z0-9/_-]{0,127}$/u.test(prefix)||prefix.endsWith('/')||prefix.includes('//')||
  typeof kmsKeyId!=='string'||! /^arn:aws(?:-us-gov|-cn)?:kms:[a-z0-9-]+:[0-9]{12}:key\/[a-f0-9-]{36}$/u.test(kmsKeyId)||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>8388608)fail('ARTIFACT_STORAGE_CONFIGURATION');
 const prefixFor=o=>`${prefix}/${v.hash(o.scopes)}/${o.objectId}/`,key=o=>`${prefixFor(o)}${o.sha256}`,args=o=>({Bucket:bucket,Key:key(o),ExpectedBucketOwner:expectedBucketOwner});
 const checksum=o=>Buffer.from(o.sha256,'hex').toString('base64');
 async function versioned(life){const result=await life.run(signal=>send(new GetBucketVersioningCommand({Bucket:bucket,ExpectedBucketOwner:expectedBucketOwner}),{abortSignal:signal}));
  if(result.Status!=='Enabled')fail('ARTIFACT_S3_VERSIONING_REQUIRED');life.check();}
 function metadata(result,o,requestSha256){if(result.DeleteMarker===true||nativeVersion(result.VersionId)!==o.versionId||result.ContentLength!==o.bytes||result.ChecksumSHA256!==checksum(o)||
  result.ChecksumType!=='FULL_OBJECT'||result.ServerSideEncryption!=='aws:kms'||result.SSEKMSKeyId!==kmsKeyId||result.Metadata?.objectid!==o.objectId||
  result.Metadata?.contentsha256!==o.sha256||result.Metadata?.scopessha256!==v.hash(o.scopes)||requestSha256!==undefined&&result.Metadata?.requestsha256!==requestSha256)fail('ARTIFACT_S3_MISMATCH');
  digest(result.Metadata?.requestsha256);}
 async function head(o,life,requestSha256){const result=await life.run(signal=>send(new HeadObjectCommand({...args(o),VersionId:o.versionId,ChecksumMode:'ENABLED'}),{abortSignal:signal}));metadata(result,o,requestSha256);return result;}
 async function put(value,signal){const fields=own(value,['objectId','bytes','scopes','requestSha256']),objectId=uuid(fields.objectId),scopes=scopeFacts(fields.scopes),requestSha256=digest(fields.requestSha256);
  if(!Buffer.isBuffer(fields.bytes)||fields.bytes.length>maxBytes)fail('ARTIFACT_STORAGE_INPUT');const bytes=Buffer.from(fields.bytes),facts={objectId,sha256:sha(bytes),bytes:bytes.length,scopes};
  const life=storageLifetime({now,maxRequestMs},signal);let written=false;
  try{await versioned(life);let response;
   try{written=true;response=await life.run(signal=>send(new PutObjectCommand({...args(facts),Body:bytes,ContentLength:bytes.length,ContentType:'application/octet-stream',
    IfNoneMatch:'*',ChecksumAlgorithm:'SHA256',ChecksumSHA256:checksum(facts),ChecksumType:'FULL_OBJECT',ServerSideEncryption:'aws:kms',SSEKMSKeyId:kmsKeyId,BucketKeyEnabled:false,
    Metadata:{objectid:objectId,contentsha256:facts.sha256,scopessha256:v.hash(scopes),requestsha256:requestSha256}}),{abortSignal:signal}));
   }catch(error){if(error?.$metadata?.httpStatusCode!==412)throw error;
    const current=await life.run(signal=>send(new HeadObjectCommand({...args(facts),ChecksumMode:'ENABLED'}),{abortSignal:signal}));
    const object=v.object({...facts,versionId:nativeVersion(current.VersionId)});metadata(current,object,requestSha256);await head(object,life,requestSha256);life.check();return object;}
   if(response.ChecksumSHA256!==checksum(facts)||response.ChecksumType!=='FULL_OBJECT'||response.ServerSideEncryption!=='aws:kms'||response.SSEKMSKeyId!==kmsKeyId)fail('ARTIFACT_S3_MISMATCH');
   const object=v.object({...facts,versionId:nativeVersion(response.VersionId)});await head(object,life,requestSha256);life.check();return object;
  }catch(cause){if(written)throw Object.assign(Error('ARTIFACT_S3_PUT_UNKNOWN'),{code:'ARTIFACT_S3_PUT_UNKNOWN',cause});throw cause;}finally{life.close();}}
 async function get(value,signal){const object=v.object(value);uuid(object.objectId);nativeVersion(object.versionId);scopeFacts(object.scopes);if(object.bytes>maxBytes)fail('ARTIFACT_STORAGE_INPUT');
  const life=storageLifetime({now,maxRequestMs},signal);let acquired;
  try{await versioned(life);await head(object,life);const response=await life.run(async signal=>{const result=await send(new GetObjectCommand({...args(object),VersionId:object.versionId,ChecksumMode:'ENABLED'}),{abortSignal:signal});
    acquired=result.Body;try{life.check();return result;}catch(error){retire(result.Body);throw error;}});metadata(response,object);
   if(!(response.Body instanceof Readable)&&!(response.Body instanceof ReadableStream))fail('ARTIFACT_S3_BODY');
   const iterator=response.Body[Symbol.asyncIterator](),chunks=[];let count=0;
   try{while(true){const part=await life.run(()=>iterator.next());if(part.done)break;if(!(part.value instanceof Uint8Array))fail('ARTIFACT_S3_BODY');count+=part.value.byteLength;
    if(count>object.bytes||count>maxBytes)fail('ARTIFACT_S3_BODY_LIMIT');chunks.push(Buffer.from(part.value));}}finally{try{Promise.resolve(iterator.return?.()).catch(()=>{});}catch{}retire(response.Body);}
   const bytes=Buffer.concat(chunks);if(bytes.length!==object.bytes||sha(bytes)!==object.sha256)fail('ARTIFACT_S3_MISMATCH');life.check();return bytes;
  }finally{retire(acquired);life.close();}}
 const observeAllocation=createAllocationLookup({send,bucket,expectedBucketOwner,prefixFor,verifyVersion:head,versioned,now,maxRequestMs});
 return Object.freeze({put,get,observeAllocation});
}
/** Explicit owned client, with required injected credentials and no ambient chain. */
export function createConfiguredS3ArtifactObjects(options){const {region,credentials,endpoint,...storage}=own(options,['region','credentials','bucket','prefix','expectedBucketOwner','kmsKeyId','now'],['endpoint','maxRequestMs','maxBytes']);
 if(typeof region!=='string'||! /^[a-z]{2}(?:-gov)?-[a-z]+-[0-9]$/u.test(region)||typeof credentials!=='function')fail('ARTIFACT_STORAGE_CONFIGURATION');
 if(endpoint!==undefined){let url;try{url=new URL(endpoint);}catch{fail('ARTIFACT_STORAGE_CONFIGURATION');}if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)fail('ARTIFACT_STORAGE_CONFIGURATION');}
 // Validate all storage configuration before allocating the owned SDK client.
 createS3ArtifactObjects({...storage,client:{send(){}}});const client=new S3Client({region,credentials,maxAttempts:1,...(endpoint===undefined?{}:{endpoint})});
 try{const objects=createS3ArtifactObjects({...storage,client});return Object.freeze({...objects,close(){client.destroy();}});}catch(error){client.destroy();throw error;}}
