/** Correlates the existing opaque session owner before and after trusted operations. Issues no sessions or approvals. */
import {own,data,CommandError} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateCommandShape,assertTaskUpdateProposal} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {createCommandToolInterface} from '../commands/tool-interface.mjs';
import {createRequestCurrent,same,refuse} from '../action-host/current.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
export function createTaskCommandSessionResolver(configuration){
 const c=own(configuration,['sessions','commandOptions','selectedClientId','authorizeExecution','now']),options=c.commandOptions;
 createCommandToolInterface(options);validateCommandShape('TaskUpdateContext',options.commandContext);
 if(typeof c.authorizeExecution!=='function'||typeof c.now!=='function'||typeof c.selectedClientId!=='string')refuse();
 const ports={authenticateSession:storageMethod(c.sessions,'authenticateSession'),readCurrentState:storageMethod(c.sessions,'readCurrentState')};
 // The selected client is trusted host configuration. The canonical session correlator checks its current client scope.
 const commandContext=data({binding:options.commandContext.binding,clientResolution:{reference:c.selectedClientId,clientId:c.selectedClientId}});
 async function resolve(value){
  const call=own(value,['credential','intent','deadlineMs'],['signal']);
  if(!['prepare','execute'].includes(call.intent))refuse();
  const current=createRequestCurrent({...call,ports,now:c.now,commandContext,maxBytes:options.limits.maxFactBytes});
  function guarded(invoke,knownOutcome){return async(...args)=>{
   const signal=args[0]?.signal??args[2];let acknowledged=false,acknowledgedOutcome;
   try{return await current.run(signal,async lifetime=>{
    await current.fresh(lifetime);
    const result=await lifetime.run(async signal=>{const out=await invoke(args,signal,current.deadline());acknowledgedOutcome=typeof knownOutcome==='function'?knownOutcome(out):knownOutcome;acknowledged=true;return out;});
    await current.fresh(lifetime);current.check(lifetime);return result;
   });}catch(error){if(acknowledged)throw Object.assign(new CommandError('ACCESS_DENIED'),{outcome:acknowledgedOutcome});throw error;}
  };}
  const metadata=options.approvalMetadataOwner;
  const commandOptions={...options,
   approvalMetadataOwner:{
    prepare:guarded(([v],signal,deadlineMs)=>metadata.prepare({...v,deadlineMs:Math.min(v.deadlineMs,deadlineMs),signal}),'STORED_NOT_RELEASED'),
    read:guarded(([v],signal,deadlineMs)=>metadata.read({...v,deadlineMs:Math.min(v.deadlineMs,deadlineMs),signal}),'READ_UNAVAILABLE')},
   executor:{execute:guarded(([payload,credential],signal)=>options.executor.execute(payload,credential,signal),result=>data(result).status==='observed'?'RESULT_NOT_RELEASED':'UNKNOWN')}};
  return current.run(call.signal,async lifetime=>{
   const facts=await current.fresh(lifetime);
   if(call.intent==='prepare'&&!same(facts.current.binding,options.commandContext.binding))refuse();
   return Object.freeze({binding:facts.current.binding,commandOptions,checkedAtMs:c.now(),expiresAtMs:current.deadline(),
    async authorizeExecution(value){
     const v=own(value,['proposal','deadlineMs'],['signal']);assertTaskUpdateProposal(v.proposal,options.commandContext);
     if(!Number.isSafeInteger(v.deadlineMs))refuse();
     return current.run(v.signal,async issue=>{
      issue.limitDeadline(v.deadlineMs);issue.check();
      const fresh=await current.fresh(issue);
      const issued=data(await issue.run(signal=>c.authorizeExecution({...fresh,proposal:v.proposal,signal,deadlineMs:Math.min(v.deadlineMs,current.deadline())})));
      own(issued,['execution','credential']);
      await current.fresh(issue);current.check(issue);return issued;
     });
    }});
  });
 }
 return Object.freeze({resolve});
}
