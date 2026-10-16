/** Preview-purpose immutable facts over the borrowed shipping evidence owner. This is NOT a provider implementation.
 * claim must atomically exclude both sourceKey and allocationKey outside SQL rollback; append is insert-or-identical per key;
 * read must return the CURRENT COMPLETE artifact partition. An append/read retention sink cannot satisfy this interface.
 * No sequence or retention certificate is borrowed. Unknown acknowledgements never acquire dispatch authority. */
import {v,own,data,storageMethod,storageLifetime,configuration,uuid,fail,same} from '../storage/boundary.mjs';
import {verifyArtifactVersionStorageRecord} from '../storage/postgres-versions.mjs';
import {verifyPreviewClaim} from './claim.mjs';
import {verifyPreviewRecord} from './record.mjs';
export const PREVIEW_CUSTODY_NAMESPACE='meri.artifact-preview-custody.proposal-1';
const states=['CLAIMED','OBJECT_RECORDED','COMMITTED','TOMBSTONE'];
const corrupt=()=>fail('ARTIFACT_PREVIEW_CUSTODY_CORRUPT');
const key=e=>`${e.tenantId}/${e.versionId}/${e.state}`;
const receipt=(e,entrySha256)=>v.hash({namespace:PREVIEW_CUSTODY_NAMESPACE,key:key(e),entrySha256});
export function createPreviewCustodyJournal(options){
 const {evidence,tenantId,artifactId,now,maxRequestMs=15000,maxFacts=1024}=own(options,['evidence','tenantId','artifactId','now'],['maxRequestMs','maxFacts']);
 configuration(now,maxRequestMs);uuid(artifactId);if(typeof tenantId!=='string'||!tenantId||!Number.isSafeInteger(maxFacts)||maxFacts<1||maxFacts>4096)fail('ARTIFACT_STORAGE_CONFIGURATION');
 const claimWrite=storageMethod(evidence,'claim'),append=storageMethod(evidence,'append'),read=storageMethod(evidence,'read');
 const partition=Object.freeze({namespace:PREVIEW_CUSTODY_NAMESPACE,tenantId,artifactId});
 function entry(raw){const e=data(own(raw,['namespace','tenantId','artifactId','versionId','state','claimSha256','facts']));uuid(e.versionId);
  if(e.namespace!==partition.namespace||e.tenantId!==tenantId||e.artifactId!==artifactId||!states.includes(e.state)||!/^[a-f0-9]{64}$/u.test(e.claimSha256))corrupt();return e;}
 function envelope(raw){const r=own(raw,['value','entrySha256','receiptSha256']),e=entry(r.value);
  if(v.hash(e)!==r.entrySha256||receipt(e,r.entrySha256)!==r.receiptSha256)corrupt();return data(r);}
 async function bounded(signal,fn){const life=storageLifetime({now,maxRequestMs},signal);try{const result=await life.run(fn);life.check();return data(result);}finally{life.close();}}
 async function snapshot(signal){return bounded(signal,async signal=>{
  const raw=data(await read(partition,signal));if(!Array.isArray(raw)||raw.length>maxFacts||Buffer.byteLength(JSON.stringify(raw))>8388608)fail('ARTIFACT_PREVIEW_INVENTORY_UNAVAILABLE');
  const entries=raw.map(envelope).sort((a,b)=>key(a.value)<key(b.value)?-1:key(a.value)>key(b.value)?1:0),seen=new Set(),byVersion=new Map(),allocations=new Set();
  for(const r of entries){const e=r.value,k=key(e);if(seen.has(k))corrupt();seen.add(k);if(e.state!=='CLAIMED')continue;
   const facts=own(e.facts,['claim','source']),source=verifyArtifactVersionStorageRecord(facts.source),claim=verifyPreviewClaim(v,facts.claim,source.version);
   if(claim.tenantId!==tenantId||claim.artifactId!==artifactId||claim.versionId!==e.versionId||v.hash(claim)!==e.claimSha256)corrupt();
   const allocation=v.hash({scopes:claim.scopes,objectId:claim.objectId});if(allocations.has(allocation))corrupt();allocations.add(allocation);
   byVersion.set(e.versionId,{claim,source,object:null,record:null,tombstone:null});}
  for(const r of entries){const e=r.value,row=byVersion.get(e.versionId);if(!row||v.hash(row.claim)!==e.claimSha256)corrupt();
   if(e.state==='OBJECT_RECORDED'){const {object:rawObject}=own(e.facts,['object']),object=v.object(rawObject);
    if(object.objectId!==row.claim.objectId||!same(object.scopes,row.claim.scopes)||!object.versionId||object.versionId==='null'||Buffer.byteLength(object.versionId)>1024)corrupt();row.object=object;}
   if(e.state==='COMMITTED'){const {record}=own(e.facts,['record']);row.record=verifyPreviewRecord(v,record,row.source.version);}
   if(e.state==='TOMBSTONE'){const tombstone=data(own(e.facts,['reason','atMs']));if(typeof tombstone.reason!=='string'||!tombstone.reason||tombstone.reason.length>1024||!Number.isSafeInteger(tombstone.atMs)||tombstone.atMs<0)corrupt();row.tombstone=tombstone;}}
  for(const row of byVersion.values())if(row.record&&(!row.object||row.record.previewId!==row.claim.previewId||!same(row.record.preview.object,row.object)))corrupt();
  return {positionSha256:v.hash(entries),entries,rows:[...byVersion.values()].sort((a,b)=>a.claim.versionId.localeCompare(b.claim.versionId))};
 });}
 function make(state,claim,facts){return {...partition,versionId:claim.versionId,state,claimSha256:v.hash(claim),facts};}
 async function write(e,signal,conditional=false){const entrySha256=v.hash(e),request={...partition,key:key(e),value:e,entrySha256};
  if(conditional){request.sourceKey=`${tenantId}/${e.versionId}`;request.allocationKey=`${tenantId}/${v.hash(e.facts.claim.scopes)}/${e.facts.claim.objectId}`;}
  let ack;try{ack=await bounded(signal,signal=>(conditional?claimWrite:append)(data(request),signal));}catch(cause){throw Object.assign(Error('ARTIFACT_PREVIEW_CUSTODY_ACK_UNKNOWN'),{code:'ARTIFACT_PREVIEW_CUSTODY_ACK_UNKNOWN',cause});}
  const a=own(ack,['created','value','entrySha256','receiptSha256']);if(typeof a.created!=='boolean')corrupt();envelope({value:a.value,entrySha256:a.entrySha256,receiptSha256:a.receiptSha256});
  if(key(a.value)!==key(e)||!conditional&&!same(a.value,e)||a.created&&!same(a.value,e))corrupt();
  return data(a);}
 return Object.freeze({snapshot,
  async claim(claimValue,sourceValue,signal){const source=verifyArtifactVersionStorageRecord(sourceValue),claim=verifyPreviewClaim(v,claimValue,source.version);
   if(claim.tenantId!==tenantId||claim.artifactId!==artifactId)corrupt();const ack=await write(make('CLAIMED',claim,{claim,source}),signal,true);
   const winner=verifyPreviewClaim(v,ack.value.facts.claim,verifyArtifactVersionStorageRecord(ack.value.facts.source).version);
   if(v.hash(winner)!==ack.value.claimSha256)corrupt();return {created:ack.created,claim:winner};},
  async recordObject(claim,object,signal){return write(make('OBJECT_RECORDED',claim,{object:v.object(object)}),signal);},
  async commit(claim,record,signal){return write(make('COMMITTED',claim,{record:data(record)}),signal);},
  async tombstone(claim,{reason,atMs},signal){return write(make('TOMBSTONE',claim,{reason,atMs}),signal);},
 });
}
