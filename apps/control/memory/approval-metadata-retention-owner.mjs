/** Exact conversation retention port for memory approval-metadata payloads. This is separate from the candidate journal and from
 * the shared task metadata rows in the same relation. It remains unmounted until the central retention owner registers this row
 * class, allocates a guarded target amendment and grants the row owner its narrow privileges. */
import {hash,subject as parseSubject,subjectKey,uuid,digest,fail} from '../retention/boundary.mjs';
import {verifyPlanDigest} from '../retention/purge.mjs';
import {assertPool,transact} from '../product-persistence/transaction.mjs';
import {ProductError} from '../product-access/errors.mjs';
import {memoryMetadataPayload} from './approval-metadata.mjs';

export const MEMORY_APPROVAL_METADATA_ROW_CLASS='meriMemoryApprovalMetadata';
const TABLE='meri_commands.approval_metadata';
const where="tenant_id=$1 AND actor_id=$2 AND memory_conversation_id=$3 AND proposal_id=$4";
const conversation=value=>{const s=parseSubject(value);if(s.kind!=='conversation'||!s.ownerActorId)fail('RETENTION_INVALID_REQUEST');return s;};
function row(raw,subject){
 if(raw.payload===null){
  if(raw.payload_purged_at===null||raw.memory_conversation_id!==subject.subjectId)throw new ProductError('RETENTION_STORE_CORRUPT');
  return null;
 }
 if(raw.payload_purged_at!==null||raw.memory_conversation_id!==subject.subjectId)throw new ProductError('RETENTION_STORE_CORRUPT');
 const payload=memoryMetadataPayload(raw.payload),r=payload.record,b=r.binding;
 if(hash(payload)!==raw.payload_sha256||r.action!=='memory.propose'||b.tenantId!==subject.tenantId||b.actorId!==subject.ownerActorId||
  b.conversationId!==subject.subjectId||r.proposalId!==raw.proposal_id)throw new ProductError('RETENTION_STORE_CORRUPT');
 return r.proposalId;
}
export function createMemoryApprovalMetadataRetentionPayloadOwner({pool}){
 assertPool(pool);
 const tx=(signal,body)=>transact(pool,body,{readOnly:true,check:()=>{if(signal?.aborted)fail('CANCELLED');},
  unavailable:'RETENTION_ROW_READ_UNAVAILABLE',uncertain:'RETENTION_ROW_READ_UNAVAILABLE'});
 return Object.freeze({
  className:MEMORY_APPROVAL_METADATA_ROW_CLASS,
  async inventoryPage({subject,afterProposalId=null,limit=500,signal}){
   const s=conversation(subject);if(afterProposalId!==null)uuid(afterProposalId);
   if(!Number.isSafeInteger(limit)||limit<1||limit>500)fail('RETENTION_INVALID_REQUEST');
   return tx(signal,async client=>{
    const rows=(await client.query(`SELECT proposal_id,payload,payload_sha256,payload_purged_at,memory_conversation_id FROM ${TABLE} WHERE tenant_id=$1 AND actor_id=$2
     AND memory_conversation_id=$3 AND payload IS NOT NULL
     AND ($4::uuid IS NULL OR proposal_id>$4::uuid) ORDER BY proposal_id LIMIT $5`,
    [s.tenantId,s.ownerActorId,s.subjectId,afterProposalId,limit])).rows;
    if(!Array.isArray(rows)||rows.length>limit)throw new ProductError('RETENTION_STORE_CORRUPT');
    return Object.freeze(rows.map(raw=>{const id=row(raw,s);if(id===null)throw new ProductError('RETENTION_STORE_CORRUPT');return id;}));
   });
  },
  async present({subject,proposalId,signal}){
   const s=conversation(subject);uuid(proposalId);
   return tx(signal,async client=>{
    const rows=(await client.query(`SELECT proposal_id,payload,payload_sha256,payload_purged_at,memory_conversation_id FROM ${TABLE} WHERE ${where}`,
     [s.tenantId,s.ownerActorId,s.subjectId,proposalId])).rows;
    if(!Array.isArray(rows)||rows.length>1)throw new ProductError('RETENTION_STORE_CORRUPT');
    return rows.length===1&&row(rows[0],s)===proposalId;
   });
  },
  /** The central row owner supplies its transaction after recording this exact target in that transaction. The target query
   * cannot succeed before the centrally allocated target migration. A guarded UPDATE trigger preserves replay identity. */
  async purgeInTransaction({client,plan,workflowId}){
   if(typeof client?.query!=='function')fail('RETENTION_CONFIGURATION');digest(workflowId);
   const p=verifyPlanDigest(plan),s=conversation(p.subject),key=subjectKey(s);
   if(p.state!=='PLANNED'||p.subjectKey!==key||!Number.isSafeInteger(p.suppression?.ledgerSequence)||p.suppression.ledgerSequence<1)fail('RETENTION_INVALID_REQUEST');
   digest(p.suppression.entrySha256);
   const steps=p.rowSteps.filter(st=>st.workflowId===workflowId);
   if(steps.length!==1||steps[0].className!==MEMORY_APPROVAL_METADATA_ROW_CLASS)fail('RETENTION_INVALID_REQUEST');
   const target=steps[0].target;
   if(!target||Object.keys(target).length!==2||target.className!==MEMORY_APPROVAL_METADATA_ROW_CLASS)fail('RETENTION_INVALID_REQUEST');
   const proposalId=uuid(target.key);
   await client.query("SELECT pg_advisory_xact_lock_shared(hashtextextended('meri_retention_recovery',0))");
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['meri_retention_subject:'+key]);
   const subjects=(await client.query('SELECT owner_actor_id,state,ledger_sequence,entry_sha256,projection,projection_sha256 FROM meri_conversations.retention_subjects WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',
    [s.tenantId,s.subjectId])).rows;
   if(subjects.length!==1||subjects[0].state!=='SUPPRESSED')fail('RETENTION_NOT_SUPPRESSED');
   const current=subjects[0],projection=current.projection;
   if(hash(projection)!==current.projection_sha256||projection?.state!==current.state||Number(current.ledger_sequence)!==projection?.ledgerSequence||
    current.entry_sha256!==projection?.entrySha256)fail('RETENTION_STORE_CORRUPT');
   if(current.owner_actor_id!==s.ownerActorId||projection.ownerActorId!==s.ownerActorId)fail('RETENTION_OWNERSHIP_REFUSED');
   if(projection.ledgerSequence!==p.suppression.ledgerSequence||projection.entrySha256!==p.suppression.entrySha256)fail('RETENTION_SUPPRESSION_GENERATION_REFUSED');
   if(projection.purge?.planSha256!==p.planSha256||!['PLANNED','UNKNOWN'].includes(projection.purge?.state)||
    !Number.isSafeInteger(projection.purge?.ledgerSequence))fail('RETENTION_PURGE_PLAN_MISMATCH');
   const targets=(await client.query("SELECT workflow_id FROM meri_conversations.retention_purge_targets WHERE workflow_id=$1 AND tenant_id=$2 AND conversation_id=$3 AND class='meriMemoryApprovalMetadata' AND proposal_id=$4 AND plan_sha256=$5 AND ledger_sequence=$6 AND actor_id=$7 AND state='PLANNED' AND xmin=pg_current_xact_id()::xid FOR UPDATE",
    [workflowId,s.tenantId,s.subjectId,proposalId,p.planSha256,projection.purge.ledgerSequence,s.ownerActorId])).rows;
   if(targets.length!==1||targets[0].workflow_id!==workflowId)fail('RETENTION_ROW_PURGE_UNAVAILABLE');
   const args=[s.tenantId,s.ownerActorId,s.subjectId,proposalId];
   const redacted=(await client.query(`UPDATE ${TABLE} SET payload=NULL,payload_purged_at=clock_timestamp() WHERE ${where}
    AND payload IS NOT NULL AND payload_purged_at IS NULL`,args)).rowCount;
   if(!Number.isSafeInteger(redacted)||redacted<0||redacted>1)fail('RETENTION_ROW_PURGE_UNAVAILABLE');
   const after=(await client.query(`SELECT payload,payload_purged_at FROM ${TABLE} WHERE ${where}`,args)).rows;
   if(!Array.isArray(after)||after.length!==1||after[0].payload!==null||after[0].payload_purged_at===null)fail('RETENTION_ROW_PURGE_UNAVAILABLE');
   return Object.freeze({workflowId,className:MEMORY_APPROVAL_METADATA_ROW_CLASS,target,deleted:0,redacted,state:'EXECUTED'});
  },
 });
}
