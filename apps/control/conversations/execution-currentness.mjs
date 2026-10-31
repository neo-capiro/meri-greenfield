/** Canonical execution currentness read on a caller-supplied transaction client. */
import {own,data,hash,same,validateShape,fail} from './boundary.mjs';
import {executionIdentity,decodeExecutionRow} from './execution-boundary.mjs';
export function createExecutionCurrentnessReader({rowRun,now=Date.now}){
 if(typeof rowRun!=='function'||typeof now!=='function')fail('EXECUTION_ADMISSION_REFUSED');
 const args=b=>[b.tenantId,b.conversationId,b.runId];
 async function runRowLocked(c,b,check){const run=rowRun((await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',args(b))).rows[0]);check();if(!same(run.projection.binding,b))fail('STALE_WRITER');return run;}
 async function load(c,b,check,run){run??=await runRowLocked(c,b,check);const rows=(await c.query('SELECT * FROM meri_conversations.native_executions WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',args(b))).rows;check();if(rows.length>1)fail('EXECUTION_CORRUPT');return {run:run.projection,record:rows.length?decodeExecutionRow(rows[0],b):null};}
 async function readCurrentOnClient(client,value,outerCheck=()=>{}){
  const v=own(value,['binding'],['signal','deadlineMs']),b=data(v.binding);validateShape('RunBinding',b);
  if(typeof client?.query!=='function'||typeof outerCheck!=='function'||v.deadlineMs!==undefined&&(!Number.isSafeInteger(v.deadlineMs)||v.deadlineMs<1))fail('EXECUTION_ADMISSION_REFUSED');
  let deadline=v.deadlineMs??Infinity;const check=()=>{outerCheck();if(v.signal?.aborted||now()>=deadline)fail('EXECUTION_ADMISSION_EXPIRED');};
  check();
  const run=await runRowLocked(client,b,check),saved=await load(client,b,check,run),record=saved.record;
  if(!record||['stopping','settled'].includes(record.phase)||run.sequence_end!=null||!['queued','starting','running','completed','failed','paused','waiting-for-approval'].includes(saved.run.state))fail('EXECUTION_ADMISSION_REFUSED');
  const runs=(await client.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[b.tenantId,b.conversationId])).rows.map(rowRun);check();
  if(runs.some(r=>r.projection.binding.writerFence>=b.writerFence&&!same(r.projection.binding,b)))fail('STALE_WRITER');
  deadline=Math.min(deadline,record.expiresAtMs);check();
  return data({binding:b,scopes:saved.run.scopes,policyRevision:saved.run.policyRevision,deadlineMs:record.expiresAtMs,executionSha256:hash(executionIdentity(record)),executionPhase:record.phase,run:saved.run});
 }
 return Object.freeze({readCurrentOnClient});
}
