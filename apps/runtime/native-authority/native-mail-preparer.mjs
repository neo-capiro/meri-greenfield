/** Prepare-only composition. Current Core rights and the existing metadata journal keep their owners. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {assertMailSendProposal,normalizeMailSendInput} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {commandToolValidators,describeInputProblem,resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createCommandApprovalMetadataOwner} from '../../control/commands/approval-metadata/index.mjs';
import {createTransactionalApprovalMetadataStore} from '../../control/commands/approval-metadata/postgres-store.mjs';
import {createCommandIntentPreparer} from '../../control/intents/command-preparer.mjs';
import {intentFault} from '../../control/intents/faults.mjs';
import {CURRENT_AUTHORITY_LIMITS} from './current-authority-limits.mjs';
const operation=Object.freeze({id:'mail_send',version:'0.2.0'}),action='mail.send',same=(a,b)=>hash(a)===hash(b);
const INPUT_SCHEMA=resolveOperationContract(operation).descriptor.inputSchema.id;
/** The model supplies the message (`MAIL_MODEL_FIELDS`, `senderEmail` only to choose among several mailboxes); the client
 * association is the trusted selection (null in a General conversation) and the sender is the actor's connected mailbox. */
export const MAIL_MODEL_FIELDS=Object.freeze(['mode','to','cc','bcc','subject','bodyHtml','files','original']);
export function createNativeMailPreparer({pool,binding,scopes,selectedClientId,policyRevision,expiresAtMs,currentRights,now,maxRequestMs,resolveSender}){
 const store=createTransactionalApprovalMetadataStore({pool}),commandContext={binding};
 const deny=()=>{throw intentFault('ACCESS_DENIED','none');};
 return Object.freeze({binding,operation,owner:'command',async prepare(value){
  const {arguments:raw,signal}=own(value,['arguments','deliveryId','signal']);
  let message;try{message=own(raw,MAIL_MODEL_FIELDS,['senderEmail']);}catch{throw intentFault('INVALID_ARGUMENTS','none');}
  if(typeof resolveSender!=='function')throw intentFault('UNAVAILABLE','none');
  const sender=await resolveSender({senderEmail:message.senderEmail,signal,deadlineMs:now()+maxRequestMs});
  let request;try{request=normalizeMailSendInput({...message,clientId:selectedClientId,senderConnectionId:sender.senderConnectionId,senderEmail:sender.senderEmail},commandContext);}
  catch{throw intentFault('INVALID_ARGUMENTS','none',describeInputProblem(INPUT_SCHEMA,{...message,clientId:selectedClientId,...sender})??'mail arguments: check addresses (lower-case, unique), subject (one line) and body');}
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
  return createCommandIntentPreparer({commandOptions:{operation,action,commandContext,
   validators:commandToolValidators,assertProposal:assertMailSendProposal,approvalMetadataOwner,now,
   limits:{maxRequestMs,maxFactBytes:262144}}}).prepare({arguments:request,signal});
 }});
}
