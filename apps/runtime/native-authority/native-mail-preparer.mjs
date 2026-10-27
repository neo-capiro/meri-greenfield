/** Prepare-only composition. Current Core rights and the existing metadata journal keep their owners. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {assertMailSendProposal,normalizeMailSendInput} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {commandToolValidators} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createCommandApprovalMetadataOwner} from '../../control/commands/approval-metadata/index.mjs';
import {createTransactionalApprovalMetadataStore} from '../../control/commands/approval-metadata/postgres-store.mjs';
import {createCommandIntentPreparer} from '../../control/intents/command-preparer.mjs';
import {intentFault} from '../../control/intents/faults.mjs';
import {CURRENT_AUTHORITY_LIMITS} from './current-authority-limits.mjs';
const operation=Object.freeze({id:'mail_send',version:'0.2.0'}),action='mail.send',same=(a,b)=>hash(a)===hash(b);
export function createNativeMailPreparer({pool,binding,scopes,selectedClientId,policyRevision,expiresAtMs,currentRights,now,maxRequestMs}){
 const store=createTransactionalApprovalMetadataStore({pool}),commandContext={binding};
 const deny=()=>{throw intentFault('ACCESS_DENIED','none');};
 return Object.freeze({binding,operation,owner:'command',async prepare(value){
  const {arguments:raw,signal}=own(value,['arguments','deliveryId','signal']);
  const request=normalizeMailSendInput(raw,commandContext);
  if(selectedClientId!==null&&request.clientId!==selectedClientId)deny();
  let proposalExpiresAt;
  async function preparePolicy(value){
   const {phase,selection,selectionSha256,signal,limitDeadline}=own(value,['phase','selection','selectionSha256','signal','limitDeadline']);
   const s=data(own(selection,['phase','operation','action','binding','request','inputSha256','proposalId','commandSha256','recordSha256']));
   if(!['prepare','before_release'].includes(phase)||s.phase!==phase||hash(s)!==selectionSha256||!same(s.binding,binding)||s.action!==action||!same(s.operation,operation)||!same(s.request,request))deny();
   const rights=await currentRights({signal,policyRevision});
   if(!same(rights.scopes,scopes)||rights.tenantId!==binding.tenantId||rights.actorId!==binding.actorId)deny();
   proposalExpiresAt??=new Date(Math.min(now()+CURRENT_AUTHORITY_LIMITS.proposalTtlMs,expiresAtMs)).toISOString();
   const until=Math.min(rights.expiresAtMs,expiresAtMs,Date.parse(proposalExpiresAt));if(until<=now())deny();limitDeadline(until);
   return {authorized:true,selectionSha256,binding,scopes,requiredApprover:{tenantId:binding.tenantId,actorId:binding.actorId},proposalExpiresAt,checkedAtMs:rights.checkedAtMs,expiresAtMs:until};
  }
  const approvalMetadataOwner=createCommandApprovalMetadataOwner({store,commandContext,preparePolicy,now,maxRequestMs},action);
  return createCommandIntentPreparer({commandOptions:{operation,action,outputShape:'MailSendToolResult',commandContext,
   validators:commandToolValidators,assertProposal:assertMailSendProposal,approvalMetadataOwner,executor:{execute:deny},now,
   limits:{maxRequestMs,maxFactBytes:262144}}}).prepare({arguments:request,signal});
 }});
}
