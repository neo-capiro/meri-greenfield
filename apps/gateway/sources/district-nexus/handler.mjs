/** Fixed District Nexus readers. Meri adds its own lineage, never native authority. */
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
const routes=Object.freeze({get_district_nexus_context:'/api/clio/tools/get_district_nexus_context',get_district_nexus_changes:'/api/clio/tools/get_district_nexus_changes'});
export function createDistrictNexusHandlers(configuration,operations){
 return createStoredNativeReadHandlers(configuration,operations,{family:'district-nexus',routes,
  requestBody(current){
   if(hash(current.normalizationContext)!==hash({binding:current.authority.binding,subject:current.authority.subject}))deny('ACCESS_DENIED');
   return current.request;
  },
  resultBody(current,data){return {binding:current.authority.binding,subject:current.authority.subject,data};},
 });
}
