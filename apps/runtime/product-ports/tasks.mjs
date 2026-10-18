/** Governed task-update commands family for the production product-port composer.
 *
 * Contributes `taskCommandApplicationFactory {create({sessions}), state()}`, which `createRuntimeProductApplications` calls only
 * when `configuration.sourceEnabled === true` and which product readiness reports as `tasks.commands`.
 *
 * `state()` is `disabled` unless BOTH `configuration.sourceEnabled === true` (G1; `config.mjs` accepts only `false` today) AND a
 * trusted Core grant owner is configured; then `composed`. While disabled, `create` returns null and the fixed mount answers
 * `503 TASK_COMMAND_UNAVAILABLE / NOT_DISPATCHED`. Construction is inert: no session, grant, pool or native call.
 *
 * The grant owner is a trusted in-process port, never JSON configuration (as for the schedule worker's domain owners):
 *   grant.servicesFor({binding, selectedClientId, approvalStore, signal, deadlineMs}) -> createTaskUpdateServices(...) result for
 *     exactly that run, its executor's trusted grant already bound and its approval guard reading `approvalStore`;
 *   grant.authorizeExecution({...freshSessionFacts, proposal, signal, deadlineMs}) -> {execution, credential} (Core's execution
 *     capability for an approved proposal of that run).
 * No Core owner implements either today, so the production family (`createTasksFamily`) has no grant and stays disabled.
 * `createTasksFamilyWith({grant})` is the seam the composer uses once Core's grant owner exists.
 *
 * `approvalStore` is the shared per-context decision reader from `intents.mjs` (`intentsComposition(context).approvalStore`), so
 * every per-run task executor rechecks the same Core decision the intent decide route records. `create({sessions})` builds the
 * per-session application (`apps/control/task-command-application/per-session.mjs`): services are built for each request's own
 * session run, never one run fixed at startup. */
import {types} from 'node:util';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createPerSessionTaskUpdateApplication} from '../../control/task-command-application/per-session.mjs';
import {intentsComposition} from './intents.mjs';
const fault=code=>Object.assign(new Error(code),{code});
const ordinary=fn=>typeof fn==='function'&&!types.isProxy(fn);
function httpLimits(configuration){
 const l=configuration.limits,n=configuration.native,ok=(v,max)=>Number.isSafeInteger(v)&&v>=1&&v<=max;
 if(!ok(l?.requestMs,60000)||!ok(l?.requestBytes,16777216)||!ok(n?.maxResponseBytes,16777216))throw fault('TASKS_CONFIGURATION');
 return Object.freeze({maxRequestMs:l.requestMs,maxRequestBytes:l.requestBytes,maxResponseBytes:n.maxResponseBytes});
}
/** A tasks family over an optional trusted Core grant owner. */
export function createTasksFamilyWith({grant}={}){
 let g=null;
 if(grant!==undefined){try{g=own(grant,['servicesFor','authorizeExecution']);}catch{throw fault('TASKS_CONFIGURATION');}if(!ordinary(g.servicesFor)||!ordinary(g.authorizeExecution))throw fault('TASKS_CONFIGURATION');}
 return function createTasksFamily(context){
  const shared=intentsComposition(context),c=context,configuration=c.configuration;
  const sourceEnabled=configuration?.sourceEnabled===true;
  const state=()=>sourceEnabled&&g!==null&&shared.approvalStore!==null?'composed':'disabled';
  const factory=Object.freeze({state,
   create(value){
    const {sessions}=own(value,['sessions']);if(state()!=='composed')return null;
    return createPerSessionTaskUpdateApplication({sessions,now:c.now,httpLimits:httpLimits(configuration),authorizeExecution:g.authorizeExecution,
     servicesFor:input=>g.servicesFor({...input,approvalStore:shared.approvalStore})});
   }});
  return {ports:{taskCommandApplicationFactory:factory}};
 };
}
/** Production family for `PRODUCT_FAMILIES`: `['tasks', createTasksFamily]` (no Core grant owner exists, so `disabled`). */
export const createTasksFamily=createTasksFamilyWith();
