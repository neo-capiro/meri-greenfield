/** Preview prerequisite adapter to the CANONICAL publication recovery owner. Caller already holds journal.exclusive.
 * A historical claim is compared with the recovered decision; it can never nominate a source row or current head. */
import {v,own,data,uuid,configuration,storageMethod,storageLifetime,fail} from './boundary.mjs';
import {verifyArtifactVersionStorageRecord} from './version-record.mjs';
export function createPostgresArtifactSourceRecovery(options){
 const {journal,versions,tenantId,artifactId,now,maxRequestMs=15000}=own(options,['journal','versions','tenantId','artifactId','now'],['maxRequestMs']);configuration(now,maxRequestMs);uuid(artifactId);storageMethod(journal,'exclusive');
 if(typeof tenantId!=='string'||!tenantId)fail('ARTIFACT_STORAGE_CONFIGURATION');const recover=storageMethod(versions,'recoverExclusive');
 async function recoverAll(values,signal){const batch=data(values);if(!Array.isArray(batch)||batch.length>128||Buffer.byteLength(JSON.stringify(batch))>8388608)fail('ARTIFACT_SOURCE_RECOVERY_LIMIT');
  const records=batch.map(verifyArtifactVersionStorageRecord),seen=new Set();for(const record of records){const version=record.version;if(version.binding.tenantId!==tenantId||version.artifactId!==artifactId||seen.has(version.versionId))fail('ARTIFACT_SOURCE_RECOVERY_BINDING');seen.add(version.versionId);}
  const life=storageLifetime({now,maxRequestMs},signal);try{const result=await life.run(signal=>recover(signal)),receipts=[];
   for(const record of records){const known=result.versions.find(r=>r.versionId===record.version.versionId);if(!known||known.recordSha256!==v.hash(record)||known.versionSha256!==v.hash(record.version))fail('ARTIFACT_SOURCE_HEAD_UNAVAILABLE');receipts.push({versionId:known.versionId,versionSha256:known.versionSha256,published:true});}life.check();return data(receipts);
  }finally{life.close();}
 }
 return Object.freeze({recoverAll,async recover(value,signal){return (await recoverAll([value],signal))[0];}});
}
