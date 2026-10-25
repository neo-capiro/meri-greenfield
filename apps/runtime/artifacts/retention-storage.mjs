/** Exact-version retention over the documents family's existing S3 client.
 * No credentials, bucket or object locator comes from a purge request. */
import {HeadObjectCommand,DeleteObjectCommand,GetObjectRetentionCommand,GetObjectLegalHoldCommand,ListObjectVersionsCommand} from '../../artifacts/storage/s3-sdk.mjs';
import {createVersionStorage} from '../../control/retention/storage-port.mjs';
import {digest,uuid,fail} from '../../control/retention/boundary.mjs';

const commands={HeadObject:HeadObjectCommand,DeleteObject:DeleteObjectCommand,
 GetObjectRetention:GetObjectRetentionCommand,GetObjectLegalHold:GetObjectLegalHoldCommand};
export function createRuntimeRetentionStorage({client,bucket,prefix,expectedBucketOwner,now=Date.now,maxRequestMs=3000}){
 if(typeof client?.send!=='function'||typeof prefix!=='string'||!prefix||prefix.startsWith('/')||
    prefix.endsWith('/')||prefix.split('/').some(p=>!p||p==='.'||p==='..'))fail('RETENTION_CONFIGURATION');
 const keyFor=object=>`${prefix}/${digest(object.scopesSha256)}/${uuid(object.objectId)}/${digest(object.sha256)}`;
 const send=async({operation,input},{signal})=>{
  const Command=commands[operation];if(!Command)fail('RETENTION_CONFIGURATION');
  try{return await client.send(new Command(input),{abortSignal:signal});}
  catch(error){
   // S3's versioned HEAD 404 is evidence only with current list permission.
   // Prove that permission for this exact prefix before allowing classification;
   // a failed/ambiguous list replaces the 404 with an unavailable observation.
   if(operation==='HeadObject'&&error?.$metadata?.httpStatusCode===404){
    const listed=await client.send(new ListObjectVersionsCommand({Bucket:bucket,ExpectedBucketOwner:expectedBucketOwner,Prefix:input.Key,MaxKeys:1}),{abortSignal:signal});
    if(listed?.$metadata?.httpStatusCode!==200)fail('RETENTION_STORAGE_UNAVAILABLE');
   }
   throw error;
  }
 };
 return Object.freeze({...createVersionStorage({send,bucket,expectedBucketOwner,now,maxRequestMs,
  permissions:{getObjectVersion:true,listBucketVersions:true,deleteObjectVersion:true}}),keyFor});
}
