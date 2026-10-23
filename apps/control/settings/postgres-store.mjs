/** PostgreSQL settings store over the reserved `meri_settings` migration
 * (apps/control/settings/migrations/0001_settings.sql; adopted from its allocated owner, never applied by this source).
 * Each save is one transaction: a compare-and-set on the document revision plus its audit row. A revision conflict writes nothing. */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {refuse} from '../product-access/errors.mjs';
import {assertPool,transact} from '../product-persistence/transaction.mjs';
import {changedFields} from './save-metadata.mjs';
import {storedModelSettings,modelSettings,DEFAULT_MODEL_LIMITS} from './documents.mjs';
const T=Object.freeze({user:'meri_settings.user_preferences',tenant:'meri_settings.tenant_settings',audit:'meri_settings.settings_audit'});
function document(row,kind){
 if(!row)return null;
 if(!Number.isSafeInteger(Number(row.revision))||Number(row.revision)<1||canonicalSha256(row.document)!==row.document_sha256)refuse('SETTINGS_STORE_STATE');
 // documentSha256 is always the persisted BASE-document integrity SHA. Audit hashes below
 // cover the composed view including the typed policy columns; callers must not compare the two.
 return Object.freeze({revision:Number(row.revision),document:row.document,documentSha256:row.document_sha256,...(kind==='tenant'?{model:storedModelSettings(row)}:{})});
}
const auditDocument=record=>({...record.document,...(record.model?{model:record.model}:{})});
const where=(kind,tenantId,actorId)=>kind==='user'?{sql:'tenant_id=$1 AND actor_id=$2',params:[tenantId,actorId]}:{sql:'tenant_id=$1',params:[tenantId]};
export function createPostgresSettingsStore({pool}){
 assertPool(pool);
 const tx=(signal,operation,readOnly=false)=>transact(pool,operation,{readOnly,check:()=>{if(signal?.aborted)refuse('CANCELLED');},unavailable:'SETTINGS_STORE_UNAVAILABLE',uncertain:'SETTINGS_COMMIT_UNKNOWN'});
 return Object.freeze({
  read({kind,tenantId,actorId,signal}){
   const w=where(kind,tenantId,actorId);
   return tx(signal,async client=>document((await client.query(`SELECT * FROM ${T[kind]} WHERE ${w.sql}`,w.params)).rows[0],kind),true);
  },
  /** expectedRevision 0 creates the first revision; otherwise the stored revision must equal it. */
  save({kind,tenantId,actorId,expectedRevision,document:value,initialDocument=null,audit,signal}){
   const w=where(kind,tenantId,actorId),{model:proposedModel,...base}=kind==='tenant'?value:{model:undefined,...value},sha=canonicalSha256(base),next=expectedRevision+1;
   if(proposedModel!==undefined)modelSettings(proposedModel);
   return tx(signal,async client=>{
    const check=()=>{if(signal?.aborted)refuse('CANCELLED');};
    let before=null,written,model=proposedModel??{monthlyCapMicroUsd:null,...DEFAULT_MODEL_LIMITS};
    if(expectedRevision===0){
     // An absent SELECT row cannot be locked. The primary-key conflict result owns the initial CAS, including concurrent creators.
     if(kind==='user')written=await client.query(`INSERT INTO ${T.user}(tenant_id,actor_id,revision,document,document_sha256,updated_at,updated_by) VALUES($1,$2,$3,$4::jsonb,$5,clock_timestamp(),$6) ON CONFLICT (tenant_id,actor_id) DO NOTHING RETURNING *`,[tenantId,actorId,next,JSON.stringify(base),sha,audit.actorId]);
     else written=await client.query(`INSERT INTO ${T.tenant}(tenant_id,revision,document,document_sha256,updated_at,updated_by,monthly_cap_micro_usd,sdk_max_turns,sdk_max_budget_micro_usd) VALUES($1,$2,$3::jsonb,$4,clock_timestamp(),$5,$6,$7,$8) ON CONFLICT (tenant_id) DO NOTHING RETURNING *`,[tenantId,next,JSON.stringify(base),sha,audit.actorId,model.monthlyCapMicroUsd,model.maxTurns,model.maxBudgetMicroUsd]);
    }else{
     before=document((await client.query(`SELECT * FROM ${T[kind]} WHERE ${w.sql} FOR UPDATE`,w.params)).rows[0],kind);check();
     if(before?.revision!==expectedRevision)refuse('SETTINGS_REVISION_CONFLICT');
     if(kind==='tenant')model=proposedModel??before.model;
     const policy=kind==='tenant'?`, monthly_cap_micro_usd=$${w.params.length+6}, sdk_max_turns=$${w.params.length+7}, sdk_max_budget_micro_usd=$${w.params.length+8}`:'';
     written=await client.query(`UPDATE ${T[kind]} SET revision=$${w.params.length+1}, document=$${w.params.length+2}::jsonb, document_sha256=$${w.params.length+3}, updated_at=clock_timestamp(), updated_by=$${w.params.length+4}${policy} WHERE ${w.sql} AND revision=$${w.params.length+5} RETURNING *`,[...w.params,next,JSON.stringify(base),sha,audit.actorId,expectedRevision,...(kind==='tenant'?[model.monthlyCapMicroUsd,model.maxTurns,model.maxBudgetMicroUsd]:[])]);
    }
    check();
    if(written.rows.length===0)refuse('SETTINGS_REVISION_CONFLICT');
    if(written.rows.length!==1)refuse('SETTINGS_STORE_STATE');
    const after=document(written.rows[0],kind);
    if(!after||after.revision!==next||after.documentSha256!==sha||kind==='tenant'&&canonicalSha256(after.model)!==canonicalSha256(model))refuse('SETTINGS_STORE_STATE');
    await client.query(`INSERT INTO ${T.audit}(audit_id,tenant_id,target,subject_actor_id,actor_id,from_revision,to_revision,before_sha256,after_sha256,platform_sha256,changed_fields,recorded_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::text[],clock_timestamp())`,[audit.auditId,tenantId,kind,kind==='user'?actorId:null,audit.actorId,expectedRevision,next,before?canonicalSha256(auditDocument(before)):null,canonicalSha256(auditDocument(after)),audit.platformSha256,changedFields(before?auditDocument(before):initialDocument,auditDocument(after))]);
    return Object.freeze({revision:next,documentSha256:sha,...(kind==='tenant'?{model:after.model}:{})});
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
