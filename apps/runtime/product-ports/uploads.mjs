/** Upload custody uses the existing private artifact bucket, SQL pool, action sessions and retention gate.
 * Construction performs no IO. Native inspection is a separately observed image/host owner, never a browser option. */
import {randomUUID} from 'node:crypto';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {UPLOAD_LIMITS} from '../../../packages/contracts/uploads-application/protocol.mjs';
import {createUploadApplication} from '../../control/uploads/application.mjs';
import {createUploadInputReader} from '../../control/uploads/input-source.mjs';
import {createUploadInspection} from '../../control/uploads/extraction.mjs';
import {createPostgresUploadStore} from '../../control/uploads/postgres-store.mjs';
import {hash,fail} from '../../control/uploads/custody.mjs';
import {createS3ArtifactObjects} from '../../artifacts/storage/s3-objects.mjs';
import {createPrivateBucketVerifier} from '../../artifacts/storage/s3-private-bucket.mjs';
import {S3Client} from '../../artifacts/storage/s3-sdk.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {compileRuntimeArtifactsConfiguration} from '../artifacts/configuration.mjs';
import {createRuntimeRetentionStorage} from '../artifacts/retention-storage.mjs';

/** Reuse exact-version hold/delete/absence observations; an ACK or delete marker is never proof of erasure. */
export function createUploadOriginalRemoval(storage,now){
 const ports=Object.fromEntries(['keyFor','headVersion','holdsFor','deleteVersion'].map(name=>[name,storageMethod(storage,name)]));
 return async({object,signal,deadlineMs,assertCurrent})=>{
  const target={key:ports.keyFor({...object,scopesSha256:hash(object.scopes)}),versionId:object.versionId},options={signal,deadlineMs};
  const before=await ports.headVersion(target,options);
  if(before.outcome==='UNKNOWN')fail('UPLOAD_REMOVAL_UNCERTAIN');
  if(before.outcome==='PRESENT'){
   const holds=await ports.holdsFor(target,options);
   if(holds.legalHold||holds.objectLockRetainUntilMs!==null&&holds.objectLockRetainUntilMs>now())fail('UPLOAD_REMOVAL_HELD');
   await assertCurrent();signal?.throwIfAborted();if(now()>=deadlineMs)fail('UPLOAD_EXPIRED');
   await ports.deleteVersion(target,options);
   if((await ports.headVersion(target,options)).outcome!=='ABSENT')fail('UPLOAD_REMOVAL_UNCERTAIN');
  }else if(before.outcome!=='ABSENT')fail('UPLOAD_REMOVAL_UNCERTAIN');
  return Object.freeze({deleted:true,objectId:object.objectId,versionId:object.versionId});
 };
}

export function uploadsFamily(owners={}){
 const supplied=own(owners,[],['inspection','createS3Client','ids']);
 if(supplied.inspection!==undefined)storageMethod(supplied.inspection,'inspect');
 const createClient=supplied.createS3Client??(({region})=>new S3Client({region,maxAttempts:1}));
 if(typeof createClient!=='function'||supplied.ids!==undefined&&typeof supplied.ids!=='function')fail('UPLOAD_CONFIGURATION');
 return function createUploadsFamily(context){
  const {configuration,pool,now,uploadsInspection}=context,declared=compileRuntimeArtifactsConfiguration(configuration);
  // The mounted native inspection is trusted CONTROL assembly state (uploads/control-lifecycle.mjs) reaching this family
  // alone; it is never a request field. Absent or unattested it is undefined here and this family keeps its own honest
  // UNAVAILABLE. An unusable mount is refused rather than silently ignored.
  if(uploadsInspection!==undefined)storageMethod(uploadsInspection,'inspect');
  if(configuration.sourceEnabled!==true||declared?.enabled!==true||configuration.retention===undefined)return {ports:{}};
  const client=createClient({region:declared.region}),s3={client,bucket:declared.bucket,prefix:declared.prefix,
   expectedBucketOwner:declared.expectedBucketOwner,kmsKeyId:declared.kmsKeyId};
  const maxRequestMs=Math.min(configuration.limits.requestMs,30000),rawObjects=createS3ArtifactObjects({...s3,now,maxRequestMs,maxBytes:UPLOAD_LIMITS.originalBytes});
  const privacy=createPrivateBucketVerifier({client,bucket:s3.bucket,expectedBucketOwner:s3.expectedBucketOwner,now,maxRequestMs});
  const objects=Object.freeze(Object.fromEntries(['put','get','observePut'].map(name=>[name,async(value,signal)=>{
   await privacy.verifyPrivate({signal});return rawObjects[name](value,signal);
  }])));
  const store=createPostgresUploadStore({pool}),storage=createRuntimeRetentionStorage({...s3,now,maxRequestMs});
  const inspection=supplied.inspection??uploadsInspection??createUploadInspection({now}),removeOriginal=createUploadOriginalRemoval(storage,now);
  return {ports:{uploadApplicationFactory:Object.freeze({state:()=> 'composed',create({sessions,retention}){
   if(!retention)fail('UPLOAD_CONFIGURATION');
   return createUploadApplication({sessions,store,objects,inspection,retention,removeOriginal,now,ids:supplied.ids??randomUUID});
  },createSource({sessions,retention,conversationStore}){
   if(!retention||typeof conversationStore?.read!=='function')fail('UPLOAD_CONFIGURATION');
   return createUploadInputReader({sessions,retention,conversationStore,store,objects,inspection,removeOriginal,now});
  }})}};
 };
}
export const createUploadsFamily=uploadsFamily();
