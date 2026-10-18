/** Manual tracking reads; named references are observed by the existing native resolver before UUID execution. */
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';

const ROUTES=Object.freeze({search_tracked_bills:'/api/clio/tools/search_tracked_bills'});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export function createTrackedBillsHandlers(configuration,operations){
 return createStoredNativeReadHandlers(configuration,operations,{family:'tracked-bills',routes:ROUTES,
  requirePerCall:current=>!UUID.test(current.normalizationContext.clientReference.trim()),
  requestBody(current){
   // Canonical admission already correlates this exact retained reference with the original request.
   const {clientReference}=current.normalizationContext;
   if(hash(current.normalizationContext)!==hash({binding:current.authority.binding,subject:current.authority.subject,clientReference}))deny('ACCESS_DENIED');
   // Core's delegated tool gate requires the exact selected UUID. Keep the
   // original reference in the Meri reservation, but bind the tool token to
   // the canonical outgoing body even for padded or uppercase UUIDs.
   if(current.request.clientId!==current.input.clientId)return {...current.request,clientId:current.input.clientId};
   return current.request;
  },
  resultBody(current,data){return {binding:current.authority.binding,subject:current.authority.subject,data};},
 });
}
