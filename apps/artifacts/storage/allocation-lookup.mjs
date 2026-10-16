/** Read-only native S3 observations for an EXACT retained preview allocation. The native list cursor is not a snapshot and S3
 * does not fence an unknown in-flight put. Even two equal exhausted traversals therefore NEVER prove final absence/purge
 * completeness. Missing provider snapshot/writer-closure guarantees are reported explicitly; no restorable flag invents them. */
import {ListObjectVersionsCommand} from './s3-sdk.mjs';
import {v,own,data,storageLifetime,configuration,fail,digest} from './boundary.mjs';
import {verifyArtifactVersionStorageRecord} from './postgres-versions.mjs';import {verifyPreviewClaim} from '../preview/claim.mjs';
const native=value=>{if(typeof value!=='string'||!value||value==='null'||Buffer.byteLength(value)>1024||!value.isWellFormed())fail('ARTIFACT_S3_VERSION');return value;};
export function createAllocationLookup({send,bucket,expectedBucketOwner,prefixFor,verifyVersion,versioned,now,maxRequestMs,maxRows=128,maxPages=8}){
 configuration(now,maxRequestMs);if(!Number.isSafeInteger(maxRows)||maxRows<1||maxRows>256||!Number.isSafeInteger(maxPages)||maxPages<1||maxPages>16)fail('ARTIFACT_STORAGE_CONFIGURATION');
 return async function observeAllocation(value,signal){const fields=own(value,['claim','source'],['object','record','tombstone','state']),source=verifyArtifactVersionStorageRecord(fields.source),claim=verifyPreviewClaim(v,fields.claim,source.version);
  const prefix=prefixFor({scopes:claim.scopes,objectId:claim.objectId}),requestSha256=v.hash({preview:claim.versionId,sourceSha256:claim.sourceSha256}),life=storageLifetime({now,maxRequestMs},signal);
  async function traverse(){const versions=[],deleteMarkers=[],pages=[],seen=new Set(),cursors=new Set();let cursor={};
   for(let page=0;page<maxPages;page++){
    const raw=await life.run(signal=>send(new ListObjectVersionsCommand({Bucket:bucket,ExpectedBucketOwner:expectedBucketOwner,Prefix:prefix,MaxKeys:Math.min(1000,maxRows+1),...cursor}),{abortSignal:signal}));
    if(typeof raw.IsTruncated!=='boolean'||raw.Versions!==undefined&&!Array.isArray(raw.Versions)||raw.DeleteMarkers!==undefined&&!Array.isArray(raw.DeleteMarkers))fail('ARTIFACT_ALLOCATION_UNKNOWN');
    const entries=[];
    for(const [kind,rows]of [['version',raw.Versions??[]],['deleteMarker',raw.DeleteMarkers??[]]])for(const item of rows){
     const key=item.Key;if(typeof key!=='string'||!key.startsWith(prefix))fail('ARTIFACT_ALLOCATION_UNKNOWN');const sha256=digest(key.slice(prefix.length)),versionId=native(item.VersionId),identity=v.hash({key,versionId});
     if(seen.has(identity))fail('ARTIFACT_ALLOCATION_UNKNOWN');seen.add(identity);if(seen.size>maxRows)fail('ARTIFACT_PREVIEW_INVENTORY_UNAVAILABLE');
     if(typeof item.IsLatest!=='boolean'||!(item.LastModified instanceof Date)||!Number.isFinite(item.LastModified.getTime()))fail('ARTIFACT_ALLOCATION_UNKNOWN');
     const fact={key,versionId,sha256,isLatest:item.IsLatest,lastModified:item.LastModified.toISOString()};
     if(kind==='version'){if(!Number.isSafeInteger(item.Size)||item.Size<0||item.Size>8388608)fail('ARTIFACT_ALLOCATION_UNKNOWN');
      const object=v.object({objectId:claim.objectId,versionId,sha256,bytes:item.Size,scopes:claim.scopes});await verifyVersion(object,life,requestSha256);versions.push(object);entries.push({...fact,kind,bytes:item.Size});}
     else{deleteMarkers.push(fact);entries.push({...fact,kind});}}
    let next=null;if(raw.IsTruncated){if(typeof raw.NextKeyMarker!=='string'||!raw.NextKeyMarker.startsWith(prefix)||typeof raw.NextVersionIdMarker!=='string'||!raw.NextVersionIdMarker)fail('ARTIFACT_ALLOCATION_UNKNOWN');
     next={KeyMarker:raw.NextKeyMarker,VersionIdMarker:native(raw.NextVersionIdMarker)};const token=v.hash(next);if(cursors.has(token))fail('ARTIFACT_ALLOCATION_UNKNOWN');cursors.add(token);}
    pages.push({cursor,entries,next});if(!next)return {versions,deleteMarkers,pages};cursor=next;
   }fail('ARTIFACT_PREVIEW_INVENTORY_UNAVAILABLE');
  }
  try{await versioned(life);const first=await traverse(),second=await traverse();if(v.hash(first)!==v.hash(second))fail('ARTIFACT_ALLOCATION_UNSTABLE');life.check();
   return data({tenantId:claim.tenantId,conversationId:claim.conversationId,artifactId:claim.artifactId,versionId:claim.versionId,claimSha256:v.hash(claim),objectId:claim.objectId,
    ...second,observationSha256:v.hash(second),paginationExhausted:true,complete:false,terminalAbsent:false,reason:'NATIVE_LISTING_HAS_NO_SNAPSHOT_OR_WRITER_CLOSURE'});
  }finally{life.close();}
 };
}
