/** Effectful reserved0003 projection. Durable preview facts precede every SQL projection. Only the call that receives a genuine
 * NEW conditional winner acknowledgement may dispatch, and only after exact coherent projection/current-facts verification.
 * Reads compare immutable facts, not a local high-water cache or a retention sequence. No deletion is implemented. */
import {v,data,storageMethod,storageLifetime,configuration,fail,same} from '../storage/boundary.mjs';
import {verifyPreviewClaim} from './claim.mjs';import {verifyPreviewRecord} from './record.mjs';
export function createCustodiedPostgresPreviewStore({journal,versions,custodyJournal,tenantId,artifactId,now,maxRequestMs,projection}){
 configuration(now,maxRequestMs);const tx=storageMethod(journal,'tx'),readVersion=storageMethod(versions,'read');
 const snapshot=storageMethod(custodyJournal,'snapshot'),claimFact=storageMethod(custodyJournal,'claim'),objectFact=storageMethod(custodyJournal,'recordObject'),commitFact=storageMethod(custodyJournal,'commit');
 async function bounded(signal,body){const life=storageLifetime({now,maxRequestMs},signal);try{const result=await life.run(body);life.check();return data(result);}finally{life.close();}}
 const find=(facts,id)=>facts.rows.find(row=>row.claim.versionId===id)??null;
 const bound=row=>{if(row.claim.tenantId!==tenantId||row.claim.artifactId!==artifactId)fail('ARTIFACT_PREVIEW_CUSTODY_CORRUPT');return row;};
 async function certified(signal,exclusive=false){
  // One joined SQL statement snapshot first, then the CURRENT complete outside-rollback facts. This catches an event the reader
  // never observed before a restore, and does not combine two independently timed SQL reads into a fictitious certificate.
  const projected=await projection(signal,exclusive),facts=await snapshot(signal);if(projected.length!==facts.rows.length)fail('ARTIFACT_PREVIEW_PROJECTION_STALE');
  for(const row of projected){const expected=find(facts,row.claim.versionId);if(!expected||!same(row.claim,expected.claim)||!same(row.object,expected.object)||!same(row.record,expected.record))fail('ARTIFACT_PREVIEW_PROJECTION_STALE');}
  return facts;
 }
 async function source(id,signal){const stored=data(await readVersion(id,signal));if(stored.version?.artifactId!==artifactId||stored.version?.binding.tenantId!==tenantId)fail('ARTIFACT_PREVIEW_CLAIM');return stored;}
 async function insertClaim(c,claim){const args=[claim.tenantId,claim.conversationId,claim.artifactId,claim.versionId,claim.sourceVersionSha256,claim.sourceSha256,claim.previewId,claim.objectId,claim,v.hash(claim)];
  await c.query('INSERT INTO meri_artifacts.preview_attempts(tenant_id,conversation_id,artifact_id,version_id,source_version_sha256,source_sha256,preview_id,object_id,claim,claim_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING',args);
  const rows=(await c.query('SELECT claim,claim_sha256 FROM meri_artifacts.preview_attempts WHERE tenant_id=$1 AND version_id=$2 FOR UPDATE',[tenantId,claim.versionId])).rows;
  if(rows.length!==1||rows[0].claim_sha256!==v.hash(claim)||!same(rows[0].claim,claim))fail('ARTIFACT_PREVIEW_CONFLICT');
 }
 async function insertObject(c,claim,object){const hash=v.hash(object);
  await c.query('UPDATE meri_artifacts.preview_attempts SET object_reference=$3,object_reference_sha256=$4,object_version_id=$5 WHERE tenant_id=$1 AND version_id=$2 AND claim_sha256=$6 AND object_reference IS NULL',[tenantId,claim.versionId,object,hash,object.versionId,v.hash(claim)]);
  const rows=(await c.query('SELECT object_reference,object_reference_sha256,object_version_id FROM meri_artifacts.preview_attempts WHERE tenant_id=$1 AND version_id=$2 FOR UPDATE',[tenantId,claim.versionId])).rows;
  if(rows.length!==1||rows[0].object_reference_sha256!==hash||rows[0].object_version_id!==object.versionId||!same(rows[0].object_reference,object))fail('ARTIFACT_PREVIEW_CONFLICT');
 }
 async function insertRecord(c,claim,object,record){const args=[tenantId,claim.conversationId,artifactId,claim.versionId,claim.sourceVersionSha256,claim.sourceSha256,claim.previewId,v.hash(claim),v.hash(object),record,v.hash(record)];
  await c.query('INSERT INTO meri_artifacts.previews(tenant_id,conversation_id,artifact_id,version_id,source_version_sha256,source_sha256,preview_id,claim_sha256,object_reference_sha256,record,record_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING',args);
  const rows=(await c.query('SELECT record,record_sha256 FROM meri_artifacts.previews WHERE tenant_id=$1 AND version_id=$2',[tenantId,claim.versionId])).rows;
  if(rows.length!==1||rows[0].record_sha256!==v.hash(record)||!same(rows[0].record,record))fail('ARTIFACT_PREVIEW_CONFLICT');
 }
 async function project(row,signal,exclusive=false){bound(row);return bounded(signal,()=>tx(async c=>{
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`meri_preview:${tenantId}:${row.claim.versionId}`]);
  await insertClaim(c,row.claim);if(row.object)await insertObject(c,row.claim,row.object);if(row.record)await insertRecord(c,row.claim,row.object,row.record);
  return null;},{exclusive,readCommitted:true}));}
 async function active(id,claim,signal){const facts=await certified(signal),row=find(facts,id);if(!row||claim&&!same(row.claim,claim))fail('ARTIFACT_PREVIEW_CLAIM');
  if(row.tombstone)fail('ARTIFACT_PREVIEW_TOMBSTONED');return row;}
 return Object.freeze({
  async read(id,signal){const facts=await certified(signal),row=find(facts,id);if(row?.tombstone)fail('ARTIFACT_PREVIEW_TOMBSTONED');return row?.record??null;},
  async custody(signal){return (await certified(signal)).rows.map(row=>({...row,state:row.tombstone?'TOMBSTONE':row.record?'COMMITTED':'UNKNOWN'}));},
  async assertCurrent(claim,signal){const row=await active(claim.versionId,claim,signal);if(now()>=row.claim.deadlineMs)fail('ARTIFACT_PREVIEW_CLAIM_EXPIRED');},
  async claim(value,signal){return bounded(signal,async signal=>{
   await certified(signal);const stored=await source(value.versionId,signal),claim=verifyPreviewClaim(v,value,stored.version);
   if(now()>=claim.deadlineMs)fail('ARTIFACT_PREVIEW_CLAIM_EXPIRED');
   const ack=await claimFact(claim,stored,signal),facts=await snapshot(signal),row=find(facts,claim.versionId);
   if(!row||!same(row.claim,ack.claim)||row.tombstone)fail(row?.tombstone?'ARTIFACT_PREVIEW_TOMBSTONED':'ARTIFACT_PREVIEW_CUSTODY_CORRUPT');
   // Reprojection is explicit recovery work. An ordinary duplicate never repairs away a stale certificate to gain dispatch.
   if(ack.created===true)await project(row,signal);const settled=find(await certified(signal),claim.versionId);
   if(settled.tombstone)fail('ARTIFACT_PREVIEW_TOMBSTONED');if(now()>=settled.claim.deadlineMs)fail('ARTIFACT_PREVIEW_CLAIM_EXPIRED');
   return {claimed:ack.created===true&&!settled.object&&!settled.record,claim:settled.claim};
  });},
  async recordObject(claimValue,objectValue,signal){return bounded(signal,async signal=>{
   // Recording a known physical receipt never grants serving/dispatch authority. Retain it even after tombstone or SQL restore;
   // otherwise an already completed put could lose its exact native custody precisely when release must be refused.
   const row=find(await snapshot(signal),claimValue.versionId),object=v.object(objectValue);
   if(!row||!same(row.claim,claimValue))fail('ARTIFACT_PREVIEW_CLAIM');
   if(object.objectId!==row.claim.objectId||!same(object.scopes,row.claim.scopes)||!object.versionId||object.versionId==='null'||Buffer.byteLength(object.versionId)>1024)fail('ARTIFACT_OBJECT_MISMATCH');
   if(row.object&&!same(row.object,object))fail('ARTIFACT_PREVIEW_CONFLICT');await objectFact(row.claim,object,signal);
   const next=find(await snapshot(signal),row.claim.versionId);if(!next||!same(next.object,object))fail('ARTIFACT_PREVIEW_CUSTODY_CORRUPT');
   await project(next,signal);await certified(signal);return null;
  });},
  async commit(value,signal){return bounded(signal,async signal=>{
   const row=await active(value.versionId,null,signal),record=verifyPreviewRecord(v,value,row.source.version);
   if(!row.object||record.previewId!==row.claim.previewId||!same(record.preview.object,row.object))fail('ARTIFACT_PREVIEW_CLAIM');
   if(row.record&&!same(row.record,record))fail('ARTIFACT_PREVIEW_CONFLICT');await commitFact(row.claim,record,signal);
   const next=find(await snapshot(signal),row.claim.versionId);if(!next||next.tombstone||!same(next.record,record))fail('ARTIFACT_PREVIEW_CUSTODY_CORRUPT');
   await project(next,signal);const settled=find(await certified(signal),row.claim.versionId);if(settled.tombstone)fail('ARTIFACT_PREVIEW_TOMBSTONED');
   return {status:row.record?'duplicate':'committed',versionId:record.versionId,recordSha256:v.hash(record)};
  });},
  /** Only the canonical recovery owner calls this while it holds journal.exclusive. Sources/heads are not guessed from claims. */
  async replay(sourceRecovery,signal){const recover=storageMethod(sourceRecovery,'recover'),facts=await snapshot(signal);
   for(const row of facts.rows){await recover(data(row.source),signal);await project(row,signal,true);}return certified(signal,true);},
  ensureServing:signal=>certified(signal),
 });
}
