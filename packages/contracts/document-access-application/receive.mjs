import canonicalize from 'canonicalize';
import {validateInspectRequest,validateDownloadRequest,validateHistoryRequest,validateListRequest,validateInspection,validateHistory,validateList,validateError} from './generated-validator.mjs';
import {errorStatuses} from './generated-status.mjs';
import {documentAccessMetadata} from './generated-protocol.mjs';
import {ARTIFACT_MIME_TYPES,assertNativeArtifactEvidenceBinding} from '../artifacts-0.2/artifact-formats.mjs';
import {fail,parseBytes,admittedRequests,admittedVersions,admitNativeInspection} from '../document-application/boundary.mjs';
export {DocumentResponseError} from '../document-application/boundary.mjs';
export {receiveDocumentDownload} from '../document-application/download.mjs';
export {documentAccessVersion} from './protocol.mjs';
export {documentAccessMetadata};
const validators=Object.freeze({inspect:validateInspectRequest,download:validateDownloadRequest,history:validateHistoryRequest,list:validateListRequest});
const same=(a,b)=>canonicalize(a)===canonicalize(b);
function routeValidator(route){if(typeof route!=='string'||!Object.hasOwn(validators,route))fail('INVALID_ROUTE');return validators[route];}
function listResponse(result,request){
 if(!validateList(result))fail('INVALID_RESPONSE');
 if(result.scope!==request.scope||result.versions.length>request.limit||result.nextCursor!==null&&result.nextCursor===request.cursor)fail('LIST_MISMATCH');
 const first=result.versions[0],artifacts=new Set(),ids=new Set();
 for(const version of result.versions){
  try{assertNativeArtifactEvidenceBinding(version.binding,version.evidence);}catch{fail('EVIDENCE_BINDING');}
  if(version.object.bytes>16*1024*1024||!same(version.scopes,version.object.scopes)||version.scopes.some(x=>x.tenantId!==version.binding.tenantId))fail('VERSION_SCOPE_OR_SIZE');
  const scopeKeys=new Set(version.scopes.map(canonicalize));if(version.evidence.some(e=>e.scopes.some(s=>!scopeKeys.has(canonicalize(s)))))fail('EVIDENCE_SCOPE');
  const format=Object.keys(ARTIFACT_MIME_TYPES).find(key=>ARTIFACT_MIME_TYPES[key]===version.mimeType);
  if(!format||!version.filename.endsWith('.'+format)||version.scopes.length!==1||
   !['client','private-user'].includes(version.scopes[0].kind)||version.scopes[0].kind==='private-user'&&version.scopes[0].resourceId!==version.binding.actorId||
   ids.has(version.versionId)||artifacts.has(version.artifactId)||
   ['tenantId','actorId'].some(key=>version.binding[key]!==first.binding[key])||
   request.scope==='conversation'&&(version.binding.conversationId!==first.binding.conversationId||!same(version.scopes,first.scopes))||
   request.scope==='client'&&(version.scopes.length!==1||version.scopes[0].kind!=='client'||!same(version.scopes,first.scopes)))fail('LIST_MISMATCH');
  ids.add(version.versionId);artifacts.add(version.artifactId);
 }
 return result;
}
function historyResponse(result,request){
 if(!validateHistory(result))fail('INVALID_RESPONSE');
 if(result.anchorVersionId!==request.versionId||result.versions.length>request.limit)fail('HISTORY_MISMATCH');
 const first=result.versions[0],ids=new Set();
 if(request.cursor===null&&first.versionId!==result.headVersionId)fail('HISTORY_MISMATCH');
 for(const [index,version]of result.versions.entries()){
  try{assertNativeArtifactEvidenceBinding(version.binding,version.evidence);}catch{fail('EVIDENCE_BINDING');}
  if(version.object.bytes>16*1024*1024||!same(version.scopes,version.object.scopes)||version.scopes.some(x=>x.tenantId!==version.binding.tenantId))fail('VERSION_SCOPE_OR_SIZE');
  const scopeKeys=new Set(version.scopes.map(canonicalize));if(version.evidence.some(e=>e.scopes.some(s=>!scopeKeys.has(canonicalize(s)))))fail('EVIDENCE_SCOPE');
  const format=Object.keys(ARTIFACT_MIME_TYPES).find(key=>ARTIFACT_MIME_TYPES[key]===version.mimeType);
  if(!format||!version.filename.endsWith('.'+format)||version.artifactId!==result.artifactId||ids.has(version.versionId)||
   !same(version.scopes,first.scopes)||['tenantId','actorId','conversationId'].some(key=>version.binding[key]!==first.binding[key])||
   index>0&&result.versions[index-1].parentVersionId!==version.versionId)fail('HISTORY_MISMATCH');
  ids.add(version.versionId);
 }
 const last=result.versions.at(-1);
 if(result.nextCursor===null?last.parentVersionId!==null:last.parentVersionId===null||ids.has(last.parentVersionId)||result.nextCursor===request.cursor)fail('HISTORY_MISMATCH');
 return result;
}
export function receiveDocumentRequest(route,utf8Bytes){const validate=routeValidator(route),request=parseBytes(utf8Bytes,2*1024*1024);if(!validate(request))fail('INVALID_REQUEST');admittedRequests.set(request,route);return request;}
/** Same admission as the frozen document receiver for an inspect answer, over every canonical inspection variant. */
export async function receiveDocumentResponse(route,httpStatus,utf8Bytes,request){
 routeValidator(route);if(admittedRequests.get(request)!==route)fail('UNADMITTED_REQUEST');if(!Number.isInteger(httpStatus)||httpStatus<100||httpStatus>599)fail('INVALID_STATUS');
 const result=parseBytes(utf8Bytes,16*1024*1024);
 if(httpStatus!==200){if(!validateError(result)||errorStatuses[result.error.code]!==httpStatus)fail('INVALID_ERROR_RESPONSE');return result;}
 if(route==='download')fail('BINARY_RESPONSE_REQUIRED');
 if(route==='history')return historyResponse(result,request);
 if(route==='list')return listResponse(result,request);
 if(!validateInspection(result))fail('INVALID_RESPONSE');
 if(result.kind==='native-file')return admitNativeInspection(result,request);
 const{version,inspection}=result;
 try{assertNativeArtifactEvidenceBinding(version.binding,version.evidence);}catch{fail('EVIDENCE_BINDING');}
 if(version.object.bytes>16*1024*1024||!same(version.scopes,version.object.scopes)||version.scopes.some(x=>x.tenantId!==version.binding.tenantId))fail('VERSION_SCOPE_OR_SIZE');
 const scopeKeys=new Set(version.scopes.map(canonicalize));if(version.evidence.some(e=>e.scopes.some(s=>!scopeKeys.has(canonicalize(s)))))fail('EVIDENCE_SCOPE');
 if(inspection.sha256!==version.object.sha256||inspection.bytes!==version.object.bytes||version.mimeType!==ARTIFACT_MIME_TYPES[inspection.format]||!version.filename.endsWith('.'+inspection.format))fail('INSPECTION_MISMATCH');
 if(version.versionId!==request.versionId)fail('VERSION_MISMATCH');
 admittedVersions.add(version);return result;
}
