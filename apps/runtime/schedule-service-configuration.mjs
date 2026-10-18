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
 * at 25000 ms; render-material.mjs).
 *
 * Native client (lane B3). The worker's two lane-1 owners, scheduled admission and native retirement, are control native
 * operations (`/v1/routines/occurrences/{admit,retire}`, native-authority/routines-occurrence-http.mjs), so the role may declare
 * `native` ({origin, capabilityFile, loopback, maxResponseBytes}: the same closed block config.mjs validates for control and the
 * poller, without `preparedKickoff`). The service reads the capability file and owns the client (native-client.mjs) after its pool
 * and Temporal client, then hands all three to the trusted `runtimePortsFactory`. Absent `native`, the factory gets no client and the
 * production composer refuses: configuration alone never produces an owner. */
import {isAbsolute} from 'node:path';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
const refuse=()=>{throw Object.assign(Error('SCHEDULE_SERVICE_CONFIGURATION'),{code:'SCHEDULE_SERVICE_CONFIGURATION'});};
/** Must stay below the dispatch activity's startToCloseTimeout (60000 ms) and, added to it, below settleAfterUnknown (120000 ms). */
export const SCHEDULE_MAX_REQUEST_MS=30000;
/** native-client.mjs accepts at most this request bound; the role's `limits.requestMs` is capped to it for native calls. */
export const SCHEDULE_NATIVE_MAX_REQUEST_MS=10000;
function filePath(value){if(typeof value!=='string'||!isAbsolute(value)||value.length>4096||value.split(/[\\/]/u).includes('..'))refuse();return value;}
function nativeOrigin(value,loopback){
 let u;try{u=new URL(value);}catch{refuse();}
 if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||!(u.protocol==='https:'||loopback===true&&u.protocol==='http:'&&['127.0.0.1','[::1]'].includes(u.hostname))||u.origin!==value)refuse();
 return u.origin;
}
export function compileScheduleServiceConfiguration(configuration){
 try{
  const c=data(configuration),s=own(c.scheduledDispatch,['enabled','conversationTaskQueue','maxConcurrentActivities']);
  if(c.sourceEnabled!==false||s.enabled!==true||typeof s.conversationTaskQueue!=='string'||!/^[a-zA-Z0-9._\-]{1,128}$/u.test(s.conversationTaskQueue)||s.conversationTaskQueue===c.temporal?.taskQueue||
   !Number.isSafeInteger(s.maxConcurrentActivities)||s.maxConcurrentActivities<1||s.maxConcurrentActivities>10||typeof c.temporal?.taskQueue!=='string'||
   !Number.isSafeInteger(c.limits?.requestMs)||c.limits.requestMs<10||c.limits.requestMs>SCHEDULE_MAX_REQUEST_MS||!Number.isSafeInteger(c.limits.startupMs)||c.limits.startupMs<100||c.limits.startupMs>30000||!Number.isSafeInteger(c.limits.shutdownMs)||c.limits.shutdownMs<100||c.limits.shutdownMs>30000)refuse();
  let connectionFile;
  if(c.database!==undefined){
   const d=own(c.database,['connectionFile']);connectionFile=filePath(d.connectionFile);
  }
  let native;
  if(c.native!==undefined){
   const n=own(c.native,['origin','capabilityFile','loopback','maxResponseBytes']);
   if(typeof n.loopback!=='boolean'||!Number.isSafeInteger(n.maxResponseBytes)||n.maxResponseBytes<1024||n.maxResponseBytes>2097152)refuse();
   native={origin:nativeOrigin(n.origin,n.loopback),capabilityFile:filePath(n.capabilityFile),loopback:n.loopback,maxResponseBytes:n.maxResponseBytes};
   if(connectionFile!==undefined&&native.capabilityFile===connectionFile)refuse();
  }
  return data({scheduledDispatch:s,...(connectionFile===undefined?{}:{connectionFile}),...(native===undefined?{}:{native})});
 }catch{refuse();}
}
