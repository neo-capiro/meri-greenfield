/** Fixed native wrappers preserve Core audit and PII policy; no registration or role authority. */
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {ownFields} from '../source-admission.mjs';
import {createRetainedHttpTransport} from '../retained-reads/http-transport.mjs';
import {acquisitionOperation,acquisitionCall} from './request-context.mjs';
const ROUTES=Object.freeze({search_acquisition_personnel:'/api/clio/tools/search_acquisition_personnel',
 get_acquisition_person:'/api/clio/tools/get_acquisition_person'});
export function createAcquisitionPersonnelHandlers(configuration,operations){
 const config=ownFields(configuration,['origin','now'],['getCredentials','fetchImpl','maxRequestMs','maxResponseBytes']);
 const transport=createRetainedHttpTransport(config);
 return operations.map(reference=>{
  const operation=acquisitionOperation(reference);
  if(!Object.hasOwn(ROUTES,operation.id))deny('GATEWAY_CONFIGURATION');
  return {operation,async execute(call){try{
   const context=acquisitionCall(operation,call,config.now),a=context.authority;
   // Flat normalized arguments only: never forward actorRole or native supersession hints.
   const result=await transport.read(context,{path:ROUTES[operation.id],method:'POST',body:context.input,serviceSecret:true});
   try{context.contract.assertOutput(result,{request:context.request,...context.normalizationContext});}catch{deny('INVALID_RESULT');}
   if(context.signal?.aborted)deny('CANCELLED');if(config.now()>=context.deadlineMs)deny('DEADLINE');
   return JSON.stringify({binding:a.binding,subject:a.subject,operation,argumentsSha256:context.argumentsSha256,result});
  }catch(error){throw safeFailure(error);}}};
 });
}
