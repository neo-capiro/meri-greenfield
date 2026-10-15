/** PostgreSQL adapter for the retention journal port (migrations meri_conversations 0010 and meri_artifacts 0002): the restorable
 * projection of the authoritative ledger. One subject row per tenant and conversation or artifact; one purge row per planned or
 * executed step, which is what the immutability trigger amendments consult. Borrowed pg-compatible pool; no connection on import. */
import {fail,hash,subject as parseSubject,subjectKey} from './boundary.mjs';
const tables={conversation:{schema:'meri_conversations',id:'conversation_id',purgeColumns:'class,object_id,version_id,sha256'},artifact:{schema:'meri_artifacts',id:'artifact_id',purgeColumns:'version_id,object_id,object_version_id,sha256'}};
function parseKey(key){if(typeof key!=='string')fail('RETENTION_INVALID_REQUEST');const parts=key.split(':');if(parts.length<3)fail('RETENTION_INVALID_REQUEST');const kind=parts.at(-2),subjectId=parts.at(-1),tenantId=parts.slice(0,-2).join(':');if(!tables[kind])fail('RETENTION_INVALID_REQUEST');return {tenantId,kind,subjectId};}
export function createPostgresRetentionJournal({pool}){
 if(typeof pool?.connect!=='function')fail('RETENTION_CONFIGURATION');
 async function tx(body){let c,begun=false;try{c=await pool.connect();await c.query('BEGIN');begun=true;await c.query("SET LOCAL statement_timeout = '5s'");await c.query("SET LOCAL lock_timeout = '2s'");const r=await body(c);await c.query('COMMIT');return r;}
  catch(e){if(begun)try{await c.query('ROLLBACK');}catch{}throw Object.assign(new Error(e?.code&&String(e.code).startsWith('RETENTION_')?e.code:'RETENTION_STORE_UNAVAILABLE'),{code:e?.code&&String(e.code).startsWith('RETENTION_')?e.code:'RETENTION_STORE_UNAVAILABLE',cause:e});}
  finally{if(c)c.release();}}
 const rowValue=r=>{if(hash(r.projection)!==r.projection_sha256)fail('RETENTION_STORE_CORRUPT');return r.projection;};
 async function get(key){const k=parseKey(key),t=tables[k.kind];return tx(async c=>{const rows=(await c.query(`SELECT * FROM ${t.schema}.retention_subjects WHERE tenant_id=$1 AND ${t.id}=$2`,[k.tenantId,k.subjectId])).rows;if(!rows.length)return null;const v=rowValue(rows[0]);if(v.state!==rows[0].state||Number(rows[0].ledger_sequence)!==v.ledgerSequence)fail('RETENTION_STORE_CORRUPT');return v;});}
 /** Replaces the subject projection and its purge rows atomically under the subject row lock. The caller (suppression owner,
  * executor, reconciler) has already appended the transition to the ledger. */
 async function set(key,value,{expected}={}){
  const k=parseKey(key),t=tables[k.kind];if(!value||typeof value!=='object'||!['SUPPRESSED','RELEASED'].includes(value.state)||!Number.isSafeInteger(value.ledgerSequence)||typeof value.entrySha256!=='string')fail('RETENTION_INVALID_REQUEST');
  const owner=value.authorization?.principal?.actorId??value.ownerActorId??null;const projection=structuredClone(value);
  return tx(async c=>{
   const existing=(await c.query(`SELECT owner_actor_id,projection_sha256 FROM ${t.schema}.retention_subjects WHERE tenant_id=$1 AND ${t.id}=$2 FOR UPDATE`,[k.tenantId,k.subjectId])).rows[0];
   // Compare-and-set on the projection the caller read (null: the row must not exist); a stale decision never overwrites a newer one.
   if(expected!==undefined&&(existing?.projection_sha256??null)!==expected)fail('RETENTION_STALE_WRITE');
   const ownerActorId=existing?.owner_actor_id??owner;if(typeof ownerActorId!=='string'||!ownerActorId)fail('RETENTION_INVALID_REQUEST');
   const suppressedAt=value.state==='SUPPRESSED'?new Date(value.suppressedAtMs).toISOString():null,releasedAt=value.state==='RELEASED'&&Number.isSafeInteger(value.releasedAtMs)?new Date(value.releasedAtMs).toISOString():null;
   await c.query(`INSERT INTO ${t.schema}.retention_subjects(tenant_id,${t.id},owner_actor_id,state,suppressed_at,released_at,ledger_sequence,entry_sha256,projection,projection_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (tenant_id,${t.id}) DO UPDATE SET state=EXCLUDED.state,suppressed_at=EXCLUDED.suppressed_at,released_at=EXCLUDED.released_at,ledger_sequence=EXCLUDED.ledger_sequence,entry_sha256=EXCLUDED.entry_sha256,projection=EXCLUDED.projection,projection_sha256=EXCLUDED.projection_sha256`,
    [k.tenantId,k.subjectId,ownerActorId,value.state,suppressedAt,releasedAt,value.ledgerSequence,value.entrySha256,projection,hash(projection)]);
   await c.query(`DELETE FROM ${t.schema}.retention_purges WHERE tenant_id=$1 AND ${t.id}=$2`,[k.tenantId,k.subjectId]);
   const purge=value.purge;if(!purge)return projection;
   for(const st of purge.steps??[]){const stepState=st.state==='EXECUTED'?'EXECUTED':st.state==='UNKNOWN'?'UNKNOWN':purge.state==='BLOCKED'?'BLOCKED':'PLANNED';const receipt=st.requested||st.readback?{requested:st.requested??null,readback:st.readback??null}:null;
    const columns=k.kind==='conversation'?[(st.classes??[st.className]).join(','),st.objectId,st.versionId,st.sha256]:[st.artifactVersionId??st.objectId,st.objectId,st.versionId,st.sha256];
    await c.query(`INSERT INTO ${t.schema}.retention_purges(workflow_id,tenant_id,${t.id},${t.purgeColumns},plan_sha256,state,receipt,receipt_sha256,ledger_sequence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
     [st.workflowId,k.tenantId,k.subjectId,...columns,purge.planSha256,stepState,receipt,receipt?hash(receipt):null,purge.ledgerSequence]);}
   return projection;});
 }
 async function keys(){const out=[];for(const [kind,t] of Object.entries(tables)){const rows=(await pool.query(`SELECT tenant_id,${t.id} AS subject_id FROM ${t.schema}.retention_subjects`)).rows;for(const r of rows)out.push(subjectKey({tenantId:r.tenant_id,kind,subjectId:r.subject_id}));}return out;}
 /** Records the planned purge rows that the immutability trigger amendments consult, inside the caller's transaction. */
 async function planRows(c,key,plan){const k=parseKey(key),t=tables[k.kind];for(const st of plan.steps){const columns=k.kind==='conversation'?[(st.classes??[st.className]).join(','),st.objectId,st.versionId,st.sha256]:[st.artifactVersionId??st.objectId,st.objectId,st.versionId,st.sha256];
  await c.query(`INSERT INTO ${t.schema}.retention_purges(workflow_id,tenant_id,${t.id},${t.purgeColumns},plan_sha256,state,receipt,receipt_sha256,ledger_sequence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'PLANNED',NULL,NULL,$9) ON CONFLICT (workflow_id) DO UPDATE SET state='PLANNED',plan_sha256=EXCLUDED.plan_sha256,ledger_sequence=EXCLUDED.ledger_sequence`,[st.workflowId,k.tenantId,k.subjectId,...columns,plan.planSha256,plan.ledgerSequence]);}}
 /** Trusted ownership reader for the suppression owner: the application's own record of the subject's owner. */
 async function ownerOf({tenantId,kind,subjectId}){if(!tables[kind])fail('RETENTION_INVALID_REQUEST');
  const rows=kind==='conversation'?(await pool.query('SELECT owner_actor_id AS owner FROM meri_conversations.conversations WHERE tenant_id=$1 AND conversation_id=$2',[tenantId,subjectId])).rows:(await pool.query('SELECT actor_id AS owner FROM meri_artifacts.heads WHERE tenant_id=$1 AND artifact_id=$2',[tenantId,subjectId])).rows;
  return rows[0]?.owner??null;}
 return Object.freeze({get,set,keys,planRows,tx,ownerOf});
}
export {parseSubject};
