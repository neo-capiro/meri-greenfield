/** Prepare-only task composition over native current rights and the existing immutable metadata owner.
 * The intent mount owns delivery idempotency; Core's approved task receiver owns every business effect. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,assertProposalIntegrity} from '../../../packages/contracts/validate.mjs';
import {assertTaskUpdateProposal} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {commandToolValidators,resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createTaskCreateApprovalMetadataOwner,createTaskUpdateApprovalMetadataOwner} from '../../control/commands/approval-metadata/index.mjs';
import {createTransactionalApprovalMetadataStore} from '../../control/commands/approval-metadata/postgres-store.mjs';
import {createCommandIntentPreparer} from '../../control/intents/command-preparer.mjs';
import {intentFault} from '../../control/intents/faults.mjs';
import {CURRENT_AUTHORITY_LIMITS} from './current-authority-limits.mjs';

const same=(a,b)=>hash(a)===hash(b),deny=()=>{throw intentFault('ACCESS_DENIED','none');};
export function createNativeTaskPreparers({pool,binding,scopes,selectedClientId,policyRevision,expiresAtMs,currentRights,resolveClientReference,now,maxRequestMs}){
 const store=createTransactionalApprovalMetadataStore({pool});
 return ['task.create','task.update'].map(action=>{
  const updating=action==='task.update',operation=resolveOperationContract({id:updating?'update_task':'create_task',version:'0.2.0'}).descriptor.operation;
  return Object.freeze({binding,operation,owner:'command',async prepare(value){
   const {arguments:raw,signal}=own(value,['arguments','deliveryId','signal']),request=data(raw);let clientResolution=null,resolutionExpiresAt=Infinity;
   async function resolve(reference,signal){
    const began=now(),r=data(own(await resolveClientReference({reference,signal,deadlineMs:Math.min(expiresAtMs,began+maxRequestMs)}),['reference','clientId','checkedAtMs','expiresAtMs']));
    if(r.reference!==reference||typeof r.clientId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(r.clientId)||
     selectedClientId!==null&&r.clientId!==selectedClientId||!Number.isSafeInteger(r.checkedAtMs)||r.checkedAtMs<began||r.checkedAtMs>now()||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=now())deny();
    const selected={reference:r.reference,clientId:r.clientId};if(clientResolution&&!same(selected,clientResolution))deny();resolutionExpiresAt=Math.min(resolutionExpiresAt,r.expiresAtMs);return selected;
   }
   if(!updating&&request.clientId!==undefined&&request.clientId!==null&&typeof request.clientId!=='string')throw intentFault('INVALID_ARGUMENTS','none');
   if(!updating&&request.clientId!==undefined&&request.clientId!==null&&request.clientId.trim()!==''){
    const reference=request.clientId.trim();
    if(resolveClientReference)clientResolution=await resolve(reference,signal);
    else{
     if(selectedClientId===null||reference.toLowerCase()!==selectedClientId.toLowerCase())throw intentFault('INVALID_ARGUMENTS','none');
     clientResolution={reference,clientId:selectedClientId};
    }
   }
   const commandContext=updating?{binding}:{binding,clientResolution};let proposalExpiresAt;
   async function preparePolicy(value){
    const {phase,selection,selectionSha256,signal,limitDeadline}=own(value,['phase','selection','selectionSha256','signal','limitDeadline']);
    const selected=data(own(selection,['phase','operation','action','binding','request','inputSha256','proposalId','commandSha256','recordSha256']));
    if(!['prepare','before_release'].includes(phase)||selected.phase!==phase||hash(selected)!==selectionSha256||!same(selected.binding,binding)||selected.action!==action||!same(selected.operation,operation)||!same(selected.request,request))deny();
    if(phase==='before_release'&&clientResolution&&resolveClientReference)await resolve(clientResolution.reference,signal);
    const rights=await currentRights({signal,policyRevision});
    if(!same(rights.scopes,scopes)||rights.tenantId!==binding.tenantId||rights.actorId!==binding.actorId)deny();
    proposalExpiresAt??=new Date(Math.min(now()+CURRENT_AUTHORITY_LIMITS.proposalTtlMs,expiresAtMs)).toISOString();
    const until=Math.min(rights.expiresAtMs,expiresAtMs,resolutionExpiresAt,Date.parse(proposalExpiresAt));if(until<=now())deny();limitDeadline(until);
    return {authorized:true,selectionSha256,binding,scopes,requiredApprover:{tenantId:binding.tenantId,actorId:binding.actorId},proposalExpiresAt,checkedAtMs:rights.checkedAtMs,expiresAtMs:until};
   }
   const factory=updating?createTaskUpdateApprovalMetadataOwner:createTaskCreateApprovalMetadataOwner;
   const approvalMetadataOwner=factory({store,commandContext,preparePolicy,now,maxRequestMs});
   const preparer=createCommandIntentPreparer({commandOptions:{operation,action,commandContext,validators:commandToolValidators,
    assertProposal:updating?assertTaskUpdateProposal:assertProposalIntegrity,approvalMetadataOwner,now,limits:{maxRequestMs,maxFactBytes:131072}}});
   return preparer.prepare({arguments:request,signal});
  }});
 });
}
