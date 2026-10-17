/** PostgreSQL settings store over the PROPOSED `meri_settings` tables
 * (docs/coordination/proposals/memory-settings-20261016/proposed-memory-settings.sql; no ID allocated, never applied by this source).
 * Each save is one transaction: a compare-and-set on the document revision plus its audit row. A revision conflict writes nothing. */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {refuse} from '../product-access/errors.mjs';
import {assertPool,transact} from '../product-persistence/transaction.mjs';
import {changedFields} from './save-metadata.mjs';
const T=Object.freeze({user:'meri_settings.user_preferences',tenant:'meri_settings.tenant_settings',audit:'meri_settings.settings_audit'});
function document(row){
 if(!row)return null;
 if(!Number.isSafeInteger(Number(row.revision))||Number(row.revision)<1||canonicalSha256(row.document)!==row.document_sha256)refuse('SETTINGS_STORE_STATE');
 return Object.freeze({revision:Number(row.revision),document:row.document,documentSha256:row.document_sha256});
}
const where=(kind,tenantId,actorId)=>kind==='user'?{sql:'tenant_id=$1 AND actor_id=$2',params:[tenantId,actorId]}:{sql:'tenant_id=$1',params:[tenantId]};
export function createPostgresSettingsStore({pool}){
 assertPool(pool);
 const tx=(signal,operation,readOnly=false)=>transact(pool,operation,{readOnly,check:()=>{if(signal?.aborted)refuse('CANCELLED');},unavailable:'SETTINGS_STORE_UNAVAILABLE',uncertain:'SETTINGS_COMMIT_UNKNOWN'});
 return Object.freeze({
  read({kind,tenantId,actorId,signal}){
   const w=where(kind,tenantId,actorId);
   return tx(signal,async client=>document((await client.query(`SELECT revision,document,document_sha256 FROM ${T[kind]} WHERE ${w.sql}`,w.params)).rows[0]),true);
  },
  /** expectedRevision 0 creates the first revision; otherwise the stored revision must equal it. */
  save({kind,tenantId,actorId,expectedRevision,document:value,initialDocument=null,audit,signal}){
   const w=where(kind,tenantId,actorId),sha=canonicalSha256(value),next=expectedRevision+1;
   return tx(signal,async client=>{
    const check=()=>{if(signal?.aborted)refuse('CANCELLED');};
    let before=null,written;
    if(expectedRevision===0){
     // An absent SELECT row cannot be locked. The primary-key conflict result owns the initial CAS, including concurrent creators.
     if(kind==='user')written=await client.query(`INSERT INTO ${T.user}(tenant_id,actor_id,revision,document,document_sha256,updated_at,updated_by) VALUES($1,$2,$3,$4::jsonb,$5,clock_timestamp(),$6) ON CONFLICT (tenant_id,actor_id) DO NOTHING RETURNING revision,document,document_sha256`,[tenantId,actorId,next,JSON.stringify(value),sha,audit.actorId]);
     else written=await client.query(`INSERT INTO ${T.tenant}(tenant_id,revision,document,document_sha256,updated_at,updated_by) VALUES($1,$2,$3::jsonb,$4,clock_timestamp(),$5) ON CONFLICT (tenant_id) DO NOTHING RETURNING revision,document,document_sha256`,[tenantId,next,JSON.stringify(value),sha,audit.actorId]);
    }else{
     before=document((await client.query(`SELECT revision,document,document_sha256 FROM ${T[kind]} WHERE ${w.sql} FOR UPDATE`,w.params)).rows[0]);check();
     if(before?.revision!==expectedRevision)refuse('SETTINGS_REVISION_CONFLICT');
     written=await client.query(`UPDATE ${T[kind]} SET revision=$${w.params.length+1}, document=$${w.params.length+2}::jsonb, document_sha256=$${w.params.length+3}, updated_at=clock_timestamp(), updated_by=$${w.params.length+4} WHERE ${w.sql} AND revision=$${w.params.length+5} RETURNING revision,document,document_sha256`,[...w.params,next,JSON.stringify(value),sha,audit.actorId,expectedRevision]);
    }
    check();
    if(written.rows.length===0)refuse('SETTINGS_REVISION_CONFLICT');
    if(written.rows.length!==1)refuse('SETTINGS_STORE_STATE');
    const after=document(written.rows[0]);
    if(!after||after.revision!==next||after.documentSha256!==sha)refuse('SETTINGS_STORE_STATE');
    await client.query(`INSERT INTO ${T.audit}(audit_id,tenant_id,target,subject_actor_id,actor_id,from_revision,to_revision,before_sha256,after_sha256,platform_sha256,changed_fields,recorded_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::text[],clock_timestamp())`,[audit.auditId,tenantId,kind,kind==='user'?actorId:null,audit.actorId,expectedRevision,next,before?.documentSha256??null,sha,audit.platformSha256,changedFields(before?.document??initialDocument,value)]);
    return Object.freeze({revision:next,documentSha256:sha});
   });
  },
  /** Newest first by the audit sequence; `beforeSequence` is the last sequence already seen (exclusive). */
  listAudit({tenantId,beforeSequence,limit,signal}){
   return tx(signal,async client=>(await client.query(`SELECT sequence,audit_id,target,subject_actor_id,actor_id,from_revision,to_revision,before_sha256,after_sha256,platform_sha256,changed_fields,recorded_at
     FROM ${T.audit} WHERE tenant_id=$1 AND ($2::bigint IS NULL OR sequence < $2::bigint) ORDER BY sequence DESC LIMIT $3`,[tenantId,beforeSequence,limit])).rows.map(r=>Object.freeze({
     sequence:Number(r.sequence),auditId:r.audit_id,target:r.target,subjectActorId:r.subject_actor_id,actorId:r.actor_id,fromRevision:Number(r.from_revision),toRevision:Number(r.to_revision),
     beforeSha256:r.before_sha256,afterSha256:r.after_sha256,platformSha256:r.platform_sha256,changedFields:Object.freeze([...r.changed_fields]),recordedAt:new Date(r.recorded_at).toISOString()})),true);
  },
 });
}
