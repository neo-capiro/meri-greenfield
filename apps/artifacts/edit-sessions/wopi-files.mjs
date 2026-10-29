/** Private CODE WOPI Fetch adapter. Core owns editor admission, locks and Save;
 * ArtifactService owns current artifact authority/bytes/retention. An attended
 * host supplies current context via its existing session owner, never a browser
 * DTO or a durable bearer store. This module starts no listener and publishes
 * no document. Deployment must redact the WOPI query token from access logs. */
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {inspectOfficeEdit} from './inspect-office.mjs';
import {wopiRequest,wopiBody,wopiResponse,cancelWopiBody,refuse,refusalStatus} from './wopi-http.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const codeOf=e=>e&&typeof e==='object'&&!types.isProxy(e)?Object.getOwnPropertyDescriptor(e,'code')?.value:undefined;
const uncertain=e=>e&&typeof e==='object'&&!types.isProxy(e)&&Object.getOwnPropertyDescriptor(e,'outcome')?.value==='UNKNOWN';
const unavailable=new Set(['OFFICE_DRAFT_ACCESS_DENIED','OFFICE_DRAFT_UNAVAILABLE','OFFICE_DRAFT_EXPIRED','OFFICE_DRAFT_CONFLICT','ARTIFACT_AUTHORITY','ARTIFACT_VERSION_CONTEXT','RETENTION_SUPPRESSED']);
export function createWopiFileApplication({codec,drafts,artifacts,resolveContext,generation,now,maxRequestMs=30000}){
 if(![codec?.verify,drafts?.call,artifacts?.editorSource,resolveContext,generation,now].every(f=>typeof f==='function')||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)throw Error('WOPI_CONFIGURATION');
 return Object.freeze({async handle(request){let life;
  try{
   const info=wopiRequest(request);let claims;
   try{claims=codec.verify(info.token,{fileId:info.fileId});}catch{refuse(401);}
   life=createOperationLifetime({now,signal:info.signal,deadlineMs:Math.min(now()+maxRequestMs,claims.expiresAtMs),errorFactory:()=>Error('WOPI_LIFETIME')});
   const key={conversationId:claims.conversationId,draftId:claims.editSessionId,editorId:claims.editorId,editorEpoch:claims.editorEpoch};
   async function current(){
    const selected=data(own(await life.run(signal=>resolveContext(claims,signal)),['context','selectedClientId','expiresAtMs']));
    const {context,selectedClientId,expiresAtMs}=selected;
    assertNativeConversationScope({binding:context.binding,scopes:context.scopes,selectedClientId});
    if(context.binding.tenantId!==claims.tenantId||context.binding.actorId!==claims.actorId||context.binding.conversationId!==claims.conversationId||
      !Number.isSafeInteger(expiresAtMs)||claims.expiresAtMs>expiresAtMs)refuse(404);
    life.limitDeadline(Math.min(context.deadlineMs,expiresAtMs));
    return {context:{...context,deadlineMs:life.deadline()},selection:{binding:context.binding,scopes:context.scopes,selectedClientId,deadlineMs:life.deadline(),signal:life.signal}};
   }
   const call=(route,body,selected)=>life.run(()=>drafts.call(route,{...key,...body},selected.selection));
   async function source(selected){
    const base=await life.run(signal=>artifacts.editorSource(claims.versionId,selected.context,{write:claims.userCanWrite,signal}));
    if(base.version.versionId!==claims.versionId||!Buffer.isBuffer(base.bytes)||sha(base.bytes)!==base.version.object.sha256)refuse(404);
    return base;
   }
   function correlate(draft,base){
    if(draft.draftId!==key.draftId||draft.conversationId!==key.conversationId||draft.artifactId!==base.version.artifactId||draft.baseVersionId!==claims.versionId||
      draft.baseSha256!==base.version.object.sha256||draft.filename!==base.version.filename||!['docx','xlsx','pptx'].includes(draft.format)||!draft.filename.endsWith('.'+draft.format))refuse(404);
   }
   async function retained(base){
    const value=await life.run(()=>generation([{tenantId:claims.tenantId,kind:'conversation',subjectId:claims.conversationId},
     {tenantId:claims.tenantId,kind:'artifact',subjectId:base.version.artifactId}]));
    if(!Number.isSafeInteger(value)||value!==claims.suppressionGeneration)refuse(404);
   }
   let selected=await current(),draft=await call('editorRead',{},selected),base=await source(selected);correlate(draft,base);await retained(base);
   const writes=!['checkFileInfo','getFile'].includes(info.operation);
   if(writes&&!claims.userCanWrite)refuse(401);
   // Creating a relative file is deliberately forbidden for every user. The
   // corresponding CheckFileInfo permission is false; no publication path exists.
   if(info.operation==='relative')refuse(401);
   const body=await wopiBody(info,life,info.operation==='save'?undefined:0);
   if(info.operation==='save'){
    if(!body.length)refuse(400);
    try{inspectOfficeEdit(body,draft.format);}catch{refuse(400);}
   }
   if(writes){
    // Even an empty lock request body may have arrived slowly. Re-admit
    // immediately before every effect, after all body and structure checks.
    selected=await current();draft=await call('editorRead',{},selected);base=await source(selected);correlate(draft,base);await retained(base);
   }
   let result;
   if(writes){
    try{
     if(info.operation==='save')result=info.lock===null?await call('lock',{operation:'get'},selected).then(r=>({status:409,lock:r.lock})):
      await call('save',{lock:info.lock,expectedSequence:draft.sequence,sha256:sha(body),bytesBase64:body.toString('base64'),kind:'autosave'},selected);
     else result=await call('lock',{operation:info.operation,...(info.operation==='get'?{}:{lock:info.lock}),...(info.operation==='relock'?{oldLock:info.oldLock}:{})},selected);
    }catch(error){
     // A Core sequence/publish refusal is not retried. A still-current editor
     // may receive the current lock; a replaced/expired editor gets no lock.
     if(codeOf(error)!=='OFFICE_DRAFT_CONFLICT')throw error;
     const currentLock=await call('lock',{operation:'get'},selected);result={status:409,lock:currentLock.lock};
    }
   }
   // No result/bytes leave after a lost native session, takeover or suppression.
   // Generation is the final awaited read, matching canonical download links.
   selected=await current();base=await source(selected);draft=await call('editorRead',{},selected);correlate(draft,base);await retained(base);
   codec.verify(info.token,{fileId:info.fileId});life.check();
   const bytes=draft.bytesBase64===null?base.bytes:Buffer.from(draft.bytesBase64,'base64');
   const version=r=>`${claims.editSessionId}:${r.sequence}:${r.sha256??r.baseSha256}`;
   if(result){
    const headers=result.status===409||info.operation==='get'?{'x-wopi-lock':result.lock}:{};
    if(result.receipt)headers['x-wopi-itemversion']=version(result.receipt);
    return wopiResponse(result.status,null,headers);
   }
   if(info.operation==='getFile'){
    if(bytes.length>info.maxExpectedSize)refuse(412);
    return wopiResponse(200,bytes,{'content-type':'application/octet-stream','content-length':String(bytes.length),'x-wopi-itemversion':version(draft)});
   }
   const canWrite=claims.userCanWrite&&['draft','publish-refused'].includes(draft.state),user=sha(JSON.stringify([claims.tenantId,claims.actorId]));
   return wopiResponse(200,JSON.stringify({BaseFileName:draft.filename,OwnerId:user,UserId:user,Size:bytes.length,Version:version(draft),
    UserCanWrite:canWrite,ReadOnly:!canWrite,UserCanNotWriteRelative:true,UserCanRename:false,
    SupportsLocks:canWrite,SupportsGetLock:canWrite,SupportsExtendedLockLength:true,SupportsUpdate:canWrite}),{'content-type':'application/json; charset=utf-8'});
  }catch(error){const code=codeOf(error);return wopiResponse(refusalStatus(error)??(uncertain(error)?500:typeof code==='string'&&code.startsWith('WOPI_TOKEN_')?401:unavailable.has(code)?404:500));}
  finally{life?.close();cancelWopiBody(request);}
 }});
}
