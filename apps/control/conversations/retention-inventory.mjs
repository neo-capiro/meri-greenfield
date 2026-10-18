/** Exact conversation-owned retention rows from one read-only database snapshot.
 * This is a source producer, not a purge fact or deletion authority. */
import {bounded,fail,own,uuid} from './boundary.mjs';
import {nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {scanMemoryProposalContextRows} from './memory-proposal-context-journal.mjs';
import {decodeConversationInventoryRows} from './retention-inventory-decode.mjs';

const PAGE_SIZE=32;
const MAX_ROWS=4096;
const MAX_BYTES=16*1024*1024;
const MAX_DURATION_MS=5000;
const expired=()=>Object.assign(new Error('RETENTION_INVENTORY_EXPIRED'),{code:'RETENTION_INVENTORY_EXPIRED'});
const cancelled=()=>Object.assign(new Error('RETENTION_INVENTORY_CANCELLED'),{code:'RETENTION_INVENTORY_CANCELLED'});

/** Actively bound pool leases and statements. A late lease is retired; a timed
 * out statement marks its connection uncertain so no concurrent ROLLBACK is
 * issued on it and the pool retires it instead. */
function withinDeadline(start,{deadline,now,signal,onTimeout,onLate}={}){
 return new Promise((resolve,reject)=>{
  let done=false,timer;
  const finish=(error,value)=>{if(done)return false;done=true;clearTimeout(timer);
   signal?.removeEventListener('abort',abort);if(error)reject(error);else resolve(value);return true;};
  const abort=()=>{onTimeout?.();finish(cancelled());};
  const remaining=deadline-now();
  if(remaining<=0){onTimeout?.();reject(expired());return;}
  timer=setTimeout(()=>{onTimeout?.();finish(expired());},remaining);
  signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted){abort();return;}
  Promise.resolve().then(start).then(value=>{if(!finish(null,value))try{onLate?.(value);}catch{};},
   error=>{finish(error);});
 });
}

function subjectOf(raw){
 const subject=own(bounded(raw,4096),['tenantId','conversationId','ownerActorId']);
 if(typeof subject.tenantId!=='string'||!subject.tenantId||subject.tenantId.length>256||
    typeof subject.ownerActorId!=='string'||!subject.ownerActorId||subject.ownerActorId.length>256)fail('RETENTION_INVENTORY_REFUSED');
 uuid(subject.conversationId);
 return subject;
}

/** Caller owns the pool. No connection is made until inventoryForConversation. */
export function createConversationRetentionInventory({pool,now=Date.now}){
 if(typeof pool?.connect!=='function'||typeof now!=='function')fail('STORE_CONFIGURATION');
 async function inventoryForConversation(raw,{signal,deadlineMs}={}){
  const subject=subjectOf(raw);
  nativeSignal(signal);
  const startedAt=now();
  if(!Number.isSafeInteger(startedAt)||!Number.isSafeInteger(startedAt+MAX_DURATION_MS)||
     deadlineMs!==undefined&&(!Number.isSafeInteger(deadlineMs)||deadlineMs<=startedAt))fail('RETENTION_INVENTORY_EXPIRED');
  const deadline=deadlineMs===undefined?startedAt+MAX_DURATION_MS:Math.min(startedAt+MAX_DURATION_MS,deadlineMs);
  let rowsSeen=0,bytesSeen=0;
  const check=()=>{if(signal?.aborted)fail('RETENTION_INVENTORY_CANCELLED');if(now()>=deadline)fail('RETENTION_INVENTORY_EXPIRED');};
  const account=row=>{
   rowsSeen++;
   bytesSeen+=Buffer.byteLength(JSON.stringify(row));
   if(rowsSeen>MAX_ROWS||bytesSeen>MAX_BYTES)fail('RETENTION_INVENTORY_LIMIT');
  };
  const page=async(c,sql,cursorOf,initial)=>{
   const rows=[];let cursor=initial;
   for(;;){
    check();const result=await c.query(sql,[subject.tenantId,subject.conversationId,...cursor]);check();
    if(!Array.isArray(result.rows)||result.rows.length>PAGE_SIZE+1)fail('RETENTION_INVENTORY_REFUSED');
    const batch=result.rows.slice(0,PAGE_SIZE);
    for(const row of batch){account(row);rows.push(row);}
    if(result.rows.length<=PAGE_SIZE)break;
    if(batch.length!==PAGE_SIZE)fail('RETENTION_INVENTORY_REFUSED');
    cursor=cursorOf(batch.at(-1));
   }
   return rows;
  };
  let c,begun=false,committing=false,reusable=false,abandoned=false,failure,result;
  const query=(client,sql,args)=>withinDeadline(()=>client.query(sql,args),
   {deadline,now,signal,onTimeout:()=>{abandoned=true;}});
  try{
   check();c=await withinDeadline(()=>pool.connect(),{deadline,now,signal,
    onLate:late=>late?.release?.(expired())});check();
   await query(c,'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');begun=true;
   await query(c,"SET LOCAL statement_timeout = '5s'");
   await query(c,"SET LOCAL lock_timeout = '1s'");check();
   const conversation=(await query(c,'SELECT * FROM meri_conversations.conversations WHERE tenant_id=$1 AND conversation_id=$2',
    [subject.tenantId,subject.conversationId])).rows;
   check();if(!Array.isArray(conversation)||conversation.length!==1)fail('RETENTION_INVENTORY_REFUSED');account(conversation[0]);
   const reader={query:(sql,args)=>query(c,sql,args)};
   const runs=await page(reader,
    'SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND ($3::uuid IS NULL OR run_id>$3::uuid) ORDER BY run_id LIMIT 33',
    row=>[row.run_id],[null]);
   const events=await page(reader,
    'SELECT * FROM meri_conversations.events WHERE tenant_id=$1 AND conversation_id=$2 AND ($3::uuid IS NULL OR (run_id,sequence)>($3::uuid,$4::bigint)) ORDER BY run_id,sequence LIMIT 33',
    row=>[row.run_id,row.sequence],[null,null]);
   const controls=await page(reader,
    'SELECT * FROM meri_conversations.controls WHERE tenant_id=$1 AND conversation_id=$2 AND ($3::uuid IS NULL OR control_id>$3::uuid) ORDER BY control_id LIMIT 33',
    row=>[row.control_id],[null]);
   const checkpoints=await page(reader,
    'SELECT * FROM meri_conversations.checkpoints WHERE tenant_id=$1 AND conversation_id=$2 AND ($3::uuid IS NULL OR checkpoint_id>$3::uuid) ORDER BY checkpoint_id LIMIT 33',
    row=>[row.checkpoint_id],[null]);
   const completionCheckpoints=await page(reader,
    'SELECT * FROM meri_conversations.completion_checkpoints WHERE tenant_id=$1 AND conversation_id=$2 AND ($3::uuid IS NULL OR run_id>$3::uuid) ORDER BY run_id LIMIT 33',
    row=>[row.run_id],[null]);
   const nextRuns=await page(reader,
    'SELECT * FROM meri_conversations.next_runs WHERE tenant_id=$1 AND conversation_id=$2 AND ($3::uuid IS NULL OR source_run_id>$3::uuid) ORDER BY source_run_id LIMIT 33',
    row=>[row.source_run_id],[null]);
   const memoryContextRows=[];
   const memoryContinuations=await scanMemoryProposalContextRows(reader,{tenantId:subject.tenantId,conversationId:subject.conversationId},check,
    row=>{account(row);memoryContextRows.push(row);});
   result=decodeConversationInventoryRows({subject:{tenantId:subject.tenantId,kind:'conversation',
    subjectId:subject.conversationId,ownerActorId:subject.ownerActorId},conversation:conversation[0],
    runs,events,controls,checkpoints,completionCheckpoints,nextRuns,memoryContinuations,memoryContextRows});
   if(Buffer.byteLength(JSON.stringify(result))>MAX_BYTES)fail('RETENTION_INVENTORY_LIMIT');
   check();committing=true;await query(c,'COMMIT');reusable=true;check();
  }catch(error){
   failure=error;
   if(begun&&!committing&&!abandoned)try{await query(c,'ROLLBACK');reusable=true;}catch{reusable=false;}
  }finally{
   if(c)try{c.release(reusable?undefined:failure??new Error('RETENTION_INVENTORY_UNKNOWN'));}
    catch(error){failure??=error;}
  }
  if(failure)throw failure;
  return result;
 }
 return Object.freeze({inventoryForConversation});
}
