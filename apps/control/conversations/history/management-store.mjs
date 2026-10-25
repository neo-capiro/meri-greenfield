/** Metadata changes share the existing conversation exclusion with every run writer.
 * Retention is acquired by the caller first. No synthetic run or second journal. */
import {hash,same,validateShape,uuid,fail} from '../boundary.mjs';
import {decodeOwnedConversation} from './store.mjs';
import {orderedConversationRuns,admitsNextRun} from '../next-run-journal.mjs';
import {assertOriginalInputFacts} from '../initial-input-facts.mjs';
import {assertNextRunReservation} from '../next-run-reservation.mjs';
export function createConversationManagementStore({tx,rowRun,settlement,now}){
 const key=({principal,conversationId})=>{uuid(conversationId);if(typeof principal?.tenantId!=='string'||!principal.tenantId||typeof principal.actorId!=='string'||!principal.actorId||!Array.isArray(principal.clientIds))fail('CONVERSATION_SCOPE_REFUSED');return {tenantId:principal.tenantId,conversationId};};
 async function state(c,input,check){const k=key(input);
  const rows=(await c.query('SELECT * FROM meri_conversations.conversations WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[k.tenantId,k.conversationId])).rows;check();
  if(rows.length>1)fail('STORE_CORRUPT');const conversation=rows.length?decodeOwnedConversation(rows[0],input.principal):null;
  const runs=(await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[k.tenantId,k.conversationId])).rows.map(rowRun);check();
  if(runs.length&&!conversation)fail('STORE_CORRUPT');
  for(const r of runs){const b=r.projection.binding;if(b.tenantId!==k.tenantId||b.conversationId!==k.conversationId||b.actorId!==input.principal.actorId||!same(r.projection.scopes,conversation.scopes)||r.projection.policyRevision!==conversation.policyRevision)fail('STORE_CORRUPT');}
  const ordered=orderedConversationRuns(runs),latest=ordered.at(-1);let canManage=!latest||admitsNextRun(latest.state);
  if(canManage&&latest){try{await settlement(c,latest.binding,latest.state,check);}catch(error){if(error?.code==='NEXT_RUN_EXECUTION_UNSETTLED')canManage=false;else throw error;}}
  const inputs=(await c.query('SELECT * FROM meri_conversations.initial_inputs WHERE tenant_id=$1 AND conversation_id=$2',[k.tenantId,k.conversationId])).rows;check();
  for(const row of inputs){const f=assertOriginalInputFacts(row.allocation);
   if(hash(f)!==row.allocation_sha256||row.tenant_id!==k.tenantId||row.conversation_id!==k.conversationId||row.run_id!==f.binding.runId||row.request_id!==f.requestId||f.binding.actorId!==input.principal.actorId||f.binding.tenantId!==k.tenantId||f.binding.conversationId!==k.conversationId||!['RESERVED','ACCEPTED'].includes(row.state))fail('STORE_CORRUPT');
   if(row.state==='RESERVED'&&f.expiresAtMs>now())canManage=false;
  }
  const reservations=(await c.query('SELECT * FROM meri_conversations.next_runs WHERE tenant_id=$1 AND conversation_id=$2',[k.tenantId,k.conversationId])).rows;check();
  for(const row of reservations){const r=assertNextRunReservation(row.reservation);
   if(hash(r)!==row.reservation_sha256||row.tenant_id!==k.tenantId||row.conversation_id!==k.conversationId||row.source_run_id!==r.source.runId||row.target_run_id!==r.target.runId||r.source.actorId!==input.principal.actorId||r.source.tenantId!==k.tenantId||r.source.conversationId!==k.conversationId||!['RESERVED','ACCEPTED'].includes(row.state))fail('STORE_CORRUPT');
   if(row.state==='RESERVED')canManage=false;
  }
  return {conversation,hasTranscript:runs.length>0,canManage};
 }
 const inspect=(input,check)=>tx(key(input),check,c=>state(c,input,check));
 async function withConversation(input,work,check,lease){
  if(typeof work!=='function')fail('STORE_CONFIGURATION');const k=key(input);
  // The PostgreSQL transition already holds a lease. Use the SAME canonical
  // advisory key on that session and finish inspection before external IO.
  // The in-memory adapter still uses the ordinary scripted transaction owner.
  if(lease===undefined)return tx(k,check,async c=>work(await state(c,input,check)));
  if(typeof lease.query!=='function'||typeof lease.tx!=='function'||typeof lease.invalidate!=='function')fail('STORE_CONFIGURATION');
  const lock=`${k.tenantId}:${k.conversationId}`;let locked=false;
  try{check();await lease.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[lock]);locked=true;check();
   const saved=await lease.tx(c=>state(c,input,check));check();const result=await work(saved);check();return result;
  }finally{if(locked){const result=await lease.query('SELECT pg_advisory_unlock(hashtextextended($1,0)) AS unlocked',[lock]);if(result.rows?.[0]?.unlocked!==true){lease.invalidate();fail('STORE_RELEASE_UNKNOWN');}}}
 }
 async function register({principal,conversation,recheckActive},check){validateShape('Conversation',conversation);const input={principal,conversationId:conversation.conversationId};
  if(!same(conversation.owner,{tenantId:principal.tenantId,actorId:principal.actorId})||typeof recheckActive!=='function')fail('CONVERSATION_SCOPE_REFUSED');
  // This row records immutable identity only. Admission and management refresh
  // authority under exclusion; no Core IO is held inside this insert transaction.
  await recheckActive();check();
  return tx(key(input),check,async c=>{const current=await state(c,input,check);if(current.conversation){if(!same({...current.conversation,createdAt:conversation.createdAt},conversation))fail('CONVERSATION_SCOPE_REFUSED');return current.conversation;}
   await c.query('INSERT INTO meri_conversations.conversations(tenant_id,conversation_id,owner_actor_id,projection,projection_sha256) VALUES($1,$2,$3,$4,$5)',[principal.tenantId,conversation.conversationId,principal.actorId,conversation,hash(conversation)]);check();return conversation;
  });
 }
 return Object.freeze({inspect,withConversation,register});
}
