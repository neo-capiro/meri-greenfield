/** Durable versions over a borrowed pg-compatible pool; atomic immutable record/head CAS. */
import {readLocalReplay} from '../local-replay.mjs';

import {v,own,data,fail,same,uuid,storageLifetime,configuration,storageMethod} from './boundary.mjs';
import {verifyArtifactPublications,verifyArtifactPublicationInput} from './artifact-publication.mjs';
import {readArtifactProjection,assertArtifactProjection,insertArtifactRecord,projectArtifactHead} from './postgres-publication-projection.mjs';
import {verifyArtifactVersionStorageRecord as recordValue,verifyArtifactVersionStorageRow as decode,verifyArtifactVersionStorageHead} from './version-record.mjs';
export {verifyArtifactVersionStorageRecord,verifyArtifactVersionStorageRow} from './version-record.mjs';
export function createPostgresArtifactVersions(options){const {pool,now,maxRequestMs=15000,journal=null,publication=null,tenantId=null,retention=null}=own(options,['pool','now'],['maxRequestMs','journal','publication','tenantId','retention']);configuration(now,maxRequestMs);storageMethod(pool,'connect');
 // Imports/construction remain inert. Missing durable owner is unavailable BEFORE SQL, never legacy SQL publication.
 if(journal===null||publication===null||retention===null||tenantId===null){const unavailable=async()=>fail('ARTIFACT_PUBLICATION_UNAVAILABLE');return Object.freeze({read:unavailable,readExclusive:unavailable,commit:unavailable,findByObject:unavailable,recoverExclusive:unavailable});}
 if(typeof tenantId!=='string'||!tenantId)fail('ARTIFACT_STORAGE_CONFIGURATION');const tx=storageMethod(journal,'tx'),readRetention=storageMethod(journal,'readProjection'),snapshot=storageMethod(publication,'snapshot'),publish=storageMethod(publication,'publish'),assertServable=storageMethod(retention,'assertServable');
 async function transaction(signal,body,exclusive=false){const life=storageLifetime({now,maxRequestMs},signal);try{life.check();return data(await tx(c=>{life.check();return body(c,life);},{exclusive,readCommitted:true}));}catch(cause){if(cause?.code==='RETENTION_COMMIT_UNKNOWN')throw Object.assign(Error('ARTIFACT_VERSION_COMMIT_UNKNOWN'),{code:'ARTIFACT_VERSION_COMMIT_UNKNOWN',cause});for(let root=cause,depth=0;root&&depth<4;root=root.cause,depth++)if(root.deadline)throw Object.assign(Error('ARTIFACT_STORAGE_'+root.deadline),{code:'ARTIFACT_STORAGE_'+root.deadline,cause});if(cause?.code==='RETENTION_STORE_UNAVAILABLE'&&cause.cause?.code)throw cause.cause;throw cause;}finally{life.close();}}
 async function current(life){const p=data(await life.run(signal=>snapshot(signal)));own(p,['index','positionSha256']);const index=verifyArtifactPublications(p.index,tenantId);if(p.positionSha256!==v.hash(index))fail('ARTIFACT_PUBLICATION_CORRUPT');return p;}
 async function allowed(record,life,exclusive=false,c){const b=record.version.binding;for(const subject of [{tenantId,kind:'artifact',subjectId:record.version.artifactId},{tenantId,kind:'conversation',subjectId:b.conversationId}]){
  // Reuse the canonical raw journal reader ON THIS transaction lease while the existing owner holds recovery exclusion.
  if(exclusive){const {projection:row}=await life.run(()=>readRetention(c,`${tenantId}:${subject.kind}:${subject.subjectId}`));if(row&&row.state!=='RELEASED')fail('RETENTION_SUPPRESSED');}
  else await life.run(()=>assertServable(subject));}life.check();}
 async function verified(c,artifactId,life){const sql=await readArtifactProjection(c,tenantId,artifactId,life),facts=await current(life);assertArtifactProjection(sql,facts.index,artifactId);return {sql,facts};}
 async function rawVersion(c,id,life){const rows=(await life.run(()=>c.query('SELECT * FROM meri_artifacts.versions WHERE version_id=$1',[uuid(id)]))).rows;life.check();
  if(!rows.length)throw Object.assign(Error('ENOENT'),{code:'ENOENT'});if(rows.length!==1)fail('ARTIFACT_VERSION_CORRUPT');const r=decode(rows[0]);if(r.version.binding.tenantId!==tenantId)fail('ARTIFACT_VERSION_CORRUPT');return r;}
 async function head(c,artifactId,life){const rows=(await life.run(()=>c.query('SELECT * FROM meri_artifacts.heads WHERE artifact_id=$1 FOR SHARE',[uuid(artifactId)]))).rows;life.check();
  if(!rows.length)throw Object.assign(Error('ENOENT'),{code:'ENOENT'});if(rows.length!==1||rows[0].artifact_id!==artifactId)fail('ARTIFACT_VERSION_CORRUPT');const row=rows[0],current=await rawVersion(c,row.version_id,life);return verifyArtifactVersionStorageHead(row,current);}
 function replay(c,query,life){return readLocalReplay(query,{hash:v.hash,check:life.check,
  async readVersion(id){const record=await rawVersion(c,id,life);return {record,bytes:Buffer.byteLength(JSON.stringify(record))};},
  readHead:async artifactId=>(await head(c,artifactId,life)).version_id,
  async listVersions(){const rows=(await life.run(()=>c.query('SELECT version_id FROM meri_artifacts.versions WHERE request_sha256=$1 ORDER BY version_id LIMIT 1025',[query.requestSha256]))).rows;life.check();return rows.map(row=>row.version_id+'.json');}});}
 async function readValue(value,signal,exclusive=false){return transaction(signal,async(c,life)=>{let record;
  if(typeof value!=='string')record=await replay(c,data(value),life);else{const raw=await rawVersion(c,value,life);record=await replay(c,{kind:'artifact-replay',versionId:value,requestSha256:raw.requestSha256,resultSha256:null},life);}
  await allowed(record,life,exclusive,c);const {sql}=await verified(c,record.version.artifactId,life);if(!sql.records.some(r=>same(r,record)))fail('ARTIFACT_PUBLICATION_PROJECTION_STALE');await allowed(record,life,exclusive,c);return record;},exclusive);}
 /** The version id whose immutable object is `objectId` within one tenant conversation (decoded and checked); ENOENT when none.
  * Unindexed JSON-path read on the existing table (no migration); an index is a separate migration proposal. */
 async function findByObject(value,signal){const q=data(own(value,['objectId','tenantId','conversationId']));uuid(q.objectId);uuid(q.conversationId);if(q.tenantId!==tenantId)fail('ARTIFACT_STORAGE_INPUT');
  return transaction(signal,async(c,life)=>{const rows=(await life.run(()=>c.query("SELECT version_id FROM meri_artifacts.versions WHERE tenant_id=$1 AND conversation_id=$2 AND record #>> '{version,object,objectId}'=$3 ORDER BY version_id LIMIT 2",[q.tenantId,q.conversationId,q.objectId]))).rows;life.check();
   if(!rows.length)throw Object.assign(Error('ENOENT'),{code:'ENOENT'});if(rows.length!==1)fail('ARTIFACT_VERSION_CORRUPT');
   // rawVersion decodes the row and checks its relational tenant/conversation columns against the record.
   const record=await rawVersion(c,rows[0].version_id,life);await allowed(record,life);const {sql}=await verified(c,record.version.artifactId,life);if(!sql.records.some(r=>same(r,record)))fail('ARTIFACT_PUBLICATION_PROJECTION_STALE');await allowed(record,life);return record.version.versionId;});}
 async function commit(value,signal,authority){const {expectedParentVersionId,...raw}=data(own(value,['version','spec','specSha256','requestSha256','inspection','expectedParentVersionId'])),record=recordValue(raw),version=record.version,b=version.binding;
  if(b.tenantId!==tenantId||version.parentVersionId!==expectedParentVersionId)fail('ARTIFACT_COMMIT_INPUT');if(expectedParentVersionId!==null)uuid(expectedParentVersionId);
  const context=data(own(authority,['authorization','invocation']));verifyArtifactPublicationInput({record,expectedParentVersionId,...context});if(context.authorization.expiresAtMs<=now())fail('ARTIFACT_AUTHORITY');return transaction(signal,async(c,life)=>{life.limitDeadline(context.authorization.expiresAtMs);
   await allowed(record,life);await life.run(()=>c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${tenantId}:${version.artifactId}`]));
   const {sql,facts}=await verified(c,version.artifactId,life),old=sql.records.find(r=>r.version.versionId===version.versionId);
   if(old&&!same(old,record))fail('ARTIFACT_IMMUTABLE_CONFLICT');
   if(!old&&(sql.head?.version_id??null)!==expectedParentVersionId)fail('ARTIFACT_STALE_PARENT');
   // The durable CAS owns parent/lineage validation and retains the original receipt once. ACK precedes either SQL write.
   const ack=data(await life.run(signal=>publish({record,expectedParentVersionId,...context},facts.positionSha256,signal)));
   own(ack,['created','decision']);if(typeof ack.created!=='boolean'||!same(ack.decision.record,record)||!same(ack.decision.invocation,context.invocation))fail('ARTIFACT_PUBLICATION_ACK_UNKNOWN');
   await allowed(record,life);if(!old){await insertArtifactRecord(c,record,life);await projectArtifactHead(c,record,sql.head,life);}
   await verified(c,version.artifactId,life);await allowed(record,life);return {status:old?'duplicate':'committed',versionId:version.versionId,requestSha256:record.requestSha256,versionSha256:v.hash(version)};
  });
 }
 /** One continuation INSIDE the existing raw journal.exclusive, after canonical retention recovery, before its fence opens.
  * Full current publication facts cover versions never previewed. No local/SQL/preview bootstrap; no generation/object writes. */
 async function recoverExclusive(signal){return transaction(signal,async(c,life)=>{
  const before=await current(life),restored=[],suppressed=[],versions=[];
  const inventory=(await life.run(()=>c.query('SELECT artifact_id FROM meri_artifacts.versions WHERE tenant_id=$1 UNION SELECT artifact_id FROM meri_artifacts.heads WHERE tenant_id=$1 ORDER BY artifact_id LIMIT 1025',[tenantId]))).rows;
  if(inventory.length>1024)fail('ARTIFACT_PUBLICATION_LIMIT');for(const row of inventory){uuid(row.artifact_id);if(!before.index.heads.some(h=>h.artifactId===row.artifact_id))fail('ARTIFACT_PUBLICATION_UNVERIFIED');}
  for(const head of before.index.heads){const artifactId=head.artifactId,decisions=before.index.decisions.filter(d=>d.record.version.artifactId===artifactId),latest=decisions.at(-1).record;
   if(before.index.tombstones.some(t=>t.artifactId===artifactId)){suppressed.push(artifactId);continue;}
   try{await allowed(latest,life,true,c);}catch(error){if(error.code!=='RETENTION_SUPPRESSED')throw error;suppressed.push(artifactId);continue;}
   await life.run(()=>c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${tenantId}:${artifactId}`]));
   const sql=await readArtifactProjection(c,tenantId,artifactId,life,{knownRecords:decisions.map(d=>d.record)});assertArtifactProjection(sql,before.index,artifactId,{allowMissing:true});
   for(const decision of decisions)await insertArtifactRecord(c,decision.record,life);
   await projectArtifactHead(c,latest,sql.head,life);const after=await readArtifactProjection(c,tenantId,artifactId,life);assertArtifactProjection(after,before.index,artifactId);await allowed(latest,life,true,c);restored.push(artifactId);for(const d of decisions)versions.push({versionId:d.record.version.versionId,recordSha256:d.recordSha256,versionSha256:v.hash(d.record.version)});
  }
  const after=await current(life);if(after.positionSha256!==before.positionSha256)fail('ARTIFACT_PUBLICATION_STALE');return {positionSha256:after.positionSha256,restored,suppressed,versions};
 },true);}
 // readExclusive is metadata validation only, for the existing recovery exclusion before the serving fence opens.
 return Object.freeze({read:(value,signal)=>readValue(value,signal),readExclusive:(value,signal)=>readValue(value,signal,true),commit,findByObject,recoverExclusive});
}
