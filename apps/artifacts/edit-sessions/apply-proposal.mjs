/** Explicit, authenticated Apply of a reviewed `propose_office_edit` proposal: the retained bytes of the exact
 * parent are read again under current authority, the proposal's operations are re-applied deterministically
 * and must reproduce the digest the proposal pinned, the parent must still be the artifact head, and the
 * result is published through the same immutable artifact owner, CAS and intent journal as an editor Publish
 * (`publishOfficeEdit` semantics with a `meri.office-proposal/1` source). One proposal has one durable
 * publication: a repeated Apply replays the same version and never writes twice. No browser/model source,
 * no second ledger, no automatic retry. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {officeProposalSource,officeEditRequestSha256,OFFICE_PROPOSAL_KIND,OFFICE_OPERATIONS} from '../../../packages/contracts/office-edit.mjs';
import {officeEditValidators} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {applyOfficeOperations} from '../office-units/index.mjs';
import {createHash} from 'node:crypto';
const fail=code=>{throw Object.assign(Error(code),{code});};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const codeOf=e=>e&&typeof e==='object'&&!types.isProxy(e)?Object.getOwnPropertyDescriptor(e,'code')?.value:undefined;
export const OFFICE_PROPOSAL_DELIVERY=proposalId=>`office-proposal:${proposalId}`;
export function createOfficeProposalPublisher({artifacts,publisherFor,validators:v,generation,now,maxRequestMs=30000}){
 if(![artifacts?.revisionSource,artifacts?.editorSource,artifacts?.history,publisherFor,v?.context,v?.version,v?.hash,generation,now].every(f=>typeof f==='function')||
  !Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('OFFICE_EDIT_CONFIGURATION');
 async function run(value,selection,recover){
  const proposal=officeEditValidators.assertProposal(value),chosen=own(selection,['context','selectedClientId'],['signal']);nativeSignal(chosen.signal);
  const context=v.context(chosen.context),selectedClientId=chosen.selectedClientId;assertNativeConversationScope({binding:context.binding,scopes:context.scopes,selectedClientId});
  const b=context.binding,p=proposal.binding;
  if(p.tenantId!==b.tenantId||p.actorId!==b.actorId||p.conversationId!==b.conversationId||v.hash(proposal.scopes)!==v.hash(context.scopes)||proposal.context.selectedClientId!==selectedClientId)fail('ACCESS_DENIED');
  if(!recover&&Date.parse(proposal.expiresAt)<=now())fail('INTENT_EXPIRED');
  const life=createOperationLifetime({now,signal:chosen.signal,deadlineMs:Math.min(now()+maxRequestMs,context.deadlineMs),errorFactory:code=>Object.assign(Error('OFFICE_EDIT_'+code),{code:'OFFICE_EDIT_'+code})});
  const currentContext={...context,deadlineMs:life.deadline()},doc=proposal.document;
  try{
   // Current revise authority and the exact retained parent bytes, then its immutable title and evidence.
   const permitted=await life.run(signal=>artifacts.editorSource(doc.versionId,currentContext,{write:true,signal}));
   const base=await life.run(signal=>artifacts.revisionSource(doc.versionId,currentContext,{signal}));
   if(v.hash(base.version)!==v.hash(permitted.version)||base.version.artifactId!==doc.artifactId||base.version.object.sha256!==doc.objectSha256||base.version.filename!==doc.filename||base.request.format!==doc.format||base.request.title!==doc.title)fail('OFFICE_EDIT_PROPOSAL_MISMATCH');
   const bytes=applyOfficeOperations(Buffer.from(permitted.bytes),doc.format,proposal.operations);
   if(sha(bytes)!==proposal.result.sha256||bytes.length!==proposal.result.bytes)fail('OFFICE_EDIT_PROPOSAL_MISMATCH');
   if(bytes.length>context.maxBytes)fail('OFFICE_EDIT_TOO_LARGE');
   const request=officeProposalSource({sourceKind:OFFICE_PROPOSAL_KIND,operation:OFFICE_OPERATIONS[doc.format],format:doc.format,title:doc.title,
    proposal:{proposalId:proposal.proposalId,baseVersionId:doc.versionId,baseObjectSha256:doc.objectSha256,operationsSha256:v.hash(proposal.operations),outputSha256:proposal.result.sha256,actorId:b.actorId}});
   const publicationContext=v.context({...currentContext,evidence:base.version.evidence});
   officeEditRequestSha256(v,request,publicationContext,doc.versionId);
   const contextSha256=v.hash(publicationContext),admitRetainedEvidence=value=>v.hash(value)===contextSha256?undefined:1;
   const subjects=[{tenantId:b.tenantId,kind:'conversation',subjectId:b.conversationId},{tenantId:b.tenantId,kind:'artifact',subjectId:doc.artifactId}];
   const readGeneration=()=>life.run(()=>generation(subjects)),startGeneration=await readGeneration();
   if(!Number.isSafeInteger(startGeneration)||startGeneration<0)fail('OFFICE_EDIT_RETENTION_UNAVAILABLE');
   const publisher=publisherFor(publicationContext,{admitRetainedEvidence});if(typeof publisher?.executeOfficeEdit!=='function'||typeof publisher?.recoverOfficeEdit!=='function')fail('OFFICE_EDIT_CONFIGURATION');
   const delivery={deliveryId:OFFICE_PROPOSAL_DELIVERY(proposal.proposalId),baseVersionId:doc.versionId,request};
   let result;
   if(recover){
    try{result=await life.run(signal=>publisher.recoverOfficeEdit(delivery,bytes,signal));}
    catch(error){
     if(codeOf(error)==='EDITOR_PUBLISH_UNRESOLVED'){
      // Never applied. The parent must still be the head for the proposal to remain applicable.
      const head=await life.run(signal=>artifacts.history({versionId:doc.versionId,limit:1,cursor:null},currentContext,{signal}));
      return {status:head.headVersionId===doc.versionId?'proposed':'conflict',publication:null};
     }
     if(codeOf(error)==='ARTIFACT_STALE_PARENT')return {status:'conflict',publication:null};
     throw error;
    }
   }else{
    // The exact parent must still be the artifact head BEFORE any write: a superseded parent is a definite
    // refusal with its own code here, and the commit CAS below remains the authority.
    const head=await life.run(signal=>artifacts.history({versionId:doc.versionId,limit:1,cursor:null},currentContext,{signal}));
    if(head.artifactId!==doc.artifactId)fail('OFFICE_EDIT_PROPOSAL_MISMATCH');
    if(head.headVersionId!==doc.versionId){
     // Unless this very proposal already produced the head: then Apply is a replay, never a conflict.
     try{result=await life.run(signal=>publisher.recoverOfficeEdit(delivery,bytes,signal));}
     catch(error){if(['EDITOR_PUBLISH_UNRESOLVED','ARTIFACT_STALE_PARENT'].includes(codeOf(error)))fail('OFFICE_EDIT_STALE_HEAD');throw error;}
    }else{
     try{result=await life.run(signal=>publisher.executeOfficeEdit(delivery,bytes,signal));}
     catch(error){if(codeOf(error)==='ARTIFACT_STALE_PARENT')fail('OFFICE_EDIT_STALE_HEAD');throw error;}
    }
   }
   const version=v.version(result.version);
   if(version.artifactId!==doc.artifactId||version.parentVersionId!==doc.versionId||version.object.sha256!==proposal.result.sha256||version.object.bytes!==proposal.result.bytes||
     version.binding.tenantId!==b.tenantId||version.binding.actorId!==b.actorId||version.binding.conversationId!==b.conversationId||v.hash(version.scopes)!==v.hash(context.scopes))fail('OFFICE_EDIT_PUBLICATION_MISMATCH');
   // The published artifact owner and the final generation gate still control release.
   const confirmed=await life.run(signal=>artifacts.editorSource(version.versionId,currentContext,{write:true,signal}));
   if(v.hash(confirmed.version)!==v.hash(version)||await readGeneration()!==startGeneration)fail('OFFICE_EDIT_PUBLICATION_NOT_RELEASED');
   life.check();return {status:'applied',publication:data({version:result.version,inspection:result.inspection})};
  }finally{life.close();}
 }
 return Object.freeze({apply:(proposal,selection)=>run(proposal,selection,false),read:(proposal,selection)=>run(proposal,selection,true)});
}
