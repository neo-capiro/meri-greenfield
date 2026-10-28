/** Explicit preview receiving boundary. Nothing invokes publication, mints authority or qualifies native rendering. */
import canonicalize from 'canonicalize';
import {validatePreviewRequest,validatePreviewPublication,validateError} from './generated-validator.mjs';
import {errorStatuses} from './generated-status.mjs';
import {ARTIFACT_MIME_TYPES} from '../artifacts-0.2/artifact-formats.mjs';
import {fail,isFailure,parseBytes,copyBytes,digest,admittedVersions,admittedNativeVersions} from '../document-application/boundary.mjs';
export const documentPreviewVersion='0.1.0';
export const documentPreviewMetadata=Object.freeze({contractVersion:documentPreviewVersion,
 publish:Object.freeze({method:'POST',path:'/api/documents/preview-publish',response:'json',effect:'write'}),
 read:Object.freeze({method:'POST',path:'/api/documents/preview',response:'bytes',effect:'read'}),
 maxBytes:8388608,maxPages:500,nativeQualified:false});
const requests=new WeakMap(),same=(a,b)=>canonicalize(a)===canonicalize(b),sha=/^[a-f0-9]{64}$/u;
const uuid=/^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-8][a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$/u;
const getter=(prototype,name)=>Object.getOwnPropertyDescriptor(prototype,name).get;
function source(version){
 if(!admittedVersions.has(version)||admittedNativeVersions.has(version))fail('UNADMITTED_VERSION');
 if(!['docx','xlsx','pptx','pdf'].some(format=>ARTIFACT_MIME_TYPES[format]===version.mimeType))fail('PREVIEW_UNSUPPORTED');
}
export function receiveDocumentPreviewRequest(action,utf8Bytes){
 if(!['publish','read'].includes(action))fail('INVALID_ROUTE');const request=parseBytes(utf8Bytes,1024);
 if(!validatePreviewRequest(request))fail('INVALID_REQUEST');requests.set(request,action);return request;
}
export function receiveDocumentPreviewPublication(httpStatus,utf8Bytes,request,version){
 if(requests.get(request)!=='publish')fail('UNADMITTED_REQUEST');source(version);
 if(request.versionId!==version.versionId)fail('VERSION_MISMATCH');
 if(!Number.isInteger(httpStatus)||httpStatus<100||httpStatus>599)fail('INVALID_STATUS');const result=parseBytes(utf8Bytes,262144);
 if(httpStatus!==200){if(!validateError(result)||errorStatuses[result.error.code]!==httpStatus)fail('INVALID_ERROR_RESPONSE');return result;}
 if(!validatePreviewPublication(result))fail('INVALID_RESPONSE');const r=result.preview,c=r.conversion,o=r.preview.object;
 if(r.versionId!==version.versionId||r.artifactId!==version.artifactId||r.tenantId!==version.binding.tenantId||r.conversationId!==version.binding.conversationId||
  !same(r.source,{sha256:version.object.sha256,bytes:version.object.bytes,mimeType:version.mimeType})||!same(o.scopes,version.scopes)||o.bytes>8388608||
  c.inputSha256!==r.source.sha256||c.outputSha256!==o.sha256||
  (version.mimeType==='application/pdf'?c.method!=='source-pdf'||c.qualificationId!==null||c.imageDigest!==null||o.sha256!==r.source.sha256||o.bytes!==r.source.bytes:
   c.method!=='office-pdf'||c.qualificationId===null||c.imageDigest===null))fail('PREVIEW_MISMATCH');
 return result;
}
/** Reload can read an existing preview after a fresh inspect; a publication request/receipt is never required to read. */
export async function receiveDocumentPreview(response,version,{maxBytes=8388608,timeoutMs=30000,signal}={}){
 source(version);
 if(!Number.isSafeInteger(maxBytes)||maxBytes<0||maxBytes>8388608||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)fail('INVALID_PREVIEW_OPTIONS');
 if(signal!==undefined){try{getter(AbortSignal.prototype,'aborted').call(signal);}catch{fail('INVALID_SIGNAL');}}
 let body,headers,status,redirected;
 try{body=getter(Response.prototype,'body').call(response);headers=getter(Response.prototype,'headers').call(response);status=getter(Response.prototype,'status').call(response);redirected=getter(Response.prototype,'redirected').call(response);}catch{fail('INVALID_RESPONSE_OBJECT');}
 const header=name=>Headers.prototype.get.call(headers,name),length=header('content-length'),pages=header('x-meri-preview-pages');
 const preview=Object.freeze({previewId:header('x-meri-preview-id'),sourceVersionId:header('x-meri-preview-source-version'),sourceSha256:header('x-meri-preview-source-sha256'),
  sha256:header('x-meri-preview-sha256'),pages:Number(pages),recordSha256:header('x-meri-preview-record-sha256'),nativeQualified:false});
 if(redirected||status!==200||header('content-type')!=='application/pdf'||header('content-disposition')!==`inline; filename="${version.filename}.preview.pdf"`||
  !/^[1-9][0-9]{0,6}$/u.test(length??'')||Number(length)>maxBytes||header('cache-control')!=='no-store'||header('x-content-type-options')!=='nosniff'||
  header('content-security-policy')!=="sandbox; default-src 'none'"||header('content-encoding')!==null||!uuid.test(preview.previewId??'')||
  preview.sourceVersionId!==version.versionId||preview.sourceSha256!==version.object.sha256||!sha.test(preview.sha256??'')||!sha.test(preview.recordSha256??'')||
  !/^[1-9][0-9]{0,2}$/u.test(pages??'')||preview.pages>500||version.mimeType==='application/pdf'&&(preview.sha256!==version.object.sha256||Number(length)!==version.object.bytes))fail('PREVIEW_HEADERS');
 let reader;try{reader=ReadableStream.prototype.getReader.call(body);}catch{fail('INVALID_PREVIEW_BODY');}
 let timer,abort,done=false;const end=Date.now()+timeoutMs;let rejectStop;const stop=new Promise((_,reject)=>{rejectStop=reject;});stop.catch(()=>{});
 const check=()=>{if(signal&&getter(AbortSignal.prototype,'aborted').call(signal))fail('PREVIEW_CANCELLED');if(Date.now()>=end)fail('PREVIEW_DEADLINE');};
 const wait=async action=>{check();const result=await Promise.race([action(),stop]);check();return result;};
 try{
  if(signal){abort=()=>rejectStop(Error('cancelled'));EventTarget.prototype.addEventListener.call(signal,'abort',abort,{once:true});}
  timer=setTimeout(()=>rejectStop(Error('deadline')),timeoutMs);check();const bytes=new Uint8Array(Number(length));let observed=0;
  while(true){const part=await wait(()=>ReadableStreamDefaultReader.prototype.read.call(reader));if(part.done){done=true;break;}
   const chunk=copyBytes(part.value,bytes.length-observed);Uint8Array.prototype.set.call(bytes,chunk,observed);observed+=chunk.length;}
  if(observed!==bytes.length)fail('PREVIEW_LENGTH');if(await wait(()=>digest(bytes))!==preview.sha256)fail('PREVIEW_HASH');return Object.freeze({version,preview,bytes});
 }catch(error){if(isFailure(error))throw error;if(signal&&getter(AbortSignal.prototype,'aborted').call(signal))fail('PREVIEW_CANCELLED');if(Date.now()>=end)fail('PREVIEW_DEADLINE');fail('PREVIEW_STREAM');}
 finally{clearTimeout(timer);if(signal&&abort)EventTarget.prototype.removeEventListener.call(signal,'abort',abort);if(!done){try{Promise.resolve(ReadableStreamDefaultReader.prototype.cancel.call(reader)).catch(()=>{});}catch{}}try{ReadableStreamDefaultReader.prototype.releaseLock.call(reader);}catch{}}
}
