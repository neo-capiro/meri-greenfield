/** Next-turn reservations: a new prompt in the same conversation, never a recovery of the old one. One immutable mapping per
 * terminal source run. The new prompt continues the conversation's latest published completion checkpoint: a completed source's own,
 * else (a failed or cancelled source never publishes one) the last completed turn's, so a stop or an error never erases what the
 * conversation knows. Only a conversation with no completed turn yet starts a fresh SDK session (checkpoint null). */
import {assertRun,bounded,hash,same,fail,validateShape,uuid,own} from './boundary.mjs';
import {validateCompletionProof} from './completion-journal.mjs';
import {closeSequenceRange} from './sequence-ranges.mjs';
import {FORECLOSED,foreclosed} from './native-preparation-journal.mjs';
import {assertNextRunFacts as facts,assertNextRunReservation} from './next-run-reservation.mjs';
import {continuesSession,sessionDiscontinuity} from '../../../packages/contracts/session-continuity.mjs';
/** Terminal states that may admit a next prompt once the original is retired and its grants revoked. */
export const admitsNextRun=state=>state==='completed'||state==='failed'||state==='cancelled';
const CHECKPOINTED=['paused','waiting-for-approval'];
/** A lifecycle resume's successor, as the lifecycle journal leaves it: the source stays in its checkpointed state (never terminal), its
 * sequence range closed by the successor, and the successor's run row carries the continuation envelope naming the source. */
const continued=(source,target)=>target.continuation!=null&&same(target.continuation.continuation?.checkpoint?.binding,source.projection.binding)&&CHECKPOINTED.includes(source.projection.state)&&source.sequence_end!=null;
/** The next-run mapping of a lifecycle resume (lifecycle/journal.mjs `continuation`), written inside that journal's locked source
 * transaction (same conversation lock) together with the successor's run row. The successor continues the checkpointed source rather
 * than opening a new prompt, so the mapping is born ACCEPTED and the prepared-run registry serves it exactly like an accepted next
 * turn. The source holds no authority: its allocation row must be RETIRED with the physical stop proven (the native stop records
 * RETIRED only after revocation; the retirement receipt the lifecycle verified names it) and the caller has closed its range. The
 * facts carry no checkpoint: the lifecycle envelope, never a completion checkpoint, carries the resumed one, so `execution` yields no
 * next-turn lineage for it. One mapping per source and per target, as for a reserved next prompt. */
export async function recordContinuationReservation(c,{source,target,scopes,versions,policyRevision,reservedAt},check){
 if(target.tenantId!==source.tenantId||target.actorId!==source.actorId||target.conversationId!==source.conversationId||target.runId===source.runId||target.attemptId===source.attemptId||target.workerId===source.workerId||target.writerFence!==source.writerFence+1)fail('NEXT_RUN_TARGET_REFUSED');
 for(const [column,runId] of [['source_run_id',source.runId],['target_run_id',target.runId]]){const rows=(await c.query(`SELECT * FROM meri_conversations.next_runs WHERE tenant_id=$1 AND conversation_id=$2 AND ${column}=$3 FOR UPDATE`,[source.tenantId,source.conversationId,runId])).rows;check();if(rows.length)fail('NEXT_RUN_REPLAY_REFUSED');}
 const allocation=(await c.query('SELECT * FROM meri_conversations.native_allocations WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[source.tenantId,source.conversationId,source.runId])).rows;check();
 if(allocation.length!==1||hash(allocation[0].record)!==allocation[0].record_sha256)fail('NEXT_RUN_RETIREMENT_REQUIRED');const a=allocation[0].record;
 if(a.state!=='RETIRED'||a.resource?.physicalStopProven!==true||!same(a.original?.binding,source)||!Array.isArray(a.grantIntents)||!a.grantIntents.length)fail('NEXT_RUN_RETIREMENT_REQUIRED');
 const reservation=assertNextRunReservation({source,target,facts:{checkpoint:null,retirement:{physicalStopProven:true},revocation:{receiptSha256:allocation[0].record_sha256,grantIds:a.grantIntents.map(g=>g.grantId)}},scopes,versions:bounded(versions),policyRevision,reservedAt});
 await c.query('INSERT INTO meri_conversations.next_runs(tenant_id,conversation_id,source_run_id,target_run_id,reservation,reservation_sha256,state) VALUES($1,$2,$3,$4,$5,$6,$7)',[source.tenantId,source.conversationId,source.runId,target.runId,reservation,hash(reservation),'ACCEPTED']);check();
 return reservation;
}
export function createNextRunJournal({tx,rowRun}){
 const row=r=>{if(!r||hash(r.reservation)!==r.reservation_sha256)fail('STORE_CORRUPT');const v=assertNextRunReservation(r.reservation);if(r.source_run_id!==v.source.runId||r.target_run_id!==v.target.runId||r.tenant_id!==v.target.tenantId||r.conversation_id!==v.target.conversationId||!['RESERVED','ACCEPTED'].includes(r.state))fail('STORE_CORRUPT');return {...v,state:r.state};};
 const key=value=>{const k=bounded(value);own(k,['tenantId','conversationId']);uuid(k.conversationId);if(typeof k.tenantId!=='string'||!k.tenantId||k.tenantId.length>256)fail('INVALID_REQUEST');return k;};
 /** Either retirement plus revocation of an allocation that existed, or (failed/cancelled source only) the store's explicit
  * no-authority evidence that the attempt never claimed one; the journal verifies whichever is named against the row itself. */
 function completion(r,source){if(!r||hash(r.identity)!==r.identity_sha256||r.tenant_id!==source.tenant_id||r.conversation_id!==source.conversation_id||r.run_id!==source.run_id||!same(r.identity.binding,source.projection.binding)||r.completion_id!==r.identity.completionId||r.checkpoint_id!==r.identity.checkpointId||!same(r.identity.sourceRequest,source.request)||r.identity.sourceRequestSha256!==source.request_sha256||r.identity.contextSha256!==hash({window:source.request.window,skill:source.request.skill,scopes:source.projection.scopes})||!same(r.identity.scopes,source.projection.scopes)||!same(r.identity.versions,source.projection.versions))fail('STORE_CORRUPT');if(r.state==='PUBLISHED'){if(hash(r.proof)!==r.proof_sha256)fail('STORE_CORRUPT');validateCompletionProof(r.proof,r.identity);}return r;}
 const projected=r=>({binding:r.projection.binding,state:r.projection.state,requestId:r.request_id,sequenceBase:Number(r.sequence_base),lastSequence:Number(r.last_sequence),sequenceEnd:r.sequence_end==null?null:Number(r.sequence_end),scopes:r.projection.scopes,policyRevision:r.projection.policyRevision,versions:r.projection.versions,createdAt:r.projection.createdAt});
 async function conversationRows(c,k,check){const rows=(await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[k.tenantId,k.conversationId])).rows.map(rowRun);check();return rows;}
 function orderedRuns(rows){const runs=rows.map(projected).sort((a,b)=>a.binding.writerFence-b.binding.writerFence);
  for(let i=0;i<runs.length;i++){if(!Number.isSafeInteger(runs[i].sequenceBase)||runs[i].sequenceBase<0||runs.some((o,j)=>j!==i&&o.binding.writerFence===runs[i].binding.writerFence))fail('STORE_CORRUPT');if(i===0?runs[i].sequenceBase!==0:runs[i].sequenceBase!==runs[i-1].sequenceEnd)fail('STORE_CORRUPT');}
  return runs;}
 async function conversationRuns(c,k,check){return orderedRuns(await conversationRows(c,k,check));}
 /** The conversation's latest published completion checkpoint among its locked run rows up to `through` (fence order), each verified
  * against its own run, which publication completed; null when none. */
 async function publishedThrough(c,rows,through,check){
  const runs=new Map(rows.map(r=>[r.run_id,r]));let latest=null;
  const published=(await c.query("SELECT * FROM meri_conversations.completion_checkpoints WHERE tenant_id=$1 AND conversation_id=$2 AND state='PUBLISHED'",[through.tenantId,through.conversationId])).rows;check();
  for(const cp of published){const run=runs.get(cp.run_id);if(!run||run.projection.state!=='completed')fail('STORE_CORRUPT');completion(cp,run);
   const fence=run.projection.binding.writerFence;if(fence<=through.writerFence&&(!latest||fence>latest.run.projection.binding.writerFence))latest={row:cp,run};}
  return latest;}
 /** Conversation-wide view: every run in fence order with its durable sequence base, plus its next-PROMPT reservations. A lifecycle
  * resume's mapping (`recordContinuationReservation`) is not one: its target continues the checkpointed source, so it is served
  * per target (`readTarget`, `current`, `execution`) and never counted here as a new prompt. */
 async function listRuns(value,check){const k=key(value);return tx(k,check,async c=>{const rows=await conversationRows(c,k,check),runs=orderedRuns(rows),continuations=new Set(rows.filter(r=>r.continuation!=null).map(r=>r.run_id));const reservations=(await c.query('SELECT * FROM meri_conversations.next_runs WHERE tenant_id=$1 AND conversation_id=$2',[k.tenantId,k.conversationId])).rows.map(row);check();return {runs,reservations:reservations.filter(r=>!continuations.has(r.target.runId)).map(r=>({source:r.source,target:r.target,state:r.state}))};});}
 /** Only a genuine atomically published completion checkpoint can seed a new prompt: the conversation's latest as of this run (its own
  * when it completed), or null when no turn up to it completed. */
 async function latestCheckpoint(binding,check){const b=bounded(binding);validateShape('RunBinding',b);return tx(b,check,async c=>{const rows=await conversationRows(c,b,check),run=rows.find(r=>r.run_id===b.runId);if(!run||!same(run.projection.binding,b))fail('STALE_WRITER');
  const latest=await publishedThrough(c,rows,b,check);return latest&&{checkpointId:latest.row.checkpoint_id,proofSha256:latest.row.proof_sha256};});}
 /** Under the conversation lock: the source must be the latest run and terminal with a retired allocation and revoked grants (or, failed or
  * cancelled before any claim, its no-authority evidence), naming the conversation's latest published checkpoint (a completed source's own). One reservation per source, recovered unchanged after a lost acknowledgement. */
 async function reserve({source,target,facts:rawFacts,scopes,versions,policyRevision,reservedAt},check){
  source=bounded(source);target=bounded(target);validateShape('RunBinding',source);validateShape('RunBinding',target);validateShape('RuntimeVersions',versions);scopes=bounded(scopes);
  if(target.tenantId!==source.tenantId||target.actorId!==source.actorId||target.conversationId!==source.conversationId||target.runId===source.runId||target.attemptId===source.attemptId||target.workerId===source.workerId||target.writerFence!==source.writerFence+1)fail('NEXT_RUN_TARGET_REFUSED');
  const f=facts(rawFacts);if(typeof policyRevision!=='string'||!policyRevision||typeof reservedAt!=='string'||Number.isNaN(Date.parse(reservedAt)))fail('NEXT_RUN_FACTS_REFUSED');
  return tx(source,check,async c=>{
   const rows=await conversationRows(c,source,check),runs=orderedRuns(rows);if(!runs.length)fail('STORE_CORRUPT');const latest=runs.at(-1);
   if(!same(latest.binding,source))fail('NEXT_RUN_NOT_LATEST');if(!admitsNextRun(latest.state))fail('NEXT_RUN_SOURCE_NOT_TERMINAL');
   // The successor runs under the current deployment's versions (the owner's), which may postdate the source's: a run's image is its own.
   if(!same(latest.scopes,scopes)||latest.policyRevision!==policyRevision)fail('NEXT_RUN_SCOPE_REFUSED');
   // The named checkpoint must be the conversation's latest published one: a completed source's own; a failed or cancelled source's
   // last completed turn's, published under the same scopes and policy (its run, never the source, is the lineage), and its SDK session
   // resumable under the successor's versions (session-continuity.mjs: a deploy that changed only image or skills digests still is).
   const lineage=await publishedThrough(c,rows,source,check),run=lineage?.run.projection;
   if(latest.state==='completed'&&lineage?.run.run_id!==source.runId)fail('NEXT_RUN_CHECKPOINT_REQUIRED');
   if(lineage===null?f.checkpoint!==null:f.checkpoint===null)fail(lineage===null?'NEXT_RUN_CHECKPOINT_REFUSED':'NEXT_RUN_CHECKPOINT_REQUIRED');
   if(lineage&&(f.checkpoint.checkpointId!==lineage.row.checkpoint_id||f.checkpoint.proofSha256!==lineage.row.proof_sha256))fail('NEXT_RUN_CHECKPOINT_REFUSED');
   if(lineage&&(!same(run.scopes,scopes)||run.policyRevision!==policyRevision))fail('NEXT_RUN_SCOPE_REFUSED');
   const discontinuity=lineage&&sessionDiscontinuity(run.versions,versions);if(discontinuity)fail(discontinuity);
   const existing=(await c.query('SELECT * FROM meri_conversations.next_runs WHERE tenant_id=$1 AND conversation_id=$2 AND source_run_id=$3 FOR UPDATE',[source.tenantId,source.conversationId,source.runId])).rows;check();
   if(existing.length){const r=row(existing[0]);if(r.state!=='RESERVED')fail('STORE_CORRUPT');if(!same(r.facts,f)||!same(r.scopes,scopes)||r.policyRevision!==policyRevision)fail('NEXT_RUN_REPLAY_REFUSED');return {target:r.target,state:r.state,replayed:true};}
   if(runs.some(r=>r.binding.runId===target.runId||r.binding.attemptId===target.attemptId||r.binding.workerId===target.workerId))fail('NEXT_RUN_TARGET_REFUSED');
   const allocation=(await c.query('SELECT * FROM meri_conversations.native_allocations WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[source.tenantId,source.conversationId,source.runId])).rows;check();
   if(allocation.length!==1||hash(allocation[0].record)!==allocation[0].record_sha256)fail('NEXT_RUN_RETIREMENT_REQUIRED');const a=allocation[0].record;
   // A missing row is never safe: no-authority admission needs the foreclosure row written with the source's own terminal transition.
   if(f.noAuthority){if(a.state!==FORECLOSED||!foreclosed(a,source)||a.foreclosure.state!==latest.state||allocation[0].record_sha256!==f.noAuthority.foreclosureSha256)fail('NEXT_RUN_RETIREMENT_REQUIRED');}
   else{if(a.state!=='RETIRED'||a.resource?.physicalStopProven!==true)fail('NEXT_RUN_RETIREMENT_REQUIRED');
    if(!same([...f.revocation.grantIds].sort(),a.grantIntents.map(g=>g.grantId).sort()))fail('NEXT_RUN_REVOCATION_REQUIRED');}
   const reservation=assertNextRunReservation({source,target,facts:f,scopes,versions:bounded(versions),policyRevision,reservedAt});
   await c.query('INSERT INTO meri_conversations.next_runs(tenant_id,conversation_id,source_run_id,target_run_id,reservation,reservation_sha256,state) VALUES($1,$2,$3,$4,$5,$6,$7)',[source.tenantId,source.conversationId,source.runId,target.runId,reservation,hash(reservation),'RESERVED']);check();
   return {target,state:'RESERVED',replayed:false};
  });
 }
 /** Resolves authority and reservation under one conversation lock. */
 async function current(binding,check){const b=bounded(binding);validateShape('RunBinding',b);return tx(b,check,async c=>{
  const runs=await conversationRuns(c,b,check),latest=runs.at(-1);
  const rows=(await c.query('SELECT * FROM meri_conversations.next_runs WHERE tenant_id=$1 AND conversation_id=$2 AND target_run_id=$3',[b.tenantId,b.conversationId,b.runId])).rows;check();
  if(rows.length>1)fail('STORE_CORRUPT');const r=rows.length?row(rows[0]):null;if(r&&!same(r.target,b))fail('STALE_WRITER');
  if(r?.state==='RESERVED'&&latest&&same(r.source,latest.binding)&&admitsNextRun(latest.state))return {binding:r.target,reserved:true,policyRevision:r.policyRevision,scopes:r.scopes};
  if(!latest||!same(latest.binding,b))fail('NEXT_RUN_NOT_LATEST');
  return {binding:latest.binding,reserved:false,policyRevision:latest.policyRevision,scopes:latest.scopes};
 });}
 /** The store's no-authority evidence for this run ({foreclosureSha256}), or null when its allocation row is absent or anything else. */
 async function foreclosure(binding,check){const b=bounded(binding);validateShape('RunBinding',b);return tx(b,check,async c=>{const rows=(await c.query('SELECT * FROM meri_conversations.native_allocations WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[b.tenantId,b.conversationId,b.runId])).rows;check();
  if(rows.length!==1||hash(rows[0].record)!==rows[0].record_sha256||!foreclosed(rows[0].record,b))return null;return {foreclosureSha256:rows[0].record_sha256};});}
 /** The reservation whose target is this binding, or null. A stale binding of the conversation is a stale writer. */
 async function readTarget(binding,check){const b=bounded(binding);validateShape('RunBinding',b);return tx(b,check,async c=>{const rows=(await c.query('SELECT * FROM meri_conversations.next_runs WHERE tenant_id=$1 AND conversation_id=$2 AND target_run_id=$3',[b.tenantId,b.conversationId,b.runId])).rows;check();if(!rows.length)return null;if(rows.length!==1)fail('STORE_CORRUPT');const r=row(rows[0]);if(!same(r.target,b))fail('STALE_WRITER');return r;});}
 /** Accepts the new prompt for a reserved target: same conversation row, continued conversation-wide sequence base, per-run wire sequence restarting at 1. */
 async function accept({conversation,run,request,event},check){
  validateShape('Conversation',conversation);assertRun(run);const b=run.binding;request=bounded(request);
  if(conversation.owner.tenantId!==b.tenantId||conversation.owner.actorId!==b.actorId||conversation.conversationId!==b.conversationId||!same(conversation.scopes,run.scopes)||conversation.policyRevision!==run.policyRevision||run.state!=='queued')fail('CONVERSATION_BINDING_REFUSED');
  return tx(b,check,async c=>{
   const old=(await c.query('SELECT * FROM meri_conversations.conversations WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[b.tenantId,b.conversationId])).rows[0];check();
   if(!old||hash(old.projection)!==old.projection_sha256||old.owner_actor_id!==b.actorId||!same({...old.projection,createdAt:conversation.createdAt},conversation))fail('CONVERSATION_SCOPE_REFUSED');
   const reserved=(await c.query('SELECT * FROM meri_conversations.next_runs WHERE tenant_id=$1 AND conversation_id=$2 AND target_run_id=$3 FOR UPDATE',[b.tenantId,b.conversationId,b.runId])).rows;check();
   if(reserved.length!==1)fail('NEXT_RUN_NOT_RESERVED');const r=row(reserved[0]);if(!same(r.target,b)||!same(r.scopes,run.scopes)||r.policyRevision!==run.policyRevision)fail('NEXT_RUN_SCOPE_REFUSED');
   // A successor reserved before a deploy is accepted under the accepting render's versions (a run's image is its own); the checkpoint it
   // names must still resume there (session-continuity.mjs), refused here rather than persisted for its execution to refuse.
   if(r.facts.checkpoint!==null&&!same(r.versions,run.versions)){const named=(await c.query("SELECT * FROM meri_conversations.completion_checkpoints WHERE tenant_id=$1 AND conversation_id=$2 AND state='PUBLISHED'",[b.tenantId,b.conversationId])).rows.filter(x=>x.checkpoint_id===r.facts.checkpoint.checkpointId);check();
    if(named.length!==1||named[0].proof_sha256!==r.facts.checkpoint.proofSha256||hash(named[0].proof)!==named[0].proof_sha256)fail('STORE_CORRUPT');const discontinuity=sessionDiscontinuity(named[0].proof.checkpoint.versions,run.versions);if(discontinuity)fail(discontinuity);}
   const latest=(await conversationRuns(c,b,check)).at(-1);if(!latest||!(same(latest.binding,r.source)&&r.state==='RESERVED'||same(latest.binding,b)&&r.state==='ACCEPTED'))fail('NEXT_RUN_NOT_LATEST');
   const existing=(await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND (request_id=$3 OR run_id=$4) FOR UPDATE',[b.tenantId,b.conversationId,request.requestId,b.runId])).rows;check();
   if(existing.length){const e=rowRun(existing[0]);if(existing.length!==1||e.request_id!==request.requestId||!same({...e.request,window:request.window},request)||!same(e.projection.binding,b)||!same(e.projection.versions,run.versions))fail('REQUEST_REPLAY_REFUSED');return {run:e.projection,request:e.request,lastSequence:Number(e.last_sequence),replayed:true};}
   const source=rowRun((await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',[b.tenantId,b.conversationId,r.source.runId])).rows[0]);check();
   if(!admitsNextRun(source.projection.state)||source.projection.state==='completed'&&r.facts.checkpoint===null||!same(source.projection.binding,r.source))fail('NEXT_RUN_SOURCE_REFUSED');
   const sequenceBase=await closeSequenceRange(c,r.source,rowRun,check);
   validateShape('UIEvent',event);if(!same(event.binding,b)||!same(event.scopes,run.scopes)||event.sequence!==1||event.type!=='run.status'||event.data.state!=='queued')fail('EVENT_BINDING_REFUSED');
   await c.query('INSERT INTO meri_conversations.runs(tenant_id,conversation_id,run_id,projection,projection_sha256,request_id,request,request_sha256,last_sequence,sequence_base) VALUES($1,$2,$3,$4,$5,$6,$7,$8,1,$9)',[b.tenantId,b.conversationId,b.runId,run,hash(run),request.requestId,request,hash(request),sequenceBase]);check();
   await c.query('INSERT INTO meri_conversations.events(tenant_id,conversation_id,run_id,sequence,event_id,event,event_sha256) VALUES($1,$2,$3,$4,$5,$6,$7)',[b.tenantId,b.conversationId,b.runId,1,event.eventId,event,hash(event)]);check();
   await c.query("UPDATE meri_conversations.next_runs SET state='ACCEPTED' WHERE tenant_id=$1 AND conversation_id=$2 AND target_run_id=$3",[b.tenantId,b.conversationId,b.runId]);check();
   return {run,request,lastSequence:1,replayed:false,sequenceBase};
  });
 }
 /** Explicit next-prompt lineage; this never constructs a lifecycle resume envelope. The reserved checkpoint, re-verified as the
  * conversation's latest published one as of the source, against its own completed run: that run's request is the source request.
  * Null when the reservation names none (no completed turn yet, or a lifecycle resume's mapping). */
 async function execution({binding:b,scopes,selectedClientId},check){validateShape('RunBinding',b);uuid(selectedClientId);return tx(b,check,async c=>{
  const target=rowRun((await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',[b.tenantId,b.conversationId,b.runId])).rows[0]);check();if(!same(target.projection.binding,b)||!same(target.projection.scopes,scopes))fail('STALE_WRITER');
  const rows=(await c.query('SELECT * FROM meri_conversations.next_runs WHERE tenant_id=$1 AND conversation_id=$2 AND target_run_id=$3',[b.tenantId,b.conversationId,b.runId])).rows;check();if(!rows.length)return null;if(rows.length!==1)fail('STORE_CORRUPT');const r=row(rows[0]);
  if(r.state!=='ACCEPTED'||!same(r.target,b)||!same(r.scopes,scopes))fail('STORE_CORRUPT');
  const runRows=await conversationRows(c,b,check),source=runRows.find(x=>x.run_id===r.source.runId);if(!source||!same(source.projection.binding,r.source))fail('STORE_CORRUPT');
  const resumed=continued(source,target);if(!(admitsNextRun(source.projection.state)||resumed)||source.projection.state==='completed'&&r.facts.checkpoint===null||resumed&&r.facts.checkpoint!==null)fail('STORE_CORRUPT');if(r.facts.checkpoint===null)return null;
  const lineage=await publishedThrough(c,runRows,r.source,check),cp=lineage?.row,from=lineage?.run,p=cp?.proof;
  if(!lineage||cp.checkpoint_id!==r.facts.checkpoint.checkpointId||cp.proof_sha256!==r.facts.checkpoint.proofSha256||source.projection.state==='completed'&&from.run_id!==source.run_id||cp.identity.selectedClientId!==selectedClientId||p.sourceRequestSha256!==from.request_sha256||p.contextSha256!==hash({window:from.request.window,skill:from.request.skill,scopes})||!same(p.checkpoint.binding,from.projection.binding)||!same(p.checkpoint.scopes,scopes)||!continuesSession(p.checkpoint.versions,target.projection.versions))fail('STORE_CORRUPT');
  return {nextTurn:{checkpoint:p.checkpoint,checkpointSha256:p.checkpointSha256,sourceRequestSha256:p.sourceRequestSha256,contextSha256:p.contextSha256,sourceRequest:from.request,targetBinding:b,resumeSessionAt:p.resumeSessionAt}};
 });}
 return Object.freeze({listRuns,latestCheckpoint,foreclosure,reserve,readTarget,current,accept,execution});
}
