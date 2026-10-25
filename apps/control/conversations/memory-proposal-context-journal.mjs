/** Durable execution-scoped proposal and mail-page continuation. The physical
 * table name is retained from immutable migration 0019; key.operation distinguishes
 * the two exact record formats without reinterpreting existing memory rows. The gateway owns current
 * authorization and final release; this journal owns immutable previous-page
 * bytes in the existing conversation transaction and retention boundary. */
import {assertSubject,assertMemoryProposalReadResult,validateShape as readShape} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {bounded,hash,same,fail,own,validateShape,uuid} from './boundary.mjs';
import {isMailContext,mailContextKey,mailContextRecord,mailPredecessorKey} from './mail-context-record.mjs';
import {decodeExecutionRow} from './execution-boundary.mjs';

const OPERATION=Object.freeze({id:'memory.list_own_proposals',version:'0.2.0'});
// Ten schema-bounded proposal entries can exceed 64 KiB in UTF-8. The gateway
// still applies its narrower task output limit to each returned receipt.
const MAX_RECORD_BYTES=1048576;
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const refuse=()=>fail('MEMORY_CONTEXT_REFUSED');
const tuple=b=>[b.tenantId,b.conversationId,b.runId];

function selectedKey(raw,task){
 if(task.mail===true)return mailContextKey(raw,task);
 const {binding,clientId,policyRevision}=task;
 const key=bounded(raw,16384);
 own(key,['binding','operation','policyRevision','subject','cursor']);
 validateShape('RunBinding',key.binding);
 if(!same(key.binding,binding)||!same(key.operation,OPERATION)||key.policyRevision!==policyRevision||
    typeof key.cursor!=='string'||key.cursor.length<1||key.cursor.length>2048)refuse();
 const subject=own(key.subject,['kind','entityType','entityIds','tenantId','actorId','policyRevision','scopes','rosterVersionId']);
 assertSubject(subject,binding);
 const personal=clientId===null,resourceId=personal?binding.actorId:clientId;
 if(subject.kind!==(personal?'personal':'client')||subject.entityType!==(personal?'user':'client')||subject.entityIds.length!==1||subject.entityIds[0]!==resourceId||
    subject.policyRevision!==policyRevision||subject.scopes.length!==1||
    subject.scopes[0].kind!==(personal?'private-user':'client')||subject.scopes[0].resourceId!==resourceId||
    subject.scopes[0].tenantId!==binding.tenantId)refuse();
 return key;
}

function retainedRecord(raw,task,at,predecessor){
 if(task.mail===true)return mailContextRecord(raw,task,{at,predecessor});
 const record=bounded(raw,MAX_RECORD_BYTES);
 own(record,['key','previous','previousSha256','recordedAtMs','expiresAtMs']);
 const key=selectedKey(record.key,task),previous=own(record.previous,['request','page']);
 readShape('MemoryProposalSelection',previous.request);
 readShape('MemoryProposalReadResult',previous.page);
 if(!digest(record.previousSha256)||record.previousSha256!==hash(record.previous)||
    !Number.isSafeInteger(record.recordedAtMs)||record.recordedAtMs<1||record.recordedAtMs>at||
    !Number.isSafeInteger(record.expiresAtMs)||record.expiresAtMs<=at||
    record.expiresAtMs>task.expiresAtMs||record.recordedAtMs>=record.expiresAtMs||
    previous.request.clientId!==task.clientId||previous.page.nextCursor!==key.cursor||
    previous.page.enabled!==true)refuse();
 if(previous.request.cursor===null&&predecessor!==null||
    previous.request.cursor!==null&&predecessor===null)refuse();
 try{assertMemoryProposalReadResult(previous.page,previous.request,{
  subject:key.subject,
  ...(predecessor===null?{}:{previous:predecessor.previous})});}catch{refuse();}
 return record;
}

/** Scan exact continuation row identities on the caller's existing snapshot.
 * The caller owns a repeatable-read, read-only transaction and its lifetime.
 * onRow receives each fully validated raw row before its identity is added. */
export async function scanMemoryProposalContextRows(c,raw,check=()=>{},onRow=()=>{}){
 const subject=own(raw,['tenantId','conversationId']);
 if(typeof subject.tenantId!=='string'||subject.tenantId.length<1||subject.tenantId.length>256)refuse();
 uuid(subject.conversationId);
 const seen=new Set(),targets=[];
 function add(row){
  const runId=uuid(row.run_id),keySha256=row.key_sha256,record=bounded(row.record,MAX_RECORD_BYTES);
  if(row.tenant_id!==subject.tenantId||row.conversation_id!==subject.conversationId||
     !digest(keySha256)||row.record_sha256!==hash(record)||
     Number(row.expires_at_ms)!==record.expiresAtMs)refuse();
  if(isMailContext(record.key)){
   const binding=record.key.binding,clientId=record.key.subject.kind==='client'?record.key.subject.entityIds[0]:null;
   if(binding.tenantId!==subject.tenantId||binding.conversationId!==subject.conversationId||binding.runId!==runId)refuse();
   mailContextRecord(record,{binding,clientId,policyRevision:record.key.policyRevision},{inventory:true});
   if(hash(record.key)!==keySha256)refuse();
   const identity=`${runId}:${keySha256}`;if(seen.has(identity))refuse();
   onRow(row);seen.add(identity);targets.push(Object.freeze({runId,keySha256}));return;
  }
  own(record,['key','previous','previousSha256','recordedAtMs','expiresAtMs']);
  const binding=record.key?.binding,clientId=record.key?.subject?.kind==='personal'?null:record.key?.subject?.entityIds?.[0],
   policyRevision=record.key?.policyRevision;
  if(binding?.tenantId!==subject.tenantId||binding?.conversationId!==subject.conversationId||
     binding?.runId!==runId)refuse();
  const key=selectedKey(record.key,{binding,clientId,policyRevision});
  if(hash(key)!==keySha256||!digest(record.previousSha256)||
     record.previousSha256!==hash(record.previous)||
     !Number.isSafeInteger(record.recordedAtMs)||record.recordedAtMs<1||
     !Number.isSafeInteger(record.expiresAtMs)||record.expiresAtMs<=record.recordedAtMs)refuse();
  const previous=own(record.previous,['request','page']);
  readShape('MemoryProposalSelection',previous.request);
  readShape('MemoryProposalReadResult',previous.page);
  if(previous.request.clientId!==clientId||previous.page.nextCursor!==key.cursor||
     previous.page.enabled!==true)refuse();
  const identity=`${runId}:${keySha256}`;if(seen.has(identity))refuse();
  onRow(row);seen.add(identity);
  targets.push(Object.freeze({runId,keySha256}));
 }
 // Expired rows stay in scope; an excessive inventory refuses rather than
 // silently dropping rows. The keyset keeps each query page bounded.
 let lastRun=null,lastKey=null;
 for(;;){
  check();
  const result=await c.query('SELECT run_id,key_sha256,record,record_sha256,expires_at_ms,tenant_id,conversation_id FROM meri_conversations.memory_proposal_contexts WHERE tenant_id=$1 AND conversation_id=$2 AND ($3::uuid IS NULL OR (run_id,key_sha256)>($3::uuid,$4::text)) ORDER BY run_id,key_sha256 LIMIT 33',
   [subject.tenantId,subject.conversationId,lastRun,lastKey]);
  check();
  if(!Array.isArray(result.rows)||result.rows.length>33)refuse();
  const page=result.rows.slice(0,32);
  for(const row of page){if(targets.length>=4096)refuse();add(row);}
  if(result.rows.length<=32)break;
  lastRun=page.at(-1).run_id;lastKey=page.at(-1).key_sha256;
 }
 return Object.freeze(targets);
}

/** Constructed by the canonical store. No pool connection or gate read occurs
 * until a selected task actually asks for a previous page or retains one. */
export function createMemoryProposalContextJournal({tx,rowRun,pool,retentionGate,retentionHead,now}){
 if(typeof tx!=='function'||typeof rowRun!=='function'||typeof pool?.connect!=='function'||typeof now!=='function')fail('STORE_CONFIGURATION');
 function forTask(raw,mail=false){
  if(typeof retentionGate?.assertServable!=='function'||typeof retentionHead!=='function')fail('MEMORY_CONTEXT_CONFIGURATION');
  const fields=own(raw,['binding','clientId','policyRevision','expiresAtMs'],['signal']);
  const task=Object.freeze({...bounded({binding:fields.binding,clientId:fields.clientId,
   policyRevision:fields.policyRevision,expiresAtMs:fields.expiresAtMs},16384),signal:fields.signal,mail});
  validateShape('RunBinding',task.binding);if(task.clientId!==null)uuid(task.clientId);nativeSignal(task.signal);
  if(typeof task.policyRevision!=='string'||!task.policyRevision||task.policyRevision.length>128||
     !Number.isSafeInteger(task.expiresAtMs)||task.expiresAtMs<=now())refuse();
  const subject=Object.freeze({tenantId:task.binding.tenantId,kind:'conversation',subjectId:task.binding.conversationId});
  const check=signal=>{
   nativeSignal(signal);
   if(task.signal?.aborted||signal?.aborted)fail('MEMORY_CONTEXT_CANCELLED');
   if(!Number.isSafeInteger(now())||now()>=task.expiresAtMs)fail('MEMORY_CONTEXT_EXPIRED');
  };
  const head=async()=>{let value;try{value=await retentionHead();}catch{refuse();}
   const current=own(value,['sequence','entrySha256']);
   if(!Number.isSafeInteger(current.sequence)||current.sequence<0||
      current.sequence===0&&current.entrySha256!==null||
      current.sequence>0&&!digest(current.entrySha256))refuse();
   return current;
  };
  const serve=async(signal,body)=>{
   check(signal);
   // Capture the authoritative generation before the first projection gate.
   // The shared transition lock below excludes the append-to-projection window
   // and makes any intervening suppression or release change detectable.
   const initialHead=await head();check(signal);
   await retentionGate.assertServable(subject);check(signal);
   const result=await tx(task.binding,()=>check(signal),c=>body(c,()=>check(signal)),{
    beforeConversation:async()=>{const lockedHead=await head();check(signal);
     if(!same(lockedHead,initialHead))refuse();}});
   check(signal);await retentionGate.assertServable(subject);check(signal);
   // A completed suppression followed by release can reopen the projection
   // between COMMIT and this release check. Its ledger generation still differs.
   if(!same(await head(),initialHead))refuse();check(signal);
   return result;
  };
  const contextScopes=(scopes,current)=>mail?scopes.filter(s=>s.kind!=='mailbox').every(s=>current.some(c=>same(s,c)))&&
   (task.clientId===null||scopes.some(s=>s.kind==='client'&&s.resourceId===task.clientId)):same(scopes,current);
  async function current(c,checked){
   const runs=(await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',tuple(task.binding))).rows;
   checked();if(runs.length!==1)refuse();const run=rowRun(runs[0]);
   const conversations=(await c.query('SELECT * FROM meri_conversations.conversations WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',tuple(task.binding).slice(0,2))).rows;
   checked();if(conversations.length!==1)refuse();const conversation=conversations[0];
   const executions=(await c.query('SELECT * FROM meri_conversations.native_executions WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',tuple(task.binding))).rows;
   checked();if(executions.length!==1)refuse();const record=decodeExecutionRow(executions[0],task.binding);
   const scope=run.projection.scopes?.[0];
   if(!same(run.projection.binding,task.binding)||run.projection.state!=='running'||run.sequence_end!==null&&run.sequence_end!==undefined||
      run.hold_control_id||run.hold_completion_id||run.projection.policyRevision!==task.policyRevision||
      (!mail&&(run.projection.scopes.length!==1||scope.kind!==(task.clientId===null?'private-user':'client')||scope.resourceId!==(task.clientId??task.binding.actorId)))||
      (task.clientId!==null&&!run.projection.scopes.some(s=>s.kind==='client'&&s.resourceId===task.clientId))||
      run.projection.scopes.some(s=>s.tenantId!==task.binding.tenantId||s.policyRevision!==task.policyRevision)||
      conversation.tenant_id!==task.binding.tenantId||conversation.conversation_id!==task.binding.conversationId||
      conversation.owner_actor_id!==task.binding.actorId||hash(conversation.projection)!==conversation.projection_sha256||
      conversation.projection.owner.actorId!==task.binding.actorId||conversation.projection.owner.tenantId!==task.binding.tenantId||
      conversation.projection.policyRevision!==task.policyRevision||!same(conversation.projection.scopes,run.projection.scopes)||
      ['stopping','settled'].includes(record.phase)||record.expiresAtMs!==task.expiresAtMs)refuse();
   return run.projection.scopes;
  }
  async function predecessor(c,record,checked){
   let key;
   if(mail){key=mailPredecessorKey(record);if(key===null)return null;key=selectedKey(key,task);}
   else{
    const cursor=record.previous?.request?.cursor;
    if(cursor===null)return null;
    if(typeof cursor!=='string'||cursor.length<1||cursor.length>2048)refuse();
    key=selectedKey({...record.key,cursor},task);
   }
   const keySha256=hash(key);
   const rows=(await c.query('SELECT * FROM meri_conversations.memory_proposal_contexts WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 AND key_sha256=$4 FOR UPDATE',
    [...tuple(task.binding),keySha256])).rows;checked();
   if(rows.length!==1)refuse();
   const row=rows[0],prior=row.record;
   if(row.tenant_id!==task.binding.tenantId||row.conversation_id!==task.binding.conversationId||row.run_id!==task.binding.runId||
      row.key_sha256!==keySha256||row.record_sha256!==hash(prior)||
      Number(row.expires_at_ms)!==prior?.expiresAtMs)refuse();
   if(mail){
    mailContextRecord(prior,task,{inventory:true});
    if(!same(prior.key,key)||prior.expiresAtMs<=now()||prior.expiresAtMs<record.expiresAtMs||prior.recordedAtMs>record.recordedAtMs)refuse();
    return prior;
   }
   own(prior,['key','previous','previousSha256','recordedAtMs','expiresAtMs']);
   if(!same(prior.key,key)||!digest(prior.previousSha256)||prior.previousSha256!==hash(prior.previous)||
      !Number.isSafeInteger(prior.recordedAtMs)||prior.recordedAtMs<1||
      !Number.isSafeInteger(prior.expiresAtMs)||prior.expiresAtMs<=now()||
      prior.expiresAtMs<record.expiresAtMs||prior.recordedAtMs>record.recordedAtMs)refuse();
   return prior;
  }
  const read=async key=>serve(key.signal,async(c,checked)=>{
   const scope=await current(c,checked);if(!contextScopes(key.value.subject.scopes,scope))refuse();
   const rows=(await c.query('SELECT * FROM meri_conversations.memory_proposal_contexts WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 AND key_sha256=$4 FOR UPDATE',
    [...tuple(task.binding),hash(key.value)])).rows;checked();
   if(rows.length>1)refuse();if(!rows.length)return null;
   const row=rows[0];
   if(row.tenant_id!==task.binding.tenantId||row.conversation_id!==task.binding.conversationId||row.run_id!==task.binding.runId||
      row.key_sha256!==hash(key.value)||row.record_sha256!==hash(row.record)||
      Number(row.expires_at_ms)!==row.record?.expiresAtMs)refuse();
   const prior=await predecessor(c,row.record,checked),record=retainedRecord(row.record,task,now(),prior);
   if(!same(record.key,key.value))refuse();return record;
  });
  async function loadPrevious(raw){const value=own(raw,['key'],['signal']),key=selectedKey(value.key,task);
   nativeSignal(value.signal);const record=await read({value:key,signal:value.signal});
   return JSON.stringify({record,checkedAtMs:now()});
  }
  async function retain(raw){const value=own(raw,['record'],['signal']);nativeSignal(value.signal);
   const rawRecord=bounded(value.record,MAX_RECORD_BYTES),key=selectedKey(rawRecord.key,task),keySha256=hash(key);
   await serve(value.signal,async(c,checked)=>{
    const scope=await current(c,checked);if(!contextScopes(key.subject.scopes,scope))refuse();
    const prior=await predecessor(c,rawRecord,checked),record=retainedRecord(rawRecord,task,now(),prior);
    const rows=(await c.query('SELECT * FROM meri_conversations.memory_proposal_contexts WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 AND key_sha256=$4 FOR UPDATE',
     [...tuple(task.binding),keySha256])).rows;checked();
    if(rows.length>1)refuse();
    if(rows.length){
     const row=rows[0];
     // The gateway records the time of each fresh dispatch. A retry of the
     // same page may therefore carry a later time; keep the first durable row
     // and compare every page/authority/expiry field against it.
     if(row.record_sha256!==hash(row.record)||row.key_sha256!==keySha256||
        Number(row.expires_at_ms)!==row.record?.expiresAtMs)fail('MEMORY_CONTEXT_REPLAY_REFUSED');
     const stored=retainedRecord(row.record,task,now(),prior);
     if(record.recordedAtMs<stored.recordedAtMs||
        !same({...stored,recordedAtMs:record.recordedAtMs},record))fail('MEMORY_CONTEXT_REPLAY_REFUSED');
    }else{
     await c.query('INSERT INTO meri_conversations.memory_proposal_contexts(tenant_id,conversation_id,run_id,key_sha256,record,record_sha256,expires_at_ms) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [...tuple(task.binding),keySha256,record,hash(record),record.expiresAtMs]);checked();
    }
    return true;
   });
   return JSON.stringify({decision:'retained',keySha256,previousSha256:rawRecord.previousSha256,checkedAtMs:now()});
  }
  return Object.freeze({loadPrevious,retain});
 }
 /** A mandatory slice for the future canonical retention inventory producer.
  * Include expired rows: expiry closes serving but does not erase a row. A
  * repeatable-read transaction provides one coherent relation snapshot. */
 async function inventoryForConversation(raw){
  const subject=own(raw,['tenantId','conversationId']);
  if(typeof subject.tenantId!=='string'||subject.tenantId.length<1||subject.tenantId.length>256)refuse();
  uuid(subject.conversationId);
  let c,begun=false,committing=false,reusable=false,failure,targets;
  try{
   c=await pool.connect();await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');begun=true;
   await c.query("SET LOCAL statement_timeout = '5s'");
   targets=await scanMemoryProposalContextRows(c,subject);
   committing=true;await c.query('COMMIT');reusable=true;
  }catch(error){failure=error;
   if(begun&&!committing)try{await c.query('ROLLBACK');reusable=true;}catch{reusable=false;}
  }
  if(c)try{c.release(reusable?undefined:failure??new Error('MEMORY_CONTEXT_INVENTORY_UNKNOWN'));}
   catch(error){failure??=error;}
  if(failure){if(failure.code==='MEMORY_CONTEXT_REFUSED')throw failure;
   fail('MEMORY_CONTEXT_INVENTORY_UNAVAILABLE');}
  return targets;
 }
 return Object.freeze({forTask:raw=>forTask(raw),forMail:raw=>forTask(raw,true),inventoryForConversation});
}
