/** PARTIAL_RESOURCE: current owned native conversation with the exact selected linked client; no dossier producer. */
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {ownFields,frozenData} from '../source-admission.mjs';
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
import {captureBusinessDevelopmentResource} from './request-context.mjs';
const ROUTES=Object.freeze({
 get_business_development_context:'/api/clio/tools/get_business_development_context',
 get_business_development_recent_changes:'/api/clio/tools/get_business_development_recent_changes',
});

export function createBusinessDevelopmentHandlers(configuration,operations){
 const config=ownFields(configuration,['origin','now'],['getCredentials','credentialsForCall','fetchImpl','maxRequestMs','maxResponseBytes']);
 const handlers=createStoredNativeReadHandlers(config,operations,{family:'business-development',routes:ROUTES,
  resultBody(current,result){
   try{current.contract.assertOutput(result,{request:current.request,...current.normalizationContext});}catch{deny('INVALID_RESULT');}
   const resource=captureBusinessDevelopmentResource(current.operation,current.request,current.authority.subject);
   if(current.operation.id==='get_business_development_context'&&result.prospect.linkedClientId?.toLowerCase()!==resource.clientId)deny('INVALID_RESULT');
   return result;
  },
 });
 return handlers.map(handler=>({operation:handler.operation,async execute(call){try{
  const {signal:ignored,...fields}=ownFields(call,['input','request','authority','argumentsSha256','normalizationContext'],['signal']);
  const data=frozenData(fields);
  captureBusinessDevelopmentResource(handler.operation,data.request,data.authority.subject);
  // The private owner pins/rechecks the native conversation receipt. Static credentials cannot prove that resource.
  if(!config.credentialsForCall)deny('UNAVAILABLE');
  return await handler.execute(call);
 }catch(error){throw safeFailure(error);}}}));
}
