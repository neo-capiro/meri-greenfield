/** Fetch routes for conversation write intents, mounted through the existing membership-gated product HTTP owner
 * (`product-access/http.mjs`): bounded JSON, the user's native session token, a fresh Core membership admission per request
 * and a membership recheck before any result is released. Identity, tenant and clients come only from that admission.
 *
 *  POST /api/conversations/intents/list    {conversationId, after?, limit?}  → {conversationId, intents:[...], next}
 *  POST /api/conversations/intents/inbox   {after?:{conversationId,deliveryId}, limit?}  → {rows:[...], next, pending:{count,complete}}
 *       the actor's proposals across every conversation, newest first; it lists and links, the conversation decides;
 *       rows of a retention-suppressed conversation are dropped from the page, never served and never fatal to it
 *  POST /api/conversations/intents/inbox-count {}  → {open, checkedAt}  prepared rows still inside their window (badge)
 *  POST /api/conversations/intents/decide  {conversationId, deliveryId, proposalId, commandSha256, decision:'approved'|'rejected'}
 *       → {status:'rejected'|'executed'|'indeterminate', deliveryId, proposalId, decision, outcome?}
 *
 * Wire shapes are a LOCAL PROPOSAL (lane 3, P-INT-8 control read + P-INT-11 decide route) pending dot's frontend review.
 * `decide` is an effect route: an indeterminate failure reports `outcome:'UNKNOWN'`; repeat the same request to learn the
 * result (the decision owner answers by proposal and approver, the command journal by command). */
import {createProductApplication} from '../product-access/http.mjs';
import {INTENT_APPROVAL_ERRORS,inboxPage} from './approval.mjs';
export const INTENT_PATHS=Object.freeze({list:'/api/conversations/intents/list',inbox:'/api/conversations/intents/inbox',inboxCount:'/api/conversations/intents/inbox-count',decide:'/api/conversations/intents/decide'});
export function createIntentApplication({owner,gate,now,limits,retention}){
 const route=(method,effect)=>({errors:INTENT_APPROVAL_ERRORS,effect,handle:({principal,body,signal,deadlineMs})=>owner[method]({principal,request:body,signal,deadlineMs})});
 const list=route('list',false),inbox=route('inbox',false);
 if(retention!==undefined){
  if(typeof retention?.withRelease!=='function')throw new TypeError('INTENT_RETENTION_CONFIGURATION');
  const subject=(principal,subjectId)=>({tenantId:principal.tenantId,kind:'conversation',subjectId});
  // The existing product release callback serializes only inside the canonical retention serving fence.
  list.release=({principal,result,signal,recheckMembership,publish})=>{
   const s=subject(principal,result.conversationId);
   return retention.withRelease([s],async(_signal,assertServable)=>{await assertServable(s);await recheckMembership();await assertServable(s);return publish(result);},{signal});
  };
  // A page spans conversations: one suppressed (deleted) conversation drops its rows and is never fatal to the others.
  inbox.release=({principal,result,signal,recheckMembership,publish})=>{
   const ids=[...new Set(result.rows.map(row=>row.conversationId))];
   if(ids.length===0)return recheckMembership().then(()=>publish(result));
   const subjects=ids.map(id=>subject(principal,id));
   return retention.withRelease(subjects,async(_signal,assertServable)=>{
    const servable=async s=>{try{await assertServable(s);return true;}catch(error){if(error?.code==='RETENTION_SUPPRESSED')return false;throw error;}};
    const kept=new Set();for(const s of subjects)if(await servable(s))kept.add(s.subjectId);
    await recheckMembership();
    for(const s of subjects)if(kept.has(s.subjectId)&&!(await servable(s)))kept.delete(s.subjectId);
    return publish(inboxPage(result.rows.filter(row=>kept.has(row.conversationId)),result.next));
   },{signal});
  };
 }
 return createProductApplication({gate,now,limits,routes:{[INTENT_PATHS.list]:list,[INTENT_PATHS.inbox]:inbox,[INTENT_PATHS.inboxCount]:route('inboxCount',false),[INTENT_PATHS.decide]:route('decide',true)}});
}
