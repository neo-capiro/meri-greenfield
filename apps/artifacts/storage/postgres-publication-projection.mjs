/** Existing0001 immutable rows/head projection of a complete authoritative publication partition. No independent coordinator. */
import {v,same,uuid,fail} from './boundary.mjs';
import {verifyArtifactVersionStorageRow as decode,verifyArtifactVersionStorageHead,artifactHeadProjection} from './version-record.mjs';
export async function readArtifactProjection(c,tenantId,artifactId,life,{knownRecords=[]}={}){uuid(artifactId);
 const rows=(await life.run(()=>c.query("SELECT COALESCE((SELECT jsonb_agg(v ORDER BY version_id) FROM (SELECT * FROM meri_artifacts.versions WHERE tenant_id=$1 AND artifact_id=$2 ORDER BY version_id LIMIT 1025) v),'[]'::jsonb) AS versions, COALESCE((SELECT jsonb_agg(h ORDER BY artifact_id) FROM (SELECT * FROM meri_artifacts.heads WHERE artifact_id=$2 LIMIT 2) h),'[]'::jsonb) AS heads",[tenantId,artifactId]))).rows;life.check();
 if(rows.length!==1||!Array.isArray(rows[0].versions)||!Array.isArray(rows[0].heads)||rows[0].versions.length>1024||rows[0].heads.length>1||Buffer.byteLength(JSON.stringify(rows[0]))>16777216)fail('ARTIFACT_VERSION_CORRUPT');
 const records=rows[0].versions.map(decode),head=rows[0].heads[0]??null;if(new Set(records.map(r=>r.version.versionId)).size!==records.length)fail('ARTIFACT_VERSION_CORRUPT');
 if(records.some(r=>r.version.artifactId!==artifactId||r.version.binding.tenantId!==tenantId))fail('ARTIFACT_VERSION_CORRUPT');
 if(head){const r=[...records,...knownRecords].find(r=>r.version.versionId===head.version_id);if(!r||head.artifact_id!==artifactId||head.tenant_id!==tenantId)fail('ARTIFACT_VERSION_CORRUPT');verifyArtifactVersionStorageHead(head,r);}
 return {records,head};
}
export function assertArtifactProjection(sql,index,artifactId,{allowMissing=false}={}){
 if(index.tombstones.some(t=>t.artifactId===artifactId))fail('ARTIFACT_PUBLICATION_TERMINAL');
 const decisions=index.decisions.filter(d=>d.record.version.artifactId===artifactId),head=index.heads.find(h=>h.artifactId===artifactId),byId=new Map(decisions.map(d=>[d.record.version.versionId,d]));
 for(const record of sql.records){const d=byId.get(record.version.versionId);if(!d||!same(d.record,record))fail('ARTIFACT_IMMUTABLE_CONFLICT');}
 if(sql.head&&!byId.has(sql.head.version_id))fail('ARTIFACT_PUBLICATION_UNVERIFIED');
 if(!allowMissing&&(sql.records.length!==decisions.length||(sql.head?.version_id??null)!==(head?.versionId??null)))fail('ARTIFACT_PUBLICATION_PROJECTION_STALE');
 return {decisions,head:head??null};
}
export async function insertArtifactRecord(c,record,life){const version=record.version,b=version.binding;
 await life.run(()=>c.query('INSERT INTO meri_artifacts.versions(version_id,artifact_id,tenant_id,actor_id,conversation_id,request_sha256,record,record_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING',[version.versionId,version.artifactId,b.tenantId,b.actorId,b.conversationId,record.requestSha256,record,v.hash(record)]));
 const rows=(await life.run(()=>c.query('SELECT * FROM meri_artifacts.versions WHERE version_id=$1',[version.versionId]))).rows;if(rows.length!==1||!same(decode(rows[0]),record))fail('ARTIFACT_IMMUTABLE_CONFLICT');
}
export async function projectArtifactHead(c,record,current,life){const version=record.version,b=version.binding,projection=artifactHeadProjection(record);if(current?.version_id===version.versionId)return;
 if(current){const result=await life.run(()=>c.query('UPDATE meri_artifacts.heads SET version_id=$2,projection=$3,projection_sha256=$4 WHERE artifact_id=$1 AND version_id=$5',[version.artifactId,version.versionId,projection,v.hash(projection),current.version_id]));if(result.rowCount!==1)fail('ARTIFACT_STALE_PARENT');}
 else await life.run(()=>c.query('INSERT INTO meri_artifacts.heads(artifact_id,version_id,tenant_id,actor_id,conversation_id,projection,projection_sha256) VALUES($1,$2,$3,$4,$5,$6,$7)',[version.artifactId,version.versionId,b.tenantId,b.actorId,b.conversationId,projection,v.hash(projection)]));life.check();
}
