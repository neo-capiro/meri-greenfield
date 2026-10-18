/** Canonical schedule-role settings. Common HTTP/Temporal/version configuration remains owned by runtime/config.mjs.
 *
 * Request bound. `limits.requestMs` is the single budget of one dispatch/reconcile/cancel activity (`scheduled-dispatch.mjs` begin():
 * one operation lifetime of maxRequestMs covering the authority receipt, instruction read, store acceptance and Temporal start/describe)
 * and of the owned pool's connect/query timeouts. What it must protect is the workflow's uncertainty bound
 * (`conversations/scheduled-dispatch-workflow.ts`): the activity must end on its own lifetime well inside its 1-minute startToClose,
 * and `settleAfterUnknown` (2 minutes) must exceed startToClose plus the store/Temporal request bound. Every owner the worker composes
 * accepts up to 30000 ms (scheduled-dispatch, approved-instructions, scheduled-job-lifecycle, temporal-dispatch, temporal-run-evidence),
 * so the role takes the common 30000 ms ceiling: 60 s + 30 s < 120 s. The former 3000 ms cap protected nothing beyond that and made
 * the role unable to carry Core-backed authority calls, which take seconds through the public ALB (the reason control and worker run
 * at 25000 ms; render-material.mjs). */
import {isAbsolute} from 'node:path';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
const refuse=()=>{throw Object.assign(Error('SCHEDULE_SERVICE_CONFIGURATION'),{code:'SCHEDULE_SERVICE_CONFIGURATION'});};
/** Must stay below the dispatch activity's startToCloseTimeout (60000 ms) and, added to it, below settleAfterUnknown (120000 ms). */
export const SCHEDULE_MAX_REQUEST_MS=30000;
export function compileScheduleServiceConfiguration(configuration){
 try{
  const c=data(configuration),s=own(c.scheduledDispatch,['enabled','conversationTaskQueue','maxConcurrentActivities']);
  if(c.sourceEnabled!==false||s.enabled!==true||typeof s.conversationTaskQueue!=='string'||!/^[a-zA-Z0-9._\-]{1,128}$/u.test(s.conversationTaskQueue)||s.conversationTaskQueue===c.temporal?.taskQueue||
   !Number.isSafeInteger(s.maxConcurrentActivities)||s.maxConcurrentActivities<1||s.maxConcurrentActivities>10||typeof c.temporal?.taskQueue!=='string'||
   !Number.isSafeInteger(c.limits?.requestMs)||c.limits.requestMs<10||c.limits.requestMs>SCHEDULE_MAX_REQUEST_MS||!Number.isSafeInteger(c.limits.startupMs)||c.limits.startupMs<100||c.limits.startupMs>30000||!Number.isSafeInteger(c.limits.shutdownMs)||c.limits.shutdownMs<100||c.limits.shutdownMs>30000)refuse();
  let connectionFile;
  if(c.database!==undefined){
   const d=own(c.database,['connectionFile']);connectionFile=d.connectionFile;
   if(typeof connectionFile!=='string'||!isAbsolute(connectionFile)||connectionFile.length>4096||connectionFile.split(/[\\/]/u).includes('..'))refuse();
  }
  return data({scheduledDispatch:s,...(connectionFile===undefined?{}:{connectionFile})});
 }catch{refuse();}
}
