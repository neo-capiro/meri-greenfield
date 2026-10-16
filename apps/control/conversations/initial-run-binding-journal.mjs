/** Durable original Meri binding for a verified Core conversation. Source only until its table is centrally migrated and mounted. */
import {randomUUID} from 'node:crypto';
import {bounded,hash,own,same,uuid,validateShape} from './boundary.mjs';
import {assertOriginalInputFacts} from './initial-input-facts.mjs';

const owned=new WeakSet();
function refuse(code){const e=Object.assign(new Error(code),{code});owned.add(e);throw e;}
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
const instant=v=>Number.isSafeInteger(v)&&v>=0;
const text=v=>typeof v==='string'&&v.length>0&&v.length<=256;

function assertRecord(raw){
 const record=own(bounded(raw),['schemaVersion','state','binding','selectedClientId','policyRevision','versions','configurationSha256','expiresAtMs','createdAtMs']);
 try{validateShape('RunBinding',record.binding);validateShape('RuntimeVersions',record.versions);uuid(record.selectedClientId);}catch{refuse('INITIAL_RUN_BINDING_CORRUPT');}
 if(record.schemaVersion!==1||record.state!=='ADMITTED'||record.binding.writerFence!==1||!text(record.policyRevision)||!digest(record.configurationSha256)||!instant(record.createdAtMs)||!instant(record.expiresAtMs)||record.expiresAtMs<=record.createdAtMs)refuse('INITIAL_RUN_BINDING_CORRUPT');
 return record;
}
function proposed(raw,at){
 const v=own(bounded(raw),['principal','conversationId','selectedClientId','policyRevision','versions','configurationSha256','proposedExpiresAtMs']);
 const principal=own(v.principal,['tenantId','actorId']);uuid(v.conversationId);uuid(v.selectedClientId);
 if(!text(principal.tenantId)||!text(principal.actorId)||!text(v.policyRevision)||!digest(v.configurationSha256)||!instant(v.proposedExpiresAtMs)||v.proposedExpiresAtMs<=at)refuse('INITIAL_RUN_BINDING_INPUT_REFUSED');
 validateShape('RuntimeVersions',v.versions);return {...v,principal};
}
function decode(row){
 if(!row||!digest(row.record_sha256)||hash(row.record)!==row.record_sha256)refuse('INITIAL_RUN_BINDING_CORRUPT');
 let record;try{record=assertRecord(row.record);}catch{refuse('INITIAL_RUN_BINDING_CORRUPT');}
 const b=record.binding;
 if(row.tenant_id!==b.tenantId||row.conversation_id!==b.conversationId||row.run_id!==b.runId)refuse('INITIAL_RUN_BINDING_CORRUPT');
 return record;
}
function matchesProposal(record,v){
 const b=record.binding;
 return b.tenantId===v.principal.tenantId&&b.actorId===v.principal.actorId&&b.conversationId===v.conversationId&&record.selectedClientId===v.selectedClientId&&record.policyRevision===v.policyRevision&&same(record.versions,v.versions)&&record.configurationSha256===v.configurationSha256;
}

export function createInitialRunBindingJournal({pool,now=Date.now,newId=randomUUID}){
 if(typeof pool?.connect!=='function'||typeof now!=='function'||typeof newId!=='function')refuse('INITIAL_RUN_BINDING_CONFIGURATION');
 const clock=()=>{const at=now();if(!instant(at))refuse('INITIAL_RUN_BINDING_CLOCK');return at;};
 async function transaction(key,check,body){
  if(typeof check!=='function')refuse('INITIAL_RUN_BINDING_CONFIGURATION');
  let client,begun=false,committing=false,reusable=false,failure,result;
  try{
   check();client=await pool.connect();check();await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');begun=true;check();
   await client.query("SET LOCAL statement_timeout = '5s'");await client.query("SET LOCAL lock_timeout = '2s'");check();
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${key.tenantId}:${key.conversationId}`]);check();
   result=await body(client);check();committing=true;await client.query('COMMIT');reusable=true;check();
  }catch(e){
   failure=committing?Object.assign(new Error('INITIAL_RUN_BINDING_COMMIT_UNKNOWN'),{code:'INITIAL_RUN_BINDING_COMMIT_UNKNOWN'}):owned.has(e)?e:Object.assign(new Error('INITIAL_RUN_BINDING_STORE_UNAVAILABLE'),{code:'INITIAL_RUN_BINDING_STORE_UNAVAILABLE'});
   if(begun&&!committing)try{await client.query('ROLLBACK');reusable=true;}catch{}
  }finally{if(client)try{client.release(reusable?undefined:failure);}catch{failure??=Object.assign(new Error('INITIAL_RUN_BINDING_STORE_UNAVAILABLE'),{code:'INITIAL_RUN_BINDING_STORE_UNAVAILABLE'});}}
  if(failure)throw failure;return bounded(result);
 }
 async function row(client,key,check){
  const rows=(await client.query('SELECT * FROM meri_conversations.initial_run_bindings WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[key.tenantId,key.conversationId])).rows;check();
  if(!Array.isArray(rows)||rows.length>1)refuse('INITIAL_RUN_BINDING_CORRUPT');return rows.length?decode(rows[0]):null;
 }
 async function otherState(client,binding,check,existing){
  const p=[binding.tenantId,binding.conversationId];
  const runs=(await client.query('SELECT projection,projection_sha256 FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 ORDER BY sequence_base LIMIT 1 FOR UPDATE',p)).rows;check();
  const inputs=(await client.query('SELECT * FROM meri_conversations.initial_inputs WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',p)).rows;check();
  const successors=(await client.query('SELECT reservation,reservation_sha256 FROM meri_conversations.next_runs WHERE tenant_id=$1 AND conversation_id=$2 AND source_run_id=$3 FOR UPDATE',[...p,binding.runId])).rows;check();
  if(!Array.isArray(runs)||!Array.isArray(inputs)||!Array.isArray(successors)||runs.length>1||inputs.length>1||successors.length>1)refuse('INITIAL_RUN_BINDING_CORRUPT');
  if(!existing){if(runs.length||inputs.length||successors.length)refuse('INITIAL_RUN_BINDING_ALREADY_EXISTS');
   // An unrelated successor reservation also blocks a new original, even when its source is not the proposed random UUID.
   const anyNext=(await client.query('SELECT 1 FROM meri_conversations.next_runs WHERE tenant_id=$1 AND conversation_id=$2 LIMIT 1 FOR UPDATE',p)).rows;check();
   if(!Array.isArray(anyNext)||anyNext.length>1)refuse('INITIAL_RUN_BINDING_CORRUPT');if(anyNext.length)refuse('INITIAL_RUN_BINDING_ALREADY_EXISTS');return;
  }
  if(runs.length!==inputs.length&&!(inputs.length&&inputs[0].state==='RESERVED'&&!runs.length)||runs.length&&inputs[0].state!=='ACCEPTED')refuse('INITIAL_RUN_BINDING_CONFLICT');
  if(runs.length){const r=runs[0];try{validateShape('Run',r.projection);}catch{refuse('INITIAL_RUN_BINDING_CONFLICT');}
   if(hash(r.projection)!==r.projection_sha256||!same(r.projection.binding,binding)||r.projection.policyRevision!==existing.policyRevision||!same(r.projection.versions,existing.versions))refuse('INITIAL_RUN_BINDING_CONFLICT');}
  if(inputs.length){const i=inputs[0],a=i.allocation;try{assertOriginalInputFacts(a);}catch{refuse('INITIAL_RUN_BINDING_CONFLICT');}
   if(hash(a)!==i.allocation_sha256||i.tenant_id!==binding.tenantId||i.conversation_id!==binding.conversationId||i.run_id!==binding.runId||i.request_id!==a.requestId||!same(a.binding,binding)||a.selectedClientId!==existing.selectedClientId||!same(a.versions,existing.versions)||a.scopes[0].policyRevision!==existing.policyRevision||!['RESERVED','ACCEPTED'].includes(i.state)||i.state==='ACCEPTED'&&i.accepted_request_sha256!==a.requestSha256||i.state==='RESERVED'&&i.accepted_request_sha256!==null)refuse('INITIAL_RUN_BINDING_CONFLICT');}
  if(successors.length){const s=successors[0];if(hash(s.reservation)!==s.reservation_sha256||!same(s.reservation?.source,binding)||!runs.length)refuse('INITIAL_RUN_BINDING_CONFLICT');}
 }
 async function claim(raw,check){
  const at=clock(),v=proposed(raw,at),key={tenantId:v.principal.tenantId,conversationId:v.conversationId};
  return transaction(key,check,async client=>{
   const old=await row(client,key,check);
   if(old){if(!matchesProposal(old,v))refuse('INITIAL_RUN_BINDING_CONFLICT');const current=clock();if(current<old.createdAtMs||current>=old.expiresAtMs)refuse('INITIAL_RUN_BINDING_EXPIRED');await otherState(client,old.binding,check,old);return {record:old,created:false};}
   const binding={...v.principal,conversationId:v.conversationId,runId:newId(),attemptId:newId(),workerId:newId(),writerFence:1};
   try{validateShape('RunBinding',binding);}catch{refuse('INITIAL_RUN_BINDING_CONFIGURATION');}
   if(new Set([binding.conversationId,binding.runId,binding.attemptId,binding.workerId]).size!==4)refuse('INITIAL_RUN_BINDING_CONFIGURATION');
   await otherState(client,binding,check,null);
   const record=assertRecord({schemaVersion:1,state:'ADMITTED',binding,selectedClientId:v.selectedClientId,policyRevision:v.policyRevision,versions:v.versions,configurationSha256:v.configurationSha256,expiresAtMs:v.proposedExpiresAtMs,createdAtMs:at});
   const inserted=(await client.query('INSERT INTO meri_conversations.initial_run_bindings(tenant_id,conversation_id,run_id,record,record_sha256) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING *',[binding.tenantId,binding.conversationId,binding.runId,record,hash(record)])).rows;check();
   if(!Array.isArray(inserted)||inserted.length!==1||!same(decode(inserted[0]),record))refuse('INITIAL_RUN_BINDING_CONFLICT');
   const back=await row(client,key,check),current=clock();if(!back||!same(back,record)||current<at||current>=record.expiresAtMs)refuse('INITIAL_RUN_BINDING_CONFLICT');
   return {record:back,created:true};
  });
 }
 async function read(raw,check){
  const {binding}=own(bounded(raw),['binding']);validateShape('RunBinding',binding);
  return transaction(binding,check,async client=>{const saved=await row(client,binding,check);if(saved&&!same(saved.binding,binding))refuse('INITIAL_RUN_BINDING_CONFLICT');return saved;});
 }
 async function readConversation(raw,check){
  const {principal,conversationId,selectedClientId}=own(bounded(raw),['principal','conversationId','selectedClientId']),p=own(principal,['tenantId','actorId']);
  uuid(conversationId);uuid(selectedClientId);if(!text(p.tenantId)||!text(p.actorId))refuse('INITIAL_RUN_BINDING_INPUT_REFUSED');
  return transaction({tenantId:p.tenantId,conversationId},check,async client=>{
   const saved=await row(client,{tenantId:p.tenantId,conversationId},check);
   if(saved&&(saved.binding.actorId!==p.actorId||saved.selectedClientId!==selectedClientId))refuse('INITIAL_RUN_BINDING_CONFLICT');return saved;
  });
 }
 return Object.freeze({claim,read,readConversation});
}
