import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {CommandError} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {prepare as assertLookupContext} from '../task-lookup/binding.mjs';
import {createRequestCurrent,data,own,same,refuse} from './current.mjs';
export function createHostResolver({services,ports,commandOptions,now,limits}){
 return async function resolveSession(value){
  const call=own(value,['credential','intent','signal','deadlineMs']);if(!['query','draft','prepare','execute'].includes(call.intent))refuse();
  const current=createRequestCurrent({...call,ports,now,commandContext:commandOptions.commandContext,maxBytes:limits.maxResponseBytes});
  function guarded(invoke,knownOutcome){return async(...args)=>{
   const callSignal=args[0]?.signal??args[2];let acknowledged=false,acknowledgedOutcome;
   try{return await current.run(callSignal,async lifetime=>{await current.fresh(lifetime);const out=await lifetime.run(async signal=>{const result=await invoke(args,signal,current.deadline());acknowledgedOutcome=typeof knownOutcome==='function'?knownOutcome(result):knownOutcome;acknowledged=true;return result;});await current.fresh(lifetime);current.check(lifetime);return out;});}
   catch(error){if(acknowledged)throw Object.assign(new CommandError('ACCESS_DENIED'),{outcome:acknowledgedOutcome});throw error;}
  };}
  return current.run(call.signal,async lifetime=>{
   let facts=await current.fresh(lifetime);if(call.intent!=='execute'&&!same(facts.current.binding,commandOptions.commandContext.binding))refuse();
   const reserved=await current.port('reserveLookup',facts,lifetime);facts=await current.fresh(lifetime);
   const issued=await current.port('issueLookupCredential',facts,lifetime);facts=await current.fresh(lifetime);
   const lookupContext=data({lookupId:reserved.lookupId,resultReference:reserved.resultReference,requestId:reserved.requestId,deliveryJson:reserved.deliveryJson,slots:reserved.slots,binding:facts.current.binding,scopes:facts.current.scopes,selectedClientId:facts.current.selectedClientId,deadlineMs:current.deadline()});
   assertLookupContext({},lookupContext,now());current.check(lifetime);
   const lookup={lookup:guarded(([v],signal,deadline)=>services.lookup.lookup({...v,context:{...v.context,deadlineMs:Math.min(v.context.deadlineMs,deadline)},signal}),'RESULT_NOT_RELEASED'),read:guarded(([v],signal,deadline)=>services.lookup.read({...v,context:{...v.context,deadlineMs:Math.min(v.context.deadlineMs,deadline)},signal}),'RESULT_NOT_RELEASED')};
   const metadata=commandOptions.approvalMetadataOwner;
   const options={...commandOptions,approvalMetadataOwner:{prepare:guarded(([v],signal,deadline)=>metadata.prepare({...v,deadlineMs:Math.min(v.deadlineMs,deadline),signal}),'STORED_NOT_RELEASED'),read:guarded(([v],signal,deadline)=>metadata.read({...v,deadlineMs:Math.min(v.deadlineMs,deadline),signal}),'READ_UNAVAILABLE')},executor:{execute:guarded(([payload,credential],signal)=>commandOptions.executor.execute(payload,credential,signal),result=>data(result).status==='observed'?'RESULT_NOT_RELEASED':'UNKNOWN')}};
   const authorizeExecution=async value=>{const v=own(value,['proposal','signal','deadlineMs']),proposal=data(v.proposal);return current.run(v.signal,async l=>{const next=await current.fresh(l),issued=await current.port('issueExecution',next,l,{proposal});validateShape('CommandExecutionRequest',issued.execution);
    if(!same(issued.execution.executorBinding,next.current.binding)||issued.execution.proposalId!==proposal.proposalId||issued.execution.commandSha256!==canonicalSha256(proposal.command)||issued.execution.commandSha256!==proposal.commandSha256||issued.execution.idempotencyKey!==proposal.command.idempotencyKey)refuse();await current.fresh(l);current.check(l);return data({execution:issued.execution,credential:issued.credential});});};
   return {lookup,lookupContext,lookupCredential:issued.credential,readContext:data({currentBinding:facts.current.binding,scopes:facts.current.scopes,deadlineMs:current.deadline()}),commandOptions:options,authorizeExecution,expiresAtMs:current.deadline(),checkedAtMs:now()};
  });
 };
}
