/** Browser receiving boundary for the canonical routines service. It grants no scheduling or approval authority. */
import canonicalize from 'canonicalize';
import {validators} from './generated-validator.mjs';
import {parseText,expectedData,fail} from './boundary.mjs';
import {ROUTINE_PATHS,ROUTINE_MANAGEMENT_SESSION_PATH,routineErrorStatus} from '../schedules-0.2/application-protocol.mjs';
export const routinesPaths=ROUTINE_PATHS;
export const routineManagementSessionPath=ROUTINE_MANAGEMENT_SESSION_PATH;
export const routinesMetadata=Object.freeze({version:'0.2.0',routes:ROUTINE_PATHS,limits:{requestBytes:131072,responseBytes:2097152}});
const stem=Object.freeze({prepare:'Prepare',approve:'Approve',list:'List',reconcile:'Reconcile',consentReview:'ConsentReview',consentApprove:'ConsentApprove'});
/** What each route's answer is admitted against: its captured request, and for a decision route also the exact proposal
 *  or review the caller was shown. A route is never answered against a context it did not carry. */
const expectationKeys=Object.freeze({prepare:['request'],approve:['proposal','request'],list:['request'],reconcile:['proposal','request'],consentReview:['request'],consentApprove:['request','review']});
const same=(a,b)=>canonicalize(a)===canonicalize(b),conflict=()=>fail('ROUTINES_CORRELATION');
const check=(name,value)=>{if(!validators[name]?.(value))fail('ROUTINES_SHAPE');return value;};
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const routeName=route=>{if(typeof route!=='string'||!Object.hasOwn(stem,route))fail('ROUTINES_ROUTE');return stem[route];};
/** Distinct scope-only receipt. Successful validation is no execution or conversation authority. */
export function receiveRoutineManagementSessionRequest(jsonText){return freeze(check('RoutinesManagementSessionRequest',parseText(jsonText,4096)));}
export function receiveRoutineManagementSessionReceipt(jsonText,expected,at){
 const context=check('RoutinesManagementContext',expectedData(expected,4096)),receipt=check('RoutinesManagementSessionReceipt',parseText(jsonText,4096));
 if(!Number.isSafeInteger(at)||at<0||receipt.expiresAtMs<=at||receipt.expiresAtMs-at>300000||!same(receipt.context,context))conflict();
 return freeze(receipt);
}
/** Match all user-reviewed fields. Trusted workflow/task selections stay with the server owner. */
export function assertRoutineProposal(proposal,operation,request){
 check('RoutinesProposal',proposal);
 if(proposal.operation!==operation)conflict();
 const p=proposal.projection;
 if(operation==='cancel_scheduled_task'){
  const {scheduleId,runs,...cancel}=request,{runs:resolved,...choice}=proposal.cancel;
  // Only the canonical owner chooses running executions; the browser's mutation request must leave targets empty.
  if(runs.length!==0||!same(cancel,choice)||request.running==='leave'&&resolved.length!==0||
   scheduleId.toLowerCase()!==p.scheduleId.toLowerCase()||proposal.policy!==null||proposal.taskInstruction!==null||proposal.work!==undefined)conflict();
 }else{
  // The reviewed work definition is the request's own, member for member: the approval can never show a definition the
  // caller did not ask for, and a request that asked for none is never given one here. It is optional on both sides, so
  // an ordinary routine is admitted exactly as before.
  if(proposal.taskInstruction!==request.taskInstruction.trim()||!same(proposal.policy,request.policy)||proposal.cancel!==null||
   !same(proposal.work??null,request.work??null)||
   p.timezone!==request.policy.spec.timezone||p.state!==(request.policy.paused?'paused':'active')||
   ['maxCostMicrousd','maxRuntimeSeconds','retryLimit'].some(key=>p[key]>request.requestedLimits[key])||
   operation==='update_scheduled_task'&&p.scheduleId.toLowerCase()!==request.scheduleId.toLowerCase())conflict();
 }
 return proposal;
}
export async function receiveRoutinesRequest(route,jsonText){const name=routeName(route),value=parseText(jsonText,routinesMetadata.limits.requestBytes);check('Routines'+name+'Request',value);return freeze(value);}
/** The reviewed facts must agree with themselves whichever way they were carried: the reviewed generation is the intent's
 *  own generation, the reviewed intent belongs to the reviewed schedule, the reviewed limits are that intent's own
 *  effective limits, and any observation the review carries speaks about that same generation. */
function assertReviewFacts(review){
 if(review.intent.generation!==review.generation||review.intent.projection.scheduleId!==review.scheduleId)conflict();
 // The reviewed limits are the reviewed intent's OWN effective limits, so a substituted or widened limit set is refused
 // here rather than shown to an owner as the routine's real budget.
 if(review.limits.maxCostMicrousd!==review.intent.projection.maxCostMicrousd||review.limits.maxRuntimeSeconds!==review.intent.projection.maxRuntimeSeconds||review.limits.retryLimit!==review.intent.projection.retryLimit)conflict();
 if(review.consent!==null&&review.consent.generation!==review.generation)conflict();
 return review;
}
/** The exact review a renewal decision was shown. It is admitted only as the answer to the request that asked for it. */
function assertRoutineConsentReview(review,request){
 check('RoutinesConsentReviewResponse',review);
 if(review.scheduleId!==request.scheduleId||review.reviewSha256!==request.reviewSha256)conflict();
 return assertReviewFacts(review);
}
export async function receiveRoutinesResponse(route,status,jsonText,expected){
 const name=routeName(route),e=expectedData(expected,routinesMetadata.limits.responseBytes),keys=Object.keys(e??{}).sort();
 const wanted=expectationKeys[route];
 if(!Number.isInteger(status)||!same(keys,wanted))fail('ROUTINES_EXPECTATION');
 check('Routines'+name+'Request',e.request);
 if(e.proposal){assertRoutineProposal(e.proposal,e.request.operation,e.request.request);if(e.proposal.proposalId!==e.request.proposalId||e.proposal.intentSha256!==e.request.intentSha256)conflict();}
 if(e.review)assertRoutineConsentReview(e.review,e.request);
 const value=parseText(jsonText,routinesMetadata.limits.responseBytes);
 if(status!==200){check('RoutinesErrorResponse',value);if(routineErrorStatus(value.error.code)!==status)fail('ROUTINES_STATUS');return freeze(value);}
 check('Routines'+name+'Response',value);
 if(route==='prepare')assertRoutineProposal(value.proposal,e.request.operation,e.request.request);
 if(route==='approve'){
  const r=value.receipt,p=e.proposal;
  if(value.operation!==p.operation||r.operation!==p.operation||r.intentId!==p.proposalId||!same(r.projection,p.projection)||r.outcome!=='ACKNOWLEDGED'||r.physicalStopProven!==false)conflict();
 }
 if(route==='reconcile'){
  if(value.intentId!==e.proposal.proposalId||value.operation!==e.proposal.operation||
   value.outcome==='ACKNOWLEDGED'&&(value.code!==null)||value.outcome==='UNRESOLVED'&&(value.code===null||value.reconciled))conflict();
 }
 if(route==='list'){
  const page=value.page,limit=e.request.limit??20,after=e.request.afterScheduleId?.toLowerCase()??null,rows=page.rows;
  if(rows.length>limit||page.hasMore&&rows.length!==limit||page.nextAfterScheduleId!==(page.hasMore?rows.at(-1)?.projection.scheduleId??null:null)||page.originalRuns.executions.length>(e.request.historyLimit??10))conflict();
  let prior=after;for(const row of rows){const id=row.projection.scheduleId.toLowerCase();if(prior!==null&&id<=prior)conflict();prior=id;}
  // MR-04: the observation facet is an ANSWER TO A REQUEST, never a default. A body that did not opt in is answered with
  // the exact legacy shape, and an opted-in body carries one facet per row: a facet nobody asked for and a facet that was
  // asked for but withheld are both refused here rather than tolerated.
  const asked=e.request.observation==='consent';
  for(const row of rows)if(Object.hasOwn(row,'consent')!==asked)conflict();
 }
 if(route==='consentReview'){
  if(value.scheduleId!==e.request.scheduleId)conflict();
  assertReviewFacts(value);
 }
 if(route==='consentApprove'){
  // The renewed window must be Core's own window for the generation that was reviewed, and it must be internally
  // consistent the same way the durable journal requires it: an `active` window is one whose expiry is still ahead.
  if(value.generation!==e.review.generation)conflict();
  if(value.expiresAtMs<=value.issuedAtMs||(value.state==='active')!==(value.expiresAtMs>value.observedAtMs))conflict();
 }
 return freeze(value);
}
