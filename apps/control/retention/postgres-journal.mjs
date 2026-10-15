/** PostgreSQL adapter for the retention journal port (migrations meri_conversations 0010 and meri_artifacts 0002): the restorable
 * projection of the authoritative ledger. One subject row per tenant and conversation or artifact; one purge row per planned or
 * executed storage step; one exact database-row target per planned row deletion, which is what the immutability trigger amendments
 * consult together with the subject's current SUPPRESSED state. Every write takes the subject's advisory lock inside its transaction
 * (so an absent-row compare-and-set is atomic), the shared side of the recovery advisory lock, and compares the projection hash the
 * caller read. Recovery takes the exclusive side on a dedicated session. Borrowed pg-compatible pool; no connection on import. */
import {fail,hash,uuid,text,subject as parseSubject,subjectKey} from './boundary.mjs';
import {rowClassSubjectKind} from './inventory.mjs';
const RECOVERY_LOCK="hashtextextended('meri_retention_recovery',0)";
const tables={conversation:{schema:'meri_conversations',id:'conversation_id'},artifact:{schema:'meri_artifacts',id:'artifact_id'}};
function parseKey(key){if(typeof key!=='string')fail('RETENTION_INVALID_REQUEST');const parts=key.split(':');if(parts.length<3)fail('RETENTION_INVALID_REQUEST');const kind=parts.at(-2),subjectId=parts.at(-1),tenantId=parts.slice(0,-2).join(':');if(!tables[kind])fail('RETENTION_INVALID_REQUEST');return {tenantId,kind,subjectId};}
export function createPostgresRetentionJournal({pool}){
 if(typeof pool?.connect!=='function')fail('RETENTION_CONFIGURATION');
 const wrap=e=>Object.assign(new Error(e?.code&&String(e.code).startsWith('RETENTION_')?e.code:'RETENTION_STORE_UNAVAILABLE'),{code:e?.code&&String(e.code).startsWith('RETENTION_')?e.code:'RETENTION_STORE_UNAVAILABLE',cause:e});
 /** One transaction with bounded waits. Transition writes take the shared side of the recovery lock (`exclusive` writes come from the
  * recovery pass that already holds the exclusive side on its own session); reads take no recovery lock, since the serving barrier
  * already refuses reads while recovery runs. */
 async function tx(body,{exclusive=false,shared=!exclusive}={}){let c,begun=false;try{c=await pool.connect();await c.query('BEGIN');begun=true;await c.query("SET LOCAL statement_timeout = '5s'");await c.query("SET LOCAL lock_timeout = '2s'");
   if(shared)await c.query(`SELECT pg_advisory_xact_lock_shared(${RECOVERY_LOCK})`);const r=await body(c);await c.query('COMMIT');return r;}
  catch(e){if(begun)try{await c.query('ROLLBACK');}catch{}throw wrap(e);}finally{if(c)c.release();}}
 const subjectLock=(c,key)=>c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['meri_retention_subject:'+key]);
 const rowValue=r=>{if(hash(r.projection)!==r.projection_sha256)fail('RETENTION_STORE_CORRUPT');return r.projection;};
 async function readRow(c,k){const t=tables[k.kind];const rows=(await c.query(`SELECT * FROM ${t.schema}.retention_subjects WHERE tenant_id=$1 AND ${t.id}=$2 FOR UPDATE`,[k.tenantId,k.subjectId])).rows;return rows[0]??null;}
 /** Reads take the shared side of the recovery lock too, so a serving gate in any process waits for, or refuses during, a recovery pass
  * (bounded by lock_timeout); the recovery pass itself reads with `exclusive` on its own session. */
 async function get(key,{exclusive=false}={}){const k=parseKey(key);return tx(async c=>{const r=await readRow(c,k);if(!r)return null;const v=rowValue(r);if(v.state!==r.state||Number(r.ledger_sequence)!==v.ledgerSequence)fail('RETENTION_STORE_CORRUPT');return v;},{shared:!exclusive});}
 /** Compare-and-set projection write under the subject advisory lock: `expected` null means the row must not exist (two writers that both
  * observed absence cannot both succeed); otherwise it must equal the current projection hash. */
 async function set(key,value,{expected,exclusive=false}={}){
  const k=parseKey(key),t=tables[k.kind];if(!value||typeof value!=='object'||!['SUPPRESSED','RELEASED'].includes(value.state)||!Number.isSafeInteger(value.ledgerSequence)||typeof value.entrySha256!=='string')fail('RETENTION_INVALID_REQUEST');
  const owner=value.ownerActorId??null;const projection=structuredClone(value);
  return tx(async c=>{
   await subjectLock(c,key);const existing=await readRow(c,k);
   if(expected!==undefined&&(existing?.projection_sha256??null)!==expected)fail('RETENTION_STALE_WRITE');
   const ownerActorId=existing?.owner_actor_id??owner;if(typeof ownerActorId!=='string'||!ownerActorId)fail('RETENTION_INVALID_REQUEST');
   const suppressedAt=value.state==='SUPPRESSED'?new Date(value.suppressedAtMs).toISOString():null,releasedAt=value.state==='RELEASED'&&Number.isSafeInteger(value.releasedAtMs)?new Date(value.releasedAtMs).toISOString():null;
   const args=[k.tenantId,k.subjectId,ownerActorId,value.state,suppressedAt,releasedAt,value.ledgerSequence,value.entrySha256,projection,hash(projection)];
   if(existing){const r=await c.query(`UPDATE ${t.schema}.retention_subjects SET owner_actor_id=$3,state=$4,suppressed_at=$5,released_at=$6,ledger_sequence=$7,entry_sha256=$8,projection=$9,projection_sha256=$10 WHERE tenant_id=$1 AND ${t.id}=$2 AND projection_sha256=$11`,[...args,existing.projection_sha256]);if(r.rowCount!==1)fail('RETENTION_STALE_WRITE');}
   else{const r=await c.query(`INSERT INTO ${t.schema}.retention_subjects(tenant_id,${t.id},owner_actor_id,state,suppressed_at,released_at,ledger_sequence,entry_sha256,projection,projection_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`,args);if(r.rowCount!==1)fail('RETENTION_STALE_WRITE');}
   await c.query(`DELETE FROM ${t.schema}.retention_purges WHERE tenant_id=$1 AND ${t.id}=$2`,[k.tenantId,k.subjectId]);
   if(k.kind==='conversation')await c.query('DELETE FROM meri_conversations.retention_purge_targets WHERE tenant_id=$1 AND conversation_id=$2',[k.tenantId,k.subjectId]);
   const purge=value.purge;if(!purge)return projection;
   const rowState=new Map((purge.rowSteps??[]).map(r=>[r.workflowId,['EXECUTED','UNKNOWN'].includes(r.state)?r.state:'PLANNED'])),versionState=new Map((purge.rowSteps??[]).filter(r=>r.className==='artifactVersions').map(r=>[r.target.artifactVersionId,rowState.get(r.workflowId)]));
   for(const st of purge.steps??[]){const stepState=st.state==='EXECUTED'?'EXECUTED':st.state==='UNKNOWN'?'UNKNOWN':purge.state==='BLOCKED'?'BLOCKED':'PLANNED';const receipt=st.requested||st.readback?{requested:st.requested??null,readback:st.readback??null}:null;
    if(k.kind==='conversation')await c.query('INSERT INTO meri_conversations.retention_purges(workflow_id,tenant_id,conversation_id,class,object_id,version_id,sha256,plan_sha256,state,receipt,receipt_sha256,ledger_sequence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[st.workflowId,k.tenantId,k.subjectId,(st.classes??[]).join(','),st.objectId,st.versionId,st.sha256,purge.planSha256,stepState,receipt,receipt?hash(receipt):null,purge.ledgerSequence]);
    else for(const [i,artifactVersionId] of (st.artifactVersionIds?.length?st.artifactVersionIds:[null]).entries())await c.query('INSERT INTO meri_artifacts.retention_purges(workflow_id,tenant_id,artifact_id,version_id,object_id,object_version_id,sha256,plan_sha256,state,receipt,receipt_sha256,ledger_sequence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[i?hash({w:st.workflowId,artifactVersionId}):st.workflowId,k.tenantId,k.subjectId,artifactVersionId,st.objectId,st.versionId,st.sha256,purge.planSha256,artifactVersionId&&versionState.get(artifactVersionId)==='UNKNOWN'?'UNKNOWN':stepState,receipt,receipt?hash(receipt):null,purge.ledgerSequence]);}
   // Executed or unverifiable row targets are projected with their outcome; a PLANNED projection records no target (planRows does, inside the deleting transaction).
   if(k.kind==='conversation')for(const r of purge.rowSteps??[]){if(r.className!=='sdkSession'||!['EXECUTED','UNKNOWN'].includes(r.state))continue;const g=r.target;
    await c.query('INSERT INTO meri_conversations.retention_purge_targets(workflow_id,tenant_id,conversation_id,class,run_id,session_id,subpath,sequence,plan_sha256,state,ledger_sequence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[r.workflowId,k.tenantId,k.subjectId,'sdkSession',g.runId,g.sessionId,g.subpath,g.sequence,purge.planSha256,r.state,purge.ledgerSequence]);}
   return projection;},{exclusive});
 }
 async function keys({exclusive=false}={}){return tx(async c=>{const out=[];for(const [kind,t] of Object.entries(tables)){const rows=(await c.query(`SELECT tenant_id,${t.id} AS subject_id FROM ${t.schema}.retention_subjects`)).rows;for(const r of rows)out.push(subjectKey({tenantId:r.tenant_id,kind,subjectId:r.subject_id}));}return out;},{shared:!exclusive});}
 /** Recovery on a dedicated session: the exclusive recovery advisory lock excludes every transition write for the whole pass. */
 async function exclusive(fn){const c=await pool.connect();try{await c.query(`SELECT pg_advisory_lock(${RECOVERY_LOCK})`);try{return await fn();}finally{await c.query(`SELECT pg_advisory_unlock(${RECOVERY_LOCK})`);}}catch(e){throw wrap(e);}finally{c.release();}}
 /** Records the exact row and version targets a purge may delete, inside the caller's transaction, under the subject lock, only when the
  * subject is currently SUPPRESSED under the plan's suppression generation and the plan is the subject's current recorded plan. */
 async function planRows(c,key,plan){
  const k=parseKey(key),t=tables[k.kind];await subjectLock(c,key);const row=await readRow(c,k);if(!row||row.state!=='SUPPRESSED')fail('RETENTION_NOT_SUPPRESSED');
  const current=rowValue(row);if(plan.suppression&&(current.ledgerSequence!==plan.suppression.ledgerSequence||current.entrySha256!==plan.suppression.entrySha256))fail('RETENTION_SUPPRESSION_GENERATION_REFUSED');
  if(current.purge?.planSha256!==plan.planSha256||!['PLANNED','UNKNOWN'].includes(current.purge?.state))fail('RETENTION_PURGE_PLAN_MISMATCH');
  if(k.kind==='conversation'){for(const st of plan.rowSteps??[]){if(st.className!=='sdkSession')continue;const g=st.target;
    await c.query('INSERT INTO meri_conversations.retention_purge_targets(workflow_id,tenant_id,conversation_id,class,run_id,session_id,subpath,sequence,plan_sha256,state,ledger_sequence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,\'PLANNED\',$10) ON CONFLICT (workflow_id) DO UPDATE SET state=\'PLANNED\',plan_sha256=EXCLUDED.plan_sha256,ledger_sequence=EXCLUDED.ledger_sequence',[st.workflowId,k.tenantId,k.subjectId,'sdkSession',g.runId,g.sessionId,g.subpath,g.sequence,plan.planSha256,current.purge.ledgerSequence]);}}
  else{for(const st of plan.rowSteps??[]){if(st.className!=='artifactVersions')continue;const versionId=st.target.artifactVersionId;const step=(plan.steps??[]).find(x=>x.artifactVersionIds?.includes(versionId));
    await c.query('INSERT INTO meri_artifacts.retention_purges(workflow_id,tenant_id,artifact_id,version_id,object_id,object_version_id,sha256,plan_sha256,state,receipt,receipt_sha256,ledger_sequence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,\'PLANNED\',NULL,NULL,$9) ON CONFLICT (workflow_id) DO UPDATE SET state=\'PLANNED\',plan_sha256=EXCLUDED.plan_sha256,ledger_sequence=EXCLUDED.ledger_sequence',[st.workflowId,k.tenantId,k.subjectId,versionId,step?.objectId??'00000000-0000-4000-8000-000000000000',step?.versionId??'none',step?.sha256??'0'.repeat(64),plan.planSha256,current.purge.ledgerSequence]);}}
 }
 const rowWhere={sdkSession:{table:'meri_conversations.sdk_session_entries',where:'tenant_id=$1 AND conversation_id=$2 AND run_id=$3 AND session_id=$4 AND subpath=$5 AND sequence=$6',args:(k,g)=>[k.tenantId,k.subjectId,uuid(g.runId),uuid(g.sessionId),text(g.subpath,1024),Number.isSafeInteger(g.sequence)&&g.sequence>0?g.sequence:fail('RETENTION_INVALID_REQUEST')]},
  artifactVersions:{table:'meri_artifacts.versions',where:'tenant_id=$1 AND artifact_id=$2 AND version_id=$3',args:(k,g)=>[k.tenantId,k.subjectId,uuid(g.artifactVersionId)]}};
 /** Routing for one row target: the class must belong to this subject kind and the exact target must be well formed. */
 const rowTarget=(k,st)=>{const w=rowWhere[st?.className];if(!w||rowClassSubjectKind[st.className]!==k.kind||!st.target||typeof st.target!=='object')fail('RETENTION_INVALID_REQUEST');w.args(k,st.target);return w;};
 /** Validates every row target of a plan against this routing with no database access, so a purge refuses before any effect. */
 async function preflightRows(key,plan){const k=parseKey(key);if(!Array.isArray(plan?.rowSteps))fail('RETENTION_INVALID_REQUEST');for(const st of plan.rowSteps)rowTarget(k,st);return true;}
 /** The database-row purge port. `purge` deletes every row target of the plan in one transaction that first records the exact targets
  * under the subject lock (planRows), so the trigger amendments admit exactly these rows and nothing else; a head still bound to an
  * artifact version under purge is retired in the same transaction. A row still present afterwards is reported UNKNOWN. Any failure
  * rolls the whole transaction back: targets, head retirement and deletions together. */
 async function purgeRows(key,plan){const k=parseKey(key);await preflightRows(key,plan);
  return tx(async c=>{await planRows(c,key,plan);const out=[];
   if(k.kind==='artifact'){const versions=(plan.rowSteps??[]).filter(st=>st.className==='artifactVersions').map(st=>st.target.artifactVersionId);if(versions.length)await c.query('DELETE FROM meri_artifacts.heads WHERE tenant_id=$1 AND artifact_id=$2 AND version_id=ANY($3::uuid[])',[k.tenantId,k.subjectId,versions]);}
   for(const st of plan.rowSteps??[]){const w=rowTarget(k,st),args=w.args(k,st.target);
    const deleted=(await c.query(`DELETE FROM ${w.table} WHERE ${w.where}`,args)).rowCount;const present=(await c.query(`SELECT 1 FROM ${w.table} WHERE ${w.where}`,args)).rowCount>0;const state=present?'UNKNOWN':'EXECUTED';
    if(k.kind==='conversation')await c.query('UPDATE meri_conversations.retention_purge_targets SET state=$2 WHERE workflow_id=$1',[st.workflowId,state]);else await c.query('UPDATE meri_artifacts.retention_purges SET state=$2 WHERE workflow_id=$1',[st.workflowId,state]);
    out.push({workflowId:st.workflowId,className:st.className,target:st.target,deleted,state});}
   return out;});}
 /** Whether an exact row target still exists (recovery re-verification). */
 async function rowPresent(key,st){const k=parseKey(key),w=rowTarget(k,st);try{return (await pool.query(`SELECT 1 FROM ${w.table} WHERE ${w.where}`,w.args(k,st.target))).rowCount>0;}catch(e){throw wrap(e);}}
 const rows=Object.freeze({preflight:preflightRows,purge:purgeRows,present:rowPresent});
 /** Trusted ownership reader for the suppression owner: the application's own record of the subject's owner. */
 async function ownerOf({tenantId,kind,subjectId}){if(!tables[kind])fail('RETENTION_INVALID_REQUEST');
  const rows=kind==='conversation'?(await pool.query('SELECT owner_actor_id AS owner FROM meri_conversations.conversations WHERE tenant_id=$1 AND conversation_id=$2',[tenantId,subjectId])).rows:(await pool.query('SELECT actor_id AS owner FROM meri_artifacts.heads WHERE tenant_id=$1 AND artifact_id=$2',[tenantId,subjectId])).rows;
  return rows[0]?.owner??null;}
 return Object.freeze({get,set,keys,exclusive,planRows,rows,tx,ownerOf});
}
export {parseSubject};
