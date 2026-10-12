/** One approved command coordinator. No polling, retries, model loop or grants. */
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {createCommandApprovalGuard} from './approval-context.mjs';
import {CommandError,CommandCommitUncertain,data,deny,nativeSignal,own,safe} from './protocol.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
export function createCommandExecutor(options){
 const {journal,authority,approvalStore,source,contracts,descriptor,context,now,newId,limits,sourceEnabled=false}=own(options,
  ['journal','authority','approvalStore','source','contracts','descriptor','context','now','newId','limits'],['sourceEnabled']);
 for(const [owner,methods]of [[journal,['claim','complete','markUnknown','read']],[authority,['check']],[source,['prepare','execute']],[contracts,['inspect','result','outcome']]])if(!owner||methods.some(k=>typeof owner[k]!=='function'))deny('COMMAND_CONFIGURATION');
 const bound=data({descriptor,context,limits});
 if(typeof now!=='function'||typeof newId!=='function'||typeof sourceEnabled!=='boolean'||['maxRequestMs','maxResponseBytes','maxCleanupMs'].some(k=>!Number.isSafeInteger(bound.limits[k])||bound.limits[k]<1)||bound.limits.maxRequestMs>3600000||bound.limits.maxCleanupMs>60000||bound.limits.maxResponseBytes>16*1024*1024)deny('COMMAND_CONFIGURATION');
 const approvals=createCommandApprovalGuard({getCurrent:approvalStore.getCurrent,now,maxFactBytes:bound.limits.maxResponseBytes});
 function admitted(value){const raw=data(value);own(raw,['proposal','execution']);const call=contracts.inspect(raw.proposal,raw.execution,bound.context);
  if(!same(bound.descriptor.operation,{id:call.proposal.command.action,version:call.proposal.command.contractVersion})||!bound.descriptor.requiredGrants.includes('command.execute'))deny('COMMAND_CONFIGURATION');return call;}
 async function operate(value,credential,signal,reading){
  if(!sourceEnabled)deny('UNAVAILABLE');const call=admitted(value),command=call.proposal.command;
  const payload=data({proposal:call.proposal,context:call.context});nativeSignal(signal);
  let deadlineMs=now()+bound.limits.maxRequestMs;
  const lifetime=createOperationLifetime({deadlineMs,now,signal,errorFactory:c=>new CommandError(c)});
  const limitDeadline=next=>{lifetime.limitDeadline(next);deadlineMs=Math.min(deadlineMs,next);};
  const active=()=>{lifetime.check();if(lifetime.signal.aborted)deny('CANCELLED');};
  let claimed=false,claimStarted=false,selection;
  const authorize=async()=>{
   const a=data(await lifetime.run(s=>authority.check({credential,descriptor:bound.descriptor,input:command,signal:s,limitDeadline})));
   validateShape('CapabilityClaims',a.claims);validateShape('AuthorizationDecision',a.decision);
   if(!same(a.binding,call.execution.executorBinding)||a.claims.capabilityId!==call.execution.capabilityId||!a.claims.actions.includes('command.execute')||!same(a.decision.scopes,command.scopes))deny('COMMAND_AUTHORITY_REFUSED');
   const {authorizationDecisionId:ignored,...current}=a.subject;
   if(selection&&!same(selection,current))deny('COMMAND_AUTHORITY_REFUSED');selection??=current;
   limitDeadline(a.deadlineMs);active();return a;
  };
  try{
   const first=await authorize();
   if(reading){
    const row=await lifetime.run(()=>journal.read(payload,active));const final=await authorize();
    if(first.policyRevision!==final.policyRevision)deny('COMMAND_AUTHORITY_REFUSED');active();
    if(!row)return data({status:'absent',outcome:null});
    if(row.state!=='OUTCOME')return data({status:'indeterminate',outcome:null});
    return data({status:'observed',outcome:contracts.outcome(row.outcome,command,call.context)});
   }
   await approvals.check(call.proposal,first,lifetime);
   const prepared=await lifetime.run(s=>source.prepare({command,context:call.context,authority:first,deadlineMs:Math.min(first.deadlineMs,deadlineMs),signal:s}));
   limitDeadline(prepared.deadlineMs);
   const before=await authorize();await approvals.check(call.proposal,before,lifetime);
   if(first.policyRevision!==before.policyRevision)deny('COMMAND_AUTHORITY_REFUSED');
   claimStarted=true;const claim=await lifetime.run(()=>journal.claim(payload,call.execution,active));
   if(!claim.claimed){
    const fresh=await authorize();await approvals.check(call.proposal,fresh,lifetime);active();
    if(claim.row.state==='OUTCOME')return data({status:'observed',outcome:contracts.outcome(claim.row.outcome,command,call.context)});
    return data({status:'indeterminate',outcome:null});
   }
   claimed=true;const effect=await authorize();await approvals.check(call.proposal,effect,lifetime);
   if(effect.policyRevision!==first.policyRevision)deny('COMMAND_AUTHORITY_REFUSED');active();
   const result=data(contracts.result(await lifetime.run(s=>source.execute(prepared,{authority:effect,signal:s})),command,call.context));
   if(Buffer.byteLength(JSON.stringify(result))>bound.limits.maxResponseBytes)deny('INVALID_SOURCE_RESULT');
   const release=await authorize();await approvals.check(call.proposal,release,lifetime);
   if(release.policyRevision!==effect.policyRevision)deny('COMMAND_AUTHORITY_REFUSED');active();
   const receipt={receiptId:newId(),commandId:command.commandId,commandSha256:canonicalSha256(command),idempotencyKey:command.idempotencyKey,binding:release.binding,
    outcome:command.action==='artifact.file'&&!result.files.every(f=>f.status==='saved')?'indeterminate':'succeeded',sourceTransactionId:null,completedAt:new Date(now()).toISOString(),scopes:command.scopes,authorizationDecisionId:release.decision.decisionId};
   const outcome=contracts.outcome({receipt,result},command,call.context);active();
   await lifetime.run(()=>journal.complete(payload,outcome,active));
   const final=await authorize();await approvals.check(call.proposal,final,lifetime);if(final.policyRevision!==release.policyRevision)deny('COMMAND_AUTHORITY_REFUSED');active();
   return data({status:'observed',outcome});
  }catch(error){
   if(claimed){
    const cleanup=createOperationLifetime({deadlineMs:now()+bound.limits.maxCleanupMs,now,errorFactory:c=>new CommandError(c)});
    try{await cleanup.run(()=>journal.markUnknown(payload));}catch{}finally{cleanup.close();}
   }
   if(error instanceof CommandCommitUncertain)throw error;
   if(claimed||claimStarted&&lifetime.signal.aborted)deny('COMMAND_OUTCOME_UNKNOWN');
   throw safe(error);
  }finally{lifetime.close();}
 }
 return Object.freeze({sourceEnabled,execute:(v,c,s)=>operate(v,c,s,false),readOutcome:(v,c,s)=>operate(v,c,s,true)});
}
