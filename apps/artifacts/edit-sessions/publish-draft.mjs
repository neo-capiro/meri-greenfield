/** Explicit, authenticated control Publish. Core owns the private-draft barrier;
 * the existing artifact intent journal owns immutable publication and recovery.
 * No browser/model source, WOPI callback, new ledger or automatic retry. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {officeEditSource,officeEditRequestSha256,OFFICE_EDIT_KIND,OFFICE_OPERATIONS} from '../../../packages/contracts/office-edit.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {officeDraftRequest} from './core-draft-wire.mjs';
import {inspectOfficeEdit} from './inspect-office.mjs';
import {assertOfficeWorkbooksPreserved} from './chart-workbooks.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
const codeOf=e=>e&&typeof e==='object'&&!types.isProxy(e)?Object.getOwnPropertyDescriptor(e,'code')?.value:undefined;
export function createOfficeDraftPublisher({drafts,artifacts,publisherFor,validators:v,generation,now,maxRequestMs=30000}){
 if(![drafts?.call,artifacts?.revisionSource,artifacts?.editorSource,publisherFor,v?.context,v?.version,v?.hash,generation,now].every(f=>typeof f==='function')||
  !Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('EDITOR_PUBLISH_CONFIGURATION');
 return Object.freeze({async publish(value,selection){
  const input=data(own(value,['draftId','sequence','sha256'])),chosen=own(selection,['context','selectedClientId'],['signal']);nativeSignal(chosen.signal);
  const context=v.context(chosen.context),selectedClientId=chosen.selectedClientId;assertNativeConversationScope({binding:context.binding,scopes:context.scopes,selectedClientId});
  const beginRequest=officeDraftRequest('beginPublish',{conversationId:context.binding.conversationId,...input});
  const life=createOperationLifetime({now,signal:chosen.signal,deadlineMs:Math.min(now()+maxRequestMs,context.deadlineMs),errorFactory:code=>Object.assign(Error('EDITOR_PUBLISH_'+code),{code:'EDITOR_PUBLISH_'+code})});
  const currentContext={...context,deadlineMs:life.deadline()},native={binding:context.binding,scopes:context.scopes,selectedClientId,deadlineMs:life.deadline(),signal:life.signal};
  const key={conversationId:beginRequest.conversationId,draftId:beginRequest.draftId};
  const call=(route,body)=>life.run(()=>drafts.call(route,body,native));
  try{
   const draft=await call('read',key);
   if(draft.sequence!==input.sequence||draft.sha256!==input.sha256||draft.bytesBase64===null)fail('EDITOR_DRAFT_CHANGED');
   const bytes=Buffer.from(draft.bytesBase64,'base64');
   // Reject the immutable owner's smaller publication ceiling before either
   // owner claims a Publish. Larger private drafts remain intact and editable.
   if(bytes.length>context.maxBytes)fail('EDITOR_PUBLISH_TOO_LARGE');
   const inspection=inspectOfficeEdit(bytes,draft.format);if(inspection.sha256!==draft.sha256||bytes.length!==draft.byteLength)fail('EDITOR_SOURCE_MISMATCH');
   const base=await life.run(signal=>artifacts.revisionSource(draft.baseVersionId,currentContext,{signal}));
   const permitted=await life.run(signal=>artifacts.editorSource(draft.baseVersionId,currentContext,{write:true,signal}));
   if(draft.format==='pptx')assertOfficeWorkbooksPreserved(inspectOfficeEdit(permitted.bytes,draft.format),inspection);
   if(v.hash(base.version)!==v.hash(permitted.version)||base.version.artifactId!==draft.artifactId||base.version.versionId!==draft.baseVersionId||
     base.version.object.sha256!==draft.baseSha256||base.version.filename!==draft.filename||base.request.format!==draft.format)fail('EDITOR_SOURCE_MISMATCH');
   const request=officeEditSource({sourceKind:OFFICE_EDIT_KIND,operation:OFFICE_OPERATIONS[draft.format],format:draft.format,title:base.request.title,
    edit:{sessionId:draft.draftId,draftSequence:draft.sequence,draftSha256:draft.sha256,baseVersionId:draft.baseVersionId,baseObjectSha256:draft.baseSha256,editorActorId:context.binding.actorId}});
   // Preserve provenance from the current-authorized immutable parent, not from
   // the latest chat context. Admit earlier-run evidence only for this exact
   // prepared context through the artifact owner's existing retained-evidence port.
   const publicationContext=v.context({...currentContext,evidence:base.version.evidence});
   officeEditRequestSha256(v,request,publicationContext,draft.baseVersionId);
   const contextSha256=v.hash(publicationContext),admitRetainedEvidence=value=>v.hash(value)===contextSha256?undefined:1;
   const subjects=[{tenantId:context.binding.tenantId,kind:'conversation',subjectId:context.binding.conversationId},
    {tenantId:context.binding.tenantId,kind:'artifact',subjectId:draft.artifactId}];
   const readGeneration=()=>life.run(()=>generation(subjects)),startGeneration=await readGeneration();
   if(!Number.isSafeInteger(startGeneration)||startGeneration<0)fail('EDITOR_RETENTION_UNAVAILABLE');
   const publisher=publisherFor(publicationContext,{admitRetainedEvidence});if(typeof publisher?.executeOfficeEdit!=='function'||typeof publisher?.recoverOfficeEdit!=='function')fail('EDITOR_PUBLISH_CONFIGURATION');
   const begun=await call('beginPublish',beginRequest),intent=`office:${draft.draftId}:${draft.sequence}`;
   const settle=(outcome,versionId=null)=>call('settlePublish',{...beginRequest,intent,outcome,versionId});
   const delivery={deliveryId:intent,baseVersionId:draft.baseVersionId,request};
   let result;
   try{
    result=await life.run(signal=>begun.dispatch?publisher.executeOfficeEdit(delivery,bytes,signal):publisher.recoverOfficeEdit(delivery,bytes,signal));
   }catch(error){
    // Only the canonical stale-parent refusal proves a terminal conflict. A
    // late authority/error code cannot establish that no write happened.
    if(begun.receipt.state!=='published'){
     try{await settle(codeOf(error)==='ARTIFACT_STALE_PARENT'?'conflict':'unknown');}catch{}
    }
    throw error;
   }
   const version=v.version(result.version);
   if(version.artifactId!==draft.artifactId||version.parentVersionId!==draft.baseVersionId||version.object.sha256!==draft.sha256||version.object.bytes!==draft.byteLength||
     version.binding.tenantId!==context.binding.tenantId||version.binding.actorId!==context.binding.actorId||version.binding.conversationId!==context.binding.conversationId||
     v.hash(version.scopes)!==v.hash(context.scopes)||begun.receipt.state==='published'&&begun.receipt.publishedVersionId!==version.versionId)fail('EDITOR_PUBLICATION_MISMATCH');
   const receipt=await settle('published',version.versionId);
   // Settlement can await Core long enough for current access to change. The
   // published artifact owner and final generation gate still control release.
   const confirmed=await life.run(signal=>artifacts.editorSource(version.versionId,currentContext,{write:true,signal}));
   if(v.hash(confirmed.version)!==v.hash(version)||await readGeneration()!==startGeneration)fail('EDITOR_PUBLICATION_NOT_RELEASED');
   life.check();return {draft:receipt,publication:result};
  }finally{life.close();}
 }});
}
