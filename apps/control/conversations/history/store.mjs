/** Conversation read projection over the canonical store transaction and integrity decoder. No new schema or writer authority. */
import {hash,same,validateShape} from '../boundary.mjs';
import {refuse} from '../../product-access/errors.mjs';
import {DISCOVERY_SCHEMA,HISTORY_SCHEMA} from './protocol.mjs';
import {promptLineages} from './lineage.mjs';
import {assertNextRunReservation} from '../next-run-reservation.mjs';
// Brand pure canonical decoding failures only. Driver/transport failures retain their unavailable semantics.
const decode=fn=>{try{return fn();}catch{refuse('CONVERSATION_STORE_CORRUPT');}};
const shape=(name,value)=>decode(()=>validateShape(name,value));
function conversation(row,principal){
 if(!row||row.tenant_id!==principal.tenantId||row.owner_actor_id!==principal.actorId)refuse('CONVERSATION_NOT_FOUND');
 const c=row.projection;shape('Conversation',c);
 if(hash(c)!==row.projection_sha256||row.conversation_id!==c.conversationId||!same(c.owner,{tenantId:principal.tenantId,actorId:principal.actorId})||
  c.scopes.some(s=>s.tenantId!==principal.tenantId||s.policyRevision!==c.policyRevision))refuse('CONVERSATION_STORE_CORRUPT');
 if(c.scopes.some(s=>s.kind==='client'&&!principal.clientIds.includes(s.resourceId)))refuse('CONVERSATION_NOT_FOUND');
 return c;
}
export function createConversationHistoryStore({tx,rowRun}){
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
  if(!runs.length)refuse('CONVERSATION_STORE_CORRUPT');let end=0;
  for(let n=0;n<runs.length;n++){const r=runs[n],b=r.projection.binding,base=Number(r.sequence_base),last=Number(r.last_sequence),closed=r.sequence_end==null?null:Number(r.sequence_end);
   if(b.tenantId!==principal.tenantId||b.actorId!==principal.actorId||b.conversationId!==conversationId||!same(r.projection.scopes,subject.scopes)||
    !Number.isSafeInteger(base)||base!==end||!Number.isSafeInteger(last)||last<1||!Number.isSafeInteger(base+last)||n&&b.writerFence<=runs[n-1].projection.binding.writerFence||
    (n<runs.length-1?closed!==base+last:closed!==null&&closed!==base+last))refuse('CONVERSATION_STORE_CORRUPT');end=base+last;
  }
  const lineages=promptLineages(runs);if(after>end)refuse('CONVERSATION_CURSOR_INVALID');
  const records=(await c.query(`SELECT e.* FROM meri_conversations.events e JOIN meri_conversations.runs r USING(tenant_id,conversation_id,run_id)
   WHERE e.tenant_id=$1 AND e.conversation_id=$2 AND r.sequence_base+e.sequence>$3
   ORDER BY r.sequence_base+e.sequence LIMIT $4`,[key.tenantId,conversationId,after,limit+1])).rows;check();
  let cursor=after;const touched=new Set();
  const events=records.map(e=>{const r=runs.find(r=>r.run_id===e.run_id);if(!r)refuse('CONVERSATION_STORE_CORRUPT');const event=e.event;shape('UIEvent',event);
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
    !same(reservation.scopes,subject.scopes)||reservation.policyRevision!==subject.policyRevision||!same(reservation.versions,runs.at(-1).projection.versions))refuse('CONVERSATION_STORE_CORRUPT');
  }
  return {schema:HISTORY_SCHEMA,conversation:subject,latestRun:runs.at(-1).projection,latestSequenceBase:Number(runs.at(-1).sequence_base),turns,events:selected,nextSequence:selected.at(-1)?.sequence??after,lastSequence:end,hasMore:events.length>limit,
   pendingTurn:p?{sourceBinding:p.reservation.source,targetBinding:p.reservation.target,state:p.state}:null};
 });}
 return Object.freeze({list,transcript});
}
