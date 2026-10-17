/** Request-determined legal/client context; no name, folder, citation lookup or authority creation. */
import {resolveOperationContract,validateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {frozenData,ownFields} from '../source-admission.mjs';

export const legalLegislationContext=Object.freeze({clientResolution:null,citationResolution:null});
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu;
/** Shared Core LegiWatch reference grammar. Resolution requires current native authority outside this pure capture. */
export function captureResearchClientReference(request){
 let raw;try{raw=frozenData(request);}catch{deny('INVALID_ARGUMENTS');}
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.clientId!=null&&typeof raw.clientId!=='string')deny('INVALID_ARGUMENTS');
 return raw.clientId?.trim().slice(0,80).trim()||null;
}
export function captureResearchClientSelection(request,resolution){
 const reference=captureResearchClientReference(request);
 if(reference===null)return null;
 if(UUID.test(reference))return Object.freeze({reference,clientId:reference.toLowerCase()});
 if(resolution===undefined)deny('UNAVAILABLE');
 let value;try{value=ownFields(frozenData(resolution),['reference','clientId']);}catch{deny('ACCESS_DENIED');}
 if(value.reference!==reference||typeof value.clientId!=='string'||!UUID.test(value.clientId)||value.clientId!==value.clientId.toLowerCase())deny('ACCESS_DENIED');
 return Object.freeze({reference,clientId:value.clientId});
}
/** Retained current authority is already canonically validated by the shared native handler. */
export function assertResearchClientSubject(authority,resolution){
 const subject=authority.subject;
 if(resolution===null){if(subject.kind==='client'||subject.entityType==='client')deny('ACCESS_DENIED');return;}
 if(subject.kind!=='client'||subject.entityType!=='client'||subject.entityIds.length!==1||subject.entityIds[0].toLowerCase()!==resolution.clientId||
  !subject.scopes.some(scope=>scope.kind==='client'&&scope.resourceId.toLowerCase()===resolution.clientId))deny('ACCESS_DENIED');
}
const requestContext=(raw,resolution)=>Object.freeze({clientResolution:captureResearchClientSelection(raw,resolution),citationResolution:null});
function legalRequest(operation,request){
 let contract;try{contract=resolveOperationContract(operation);}catch{deny('GATEWAY_CONFIGURATION');}
 if(contract.binding.group!=='research-legal-legislation')deny('GATEWAY_CONFIGURATION');
 let raw;
 try{raw=frozenData(request);validateShape(contract.binding.input.replace(/Input$/,'Request'),raw);}
 catch{deny('INVALID_ARGUMENTS');}
 return {contract,raw};
}
/** Closed raw search admission before CONTROL establishes any named resolution. */
export function assertLegalSearchRequest(operation,request){
 const {contract,raw}=legalRequest(operation,request);
 if(contract.descriptor.operation.id!=='search_legislative_research')deny('GATEWAY_CONFIGURATION');
 return raw;
}
export function assertLegalSliceRequest(operation,request,resolution){
 const {contract,raw}=legalRequest(operation,request),search=contract.descriptor.operation.id==='search_legislative_research';
 // Core never parses rules/versions citations. In references, an explicit ID
 // bypasses parsed identity; edition is independent only when empty or forced
 // empty by the explicit constitution code. Do not guess any parser result.
 const citationIndependent=raw.view==='rules'||raw.view==='versions'||Boolean(raw.referenceId)&&((raw.edition??'')===''||raw.code==='constitution');
 if(!search&&(raw.folderId||(raw.citation??'')!==''&&!citationIndependent))deny('UNAVAILABLE');
 const context=requestContext(raw,search?resolution:undefined);
 try{contract.normalizeInput(raw,context);}catch{deny('INVALID_ARGUMENTS');}
 return raw;
}
export function legalSliceContext(operation,request,resolution){
 const raw=assertLegalSliceRequest(operation,request,resolution);
 return requestContext(raw,operation.id==='search_legislative_research'?resolution:undefined);
}
/** Existing callers that explicitly require an unscoped request retain that strict boundary. */
export function assertUnscopedLegalRequest(operation,request){
 const raw=assertLegalSliceRequest(operation,request);if(raw.folderId||captureResearchClientSelection(raw)!==null)deny('UNAVAILABLE');return raw;
}
