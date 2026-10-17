/** PARTIAL_INPUT: explicit client UUID campaign lists only. Core owns selected-client campaign relations/counts. */
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
import {captureOutreachListClientSelection} from './request-context.mjs';
const ROUTES=Object.freeze({query_outreach:'/api/clio/tools/query_outreach'});
function listRequest(current){
 const selected=captureOutreachListClientSelection(current.request),subject=current.authority.subject;
 if(hash(current.normalizationContext)!==hash({clientResolution:selected})||current.input.clientId!==selected.clientId||
  subject.kind!=='client'||subject.entityType!=='client'||subject.entityIds.length!==1||subject.entityIds[0].toLowerCase()!==selected.clientId||
  !subject.scopes.some(scope=>scope.kind==='client'&&scope.resourceId.toLowerCase()===selected.clientId))deny('ACCESS_DENIED');
 return current.request;
}
export const createOutreachQueryHandlers=(configuration,operations)=>
 createStoredNativeReadHandlers(configuration,operations,{family:'outreach-query',routes:ROUTES,requestBody:listRequest});
