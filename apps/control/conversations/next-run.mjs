/** Next-turn owner: the run a fresh session binds is the live latest run, or one reserved next run once the latest is terminal, retired and
 * revoked (or failed/cancelled with the store's no-authority evidence that it never claimed an allocation); a completed latest run also needs its captured checkpoint, a failed or cancelled one seeds a fresh session (no checkpoint). */
import {randomUUID} from 'node:crypto';
import {own,bounded,validateShape,fail,terminal,same,uuid} from './boundary.mjs';
export function createNextRunOwner({store,retirement,revocation,versions,now=Date.now,newId=randomUUID}){
 const journal=store?.nextRuns;
 if(!journal||['reserve','readTarget','listRuns','latestCheckpoint','foreclosure','current'].some(k=>typeof journal[k]!=='function')||typeof retirement?.verifyRetired!=='function'||typeof revocation?.verifyRevoked!=='function'||typeof now!=='function'||typeof newId!=='function')fail('NEXT_RUN_CONFIGURATION');
 validateShape('RuntimeVersions',versions);versions=bounded(versions);
 const checking=signal=>()=>{if(signal?.aborted)fail('NEXT_RUN_CANCELLED');};
 /** The source's settlement facts, gathered before any reservation write: a completed run's captured checkpoint, or a failed/cancelled
  * run's no-authority evidence, else its proven physical stop and revoked grants. */
 async function settlement(latest,signal,check){
  const checkpoint=latest.state==='completed'?await journal.latestCheckpoint(latest.binding,check):null;if(latest.state==='completed'&&!checkpoint)fail('NEXT_RUN_CHECKPOINT_REQUIRED');
  // A failed/cancelled source that never claimed an allocation carries the store's no-authority evidence instead (re-verified by the journal).
  const noAuthority=latest.state==='completed'?null:await journal.foreclosure(latest.binding,check);check();let facts;
  if(noAuthority)facts={checkpoint:null,noAuthority:own(bounded(noAuthority),['foreclosureSha256'])};
  else{const retired=own(bounded(await retirement.verifyRetired({binding:latest.binding,signal})),['physicalStopProven']);if(retired.physicalStopProven!==true)fail('NEXT_RUN_RETIREMENT_REQUIRED');check();
   const revoked=own(bounded(await revocation.verifyRevoked({binding:latest.binding,signal})),['receiptSha256','grantIds']);check();facts={checkpoint,retirement:{physicalStopProven:true},revocation:revoked};}
  return facts;
 }
 /** An explicit turn reports a refusal while gathering those facts as NEXT_RUN_SOURCE_UNSETTLED: nothing was reserved, so it may be
  * retried once the source settles (completion cleanup still retiring the original, or a pending reconciliation). An abort stays an abort. */
 async function explicitSettlement(latest,signal,check){try{return await settlement(latest,signal,check);}catch(error){if(signal?.aborted)throw error;throw Object.assign(new Error('NEXT_RUN_SOURCE_UNSETTLED',{cause:error}),{code:'NEXT_RUN_SOURCE_UNSETTLED'});}}
 /** Selection under the conversation lock; a pending reservation is returned unchanged, a live run is bound as is, a terminal run yields its
  * reserved successor only after its original is physically retired and its grants revoked (a nonterminal crashed run is first settled by the run reconciler). */
 async function select({principal,conversationId,signal,expectedSourceRunId},{explicit=false}={}){const p=own(bounded(principal),['tenantId','actorId']);uuid(conversationId);if(expectedSourceRunId!==undefined)uuid(expectedSourceRunId);const check=checking(signal);
  const {runs,reservations}=await journal.listRuns({tenantId:p.tenantId,conversationId},check);if(!runs.length)fail('NEXT_RUN_NO_CONVERSATION');
  const latest=runs.at(-1);if(latest.binding.actorId!==p.actorId)fail('NEXT_RUN_OWNER_REFUSED');
  if(expectedSourceRunId!==undefined&&latest.binding.runId!==expectedSourceRunId)fail('NEXT_RUN_NOT_LATEST');
  const pending=reservations.find(r=>r.state==='RESERVED'&&r.source.runId===latest.binding.runId);if(pending)return {binding:pending.target,source:latest.binding,reserved:true,replayed:true};
  if(!terminal(latest.state))return {binding:latest.binding,reserved:false};
  const facts=await (explicit?explicitSettlement:settlement)(latest,signal,check);
  const target={tenantId:p.tenantId,actorId:p.actorId,conversationId,runId:newId(),attemptId:newId(),workerId:newId(),writerFence:latest.binding.writerFence+1};
  const r=await journal.reserve({source:latest.binding,target,facts,scopes:latest.scopes,versions,policyRevision:latest.policyRevision,reservedAt:new Date(now()).toISOString()},check);
  return {binding:r.target,source:latest.binding,reserved:true,replayed:r.replayed};
 }
 const selectRun=args=>select(args);
 /** Current-run join for a session-bound binding: a reserved target of the conversation, or its live latest run; anything else is stale. */
 async function currentRun(binding,{signal}={}){const b=bounded(binding);validateShape('RunBinding',b);const check=checking(signal);
  return journal.current(b,check);
 }
 /** Explicit turn command identity is its source run. Recover its original journal mapping even after acceptance; never select a later
  * successor on replay. Returning an old target is a read receipt only and cannot make it eligible for execution. */
 async function admitTurn({principal,conversationId,sourceRunId,signal}){
  const p=own(bounded(principal),['tenantId','actorId']);uuid(conversationId);uuid(sourceRunId);const check=checking(signal);
  const {runs,reservations}=await journal.listRuns({tenantId:p.tenantId,conversationId},check),source=runs.find(r=>r.binding.runId===sourceRunId);
  if(!source||runs.some(r=>r.binding.actorId!==p.actorId))fail('NEXT_RUN_OWNER_REFUSED');
  const prior=reservations.find(r=>r.source.runId===sourceRunId);
  if(prior){validateShape('RunBinding',prior.target);if(!same(prior.source,source.binding)||prior.target.tenantId!==p.tenantId||prior.target.actorId!==p.actorId||prior.target.conversationId!==conversationId||
   prior.target.writerFence!==source.binding.writerFence+1||prior.target.runId===sourceRunId||prior.state==='ACCEPTED'&&!runs.some(r=>same(r.binding,prior.target)))fail('NEXT_RUN_OWNER_REFUSED');
   return {sourceBinding:prior.source,targetBinding:prior.target,state:prior.state,replayed:true};}
  if(!terminal(source.state))fail('NEXT_RUN_SOURCE_NOT_TERMINAL');
  const selected=await select({principal:p,conversationId,signal,expectedSourceRunId:sourceRunId},{explicit:true});check();
  if(!selected.reserved||!same(selected.source,source.binding))fail('NEXT_RUN_NOT_LATEST');
  return {sourceBinding:selected.source,targetBinding:selected.binding,state:'RESERVED',replayed:selected.replayed===true};
 }
 return Object.freeze({selectRun,currentRun,admitTurn});
}
