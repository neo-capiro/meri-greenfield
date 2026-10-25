/** Read-only canonical custody checks for attachment filing approval metadata.
 * The supplied inspector owns generated artifacts and native SDK files; this policy creates no synthetic artifact version. */
import {types} from 'node:util';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {normalizeArtifactFileInput,validateCommandShape} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {CommandError,data,deny,instant,nativeSignal,own} from '../commands/protocol.mjs';
import {policyReceipt} from '../commands/approval-metadata/binding.mjs';

const operation=Object.freeze({id:'save_chat_attachments',version:'0.2.0'});
const phases=new Set(['prepare','before_release']);
const same=(left,right)=>canonicalSha256(left)===canonicalSha256(right);
const callable=value=>typeof value==='function'&&!types.isProxy(value);

/** inspectSelections verifies every exact reference through its canonical custody owner and resolves only on success.
 * It receives immutable selections and the same bounded lifetime as current policy; it must perform no registration or filing. */
export function createAttachmentFilingPreparationPolicy(configuration){
 const c=own(configuration,['commandContext','preparePolicy','inspectSelections','now'],['maxRequestMs']);
 const context=data(c.commandContext);validateCommandShape('ArtifactFileContext',context);
 const maxRequestMs=c.maxRequestMs??60000;
 if(!callable(c.preparePolicy)||!callable(c.inspectSelections)||!callable(c.now)||
  !Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>60000||
  context.destination.conversationId.toLowerCase()!==context.binding.conversationId.toLowerCase())deny('COMMAND_CONFIGURATION');
 return async function prepareAttachmentPolicy(raw){
  const call=own(raw,['phase','selection','selectionSha256','signal','limitDeadline']);nativeSignal(call.signal);
  const selection=data(own(call.selection,['phase','operation','action','binding','request','inputSha256','proposalId','commandSha256','recordSha256']));
  if(!phases.has(call.phase)||selection.phase!==call.phase||selection.action!=='artifact.file'||
   !same(selection.operation,operation)||!same(selection.binding,context.binding)||
   call.selectionSha256!==canonicalSha256(selection)||!callable(call.limitDeadline))deny('COMMAND_PREPARATION_REFUSED');
  let cutoff=c.now()+maxRequestMs;
  const life=createOperationLifetime({deadlineMs:cutoff,now:c.now,signal:call.signal,errorFactory:code=>new CommandError(code)});
  const limitDeadline=next=>{life.limitDeadline(next);cutoff=Math.min(cutoff,next);call.limitDeadline(next);};
  async function current(){
   const started=c.now();
   const receipt=policyReceipt(await life.run(signal=>c.preparePolicy({phase:call.phase,selection,
    selectionSha256:call.selectionSha256,signal,limitDeadline})),selection,started,c.now(),null);
   if(!receipt.scopes.some(scope=>scope.kind==='client'&&scope.tenantId===context.binding.tenantId&&
    scope.resourceId.toLowerCase()===context.destination.clientId.toLowerCase()))deny('COMMAND_PREPARATION_REFUSED');
   limitDeadline(Math.min(receipt.expiresAtMs,instant(receipt.proposalExpiresAt)));return receipt;
  }
  try{
   const before=await current();
   const normalized=normalizeArtifactFileInput(selection.request,context);
   if(selection.inputSha256!==canonicalSha256(normalized))deny('COMMAND_PREPARATION_REFUSED');
   // Native filing admits only the exact selected client scope; source references cannot narrow or expand it.
   for(const object of normalized.attachments){
    if(!same(object.scopes,before.scopes))deny('COMMAND_PREPARATION_REFUSED');
   }
   const inspection=data({objects:normalized.attachments,binding:context.binding,scopes:before.scopes,destination:context.destination,deadlineMs:cutoff});
   await life.run(signal=>c.inspectSelections({...inspection,signal}));life.check();
   const after=await current();
   if(!same(before.scopes,after.scopes)||!same(before.requiredApprover,after.requiredApprover)||
    before.proposalExpiresAt!==after.proposalExpiresAt)deny('COMMAND_PREPARATION_REFUSED');
   return data({...after,expiresAtMs:Math.min(after.expiresAtMs,cutoff)});
  }finally{life.close();}
 };
}
