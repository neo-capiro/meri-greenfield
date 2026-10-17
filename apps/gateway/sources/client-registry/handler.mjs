/** Native registry lookup; private existing-client output requires current CONTROL visibility. */
import {types} from 'node:util';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {ownFields} from '../source-admission.mjs';
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
const routes=Object.freeze({lookup_client_registry:'/api/clio/tools/lookup_client_registry'});
export function createClientRegistryHandlers(configuration,operations){
 const {authorizeResultForCall,...transport}=ownFields(configuration,['origin','now'],['getCredentials','credentialsForCall','fetchImpl','maxRequestMs','maxResponseBytes','authorizeResultForCall']);
 if(authorizeResultForCall!==undefined&&(typeof authorizeResultForCall!=='function'||types.isProxy(authorizeResultForCall)))deny('GATEWAY_CONFIGURATION');
 // Validate the finite operation set/configuration once without source I/O.
 const handlers=createStoredNativeReadHandlers(transport,operations,{family:'client-registry',routes});
 return handlers.map(({operation})=>({operation,async execute(call){try{
  if(!authorizeResultForCall)deny('UNAVAILABLE');
  const guard=authorizeResultForCall(operation,call);
  if(typeof guard!=='function'||types.isProxy(guard))deny('UNAVAILABLE');
  // Each invocation owns its guard closure, including concurrent reuse of
  // the same original call object. The passive transport has no resources.
  const [handler]=createStoredNativeReadHandlers(transport,[operation],{family:'client-registry',routes,
   async resultBody(current,result){
    // Validate the complete native DTO before interpreting a private identity.
    try{current.contract.assertOutput(result,{request:current.request,...current.normalizationContext});}catch{deny('INVALID_RESULT');}
    await guard({clientIds:result.existingClient===null?[]:[result.existingClient.id]});
    // Guidance repeats the private name/id. Failure withholds the entire DTO;
    // redaction would also manufacture an absence result.
    return result;
   },
  });
  return await handler.execute(call);
 }catch(error){throw safeFailure(error);}}}));
}
