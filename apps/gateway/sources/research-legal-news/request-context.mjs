/** Request-determined news context; articles consume a separately captured cutoff, never an ambient clock or new authority. */
import {resolveOperationContract,validateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {frozenData} from '../source-admission.mjs';
import {captureResearchClientReference,captureResearchClientSelection} from '../research-legal-legislation/request-context.mjs';

// With an explicit client, native Phase8 either keeps that client or rejects the folder as a mismatch, so the
// effective scope is request-determined. A folder alone takes the folder's private client, which is not observed.
const requestContext=(raw,resolution,windowAsOf=null)=>{
 const clientResolution=captureResearchClientSelection(raw,resolution);
 return Object.freeze({clientResolution,
  effectiveScope:Object.freeze({jurisdiction:'FL',sessionKey:raw.sessionKey??'',folderId:raw.folderId||null,clientId:clientResolution?.clientId??null}),
  windowAsOf:raw.view==='articles'?windowAsOf:null,defaultYear:null,owner:null});
};
/** Closed raw admission before any named resolution. */
export function assertNewsRawRequest(operation,request){
 let contract;try{contract=resolveOperationContract(operation);}catch{deny('GATEWAY_CONFIGURATION');}
 if(contract.binding.group!=='research-legal-news')deny('GATEWAY_CONFIGURATION');
 let raw;
 try{raw=frozenData(request);validateShape(contract.binding.input.replace(/Input$/,'Request'),raw);}
 catch{deny('INVALID_ARGUMENTS');}
 if(raw.folderId&&captureResearchClientReference(raw)===null||
  !['source','articles'].includes(raw.view)&&(raw.view!=='personnel'||raw.year===undefined||raw.year===null))deny('UNAVAILABLE');
 if(raw.view==='articles'){
  // These are the current owner's finite selectors, checked before observing a
  // credential. The full contract validates them again with the captured cutoff.
  const days=Number(raw.days??7),offset=Math.max(0,Number(raw.offset)||0);
  if(Object.hasOwn(raw,'monitorId')||![1,3,7,14].includes(days)||!Number.isInteger(offset)||offset>10000||raw.folderId?.length>100)deny('INVALID_ARGUMENTS');
  return {contract,raw};
 }
 // Validate request-owned selectors before CONTROL can perform a named-client lookup. The
 // client-free validation copy supplies no authority and never replaces the original request.
 const selectors={...raw,clientId:null};
 try{contract.normalizeInput(selectors,requestContext(selectors));}catch{deny('INVALID_ARGUMENTS');}
 return {contract,raw};
}
export function assertNewsSliceRequest(operation,request,resolution,windowAsOf=null){
 const {contract,raw}=assertNewsRawRequest(operation,request);
 // Canonical selection validates typed source identity and personnel scalars before the native credential owner runs.
 if(raw.view==='articles'&&windowAsOf===null)deny('UNAVAILABLE');
 const context=requestContext(raw,resolution,windowAsOf);try{contract.normalizeInput(raw,context);}catch{deny('INVALID_ARGUMENTS');}
 return raw;
}
export function newsSliceContext(operation,request,resolution,windowAsOf=null){
 return requestContext(assertNewsSliceRequest(operation,request,resolution,windowAsOf),resolution,windowAsOf);
}
/** Existing explicitly unscoped callers keep refusing every selected client. */
export function assertUnscopedNewsRequest(operation,request){
 const raw=assertNewsSliceRequest(operation,request);if(captureResearchClientSelection(raw)!==null)deny('UNAVAILABLE');return raw;
}
