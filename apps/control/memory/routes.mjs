/** Memory surface routes for `createProductApplication`. Bodies are admitted by `wire.mjs`; the principal is the membership gate's.
 * `producer` is one producer for every request, or `producerFor({principal})` builds the request's own (the composed family binds
 * each producer to that request's admitted bearer, `application.mjs`). */
import {MEMORY_PATHS} from './protocol.mjs';
import {correctRequest,listRequest,proposeRequest,reviewDecisionRequest,statusRequest} from './wire.mjs';
import {refuse} from '../product-access/errors.mjs';
export const MEMORY_ERROR_STATUSES=Object.freeze({MEMORY_REQUEST_INVALID:400,MEMORY_SCOPE_REFUSED:403,MEMORY_CLIENT_REFUSED:403,MEMORY_PROPOSAL_NOT_FOUND:404,
 MEMORY_TARGET_NOT_FOUND:404,MEMORY_IDEMPOTENCY_CONFLICT:409,MEMORY_TARGET_INELIGIBLE:409,MEMORY_TARGET_UNAVAILABLE:503,MEMORY_JOURNAL_UNAVAILABLE:503,
 MEMORY_JOURNAL_STATE:500,MEMORY_JOURNAL_UNKNOWN:503,MEMORY_CANDIDATE_INVALID:500,MEMORY_UNAVAILABLE:503,MEMORY_RETENTION_SUBJECT_UNAVAILABLE:503,
 // Core's definite refusal of a submission (nothing recorded there) and the review path's own answers.
 MEMORY_SUBMISSION_REFUSED:409,MEMORY_REVIEW_UNAVAILABLE:503,MEMORY_DECISION_NOT_PENDING:409,MEMORY_DECISION_NOT_FOUND:404,
 MEMORY_DECISION_FORBIDDEN:403,MEMORY_DECISION_CONFLICT:409,MEMORY_DECISION_UNCERTAIN:503});
const surface=Object.freeze({kind:'surface'});
export function createMemoryRoutes({producer,producerFor}){
 if((producer===undefined)===(producerFor===undefined)||producerFor!==undefined&&typeof producerFor!=='function')refuse('PRODUCT_CONFIGURATION');
 const of=producerFor??(()=>producer);
 const route=(handle,effect=false)=>Object.freeze({handle:call=>handle(of({principal:call.principal}),call),errors:MEMORY_ERROR_STATUSES,effect});
 return Object.freeze({
  [MEMORY_PATHS.list]:route((p,{principal,body,signal,deadlineMs})=>p.list({principal,request:listRequest(body),signal,deadlineMs})),
  [MEMORY_PATHS.status]:route((p,{principal,body,signal,deadlineMs})=>p.status({principal,request:statusRequest(body),signal,deadlineMs})),
  [MEMORY_PATHS.propose]:route(async(p,{principal,body,signal,deadlineMs})=>({proposal:await p.propose({principal,request:proposeRequest(body),origin:surface,signal,deadlineMs})}),true),
  [MEMORY_PATHS.correct]:route(async(p,{principal,body,signal,deadlineMs})=>({proposal:await p.correct({principal,request:correctRequest(body),origin:surface,signal,deadlineMs})}),true),
  [MEMORY_PATHS.reviewList]:route((p,{principal,body,signal,deadlineMs})=>p.listPending({principal,request:listRequest(body),signal,deadlineMs})),
  [MEMORY_PATHS.reviewApprove]:route((p,{principal,body,signal,deadlineMs})=>p.decide({principal,request:reviewDecisionRequest(body,'approved'),decision:'approved',signal,deadlineMs}),true),
  [MEMORY_PATHS.reviewReject]:route((p,{principal,body,signal,deadlineMs})=>p.decide({principal,request:reviewDecisionRequest(body,'rejected'),decision:'rejected',signal,deadlineMs}),true),
 });
}
