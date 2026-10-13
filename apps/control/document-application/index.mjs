/** Typed, opt-in document HTTP application. No model loop or activation side effects. */
import {createHash} from 'node:crypto';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {CommandError} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {ARTIFACT_MIME_TYPES,artifactFilename} from '../../../packages/contracts/artifacts-0.2/artifact-formats.mjs';
import {createArtifactService} from '../../artifacts/service.mjs';
import {createPostgresArtifactService} from '../../artifacts/postgres-service.mjs';
import {configuration,requestCurrent,data,own,same,v} from './current.mjs';
import {admitsDocumentFormat,admitsDocumentMime} from './format-admission.mjs';
import {errorResponse as bodyErrorResponse} from '../action-application/http.mjs';
import {requestInfo,jsonBody,response,errorResponse,fail} from './http.mjs';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(value);
function input(value,intent,admission){
 const raw=data(value),write=['create','revise'].includes(intent);
 own(raw,write?intent==='create'?['deliveryId','request']:['deliveryId','baseVersionId','request']:['versionId']);
 if(!write){if(!uuid(raw.versionId))fail('INVALID_REQUEST');return raw;}
 if(typeof raw.deliveryId!=='string'||!/^[A-Za-z0-9_.:@/-]{1,255}$/u.test(raw.deliveryId)||intent==='revise'&&!uuid(raw.baseVersionId))fail('INVALID_REQUEST');
 const request=v.request(raw.request);if(request.operation!==admission.descriptor.operation.id||!admitsDocumentFormat(admission,request.format))fail('UNSUPPORTED_DOCUMENT_FORMAT',422);
 return {...raw,request,baseVersionId:intent==='create'?null:raw.baseVersionId};
}
function version(value,context,admission,id){
 const record=v.version(value);
 if(id!==undefined&&record.versionId!==id||!same(record.scopes,context.scopes)||!same(record.object.scopes,context.scopes)||record.binding.tenantId!==context.binding.tenantId||record.binding.conversationId!==context.binding.conversationId||record.generationStatus!=='draft'||record.previewStatus!=='pending'||record.object.bytes>context.maxBytes||!admitsDocumentMime(admission,record.mimeType))fail('DOCUMENT_RESULT_REFUSED',502);
 // artifactFilename caps the ASCII basename at120, then appends .docx/.xlsx (125 total).
 // Canonical owners also bind the exact filename to its retained request before release.
 if(!/^[A-Za-z0-9._ -]{1,125}$/u.test(record.filename))fail('DOCUMENT_RESULT_REFUSED',502);
 return record;
}
function created(value,call,context,admission){
 const result=data(value);validateShape('ArtifactCreatedResult',result);version(result.version,context,admission);
 if(!same(result.version.binding,context.binding)||!same(result.version.evidence,context.evidence)||result.version.parentVersionId!==call.baseVersionId||result.version.mimeType!==ARTIFACT_MIME_TYPES[call.request.format]||result.version.filename!==artifactFilename(call.request)||result.execution.requestSha256!==v.hash({request:call.request,context,baseVersionId:call.baseVersionId})||result.inspection.format!==call.request.format||result.inspection.sha256!==result.version.object.sha256||result.inspection.bytes!==result.version.object.bytes)fail('DOCUMENT_RESULT_REFUSED',502);
 return result;
}
export function createDocumentApplication(options){
 const config=configuration(options),context=config.options.context,admission=config.formatAdmission;
 return Object.freeze({async handle(request){
  let life;const state={};
  try{
   const info=requestInfo(request);if(!config.enabled)fail('UNAVAILABLE',503);
   const at=config.now();if(!Number.isSafeInteger(at)||at<0)fail('DOCUMENT_CLOCK',500);
   const deadlineMs=Math.min(at+config.limits.maxRequestMs,context.deadlineMs);
   life=createOperationLifetime({deadlineMs,now:config.now,signal:info.signal,errorFactory:code=>new CommandError(code)});
   const current=requestCurrent(config,info,life,deadlineMs);let call;
   let body;try{body=await jsonBody(info,config.limits.maxRequestBytes,life,current.check);}catch(error){return bodyErrorResponse(error,{});}
   try{call=input(body,info.intent,admission);}catch(error){current.check();fail('INVALID_REQUEST');}
   await current.fresh();let result;
   if(info.intent==='create'||info.intent==='revise'){
    const writes=createPostgresArtifactService({...config.options,authority:current.authority,authorize:current.authorize});
    state.writeStarted=true;
    result=await life.run(async signal=>{const result=await writes.execute(call,config.credential,signal);state.completed=true;return result;});
    result=created(result,call,context,admission);
   }else{
    const forbidden=()=>fail('DOCUMENT_READ_BUDGET_REFUSED',500);
    const reads=createArtifactService({...config.options,authorize:current.authorize,budget:{reserve:forbidden,settle:forbidden}});
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
