/** Request-determined context for exact sources and explicit-year personnel; native check-ref resolves names. No clock or authority creation. */
import {resolveOperationContract,validateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {frozenData} from '../source-admission.mjs';
import {captureResearchClientReference,captureResearchClientSelection} from '../research-legal-legislation/request-context.mjs';

// With an explicit client, native Phase8 either keeps that client or rejects the folder as a mismatch, so the
// effective scope is request-determined. A folder alone takes the folder's private client, which is not observed.
const requestContext=(raw,resolution)=>{
 const clientResolution=captureResearchClientSelection(raw,resolution);
 return Object.freeze({clientResolution,
  effectiveScope:Object.freeze({jurisdiction:'FL',sessionKey:raw.sessionKey??'',folderId:raw.folderId||null,clientId:clientResolution?.clientId??null}),
  windowAsOf:null,defaultYear:null,owner:null});
};
/** Closed raw admission before any named resolution. */
export function assertNewsRawRequest(operation,request){
 let contract;try{contract=resolveOperationContract(operation);}catch{deny('GATEWAY_CONFIGURATION');}
 if(contract.binding.group!=='research-legal-news')deny('GATEWAY_CONFIGURATION');
 let raw;
 try{raw=frozenData(request);validateShape(contract.binding.input.replace(/Input$/,'Request'),raw);}
 catch{deny('INVALID_ARGUMENTS');}
 if(raw.folderId&&captureResearchClientReference(raw)===null||
  raw.view!=='source'&&(raw.view!=='personnel'||raw.year===undefined||raw.year===null))deny('UNAVAILABLE');
 return {contract,raw};
}
export function assertNewsSliceRequest(operation,request,resolution){
 const {contract,raw}=assertNewsRawRequest(operation,request);
 // Canonical selection validates typed source identity and personnel scalars before the native credential owner runs.
 const context=requestContext(raw,resolution);try{contract.normalizeInput(raw,context);}catch{deny('INVALID_ARGUMENTS');}
 return raw;
}
export function newsSliceContext(operation,request,resolution){
 return requestContext(assertNewsSliceRequest(operation,request,resolution),resolution);
}
/** Existing explicitly unscoped callers keep refusing every selected client. */
export function assertUnscopedNewsRequest(operation,request){
 const raw=assertNewsSliceRequest(operation,request);if(captureResearchClientSelection(raw)!==null)deny('UNAVAILABLE');return raw;
}
