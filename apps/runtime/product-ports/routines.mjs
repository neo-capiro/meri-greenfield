/** Routines family (lane 5): `routinesApplicationFactory` from the canonical foreground feature (`apps/runtime/routines.mjs`).
 *
 * Composed DISABLED (the feature's own kill switch: no pool, client or owner is inspected; readiness `schedules.application` and
 * `schedules.inbox` report `disabled`) unless BOTH `configuration.routines.enabled === true` AND the trusted in-process owners below
 * are supplied to `routinesFamily(owners)`. Enabled in configuration without them, the factory reports `unavailable` and the routes
 * answer 503 ROUTINES_UNAVAILABLE, so control still starts and readiness names the gap. JSON configuration never supplies an owner.
 *
 * Owners the enabled feature borrows (none has a production producer yet; `PRODUCTION_ROUTINE_OWNERS` says who must produce each):
 *  context.commandContext  {binding: RunBinding, clientResolution}: the generic scheduled-task run identity the allocation is issued for
 *  context.allocationJson  the sealed tool-budget allocation for that binding (`gateway/budget/tool-budget-binding.mjs`), whose run
 *                          equals commandContext.binding and whose manifest digest equals template.manifestSha256
 *  context.template        {taskId, version, manifestSha256}: the one generic routine task identity of that allocation manifest
 *  context.workflow        {taskQueue, workflowIdPrefix}: the schedule action's Temporal target (the schedule worker's queue)
 *  context.policy          {check({selection, selectionSha256, signal, limitDeadline})}: Core's fresh schedule policy receipt
 *                          (authorized, binding, scopes, destinationResolution → 'meri-inbox', limits {maxCostMicrousd,
 *                          maxRuntimeSeconds, retryLimit}); membership alone is never policy
 *  context.limits          {maxRequestMs, maxFactBytes, retryLimit}: bounds of the schedule context owner
 *  runControl.cancel       cancel the current same-work run of an approved cancellation ({binding, signal, deadlineMs})
 *  retirement.retire       native physical-stop proof for each run of that lineage ({binding, signal, deadlineMs})
 * The pool, the Temporal `client` (schedule + workflow + connection) and the clock come from the trusted control context; the HTTP
 * limits come from the control's own `limits`/`native.maxResponseBytes`. */
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createRuntimeRoutinesFeature} from '../routines.mjs';
import {createRoutinesApplication} from '../../control/schedules/application-http.mjs';
const fault=code=>Object.assign(new Error(code),{code});
/** Who must produce each missing owner before routines can be enabled in production. */
export const PRODUCTION_ROUTINE_OWNERS=Object.freeze({
 'context.policy':'Core: schedule policy receipt route (fresh owner/client/tenant authority per selection)',
 'context.commandContext+allocationJson+template':'lane 1: scheduled allocation through the prepared-run compiler and whole facts',
 'context.workflow':'composer: the schedule worker task queue, once a schedule-worker role is rendered',
 runControl:'Core: unattended-grant proof for a service-authenticated cancellation of the owner\'s run (no service privilege)',
 retirement:'lane 1: native allocation retirement (prepared-run registry retireInitial / continuation retirement)',
});
/** Control-only opt-in `{enabled:boolean}`; absent is off. Also the config.mjs validator for the `routines` key. */
export function compileRoutinesConfiguration(configuration){
 if(configuration?.routines===undefined)return false;
 let c;try{c=own(configuration.routines,['enabled']);}catch{throw fault('ROUTINES_CONFIGURATION');}
 if(typeof c.enabled!=='boolean')throw fault('ROUTINES_CONFIGURATION');return c.enabled;
}
function captureOwners(owners){
 if(owners===undefined)return null;
 try{
  const o=own(owners,['context','runControl','retirement'],['newId']);
  own(o.context,['commandContext','allocationJson','template','workflow','policy','limits']);
  if(typeof o.runControl?.cancel!=='function'||typeof o.retirement?.retire!=='function'||o.newId!==undefined&&typeof o.newId!=='function')throw Error();
  return o;
 }catch{throw fault('ROUTINES_CONFIGURATION');}
}
const unavailable=Object.freeze({state:()=>'unavailable',inboxState:()=>'unavailable',create:()=>createRoutinesApplication({enabled:false})});
/** Family builder over optional trusted owners; `createRoutinesFamily` is the production entry (no owners exist yet). */
export function routinesFamily(owners){
 const captured=captureOwners(owners);
 return function createRoutinesFamily(context){
  const {configuration,pool,client,now=Date.now}=context??{};
  if(!compileRoutinesConfiguration(configuration))return {ports:{routinesApplicationFactory:createRuntimeRoutinesFeature({enabled:false})}};
  if(captured===null)return {ports:{routinesApplicationFactory:unavailable}};
  return {ports:{routinesApplicationFactory:createRuntimeRoutinesFeature({enabled:true,pool,client,context:captured.context,now,...(captured.newId?{newId:captured.newId}:{}),
   runControl:captured.runControl,retirement:captured.retirement,
   limits:{maxRequestMs:configuration.limits.requestMs,maxRequestBytes:configuration.limits.requestBytes,maxResponseBytes:configuration.native.maxResponseBytes}})}};
 };
}
export const createRoutinesFamily=routinesFamily();
