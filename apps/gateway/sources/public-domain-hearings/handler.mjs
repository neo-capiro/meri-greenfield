/** One governed hearing evidence page; named clients use the trusted native reference observation. */
import {deny} from '../../dispatch/operation-result.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
import {captureHearingClientSelection} from './request-context.mjs';
const routes=Object.freeze({search_committee_hearings:'/api/clio/tools/search_committee_hearings'});
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu;
export function createPublicDomainHearingsHandlers(configuration,operations){
 return createStoredNativeReadHandlers(configuration,operations,{family:'public-domain-hearings',routes,
  requirePerCall:current=>Boolean(current.normalizationContext.clientResolution&&!UUID.test(current.normalizationContext.clientResolution.reference)),
  requestBody(current){
   const expected={tenantId:current.authority.binding.tenantId,clientResolution:captureHearingClientSelection(current.request,current.normalizationContext.clientResolution)};
   if(hash(current.normalizationContext)!==hash(expected))deny('ACCESS_DENIED');
   const selected=expected.clientResolution;
   if(selected&&current.request.clientId!==selected.clientId)return {...current.request,clientId:selected.clientId};
   return current.request;
  },
 });
}
