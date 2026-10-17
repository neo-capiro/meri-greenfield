/** Request-determined context for exact sources and explicit-year personnel; no lookup, clock or authority creation. */
import {resolveOperationContract,validateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {frozenData} from '../source-admission.mjs';

const requestContext=raw=>Object.freeze({clientResolution:null,
 effectiveScope:Object.freeze({jurisdiction:'FL',sessionKey:raw.sessionKey??'',folderId:null,clientId:null}),
 windowAsOf:null,defaultYear:null,owner:null});
export function assertUnscopedNewsRequest(operation,request){
 let contract;try{contract=resolveOperationContract(operation);}catch{deny('GATEWAY_CONFIGURATION');}
 if(contract.binding.group!=='research-legal-news')deny('GATEWAY_CONFIGURATION');
 let raw;
 try{raw=frozenData(request);validateShape(contract.binding.input.replace(/Input$/,'Request'),raw);}
 catch{deny('INVALID_ARGUMENTS');}
 if((raw.clientId?.trim().slice(0,80).trim()||null)!==null||raw.folderId||
  raw.view!=='source'&&(raw.view!=='personnel'||raw.year===undefined||raw.year===null))deny('UNAVAILABLE');
 // Canonical selection validates typed source identity and personnel scalars before the native credential owner runs.
 try{contract.normalizeInput(raw,requestContext(raw));}catch{deny('INVALID_ARGUMENTS');}
 return raw;
}
export function newsSliceContext(operation,request){
 return requestContext(assertUnscopedNewsRequest(operation,request));
}
