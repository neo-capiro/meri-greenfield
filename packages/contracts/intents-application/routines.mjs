/** Browser receiving boundary for the canonical routines service. It grants no scheduling or approval authority. */
import canonicalize from 'canonicalize';
import {validators} from './generated-validator.mjs';
import {parseText,expectedData,fail} from './boundary.mjs';
import {ROUTINE_PATHS,routineErrorStatus} from '../schedules-0.2/application-protocol.mjs';
export const routinesPaths=ROUTINE_PATHS;
export const routinesMetadata=Object.freeze({version:'0.1.0',routes:ROUTINE_PATHS,limits:{requestBytes:131072,responseBytes:2097152}});
const stem=Object.freeze({prepare:'Prepare',approve:'Approve',list:'List',reconcile:'Reconcile'});
const same=(a,b)=>canonicalize(a)===canonicalize(b),conflict=()=>fail('ROUTINES_CORRELATION');
const check=(name,value)=>{if(!validators[name]?.(value))fail('ROUTINES_SHAPE');return value;};
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const routeName=route=>{if(typeof route!=='string'||!Object.hasOwn(stem,route))fail('ROUTINES_ROUTE');return stem[route];};
/** Match all user-reviewed fields. Trusted workflow/task selections stay with the server owner. */
export function assertRoutineProposal(proposal,operation,request){
 check('RoutinesProposal',proposal);
 if(proposal.operation!==operation)conflict();
 const p=proposal.projection;
 if(operation==='cancel_scheduled_task'){
  const {scheduleId,runs,...cancel}=request,{runs:resolved,...choice}=proposal.cancel;
  // Only the canonical owner chooses running executions; the browser's mutation request must leave targets empty.
  if(runs.length!==0||!same(cancel,choice)||request.running==='leave'&&resolved.length!==0||
   scheduleId.toLowerCase()!==p.scheduleId.toLowerCase()||proposal.policy!==null||proposal.taskInstruction!==null)conflict();
 }else{
  if(proposal.taskInstruction!==request.taskInstruction.trim()||!same(proposal.policy,request.policy)||proposal.cancel!==null||
   p.timezone!==request.policy.spec.timezone||p.state!==(request.policy.paused?'paused':'active')||
   ['maxCostMicrousd','maxRuntimeSeconds','retryLimit'].some(key=>p[key]>request.requestedLimits[key])||
   operation==='update_scheduled_task'&&p.scheduleId.toLowerCase()!==request.scheduleId.toLowerCase())conflict();
 }
 return proposal;
}
export async function receiveRoutinesRequest(route,jsonText){const name=routeName(route),value=parseText(jsonText,routinesMetadata.limits.requestBytes);check('Routines'+name+'Request',value);return freeze(value);}
export async function receiveRoutinesResponse(route,status,jsonText,expected){
 const name=routeName(route),e=expectedData(expected,routinesMetadata.limits.responseBytes),keys=Object.keys(e??{}).sort();
 const wanted=['approve','reconcile'].includes(route)?['proposal','request']:['request'];
 if(!Number.isInteger(status)||!same(keys,wanted))fail('ROUTINES_EXPECTATION');
 check('Routines'+name+'Request',e.request);
 if(e.proposal){assertRoutineProposal(e.proposal,e.request.operation,e.request.request);if(e.proposal.proposalId!==e.request.proposalId||e.proposal.intentSha256!==e.request.intentSha256)conflict();}
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
 }
 return freeze(value);
}
