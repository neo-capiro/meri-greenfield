/** Private invocation identity in the canonical run store. A warm host is not a run. */
import {own,data,hash,same,validateShape,fail} from './boundary.mjs';
const phases=new Set(['launching','unknown','started','stopping','settled']);
const outcomes=new Set(['completed','failed','cancelled','paused','waiting-for-approval']);
export const isExecutionOutcome=state=>outcomes.has(state);
/** A later canonical cancellation cannot restart an invocation that already drained in a held state. */
export const executionOutcomeSettled=(record,state)=>record?.phase==='settled'&&(record.native.state===state||state==='cancelled'&&['paused','waiting-for-approval'].includes(record.native.state));
export function assertExecutionIdentity(value){
 const v=data(value);own(v,['binding','executionKey','executionId','planSha256','expiresAtMs','runtimeSessionId']);validateShape('RunBinding',v.binding);
 if(v.executionKey!==hash(v.binding)||v.executionId!==v.executionKey||! /^[a-f0-9]{64}$/u.test(v.planSha256)||!Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<1||typeof v.runtimeSessionId!=='string'||! /^[A-Za-z0-9][A-Za-z0-9_-]{32,255}$/u.test(v.runtimeSessionId))fail('EXECUTION_REFUSED');return v;
}
export function createExecutionBinding(configuration){
 const c=own(configuration,['binding','versions','plan','expiresAtMs','runtimeSessionId']),binding=data(c.binding),versions=data(c.versions);validateShape('RuntimeVersions',versions);
 const executionKey=hash(binding);return {...assertExecutionIdentity({binding,executionKey,executionId:executionKey,planSha256:hash({binding,versions,plan:data(c.plan)}),expiresAtMs:c.expiresAtMs,runtimeSessionId:c.runtimeSessionId}),versions};
}
export function executionIdentity(record){const {phase,native,...identity}=record;return assertExecutionIdentity(identity);}
export function decodeExecutionRow(row,binding){
 if(!row||row.record_sha256!==hash(row.record))fail('EXECUTION_CORRUPT');const r=data(row.record);own(r,['binding','executionKey','executionId','planSha256','expiresAtMs','runtimeSessionId','phase','native']);executionIdentity(r);
 if(!same(r.binding,binding)||row.tenant_id!==binding.tenantId||row.conversation_id!==binding.conversationId||row.run_id!==binding.runId||row.execution_key!==r.executionKey||row.execution_id!==r.executionId||!phases.has(r.phase))fail('EXECUTION_CORRUPT');
 if(r.phase==='settled'){own(r.native,['state'],['stopped']);if(!isExecutionOutcome(r.native.state)||Object.hasOwn(r.native,'stopped')&&r.native.stopped!==true)fail('EXECUTION_CORRUPT');}else if(r.native!==null)fail('EXECUTION_CORRUPT');return r;
}
/** Historical evidence only. Never creates, grants, restores or stops a legacy allocation. */
export async function readLegacySettlement(c,binding,check){
 const rows=(await c.query('SELECT * FROM meri_conversations.native_allocations WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[binding.tenantId,binding.conversationId,binding.runId])).rows;check();
 if(!rows.length)return null;if(rows.length!==1)fail('NEXT_RUN_EXECUTION_UNSETTLED');const row=rows[0],record=row.record;
 if(row.tenant_id!==binding.tenantId||row.conversation_id!==binding.conversationId||row.run_id!==binding.runId||hash(record)!==row.record_sha256)fail('NEXT_RUN_EXECUTION_UNSETTLED');
 const foreclosed=record.state==='FORECLOSED'&&same(record.binding,binding)&&record.allocationKey===hash(binding)&&['failed','cancelled'].includes(record.foreclosure?.state)&&/^[a-f0-9]{64}$/u.test(record.foreclosure?.eventSha256);
 const retired=record.state==='RETIRED'&&record.resource?.physicalStopProven===true&&same(record.original?.binding,binding)&&/^[a-f0-9]{64}$/u.test(record.allocationSha256)&&Array.isArray(record.grantIntents)&&record.grantIntents.length>0;
 if(!foreclosed&&!retired)fail('NEXT_RUN_EXECUTION_UNSETTLED');return {record,recordSha256:row.record_sha256};
}
/** The caller already owns the canonical conversation/run lock. No effect or nested transaction. */
export async function readExecutionSettlement(c,binding,state,check,{historicalCompleted=false}={}){
 const rows=(await c.query('SELECT * FROM meri_conversations.native_executions WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',[binding.tenantId,binding.conversationId,binding.runId])).rows;check();
 if(!rows.length){
  if(state==='failed'||state==='cancelled'){await readLegacySettlement(c,binding,check);return null;}
  // Only a caller that has verified the same source's published historical completion may use this receipt.
  // It describes retired compute; it never creates an AgentCore execution or permits warm-session reuse.
  if(state==='completed'&&historicalCompleted===true){const saved=await readLegacySettlement(c,binding,check);if(saved?.record.state==='RETIRED')return {legacy:saved.record,recordSha256:saved.recordSha256};}
  fail('NEXT_RUN_EXECUTION_UNSETTLED');
 }
 if(rows.length!==1)fail('EXECUTION_CORRUPT');const record=decodeExecutionRow(rows[0],binding);
 if(!executionOutcomeSettled(record,state))fail('NEXT_RUN_EXECUTION_UNSETTLED');return {record,recordSha256:rows[0].record_sha256};
}
