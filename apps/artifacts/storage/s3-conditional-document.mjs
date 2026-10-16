/** Native bounded conditional JSON document transport shared by the two artifact evidence purposes.
 * A proven 412 alone permits another CAS attempt. Every other write uncertainty stops; no listing or blind retry. */
import {Readable} from 'node:stream';
import {GetBucketVersioningCommand,GetObjectCommand,PutObjectCommand} from './s3-sdk.mjs';
import {v,own,data,same,sha,storageMethod,storageLifetime,configuration,fail} from './boundary.mjs';
import {createS3ArtifactObjects} from './s3-objects.mjs';
const retire=body=>{try{if(body instanceof Readable)body.destroy();else if(body instanceof ReadableStream)Promise.resolve(body.cancel()).catch(()=>{});}catch{}};
export function createS3ConditionalDocument(options){
 const {client,bucket,prefix,expectedBucketOwner,kmsKeyId,tenantId,namespace,purpose,empty,parse,now,enabled=false,maxRequestMs=15000,maxIndexBytes=8388608,errorPrefix}=own(options,
  ['client','bucket','prefix','expectedBucketOwner','kmsKeyId','tenantId','namespace','purpose','empty','parse','now','errorPrefix'],['enabled','maxRequestMs','maxIndexBytes']);
 configuration(now,maxRequestMs);createS3ArtifactObjects({client,bucket,prefix,expectedBucketOwner,kmsKeyId,now,maxRequestMs});
 if(typeof tenantId!=='string'||!tenantId||typeof namespace!=='string'||!namespace||!['preview-custody','artifact-publication'].includes(purpose)||typeof empty!=='function'||typeof parse!=='function'||typeof enabled!=='boolean'||!Number.isSafeInteger(maxIndexBytes)||maxIndexBytes<1||maxIndexBytes>8388608||!['ARTIFACT_PREVIEW_EVIDENCE','ARTIFACT_PUBLICATION'].includes(errorPrefix))fail('ARTIFACT_STORAGE_CONFIGURATION');
 const send=storageMethod(client,'send'),tenantSha256=v.hash(tenantId),target={Bucket:bucket,Key:`${prefix}/${purpose}/${tenantSha256}/index.json`,ExpectedBucketOwner:expectedBucketOwner};
 const corrupt=()=>fail(errorPrefix+'_CORRUPT');
 const native=value=>{if(typeof value!=='string'||!value||value==='null'||!value.isWellFormed()||Buffer.byteLength(value)>1024)fail('ARTIFACT_S3_VERSION');return value;};
 async function read(life,versionId){let response,body;
  try{
   try{response=await life.run(async signal=>{const r=await send(new GetObjectCommand({...target,...(versionId===undefined?{}:{VersionId:versionId}),ChecksumMode:'ENABLED'}),{abortSignal:signal});body=r.Body;try{life.check();return r;}catch(error){retire(body);throw error;}});}
   catch(error){if(versionId===undefined&&error?.name==='NoSuchKey'&&error?.$metadata?.httpStatusCode===404&&error.DeleteMarker!==true&&error.$response?.headers?.['x-amz-delete-marker']!=='true')return {value:parse(empty()),etag:null,versionId:null};throw error;}
   const id=native(response.VersionId),length=response.ContentLength,meta=response.Metadata,etag=response.ETag;
   if(typeof etag!=='string'||!etag||etag.length>2048||/[\r\n]/u.test(etag)||versionId!==undefined&&id!==versionId||response.DeleteMarker===true||!Number.isSafeInteger(length)||length<1||length>maxIndexBytes||response.ServerSideEncryption!=='aws:kms'||response.SSEKMSKeyId!==kmsKeyId||response.ChecksumType!=='FULL_OBJECT'||meta?.namespace!==namespace||meta?.tenantsha256!==tenantSha256||typeof meta?.contentsha256!=='string'||!/^[a-f0-9]{64}$/u.test(meta.contentsha256)||response.ChecksumSHA256!==Buffer.from(meta.contentsha256,'hex').toString('base64'))corrupt();
   if(!(body instanceof Readable)&&!(body instanceof ReadableStream))fail('ARTIFACT_S3_BODY');const chunks=[];let count=0;const iterator=body[Symbol.asyncIterator]();
   try{while(true){const part=await life.run(()=>iterator.next());if(part.done)break;if(!(part.value instanceof Uint8Array)||(count+=part.value.byteLength)>length)fail('ARTIFACT_S3_BODY_LIMIT');chunks.push(Buffer.from(part.value));}}
   finally{try{Promise.resolve(iterator.return?.()).catch(()=>{});}catch{}}
   const bytes=Buffer.concat(chunks);if(count!==length||sha(bytes)!==meta.contentsha256)corrupt();return {value:parse(JSON.parse(bytes.toString('utf8'))),etag,versionId:id};
  }finally{retire(body);}
 }
 async function operation(signal,fn){if(!enabled)fail(errorPrefix+'_DISABLED');const life=storageLifetime({now,maxRequestMs},signal);
  try{const versioning=await life.run(signal=>send(new GetBucketVersioningCommand({Bucket:bucket,ExpectedBucketOwner:expectedBucketOwner}),{abortSignal:signal}));if(versioning.Status!=='Enabled')fail('ARTIFACT_S3_VERSIONING_REQUIRED');const result=await fn(life);life.check();return data(result);}finally{life.close();}}
 async function write(life,current,value){const next=parse(value),bytes=Buffer.from(JSON.stringify(next));if(bytes.length>maxIndexBytes)fail(errorPrefix+'_LIMIT');const digest=sha(bytes),checksum=Buffer.from(digest,'hex').toString('base64');let response;
  try{response=await life.run(signal=>send(new PutObjectCommand({...target,Body:bytes,ContentLength:bytes.length,ContentType:'application/json',...(current.etag===null?{IfNoneMatch:'*'}:{IfMatch:current.etag}),ChecksumAlgorithm:'SHA256',ChecksumSHA256:checksum,ChecksumType:'FULL_OBJECT',ServerSideEncryption:'aws:kms',SSEKMSKeyId:kmsKeyId,BucketKeyEnabled:false,Metadata:{namespace,tenantsha256:tenantSha256,contentsha256:digest}}),{abortSignal:signal}));}
  catch(cause){if(cause?.$metadata?.httpStatusCode===412)return false;throw Object.assign(Error(errorPrefix+'_ACK_UNKNOWN'),{code:errorPrefix+'_ACK_UNKNOWN',cause});}
  try{const id=native(response.VersionId);if(response.ChecksumSHA256!==checksum||response.ChecksumType!=='FULL_OBJECT'||response.ServerSideEncryption!=='aws:kms'||response.SSEKMSKeyId!==kmsKeyId)corrupt();const back=await read(life,id);if(!same(back.value,next))corrupt();return true;}
  catch(cause){throw Object.assign(Error(errorPrefix+'_ACK_UNKNOWN'),{code:errorPrefix+'_ACK_UNKNOWN',cause});}
 }
 return Object.freeze({operation,read,write});
}
