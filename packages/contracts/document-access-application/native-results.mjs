/** Public receiver for the separately named bounded native-result discovery answer (contractVersion 1.0.0).
 *
 * This is an ADDITIVE receiver: it is not part of DocumentAccessRoute0.2 and it does not widen the inspect, download,
 * history, list or preview shapes. It admits metadata selectors only. A selector names the immutable object of a
 * captured workspace entry so a client can ask the EXISTING current-authorized native inspect/download route for that
 * versionId; it carries no bytes, no host path, no SDK task state, no generated artifact and no artifactId, and it
 * grants no inspect or download admission. The existing document application re-checks Core, current context, source
 * identity and retention and re-verifies bytes at release. */
export const nativeResultsVersion='1.0.0';
export const NATIVE_RESULTS_MAX=32,NATIVE_RESULTS_MAX_BYTES=10485760,NATIVE_RESULTS_MAX_PATH=240;
const requestBytes=64*1024,responseBytes=256*1024;
const documentRoute=Object.freeze({method:'POST',path:'/api/documents/results',response:'json'});
/** Protocol facts only; no authority, no qualification, no mount evidence. */
export const nativeResultsMetadata=Object.freeze({contractVersion:nativeResultsVersion,route:documentRoute,maxResults:NATIVE_RESULTS_MAX,
 semantics:{
  discovery:'one bounded page of metadata selectors for the captured workspace entries of the authenticated action session\'s own run; strict ascending unique path order; truncated means the bound was reached, never that the library ended',
  authority:'metadata only: it admits no version for inspect or download and describes no bytes; the existing native inspect/download route remains the byte authority and re-checks current context and retention at release',
  privacy:'workspace entries only: SDK task and internal state are never selectors, and no host path, byte or base64 content is ever returned',
  absence:'a withheld, deleted, revoked or unsettled snapshot answers an error and never leaks a name',
 }});
const failure=(code,status)=>{const error=Error(code);error.code=code;error.status=status;throw error;};
const uuid=value=>typeof value==='string'&&/^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-8][a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$/u.test(value);
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
/** A selector path is a relative, bounded workspace path; nothing absolute, traversing, escaped or host-shaped. */
export function nativeResultPath(path){return typeof path==='string'&&path.length>0&&path.length<=NATIVE_RESULTS_MAX_PATH&&
 !path.startsWith('/')&&!path.endsWith('/')&&!path.includes('\\')&&!path.includes('\0')&&
 path.split('/').every(segment=>segment!==''&&segment!=='.'&&segment!=='..');}
export function assertNativeResultSelector(value,reverse=failure){
 const reject=typeof reverse==='function'?reverse:failure;
 if(value===null||typeof value!=='object'||Array.isArray(value))reject('NATIVE_RESULTS_OUTPUT');
 const keys=Reflect.ownKeys(value);if(keys.length!==5||keys.some(k=>!['versionId','path','bytes','sha256','executable'].includes(k)))reject('NATIVE_RESULTS_OUTPUT');
 if(!uuid(value.versionId)||!nativeResultPath(value.path)||!Number.isSafeInteger(value.bytes)||value.bytes<0||value.bytes>NATIVE_RESULTS_MAX_BYTES||
  !hex(value.sha256)||typeof value.executable!=='boolean')reject('NATIVE_RESULTS_OUTPUT');
 return Object.freeze({versionId:value.versionId,path:value.path,bytes:value.bytes,sha256:value.sha256,executable:value.executable});}
/** The whole answer, validated once here and reused by the control route and the browser receiver. Duplicate paths and
 * duplicate versionIds are corrupt output, not a page. */
export function assertNativeResultsSnapshot(value,reverse=failure){
 const reject=typeof reverse==='function'?reverse:failure;
 if(value===null||typeof value!=='object'||Array.isArray(value))reject('NATIVE_RESULTS_OUTPUT');
 const keys=Reflect.ownKeys(value);if(keys.length!==4||keys.some(k=>!['manifestId','capturedAt','results','truncated'].includes(k)))reject('NATIVE_RESULTS_OUTPUT');
 if(!uuid(value.manifestId)||typeof value.capturedAt!=='string'||!Number.isFinite(Date.parse(value.capturedAt))||
  typeof value.truncated!=='boolean'||!Array.isArray(value.results)||value.results.length>NATIVE_RESULTS_MAX)reject('NATIVE_RESULTS_OUTPUT');
 const paths=new Set(),versions=new Set();
 const results=value.results.map(row=>{const selector=assertNativeResultSelector(row,reject);
  if(paths.has(selector.path)||versions.has(selector.versionId))reject('NATIVE_RESULTS_DUPLICATE');paths.add(selector.path);versions.add(selector.versionId);return selector;});
 for(let index=1;index<results.length;index+=1)if(!(results[index-1].path<results[index].path))reject('NATIVE_RESULTS_ORDER');
 return Object.freeze({manifestId:value.manifestId,capturedAt:value.capturedAt,results:Object.freeze(results),truncated:value.truncated});}
/** Admitted request correlation token: one closed empty object, frozen, bound to the session that asked. */
export function receiveNativeResultsRequest(utf8Bytes){
 if(!(utf8Bytes instanceof Uint8Array)||utf8Bytes.length===0||utf8Bytes.length>requestBytes)failure('INVALID_REQUEST',400);
 let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(utf8Bytes));}catch{failure('INVALID_REQUEST',400);}
 if(value===null||typeof value!=='object'||Array.isArray(value)||Reflect.ownKeys(value).length!==0)failure('INVALID_REQUEST',400);
 return Object.freeze({route:'results'});}
/** Canonical receiver: foreign or malformed answers refuse and nothing is admitted for inspect or download. */
export function receiveNativeResultsResponse(httpStatus,utf8Bytes,request){
 if(typeof httpStatus!=='number'||!Number.isInteger(httpStatus)||request===null||typeof request!=='object'||request.route!=='results')failure('INVALID_REQUEST',400);
 if(httpStatus!==200)failure('NATIVE_RESULTS_STATUS',400);
 if(!(utf8Bytes instanceof Uint8Array)||utf8Bytes.length===0||utf8Bytes.length>responseBytes)failure('NATIVE_RESULTS_RESPONSE',400);
 let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(utf8Bytes));}catch{failure('NATIVE_RESULTS_RESPONSE',400);}
 return {route:'results',...assertNativeResultsSnapshot(value,code=>failure(code,400))};}
