/** Source composition only: no listener or configuration activation. The caller
 * supplies the existing document options/session owners and self-hosted CODE. */
import {createRuntimeOfficeAccess} from './office-access.mjs';
import {importOfficeOriginal} from './office-original.mjs';
import {types} from 'node:util';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {OFFICE_SCHEMA,receiveOfficeRequest} from '../../../packages/contracts/dist/office-application.mjs';
import {createOfficeControlApplication} from '../../control/office-application.mjs';
import {borrowedRunSession} from '../../control/action-host/session/owner.mjs';
import {createAttendedOffice,attendedRequest,attendedIntent} from '../../artifacts/edit-sessions/attended.mjs';
import {createWopiFileApplication} from '../../artifacts/edit-sessions/wopi-files.mjs';
import {createOfficeProposalPublisher} from '../../artifacts/edit-sessions/apply-proposal.mjs';
import {assertDocumentRevisionSelection} from '../../../packages/contracts/document-revision.mjs';
import {officeOriginalTitle} from '../../../packages/contracts/office-edit.mjs';
const refuse=code=>{throw Object.assign(Error(code),{code});};
import {wopiRequest,wopiResponse,cancelWopiBody,refusalStatus} from '../../artifacts/edit-sessions/wopi-http.mjs';
export function createRuntimeOfficeApplication({optionsOwner,sessions,now,limits,drafts,codec,launch,generation,browserOrigin,originalSource}){
 let origin;try{origin=new URL(browserOrigin);}catch{throw Error('OFFICE_CONFIGURATION');}
 if(typeof browserOrigin!=='string'||origin.protocol!=='https:'||origin.origin!==browserOrigin)throw Error('OFFICE_CONFIGURATION');
 const access=createRuntimeOfficeAccess({optionsOwner,sessions,now,limits}),borrow=borrowedRunSession(sessions);
 const attended=createAttendedOffice({drafts,launch,generation,now});
 if(typeof borrow!=='function'||typeof codec?.verify!=='function')throw Error('OFFICE_CONFIGURATION');
 const application={
  async execute(route,value,{credential,deadlineMs,signal}){
   if(route==='import'){
    const input=data(own(value,['uploadId','sha256','operation']));receiveOfficeRequest('import',Buffer.from(JSON.stringify({schema:OFFICE_SCHEMA,...input})));
    const selection={uploadId:input.uploadId,sha256:input.sha256};
    return access.run({credential,deadlineMs,signal,intent:'office-import',versionId:null,selection},
     current=>importOfficeOriginal({source:originalSource,current,selection,operation:input.operation,credential,generation}));
   }
   if(route==='inspect'){
    const input=data(own(value,['versionId']));receiveOfficeRequest('inspect',Buffer.from(JSON.stringify({schema:OFFICE_SCHEMA,...input})));
    return access.run({credential,deadlineMs,signal,intent:'inspect',versionId:input.versionId},async current=>{
     const document=await current.artifacts.inspect(input.versionId,current.context,{signal:current.life.signal});
     if(!['docx','xlsx','pptx'].includes(document.inspection.format))throw Object.assign(Error('EDITOR_FORMAT_UNSUPPORTED'),{code:'EDITOR_FORMAT_UNSUPPORTED'});
     const subjects=[{tenantId:current.context.binding.tenantId,kind:'conversation',subjectId:current.context.binding.conversationId},
      {tenantId:current.context.binding.tenantId,kind:'artifact',subjectId:document.version.artifactId}];
     const before=await current.life.run(()=>generation(subjects));await current.fresh();
     if(!Number.isSafeInteger(before)||before<0||await current.life.run(()=>generation(subjects))!==before)throw Object.assign(Error('EDITOR_RESULT_NOT_RELEASED'),{code:'EDITOR_RESULT_NOT_RELEASED'});
     current.life.check();return {document};
    });
   }
   const input=attendedRequest(route,value);
   return access.run({credential,deadlineMs,signal,intent:attendedIntent(route,input),versionId:input.versionId},current=>attended.execute(route,input,current));
  },
  async handleWopi(request){
   try{
    const info=wopiRequest(request);let claims;
    try{claims=codec.verify(info.token,{fileId:info.fileId});}catch{return wopiResponse(401);}
    // Borrow only an existing native receipt. Full authentication and the signed
    // binding/client/scope comparison happen again inside the file application.
    const selected=borrow({binding:claims.runBinding,selectedClientId:claims.selectedClientId,signal:info.signal});
    return await access.run({credential:selected.credential,deadlineMs:Math.min(claims.expiresAtMs,selected.expiresAtMs),signal:info.signal,
     intent:claims.userCanWrite?'revise':'download',versionId:claims.versionId},async current=>{
      const files=createWopiFileApplication({codec,drafts,artifacts:current.artifacts,generation,now,postMessageOrigin:browserOrigin,
       resolveContext:async()=>{const state=await current.fresh();return {context:current.context,selectedClientId:state.selectedClientId,expiresAtMs:state.expiresAtMs,sessionSha256:state.sessionSha256};}});
      return files.handle(request);
     });
   }catch(error){
    const code=error&&typeof error==='object'&&!types.isProxy(error)?Object.getOwnPropertyDescriptor(error,'code')?.value:null;
    return wopiResponse(refusalStatus(error)??(['ACCESS_DENIED','SESSION_REFUSED','ARTIFACT_AUTHORITY','RETENTION_SUPPRESSED'].includes(code)?404:500));
   }
   finally{cancelWopiBody(request);}
  },
 };
 /** The exact selected version for the governed propose_office_edit read (download authority) or prepare (revise
  * authority, the same Apply needs): exact bytes, immutable title and current head. The selection is the run's own
  * immutable document selection. */
 async function readSelected({credential,selection:raw,intent,deadlineMs,signal}){
  const selection=assertDocumentRevisionSelection(raw);if(!['download','revise'].includes(intent))refuse('OFFICE_CONFIGURATION');
  return access.run({credential,deadlineMs,signal,intent,versionId:selection.versionId},async current=>{
   const {context,life}=current,source=await current.artifacts.editorSource(selection.versionId,context,{write:intent==='revise',signal:life.signal});
   const base=await current.artifacts.revisionSource(selection.versionId,context,{signal:life.signal});
   if(source.version.artifactId!==selection.artifactId||source.version.object.sha256!==selection.objectSha256||base.version.versionId!==selection.versionId)refuse('ACCESS_DENIED');
   const format=source.version.filename.split('.').at(-1);
   if(!['docx','xlsx','pptx'].includes(format)||base.request.format!==format)refuse('EDITOR_FORMAT_UNSUPPORTED');
   const head=await current.artifacts.history({versionId:selection.versionId,limit:1,cursor:null},context,{signal:life.signal});
   await current.fresh();life.check();
   return {document:{artifactId:source.version.artifactId,versionId:source.version.versionId,objectSha256:source.version.object.sha256,format,title:base.request.title??officeOriginalTitle(source.version.filename,format),filename:source.version.filename},bytes:source.bytes,headVersionId:head.headVersionId};
  });
 }
 const proposalRun=(method,{credential,proposal,deadlineMs,signal})=>access.run({credential,deadlineMs,signal,intent:'revise',versionId:proposal.document.versionId},async current=>{
  const publisher=createOfficeProposalPublisher({artifacts:current.artifacts,publisherFor:current.publisherFor,validators:current.validators,generation,now});
  const result=await publisher[method](proposal,{context:current.context,selectedClientId:current.selectedClientId,signal:current.life.signal});
  if(result.publication!==null){
   const publication=await current.artifacts.inspect(result.publication.version.versionId,current.context,{signal:current.life.signal});
   if(canonicalSha256(publication.version)!==canonicalSha256(result.publication.version))refuse('EDITOR_PUBLICATION_MISMATCH');
   await current.fresh();current.life.check();return {status:result.status,publication};
  }
  await current.fresh();current.life.check();return result;
 });
 const control=createOfficeControlApplication({application,now,maxRequestMs:limits.maxRequestMs});
 return Object.freeze({...application,handleControl:control.handle,readSelected,applyProposal:value=>proposalRun('apply',value),rejectProposal:value=>proposalRun('reject',value),readProposal:value=>proposalRun('read',value)});
}
