/** Request-determined legal/client context; no name, folder, citation lookup or authority creation. */
import {resolveOperationContract,validateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {frozenData} from '../source-admission.mjs';

export const legalLegislationContext=Object.freeze({clientResolution:null,citationResolution:null});
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu;
/** Shared Core LegiWatch reference grammar. Resolution requires current native authority outside this pure capture. */
export function captureResearchClientSelection(request){
 let raw;try{raw=frozenData(request);}catch{deny('INVALID_ARGUMENTS');}
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.clientId!=null&&typeof raw.clientId!=='string')deny('INVALID_ARGUMENTS');
 const reference=raw.clientId?.trim().slice(0,80).trim()||null;
 if(reference===null)return null;
 if(!UUID.test(reference))deny('UNAVAILABLE');
 return Object.freeze({reference,clientId:reference.toLowerCase()});
}
/** Retained current authority is already canonically validated by the shared native handler. */
export function assertResearchClientSubject(authority,resolution){
 const subject=authority.subject;
 if(resolution===null){if(subject.kind==='client'||subject.entityType==='client')deny('ACCESS_DENIED');return;}
 if(subject.kind!=='client'||subject.entityType!=='client'||subject.entityIds.length!==1||subject.entityIds[0].toLowerCase()!==resolution.clientId||
  !subject.scopes.some(scope=>scope.kind==='client'&&scope.resourceId.toLowerCase()===resolution.clientId))deny('ACCESS_DENIED');
}
const requestContext=raw=>Object.freeze({clientResolution:captureResearchClientSelection(raw),citationResolution:null});
export function assertLegalSliceRequest(operation,request){
 let contract;try{contract=resolveOperationContract(operation);}catch{deny('GATEWAY_CONFIGURATION');}
 if(contract.binding.group!=='research-legal-legislation')deny('GATEWAY_CONFIGURATION');
 let raw;
 try{raw=frozenData(request);validateShape(contract.binding.input.replace(/Input$/,'Request'),raw);}
 catch{deny('INVALID_ARGUMENTS');}
 // Core never parses rules/versions citations. In references, an explicit ID
 // bypasses parsed identity; edition is independent only when empty or forced
 // empty by the explicit constitution code. Do not guess any parser result.
 const citationIndependent=raw.view==='rules'||raw.view==='versions'||Boolean(raw.referenceId)&&((raw.edition??'')===''||raw.code==='constitution');
 if(raw.folderId||operation.id==='get_legal_reference'&&(raw.citation??'')!==''&&!citationIndependent)deny('UNAVAILABLE');
 const context=requestContext(raw);
 try{contract.normalizeInput(raw,context);}catch{deny('INVALID_ARGUMENTS');}
 return raw;
}
export function legalSliceContext(operation,request){return requestContext(assertLegalSliceRequest(operation,request));}
/** Existing callers that explicitly require an unscoped request retain that strict boundary. */
export function assertUnscopedLegalRequest(operation,request){
 const raw=assertLegalSliceRequest(operation,request);if(captureResearchClientSelection(raw)!==null)deny('UNAVAILABLE');return raw;
}
