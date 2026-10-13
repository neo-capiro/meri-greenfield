/** Durable versions over a borrowed pg-compatible pool; atomic immutable record/head CAS. */
import {readLocalReplay} from '../local-replay.mjs';
import {ARTIFACT_MIME_TYPES,artifactFilename} from '../../../packages/contracts/artifacts-0.2/artifact-formats.mjs';
import {v,own,data,fail,same,uuid,digest,scopeFacts,storageLifetime,configuration} from './boundary.mjs';
function recordValue(raw){const r=data(own(raw,['version','spec','specSha256','requestSha256','inspection']));
 const version=v.version(r.version),spec=v.request(r.spec),inspection=v.inspection(r.inspection);digest(r.requestSha256);uuid(version.versionId);uuid(version.artifactId);
 if(r.specSha256!==v.hash(spec)||!same(version.object.scopes,version.scopes)||version.scopes.some(s=>s.tenantId!==version.binding.tenantId)||
  version.evidence.some(e=>e.scopes.some(s=>!version.scopes.some(parent=>same(parent,s))))||version.object.sha256!==inspection.sha256||version.object.bytes!==inspection.bytes||inspection.format!==spec.format||
  version.mimeType!==ARTIFACT_MIME_TYPES[spec.format]||version.filename!==artifactFilename(spec)||version.generationStatus!=='draft'||version.previewStatus!=='pending')fail('ARTIFACT_VERSION_CORRUPT');
 scopeFacts(version.scopes);if(Buffer.byteLength(JSON.stringify(r))>4194304)fail('ARTIFACT_VERSION_LIMIT');return r;}
function decode(row){if(!row||v.hash(row.record)!==row.record_sha256)fail('ARTIFACT_VERSION_CORRUPT');const r=recordValue(row.record),b=r.version.binding;
 if(row.version_id!==r.version.versionId||row.artifact_id!==r.version.artifactId||row.tenant_id!==b.tenantId||row.actor_id!==b.actorId||row.conversation_id!==b.conversationId||row.request_sha256!==r.requestSha256)fail('ARTIFACT_VERSION_CORRUPT');return r;}
export function createPostgresArtifactVersions(options){const {pool,now,maxRequestMs=15000}=own(options,['pool','now'],['maxRequestMs']);configuration(now,maxRequestMs);
 if(typeof pool?.connect!=='function')fail('ARTIFACT_STORAGE_CONFIGURATION');
 async function transaction(signal,body){const life=storageLifetime({now,maxRequestMs},signal);let c,begun=false,committing=false,reusable=false,failure,result;
  // Capture a late connection and retire only this borrowed lease if acquisition
  // outlives the bounded caller. The caller's pool is never closed here.
  const acquiring=Promise.resolve().then(()=>pool.connect());
  try{c=await life.run(()=>acquiring);life.check();await life.run(()=>c.query('BEGIN'));begun=true;
   await life.run(()=>c.query("SET LOCAL statement_timeout = '5s'"));await life.run(()=>c.query("SET LOCAL lock_timeout = '2s'"));
   result=await body(c,life);life.check();committing=true;await life.run(()=>c.query('COMMIT'));reusable=true;life.check();
  }catch(error){failure=Object.assign(Error(committing?'ARTIFACT_VERSION_COMMIT_UNKNOWN':error.code??'ARTIFACT_VERSION_UNAVAILABLE'),{code:committing?'ARTIFACT_VERSION_COMMIT_UNKNOWN':error.code??'ARTIFACT_VERSION_UNAVAILABLE'});
   if(c&&begun&&!committing){const cleanup=storageLifetime({now,maxRequestMs:Math.min(maxRequestMs,1000)});
    try{await cleanup.run(()=>c.query('ROLLBACK'));reusable=true;}catch{}finally{cleanup.close();}}}
  finally{if(c)try{c.release(reusable?undefined:failure);}catch{failure??=Object.assign(Error('ARTIFACT_VERSION_RELEASE_UNKNOWN'),{code:'ARTIFACT_VERSION_RELEASE_UNKNOWN'});}else acquiring.then(lease=>{try{lease.release(Error('ARTIFACT_VERSION_LATE_LEASE'));}catch{}},()=>{});life.close();}
  if(failure)throw failure;return data(result);}
 async function rawVersion(c,id,life){const rows=(await life.run(()=>c.query('SELECT * FROM meri_artifacts.versions WHERE version_id=$1',[uuid(id)]))).rows;life.check();
  if(!rows.length)throw Object.assign(Error('ENOENT'),{code:'ENOENT'});if(rows.length!==1)fail('ARTIFACT_VERSION_CORRUPT');return decode(rows[0]);}
 async function head(c,artifactId,life){const rows=(await life.run(()=>c.query('SELECT * FROM meri_artifacts.heads WHERE artifact_id=$1 FOR SHARE',[uuid(artifactId)]))).rows;life.check();
  if(!rows.length)throw Object.assign(Error('ENOENT'),{code:'ENOENT'});if(rows.length!==1)fail('ARTIFACT_VERSION_CORRUPT');const row=rows[0],p=row.projection;
  if(v.hash(p)!==row.projection_sha256||row.artifact_id!==p.artifactId||row.tenant_id!==p.tenantId||row.actor_id!==p.actorId||row.conversation_id!==p.conversationId||row.version_id!==p.versionId)fail('ARTIFACT_VERSION_CORRUPT');
  const current=await rawVersion(c,p.versionId,life);if(current.version.artifactId!==artifactId||current.version.binding.tenantId!==p.tenantId||current.version.binding.actorId!==p.actorId||current.version.binding.conversationId!==p.conversationId||v.hash(current.version.scopes)!==p.scopesSha256)fail('ARTIFACT_VERSION_CORRUPT');return row;}
 function replay(c,query,life){return readLocalReplay(query,{hash:v.hash,check:life.check,
  async readVersion(id){const record=await rawVersion(c,id,life);return {record,bytes:Buffer.byteLength(JSON.stringify(record))};},
  readHead:async artifactId=>(await head(c,artifactId,life)).version_id,
  async listVersions(){const rows=(await life.run(()=>c.query('SELECT version_id FROM meri_artifacts.versions WHERE request_sha256=$1 ORDER BY version_id LIMIT 1025',[query.requestSha256]))).rows;life.check();return rows.map(row=>row.version_id+'.json');}});}
 async function read(value,signal){return transaction(signal,async(c,life)=>{if(typeof value!=='string')return replay(c,data(value),life);
  const record=await rawVersion(c,value,life);return replay(c,{kind:'artifact-replay',versionId:value,requestSha256:record.requestSha256,resultSha256:null},life);});}
 async function commit(value,signal){const fields=own(value,['version','spec','specSha256','requestSha256','inspection','expectedParentVersionId']),{expectedParentVersionId,...raw}=fields,record=recordValue(raw),version=record.version,b=version.binding;
  if(expectedParentVersionId!==null)uuid(expectedParentVersionId);if(version.parentVersionId!==expectedParentVersionId)fail('ARTIFACT_COMMIT_INPUT');
  return transaction(signal,async(c,life)=>{await life.run(()=>c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${b.tenantId}:${version.artifactId}`]));life.check();
   const oldRows=(await life.run(()=>c.query('SELECT * FROM meri_artifacts.versions WHERE version_id=$1',[version.versionId]))).rows;life.check();
   if(oldRows.length){if(oldRows.length!==1||!same(decode(oldRows[0]),record))fail('ARTIFACT_IMMUTABLE_CONFLICT');await replay(c,{kind:'artifact-replay',versionId:version.versionId,requestSha256:record.requestSha256,resultSha256:null},life);
    return {status:'duplicate',versionId:version.versionId,requestSha256:record.requestSha256,versionSha256:v.hash(version)};}
   let current=null;try{current=await head(c,version.artifactId,life);}catch(error){if(error.code!=='ENOENT')throw error;}
   if((current?.version_id??null)!==expectedParentVersionId)fail('ARTIFACT_STALE_PARENT');
   if(current){const parent=await rawVersion(c,expectedParentVersionId,life);
    if(parent.version.artifactId!==version.artifactId||['tenantId','actorId','conversationId'].some(k=>parent.version.binding[k]!==b[k])||!same(parent.version.scopes,version.scopes)||parent.spec.operation!==record.spec.operation||parent.spec.format!==record.spec.format)fail('ARTIFACT_PARENT_BINDING');}
   await life.run(()=>c.query('INSERT INTO meri_artifacts.versions(version_id,artifact_id,tenant_id,actor_id,conversation_id,request_sha256,record,record_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [version.versionId,version.artifactId,b.tenantId,b.actorId,b.conversationId,record.requestSha256,record,v.hash(record)]));life.check();
   const projection={artifactId:version.artifactId,versionId:version.versionId,tenantId:b.tenantId,actorId:b.actorId,conversationId:b.conversationId,scopesSha256:v.hash(version.scopes)};
   if(current){const result=await life.run(()=>c.query('UPDATE meri_artifacts.heads SET version_id=$2,projection=$3,projection_sha256=$4 WHERE artifact_id=$1 AND version_id=$5',[version.artifactId,version.versionId,projection,v.hash(projection),expectedParentVersionId]));if(result.rowCount!==1)fail('ARTIFACT_STALE_PARENT');}
   else await life.run(()=>c.query('INSERT INTO meri_artifacts.heads(artifact_id,version_id,tenant_id,actor_id,conversation_id,projection,projection_sha256) VALUES($1,$2,$3,$4,$5,$6,$7)',[version.artifactId,version.versionId,b.tenantId,b.actorId,b.conversationId,projection,v.hash(projection)]));
   life.check();return {status:'committed',versionId:version.versionId,requestSha256:record.requestSha256,versionSha256:v.hash(version)};});}
 return Object.freeze({read,commit});
}
