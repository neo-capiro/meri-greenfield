/** Disabled-by-default concrete preview evidence extension using existing S3 commands/configuration. One tenant-purpose index
 * is a genuine conditional first-winner for source AND allocation. A single current GET contains the complete bounded facts;
 * no listing, local cache, competing append-only winner or retention certificate. Shipping must bind an existing evidence bucket
 * OUTSIDE rollback and disallow index deletion/rollback before activation. No resource, policy or credential is created here. */
import {createS3ConditionalDocument} from './s3-conditional-document.mjs';

import {v,own,data,same,configuration,fail} from './boundary.mjs';
import {createS3ArtifactObjects} from './s3-objects.mjs';
import {PREVIEW_CUSTODY_NAMESPACE} from '../preview/custody-journal.mjs';
import {verifyPreviewClaim} from '../preview/claim.mjs';import {verifyArtifactVersionStorageRecord} from './version-record.mjs';
const INDEX_VERSION='meri.preview-evidence-index.proposal-1';
export function createS3PreviewEvidence(options){
 const {client,bucket,prefix,expectedBucketOwner,kmsKeyId,tenantId,now,enabled=false,maxRequestMs=15000,maxFacts=1024,maxIndexBytes=8388608,maxCasAttempts=3}=own(options,
  ['client','bucket','prefix','expectedBucketOwner','kmsKeyId','tenantId','now'],['enabled','maxRequestMs','maxFacts','maxIndexBytes','maxCasAttempts']);
 configuration(now,maxRequestMs);createS3ArtifactObjects({client,bucket,prefix,expectedBucketOwner,kmsKeyId,now,maxRequestMs});
 if(typeof tenantId!=='string'||!tenantId||typeof enabled!=='boolean'||!Number.isSafeInteger(maxFacts)||maxFacts<1||maxFacts>4096||!Number.isSafeInteger(maxIndexBytes)||maxIndexBytes<1||maxIndexBytes>8388608||!Number.isSafeInteger(maxCasAttempts)||maxCasAttempts<1||maxCasAttempts>8)fail('ARTIFACT_STORAGE_CONFIGURATION');
 const namespace=PREVIEW_CUSTODY_NAMESPACE;
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
 const transport=createS3ConditionalDocument({client,bucket,prefix,expectedBucketOwner,kmsKeyId,tenantId,namespace,purpose:'preview-custody',empty,parse:index,now,enabled,maxRequestMs,maxIndexBytes,errorPrefix:'ARTIFACT_PREVIEW_EVIDENCE'});
 const operation=transport.operation;
 const readIndex=async(life)=>(await transport.read(life)).value;
 function request(value,conditional){const r=data(own(value,['namespace','tenantId','artifactId','key','value','entrySha256'],conditional?['sourceKey','allocationKey']:[])),e=r.value;
  if(r.namespace!==namespace||r.tenantId!==tenantId||e.namespace!==namespace||e.tenantId!==tenantId||e.artifactId!==r.artifactId||r.key!==`${tenantId}/${e.versionId}/${e.state}`||v.hash(e)!==r.entrySha256||conditional&&e.state!=='CLAIMED'||!conditional&&e.state==='CLAIMED')fail('ARTIFACT_PREVIEW_EVIDENCE_CORRUPT');
  if(conditional&&(r.sourceKey!==`${tenantId}/${e.versionId}`||r.allocationKey!==`${tenantId}/${v.hash(e.facts.claim.scopes)}/${e.facts.claim.objectId}`))fail('ARTIFACT_PREVIEW_EVIDENCE_CORRUPT');return r;
 }
 const acknowledgement=(row,created)=>({created,value:row.value,entrySha256:row.entrySha256,receiptSha256:row.receiptSha256});
 async function write(value,signal,conditional){const r=request(value,conditional);return operation(signal,async life=>{
  for(let attempt=0;attempt<maxCasAttempts;attempt++){
   const current=await transport.read(life),old=current.value.facts.find(f=>f.key===r.key);
   if(old){if(!conditional&&!same(old.value,r.value))fail('ARTIFACT_PREVIEW_CONFLICT');return acknowledgement(old,false);}
   const claimKey=`${tenantId}/${r.value.versionId}/CLAIMED`;if(!conditional&&!current.value.facts.some(f=>f.key===claimKey&&f.value.claimSha256===r.value.claimSha256))fail('ARTIFACT_PREVIEW_CLAIM');
   if(conditional&&current.value.allocations.some(a=>a.allocationKey===r.allocationKey))fail('ARTIFACT_PREVIEW_ALLOCATION_HELD');
   if(current.value.facts.length>=maxFacts)fail('ARTIFACT_PREVIEW_INVENTORY_UNAVAILABLE');
   const row={key:r.key,value:r.value,entrySha256:r.entrySha256,receiptSha256:v.hash({namespace,key:r.key,entrySha256:r.entrySha256})},next=index({...current.value,facts:[...current.value.facts,row],allocations:conditional?[...current.value.allocations,{allocationKey:r.allocationKey,sourceKey:r.sourceKey}]:current.value.allocations});
   if(Buffer.byteLength(JSON.stringify(next))>maxIndexBytes)fail('ARTIFACT_PREVIEW_INVENTORY_UNAVAILABLE');
   if(await transport.write(life,current,next))return acknowledgement(row,true);
  }fail('ARTIFACT_PREVIEW_EVIDENCE_CONTENTION');
 });}
 return Object.freeze({claim:(value,signal)=>write(value,signal,true),append:(value,signal)=>write(value,signal,false),
  async read(partition,signal){const p=data(own(partition,['namespace','tenantId','artifactId']));if(p.namespace!==namespace||p.tenantId!==tenantId)fail('ARTIFACT_PREVIEW_EVIDENCE_CORRUPT');
   return operation(signal,async life=>{const current=await readIndex(life);return current.facts.filter(f=>f.value.artifactId===p.artifactId).map(({key,...row})=>row);});},
 });
}
