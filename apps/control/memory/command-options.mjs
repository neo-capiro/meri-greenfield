/** Prepare immutable reviewed text/scope only. Candidate submission belongs to a separately approved execution owner. */
import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {normalizeMemoryProposeInput} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {commandToolValidators} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {createCommandApprovalMetadataOwner} from '../commands/approval-metadata/index.mjs';
import {assertMemoryProposeProposal} from '../commands/approval-metadata/memory-kind.mjs';
import {createCommandIntentPreparer} from '../intents/command-preparer.mjs';
import {intentFault} from '../intents/faults.mjs';
export const MEMORY_COMMAND_OPERATION=Object.freeze({id:'save_memory',version:'0.2.0'});
const same=(a,b)=>hash(a)===hash(b);
export function createMemoryIntentPreparer({source,metadataStore,binding,scopes,selectedClientId,now,maxRequestMs,deadlineMs,newId=randomUUID}){
 const selected=data({binding,scopes,selectedClientId});assertNativeConversationScope(selected);
 if(typeof source?.checkScope!=='function'||typeof newId!=='function'||typeof now!=='function'||
  !Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||!Number.isSafeInteger(deadlineMs))throw intentFault('INTENT_CONFIGURATION');
 const commandContext=data({binding:selected.binding,conversationClientId:selectedClientId});
 return Object.freeze({owner:'memory',operation:MEMORY_COMMAND_OPERATION,binding:selected.binding,
  async prepare(value){
   const {arguments:raw,deliveryId,signal}=own(value,['arguments','deliveryId'],['signal']);
   let request,input;
   try{
    if(typeof deliveryId!=='string'||!/^sdk:[a-f0-9]{64}$/u.test(deliveryId))throw Error();
    request=data(raw);if(Object.hasOwn(request,'clientId'))throw Error();
    input=normalizeMemoryProposeInput(request,commandContext);
   }catch{throw intentFault('INVALID_ARGUMENTS','none');}
   let proposalExpiresAt;
   const preparePolicy=async({phase,selection,selectionSha256,signal,limitDeadline})=>{
    if(!['prepare','before_release'].includes(phase)||selection.phase!==phase||hash(selection)!==selectionSha256||
     !same(selection.binding,selected.binding)||selection.action!=='memory.propose'||!same(selection.operation,MEMORY_COMMAND_OPERATION)||!same(selection.request,request))throw intentFault('ACCESS_DENIED','none');
    const began=now(),current=data(own(await source.checkScope({arguments:input,signal}),['binding','scopes','checkedAtMs','expiresAtMs']));
    if(!same(current.binding,selected.binding)||!same(current.scopes,selected.scopes)||!Number.isSafeInteger(current.checkedAtMs)||current.checkedAtMs<began||current.checkedAtMs>now()||
     !Number.isSafeInteger(current.expiresAtMs)||current.expiresAtMs<=now())throw intentFault('ACCESS_DENIED','none');
    proposalExpiresAt??=new Date(Math.min(deadlineMs,current.expiresAtMs)).toISOString();
    const cutoff=Math.min(deadlineMs,current.expiresAtMs,Date.parse(proposalExpiresAt));limitDeadline(cutoff);
    return {authorized:true,selectionSha256,binding:selected.binding,scopes:selected.scopes,
     requiredApprover:{tenantId:selected.binding.tenantId,actorId:selected.binding.actorId},proposalExpiresAt,checkedAtMs:current.checkedAtMs,expiresAtMs:cutoff};
   };
   const approvalMetadataOwner=createCommandApprovalMetadataOwner({store:metadataStore,commandContext,preparePolicy,now,maxRequestMs,newId},'memory.propose');
   const preparer=createCommandIntentPreparer({commandOptions:{operation:MEMORY_COMMAND_OPERATION,action:'memory.propose',outputShape:'MemoryProposeToolResult',commandContext,
    validators:commandToolValidators,assertProposal:assertMemoryProposeProposal,approvalMetadataOwner,executor:{execute(){throw intentFault('INTENT_EXECUTION_REFUSED');}},now,limits:{maxRequestMs,maxFactBytes:131072}}});
   return preparer.prepare({arguments:request,signal});
  },
 });
}