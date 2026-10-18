/** The Meri-owned candidate payload in a conversation retention inventory. Core owns its received copy separately. This port is
 * deliberately not mounted by the producer or the retention row dispatcher: the latter must first allocate and apply a guarded
 * target amendment, bind this class to its policy/inventory, and supply its own transaction after recording the exact row target. */
import {hash,subject as parseSubject,subjectKey,uuid,digest,fail} from '../retention/boundary.mjs';
import {verifyPlanDigest} from '../retention/purge.mjs';
import {assertPool} from '../product-persistence/transaction.mjs';
import {createPostgresMemoryJournal} from './postgres-journal.mjs';

export const MEMORY_CANDIDATE_ROW_CLASS='meriMemoryCandidates';
const TABLE='meri_memory.candidates';
const rowWhere="tenant_id=$1 AND candidate_id=$3 AND origin_kind='conversation' AND origin_conversation_id=$2 AND proposer_actor_id=$4";

/** Exact local inventory and readback, plus content redaction inside the central row owner's transaction.
 * `purgeInTransaction` requires that transaction to have recorded its matching target in the current transaction. Its SQL cannot
 * pass before the separately allocated retention-target amendment adds candidate_id and admits this class. The future database
 * trigger must independently enforce the same target/suppression check on the one-way content tombstone UPDATE. */
export function createMemoryCandidateRetentionPayloadOwner({pool}){
 assertPool(pool);
 const journal=createPostgresMemoryJournal({pool});
 const conversation=s=>{const v=parseSubject(s);if(v.kind!=='conversation'||!v.ownerActorId)fail('RETENTION_INVALID_REQUEST');return v;};
 return Object.freeze({
  className:MEMORY_CANDIDATE_ROW_CLASS,
  inventoryPage({subject,afterCandidateId=null,limit=500,signal}){
   const s=conversation(subject);
   return journal.listConversationCandidateIds({tenantId:s.tenantId,conversationId:s.subjectId,proposerActorId:s.ownerActorId,afterCandidateId,limit,signal});
  },
  /** Recovery readback checks the full tenant, conversation origin and candidate identity. */
  present({subject,candidateId,signal}){
   const s=conversation(subject);uuid(candidateId);
   return journal.hasConversationCandidate({tenantId:s.tenantId,conversationId:s.subjectId,proposerActorId:s.ownerActorId,candidateId,signal});
  },
  /** Called by the central row owner only after its planRows in the SAME READ COMMITTED transaction. Never opens or commits one. */
  async purgeInTransaction({client,plan,workflowId}){
   if(typeof client?.query!=='function')fail('RETENTION_CONFIGURATION');
   digest(workflowId);
   const p=verifyPlanDigest(plan),s=conversation(p.subject),key=subjectKey(s);
   if(p.state!=='PLANNED'||p.subjectKey!==key||!s.ownerActorId||!Number.isSafeInteger(p.suppression?.ledgerSequence)||p.suppression.ledgerSequence<1)fail('RETENTION_INVALID_REQUEST');
   digest(p.suppression.entrySha256);
   const matches=p.rowSteps.filter(st=>st.workflowId===workflowId);
   if(matches.length!==1||matches[0].className!==MEMORY_CANDIDATE_ROW_CLASS)fail('RETENTION_INVALID_REQUEST');
   const target=matches[0].target;
   if(!target||Object.keys(target).length!==2||target.className!==MEMORY_CANDIDATE_ROW_CLASS)fail('RETENTION_INVALID_REQUEST');
   const candidateId=uuid(target.key);
   await client.query("SELECT pg_advisory_xact_lock_shared(hashtextextended('meri_retention_recovery',0))");
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['meri_retention_subject:'+key]);
   const subjects=(await client.query('SELECT owner_actor_id,state,ledger_sequence,entry_sha256,projection,projection_sha256 FROM meri_conversations.retention_subjects WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[s.tenantId,s.subjectId])).rows;
   if(subjects.length!==1||subjects[0].state!=='SUPPRESSED')fail('RETENTION_NOT_SUPPRESSED');
   const row=subjects[0],projection=row.projection;
   if(hash(projection)!==row.projection_sha256||projection?.state!==row.state||Number(row.ledger_sequence)!==projection?.ledgerSequence||row.entry_sha256!==projection?.entrySha256)fail('RETENTION_STORE_CORRUPT');
   if(row.owner_actor_id!==s.ownerActorId||projection.ownerActorId!==s.ownerActorId)fail('RETENTION_OWNERSHIP_REFUSED');
   if(projection.ledgerSequence!==p.suppression.ledgerSequence||projection.entrySha256!==p.suppression.entrySha256)fail('RETENTION_SUPPRESSION_GENERATION_REFUSED');
   if(projection.purge?.planSha256!==p.planSha256||!['PLANNED','UNKNOWN'].includes(projection.purge?.state)||!Number.isSafeInteger(projection.purge?.ledgerSequence))fail('RETENTION_PURGE_PLAN_MISMATCH');
   // The same-xact target check makes this method fail closed until the fresh target migration and the central planRows owner land.
   const targets=(await client.query("SELECT workflow_id FROM meri_conversations.retention_purge_targets WHERE workflow_id=$1 AND tenant_id=$2 AND conversation_id=$3 AND class='meriMemoryCandidates' AND candidate_id=$4 AND plan_sha256=$5 AND ledger_sequence=$6 AND actor_id=$7 AND state='PLANNED' AND xmin=pg_current_xact_id()::xid FOR UPDATE",
    [workflowId,s.tenantId,s.subjectId,candidateId,p.planSha256,projection.purge.ledgerSequence,s.ownerActorId])).rows;
   if(targets.length!==1||targets[0].workflow_id!==workflowId)fail('RETENTION_ROW_PURGE_UNAVAILABLE');
   const args=[s.tenantId,s.subjectId,candidateId,s.ownerActorId];
   const redacted=(await client.query(`UPDATE ${TABLE} SET candidate=NULL,candidate_purged_at=clock_timestamp() WHERE ${rowWhere}
    AND candidate IS NOT NULL AND candidate_purged_at IS NULL`,args)).rowCount;
   if(!Number.isSafeInteger(redacted)||redacted<0||redacted>1)fail('RETENTION_ROW_PURGE_UNAVAILABLE');
   const after=(await client.query(`SELECT candidate,candidate_purged_at FROM ${TABLE} WHERE ${rowWhere}`,args)).rows;
   if(!Array.isArray(after)||after.length!==1||after[0].candidate!==null||after[0].candidate_purged_at===null)fail('RETENTION_ROW_PURGE_UNAVAILABLE');
   return Object.freeze({workflowId,className:MEMORY_CANDIDATE_ROW_CLASS,target,deleted:0,redacted,state:'EXECUTED'});
  }
 });
}
