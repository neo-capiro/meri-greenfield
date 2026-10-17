/** Request-determined context for exact sources and explicit-year personnel; no lookup, clock or authority creation. */
import {resolveOperationContract,validateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {frozenData} from '../source-admission.mjs';
import {captureResearchClientSelection} from '../research-legal-legislation/request-context.mjs';

const requestContext=raw=>{
 const clientResolution=captureResearchClientSelection(raw);
 return Object.freeze({clientResolution,
  effectiveScope:Object.freeze({jurisdiction:'FL',sessionKey:raw.sessionKey??'',folderId:null,clientId:clientResolution?.clientId??null}),
  windowAsOf:null,defaultYear:null,owner:null});
};
export function assertNewsSliceRequest(operation,request){
 let contract;try{contract=resolveOperationContract(operation);}catch{deny('GATEWAY_CONFIGURATION');}
 if(contract.binding.group!=='research-legal-news')deny('GATEWAY_CONFIGURATION');
 let raw;
 try{raw=frozenData(request);validateShape(contract.binding.input.replace(/Input$/,'Request'),raw);}
 catch{deny('INVALID_ARGUMENTS');}
 if(raw.folderId||
  raw.view!=='source'&&(raw.view!=='personnel'||raw.year===undefined||raw.year===null))deny('UNAVAILABLE');
 // Canonical selection validates typed source identity and personnel scalars before the native credential owner runs.
 const context=requestContext(raw);try{contract.normalizeInput(raw,context);}catch{deny('INVALID_ARGUMENTS');}
 return raw;
}
export function newsSliceContext(operation,request){
 return requestContext(assertNewsSliceRequest(operation,request));
}
/** Existing explicitly unscoped callers keep refusing every selected client. */
export function assertUnscopedNewsRequest(operation,request){
 const raw=assertNewsSliceRequest(operation,request);if(captureResearchClientSelection(raw)!==null)deny('UNAVAILABLE');return raw;
}
