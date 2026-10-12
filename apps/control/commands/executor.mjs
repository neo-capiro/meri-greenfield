/** One approved command coordinator. No polling, retries, model loop or grants. */
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {createCommandApprovalGuard} from './approval-context.mjs';
import {CommandError,CommandCommitUncertain,data,deny,nativeSignal,own,safe} from './protocol.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
export function createCommandExecutor(options){
 const {journal,authority,approvalStore,source,budget,contracts,descriptor,context,now,newId,limits,sourceEnabled=false}=own(options,
  ['journal','authority','approvalStore','source','budget','contracts','descriptor','context','now','newId','limits'],['sourceEnabled']);
 for(const [owner,methods]of [[journal,['claim','complete','markUnknown','read']],[authority,['check']],[source,['prepare','execute']],[contracts,['inspect','result','outcome']],[budget,['reserve','settle','markUncertain']]])if(!owner||methods.some(k=>typeof owner[k]!=='function'))deny('COMMAND_CONFIGURATION');
 const bound=data({descriptor,context,limits});
 if(typeof now!=='function'||typeof newId!=='function'||typeof sourceEnabled!=='boolean'||['maxRequestMs','maxResponseBytes','maxCleanupMs'].some(k=>!Number.isSafeInteger(bound.limits[k])||bound.limits[k]<1)||bound.limits.maxRequestMs>3600000||bound.limits.maxCleanupMs>60000||bound.limits.maxResponseBytes>16*1024*1024)deny('COMMAND_CONFIGURATION');
 const approvals=createCommandApprovalGuard({getCurrent:approvalStore.getCurrent,now,maxFactBytes:bound.limits.maxResponseBytes});
 function admitted(value){const raw=data(value);own(raw,['proposal','execution']);const call=contracts.inspect(raw.proposal,raw.execution,bound.context);
  if(bound.descriptor.action!==call.proposal.command.action||bound.descriptor.operation.version!=='0.2.0'||!bound.descriptor.requiredGrants.includes('command.execute'))deny('COMMAND_CONFIGURATION');return call;}
 async function operate(value,credential,signal,reading){
  if(!sourceEnabled)deny('UNAVAILABLE');const call=admitted(value),command=call.proposal.command;
  const payload=data({proposal:call.proposal,context:call.context});nativeSignal(signal);
  let deadlineMs=now()+bound.limits.maxRequestMs;
  const lifetime=createOperationLifetime({deadlineMs,now,signal,errorFactory:c=>new CommandError(c)});
  const limitDeadline=next=>{lifetime.limitDeadline(next);deadlineMs=Math.min(deadlineMs,next);};
  const active=()=>{lifetime.check();if(lifetime.signal.aborted)deny('CANCELLED');};
  const approvalLifetime=Object.freeze({...lifetime,limitDeadline});
  let claimed=false,claimStarted=false,selection,reservationId,reservationAttempted=false,settled=false;
  let outputLimit=bound.limits.maxResponseBytes;
  const checkOutput=value=>{if(Buffer.byteLength(JSON.stringify(value))>outputLimit)deny('COMMAND_RESOURCE_LIMIT');};
  const ack=(raw,id,decision)=>{if(typeof raw!=='string'||Buffer.byteLength(raw)>bound.limits.maxResponseBytes)deny('COMMAND_BUDGET_UNCERTAIN');const v=data(JSON.parse(raw));own(v,['reservationId','decision']);if(v.reservationId!==id||v.decision!==decision)deny('COMMAND_BUDGET_UNCERTAIN');};
  const authorize=async()=>{
   const a=data(await lifetime.run(s=>authority.check({credential,descriptor:bound.descriptor,input:command,signal:s,limitDeadline})));
   validateShape('CapabilityClaims',a.claims);validateShape('AuthorizationDecision',a.decision);
   if(!same(a.binding,call.execution.executorBinding)||a.claims.capabilityId!==call.execution.capabilityId||!a.claims.actions.includes('command.execute')||!same(a.decision.scopes,command.scopes))deny('COMMAND_AUTHORITY_REFUSED');
   const {authorizationDecisionId:ignored,...current}=a.subject;
   if(selection&&!same(selection,current))deny('COMMAND_AUTHORITY_REFUSED');selection??=current;
   outputLimit=Math.min(outputLimit,a.claims.budgets.maxOutputBytes);limitDeadline(a.deadlineMs);active();return a;
  };
  try{
   const first=await authorize();
   if(reading){
    const row=await lifetime.run(()=>journal.read(payload,active));const final=await authorize();
    if(first.policyRevision!==final.policyRevision)deny('COMMAND_AUTHORITY_REFUSED');active();
    if(!row)return data({status:'absent',outcome:null});
    if(row.state!=='OUTCOME')return data({status:'indeterminate',outcome:null});
    const observed=data({status:'observed',outcome:contracts.outcome(row.outcome,command,call.context)});checkOutput(observed);return observed;
   }
   await approvals.check(call.proposal,first,approvalLifetime);
   const prepared=await lifetime.run(s=>source.prepare({command,context:call.context,authority:first,deadlineMs:Math.min(first.deadlineMs,deadlineMs),signal:s}));
   limitDeadline(prepared.deadlineMs);
   const before=await authorize();await approvals.check(call.proposal,before,approvalLifetime);
   if(first.policyRevision!==before.policyRevision)deny('COMMAND_AUTHORITY_REFUSED');
   claimStarted=true;const claim=await lifetime.run(()=>journal.claim(payload,call.execution,active));
   if(!claim.claimed){
    const fresh=await authorize();await approvals.check(call.proposal,fresh,approvalLifetime);active();
    if(claim.row.state==='OUTCOME'){const observed=data({status:'observed',outcome:contracts.outcome(claim.row.outcome,command,call.context)});checkOutput(observed);return observed;}
    return data({status:'indeterminate',outcome:null});
   }
   claimed=true;reservationId=newId();
   if(typeof reservationId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(reservationId))deny('COMMAND_CONFIGURATION');
   reservationAttempted=true;
   ack(await lifetime.run(signal=>budget.reserve({reservationId,binding:before.binding,operation:bound.descriptor.operation,argumentsSha256:call.proposal.commandSha256,budgets:before.claims.budgets,claims:before.claims,deadlineMs,limitDeadline,signal})),reservationId,'reserved');
   const effect=await authorize();await approvals.check(call.proposal,effect,approvalLifetime);
   if(effect.policyRevision!==first.policyRevision)deny('COMMAND_AUTHORITY_REFUSED');active();
   const result=data(contracts.result(await lifetime.run(s=>source.execute(prepared,{authority:effect,signal:s})),command,call.context));
   if(Buffer.byteLength(JSON.stringify(result))>outputLimit)deny('INVALID_SOURCE_RESULT');
   const release=await authorize();await approvals.check(call.proposal,release,approvalLifetime);
   if(release.policyRevision!==effect.policyRevision)deny('COMMAND_AUTHORITY_REFUSED');active();
   const receipt={receiptId:newId(),commandId:command.commandId,commandSha256:canonicalSha256(command),idempotencyKey:command.idempotencyKey,binding:release.binding,
    outcome:command.action==='artifact.file'&&!result.files.every(f=>f.status==='saved')?'indeterminate':'succeeded',sourceTransactionId:null,completedAt:new Date(now()).toISOString(),scopes:command.scopes,authorizationDecisionId:release.decision.decisionId};
   const outcome=contracts.outcome({receipt,result},command,call.context);checkOutput({status:'observed',outcome});active();
   ack(await lifetime.run(signal=>budget.settle({reservationId,outcome:'completed',outputBytes:Buffer.byteLength(JSON.stringify({status:'observed',outcome})),resultSha256:canonicalSha256({status:'observed',outcome}),deadlineMs,signal})),reservationId,'settled');settled=true;
   const afterSettlement=await authorize();await approvals.check(call.proposal,afterSettlement,approvalLifetime);if(afterSettlement.policyRevision!==release.policyRevision)deny('COMMAND_AUTHORITY_REFUSED');checkOutput({status:'observed',outcome});active();
   await lifetime.run(()=>journal.complete(payload,outcome,active));
   const final=await authorize();await approvals.check(call.proposal,final,approvalLifetime);if(final.policyRevision!==release.policyRevision)deny('COMMAND_AUTHORITY_REFUSED');active();
   checkOutput({status:'observed',outcome});return data({status:'observed',outcome});
  }catch(error){
   if(claimed){
    const cleanupDeadlineMs=now()+bound.limits.maxCleanupMs;
    const cleanup=createOperationLifetime({deadlineMs:cleanupDeadlineMs,now,errorFactory:c=>new CommandError(c)});
    try{if(reservationAttempted&&!settled){try{await cleanup.run(()=>budget.markUncertain(reservationId,{signal:cleanup.signal,deadlineMs:cleanupDeadlineMs}));}catch{}}
     try{await cleanup.run(()=>journal.markUnknown(payload,()=>{cleanup.check();if(cleanup.signal.aborted)deny('CANCELLED');}));}catch{}
    }finally{cleanup.close();}
   }
   if(error instanceof CommandCommitUncertain)throw error;
   if(claimed||claimStarted&&lifetime.signal.aborted)deny('COMMAND_OUTCOME_UNKNOWN');
   throw safe(error);
  }finally{lifetime.close();}
 }
 return Object.freeze({sourceEnabled,execute:(v,c,s)=>operate(v,c,s,false),readOutcome:(v,c,s)=>operate(v,c,s,true)});
}
