/** One governed hearing evidence page; named-client capture remains unavailable. */
import {deny} from '../../dispatch/operation-result.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
import {captureHearingClientSelection} from './request-context.mjs';
const routes=Object.freeze({search_committee_hearings:'/api/clio/tools/search_committee_hearings'});
export function createPublicDomainHearingsHandlers(configuration,operations){
 return createStoredNativeReadHandlers(configuration,operations,{family:'public-domain-hearings',routes,
  requestBody(current){
   const expected={tenantId:current.authority.binding.tenantId,clientResolution:captureHearingClientSelection(current.request)};
   if(hash(current.normalizationContext)!==hash(expected))deny('ACCESS_DENIED');
   return current.request;
  },
 });
}
