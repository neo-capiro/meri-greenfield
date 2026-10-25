/** Native filing preparation retains the existing immutable approval metadata.
 * Canonical custody is read-only here; registration and filing belong to the approved execution owner. */
import {types} from 'node:util';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {commandToolValidators,resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {data,own,nativeSignal} from '../commands/protocol.mjs';
import {createTransactionalApprovalMetadataStore} from '../commands/approval-metadata/postgres-store.mjs';
import {createCommandApprovalMetadataOwner} from '../commands/approval-metadata/owner.mjs';
import {artifactFileKind} from '../commands/approval-metadata/artifact-file-kind.mjs';
import {createCommandIntentPreparer} from './command-preparer.mjs';
import {createAttachmentFilingPreparationPolicy} from './attachment-filing-preparation.mjs';
import {intentFault} from './faults.mjs';

const kind=artifactFileKind('artifact.file'),descriptor=resolveOperationContract(kind.operation).descriptor;
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b),deny=()=>{throw intentFault('ACCESS_DENIED','none');};

/** expiresAtMs is the trusted caller's proposal expiry cap. No model field supplies a destination or approval authority. */
export function createNativeAttachmentFilingPreparer(configuration){
 let c,pinned,custody;
 try{
  c=own(configuration,['pool','binding','scopes','selectedClientId','policyRevision','expiresAtMs','readCurrent','custody','now','maxRequestMs']);
  pinned=data({binding:c.binding,scopes:c.scopes,selectedClientId:c.selectedClientId,policyRevision:c.policyRevision});
  assertNativeConversationScope(pinned);custody=own(c.custody,['inspectSelections']);
  if(pinned.selectedClientId===null||pinned.scopes.length!==1||pinned.scopes[0].kind!=='client'||
   pinned.scopes[0].resourceId!==pinned.selectedClientId||pinned.scopes[0].policyRevision!==pinned.policyRevision||
   ![c.readCurrent,c.now,custody.inspectSelections].every(f=>typeof f==='function'&&!types.isProxy(f))||
   !Number.isSafeInteger(c.expiresAtMs)||!Number.isSafeInteger(c.maxRequestMs)||c.maxRequestMs<1||c.maxRequestMs>60000)throw 0;
 }catch{throw intentFault('INTENT_CONFIGURATION');}
 const commandContext=data({binding:pinned.binding,destination:{clientId:pinned.selectedClientId,conversationId:pinned.binding.conversationId}});
 const store=createTransactionalApprovalMetadataStore({pool:c.pool});
 return Object.freeze({binding:pinned.binding,operation:descriptor.operation,owner:'command',async prepare(value){
  let request,input;
  try{
   input=own(value,['arguments','deliveryId'],['signal']);nativeSignal(input.signal);
   if(typeof input.deliveryId!=='string'||!/^sdk:[a-f0-9]{64}$/u.test(input.deliveryId))throw 0;
   request=data(input.arguments);
   commandToolValidators.normalizeCommandToolInput('artifact.file',request,{commandContext});
  }catch{throw intentFault('INVALID_ARGUMENTS','none');}
  let proposalExpiresAt,insertEntered=false,closed=false;
  const startedAt=c.now();
  const preparePolicy=createAttachmentFilingPreparationPolicy({commandContext,inspectSelections:custody.inspectSelections,
   now:c.now,maxRequestMs:c.maxRequestMs,preparePolicy:async call=>{
    const {phase,selection,selectionSha256,signal,limitDeadline}=own(call,['phase','selection','selectionSha256','signal','limitDeadline']);
    if(!['prepare','before_release'].includes(phase)||selection.phase!==phase||selectionSha256!==canonicalSha256(selection)||
     !same(selection.binding,pinned.binding)||selection.action!=='artifact.file'||!same(selection.operation,descriptor.operation)||!same(selection.request,request))deny();
    const started=c.now(),deadlineMs=Math.min(c.expiresAtMs,started+c.maxRequestMs);if(deadlineMs<=started)deny();
    const receipt=data(own(await c.readCurrent({signal,deadlineMs}),['binding','scopes','selectedClientId','policyRevision','checkedAtMs','expiresAtMs']));
    if(!same({binding:receipt.binding,scopes:receipt.scopes,selectedClientId:receipt.selectedClientId,policyRevision:receipt.policyRevision},pinned)||
     !Number.isSafeInteger(receipt.checkedAtMs)||receipt.checkedAtMs<started||receipt.checkedAtMs>c.now()||
     !Number.isSafeInteger(receipt.expiresAtMs)||receipt.expiresAtMs<=c.now())deny();
    proposalExpiresAt??=new Date(c.expiresAtMs).toISOString();
    const until=Math.min(receipt.expiresAtMs,c.expiresAtMs);limitDeadline(until);
    return {authorized:true,selectionSha256,binding:pinned.binding,scopes:pinned.scopes,
     requiredApprover:{tenantId:pinned.binding.tenantId,actorId:pinned.binding.actorId},proposalExpiresAt,checkedAtMs:receipt.checkedAtMs,expiresAtMs:until};
   }});
  // The generic tool lifetime can finish before its metadata owner reports NOT_STORED. Track only this existing
  // store boundary, and close it on return so a late read-only custody continuation cannot begin an insert.
  const requestStore={read:store.read,insert(value,check){if(closed)throw intentFault('CANCELLED','none');check();insertEntered=true;return store.insert(value,check);}};
  const approvalMetadataOwner=createCommandApprovalMetadataOwner({store:requestStore,commandContext,preparePolicy,now:c.now,maxRequestMs:c.maxRequestMs},'artifact.file');
  const preparer=createCommandIntentPreparer({commandOptions:{operation:descriptor.operation,action:'artifact.file',
   outputShape:descriptor.outputSchema.id.split('#/$defs/')[1],commandContext,validators:commandToolValidators,
   assertProposal:kind.assertProposal,approvalMetadataOwner,executor:{execute:deny},now:c.now,
   limits:{maxRequestMs:c.maxRequestMs,maxFactBytes:131072}}});
  try{return await preparer.prepare({arguments:request,signal:input.signal});}
  catch(error){
   if(insertEntered)throw intentFault('UNKNOWN','unknown');
   const code=input.signal?.aborted?'CANCELLED':c.now()>=startedAt+c.maxRequestMs?'DEADLINE':
    ['INVALID_ARGUMENTS','ACCESS_DENIED','DEADLINE','CANCELLED'].includes(error?.code)?error.code:'REFUSED';
   throw intentFault(code,'none');
  }finally{closed=true;}
 }});
}
