/** Next-turn owner: a fresh session binds the live latest run, or one reserved next run once the latest logical execution is settled.
 * A warm Runtime session is not an active writer. The next run continues the
 * conversation's latest completed native SDK session (or real historical checkpoint); no completed turn yet means a fresh session. */
import {randomUUID} from 'node:crypto';
import {own,bounded,validateShape,fail,terminal,same,uuid} from './boundary.mjs';
export function createNextRunOwner({store,versions,now=Date.now,newId=randomUUID}){
 const journal=store?.nextRuns;
 if(!journal||['reserve','readTarget','listRuns','latestCheckpoint','settlement','current'].some(k=>typeof journal[k]!=='function')||typeof now!=='function'||typeof newId!=='function')fail('NEXT_RUN_CONFIGURATION');
 validateShape('RuntimeVersions',versions);versions=bounded(versions);
 const checking=signal=>()=>{if(signal?.aborted)fail('NEXT_RUN_CANCELLED');};
 /** Read-only source settlement before reservation; the journal rechecks the same record under its write transaction. */
 async function settlement(latest,signal,check){
  const sdkSession=journal.latestSession?await journal.latestSession(latest.binding,check):null;
  const checkpoint=sdkSession?null:await journal.latestCheckpoint(latest.binding,check);if(latest.state==='completed'&&!checkpoint&&!sdkSession)fail('NEXT_RUN_CHECKPOINT_REQUIRED');
  const execution=await journal.settlement(latest.binding,check);check();const facts={checkpoint,execution};
  return sdkSession?{...facts,sdkSession}:facts;
 }
 /** An explicit turn reports a refusal while gathering those facts as NEXT_RUN_SOURCE_UNSETTLED: nothing was reserved, so it may be
  * retried once the source settles. An abort stays an abort; this path never invokes or stops a runtime. */
 async function explicitSettlement(latest,signal,check,options){try{return await settlement(latest,signal,check,options);}catch(error){if(signal?.aborted)throw error;throw Object.assign(new Error('NEXT_RUN_SOURCE_UNSETTLED',{cause:error}),{code:'NEXT_RUN_SOURCE_UNSETTLED'});}}
 /** Selection under the conversation lock; a pending reservation is returned unchanged, a live run is bound as is, a terminal run yields its
  * reserved successor only after the SDK invocation has settled (a nonterminal crashed run is first settled by the run reconciler).
  * A session that names its exact `runId` never reserves: it binds that terminal latest run read-only (its next turn is reserved only by an
  * explicit turn, which retains the request identity), and any other terminal run is not current. Hints constrain; they never create. */
 async function select({principal,conversationId,signal,expectedSourceRunId,runId},{explicit=false}={}){const p=own(bounded(principal),['tenantId','actorId']);uuid(conversationId);if(expectedSourceRunId!==undefined)uuid(expectedSourceRunId);if(runId!==undefined)uuid(runId);const check=checking(signal);
  const {runs,reservations}=await journal.listRuns({tenantId:p.tenantId,conversationId},check);if(!runs.length)fail('NEXT_RUN_NO_CONVERSATION');
  const latest=runs.at(-1);if(latest.binding.actorId!==p.actorId)fail('NEXT_RUN_OWNER_REFUSED');
  if(expectedSourceRunId!==undefined&&latest.binding.runId!==expectedSourceRunId)fail('NEXT_RUN_NOT_LATEST');
  const pending=reservations.find(r=>r.state==='RESERVED'&&r.source.runId===latest.binding.runId);if(pending)return {binding:pending.target,source:latest.binding,reserved:true,replayed:true};
  if(!terminal(latest.state))return {binding:latest.binding,reserved:false};
  if(runId!==undefined){if(latest.binding.runId!==runId)fail('NEXT_RUN_NOT_LATEST');return {binding:latest.binding,reserved:false};}
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
 /** Content-free next-turn eligibility for an exact source, without creating identifiers, reservation writes or revocation effects.
  * This is a snapshot under the same journal guards as reserve; the eventual send still rechecks fresh authority and source state. */
 async function assessNextTurn({principal,conversationId,sourceRunId,signal}){
  const p=own(bounded(principal),['tenantId','actorId']);uuid(conversationId);uuid(sourceRunId);const check=checking(signal);
  if(typeof journal.assess!=='function')fail('NEXT_RUN_READINESS_UNAVAILABLE');
  const {runs}=await journal.listRuns({tenantId:p.tenantId,conversationId},check),source=runs.find(r=>r.binding.runId===sourceRunId);check();
  if(!source||runs.some(r=>r.binding.actorId!==p.actorId))fail('NEXT_RUN_OWNER_REFUSED');
  if(!same(runs.at(-1).binding,source.binding))return {admissible:false,reason:'NEXT_RUN_NOT_LATEST'};
  if(!terminal(source.state))return {admissible:false,reason:'NEXT_RUN_SOURCE_NOT_TERMINAL'};
  try{
   const facts=await explicitSettlement(source,signal,check);
   return await journal.assess({source:source.binding,facts,scopes:source.scopes,versions,policyRevision:source.policyRevision},check);
  }catch(error){
   if(signal?.aborted)throw error;
   if(['NEXT_RUN_SOURCE_UNSETTLED','NEXT_RUN_EXECUTION_UNSETTLED','NEXT_RUN_CHECKPOINT_REQUIRED','NEXT_RUN_CHECKPOINT_REFUSED','NEXT_RUN_SCOPE_REFUSED','NEXT_RUN_NOT_LATEST','NEXT_RUN_SOURCE_NOT_TERMINAL','NEXT_RUN_REPLAY_REFUSED','NEXT_TURN_SDK_CHANGED','NEXT_TURN_FORMAT_CHANGED'].includes(error?.code))return {admissible:false,reason:error.code};
   throw error;
  }
 }
 return Object.freeze({selectRun,currentRun,admitTurn,assessNextTurn});
}
