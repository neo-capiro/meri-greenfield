import {assertConversationEvent} from '../../../../packages/contracts/conversation-sources/validate.mjs';
/** Conversation read projection over the canonical store transaction and integrity decoder. No new schema or writer authority. */
import {hash,same,validateShape} from '../boundary.mjs';
import {refuse} from '../../product-access/errors.mjs';
import {DISCOVERY_SCHEMA,HISTORY_SCHEMA} from './protocol.mjs';
import {promptLineages} from './lineage.mjs';
import {assertNextRunReservation} from '../next-run-reservation.mjs';
// Brand pure canonical decoding failures only. Driver/transport failures retain their unavailable semantics.
const decode=fn=>{try{return fn();}catch{refuse('CONVERSATION_STORE_CORRUPT');}};
/** The canonical continuation owner refuses with its plain STORE_CORRUPT code; the frozen history wire maps only
 * CONVERSATION_STORE_CORRUPT to 500, so re-brand that one canonical refusal and let driver/transport failures through. */
const canonical=async fn=>{try{return await fn();}catch(error){if(error?.code!=='STORE_CORRUPT')throw error;refuse('CONVERSATION_STORE_CORRUPT');}};
const shape=(name,value)=>decode(()=>validateShape(name,value));
export function decodeOwnedConversation(row,principal){
 if(!row||row.tenant_id!==principal.tenantId||row.owner_actor_id!==principal.actorId)refuse('CONVERSATION_NOT_FOUND');
 const c=row.projection;shape('Conversation',c);
 if(hash(c)!==row.projection_sha256||row.conversation_id!==c.conversationId||!same(c.owner,{tenantId:principal.tenantId,actorId:principal.actorId})||
  c.scopes.some(s=>s.tenantId!==principal.tenantId||s.policyRevision!==c.policyRevision))refuse('CONVERSATION_STORE_CORRUPT');
 if(c.scopes.some(s=>s.kind==='client'&&!principal.clientIds.includes(s.resourceId)))refuse('CONVERSATION_NOT_FOUND');
 return c;
}
const conversation=decodeOwnedConversation;
export function createConversationHistoryStore({tx,rowRun,continuationCustody}){
 async function list({principal,before,limit},check){return tx({tenantId:principal.tenantId,conversationId:`discovery:${principal.actorId}`},check,async c=>{
  const rows=(await c.query(`SELECT * FROM meri_conversations.conversations WHERE tenant_id=$1 AND owner_actor_id=$2
   AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(projection->'scopes') AS s WHERE s->>'kind'='client' AND NOT (s->>'resourceId'=ANY($3::text[])))
   AND ($4::text IS NULL OR (projection->>'createdAt',conversation_id::text)<($4,$5))
   ORDER BY projection->>'createdAt' DESC,conversation_id DESC LIMIT $6`,[principal.tenantId,principal.actorId,principal.clientIds,before?.createdAt??null,before?.conversationId??null,limit+1])).rows;check();
  const entries=rows.map(r=>conversation(r,principal)),selected=entries.slice(0,limit);
  return {schema:DISCOVERY_SCHEMA,conversations:selected,nextBefore:entries.length>limit?{createdAt:selected.at(-1).createdAt,conversationId:selected.at(-1).conversationId}:null};
 });}
 async function transcript({principal,conversationId,after,limit},check){const key={tenantId:principal.tenantId,conversationId};return tx(key,check,async c=>{
  const row=(await c.query('SELECT * FROM meri_conversations.conversations WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[key.tenantId,conversationId])).rows[0];check();
  const subject=conversation(row,principal),runs=(await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[key.tenantId,conversationId])).rows.map(row=>decode(()=>rowRun(row))).sort((a,b)=>a.projection.binding.writerFence-b.projection.binding.writerFence);check();
  // A verified bootstrap may now be registered for metadata before its first
  // prompt. The owned, valid zero-run record has no transcript yet.
  if(!runs.length)refuse('NOT_FOUND');let end=0;
  for(let n=0;n<runs.length;n++){const r=runs[n],b=r.projection.binding,base=Number(r.sequence_base),last=Number(r.last_sequence),closed=r.sequence_end==null?null:Number(r.sequence_end);
   if(b.tenantId!==principal.tenantId||b.actorId!==principal.actorId||b.conversationId!==conversationId||!same(r.projection.scopes,subject.scopes)||
    !Number.isSafeInteger(base)||base!==end||!Number.isSafeInteger(last)||last<1||!Number.isSafeInteger(base+last)||n&&b.writerFence<=runs[n-1].projection.binding.writerFence||
    (n<runs.length-1?closed!==base+last:closed!==null&&closed!==base+last))refuse('CONVERSATION_STORE_CORRUPT');end=base+last;
  }
  // Continued rows are projected only from the canonical continuation owner's verification of this exact envelope; the
  // source control is observed read-only inside this already-locked target transaction (no source lock, no nested transaction).
  const custody=new Map();
  for(const run of runs){const envelope=await canonical(()=>continuationCustody(c,run,check));if(envelope!==null)custody.set(run.run_id,envelope);}
  const lineages=promptLineages(runs,custody);if(after>end)refuse('CONVERSATION_CURSOR_INVALID');
  const records=(await c.query(`SELECT e.* FROM meri_conversations.events e JOIN meri_conversations.runs r USING(tenant_id,conversation_id,run_id)
   WHERE e.tenant_id=$1 AND e.conversation_id=$2 AND r.sequence_base+e.sequence>$3
   ORDER BY r.sequence_base+e.sequence LIMIT $4`,[key.tenantId,conversationId,after,limit+1])).rows;check();
  let cursor=after;const touched=new Set();
  const events=records.map(e=>{const r=runs.find(r=>r.run_id===e.run_id);if(!r)refuse('CONVERSATION_STORE_CORRUPT');const event=e.event;decode(()=>assertConversationEvent(event));
   const sequence=Number(r.sequence_base)+Number(e.sequence);if(e.tenant_id!==key.tenantId||e.conversation_id!==conversationId||e.event_id!==event.eventId||hash(event)!==e.event_sha256||
    event.sequence!==Number(e.sequence)||event.sequence<1||event.sequence>Number(r.last_sequence)||!same(event.binding,r.projection.binding)||!same(event.scopes,r.projection.scopes)||sequence!==++cursor)refuse('CONVERSATION_STORE_CORRUPT');
   return {sequence,event};
  });
  if(records.length<limit+1&&cursor!==end)refuse('CONVERSATION_STORE_CORRUPT');
  const selected=events.slice(0,limit);selected.forEach(e=>touched.add(e.event.binding.runId));
  const turns=runs.filter(r=>touched.has(r.run_id)).map(r=>({run:r.projection,request:r.request,promptLineage:lineages.get(r.run_id),sequenceBase:Number(r.sequence_base),sequenceEnd:r.sequence_end==null?null:Number(r.sequence_end),lastSequence:Number(r.last_sequence)}));
  const reservations=(await c.query('SELECT * FROM meri_conversations.next_runs WHERE tenant_id=$1 AND conversation_id=$2',[key.tenantId,conversationId])).rows;check();
  const pending=reservations.filter(r=>r.state==='RESERVED');if(pending.length>1)refuse('CONVERSATION_STORE_CORRUPT');
  const p=pending[0];if(p){const reservation=decode(()=>assertNextRunReservation(p.reservation)),{source,target}=reservation;
   if(hash(p.reservation)!==p.reservation_sha256||p.tenant_id!==key.tenantId||p.conversation_id!==conversationId||p.source_run_id!==source.runId||!same(source,runs.at(-1).projection.binding)||p.target_run_id!==target.runId||
    target.tenantId!==source.tenantId||target.actorId!==source.actorId||target.conversationId!==source.conversationId||target.runId===source.runId||target.attemptId===source.attemptId||target.workerId===source.workerId||target.writerFence!==source.writerFence+1||
    !same(reservation.scopes,subject.scopes)||reservation.policyRevision!==subject.policyRevision)refuse('CONVERSATION_STORE_CORRUPT');
  }
  return {schema:HISTORY_SCHEMA,conversation:subject,latestRun:runs.at(-1).projection,latestSequenceBase:Number(runs.at(-1).sequence_base),turns,events:selected,nextSequence:selected.at(-1)?.sequence??after,lastSequence:end,hasMore:events.length>limit,
   pendingTurn:p?{sourceBinding:p.reservation.source,targetBinding:p.reservation.target,state:p.state}:null};
 });}
 async function source({principal,conversationId,runId,referenceId},check){return tx({tenantId:principal.tenantId,conversationId},check,async c=>{
  const subject=conversation((await c.query('SELECT * FROM meri_conversations.conversations WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[principal.tenantId,conversationId])).rows[0],principal);check();
  const rows=(await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',[principal.tenantId,conversationId,runId])).rows;check();
  if(rows.length!==1)refuse('SOURCE_REFERENCE_NOT_FOUND');const run=decode(()=>rowRun(rows[0])),b=run.projection.binding;
  if(b.tenantId!==principal.tenantId||b.actorId!==principal.actorId||b.conversationId!==conversationId||b.runId!==runId||!same(run.projection.scopes,subject.scopes))refuse('CONVERSATION_STORE_CORRUPT');
  const row=(await c.query('SELECT * FROM meri_conversations.events WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 AND event_id=$4',[principal.tenantId,conversationId,runId,referenceId])).rows[0];check();
  if(!row)refuse('SOURCE_REFERENCE_NOT_FOUND');const event=decode(()=>assertConversationEvent(row.event));
  if(hash(event)!==row.event_sha256||row.event_id!==referenceId||event.eventId!==referenceId||Number(row.sequence)!==event.sequence||event.sequence>Number(run.last_sequence)||!same(event.binding,b)||!same(event.scopes,subject.scopes))refuse('CONVERSATION_STORE_CORRUPT');
  if(event.type!=='source.native-bill-text')refuse('SOURCE_REFERENCE_NOT_FOUND');
  return {conversation:subject,event};
 });}
 return Object.freeze({list,transcript,source});
}
