/** Reserved artifacts0003 projection. The canonical retention journal owns transactions/recovery exclusion and the artifact version
 * store owns source decoding. Without a custodyJournal this remains a read-only metadata owner that cannot enable publication.
 * The optional effectful extension requires the accepted purpose-isolated conditional evidence/current-complete-facts owner. */
import {v,own,data,uuid,storageMethod,storageLifetime,configuration,fail} from '../storage/boundary.mjs';
import {verifyPreviewClaim} from './claim.mjs';import {verifyPreviewRecord} from './record.mjs';
import {createCustodiedPostgresPreviewStore} from './postgres-custody.mjs';
const corrupt=()=>fail('ARTIFACT_PREVIEW_STORE_CORRUPT');
const same=(a,b)=>v.hash(a)===v.hash(b);
const MAX_RESPONSE_BYTES=8*1024*1024;
export function createPostgresPreviewStore(options){
 const {journal,versions,tenantId,artifactId,now,maxRequestMs=15000,maxRows=128,custodyJournal=null}=own(options,['journal','versions','tenantId','artifactId','now'],['maxRequestMs','maxRows','custodyJournal']);
 configuration(now,maxRequestMs);uuid(artifactId);
 if(typeof tenantId!=='string'||!tenantId||!Number.isSafeInteger(maxRows)||maxRows<1||maxRows>256)fail('ARTIFACT_STORAGE_CONFIGURATION');
 const transaction=storageMethod(journal,'tx'),readVersion=storageMethod(versions,'read');
 async function decode(row,signal){
  if(row.tenant_id!==tenantId||row.artifact_id!==artifactId)corrupt();uuid(row.version_id);
  const stored=data(await readVersion(row.version_id,signal)),version=v.version(stored.version),claim=verifyPreviewClaim(v,row.claim,version);
  if(version.binding.tenantId!==tenantId||version.artifactId!==artifactId||row.version_id!==claim.versionId||row.conversation_id!==claim.conversationId||row.preview_id!==claim.previewId||
   row.object_id!==claim.objectId||row.source_version_sha256!==claim.sourceVersionSha256||row.source_sha256!==claim.sourceSha256||row.claim_sha256!==v.hash(claim))corrupt();
  let object=null,record=null;
  if(row.object_reference===null){if(row.object_reference_sha256!==null||row.object_version_id!==null)corrupt();}
  else{object=v.object(row.object_reference);if(object.objectId!==claim.objectId||object.versionId!==row.object_version_id||v.hash(object)!==row.object_reference_sha256||!same(object.scopes,claim.scopes))corrupt();}
  if(row.record===null){if(row.record_sha256!==null)corrupt();}
  else{record=verifyPreviewRecord(v,row.record,version);if(!object||record.previewId!==claim.previewId||record.source.sha256!==claim.sourceSha256||v.hash(record)!==row.record_sha256||!same(record.preview.object,object))corrupt();}
  return {claim,object,record,state:record?'COMMITTED':'UNKNOWN'};
 }
 async function rows(versionId,signal,{exclusive=false}={}){
  if(versionId!==null)uuid(versionId);const life=storageLifetime({now,maxRequestMs},signal);
  try{
   const raw=await life.run(()=>transaction(async c=>{
    const where=versionId===null?'':' AND a.version_id=$3',args=versionId===null?[tenantId,artifactId,maxRows+1]:[tenantId,artifactId,versionId,2],limit=versionId===null?'$3':'$4';
    const result=await c.query(`SELECT a.*,p.record,p.record_sha256 FROM meri_artifacts.preview_attempts a LEFT JOIN meri_artifacts.previews p ON p.tenant_id=a.tenant_id AND p.version_id=a.version_id WHERE a.tenant_id=$1 AND a.artifact_id=$2${where} ORDER BY a.version_id LIMIT ${limit}`,args);
    return result.rows;
   },{readCommitted:true,exclusive}));
   if(!Array.isArray(raw)||raw.length>(versionId===null?maxRows:1))fail('ARTIFACT_PREVIEW_INVENTORY_UNAVAILABLE');
   const out=[],seen=new Set();let bytes=0;
   for(const value of raw){const row=data(value);if(seen.has(row.version_id)||versionId!==null&&row.version_id!==versionId)corrupt();seen.add(row.version_id);
    bytes+=Buffer.byteLength(JSON.stringify(row));if(bytes>MAX_RESPONSE_BYTES)fail('ARTIFACT_PREVIEW_INVENTORY_UNAVAILABLE');
    out.push(await life.run(signal=>decode(row,signal)));}
   life.check();return data(out);
  }catch(cause){if(cause?.code?.startsWith('ARTIFACT_'))throw cause;
   throw Object.assign(new Error('ARTIFACT_PREVIEW_STORE_UNAVAILABLE'),{code:'ARTIFACT_PREVIEW_STORE_UNAVAILABLE',cause});
  }finally{life.close();}
 }
 if(custodyJournal!==null)return createCustodiedPostgresPreviewStore({journal,versions,custodyJournal,tenantId,artifactId,now,maxRequestMs,projection:(signal,exclusive=false)=>rows(null,signal,{exclusive})});
 return Object.freeze({
  /** Metadata only; user release still belongs to current canonical artifact authorization in the preview service. */
  async read(versionId,signal){return (await rows(versionId,signal))[0]?.record??null;},
  /** Restorable artifact-scoped metadata, not an outside-rollback completeness or purge proof. Canonical custody replay is
   * still required. Overflow refuses the whole result rather than releasing a truncated inventory. */
  custody:signal=>rows(null,signal),
 });
}
