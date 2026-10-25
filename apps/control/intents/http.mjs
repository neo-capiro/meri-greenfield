/** Fetch routes for conversation write intents, mounted through the existing membership-gated product HTTP owner
 * (`product-access/http.mjs`): bounded JSON, the user's native session token, a fresh Core membership admission per request
 * and a membership recheck before any result is released. Identity, tenant and clients come only from that admission.
 *
 *  POST /api/conversations/intents/list    {conversationId, after?, limit?}  → {conversationId, intents:[...], next}
 *  POST /api/conversations/intents/decide  {conversationId, deliveryId, proposalId, commandSha256, decision:'approved'|'rejected'}
 *       → {status:'rejected'|'executed'|'indeterminate', deliveryId, proposalId, decision, outcome?}
 *
 * Wire shapes are a LOCAL PROPOSAL (lane 3, P-INT-8 control read + P-INT-11 decide route) pending dot's frontend review.
 * `decide` is an effect route: an indeterminate failure reports `outcome:'UNKNOWN'`; repeat the same request to learn the
 * result (the decision owner answers by proposal and approver, the command journal by command). */
import {createProductApplication} from '../product-access/http.mjs';
import {INTENT_APPROVAL_ERRORS} from './approval.mjs';
export const INTENT_PATHS=Object.freeze({list:'/api/conversations/intents/list',decide:'/api/conversations/intents/decide'});
export function createIntentApplication({owner,gate,now,limits,retention}){
 const route=(method,effect)=>({errors:INTENT_APPROVAL_ERRORS,effect,handle:({principal,body,signal,deadlineMs})=>owner[method]({principal,request:body,signal,deadlineMs})});
 const list=route('list',false);
 if(retention!==undefined){
  if(typeof retention?.withRelease!=='function')throw new TypeError('INTENT_RETENTION_CONFIGURATION');
  // The existing product release callback serializes only inside the canonical retention serving fence.
  list.release=({principal,result,signal,recheckMembership,publish})=>{
   const subject={tenantId:principal.tenantId,kind:'conversation',subjectId:result.conversationId};
   return retention.withRelease([subject],async(_signal,assertServable)=>{await assertServable(subject);await recheckMembership();await assertServable(subject);return publish(result);},{signal});
  };
 }
 return createProductApplication({gate,now,limits,routes:{[INTENT_PATHS.list]:list,[INTENT_PATHS.decide]:route('decide',true)}});
}
