/** Historical native SDK data, read only under the caller's conversation transaction.
 * The target's current authority authorizes access; an expired source owner is provenance only. */
import {hash,same,fail,own,uuid} from './boundary.mjs';
import {assertSdkSessionKey,assertNativeSessionReference,assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {copySessionTranscript,scopedSessionKey} from '../../worker/qualification/checkpoint/bound-session-store.mjs';
import {readExecutionSettlement,executionIdentity,readLegacySettlement,decodeExecutionRow} from './execution-boundary.mjs';
const integer=value=>{const n=typeof value==='string'&&/^(0|[1-9][0-9]*)$/u.test(value)?Number(value):value;if(!Number.isSafeInteger(n)||n<0)fail('STORE_CORRUPT');return n;};
export async function nativeSessionThrough(c,rows,through,check){
 const run=rows.filter(r=>r.projection.state==='completed'&&r.projection.binding.writerFence<=through.writerFence).sort((a,b)=>b.projection.binding.writerFence-a.projection.binding.writerFence)[0];
 if(!run)return null;
 return nativeSessionForRun(c,run,check);
}
/** Explicit source selection for a held run; ordinary follow-up remains completed-only. */
export async function nativeSessionForRun(c,run,check){
 const b=run.projection.binding,found=(await c.query('SELECT * FROM meri_conversations.sdk_sessions WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',[b.tenantId,b.conversationId,b.runId])).rows;check();
 if(!found.length)return null;if(found.length!==1)fail('STORE_CORRUPT');const row=found[0];
 const owner=own(row.owner,['binding','scopes','selectedClientId','policyRevision','key','expiresAtMs'],['executionSha256','allocationSha256','observationId','sessionEventSha256']),key=assertSdkSessionKey(owner.key,{main:true});
 if(Object.hasOwn(owner,'executionSha256')===Object.hasOwn(owner,'allocationSha256')||! /^[a-f0-9]{64}$/u.test(owner.executionSha256??owner.allocationSha256))fail('STORE_CORRUPT');
 assertNativeConversationScope(owner);
 if(row.owner_sha256!==hash(owner)||row.tenant_id!==b.tenantId||row.conversation_id!==b.conversationId||row.run_id!==b.runId||row.session_id!==key.sessionId||row.project_key!==key.projectKey||!same(owner.binding,b)||!same(owner.scopes,run.projection.scopes)||owner.policyRevision!==run.projection.policyRevision||!Number.isSafeInteger(owner.expiresAtMs)||owner.expiresAtMs<1)fail('STORE_CORRUPT');
 const reference=assertNativeSessionReference({binding:b,key,ownerSha256:row.owner_sha256,entriesCount:integer(row.entries_count)});
 return {run,row,reference};
}
/** A capture is made by the current SDK invocation after local drain/flush. Its
 * writer remains active until the runtime separately records settled. */
export async function assertNativeSessionCapturable(c,lineage,check,now=Date.now){
 if(!Object.hasOwn(lineage.row.owner,'executionSha256'))fail('CHECKPOINT_REFUSED');
 const b=lineage.reference.binding,rows=(await c.query('SELECT * FROM meri_conversations.native_executions WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',[b.tenantId,b.conversationId,b.runId])).rows;check();
 if(rows.length!==1)fail('CHECKPOINT_REFUSED');const execution=decodeExecutionRow(rows[0],b);
 if(!['launching','unknown','started'].includes(execution.phase)||execution.expiresAtMs<=now()||hash(executionIdentity(execution))!==lineage.row.owner.executionSha256)fail('CHECKPOINT_REFUSED');
 return execution;
}
export async function assertNativeSessionSettled(c,lineage,check){
 // Read-only compatibility for already-stored SDK history. No old allocator, grant issuer or ECS operation is composed.
 if(Object.hasOwn(lineage.row.owner,'allocationSha256')){
  const executions=(await c.query('SELECT * FROM meri_conversations.native_executions WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',[lineage.reference.binding.tenantId,lineage.reference.binding.conversationId,lineage.reference.binding.runId])).rows;check();
  if(executions.length)fail('NEXT_RUN_EXECUTION_UNSETTLED');
  const saved=await readLegacySettlement(c,lineage.reference.binding,check);
  if(saved?.record.state!=='RETIRED'||saved.record.allocationSha256!==lineage.row.owner.allocationSha256)fail('NEXT_RUN_EXECUTION_UNSETTLED');
  return {recordSha256:saved.recordSha256};
 }
 const settled=await readExecutionSettlement(c,lineage.reference.binding,lineage.run.projection.state,check);
 if(!settled||hash(executionIdentity(settled.record))!==lineage.row.owner.executionSha256)fail('NEXT_RUN_EXECUTION_UNSETTLED');
 return {recordSha256:settled.recordSha256};
}
export async function nativeSessionTranscripts(c,lineage,check){
 const {reference:r,row}=lineage,b=r.binding,args=[b.tenantId,b.conversationId,b.runId,r.key.sessionId];
 const streams=(await c.query('SELECT * FROM meri_conversations.sdk_session_streams WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 AND session_id=$4 ORDER BY subpath',args)).rows;check();
 if(!streams.length||streams.length>256||new Set(streams.map(s=>s.subpath)).size!==streams.length||!streams.some(s=>s.subpath===''&&integer(s.last_sequence)>0))fail('STORE_CORRUPT');
 const tuple=(v,subpath)=>{if(v.tenant_id!==b.tenantId||v.conversation_id!==b.conversationId||v.run_id!==b.runId||v.session_id!==r.key.sessionId||v.subpath!==subpath)fail('STORE_CORRUPT');};
 let count=0,bytes=0;const transcripts=[];
 for(const stream of streams){const subpath=stream.subpath;tuple(stream,subpath);if(subpath!=='')scopedSessionKey({...r.key,subpath},r.key);
  const entries=(await c.query('SELECT * FROM meri_conversations.sdk_session_entries WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 AND session_id=$4 AND subpath=$5 ORDER BY sequence',[...args,subpath])).rows;check();let sequence=0;const uuids=new Set();
  for(const entry of entries){tuple(entry,subpath);if(integer(entry.sequence)!==++sequence||entry.entry_sha256!==hash(entry.entry)||entry.entry_uuid!==(entry.entry.uuid??null)||entry.entry_uuid!==null&&uuids.has(entry.entry_uuid))fail('STORE_CORRUPT');if(entry.entry_uuid!==null)uuids.add(entry.entry_uuid);bytes+=Buffer.byteLength(JSON.stringify(entry.entry));if(++count>100000||bytes>33554432)fail('STORE_CORRUPT');}
  if(sequence!==integer(stream.last_sequence))fail('STORE_CORRUPT');transcripts.push({...subpath?{subpath}:{},entries:copySessionTranscript(entries.map(e=>e.entry))});
 }
 if(count!==r.entriesCount||bytes!==integer(row.bytes))fail('STORE_CORRUPT');return transcripts;
}
