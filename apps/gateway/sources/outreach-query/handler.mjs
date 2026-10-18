/** PARTIAL_INPUT: explicit resolved-client campaign lists. Core owns selected-client campaign relations/counts. */
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
import {captureOutreachListClientSelection} from './request-context.mjs';
const ROUTES=Object.freeze({query_outreach:'/api/clio/tools/query_outreach'});
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu;
function listRequest(current){
 const selected=captureOutreachListClientSelection(current.request,current.normalizationContext.clientResolution),subject=current.authority.subject;
 if(hash(current.normalizationContext)!==hash({clientResolution:selected})||current.input.clientId!==selected.clientId||
  subject.kind!=='client'||subject.entityType!=='client'||subject.entityIds.length!==1||subject.entityIds[0].toLowerCase()!==selected.clientId||
  !subject.scopes.some(scope=>scope.kind==='client'&&scope.resourceId.toLowerCase()===selected.clientId))deny('ACCESS_DENIED');
 // Only the native domain body uses the observed UUID; private receiving stays bound to the original request.
 return UUID.test(selected.reference)?current.request:{...current.request,clientId:selected.clientId};
}
export const createOutreachQueryHandlers=(configuration,operations)=>
 createStoredNativeReadHandlers(configuration,operations,{family:'outreach-query',routes:ROUTES,
  requirePerCall:current=>Boolean(current.normalizationContext.clientResolution&&!UUID.test(current.normalizationContext.clientResolution.reference)),requestBody:listRequest});
