/** Memory surface routes for `createProductApplication`. Bodies are admitted by `wire.mjs`; the principal is the membership gate's. */
import {correctRequest,listRequest,proposeRequest,statusRequest} from './wire.mjs';
export const MEMORY_ERROR_STATUSES=Object.freeze({MEMORY_REQUEST_INVALID:400,MEMORY_SCOPE_REFUSED:403,MEMORY_CLIENT_REFUSED:403,MEMORY_PROPOSAL_NOT_FOUND:404,
 MEMORY_TARGET_NOT_FOUND:404,MEMORY_IDEMPOTENCY_CONFLICT:409,MEMORY_TARGET_INELIGIBLE:409,MEMORY_TARGET_UNAVAILABLE:503,MEMORY_JOURNAL_UNAVAILABLE:503,
 MEMORY_JOURNAL_STATE:500,MEMORY_JOURNAL_UNKNOWN:503,MEMORY_CANDIDATE_INVALID:500,MEMORY_UNAVAILABLE:503});
const surface=Object.freeze({kind:'surface'});
export function createMemoryRoutes({producer}){
 const route=(handle,effect=false)=>Object.freeze({handle,errors:MEMORY_ERROR_STATUSES,effect});
 return Object.freeze({
  '/api/memory/proposals/list':route(({principal,body,signal,deadlineMs})=>producer.list({principal,request:listRequest(body),signal,deadlineMs})),
  '/api/memory/proposals/status':route(({principal,body,signal,deadlineMs})=>producer.status({principal,request:statusRequest(body),signal,deadlineMs})),
  '/api/memory/proposals/propose':route(async({principal,body,signal,deadlineMs})=>({proposal:await producer.propose({principal,request:proposeRequest(body),origin:surface,signal,deadlineMs})}),true),
  '/api/memory/proposals/correct':route(async({principal,body,signal,deadlineMs})=>({proposal:await producer.correct({principal,request:correctRequest(body),origin:surface,signal,deadlineMs})}),true),
 });
}
