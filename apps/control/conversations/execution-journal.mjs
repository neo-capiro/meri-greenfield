/** Invocation state in the existing canonical run store; no external effects in a transaction. */
import {own,data,hash,same,validateShape,fail} from './boundary.mjs';
import {assertExecutionIdentity,executionIdentity,decodeExecutionRow,isExecutionOutcome,readExecutionSettlement} from './execution-boundary.mjs';
export function createExecutionJournal({tx,rowRun,now=Date.now}){
 const args=b=>[b.tenantId,b.conversationId,b.runId];
 async function runRow(c,b,check){const run=rowRun((await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',args(b))).rows[0]);check();if(!same(run.projection.binding,b))fail('STALE_WRITER');return run;}
 async function load(c,b,check,run){run??=await runRow(c,b,check);const rows=(await c.query('SELECT * FROM meri_conversations.native_executions WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',args(b))).rows;check();if(rows.length>1)fail('EXECUTION_CORRUPT');return {run:run.projection,record:rows.length?decodeExecutionRow(rows[0],b):null};}
 async function claim(value,check){const identity=assertExecutionIdentity(value),b=identity.binding;return tx(b,check,async c=>{const run=await runRow(c,b,check),saved=await load(c,b,check,run);
  if(saved.record){if(!same(executionIdentity(saved.record),identity))fail('EXECUTION_REPLAY_REFUSED');return {...saved,dispatch:false};}
  // Claim and terminal fencing use the same conversation lock. Missing execution after a failed/cancelled run therefore means
  // no invocation can subsequently be claimed; no separate no-authority or foreclosure ledger is needed.
  if(saved.run.state!=='queued'||run.sequence_end!=null)fail('EXECUTION_NOT_QUEUED');
  const runs=(await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[b.tenantId,b.conversationId])).rows.map(rowRun);check();
  if(runs.some(r=>r.projection.binding.writerFence>=b.writerFence&&!same(r.projection.binding,b)))fail('STALE_WRITER');
  const record=data({...identity,phase:'launching',native:null});await c.query('INSERT INTO meri_conversations.native_executions(tenant_id,conversation_id,run_id,execution_key,execution_id,record,record_sha256) VALUES($1,$2,$3,$4,$5,$6,$7)',[...args(b),record.executionKey,record.executionId,record,hash(record)]);check();return {run:saved.run,record,dispatch:true};});}
 async function read(binding,check){const b=data(binding);validateShape('RunBinding',b);return tx(b,check,c=>load(c,b,check));}
 /** Read-only schedule observation. Missing failed/cancelled invocations still check historical custody under this lock. */
 async function settlement(binding,check){const b=data(binding);validateShape('RunBinding',b);return tx(b,check,async c=>{
  const saved=await load(c,b,check);
  if(saved.record?.phase!=='settled'&&(saved.record!==null||!['failed','cancelled'].includes(saved.run.state)))return {run:saved.run,settled:false};
  await readExecutionSettlement(c,b,saved.run.state,check);return {run:saved.run,settled:true};
 });}
 /** Same canonical read for owners that already hold the conversation lock
  * in their transaction. No nested connection, new execution or effect. */
 async function readCurrentOnClient(client,value,outerCheck=()=>{}){
  const v=own(value,['binding'],['signal','deadlineMs']),b=data(v.binding);validateShape('RunBinding',b);
  if(typeof client?.query!=='function'||typeof outerCheck!=='function'||v.deadlineMs!==undefined&&(!Number.isSafeInteger(v.deadlineMs)||v.deadlineMs<1))fail('EXECUTION_ADMISSION_REFUSED');
  let deadline=v.deadlineMs??Infinity;const check=()=>{outerCheck();if(v.signal?.aborted||now()>=deadline)fail('EXECUTION_ADMISSION_EXPIRED');};
  check();
  const run=await runRow(client,b,check),saved=await load(client,b,check,run),record=saved.record;
   if(!record||['stopping','settled'].includes(record.phase)||run.sequence_end!=null||!['queued','starting','running','completed','failed','paused','waiting-for-approval'].includes(saved.run.state))fail('EXECUTION_ADMISSION_REFUSED');
   const runs=(await client.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[b.tenantId,b.conversationId])).rows.map(rowRun);check();
   if(runs.some(r=>r.projection.binding.writerFence>=b.writerFence&&!same(r.projection.binding,b)))fail('STALE_WRITER');
   deadline=Math.min(deadline,record.expiresAtMs);check();const current=data({binding:b,scopes:saved.run.scopes,policyRevision:saved.run.policyRevision,deadlineMs:record.expiresAtMs,executionSha256:hash(executionIdentity(record)),executionPhase:record.phase,run:saved.run});
  return current;
 }
 /** SessionStore flushes share the run lock; settlement/Stop cannot overtake an admitted callback. */
 async function withCurrentRun(value,effect){const v=own(value,['binding'],['signal','deadlineMs']),b=data(v.binding);validateShape('RunBinding',b);
  if(typeof effect!=='function'||v.deadlineMs!==undefined&&(!Number.isSafeInteger(v.deadlineMs)||v.deadlineMs<1))fail('EXECUTION_ADMISSION_REFUSED');
  let deadline=v.deadlineMs??Infinity;const check=()=>{if(v.signal?.aborted||now()>=deadline)fail('EXECUTION_ADMISSION_EXPIRED');};
  return tx(b,check,async client=>{
   const current=await readCurrentOnClient(client,v,check);deadline=Math.min(deadline,current.deadlineMs);check();
   const result=await effect({client,current});check();return result;
  },{sessionSnapshot:true});
 }
 async function record(value,check){const v=data(value);own(v,['binding','executionId','phase','native']);validateShape('RunBinding',v.binding);
  return tx(v.binding,check,async c=>{const run=await runRow(c,v.binding,check),saved=await load(c,v.binding,check,run),old=saved.record;if(!old||old.executionId!==v.executionId)fail('EXECUTION_REFUSED');
   if(old.phase==='stopping')fail('EXECUTION_STOPPING');
   const transitions={launching:['started','unknown','settled'],unknown:['unknown','started','settled'],started:['started','unknown','settled'],settled:['settled']};
   if(!transitions[old.phase].includes(v.phase)||old.phase==='settled'&&!same(old.native,v.native))fail('EXECUTION_TRANSITION_REFUSED');
   if(v.phase==='settled'){own(v.native,['state']);if(!isExecutionOutcome(v.native.state)||v.native.state!==saved.run.state||run.sequence_end!=null&&old.phase!=='settled')fail('EXECUTION_SETTLEMENT_REFUSED');}
   else if(v.native!==null||run.sequence_end!=null)fail('EXECUTION_TRANSITION_REFUSED');
   const next=data({...old,phase:v.phase,native:v.native});await c.query('UPDATE meri_conversations.native_executions SET record=$4,record_sha256=$5 WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[...args(v.binding),next,hash(next)]);check();return {...saved,record:next};});}
 /** Fence successor admission before the external Stop. Repeat calls reuse executionId as the provider client token. */
 async function requestStop(binding,check){const b=data(binding);validateShape('RunBinding',b);return tx(b,check,async c=>{const run=await runRow(c,b,check),saved=await load(c,b,check,run);
  if(!isExecutionOutcome(saved.run.state))fail('EXECUTION_STOP_UNFENCED');
  if(!saved.record||saved.record.phase==='settled')return {...saved,dispatch:false};
  if(run.sequence_end!=null)fail('STALE_WRITER');const next=data({...saved.record,phase:'stopping',native:null});
  if(saved.record.phase!=='stopping'){await c.query('UPDATE meri_conversations.native_executions SET record=$4,record_sha256=$5 WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[...args(b),next,hash(next)]);check();}
  return {...saved,record:next,dispatch:true};});}
 /** Only the authenticated stop owner calls this after definitive provider confirmation; a query completion cannot release stopping. */
 async function settleStopped(value,check){const v=data(value);own(v,['binding','executionId','runtimeSessionId','state']);validateShape('RunBinding',v.binding);
  return tx(v.binding,check,async c=>{const saved=await load(c,v.binding,check),old=saved.record;
   if(!old||old.executionId!==v.executionId||old.runtimeSessionId!==v.runtimeSessionId||!isExecutionOutcome(v.state)||saved.run.state!==v.state||!['stopping','settled'].includes(old.phase))fail('EXECUTION_STOP_REFUSED');
   if(old.phase==='settled'){if(old.native.state!==v.state||old.native.stopped!==true)fail('EXECUTION_STOP_REFUSED');return saved;}
   const next=data({...old,phase:'settled',native:{state:v.state,stopped:true}});await c.query('UPDATE meri_conversations.native_executions SET record=$4,record_sha256=$5 WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[...args(v.binding),next,hash(next)]);check();return {...saved,record:next};});}
 return Object.freeze({claim,read,settlement,readCurrentOnClient,withCurrentRun,record,requestStop,settleStopped});
}
