/** Bounded SQL projection of the paged publication owner. SQL rows never establish publication.
 * Recovery repairs only nominated canonical versions/head; every released row is independently compared again. */
import {v,own,data,same,uuid,storageMethod,fail} from './boundary.mjs';
import {isPagedArtifactPublication,verifyArtifactPublicationRoot} from './artifact-publication-paged-journal.mjs';
import {verifyArtifactVersionStorageRow as decode,verifyArtifactVersionStorageHead} from './version-record.mjs';
import {insertArtifactRecord,projectArtifactHead} from './postgres-publication-projection.mjs';
const missing=()=>{throw Object.assign(Error('ENOENT'),{code:'ENOENT'});};
export function createPostgresPagedPublication({owner,allowed}){
 async function snapshot(life,tenant){const value=data(await life.run(signal=>storageMethod(owner(tenant),'snapshot')(signal)));own(value,['index','positionSha256']);const root=verifyArtifactPublicationRoot(value.index,tenant);if(v.hash(root)!==value.positionSha256)fail('ARTIFACT_PUBLICATION_CORRUPT');return value;}
 async function mode(life,tenant){return isPagedArtifactPublication((await snapshot(life,tenant)).index);}
 async function stable(life,tenant,position){if((await snapshot(life,tenant)).positionSha256!==position)fail('ARTIFACT_PUBLICATION_STALE');}
 async function row(c,life,id){const rows=(await life.run(()=>c.query('SELECT * FROM meri_artifacts.versions WHERE version_id=$1',[uuid(id)]))).rows;if(rows.length>1)fail('ARTIFACT_VERSION_CORRUPT');return rows.length?decode(rows[0]):null;}
 async function head(c,life,artifactId){const rows=(await life.run(()=>c.query('SELECT * FROM meri_artifacts.heads WHERE artifact_id=$1 FOR SHARE',[uuid(artifactId)]))).rows;if(rows.length>1)fail('ARTIFACT_VERSION_CORRUPT');return rows[0]??null;}
 async function point(life,tenant,id){const proof=data(await life.run(signal=>storageMethod(owner(tenant),'readVersion')(uuid(id),signal)));own(proof,['positionSha256','result']);if(proof.result===null)missing();const r=proof.result.decision?.record;if(r?.version.versionId!==id||r.version.binding.tenantId!==tenant||proof.result.head?.artifactId!==r.version.artifactId||proof.result.headDecision?.record.version.versionId!==proof.result.head.versionId)fail('ARTIFACT_PUBLICATION_CORRUPT');if(proof.result.head.tombstone!==null)fail('ARTIFACT_PUBLICATION_TERMINAL');return proof;}
 async function headAgreement(c,life,tenant,proof,repair){const current=await head(c,life,proof.head.artifactId),expected=proof.headDecision.record;
  if(current){let record=expected;if(current.version_id!==expected.version.versionId){const old=await point(life,tenant,current.version_id);record=old.result.decision.record;if(record.version.artifactId!==expected.version.artifactId)fail('ARTIFACT_PUBLICATION_UNVERIFIED');}
   verifyArtifactVersionStorageHead(current,record);const stored=await row(c,life,current.version_id);if(stored&&!same(stored,record))fail('ARTIFACT_IMMUTABLE_CONFLICT');if(!repair&&(!stored||current.version_id!==expected.version.versionId))fail('ARTIFACT_PUBLICATION_PROJECTION_STALE');
  }else if(!repair)fail('ARTIFACT_PUBLICATION_PROJECTION_STALE');return current;
 }
 async function ensure(c,life,tenant,id,{repair=false,exclusive=false}={}){const proof=await point(life,tenant,id),record=proof.result.decision.record,latest=proof.result.headDecision.record;
  await allowed(record,life,exclusive,c);await allowed(latest,life,exclusive,c);if(repair)await life.run(()=>c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${tenant}:${record.version.artifactId}`]));
  const stored=await row(c,life,id);if(stored&&!same(stored,record))fail('ARTIFACT_IMMUTABLE_CONFLICT');if(!stored&&!repair)fail('ARTIFACT_PUBLICATION_PROJECTION_STALE');const old=await headAgreement(c,life,tenant,proof.result,repair);
  if(repair){await insertArtifactRecord(c,record,life);if(latest.version.versionId!==id)await insertArtifactRecord(c,latest,life);await projectArtifactHead(c,latest,old,life);await headAgreement(c,life,tenant,proof.result,false);}
  await stable(life,tenant,proof.positionSha256);await allowed(record,life,exclusive,c);return {record,proof};
 }
 async function read(c,life,value,raw,exclusive){const id=typeof value==='string'?value:value.versionId,{record}=await ensure(c,life,raw.version.binding.tenantId,id,{exclusive});
  if(typeof value!=='string'){const q=own(value,['kind','versionId','requestSha256','resultSha256']);if(q.kind!=='artifact-replay'||q.requestSha256!==record.requestSha256||q.resultSha256!==null&&q.resultSha256!==v.hash({...record,expectedParentVersionId:record.version.parentVersionId}))fail('ARTIFACT_REPLAY_UNRESOLVED');}return record;
 }
 async function commit(c,life,record,expectedParentVersionId,authority){const version=record.version,tenant=version.binding.tenantId,p=owner(tenant);await allowed(record,life);await life.run(()=>c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${tenant}:${version.artifactId}`]));
  const before=data(await life.run(signal=>storageMethod(p,'readHead')(version.artifactId,signal))),oldRecord=await row(c,life,version.versionId);if(oldRecord&&!same(oldRecord,record))fail('ARTIFACT_IMMUTABLE_CONFLICT');let oldHead;
  if(before.result){if(before.result.head.tombstone!==null)fail('ARTIFACT_PUBLICATION_TERMINAL');oldHead=await headAgreement(c,life,tenant,before.result,false);if(!oldRecord&&oldHead.version_id!==expectedParentVersionId)fail('ARTIFACT_STALE_PARENT');}
  else{oldHead=await head(c,life,version.artifactId);if(oldHead||oldRecord)fail('ARTIFACT_PUBLICATION_UNVERIFIED');if(expectedParentVersionId!==null)fail('ARTIFACT_STALE_PARENT');}
  const ack=data(await life.run(signal=>storageMethod(p,'publish')({record,expectedParentVersionId,...authority},before.positionSha256,signal)));own(ack,['created','decision']);if(typeof ack.created!=='boolean'||!same(ack.decision.record,record)||!same(ack.decision.invocation,authority.invocation))fail('ARTIFACT_PUBLICATION_ACK_UNKNOWN');
  await allowed(record,life);if(!oldRecord){await insertArtifactRecord(c,record,life);await projectArtifactHead(c,record,oldHead,life);}await ensure(c,life,tenant,version.versionId);return {status:oldRecord?'duplicate':'committed',versionId:version.versionId,requestSha256:record.requestSha256,versionSha256:v.hash(version)};
 }
 return Object.freeze({snapshot,mode,stable,point,ensure,read,commit,row});
}
