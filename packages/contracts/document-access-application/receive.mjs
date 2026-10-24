import canonicalize from 'canonicalize';
import {validateInspectRequest,validateDownloadRequest,validateInspection,validateError} from './generated-validator.mjs';
import {errorStatuses} from './generated-status.mjs';
import {documentAccessMetadata} from './generated-protocol.mjs';
import {ARTIFACT_MIME_TYPES,assertNativeArtifactEvidenceBinding} from '../artifacts-0.2/artifact-formats.mjs';
import {fail,parseBytes,admittedRequests,admittedVersions,admitNativeInspection} from '../document-application/boundary.mjs';
export {DocumentResponseError} from '../document-application/boundary.mjs';
export {receiveDocumentDownload} from '../document-application/download.mjs';
export {documentAccessVersion} from './protocol.mjs';
export {documentAccessMetadata};
const validators=Object.freeze({inspect:validateInspectRequest,download:validateDownloadRequest});
const same=(a,b)=>canonicalize(a)===canonicalize(b);
function routeValidator(route){if(typeof route!=='string'||!Object.hasOwn(validators,route))fail('INVALID_ROUTE');return validators[route];}
export function receiveDocumentRequest(route,utf8Bytes){const validate=routeValidator(route),request=parseBytes(utf8Bytes,2*1024*1024);if(!validate(request))fail('INVALID_REQUEST');admittedRequests.set(request,route);return request;}
/** Same admission as the frozen document receiver for an inspect answer, over every canonical inspection variant. */
export async function receiveDocumentResponse(route,httpStatus,utf8Bytes,request){
 routeValidator(route);if(admittedRequests.get(request)!==route)fail('UNADMITTED_REQUEST');if(!Number.isInteger(httpStatus)||httpStatus<100||httpStatus>599)fail('INVALID_STATUS');
 const result=parseBytes(utf8Bytes,16*1024*1024);
 if(httpStatus!==200){if(!validateError(result)||errorStatuses[result.error.code]!==httpStatus)fail('INVALID_ERROR_RESPONSE');return result;}
 if(route==='download')fail('BINARY_RESPONSE_REQUIRED');
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
