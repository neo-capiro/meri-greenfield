/** Concrete immutable prerequisite recovery over existing0001 rows and the canonical transaction/version owners.
 * Called INSIDE the existing recovery exclusion. Never derives/inserts a head from a historical preview claim. */
import {v,own,data,same,uuid,configuration,storageMethod,storageLifetime,fail} from './boundary.mjs';
import {verifyArtifactVersionStorageRecord,verifyArtifactVersionStorageRow} from './postgres-versions.mjs';
export function createPostgresArtifactSourceRecovery(options){
 const {journal,versions,tenantId,artifactId,now,maxRequestMs=15000}=own(options,['journal','versions','tenantId','artifactId','now'],['maxRequestMs']);configuration(now,maxRequestMs);uuid(artifactId);
 if(typeof tenantId!=='string'||!tenantId)fail('ARTIFACT_STORAGE_CONFIGURATION');const tx=storageMethod(journal,'tx'),read=storageMethod(versions,'read');
 async function recoverAll(values,signal){const batch=data(values);if(!Array.isArray(batch)||batch.length>128||Buffer.byteLength(JSON.stringify(batch))>8388608)fail('ARTIFACT_SOURCE_RECOVERY_LIMIT');
  const records=batch.map(verifyArtifactVersionStorageRecord),seen=new Set();for(const record of records){const version=record.version;if(version.binding.tenantId!==tenantId||version.artifactId!==artifactId||seen.has(version.versionId))fail('ARTIFACT_SOURCE_RECOVERY_BINDING');seen.add(version.versionId);}
  const life=storageLifetime({now,maxRequestMs},signal);
  try{
   await life.run(()=>tx(async c=>{
    // Same artifact key as the canonical version publication owner, under the existing global recovery exclusion.
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${tenantId}:${artifactId}`]);
    for(const record of records){const version=record.version,b=version.binding;await c.query('INSERT INTO meri_artifacts.versions(version_id,artifact_id,tenant_id,actor_id,conversation_id,request_sha256,record,record_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING',
     [version.versionId,artifactId,tenantId,b.actorId,b.conversationId,record.requestSha256,record,v.hash(record)]);
    const rows=(await c.query('SELECT * FROM meri_artifacts.versions WHERE version_id=$1',[version.versionId])).rows;
    if(rows.length!==1||!same(verifyArtifactVersionStorageRow(rows[0]),record))fail('ARTIFACT_IMMUTABLE_CONFLICT');}
   },{exclusive:true,readCommitted:true}));
   // A restored immutable row is not proof of a current published head. Keep the canonical full lineage test.
   const receipts=[];for(const record of records){const version=record.version;let published;try{published=await life.run(signal=>read(version.versionId,signal));}catch(cause){throw Object.assign(Error('ARTIFACT_SOURCE_HEAD_UNAVAILABLE'),{code:'ARTIFACT_SOURCE_HEAD_UNAVAILABLE',cause});}
    if(!same(published,record))fail('ARTIFACT_IMMUTABLE_CONFLICT');receipts.push({versionId:version.versionId,versionSha256:v.hash(version),published:true});}life.check();return data(receipts);
  }finally{life.close();}
 }
 return Object.freeze({recoverAll,async recover(value,signal){return (await recoverAll([value],signal))[0];}});
}
