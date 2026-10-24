/** Fixed native stored bill producers. Core owns native authentication/data; gateway owns current authority and receipts. */
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {ownFields,frozenData} from '../source-admission.mjs';
import {retainedCall} from '../retained-reads/call-context.mjs';
import {createRetainedHttpTransport} from '../retained-reads/http-transport.mjs';
const ROUTES=Object.freeze({search_congress_bills:'/api/clio/tools/search_congress_bills',read_bill_text:'/api/clio/tools/read_bill_text'});
export function createBillTextHandlers(configuration,operations){
 const {credentialsForCall,...c}=ownFields(configuration,['origin','now'],['getCredentials','credentialsForCall','readSource','fetchImpl','maxRequestMs','maxResponseBytes']);
 if(credentialsForCall!==undefined&&(typeof credentialsForCall!=='function'||c.getCredentials!==undefined))deny('GATEWAY_CONFIGURATION');
 const transport=createRetainedHttpTransport(c);
 return operations.map(operation=>{
  if(operation.version!=='0.2.0'||!Object.hasOwn(ROUTES,operation.id))deny('GATEWAY_CONFIGURATION');
  return {operation,async execute(call){try{
   const context=retainedCall(operation,call,c.now),a=context.authority;
   if(context.contract.binding.group!=='bill-text')deny('GATEWAY_CONFIGURATION');
   const normalized=context.contract.normalizeInput(context.request,context.normalizationContext);
   // Core's raw designation default uses its own calendar. Resolve before HTTP;
   // keep receiving validation against the original request and captured context.
   const input=frozenData({...context.input,...(operation.id==='search_congress_bills'&&normalized.metadata.directBillId?{query:normalized.metadata.directBillId}:{})});
   const currentTransport=credentialsForCall?createRetainedHttpTransport({...c,getCredentials:credentialsForCall(operation,call)}):transport;
   const result=await currentTransport.read(context,{path:ROUTES[operation.id],method:'POST',body:input,serviceSecret:true});
   try{context.contract.assertOutput(result,{request:context.request,...context.normalizationContext});}catch{deny('INVALID_RESULT');}
   if(operation.id==='read_bill_text'&&result.currentStatus==='unavailable')deny('UNAVAILABLE');
   if(context.signal?.aborted)deny('CANCELLED');if(c.now()>=context.deadlineMs)deny('DEADLINE');
   return JSON.stringify({binding:a.binding,subject:a.subject,operation,argumentsSha256:context.argumentsSha256,result});
  }catch(error){throw safeFailure(error);}}};
 });
}
