/** Next-turn owner: the run a fresh session binds is the live latest run, or one reserved next run once the latest is terminal, retired and
 * revoked; a completed latest run also needs its captured checkpoint, a failed or cancelled one seeds a fresh session (no checkpoint). */
import {randomUUID} from 'node:crypto';
import {own,bounded,validateShape,fail,terminal,same,uuid} from './boundary.mjs';
export function createNextRunOwner({store,retirement,revocation,versions,now=Date.now,newId=randomUUID}){
 const journal=store?.nextRuns;
 if(!journal||['reserve','readTarget','listRuns','latestCheckpoint','current'].some(k=>typeof journal[k]!=='function')||typeof retirement?.verifyRetired!=='function'||typeof revocation?.verifyRevoked!=='function'||typeof now!=='function'||typeof newId!=='function')fail('NEXT_RUN_CONFIGURATION');
 validateShape('RuntimeVersions',versions);versions=bounded(versions);
 const checking=signal=>()=>{if(signal?.aborted)fail('NEXT_RUN_CANCELLED');};
 /** Selection under the conversation lock; a pending reservation is returned unchanged, a live run is bound as is, a terminal run yields its
  * reserved successor only after its original is physically retired and its grants revoked (a nonterminal crashed run is first settled by the run reconciler). */
 async function selectRun({principal,conversationId,signal}){const p=own(bounded(principal),['tenantId','actorId']);uuid(conversationId);const check=checking(signal);
  const {runs,reservations}=await journal.listRuns({tenantId:p.tenantId,conversationId},check);if(!runs.length)fail('NEXT_RUN_NO_CONVERSATION');
  const latest=runs.at(-1);if(latest.binding.actorId!==p.actorId)fail('NEXT_RUN_OWNER_REFUSED');
  const pending=reservations.find(r=>r.state==='RESERVED'&&r.source.runId===latest.binding.runId);if(pending)return {binding:pending.target,source:latest.binding,reserved:true,replayed:true};
  if(!terminal(latest.state))return {binding:latest.binding,reserved:false};
  const checkpoint=latest.state==='completed'?await journal.latestCheckpoint(latest.binding,check):null;if(latest.state==='completed'&&!checkpoint)fail('NEXT_RUN_CHECKPOINT_REQUIRED');
  const retired=own(bounded(await retirement.verifyRetired({binding:latest.binding,signal})),['physicalStopProven']);if(retired.physicalStopProven!==true)fail('NEXT_RUN_RETIREMENT_REQUIRED');check();
  const revoked=own(bounded(await revocation.verifyRevoked({binding:latest.binding,signal})),['receiptSha256','grantIds']);check();
  const target={tenantId:p.tenantId,actorId:p.actorId,conversationId,runId:newId(),attemptId:newId(),workerId:newId(),writerFence:latest.binding.writerFence+1};
  const r=await journal.reserve({source:latest.binding,target,facts:{checkpoint,retirement:{physicalStopProven:true},revocation:revoked},scopes:latest.scopes,versions,policyRevision:latest.policyRevision,reservedAt:new Date(now()).toISOString()},check);
  return {binding:r.target,source:latest.binding,reserved:true,replayed:r.replayed};
 }
 /** Current-run join for a session-bound binding: a reserved target of the conversation, or its live latest run; anything else is stale. */
 async function currentRun(binding,{signal}={}){const b=bounded(binding);validateShape('RunBinding',b);const check=checking(signal);
  return journal.current(b,check);
 }
 return Object.freeze({selectRun,currentRun});
}
