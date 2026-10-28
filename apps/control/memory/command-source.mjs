/** Check preparation authority without effects, or submit an already-authorized command through the existing producer.
 * The intent journal owns preparation replay; the candidate journal owns submission uncertainty and Core owns publication. */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {assertMemoryProposeCommand,validateCommandShape} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {intentFault} from '../intents/faults.mjs';
import {assertProposalScope} from './eligibility.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);

export function createMemoryCommandSource({binding,scopes,selectedClientId,policyRevision,readCurrent,producerFor,now,maxRequestMs,deadlineMs}){
 const pinned=data({binding,scopes,selectedClientId,policyRevision}),commandContext=data({binding,conversationClientId:selectedClientId});
 assertNativeConversationScope(pinned);
 if(scopes.some(s=>s.policyRevision!==policyRevision)||typeof readCurrent!=='function'||typeof producerFor!=='function'||typeof now!=='function'||
  !Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||!Number.isSafeInteger(deadlineMs))throw intentFault('INTENT_CONFIGURATION');
 async function run({command:raw,arguments:input,signal},preparing){
  let command;
  try{if(!preparing){command=assertMemoryProposeCommand(raw,commandContext);if(!same(command.scopes,pinned.scopes))throw Error();}
   else {input=data(input);validateCommandShape('MemoryProposeArguments',input);
    if(input.clientId!==(input.scope==='client'?selectedClientId:null))throw Error();}}
  catch{throw intentFault('INVALID_ARGUMENTS','none');}
  let cutoff=Math.min(deadlineMs,now()+maxRequestMs);
  let life;
  try{life=createOperationLifetime({deadlineMs:cutoff,now,signal,errorFactory:code=>intentFault(code,'none')});}
  catch(error){throw intentFault(error?.code==='CANCELLED'?'CANCELLED':'DEADLINE','none');}
  let attempted=false;
  async function checkCurrent({signal:currentSignal}={}){
   const started=now();
   const r=data(own(await life.run(s=>readCurrent({signal:currentSignal??s,deadlineMs:cutoff})),
    ['binding','scopes','selectedClientId','policyRevision','checkedAtMs','expiresAtMs']));
   if(!same({binding:r.binding,scopes:r.scopes,selectedClientId:r.selectedClientId,policyRevision:r.policyRevision},pinned)||
    !Number.isSafeInteger(r.checkedAtMs)||r.checkedAtMs<started||r.checkedAtMs>now()||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=now())throw intentFault('ACCESS_DENIED');
   cutoff=Math.min(cutoff,r.expiresAtMs);life.limitDeadline(cutoff);life.check();return r;
  }
  try{
   await checkCurrent();
   const owner=await life.run(s=>producerFor({signal:s,deadlineMs:cutoff,checkCurrent}));
   if(!Number.isSafeInteger(owner.expiresAtMs)||owner.expiresAtMs<=now())throw intentFault('ACCESS_DENIED');
   cutoff=Math.min(cutoff,owner.expiresAtMs);life.limitDeadline(cutoff);life.check();
   const principal=data(owner.principal);
   if(principal.tenantId!==pinned.binding.tenantId||principal.actorId!==pinned.binding.actorId||pinned.selectedClientId!==null&&!principal.clientIds?.includes(pinned.selectedClientId))throw intentFault('ACCESS_DENIED');
   assertProposalScope(principal,preparing?input:command.arguments);
   if(preparing){
    await life.run(s=>owner.recheck({signal:s,deadlineMs:cutoff}));life.check();
    return data({binding:pinned.binding,scopes:pinned.scopes,checkedAtMs:now(),expiresAtMs:cutoff});
   }
   const commandSha256=canonicalSha256(command);
   // Once the producer is entered, a journal row or Core receipt may exist even when submission or final authority fails.
   attempted=true;
   const candidate=await life.run(s=>owner.producer.proposeFromCommand({principal,command,commandContext,commandSha256,signal:s,deadlineMs:cutoff}));
   await life.run(s=>owner.recheck({signal:s,deadlineMs:cutoff}));
   life.check();
   if(candidate.review.status!=='pending')throw intentFault('UNKNOWN');
   const result=data({candidateId:candidate.candidateId,commandSha256,status:'pending'});validateCommandShape('MemoryProposeResult',result);
   return result;
  }catch(error){
   const code=['ACCESS_DENIED','INVALID_ARGUMENTS','DEADLINE','CANCELLED'].includes(error?.code)?error.code:'REFUSED';
   throw intentFault(attempted?'UNKNOWN':code,attempted?'unknown':'none');
  }finally{life.close();}
 }
 return Object.freeze({
  // Permission-only preparation: no candidate, keyed target lookup, submission or publication.
  checkScope:value=>run(value,true),
  propose:value=>run(value,false),
 });
}
