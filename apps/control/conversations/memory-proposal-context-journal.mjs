/** Durable, task-scoped proposal-page continuation. The gateway owns current
 * authorization and final release; this journal owns immutable previous-page
 * bytes in the existing conversation transaction and retention boundary. */
import {assertSubject,assertMemoryProposalReadResult,validateShape as readShape} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {bounded,hash,same,fail,own,validateShape,uuid} from './boundary.mjs';

const OPERATION=Object.freeze({id:'memory.list_own_proposals',version:'0.2.0'});
const SUBJECT_DECISION='00000000-0000-4000-8000-000000000000';
// Ten schema-bounded proposal entries can exceed 64 KiB in UTF-8. The gateway
// still applies its narrower task output limit to each returned receipt.
const MAX_RECORD_BYTES=1048576;
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const refuse=()=>fail('MEMORY_CONTEXT_REFUSED');
const tuple=b=>[b.tenantId,b.conversationId,b.runId];

function selectedKey(raw,{binding,clientId,policyRevision}){
 const key=bounded(raw,16384);
 own(key,['binding','operation','policyRevision','subject','cursor']);
 validateShape('RunBinding',key.binding);
 if(!same(key.binding,binding)||!same(key.operation,OPERATION)||key.policyRevision!==policyRevision||
    typeof key.cursor!=='string'||key.cursor.length<1||key.cursor.length>2048)refuse();
 const subject=own(key.subject,['kind','entityType','entityIds','tenantId','actorId','policyRevision','scopes','rosterVersionId']);
 // The gateway deliberately omits the replaceable authorization decision ID
 // from its continuation key. Reconstitute only for canonical shape validation.
 assertSubject({...subject,authorizationDecisionId:SUBJECT_DECISION},binding);
 if(subject.kind!=='client'||subject.entityType!=='client'||subject.entityIds[0]!==clientId||
    subject.policyRevision!==policyRevision||subject.scopes.length!==1||
    subject.scopes[0].kind!=='client'||subject.scopes[0].resourceId!==clientId||
    subject.scopes[0].tenantId!==binding.tenantId)refuse();
 return key;
}

function retainedRecord(raw,task,at,predecessor){
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
  subject:{...key.subject,authorizationDecisionId:SUBJECT_DECISION},
  ...(predecessor===null?{}:{previous:predecessor.previous})});}catch{refuse();}
 return record;
}

/** Constructed by the canonical store. No pool connection or gate read occurs
 * until a selected task actually asks for a previous page or retains one. */
export function createMemoryProposalContextJournal({tx,rowRun,retentionGate,now}){
 if(typeof tx!=='function'||typeof rowRun!=='function'||typeof now!=='function')fail('STORE_CONFIGURATION');
 function forTask(raw){
  if(typeof retentionGate?.assertServable!=='function')fail('MEMORY_CONTEXT_CONFIGURATION');
  const fields=own(raw,['binding','clientId','policyRevision','expiresAtMs'],['signal']);
  const task=Object.freeze({...bounded({binding:fields.binding,clientId:fields.clientId,
   policyRevision:fields.policyRevision,expiresAtMs:fields.expiresAtMs},16384),signal:fields.signal});
  validateShape('RunBinding',task.binding);uuid(task.clientId);nativeSignal(task.signal);
  if(typeof task.policyRevision!=='string'||!task.policyRevision||task.policyRevision.length>128||
     !Number.isSafeInteger(task.expiresAtMs)||task.expiresAtMs<=now())refuse();
  const subject=Object.freeze({tenantId:task.binding.tenantId,kind:'conversation',subjectId:task.binding.conversationId});
  const check=signal=>{
   nativeSignal(signal);
   if(task.signal?.aborted||signal?.aborted)fail('MEMORY_CONTEXT_CANCELLED');
   if(!Number.isSafeInteger(now())||now()>=task.expiresAtMs)fail('MEMORY_CONTEXT_EXPIRED');
  };
  const serve=async(signal,body)=>{
   check(signal);
   await retentionGate.assertServable(subject);check(signal);
   const result=await tx(task.binding,()=>check(signal),c=>body(c,()=>check(signal)));
   check(signal);await retentionGate.assertServable(subject);check(signal);
   return result;
  };
  async function current(c,checked){
   const runs=(await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',tuple(task.binding))).rows;
   checked();if(runs.length!==1)refuse();const run=rowRun(runs[0]);
   const conversations=(await c.query('SELECT * FROM meri_conversations.conversations WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',tuple(task.binding).slice(0,2))).rows;
   checked();if(conversations.length!==1)refuse();const conversation=conversations[0];
   const allocations=(await c.query('SELECT * FROM meri_conversations.native_allocations WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',tuple(task.binding))).rows;
   checked();if(allocations.length!==1)refuse();const allocation=allocations[0];
   const scope=run.projection.scopes?.[0],record=allocation.record;
   if(!same(run.projection.binding,task.binding)||run.projection.state!=='running'||run.sequence_end!==null&&run.sequence_end!==undefined||
      run.hold_control_id||run.hold_completion_id||run.projection.policyRevision!==task.policyRevision||
      run.projection.scopes.length!==1||scope.kind!=='client'||scope.resourceId!==task.clientId||
      scope.tenantId!==task.binding.tenantId||scope.policyRevision!==task.policyRevision||
      conversation.tenant_id!==task.binding.tenantId||conversation.conversation_id!==task.binding.conversationId||
      conversation.owner_actor_id!==task.binding.actorId||hash(conversation.projection)!==conversation.projection_sha256||
      conversation.projection.owner.actorId!==task.binding.actorId||conversation.projection.owner.tenantId!==task.binding.tenantId||
      conversation.projection.policyRevision!==task.policyRevision||!same(conversation.projection.scopes,run.projection.scopes)||
      allocation.record_sha256!==hash(record)||allocation.tenant_id!==task.binding.tenantId||
      allocation.conversation_id!==task.binding.conversationId||allocation.run_id!==task.binding.runId||
      record?.state!=='ADMITTED'||!same(record.original?.binding,task.binding)||
      record.original?.expiresAtMs!==task.expiresAtMs||record.qualification?.policyRevision!==task.policyRevision||
      record.resource?.launchBinding?.state!=='STARTED')refuse();
   return scope;
  }
  async function predecessor(c,record,checked){
   const cursor=record.previous?.request?.cursor;
   if(cursor===null)return null;
   if(typeof cursor!=='string'||cursor.length<1||cursor.length>2048)refuse();
   const key=selectedKey({...record.key,cursor},task),keySha256=hash(key);
   const rows=(await c.query('SELECT * FROM meri_conversations.memory_proposal_contexts WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 AND key_sha256=$4 FOR UPDATE',
    [...tuple(task.binding),keySha256])).rows;checked();
   if(rows.length!==1)refuse();
   const row=rows[0],prior=row.record;
   if(row.tenant_id!==task.binding.tenantId||row.conversation_id!==task.binding.conversationId||row.run_id!==task.binding.runId||
      row.key_sha256!==keySha256||row.record_sha256!==hash(prior)||
      Number(row.expires_at_ms)!==prior?.expiresAtMs)refuse();
   own(prior,['key','previous','previousSha256','recordedAtMs','expiresAtMs']);
   if(!same(prior.key,key)||!digest(prior.previousSha256)||prior.previousSha256!==hash(prior.previous)||
      !Number.isSafeInteger(prior.recordedAtMs)||prior.recordedAtMs<1||
      !Number.isSafeInteger(prior.expiresAtMs)||prior.expiresAtMs<=now()||
      prior.expiresAtMs<record.expiresAtMs||prior.recordedAtMs>record.recordedAtMs)refuse();
   return prior;
  }
  const read=async key=>serve(key.signal,async(c,checked)=>{
   const scope=await current(c,checked);if(!same(key.value.subject.scopes,[scope]))refuse();
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
    const scope=await current(c,checked);if(!same(key.subject.scopes,[scope]))refuse();
    const prior=await predecessor(c,rawRecord,checked),record=retainedRecord(rawRecord,task,now(),prior);
    const rows=(await c.query('SELECT * FROM meri_conversations.memory_proposal_contexts WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 AND key_sha256=$4 FOR UPDATE',
     [...tuple(task.binding),keySha256])).rows;checked();
    if(rows.length>1)refuse();
    if(rows.length){
     const row=rows[0];
     if(row.record_sha256!==hash(row.record)||row.key_sha256!==keySha256||
        Number(row.expires_at_ms)!==row.record?.expiresAtMs||
        !same(retainedRecord(row.record,task,now(),prior),record))fail('MEMORY_CONTEXT_REPLAY_REFUSED');
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
 return Object.freeze({forTask});
}
