/** PostgreSQL producer journal over the source-only `meri_memory.candidates` table: candidate migration
 * `migrations/0001_memory_candidates.sql` (centrally reserved for source authoring in the Package 4 allocation; never applied here; its statement
 * parity with this journal is witnessed by `test/migration-source.test.mjs`).
 * The journal is the producer's outbox: the immutable candidate and its hash are written once; only the submission state moves
 * PREPARED → SUBMITTED | SUBMISSION_UNKNOWN → SUBMITTED. Review status is never stored here; Core owns it. */
import {refuse} from '../product-access/errors.mjs';
import {UUID} from '../product-access/shape.mjs';
import {assertPool,transact} from '../product-persistence/transaction.mjs';
import {subjectKey} from '../retention/boundary.mjs';
import {assertCandidate} from './candidate.mjs';
const table='meri_memory.candidates';
const COLUMNS='candidate, candidate_sha256, request_sha256, submission_state, review_id';
export const SUBMISSION_STATES=Object.freeze(['PREPARED','SUBMITTED','SUBMISSION_UNKNOWN']);
function record(row){
 const {candidate,candidateSha256}=assertCandidate(row.candidate);
 if(candidateSha256!==row.candidate_sha256||!SUBMISSION_STATES.includes(row.submission_state)||(row.submission_state==='SUBMITTED')!==(row.review_id!==null))refuse('MEMORY_JOURNAL_STATE');
 return Object.freeze({candidate,candidateSha256,requestSha256:row.request_sha256,submission:Object.freeze({state:row.submission_state,reviewId:row.review_id})});
}
export function createPostgresMemoryJournal({pool,guardConversationRetention=false}){
 assertPool(pool);
 if(typeof guardConversationRetention!=='boolean')refuse('PRODUCT_CONFIGURATION');
 const tx=(signal,operation,readOnly=false)=>transact(pool,operation,{readOnly,check:()=>{if(signal?.aborted)refuse('CANCELLED');},unavailable:'MEMORY_JOURNAL_UNAVAILABLE',uncertain:'MEMORY_JOURNAL_UNKNOWN'});
 /** Serialize conversation-origin INSERTs with the canonical PostgreSQL retention projection. The producer's canonical serving
  * gate checks the authoritative recovery barrier before this transaction; this check closes the race with an already projected
  * suppression. The central retention owner still must fence the external ledger append through projection. */
 async function guardInsert(client,candidate){
  if(!guardConversationRetention||candidate.origin.kind!=='conversation')return;
  const s={tenantId:candidate.tenantId,kind:'conversation',subjectId:candidate.origin.conversationId};
  // A pool may default to REPEATABLE READ; its pre-lock snapshot would miss a projection committed while this tx waited.
  await client.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
  await client.query("SELECT pg_advisory_xact_lock_shared(hashtextextended('meri_retention_recovery',0))");
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['meri_retention_subject:'+subjectKey(s)]);
  const rows=(await client.query('SELECT state FROM meri_conversations.retention_subjects WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[s.tenantId,s.subjectId])).rows;
  if(rows.length>1||rows[0]&&!['SUPPRESSED','RELEASED'].includes(rows[0].state))refuse('MEMORY_JOURNAL_STATE');
  if(rows[0]?.state==='SUPPRESSED')refuse('MEMORY_PROPOSAL_NOT_FOUND');
 }
 return Object.freeze({
  /** Insert-once by (tenant, proposer, idempotency key). A replay returns the original record; a different request under the same
   * key is a conflict, never a silent substitution. */
  insert({candidate,candidateSha256,requestSha256,signal}){
   const verified=assertCandidate(candidate);if(verified.candidateSha256!==candidateSha256)refuse('MEMORY_JOURNAL_STATE');
   const c=verified.candidate;
   return tx(signal,async client=>{
    await guardInsert(client,c);
    const inserted=(await client.query(`INSERT INTO ${table}(tenant_id,candidate_id,proposer_actor_id,idempotency_key,request_sha256,candidate,candidate_sha256,scope,client_id,created_at,submission_state)
     VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,'PREPARED') ON CONFLICT (tenant_id,proposer_actor_id,idempotency_key) DO NOTHING RETURNING ${COLUMNS}`,
     [c.tenantId,c.candidateId,c.proposerActorId,c.idempotencyKey,requestSha256,JSON.stringify(c),candidateSha256,c.scope,c.clientId,c.createdAt])).rows[0];
    if(inserted)return Object.freeze({inserted:true,record:record(inserted)});
    const existing=(await client.query(`SELECT ${COLUMNS} FROM ${table} WHERE tenant_id=$1 AND proposer_actor_id=$2 AND idempotency_key=$3 FOR UPDATE`,[c.tenantId,c.proposerActorId,c.idempotencyKey])).rows[0];
    if(!existing)refuse('MEMORY_JOURNAL_STATE');
    const r=record(existing);if(r.requestSha256!==requestSha256)refuse('MEMORY_IDEMPOTENCY_CONFLICT');
    return Object.freeze({inserted:false,record:r});
   });
  },
  recordSubmission({tenantId,candidateId,candidateSha256,reviewId,signal}){
   return tx(signal,async client=>{
    const r=await client.query(`UPDATE ${table} SET submission_state='SUBMITTED', review_id=$4, submitted_at=clock_timestamp() WHERE tenant_id=$1 AND candidate_id=$2 AND candidate_sha256=$3
     AND (submission_state IN ('PREPARED','SUBMISSION_UNKNOWN') OR submission_state='SUBMITTED' AND review_id=$4)`,[tenantId,candidateId,candidateSha256,reviewId]);
    if(r.rowCount!==1)refuse('MEMORY_JOURNAL_STATE');
   });
  },
  recordUnknown({tenantId,candidateId,signal}){
   return tx(signal,async client=>{await client.query(`UPDATE ${table} SET submission_state='SUBMISSION_UNKNOWN' WHERE tenant_id=$1 AND candidate_id=$2 AND submission_state='PREPARED'`,[tenantId,candidateId]);});
  },
  get({tenantId,proposerActorId,candidateId,signal}){
   return tx(signal,async client=>{const row=(await client.query(`SELECT ${COLUMNS} FROM ${table} WHERE tenant_id=$1 AND proposer_actor_id=$2 AND candidate_id=$3`,[tenantId,proposerActorId,candidateId])).rows[0];return row?record(row):null;},true);
  },
  /** Immutable request custody, scoped to the current tenant and original proposer. No mutable target read is needed for replay. */
  findOwnByKey({tenantId,proposerActorId,idempotencyKey,signal}){
   return tx(signal,async client=>{const row=(await client.query(`SELECT ${COLUMNS} FROM ${table} WHERE tenant_id=$1 AND proposer_actor_id=$2 AND idempotency_key=$3`,[tenantId,proposerActorId,idempotencyKey])).rows[0];return row?record(row):null;},true);
  },
  /** Own candidates newest first. Client-scoped rows are filtered to `clientIds` in SQL; personal and firm rows are the proposer's own. */
  listOwn({tenantId,proposerActorId,clientIds,clientId,cursor,limit,signal}){
   return tx(signal,async client=>{
    const rows=(await client.query(`SELECT ${COLUMNS} FROM ${table} WHERE tenant_id=$1 AND proposer_actor_id=$2
     AND (scope<>'client' OR client_id = ANY($3::uuid[])) AND ($4::uuid IS NULL OR client_id=$4)
     AND ($5::timestamptz IS NULL OR (created_at,candidate_id) < ($5::timestamptz,$6::uuid))
     ORDER BY created_at DESC, candidate_id DESC LIMIT $7`,[tenantId,proposerActorId,[...clientIds],clientId,cursor?.createdAt??null,cursor?.candidateId??null,limit])).rows;
    return Object.freeze(rows.map(record));
   },true);
  },
  /** Exact local payload IDs for a conversation retention inventory. This is the Meri outbox, separate from Core's received
   * candidates. A fixed keyset bound prevents a large conversation from being silently truncated by a one-shot inventory query.
   * The central retention owner must still bind this port, suppression and guarded row deletion before claiming purge coverage. */
  async listConversationCandidateIds({tenantId,conversationId,afterCandidateId=null,limit=500,signal}){
   if(typeof tenantId!=='string'||tenantId.length<1||tenantId.length>128||typeof conversationId!=='string'||!UUID.test(conversationId)||
    afterCandidateId!==null&&(typeof afterCandidateId!=='string'||!UUID.test(afterCandidateId))||!Number.isSafeInteger(limit)||limit<1||limit>500)refuse('MEMORY_JOURNAL_STATE');
   return tx(signal,async client=>{
    const rows=(await client.query(`SELECT candidate_id FROM ${table} WHERE tenant_id=$1 AND candidate->'origin'->>'kind'='conversation'
     AND candidate->'origin'->>'conversationId'=$2 AND ($3::uuid IS NULL OR candidate_id>$3::uuid)
     ORDER BY candidate_id LIMIT $4`,[tenantId,conversationId,afterCandidateId,limit])).rows;
    if(rows.some(row=>typeof row.candidate_id!=='string'||!UUID.test(row.candidate_id)))refuse('MEMORY_JOURNAL_STATE');
    return Object.freeze(rows.map(row=>row.candidate_id));
   },true);
  },
 });
}
