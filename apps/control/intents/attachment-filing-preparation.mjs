/** Read-only custody checks for attachment filing proposal metadata. The
 * metadata owner stores the proposal; the existing command executor alone may
 * register attachments/file them after current approval, claim and budget. */
import {types} from 'node:util';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {normalizeArtifactFileInput,validateCommandShape} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {artifactValidators as artifactsContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {CommandError,data,deny,instant,nativeSignal,own} from '../commands/protocol.mjs';
import {policyReceipt} from '../commands/approval-metadata/binding.mjs';

const operation=Object.freeze({id:'save_chat_attachments',version:'0.2.0'});
const phases=new Set(['prepare','before_release','before_read','read_release']);
const same=(left,right)=>canonicalSha256(left)===canonicalSha256(right);
const callable=value=>typeof value==='function'&&!types.isProxy(value);

/** `artifacts.inspect` and `versions.findByObject` must be the canonical
 * immutable artifact owners. `readContext` and `preparePolicy` are trusted
 * current-authority ports, never constructed from the model request. */
export function createAttachmentFilingPreparationPolicy(configuration){
 const c=own(configuration,['commandContext','preparePolicy','readContext','artifacts','versions','now'],['maxRequestMs']);
 const context=data(c.commandContext);validateCommandShape('ArtifactFileContext',context);
 const maxRequestMs=c.maxRequestMs??60000;
 if(!callable(c.preparePolicy)||!callable(c.readContext)||!callable(c.now)||
  !Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>60000||
  context.destination.conversationId.toLowerCase()!==context.binding.conversationId.toLowerCase())deny('COMMAND_CONFIGURATION');
 const inspect=storageMethod(c.artifacts,'inspect'),findByObject=storageMethod(c.versions,'findByObject');
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
   // The metadata reader has not loaded a row yet in this phase. Its existing
   // owner will validate immutable metadata and call read_release with request.
   if(call.phase==='before_read'&&selection.request===null)return before;
   const normalized=normalizeArtifactFileInput(selection.request,context);
   if(selection.inputSha256!==canonicalSha256(normalized))deny('COMMAND_PREPARATION_REFUSED');
   const trusted=artifactsContract.context(await life.run(signal=>c.readContext({binding:context.binding,
    destination:context.destination,deadlineMs:cutoff,signal})));
   if(!same(trusted.binding,context.binding)||
    !Number.isSafeInteger(trusted.deadlineMs)||trusted.deadlineMs<=c.now())deny('COMMAND_PREPARATION_REFUSED');
   limitDeadline(trusted.deadlineMs);
   const readContext=artifactsContract.context({...trusted,deadlineMs:cutoff});
   // Destination authority comes from current policy above. Source custody
   // retains its own exact scopes; filing cannot rewrite them to the destination.
   const policyScopes=new Set(before.scopes.map(canonicalSha256)),readScopes=new Set(trusted.scopes.map(canonicalSha256));
   for(const object of normalized.attachments){
    validateShape('ObjectReference',object);
    if(object.scopes.some(scope=>!policyScopes.has(canonicalSha256(scope))||!readScopes.has(canonicalSha256(scope))))deny('COMMAND_PREPARATION_REFUSED');
    const versionId=await life.run(signal=>findByObject({objectId:object.objectId,tenantId:context.binding.tenantId,
     conversationId:context.binding.conversationId},signal));
    const result=own(await life.run(signal=>inspect(versionId,readContext,{signal})),['version','inspection']);
    const version=artifactsContract.version(result.version),inspection=data(result.inspection),
     {currentBytesVerified,...observed}=own(inspection,['sha256','bytes','format','nativeOpened','rendered','recalculated','members','details','currentBytesVerified']);
    artifactsContract.inspection(observed);
    if(version.versionId!==versionId||version.binding.tenantId!==context.binding.tenantId||
     version.binding.conversationId!==context.binding.conversationId||!same(version.object,object)||
     !same(version.scopes,object.scopes)||!same(version.scopes,trusted.scopes)||currentBytesVerified!==true||
     observed.sha256!==object.sha256||observed.bytes!==object.bytes)deny('COMMAND_PREPARATION_REFUSED');
    // Filename, MIME and source provenance come only from this immutable version
    // and are re-read by the existing filing resolver at approved execution.
    life.check();
   }
   const after=await current();
   if(!same(before.scopes,after.scopes)||!same(before.requiredApprover,after.requiredApprover)||
    before.proposalExpiresAt!==after.proposalExpiresAt)deny('COMMAND_PREPARATION_REFUSED');
   return data({...after,expiresAtMs:Math.min(after.expiresAtMs,cutoff)});
  }finally{life.close();}
 };
}
