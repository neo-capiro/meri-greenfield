/** Durable versions over a borrowed pg-compatible pool; atomic immutable record/head CAS. */
import {readLocalReplay} from '../local-replay.mjs';

import {v,own,data,fail,same,uuid,storageLifetime,configuration,storageMethod} from './boundary.mjs';
import {verifyArtifactPublications,verifyArtifactPublicationInput} from './artifact-publication.mjs';
import {readArtifactProjection,assertArtifactProjection,insertArtifactRecord,projectArtifactHead} from './postgres-publication-projection.mjs';
import {createPostgresPagedPublication} from './postgres-paged-publication.mjs';
import {verifyArtifactVersionStorageRecord as recordValue,verifyArtifactVersionStorageRow as decode,verifyArtifactVersionStorageHead} from './version-record.mjs';
export {verifyArtifactVersionStorageRecord,verifyArtifactVersionStorageRow} from './version-record.mjs';
export function createPostgresArtifactVersions(options){const {pool,now,maxRequestMs=15000,journal=null,publication=null,publications=null,tenantId=null,retention=null}=own(options,['pool','now'],['maxRequestMs','journal','publication','publications','tenantId','retention']);configuration(now,maxRequestMs);storageMethod(pool,'connect');
 // Imports/construction remain inert. Missing durable owner is unavailable BEFORE SQL, never legacy SQL publication.
 if(journal===null||retention===null||publications===null&&(publication===null||tenantId===null)){const unavailable=async()=>fail('ARTIFACT_PUBLICATION_UNAVAILABLE');return Object.freeze({read:unavailable,readExclusive:unavailable,history:unavailable,list:unavailable,commit:unavailable,findByObject:unavailable,recoverExclusive:unavailable,recoverTenant:unavailable});}
 if(publications!==null&&(publication!==null||tenantId!==null)||tenantId!==null&&(typeof tenantId!=='string'||!tenantId))fail('ARTIFACT_STORAGE_CONFIGURATION');
 const tx=storageMethod(journal,'tx'),readRetention=storageMethod(journal,'readProjection'),assertServable=storageMethod(retention,'assertServable');
 const forTenant=publications===null?null:storageMethod(publications,'forTenant'),exclusive=storageMethod(journal,'exclusive');
 const owner=tenant=>{if(typeof tenant!=='string'||!tenant||tenant.length>128||tenant.trim()!==tenant||tenantId!==null&&tenant!==tenantId)fail('ARTIFACT_VERSION_CORRUPT');return forTenant?forTenant(tenant):publication;};
 async function transaction(signal,body,exclusive=false){const life=storageLifetime({now,maxRequestMs},signal);try{life.check();return data(await tx(c=>{life.check();return body(c,life);},{exclusive,readCommitted:true}));}catch(cause){if(cause?.code==='RETENTION_COMMIT_UNKNOWN')throw Object.assign(Error('ARTIFACT_VERSION_COMMIT_UNKNOWN'),{code:'ARTIFACT_VERSION_COMMIT_UNKNOWN',cause});for(let root=cause,depth=0;root&&depth<4;root=root.cause,depth++)if(root.deadline)throw Object.assign(Error('ARTIFACT_STORAGE_'+root.deadline),{code:'ARTIFACT_STORAGE_'+root.deadline,cause});if(cause?.code==='RETENTION_STORE_UNAVAILABLE'&&cause.cause?.code)throw cause.cause;throw cause;}finally{life.close();}}
 async function current(life,tenant){const p=data(await life.run(signal=>storageMethod(owner(tenant),'snapshot')(signal)));own(p,['index','positionSha256']);const index=verifyArtifactPublications(p.index,tenant);if(p.positionSha256!==v.hash(index))fail('ARTIFACT_PUBLICATION_CORRUPT');return p;}
 async function allowed(record,life,exclusive=false,c){const b=record.version.binding,tenantId=b.tenantId;for(const subject of [{tenantId,kind:'artifact',subjectId:record.version.artifactId},{tenantId,kind:'conversation',subjectId:b.conversationId}]){
  // Reuse the canonical raw journal reader ON THIS transaction lease while the existing owner holds recovery exclusion.
  if(exclusive){const {projection:row}=await life.run(()=>readRetention(c,`${tenantId}:${subject.kind}:${subject.subjectId}`));if(row&&row.state!=='RELEASED')fail('RETENTION_SUPPRESSED');}
  else await life.run(()=>assertServable(subject));}life.check();}
 const paged=createPostgresPagedPublication({owner,allowed});
 async function verified(c,tenant,artifactId,life){const sql=await readArtifactProjection(c,tenant,artifactId,life),facts=await current(life,tenant);assertArtifactProjection(sql,facts.index,artifactId);return {sql,facts};}
 async function rawVersion(c,id,life){const rows=(await life.run(()=>c.query('SELECT * FROM meri_artifacts.versions WHERE version_id=$1',[uuid(id)]))).rows;life.check();
  if(!rows.length)throw Object.assign(Error('ENOENT'),{code:'ENOENT'});if(rows.length!==1)fail('ARTIFACT_VERSION_CORRUPT');const r=decode(rows[0]);if(tenantId!==null&&r.version.binding.tenantId!==tenantId)fail('ARTIFACT_VERSION_CORRUPT');return r;}
 async function head(c,artifactId,life){const rows=(await life.run(()=>c.query('SELECT * FROM meri_artifacts.heads WHERE artifact_id=$1 FOR SHARE',[uuid(artifactId)]))).rows;life.check();
  if(!rows.length)throw Object.assign(Error('ENOENT'),{code:'ENOENT'});if(rows.length!==1||rows[0].artifact_id!==artifactId)fail('ARTIFACT_VERSION_CORRUPT');const row=rows[0],current=await rawVersion(c,row.version_id,life);return verifyArtifactVersionStorageHead(row,current);}
 function replay(c,query,life){let tenant=tenantId;return readLocalReplay(query,{hash:v.hash,check:life.check,
  async readVersion(id){const record=await rawVersion(c,id,life);tenant??=record.version.binding.tenantId;if(tenant!==record.version.binding.tenantId)fail('ARTIFACT_VERSION_CORRUPT');return {record,bytes:Buffer.byteLength(JSON.stringify(record))};},
  readHead:async artifactId=>(await head(c,artifactId,life)).version_id,
  async listVersions(){const rows=(await life.run(()=>c.query('SELECT version_id FROM meri_artifacts.versions WHERE request_sha256=$1 ORDER BY version_id LIMIT 1025',[query.requestSha256]))).rows;life.check();return rows.map(row=>row.version_id+'.json');}});}
 async function readValue(value,signal,exclusive=false){return transaction(signal,async(c,life)=>{let record;
  let raw;try{raw=await rawVersion(c,typeof value==='string'?value:value.versionId,life);}catch(error){if(error.code!=='ENOENT'||typeof value==='string')throw error;}
  if(raw&&await paged.mode(life,raw.version.binding.tenantId))return paged.read(c,life,value,raw,exclusive);
  if(typeof value!=='string')record=await replay(c,data(value),life);else{const raw=await rawVersion(c,value,life);record=await replay(c,{kind:'artifact-replay',versionId:value,requestSha256:raw.requestSha256,resultSha256:null},life);}
  await allowed(record,life,exclusive,c);const {sql}=await verified(c,record.version.binding.tenantId,record.version.artifactId,life);if(!sql.records.some(r=>same(r,record)))fail('ARTIFACT_PUBLICATION_PROJECTION_STALE');await allowed(record,life,exclusive,c);return record;},exclusive);}
 /** Metadata only, in immutable parent order. Publication/SQL agreement and retention are checked on every read. */
 async function history(versionId,signal){return transaction(signal,async(c,life)=>{
  const anchor=await rawVersion(c,versionId,life),tenant=anchor.version.binding.tenantId,artifactId=anchor.version.artifactId;await allowed(anchor,life);
  if(await paged.mode(life,tenant))fail('ARTIFACT_PUBLICATION_PAGE_REQUIRED');
  const {sql,facts}=await verified(c,tenant,artifactId,life);if(!sql.records.some(r=>same(r,anchor))||!sql.head)fail('ARTIFACT_PUBLICATION_PROJECTION_STALE');
  const remaining=new Map(sql.records.map(r=>[r.version.versionId,r])),records=[];let id=sql.head.version_id;
  while(id!==null){const record=remaining.get(id);if(!record)fail('ARTIFACT_VERSION_CORRUPT');remaining.delete(id);records.push(record);id=record.version.parentVersionId;}
  if(remaining.size||!records.length)fail('ARTIFACT_VERSION_CORRUPT');
  await allowed(anchor,life);const after=await current(life,tenant);if(after.positionSha256!==facts.positionSha256)fail('ARTIFACT_PUBLICATION_STALE');
  return {artifactId,anchorVersionId:versionId,headVersionId:sql.head.version_id,records};
 });}
 /** Internal discovery candidates from canonical publication. Every public row still needs current origin authority and read(). */
 async function list(value,signal){const q=data(own(value,['tenantId','actorId','conversationId','clientId']));owner(q.tenantId);
  if(typeof q.actorId!=='string'||!q.actorId||q.actorId.length>128||q.conversationId!==null&&typeof q.conversationId!=='string'||q.clientId!==null&&typeof q.clientId!=='string')fail('ARTIFACT_STORAGE_INPUT');
  if(q.conversationId!==null)uuid(q.conversationId);if(q.clientId!==null)uuid(q.clientId);
  const life=storageLifetime({now,maxRequestMs},signal);try{const {index}=await current(life,q.tenantId),heads=new Map(index.heads.map(h=>[h.artifactId,h.versionId])),terminal=new Set(index.tombstones.map(t=>t.artifactId));
   const records=index.decisions.map(d=>d.record).filter(r=>{const v=r.version;return heads.get(v.artifactId)===v.versionId&&!terminal.has(v.artifactId)&&v.binding.actorId===q.actorId&&(q.conversationId===null||v.binding.conversationId===q.conversationId)&&(q.clientId===null||v.scopes.length===1&&v.scopes[0].kind==='client'&&v.scopes[0].resourceId===q.clientId);});
   life.check();return data({records});
  }finally{life.close();}
 }
 /** The version id whose immutable object is `objectId` within one tenant conversation (decoded and checked); ENOENT when none.
  * Unindexed JSON-path read on the existing table (no migration); an index is a separate migration proposal. */
 async function findByObject(value,signal){const q=data(own(value,['objectId','tenantId','conversationId']));uuid(q.objectId);uuid(q.conversationId);if(tenantId!==null&&q.tenantId!==tenantId)fail('ARTIFACT_STORAGE_INPUT');owner(q.tenantId);if(forTenant)await recoverTenant(q.tenantId,signal);
  return transaction(signal,async(c,life)=>{
   if(await paged.mode(life,q.tenantId)){const proof=await life.run(signal=>storageMethod(owner(q.tenantId),'findObject')(q.objectId,q.conversationId,signal));if(proof===null)throw Object.assign(Error('ENOENT'),{code:'ENOENT'});const id=proof.decision.record.version.versionId;await paged.ensure(c,life,q.tenantId,id,{repair:true});return id;}
   const rows=(await life.run(()=>c.query("SELECT version_id FROM meri_artifacts.versions WHERE tenant_id=$1 AND conversation_id=$2 AND record #>> '{version,object,objectId}'=$3 ORDER BY version_id LIMIT 2",[q.tenantId,q.conversationId,q.objectId]))).rows;life.check();
   if(!rows.length)throw Object.assign(Error('ENOENT'),{code:'ENOENT'});if(rows.length!==1)fail('ARTIFACT_VERSION_CORRUPT');
   // rawVersion decodes the row and checks its relational tenant/conversation columns against the record.
   const record=await rawVersion(c,rows[0].version_id,life);if(record.version.binding.tenantId!==q.tenantId||record.version.binding.conversationId!==q.conversationId||record.version.object.objectId!==q.objectId)fail('ARTIFACT_VERSION_CORRUPT');await allowed(record,life);const {sql}=await verified(c,q.tenantId,record.version.artifactId,life);if(!sql.records.some(r=>same(r,record)))fail('ARTIFACT_PUBLICATION_PROJECTION_STALE');await allowed(record,life);return record.version.versionId;});}
 async function commit(value,signal,authority){const {expectedParentVersionId,...raw}=data(own(value,['version','spec','specSha256','requestSha256','inspection','expectedParentVersionId'],['assets'])),record=recordValue(raw),version=record.version,b=version.binding;
  if(tenantId!==null&&b.tenantId!==tenantId||version.parentVersionId!==expectedParentVersionId)fail('ARTIFACT_COMMIT_INPUT');if(expectedParentVersionId!==null)uuid(expectedParentVersionId);
  const publish=storageMethod(owner(b.tenantId),'publish');
  const context=data(own(authority,['authorization','invocation']));verifyArtifactPublicationInput({record,expectedParentVersionId,...context});if(context.authorization.expiresAtMs<=now())fail('ARTIFACT_AUTHORITY');return transaction(signal,async(c,life)=>{life.limitDeadline(context.authorization.expiresAtMs);
   if(await paged.mode(life,b.tenantId))return paged.commit(c,life,record,expectedParentVersionId,context);
   await allowed(record,life);await life.run(()=>c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${b.tenantId}:${version.artifactId}`]));
   const {sql,facts}=await verified(c,b.tenantId,version.artifactId,life),old=sql.records.find(r=>r.version.versionId===version.versionId);
   if(old&&!same(old,record))fail('ARTIFACT_IMMUTABLE_CONFLICT');
   if(!old&&(sql.head?.version_id??null)!==expectedParentVersionId)fail('ARTIFACT_STALE_PARENT');
   // The durable CAS owns parent/lineage validation and retains the original receipt once. ACK precedes either SQL write.
   const ack=data(await life.run(signal=>publish({record,expectedParentVersionId,...context},facts.positionSha256,signal)));
   own(ack,['created','decision']);if(typeof ack.created!=='boolean'||!same(ack.decision.record,record)||!same(ack.decision.invocation,context.invocation))fail('ARTIFACT_PUBLICATION_ACK_UNKNOWN');
   await allowed(record,life);if(!old){await insertArtifactRecord(c,record,life);await projectArtifactHead(c,record,sql.head,life);}
   await verified(c,b.tenantId,version.artifactId,life);await allowed(record,life);return {status:old?'duplicate':'committed',versionId:version.versionId,requestSha256:record.requestSha256,versionSha256:v.hash(version)};
  });
 }
 /** One continuation INSIDE the existing raw journal.exclusive, after canonical retention recovery, before its fence opens.
  * Full current publication facts cover versions never previewed. No local/SQL/preview bootstrap; no generation/object writes. */
 async function recoverTenantOnLease(c,life,tenantId){
  if(await paged.mode(life,tenantId)){const facts=await paged.snapshot(life,tenantId);return {positionSha256:facts.positionSha256,restored:[],suppressed:[],versions:[],paged:true};}
  const before=await current(life,tenantId),restored=[],suppressed=[],versions=[];
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
  const after=await current(life,tenantId);if(after.positionSha256!==before.positionSha256)fail('ARTIFACT_PUBLICATION_STALE');return {positionSha256:after.positionSha256,restored,suppressed,versions};
 }
 /** Recover only a trusted caller's actual tenant before its missing-row lookup.
  * This is metadata repair, never user authority or a complete purge inventory.
  * No memoization: every access verifies the current durable publication again. */
 async function recoverTenant(tenant,signal){owner(tenant);const life=storageLifetime({now,maxRequestMs},signal);
  try{life.check();return await exclusive(()=>transaction(life.signal,(c,inner)=>recoverTenantOnLease(c,inner,tenant),true));}
  finally{life.close();}
 }
 // Fixed preview recovery already owns the same exclusion. Dynamic startup has no tenant and must never guess one.
 async function recoverExclusive(signal){if(tenantId===null)fail('ARTIFACT_RECOVERY_TENANT_REQUIRED');return transaction(signal,(c,life)=>recoverTenantOnLease(c,life,tenantId),true);}
 async function publicationSnapshot(tenant,signal){return transaction(signal,async(c,life)=>{const facts=await paged.snapshot(life,tenant);return {positionSha256:facts.positionSha256,paged:await paged.mode(life,tenant)};});}
 async function recoverVersion(tenant,id,signal){uuid(id);return exclusive(()=>transaction(signal,async(c,life)=>{
  if(!await paged.mode(life,tenant)){await recoverTenantOnLease(c,life,tenant);return {versionId:id};}
  await paged.ensure(c,life,tenant,id,{repair:true,exclusive:true});return {versionId:id};
 },true));}
 async function recoverVersionsExclusive(tenant,ids,signal){if(!Array.isArray(ids)||ids.length>128||new Set(ids).size!==ids.length)fail('ARTIFACT_STORAGE_INPUT');ids.forEach(uuid);return transaction(signal,async(c,life)=>{
  if(!await paged.mode(life,tenant))return recoverTenantOnLease(c,life,tenant);const versions=[];
  for(const id of ids){const {record}=await paged.ensure(c,life,tenant,id,{repair:true,exclusive:true});versions.push({versionId:id,recordSha256:v.hash(record),versionSha256:v.hash(record.version)});}return {versions};
 },true);}
 /** Explicit bounded metadata repair continuation. A partial page never certifies a complete purge inventory. */
 async function recoverPage(tenant,value,signal){const q=data(own(value,['offset','limit','positionSha256']));return exclusive(()=>transaction(signal,async(c,life)=>{
  const page=await life.run(signal=>storageMethod(owner(tenant),'page')({kind:'recovery',...q},signal)),restored=[],suppressed=[];
  for(const proof of page.records){const id=proof.decision.record.version.versionId;try{await paged.ensure(c,life,tenant,id,{repair:true,exclusive:true});restored.push(id);}catch(error){if(!['RETENTION_SUPPRESSED','ARTIFACT_PUBLICATION_TERMINAL'].includes(error.code))throw error;suppressed.push(id);}}
  await paged.stable(life,tenant,page.positionSha256);return {positionSha256:page.positionSha256,nextOffset:page.nextOffset,restored,suppressed};
 },true));}
 async function listPage(value,signal){const q=data(own(value,['tenantId','actorId','conversationId','clientId','offset','limit','positionSha256']));owner(q.tenantId);
  if(typeof q.actorId!=='string'||!q.actorId||q.actorId.length>128||q.conversationId!==null&&typeof q.conversationId!=='string'||q.clientId!==null&&typeof q.clientId!=='string')fail('ARTIFACT_STORAGE_INPUT');
  if(q.conversationId!==null)uuid(q.conversationId);if(q.clientId!==null)uuid(q.clientId);
  return transaction(signal,async(c,life)=>{
  const page=await life.run(signal=>storageMethod(owner(q.tenantId),'page')({kind:'list',offset:q.offset,limit:q.limit,positionSha256:q.positionSha256},signal));
  const records=page.records.map(p=>recordValue(p.decision.record)).filter(r=>{const b=r.version.binding,s=r.version.scopes;return b.tenantId===q.tenantId&&b.actorId===q.actorId&&(q.conversationId===null||b.conversationId===q.conversationId)&&(q.clientId===null||s.length===1&&s[0].kind==='client'&&s[0].resourceId===q.clientId);});
  return {records,nextOffset:page.nextOffset,positionSha256:page.positionSha256};
 });}
 async function historyPage(value,signal){const q=data(own(value,['tenantId','versionId','offset','limit','positionSha256']));return transaction(signal,async(c,life)=>{
  const anchor=await paged.point(life,q.tenantId,q.versionId),artifactId=anchor.result.decision.record.version.artifactId,page=await life.run(signal=>storageMethod(owner(q.tenantId),'page')({kind:'history',artifactId,anchorVersionId:q.versionId,offset:q.offset,limit:q.limit,positionSha256:q.positionSha256},signal)),records=[];
  for(const proof of page.records){const id=proof.decision.record.version.versionId,{record}=await paged.ensure(c,life,q.tenantId,id,{repair:true});records.push(record);}await paged.stable(life,q.tenantId,page.positionSha256);
  return {artifactId,anchorVersionId:q.versionId,headVersionId:anchor.result.head.versionId,records,nextOffset:page.nextOffset,positionSha256:page.positionSha256};
 });}
 // readExclusive is metadata validation only, for the existing recovery exclusion before the serving fence opens.
 return Object.freeze({read:(value,signal)=>readValue(value,signal),readExclusive:(value,signal)=>readValue(value,signal,true),history,list,commit,findByObject,recoverExclusive,recoverTenant,publicationSnapshot,recoverVersion,recoverVersionsExclusive,recoverPage,listPage,historyPage});
}
