/** Finite stored native disclosure producers; no query engine, issuer or ambient credentials. */
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {ownFields,frozenData} from '../source-admission.mjs';
import {retainedCall} from '../retained-reads/call-context.mjs';
import {createRetainedHttpTransport} from '../retained-reads/http-transport.mjs';
const ROUTES=Object.freeze({search_lda_filings:'/api/clio/tools/search_lda_filings',
 search_sec_filings:'/api/clio/tools/search_sec_filings',search_fara_registrations:'/api/clio/tools/search_fara_registrations'});
export function createDisclosuresHandlers(configuration,operations){
 const {credentialsForCall,...c}=ownFields(configuration,['origin','now'],['getCredentials','credentialsForCall','readSource','fetchImpl','maxRequestMs','maxResponseBytes']);
 if(credentialsForCall!==undefined&&(typeof credentialsForCall!=='function'||c.getCredentials!==undefined))deny('GATEWAY_CONFIGURATION');
 if(!Array.isArray(operations)||!operations.length)deny('GATEWAY_CONFIGURATION');
 const transport=createRetainedHttpTransport(c),seen=new Set();
 return operations.map(reference=>{
  const operation=frozenData(ownFields(reference,['id','version']));
  if(operation.version!=='0.2.0'||!Object.hasOwn(ROUTES,operation.id)||seen.has(operation.id))deny('GATEWAY_CONFIGURATION');seen.add(operation.id);
  const contract=resolveOperationContract(operation);if(contract.binding.group!=='disclosures')deny('GATEWAY_CONFIGURATION');
  return {operation,async execute(call){try{
   const {signal,...fields}=ownFields(call,['input','request','authority','argumentsSha256','normalizationContext'],['signal']),data=frozenData(fields);
   try{contract.normalizeInput(data.request,data.normalizationContext);}catch{deny('INVALID_ARGUMENTS');}
   const current=retainedCall(operation,{...data,...(signal===undefined?{}:{signal})},c.now),a=current.authority;
   const selected=credentialsForCall?createRetainedHttpTransport({...c,getCredentials:credentialsForCall(operation,call)}):transport;
   // The native wrapper owns one trim/clip/alias/default pass; do not normalize twice.
   const result=await selected.read(current,{path:ROUTES[operation.id],method:'POST',body:current.request,serviceSecret:true});
   try{contract.assertOutput(result,{request:current.request,...current.normalizationContext});}catch{deny('INVALID_RESULT');}
   if(current.signal?.aborted)deny('CANCELLED');if(c.now()>=current.deadlineMs)deny('DEADLINE');
   return JSON.stringify({binding:a.binding,subject:a.subject,operation,argumentsSha256:current.argumentsSha256,result});
  }catch(error){throw safeFailure(error);}}};
 });
}
