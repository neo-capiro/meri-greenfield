/** Typed, opt-in document HTTP application. No model loop or activation side effects. */
import {createHash} from 'node:crypto';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {CommandError} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {ARTIFACT_MIME_TYPES,artifactFilename,nativeArtifactDisposition} from '../../../packages/contracts/artifacts-0.2/artifact-formats.mjs';
import {createArtifactService} from '../../artifacts/service.mjs';
import {createPostgresArtifactService} from '../../artifacts/postgres-service.mjs';
import {configuration,requestCurrent,data,own,same,v} from './current.mjs';
import {admitDocumentFormats,admitsDocumentFormat,admitsDocumentMime} from './format-admission.mjs';
import {errorResponse as bodyErrorResponse} from '../action-application/http.mjs';
import {requestInfo,jsonBody,response,errorResponse,fail,faultOf} from './http.mjs';
import {previewConfiguration,previewRoute} from './preview-route.mjs';
import {nativeResults} from './native-results.mjs';
import {federalWorkbenchInput,federalWorkbenchRoute} from './federal-workbench.mjs';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(value);
function input(value,intent,admission){
 const raw=data(value),write=['create','revise'].includes(intent);
 if(intent.startsWith('federal-'))return federalWorkbenchInput(intent,raw);
 // Discovery is a closed empty request: the projected run is the session's own context binding, never a caller id.
 if(intent==='results'){own(raw,[]);return raw;}
 if(intent==='history'||intent==='list'){
  own(raw,[intent==='history'?'versionId':'scope','limit','cursor']);if((intent==='history'?!uuid(raw.versionId):!['conversation','client','owner'].includes(raw.scope))||!Number.isInteger(raw.limit)||raw.limit<1||raw.limit>100||raw.cursor!==null&&(typeof raw.cursor!=='string'||!/^[a-f0-9]{64}$/u.test(raw.cursor)))fail('INVALID_REQUEST');return raw;
 }
 own(raw,write?intent==='create'?['deliveryId','request']:['deliveryId','baseVersionId','request']:['versionId']);
 if(!write){if(!uuid(raw.versionId))fail('INVALID_REQUEST');return raw;}
 if(typeof raw.deliveryId!=='string'||!/^[A-Za-z0-9_.:@/-]{1,255}$/u.test(raw.deliveryId)||intent==='revise'&&!uuid(raw.baseVersionId))fail('INVALID_REQUEST');
 const request=v.request(raw.request);if(!admitsDocumentFormat(admission,request.format))fail('UNSUPPORTED_DOCUMENT_FORMAT',422);
 return {...raw,request,baseVersionId:intent==='create'?null:raw.baseVersionId};
}
function version(value,context,admission,id){
 const record=v.version(value);
 if(id!==undefined&&record.versionId!==id||!same(record.scopes,context.scopes)||!same(record.object.scopes,context.scopes)||record.binding.tenantId!==context.binding.tenantId||record.binding.actorId!==context.binding.actorId||record.binding.conversationId!==context.binding.conversationId||record.generationStatus!=='draft'||record.previewStatus!=='pending'||record.object.bytes>context.maxBytes||!admitsDocumentMime(admission,record.mimeType))fail('DOCUMENT_RESULT_REFUSED',502);
 // artifactFilename caps the ASCII basename at120, then appends .docx/.xlsx (125 total).
 // Canonical owners also bind the exact filename to its retained request before release.
 if(!/^[A-Za-z0-9._ -]{1,125}$/u.test(record.filename))fail('DOCUMENT_RESULT_REFUSED',502);
 return record;
}
function created(value,call,context,admission){
 const result=data(value);validateShape('ArtifactCreatedResult',result);version(result.version,context,admission);
 if(!same(result.version.binding,context.binding)||!same(result.version.evidence,context.evidence)||result.version.parentVersionId!==call.baseVersionId||result.version.mimeType!==ARTIFACT_MIME_TYPES[call.request.format]||result.version.filename!==artifactFilename(call.request)||result.execution.kind!=='native-document'||result.execution.requestSha256!==v.nativeRequestSha256(call.request,context,call.baseVersionId)||result.inspection.format!==call.request.format||result.inspection.sha256!==result.version.object.sha256||result.inspection.bytes!==result.version.object.bytes)fail('DOCUMENT_RESULT_REFUSED',502);
 return result;
}
/** Only a canonical captured workspace entry can expose native bytes. SDK task files are never in this lookup. */
async function nativeFile({config,current,life,versionId,intent,state}){
 if(!config.nativeFiles)return null;
 const context=config.options.context,retention=config.options.retention;
 const servable=async metadata=>{if(!retention)return;const subjects=[{tenantId:context.binding.tenantId,kind:'conversation',subjectId:context.binding.conversationId}];
  if(metadata){if(metadata.binding.conversationId!==context.binding.conversationId)subjects.push({tenantId:metadata.binding.tenantId,kind:'conversation',subjectId:metadata.binding.conversationId});subjects.push({tenantId:metadata.binding.tenantId,kind:'artifact',subjectId:metadata.entry.object.objectId});}
  for(const subject of subjects)await life.run(()=>retention.assertServable(subject));};
 await servable();const selected=await life.run(signal=>config.nativeFiles.read(versionId,signal));if(selected===null)return null;
 own(selected,['kind','binding','scopes','manifestId','createdAt','entry']);
 if(selected.kind!=='native-file'||selected.binding.tenantId!==context.binding.tenantId||selected.binding.actorId!==context.binding.actorId||!same(selected.scopes,context.scopes)||selected.entry.object.objectId!==versionId)fail('DOCUMENT_RESULT_REFUSED',502);
 const metadata={versionId,binding:selected.binding,manifestId:selected.manifestId,path:selected.entry.path,object:selected.entry.object,scopes:selected.scopes,createdAt:selected.createdAt};
 const result=v.nativeFileInspection({kind:'native-file',version:metadata,integrity:{sha256:metadata.object.sha256,bytes:metadata.object.bytes,currentBytesVerified:true}});
 if(metadata.object.bytes>context.maxBytes||metadata.object.bytes>config.limits.maxResponseBytes)fail('DOCUMENT_RESPONSE_LIMIT',413);
 state.readStarted=true;await current.authorize({action:intent==='download'?'artifact.download':'artifact.inspect',resource:{versionId,object:metadata.object,assetObjects:[]},requestSha256:v.hash({intent,versionId,context}),binding:context.binding,scopes:context.scopes,deadlineMs:context.deadlineMs,signal:life.signal});
 await servable(selected);const bytes=await life.run(signal=>config.options.objects.get(metadata.object,signal));
 if(!Buffer.isBuffer(bytes)||bytes.length!==metadata.object.bytes||createHash('sha256').update(bytes).digest('hex')!==metadata.object.sha256)fail('DOCUMENT_RESULT_REFUSED',502);
 const again=await life.run(signal=>config.nativeFiles.read(versionId,signal));if(!same(again,selected))fail('DOCUMENT_RESULT_REFUSED',502);
 await servable(selected);await current.fresh();current.check();state.completed=true;
 if(intent==='download')return new Response(Buffer.from(bytes),{status:200,headers:{'content-type':'application/octet-stream','content-disposition':nativeArtifactDisposition(metadata.path),'content-length':String(bytes.length),'cache-control':'no-store','x-content-type-options':'nosniff'}});
 if(Buffer.byteLength(JSON.stringify(result))>config.limits.maxResponseBytes)fail('DOCUMENT_RESPONSE_LIMIT',413);return response(result);
}
export function createDocumentApplication(options){
 const config=configuration(options),context=config.options.context;config.preview=previewConfiguration(config.previewOptions);
 return Object.freeze({async handle(request){
  let life;const state={};
  try{
   const info=requestInfo(request);if(!config.enabled)fail('UNAVAILABLE',503);
   // Retained versions use the six-format read contract, independently of PDF generation admission.
   // Preview publication reads a retained source; its own renderer gate governs conversion. PDF generation remains explicit.
   const admission=['inspect','download','history','list','preview','preview-publish'].includes(info.intent)?admitDocumentFormats({pdf:true}):config.formatAdmission;
   const at=config.now();if(!Number.isSafeInteger(at)||at<0)fail('DOCUMENT_CLOCK',500);
   const deadlineMs=Math.min(at+config.limits.maxRequestMs,context.deadlineMs);
   life=createOperationLifetime({deadlineMs,now:config.now,signal:info.signal,errorFactory:code=>new CommandError(code)});
   const current=requestCurrent(config,info,life,deadlineMs);let call;
   let body;try{body=await jsonBody(info,config.limits.maxRequestBytes,life,current.check);}catch(error){return bodyErrorResponse(error,{});}
   // A format this deployment has not admitted (PDF without a qualified renderer) is its own 422; every other malformed body is one closed refusal.
   try{call=input(body,info.intent,admission);}catch(error){current.check();if(faultOf(error)?.code==='UNSUPPORTED_DOCUMENT_FORMAT')throw error;fail('INVALID_REQUEST');}
   await current.fresh();let result;
   if(info.intent.startsWith('federal-')){
    result=await federalWorkbenchRoute({intent:info.intent,call,config,current,life,state,
      releasePublication:(value,write)=>created(value,write,context,admission)});
    if(result.savedDraft)result.savedDraft=version(result.savedDraft,context,admission);
   }else if(info.intent==='create'||info.intent==='revise'){
    const {ids,...writeOptions}=config.options;const writes=createPostgresArtifactService({...writeOptions,authorize:current.authorize});
    state.writeStarted=true;
    result=await life.run(async signal=>{const result=await writes.execute(call,signal);state.completed=true;return result;});
    result=created(result,call,context,admission);
   }else if(info.intent==='preview'||info.intent==='preview-publish'){
    return await previewRoute({config,admission,current,life,intent:info.intent,versionId:call.versionId,state,release:value=>version(value,context,admission,call.versionId)});
   }else if(info.intent==='results'){
    const results=await nativeResults({config,current,life,state});
    if(results===null)fail('DOCUMENT_RESULT_REFUSED',502);
    if(Buffer.byteLength(JSON.stringify(results))>config.limits.maxResponseBytes)fail('DOCUMENT_RESPONSE_LIMIT',413);
    return response(results);
   }else if(info.intent==='list'){
    const reads=createArtifactService({...config.options,authorize:current.authorize});state.readStarted=true;
    result=await life.run(signal=>reads.list(call,context,{signal}));own(result,['scope','versions','nextCursor']);
    result={...result,versions:result.versions.map(value=>v.version(value))};state.completed=true;
   }else if(info.intent==='history'){
    const reads=createArtifactService({...config.options,authorize:current.authorize});state.readStarted=true;
    result=await life.run(signal=>reads.history(call,context,{signal}));
    own(result,['artifactId','anchorVersionId','headVersionId','versions','nextCursor']);
    result={...result,versions:result.versions.map(value=>version(value,context,admission))};state.completed=true;
   }else{
    const native=await nativeFile({config,current,life,versionId:call.versionId,intent:info.intent,state});if(native!==null)return native;
    const reads=createArtifactService({...config.options,authorize:current.authorize});
    state.readStarted=true;
    result=await life.run(async signal=>{const value=await reads[info.intent](call.versionId,context,{signal});state.completed=true;return value;});
    own(result,info.intent==='download'?['version','bytes']:['version','inspection']);
    const record=version(result.version,context,admission,call.versionId);
    if(info.intent==='download'){
     if(!Buffer.isBuffer(result.bytes)||result.bytes.length!==record.object.bytes||createHash('sha256').update(result.bytes).digest('hex')!==record.object.sha256||result.bytes.length>config.limits.maxResponseBytes)fail('DOCUMENT_RESULT_REFUSED',502);
     const bytes=Buffer.from(result.bytes);await current.fresh();current.check();
     return new Response(bytes,{status:200,headers:{'content-type':record.mimeType,'content-disposition':`attachment; filename="${record.filename}"`,'content-length':String(bytes.length),'cache-control':'no-store','x-content-type-options':'nosniff'}});
    }
    const inspection=data(result.inspection);own(inspection,['sha256','bytes','format','nativeOpened','rendered','recalculated','members','details','currentBytesVerified']);
    const {currentBytesVerified,...material}=inspection;v.inspection(material);
    if(currentBytesVerified!==true||inspection.sha256!==record.object.sha256||inspection.bytes!==record.object.bytes||!admitsDocumentFormat(admission,inspection.format)||record.mimeType!==ARTIFACT_MIME_TYPES[inspection.format])fail('DOCUMENT_RESULT_REFUSED',502);
    result={version:record,inspection};
   }
   if(Buffer.byteLength(JSON.stringify(result))>config.limits.maxResponseBytes)fail('DOCUMENT_RESPONSE_LIMIT',413);
   await current.fresh();current.check();return response(result);
  }catch(error){return errorResponse(error,state);}finally{life?.close();}
 }});
}
