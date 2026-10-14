/** Next-turn reservations: a new prompt in the same conversation, never a recovery of the old one. One immutable mapping per completed source run. */
import {assertRun,bounded,hash,same,fail,validateShape,uuid,own} from './boundary.mjs';
import {validateCompletionProof} from './completion-journal.mjs';
import {closeSequenceRange} from './sequence-ranges.mjs';
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
export function createNextRunJournal({tx,rowRun}){
 const row=r=>{if(!r||hash(r.reservation)!==r.reservation_sha256)fail('STORE_CORRUPT');const v=r.reservation;if(r.source_run_id!==v.source.runId||r.target_run_id!==v.target.runId||r.tenant_id!==v.target.tenantId||r.conversation_id!==v.target.conversationId||!['RESERVED','ACCEPTED'].includes(r.state))fail('STORE_CORRUPT');return {...v,state:r.state};};
 const key=value=>{const k=bounded(value);own(k,['tenantId','conversationId']);uuid(k.conversationId);if(typeof k.tenantId!=='string'||!k.tenantId||k.tenantId.length>256)fail('INVALID_REQUEST');return k;};
 function facts(value){const f=bounded(value);own(f,['checkpoint','retirement','revocation']);own(f.checkpoint,['checkpointId','proofSha256']);own(f.retirement,['physicalStopProven']);own(f.revocation,['receiptSha256','grantIds']);uuid(f.checkpoint.checkpointId);
  if(!digest(f.checkpoint.proofSha256)||f.retirement.physicalStopProven!==true||!digest(f.revocation.receiptSha256)||!Array.isArray(f.revocation.grantIds)||!f.revocation.grantIds.length||f.revocation.grantIds.length>64||f.revocation.grantIds.some(g=>typeof g!=='string'||!g||g.length>256))fail('NEXT_RUN_FACTS_REFUSED');return f;}
 function completion(r,source){if(!r||hash(r.identity)!==r.identity_sha256||r.tenant_id!==source.tenant_id||r.conversation_id!==source.conversation_id||r.run_id!==source.run_id||!same(r.identity.binding,source.projection.binding)||r.completion_id!==r.identity.completionId||r.checkpoint_id!==r.identity.checkpointId||!same(r.identity.sourceRequest,source.request)||r.identity.sourceRequestSha256!==source.request_sha256||r.identity.contextSha256!==hash({window:source.request.window,skill:source.request.skill,scopes:source.projection.scopes})||!same(r.identity.scopes,source.projection.scopes)||!same(r.identity.versions,source.projection.versions))fail('STORE_CORRUPT');if(r.state==='PUBLISHED'){if(hash(r.proof)!==r.proof_sha256)fail('STORE_CORRUPT');validateCompletionProof(r.proof,r.identity);}return r;}
 const projected=r=>({binding:r.projection.binding,state:r.projection.state,requestId:r.request_id,sequenceBase:Number(r.sequence_base),lastSequence:Number(r.last_sequence),sequenceEnd:r.sequence_end==null?null:Number(r.sequence_end),scopes:r.projection.scopes,policyRevision:r.projection.policyRevision,versions:r.projection.versions,createdAt:r.projection.createdAt});
 async function conversationRuns(c,k,check){const runs=(await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[k.tenantId,k.conversationId])).rows.map(rowRun).map(projected).sort((a,b)=>a.binding.writerFence-b.binding.writerFence);check();
  for(let i=0;i<runs.length;i++){if(!Number.isSafeInteger(runs[i].sequenceBase)||runs[i].sequenceBase<0||runs.some((o,j)=>j!==i&&o.binding.writerFence===runs[i].binding.writerFence))fail('STORE_CORRUPT');if(i===0?runs[i].sequenceBase!==0:runs[i].sequenceBase!==runs[i-1].sequenceEnd)fail('STORE_CORRUPT');}
  return runs;}
 /** Conversation-wide view: every run in fence order with its durable sequence base, plus reservations. */
 async function listRuns(value,check){const k=key(value);return tx(k,check,async c=>{const runs=await conversationRuns(c,k,check);const reservations=(await c.query('SELECT * FROM meri_conversations.next_runs WHERE tenant_id=$1 AND conversation_id=$2',[k.tenantId,k.conversationId])).rows.map(row);check();return {runs,reservations:reservations.map(r=>({source:r.source,target:r.target,state:r.state}))};});}
 /** Only a genuine atomically published completion checkpoint can seed a new prompt. */
 async function latestCheckpoint(binding,check){const b=bounded(binding);validateShape('RunBinding',b);return tx(b,check,async c=>{const rows=(await c.query('SELECT * FROM meri_conversations.completion_checkpoints WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',[b.tenantId,b.conversationId,b.runId])).rows;check();if(!rows.length)return null;if(rows.length!==1)fail('STORE_CORRUPT');const source=rowRun((await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',[b.tenantId,b.conversationId,b.runId])).rows[0]);check();const r=completion(rows[0],source);if(!same(source.projection.binding,b))fail('STALE_WRITER');if(r.state!=='PUBLISHED')return null;return {checkpointId:r.checkpoint_id,proofSha256:r.proof_sha256};});}
 /** Under the conversation lock: the source must be the latest run and completed, with a captured checkpoint and a retired allocation; one reservation per source, recovered unchanged after a lost acknowledgement. */
 async function reserve({source,target,facts:rawFacts,scopes,versions,policyRevision,reservedAt},check){
  source=bounded(source);target=bounded(target);validateShape('RunBinding',source);validateShape('RunBinding',target);validateShape('RuntimeVersions',versions);scopes=bounded(scopes);
  if(target.tenantId!==source.tenantId||target.actorId!==source.actorId||target.conversationId!==source.conversationId||target.runId===source.runId||target.attemptId===source.attemptId||target.workerId===source.workerId||target.writerFence!==source.writerFence+1)fail('NEXT_RUN_TARGET_REFUSED');
  const f=facts(rawFacts);if(typeof policyRevision!=='string'||!policyRevision||typeof reservedAt!=='string'||Number.isNaN(Date.parse(reservedAt)))fail('NEXT_RUN_FACTS_REFUSED');
  return tx(source,check,async c=>{
   const runs=await conversationRuns(c,source,check);if(!runs.length)fail('STORE_CORRUPT');const latest=runs.at(-1);
   if(!same(latest.binding,source))fail('NEXT_RUN_NOT_LATEST');if(latest.state!=='completed')fail('NEXT_RUN_SOURCE_NOT_COMPLETED');
   if(!same(latest.scopes,scopes)||latest.policyRevision!==policyRevision||!same(latest.versions,versions))fail('NEXT_RUN_SCOPE_REFUSED');
   const existing=(await c.query('SELECT * FROM meri_conversations.next_runs WHERE tenant_id=$1 AND conversation_id=$2 AND source_run_id=$3 FOR UPDATE',[source.tenantId,source.conversationId,source.runId])).rows;check();
   if(existing.length){const r=row(existing[0]);if(r.state!=='RESERVED')fail('STORE_CORRUPT');if(!same(r.facts,f)||!same(r.scopes,scopes)||r.policyRevision!==policyRevision)fail('NEXT_RUN_REPLAY_REFUSED');return {target:r.target,state:r.state,replayed:true};}
   if(runs.some(r=>r.binding.runId===target.runId||r.binding.attemptId===target.attemptId||r.binding.workerId===target.workerId))fail('NEXT_RUN_TARGET_REFUSED');
   const checkpoint=(await c.query('SELECT * FROM meri_conversations.completion_checkpoints WHERE tenant_id=$1 AND checkpoint_id=$2 AND conversation_id=$3 AND run_id=$4',[source.tenantId,f.checkpoint.checkpointId,source.conversationId,source.runId])).rows;check();
   if(checkpoint.length!==1||checkpoint[0].state!=='PUBLISHED'||hash(checkpoint[0].identity)!==checkpoint[0].identity_sha256||!same(checkpoint[0].identity.binding,source)||checkpoint[0].proof_sha256!==f.checkpoint.proofSha256||hash(checkpoint[0].proof)!==checkpoint[0].proof_sha256)fail('NEXT_RUN_CHECKPOINT_REQUIRED');
   const sourceRow=rowRun((await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',[source.tenantId,source.conversationId,source.runId])).rows[0]);check();completion(checkpoint[0],sourceRow);
   const allocation=(await c.query('SELECT * FROM meri_conversations.native_allocations WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[source.tenantId,source.conversationId,source.runId])).rows;check();
   if(allocation.length!==1||hash(allocation[0].record)!==allocation[0].record_sha256||allocation[0].record.state!=='RETIRED'||allocation[0].record.resource?.physicalStopProven!==true)fail('NEXT_RUN_RETIREMENT_REQUIRED');
   if(!same([...f.revocation.grantIds].sort(),allocation[0].record.grantIntents.map(g=>g.grantId).sort()))fail('NEXT_RUN_REVOCATION_REQUIRED');
   const reservation={source,target,facts:f,scopes,versions:bounded(versions),policyRevision,reservedAt};
   await c.query('INSERT INTO meri_conversations.next_runs(tenant_id,conversation_id,source_run_id,target_run_id,reservation,reservation_sha256,state) VALUES($1,$2,$3,$4,$5,$6,$7)',[source.tenantId,source.conversationId,source.runId,target.runId,reservation,hash(reservation),'RESERVED']);check();
   return {target,state:'RESERVED',replayed:false};
  });
 }
 /** Resolves authority and reservation under one conversation lock. */
 async function current(binding,check){const b=bounded(binding);validateShape('RunBinding',b);return tx(b,check,async c=>{
  const runs=await conversationRuns(c,b,check),latest=runs.at(-1);
  const rows=(await c.query('SELECT * FROM meri_conversations.next_runs WHERE tenant_id=$1 AND conversation_id=$2 AND target_run_id=$3',[b.tenantId,b.conversationId,b.runId])).rows;check();
  if(rows.length>1)fail('STORE_CORRUPT');const r=rows.length?row(rows[0]):null;if(r&&!same(r.target,b))fail('STALE_WRITER');
  if(r?.state==='RESERVED'&&latest&&same(r.source,latest.binding)&&latest.state==='completed')return {binding:r.target,reserved:true,policyRevision:r.policyRevision,scopes:r.scopes};
  if(!latest||!same(latest.binding,b))fail('NEXT_RUN_NOT_LATEST');
  return {binding:latest.binding,reserved:false,policyRevision:latest.policyRevision,scopes:latest.scopes};
 });}
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
   if(reserved.length!==1)fail('NEXT_RUN_NOT_RESERVED');const r=row(reserved[0]);if(!same(r.target,b)||!same(r.scopes,run.scopes)||r.policyRevision!==run.policyRevision||!same(r.versions,run.versions))fail('NEXT_RUN_SCOPE_REFUSED');
   const latest=(await conversationRuns(c,b,check)).at(-1);if(!latest||!(same(latest.binding,r.source)&&r.state==='RESERVED'||same(latest.binding,b)&&r.state==='ACCEPTED'))fail('NEXT_RUN_NOT_LATEST');
   const existing=(await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND (request_id=$3 OR run_id=$4) FOR UPDATE',[b.tenantId,b.conversationId,request.requestId,b.runId])).rows;check();
   if(existing.length){const e=rowRun(existing[0]);if(existing.length!==1||e.request_id!==request.requestId||!same({...e.request,window:request.window},request)||!same(e.projection.binding,b)||!same(e.projection.versions,run.versions))fail('REQUEST_REPLAY_REFUSED');return {run:e.projection,request:e.request,lastSequence:Number(e.last_sequence),replayed:true};}
   const source=rowRun((await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',[b.tenantId,b.conversationId,r.source.runId])).rows[0]);check();
   if(source.projection.state!=='completed'||!same(source.projection.binding,r.source))fail('NEXT_RUN_SOURCE_REFUSED');
   const sequenceBase=await closeSequenceRange(c,r.source,rowRun,check);
   validateShape('UIEvent',event);if(!same(event.binding,b)||!same(event.scopes,run.scopes)||event.sequence!==1||event.type!=='run.status'||event.data.state!=='queued')fail('EVENT_BINDING_REFUSED');
   await c.query('INSERT INTO meri_conversations.runs(tenant_id,conversation_id,run_id,projection,projection_sha256,request_id,request,request_sha256,last_sequence,sequence_base) VALUES($1,$2,$3,$4,$5,$6,$7,$8,1,$9)',[b.tenantId,b.conversationId,b.runId,run,hash(run),request.requestId,request,hash(request),sequenceBase]);check();
   await c.query('INSERT INTO meri_conversations.events(tenant_id,conversation_id,run_id,sequence,event_id,event,event_sha256) VALUES($1,$2,$3,$4,$5,$6,$7)',[b.tenantId,b.conversationId,b.runId,1,event.eventId,event,hash(event)]);check();
   await c.query("UPDATE meri_conversations.next_runs SET state='ACCEPTED' WHERE tenant_id=$1 AND conversation_id=$2 AND target_run_id=$3",[b.tenantId,b.conversationId,b.runId]);check();
   return {run,request,lastSequence:1,replayed:false,sequenceBase};
  });
 }
 /** Explicit next-prompt lineage; this never constructs a lifecycle resume envelope. */
 async function execution({binding:b,scopes,selectedClientId},check){validateShape('RunBinding',b);uuid(selectedClientId);return tx(b,check,async c=>{
  const target=rowRun((await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',[b.tenantId,b.conversationId,b.runId])).rows[0]);check();if(!same(target.projection.binding,b)||!same(target.projection.scopes,scopes))fail('STALE_WRITER');
  const rows=(await c.query('SELECT * FROM meri_conversations.next_runs WHERE tenant_id=$1 AND conversation_id=$2 AND target_run_id=$3',[b.tenantId,b.conversationId,b.runId])).rows;check();if(!rows.length)return null;if(rows.length!==1)fail('STORE_CORRUPT');const r=row(rows[0]);
  if(r.state!=='ACCEPTED'||!same(r.target,b)||!same(r.scopes,scopes)||!same(r.versions,target.projection.versions))fail('STORE_CORRUPT');
  const source=rowRun((await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',[b.tenantId,b.conversationId,r.source.runId])).rows[0]);
  const cpRows=(await c.query('SELECT * FROM meri_conversations.completion_checkpoints WHERE tenant_id=$1 AND checkpoint_id=$2 AND conversation_id=$3 AND run_id=$4',[b.tenantId,r.facts.checkpoint.checkpointId,b.conversationId,r.source.runId])).rows;check();const cp=cpRows[0],p=cp?.proof;
  if(cpRows.length!==1||cp.state!=='PUBLISHED'||hash(cp.identity)!==cp.identity_sha256||hash(p)!==cp.proof_sha256||cp.proof_sha256!==r.facts.checkpoint.proofSha256||cp.identity.selectedClientId!==selectedClientId||!same(cp.identity.binding,r.source)||!same(source.projection.binding,r.source)||!same(cp.identity.sourceRequest,source.request)||cp.identity.sourceRequestSha256!==source.request_sha256||p.sourceRequestSha256!==source.request_sha256||p.contextSha256!==hash({window:source.request.window,skill:source.request.skill,scopes})||!same(p.checkpoint.binding,r.source)||!same(p.checkpoint.scopes,scopes)||!same(p.checkpoint.versions,target.projection.versions))fail('STORE_CORRUPT');
  completion(cp,source);
  return {nextTurn:{checkpoint:p.checkpoint,checkpointSha256:p.checkpointSha256,sourceRequestSha256:p.sourceRequestSha256,contextSha256:p.contextSha256,sourceRequest:source.request,targetBinding:b,resumeSessionAt:p.resumeSessionAt}};
 });}
 return Object.freeze({listRuns,latestCheckpoint,reserve,readTarget,current,accept,execution});
}
