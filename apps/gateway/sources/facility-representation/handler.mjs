/** Fixed stored facility producer; current client visibility stays with CONTROL. */
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
const routes=Object.freeze({get_representation:'/api/clio/tools/get_representation'});
export function createFacilityRepresentationHandlers(configuration,operations){
 return createStoredNativeReadHandlers(configuration,operations,{family:'facility-representation',routes,
  requestBody(current){
   if(hash(current.normalizationContext)!==hash({binding:current.authority.binding,subject:current.authority.subject}))deny('ACCESS_DENIED');
   return current.request;
  },
  resultBody(current,data){return {binding:current.authority.binding,subject:current.authority.subject,data};},
 });
}
