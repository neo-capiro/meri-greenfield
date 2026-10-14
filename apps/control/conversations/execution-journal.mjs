/** Native launch metadata in the canonical run store; no external effects in transaction. */
import {own,data,hash,same,validateShape,fail} from './boundary.mjs';
import {assertNativeExecution} from './execution-boundary.mjs';
const phases=new Set(['launching','unknown','started','retired']);
function identity(value){const v=data(value);own(v,['binding','executionKey','executionId','planSha256','expiresAtMs']);validateShape('RunBinding',v.binding);
 if(v.executionKey!==hash(v.binding)||v.executionId!==v.executionKey||!/^[a-f0-9]{64}$/u.test(v.planSha256)||!Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<1)fail('EXECUTION_REFUSED');return v;}
export function createExecutionJournal({tx,rowRun,verifyPreparedClaim}){
 const args=b=>[b.tenantId,b.conversationId,b.runId];
 function decode(row,b,versions){if(!row||row.record_sha256!==hash(row.record))fail('EXECUTION_CORRUPT');const r=data(row.record);own(r,['binding','executionKey','executionId','planSha256','expiresAtMs','phase','native']);
  identity({binding:r.binding,executionKey:r.executionKey,executionId:r.executionId,planSha256:r.planSha256,expiresAtMs:r.expiresAtMs});
  if(!same(r.binding,b)||row.tenant_id!==b.tenantId||row.conversation_id!==b.conversationId||row.run_id!==b.runId||row.execution_key!==r.executionKey||row.execution_id!==r.executionId||!phases.has(r.phase))fail('EXECUTION_CORRUPT');coherent(r,versions);return r;}
 function coherent(r,versions){if(['launching','unknown'].includes(r.phase)){if(r.native!==null)fail('EXECUTION_CORRUPT');}
  else{const fact=assertNativeExecution(r.native,{...r,versions});if((r.phase==='retired')!==fact.physicalStopProven)fail('EXECUTION_CORRUPT');}}
 async function load(c,b,check){const run=rowRun((await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',args(b))).rows[0]);check();if(!same(run.projection.binding,b))fail('STALE_WRITER');
  const rows=(await c.query('SELECT * FROM meri_conversations.native_executions WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',args(b))).rows;check();if(rows.length>1)fail('EXECUTION_CORRUPT');return {run:run.projection,record:rows.length?decode(rows[0],b,run.projection.versions):null};}
 async function claim(value,check){const original=identity(value),b=original.binding;return tx(b,check,async c=>{const saved=await load(c,b,check);
  if(saved.record){const {phase,native,...prior}=saved.record;if(!same(prior,original))fail('EXECUTION_REPLAY_REFUSED');return {...saved,dispatch:false};}
  if(saved.run.state!=='queued'){if(!['starting','running'].includes(saved.run.state)||typeof verifyPreparedClaim!=='function')fail('EXECUTION_NOT_QUEUED');await verifyPreparedClaim(c,original,saved.run.versions,check);check();}const record=data({...original,phase:'launching',native:null});
  await c.query('INSERT INTO meri_conversations.native_executions(tenant_id,conversation_id,run_id,execution_key,execution_id,record,record_sha256) VALUES($1,$2,$3,$4,$5,$6,$7)',[...args(b),record.executionKey,record.executionId,record,hash(record)]);check();return {run:saved.run,record,dispatch:true};});}
 async function read(binding,check){const b=data(binding);validateShape('RunBinding',b);return tx(b,check,c=>load(c,b,check));}
 async function record(value,check){const v=data(value);own(v,['binding','executionId','phase','native']);validateShape('RunBinding',v.binding);if(!phases.has(v.phase))fail('EXECUTION_REFUSED');
  return tx(v.binding,check,async c=>{const saved=await load(c,v.binding,check),old=saved.record;if(!old||old.executionId!==v.executionId)fail('EXECUTION_REFUSED');
   const transitions={launching:['started','unknown','retired'],unknown:['unknown','started','retired'],started:['started','retired'],retired:['retired']};
   if(!transitions[old.phase].includes(v.phase)||old.native?.taskId&&v.native?.taskId!==old.native.taskId||old.phase==='retired'&&!same(old.native,v.native))fail('EXECUTION_TRANSITION_REFUSED');
   const next=data({...old,phase:v.phase,native:v.native});coherent(next,saved.run.versions);await c.query('UPDATE meri_conversations.native_executions SET record=$4,record_sha256=$5 WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[...args(v.binding),next,hash(next)]);check();return {...saved,record:next};});}
 return Object.freeze({claim,read,record});
}
