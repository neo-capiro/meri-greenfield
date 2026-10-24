/** Native inline personal prospect authority or exact current client receipt, including stored dossier evidence. */
import {types} from 'node:util';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {ownFields,frozenData} from '../source-admission.mjs';
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
import {captureBusinessDevelopmentResource} from './request-context.mjs';
const ROUTES=Object.freeze({
 get_business_development_context:'/api/clio/tools/get_business_development_context',
 get_business_development_evidence:'/api/clio/tools/get_business_development_evidence',
 get_business_development_recent_changes:'/api/clio/tools/get_business_development_recent_changes',
});

export function createBusinessDevelopmentHandlers(configuration,operations){
 const config=ownFields(configuration,['origin','now'],['getCredentials','credentialsForCall','readSource','fetchImpl','maxRequestMs','maxResponseBytes']);
 if(config.credentialsForCall!==undefined&&(typeof config.credentialsForCall!=='function'||types.isProxy(config.credentialsForCall)))deny('GATEWAY_CONFIGURATION');
 // Core re-resolves the owned prospect conversation and current client access.
 const transport=config.credentialsForCall?{...config,credentialsForCall(operation,call){
  const get=config.credentialsForCall(operation,call);
  if(typeof get!=='function'||types.isProxy(get))deny('GATEWAY_CONFIGURATION');
  return get;
 }}:config;
 const handlers=createStoredNativeReadHandlers(transport,operations,{family:'business-development',routes:ROUTES,
  resultBody(current,result){
   try{current.contract.assertOutput(result,{request:current.request,...current.normalizationContext});}catch{deny('INVALID_RESULT');}
   const resource=captureBusinessDevelopmentResource(current.operation,current.request,current.authority.subject);
   if(resource.clientId!==null&&current.operation.id==='get_business_development_context'&&result.prospect.linkedClientId?.toLowerCase()!==resource.clientId)deny('INVALID_RESULT');
   return result;
  },
 });
 return handlers.map(handler=>({operation:handler.operation,async execute(call){try{
  const {signal:ignored,...fields}=ownFields(call,['input','request','authority','argumentsSha256','normalizationContext'],['signal']);
  const data=frozenData(fields);
  captureBusinessDevelopmentResource(handler.operation,data.request,data.authority.subject);
  // CONTROL current authority is mandatory; client tasks also pin/recheck the native conversation receipt.
  if(!config.credentialsForCall&&!config.readSource)deny('UNAVAILABLE');
  return await handler.execute(call);
 }catch(error){throw safeFailure(error);}}}));
}
