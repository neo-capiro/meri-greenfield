/** Attended control operations. Core owns drafts, editor epochs and Save;
 * immutable publication stays behind the explicit Publish bridge. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {ARTIFACT_MIME_TYPES} from '../../../packages/contracts/artifacts-0.2/artifact-formats.mjs';
import {MAX_TTL_MS} from './wopi-access-token.mjs';
import {officeDraftRequest} from './core-draft-wire.mjs';
import {createOfficeDraftPublisher} from './publish-draft.mjs';
import {inspectOfficeEditAdmitted} from './edit-admission.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
const metadata=draft=>{const {bytesBase64,...receipt}=draft;return receipt;};
const routes=Object.freeze({open:'revise',read:'download',launch:'revise',renew:'revise',release:'download',discard:'revise',publish:'revise'});
export function attendedRequest(route,value){
 if(typeof route!=='string'||!Object.hasOwn(routes,route))fail('OFFICE_REQUEST');
 const extra=['launch','renew','release'].includes(route)?['editorId','expectedEpoch',...(route==='release'?[]:['mode']),...(route==='launch'?['operation']:[])]:route==='publish'?['sequence','sha256']:[];
 const input=data(own(value,['draftId','versionId',...extra]));
 if(typeof input.versionId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(input.versionId))fail('OFFICE_REQUEST');
 if(input.mode!==undefined&&!['edit','view'].includes(input.mode)||route==='launch'&&!['acquire','takeover'].includes(input.operation))fail('OFFICE_REQUEST');
 return input;
}
export const attendedIntent=(route,input)=>input.mode==='view'?'download':routes[route];
export function createAttendedOffice({drafts,launch,generation,now}){
 if(![drafts?.call,launch?.supports,launch?.launch,generation,now].every(f=>typeof f==='function'))fail('OFFICE_CONFIGURATION');
 return Object.freeze({async execute(route,input,access){
  const q=attendedRequest(route,input),{context,selectedClientId,artifacts,life}=access;
  const key={conversationId:context.binding.conversationId,draftId:q.draftId};
  officeDraftRequest('read',key);
  const selection={binding:context.binding,scopes:context.scopes,selectedClientId,deadlineMs:life.deadline(),signal:life.signal};
  const call=(name,body={})=>life.run(()=>drafts.call(name,{...key,...body},selection));
  const write=attendedIntent(route,q)==='revise';
  const source=()=>life.run(signal=>artifacts.editorSource(q.versionId,context,{write,signal}));
  const base=await source(),format=base.version.filename.split('.').at(-1);
  if(!['docx','xlsx','pptx'].includes(format)||base.version.mimeType!==ARTIFACT_MIME_TYPES[format])fail('EDITOR_FORMAT_UNSUPPORTED');
  const subjects=[{tenantId:context.binding.tenantId,kind:'conversation',subjectId:context.binding.conversationId},
   {tenantId:context.binding.tenantId,kind:'artifact',subjectId:base.version.artifactId}];
  const retained=()=>life.run(()=>generation(subjects)),start=await retained();
  if(!Number.isSafeInteger(start)||start<0)fail('EDITOR_RETENTION_UNAVAILABLE');
  function correlate(draft){
   if(draft.baseVersionId!==q.versionId||draft.artifactId!==base.version.artifactId||draft.baseSha256!==base.version.object.sha256||draft.format!==format||draft.filename!==base.version.filename)fail('EDITOR_SOURCE_MISMATCH');
   return draft;
  }
  let draft=route==='open'?null:correlate(await call('read'));
  if(['launch','renew'].includes(route)&&!launch.supports(format,q.mode))fail('EDITOR_CODE_ACTION_UNAVAILABLE');
  if(['launch','renew','release'].includes(route))officeDraftRequest('editor',{...key,
   operation:route==='launch'?q.operation:route==='renew'?'refresh':'release',editorId:q.editorId,expectedEpoch:q.expectedEpoch});
  if(route==='publish')officeDraftRequest('beginPublish',{...key,sequence:q.sequence,sha256:q.sha256});
  if(route!=='read'){
   await access.fresh('effect');await source();
   if(await retained()!==start)fail('EDITOR_RESULT_NOT_RELEASED');
  }
  let editor=null,form=null,result;
  if(route==='open')draft=correlate(await call('open',{artifactId:base.version.artifactId,baseVersionId:q.versionId,baseSha256:base.version.object.sha256,format,filename:base.version.filename}));
  else if(['launch','renew','release'].includes(route))editor=await call('editor',{
   operation:route==='launch'?q.operation:route==='renew'?'refresh':'release',editorId:q.editorId,expectedEpoch:q.expectedEpoch});
  else if(route==='discard')result=await call('discard');
  else if(route==='publish'){
   const publisher=createOfficeDraftPublisher({drafts,artifacts,publisherFor:access.publisherFor,validators:access.validators,generation,now});
   result=await publisher.publish({draftId:q.draftId,sequence:q.sequence,sha256:q.sha256},{context,selectedClientId,signal:life.signal});
   const publication=await life.run(signal=>artifacts.inspect(result.publication.version.versionId,context,{signal}));
   if(hash(publication.version)!==hash(result.publication.version))fail('EDITOR_PUBLICATION_MISMATCH');
   result={draft:result.draft,publication};
  }
  // Each effect is followed by current Core artifact authority and native session
  // checks. Final generation is the last await, before any token/result release.
  await access.fresh('release');await source();
  if(!['discard','publish'].includes(route)){
   draft=correlate(await call(['launch','renew'].includes(route)?'editorRead':'read',
    ['launch','renew'].includes(route)?{editorId:editor.editorId,editorEpoch:editor.epoch}:{}));
   const currentEditor=await call('editor',{operation:'inspect'});
   if(['launch','renew'].includes(route)&&(currentEditor.editorId!==editor.editorId||currentEditor.epoch!==editor.epoch||currentEditor.expiresAt!==editor.expiresAt))fail('OFFICE_DRAFT_CONFLICT');
   editor=currentEditor;
  }
  const current=await access.fresh('release');
  if(await retained()!==start)fail('EDITOR_RESULT_NOT_RELEASED');life.check();
  if(['launch','renew'].includes(route)){
   const expiresAtMs=Math.min(current.expiresAtMs,Date.parse(editor.expiresAt),now()+MAX_TTL_MS);
   form=launch.launch({editSessionId:q.draftId,fileId:q.draftId,versionId:q.versionId,conversationId:key.conversationId,
    editorId:editor.editorId,editorEpoch:editor.epoch,actorId:context.binding.actorId,tenantId:context.binding.tenantId,
    userCanWrite:write,expiresAtMs,suppressionGeneration:start,runBinding:context.binding,selectedClientId,scopesSha256:hash(context.scopes),sessionSha256:current.sessionSha256},{format});
  }
  if(route==='discard')return {discarded:result.discarded};
  if(route==='publish')return result;
  return {draft:metadata(draft),editor,launch:form};
 }});
}
