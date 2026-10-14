/** Next-turn owner: the run a fresh session binds is the live latest run, or one reserved next run once the latest is completed, captured, retired and revoked. */
import {randomUUID} from 'node:crypto';
import {own,bounded,validateShape,fail,terminal,same,uuid} from './boundary.mjs';
export function createNextRunOwner({store,retirement,revocation,versions,now=Date.now,newId=randomUUID}){
 const journal=store?.nextRuns;
 if(!journal||['reserve','readTarget','listRuns','latestCheckpoint'].some(k=>typeof journal[k]!=='function')||typeof retirement?.verifyRetired!=='function'||typeof revocation?.verifyRevoked!=='function'||typeof now!=='function'||typeof newId!=='function')fail('NEXT_RUN_CONFIGURATION');
 validateShape('RuntimeVersions',versions);versions=bounded(versions);
 const checking=signal=>()=>{if(signal?.aborted)fail('NEXT_RUN_CANCELLED');};
 /** Selection under the conversation lock; a pending reservation is returned unchanged, a live run is bound as is, a completed run yields its reserved successor. */
 async function selectRun({principal,conversationId,signal}){const p=own(bounded(principal),['tenantId','actorId']);uuid(conversationId);const check=checking(signal);
  const {runs,reservations}=await journal.listRuns({tenantId:p.tenantId,conversationId},check);if(!runs.length)fail('NEXT_RUN_NO_CONVERSATION');
  const latest=runs.at(-1);if(latest.binding.actorId!==p.actorId)fail('NEXT_RUN_OWNER_REFUSED');
  const pending=reservations.find(r=>r.source.runId===latest.binding.runId);if(pending)return {binding:pending.target,source:latest.binding,reserved:true,replayed:true};
  if(!terminal(latest.state))return {binding:latest.binding,reserved:false};
  if(latest.state!=='completed')fail('NEXT_RUN_SOURCE_NOT_COMPLETED');
  const checkpoint=await journal.latestCheckpoint(latest.binding,check);if(!checkpoint)fail('NEXT_RUN_CHECKPOINT_REQUIRED');
  const retired=own(bounded(await retirement.verifyRetired({binding:latest.binding,signal})),['physicalStopProven']);if(retired.physicalStopProven!==true)fail('NEXT_RUN_RETIREMENT_REQUIRED');check();
  const revoked=own(bounded(await revocation.verifyRevoked({binding:latest.binding,signal})),['receiptSha256','grantIds']);check();
  const target={tenantId:p.tenantId,actorId:p.actorId,conversationId,runId:newId(),attemptId:newId(),workerId:newId(),writerFence:latest.binding.writerFence+1};
  const r=await journal.reserve({source:latest.binding,target,facts:{checkpoint,retirement:{physicalStopProven:true},revocation:revoked},scopes:latest.scopes,versions,policyRevision:latest.policyRevision,reservedAt:new Date(now()).toISOString()},check);
  return {binding:r.target,source:latest.binding,reserved:true,replayed:r.replayed};
 }
 /** Current-run join for a session-bound binding: a reserved target of the conversation, or its live latest run; anything else is stale. */
 async function currentRun(binding,{signal}={}){const b=bounded(binding);validateShape('RunBinding',b);const check=checking(signal);
  const reservation=await journal.readTarget(b,check);if(reservation)return {binding:reservation.target,reserved:true,policyRevision:reservation.policyRevision,scopes:reservation.scopes};
  const {runs}=await journal.listRuns({tenantId:b.tenantId,conversationId:b.conversationId},check);const latest=runs.at(-1);if(!latest||!same(latest.binding,b))fail('NEXT_RUN_NOT_LATEST');
  return {binding:latest.binding,reserved:false,policyRevision:latest.policyRevision,scopes:latest.scopes};
 }
 return Object.freeze({selectRun,currentRun});
}
