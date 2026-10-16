/** Disabled-by-default concrete preview evidence extension using existing S3 commands/configuration. One tenant-purpose index
 * is a genuine conditional first-winner for source AND allocation. A single current GET contains the complete bounded facts;
 * no listing, local cache, competing append-only winner or retention certificate. Shipping must bind an existing evidence bucket
 * OUTSIDE rollback and disallow index deletion/rollback before activation. No resource, policy or credential is created here. */
import {Readable} from 'node:stream';
import {GetBucketVersioningCommand,GetObjectCommand,PutObjectCommand} from './s3-sdk.mjs';
import {v,own,data,same,sha,storageMethod,storageLifetime,configuration,fail} from './boundary.mjs';
import {createS3ArtifactObjects} from './s3-objects.mjs';
import {PREVIEW_CUSTODY_NAMESPACE} from '../preview/custody-journal.mjs';
import {verifyPreviewClaim} from '../preview/claim.mjs';import {verifyArtifactVersionStorageRecord} from './postgres-versions.mjs';
const INDEX_VERSION='meri.preview-evidence-index.proposal-1';
const native=value=>{if(typeof value!=='string'||!value||value==='null'||!value.isWellFormed()||Buffer.byteLength(value)>1024)fail('ARTIFACT_S3_VERSION');return value;};
const token=value=>{if(typeof value!=='string'||!value||value.length>2048||/[\r\n]/u.test(value))fail('ARTIFACT_PREVIEW_EVIDENCE_CORRUPT');return value;};
const retire=body=>{try{if(body instanceof Readable)body.destroy();else if(body instanceof ReadableStream)Promise.resolve(body.cancel()).catch(()=>{});}catch{}};
export function createS3PreviewEvidence(options){
 const {client,bucket,prefix,expectedBucketOwner,kmsKeyId,tenantId,now,enabled=false,maxRequestMs=15000,maxFacts=1024,maxIndexBytes=8388608,maxCasAttempts=3}=own(options,
  ['client','bucket','prefix','expectedBucketOwner','kmsKeyId','tenantId','now'],['enabled','maxRequestMs','maxFacts','maxIndexBytes','maxCasAttempts']);
 configuration(now,maxRequestMs);createS3ArtifactObjects({client,bucket,prefix,expectedBucketOwner,kmsKeyId,now,maxRequestMs});
 if(typeof tenantId!=='string'||!tenantId||typeof enabled!=='boolean'||!Number.isSafeInteger(maxFacts)||maxFacts<1||maxFacts>4096||!Number.isSafeInteger(maxIndexBytes)||maxIndexBytes<1||maxIndexBytes>8388608||!Number.isSafeInteger(maxCasAttempts)||maxCasAttempts<1||maxCasAttempts>8)fail('ARTIFACT_STORAGE_CONFIGURATION');
 const send=storageMethod(client,'send'),namespace=PREVIEW_CUSTODY_NAMESPACE,tenantSha256=v.hash(tenantId),key=`${prefix}/preview-custody/${tenantSha256}/index.json`,target={Bucket:bucket,Key:key,ExpectedBucketOwner:expectedBucketOwner};
 const empty=()=>({indexVersion:INDEX_VERSION,namespace,tenantId,facts:[],allocations:[]});
 function index(value){const p=data(own(value,['indexVersion','namespace','tenantId','facts','allocations']));
  if(p.indexVersion!==INDEX_VERSION||p.namespace!==namespace||p.tenantId!==tenantId||!Array.isArray(p.facts)||!Array.isArray(p.allocations)||p.facts.length>maxFacts||p.allocations.length>maxFacts)fail('ARTIFACT_PREVIEW_EVIDENCE_CORRUPT');
  const keys=new Set(),allocations=new Set(),claims=new Map();for(const row of p.facts){const r=own(row,['key','value','entrySha256','receiptSha256']),e=own(r.value,['namespace','tenantId','artifactId','versionId','state','claimSha256','facts']);
   if(e.namespace!==namespace||e.tenantId!==tenantId||!['CLAIMED','OBJECT_RECORDED','COMMITTED','TOMBSTONE'].includes(e.state)||r.key!==`${tenantId}/${e.versionId}/${e.state}`||keys.has(r.key)||v.hash(e)!==r.entrySha256||
    r.receiptSha256!==v.hash({namespace,key:r.key,entrySha256:r.entrySha256}))fail('ARTIFACT_PREVIEW_EVIDENCE_CORRUPT');keys.add(r.key);if(e.state==='CLAIMED'){
    const facts=own(e.facts,['claim','source']),source=verifyArtifactVersionStorageRecord(facts.source),claim=verifyPreviewClaim(v,facts.claim,source.version);
    if(claim.tenantId!==tenantId||claim.artifactId!==e.artifactId||claim.versionId!==e.versionId||v.hash(claim)!==e.claimSha256)fail('ARTIFACT_PREVIEW_EVIDENCE_CORRUPT');
    claims.set(`${tenantId}/${e.versionId}`,`${tenantId}/${v.hash(claim.scopes)}/${claim.objectId}`);}}
  for(const raw of p.allocations){const a=own(raw,['allocationKey','sourceKey']);if(claims.get(a.sourceKey)!==a.allocationKey||allocations.has(a.allocationKey))fail('ARTIFACT_PREVIEW_EVIDENCE_CORRUPT');allocations.add(a.allocationKey);}
  if(p.allocations.length!==claims.size)fail('ARTIFACT_PREVIEW_EVIDENCE_CORRUPT');return p;
 }
 async function readIndex(life,versionId){let response,body;
  try{
   try{response=await life.run(async signal=>{const r=await send(new GetObjectCommand({...target,...(versionId===undefined?{}:{VersionId:versionId}),ChecksumMode:'ENABLED'}),{abortSignal:signal});body=r.Body;try{life.check();return r;}catch(error){retire(body);throw error;}});}
   catch(error){if(versionId===undefined&&error?.name==='NoSuchKey'&&error?.$metadata?.httpStatusCode===404&&error.DeleteMarker!==true&&error.$response?.headers?.['x-amz-delete-marker']!=='true')return {index:empty(),etag:null,versionId:null};throw error;}
   const id=native(response.VersionId),length=response.ContentLength,meta=response.Metadata,etag=token(response.ETag);
   if(versionId!==undefined&&id!==versionId||response.DeleteMarker===true||!Number.isSafeInteger(length)||length<1||length>maxIndexBytes||response.ServerSideEncryption!=='aws:kms'||response.SSEKMSKeyId!==kmsKeyId||response.ChecksumType!=='FULL_OBJECT'||
    meta?.namespace!==namespace||meta?.tenantsha256!==tenantSha256||typeof meta?.contentsha256!=='string'||!/^[a-f0-9]{64}$/u.test(meta.contentsha256)||response.ChecksumSHA256!==Buffer.from(meta.contentsha256,'hex').toString('base64'))fail('ARTIFACT_PREVIEW_EVIDENCE_CORRUPT');
   if(!(body instanceof Readable)&&!(body instanceof ReadableStream))fail('ARTIFACT_S3_BODY');const chunks=[];let count=0;const iterator=body[Symbol.asyncIterator]();
   try{while(true){const part=await life.run(()=>iterator.next());if(part.done)break;if(!(part.value instanceof Uint8Array)||(count+=part.value.byteLength)>length)fail('ARTIFACT_S3_BODY_LIMIT');chunks.push(Buffer.from(part.value));}}
   finally{try{Promise.resolve(iterator.return?.()).catch(()=>{});}catch{}}
   const bytes=Buffer.concat(chunks);if(count!==length||sha(bytes)!==meta.contentsha256)fail('ARTIFACT_PREVIEW_EVIDENCE_CORRUPT');return {index:index(JSON.parse(bytes.toString('utf8'))),etag,versionId:id};
  }finally{retire(body);}
 }
 function request(value,conditional){const r=data(own(value,['namespace','tenantId','artifactId','key','value','entrySha256'],conditional?['sourceKey','allocationKey']:[])),e=r.value;
  if(r.namespace!==namespace||r.tenantId!==tenantId||e.namespace!==namespace||e.tenantId!==tenantId||e.artifactId!==r.artifactId||r.key!==`${tenantId}/${e.versionId}/${e.state}`||v.hash(e)!==r.entrySha256||conditional&&e.state!=='CLAIMED'||!conditional&&e.state==='CLAIMED')fail('ARTIFACT_PREVIEW_EVIDENCE_CORRUPT');
  if(conditional&&(r.sourceKey!==`${tenantId}/${e.versionId}`||r.allocationKey!==`${tenantId}/${v.hash(e.facts.claim.scopes)}/${e.facts.claim.objectId}`))fail('ARTIFACT_PREVIEW_EVIDENCE_CORRUPT');return r;
 }
 async function operation(signal,fn){if(!enabled)fail('ARTIFACT_PREVIEW_EVIDENCE_DISABLED');const life=storageLifetime({now,maxRequestMs},signal);
  try{const versioning=await life.run(signal=>send(new GetBucketVersioningCommand({Bucket:bucket,ExpectedBucketOwner:expectedBucketOwner}),{abortSignal:signal}));if(versioning.Status!=='Enabled')fail('ARTIFACT_S3_VERSIONING_REQUIRED');const result=await fn(life);life.check();return data(result);}finally{life.close();}}
 const acknowledgement=(row,created)=>({created,value:row.value,entrySha256:row.entrySha256,receiptSha256:row.receiptSha256});
 async function write(value,signal,conditional){const r=request(value,conditional);return operation(signal,async life=>{
  for(let attempt=0;attempt<maxCasAttempts;attempt++){
   const current=await readIndex(life),old=current.index.facts.find(f=>f.key===r.key);
   if(old){if(!conditional&&!same(old.value,r.value))fail('ARTIFACT_PREVIEW_CONFLICT');return acknowledgement(old,false);}
   const claimKey=`${tenantId}/${r.value.versionId}/CLAIMED`;if(!conditional&&!current.index.facts.some(f=>f.key===claimKey&&f.value.claimSha256===r.value.claimSha256))fail('ARTIFACT_PREVIEW_CLAIM');
   if(conditional&&current.index.allocations.some(a=>a.allocationKey===r.allocationKey))fail('ARTIFACT_PREVIEW_ALLOCATION_HELD');
   if(current.index.facts.length>=maxFacts)fail('ARTIFACT_PREVIEW_INVENTORY_UNAVAILABLE');
   const row={key:r.key,value:r.value,entrySha256:r.entrySha256,receiptSha256:v.hash({namespace,key:r.key,entrySha256:r.entrySha256})},next=index({...current.index,facts:[...current.index.facts,row],allocations:conditional?[...current.index.allocations,{allocationKey:r.allocationKey,sourceKey:r.sourceKey}]:current.index.allocations});
   const bytes=Buffer.from(JSON.stringify(next));if(bytes.length>maxIndexBytes)fail('ARTIFACT_PREVIEW_INVENTORY_UNAVAILABLE');const digest=sha(bytes),checksum=Buffer.from(digest,'hex').toString('base64');let response;
   try{response=await life.run(signal=>send(new PutObjectCommand({...target,Body:bytes,ContentLength:bytes.length,ContentType:'application/json',...(current.etag===null?{IfNoneMatch:'*'}:{IfMatch:current.etag}),
     ChecksumAlgorithm:'SHA256',ChecksumSHA256:checksum,ChecksumType:'FULL_OBJECT',ServerSideEncryption:'aws:kms',SSEKMSKeyId:kmsKeyId,BucketKeyEnabled:false,Metadata:{namespace,tenantsha256:tenantSha256,contentsha256:digest}}),{abortSignal:signal}));}
   catch(cause){if(cause?.$metadata?.httpStatusCode===412)continue;throw Object.assign(Error('ARTIFACT_PREVIEW_EVIDENCE_ACK_UNKNOWN'),{code:'ARTIFACT_PREVIEW_EVIDENCE_ACK_UNKNOWN',cause});}
   // Any unverified/lost acknowledgement stops. Even a later read finding the claim cannot remint created:true.
   try{const id=native(response.VersionId);if(response.ChecksumSHA256!==checksum||response.ChecksumType!=='FULL_OBJECT'||response.ServerSideEncryption!=='aws:kms'||response.SSEKMSKeyId!==kmsKeyId)fail('ARTIFACT_PREVIEW_EVIDENCE_CORRUPT');
    const back=await readIndex(life,id);if(!same(back.index,next))fail('ARTIFACT_PREVIEW_EVIDENCE_CORRUPT');return acknowledgement(row,true);}
   catch(cause){throw Object.assign(Error('ARTIFACT_PREVIEW_EVIDENCE_ACK_UNKNOWN'),{code:'ARTIFACT_PREVIEW_EVIDENCE_ACK_UNKNOWN',cause});}
  }fail('ARTIFACT_PREVIEW_EVIDENCE_CONTENTION');
 });}
 return Object.freeze({claim:(value,signal)=>write(value,signal,true),append:(value,signal)=>write(value,signal,false),
  async read(partition,signal){const p=data(own(partition,['namespace','tenantId','artifactId']));if(p.namespace!==namespace||p.tenantId!==tenantId)fail('ARTIFACT_PREVIEW_EVIDENCE_CORRUPT');
   return operation(signal,async life=>{const current=await readIndex(life);return current.index.facts.filter(f=>f.value.artifactId===p.artifactId).map(({key,...row})=>row);});},
 });
}
