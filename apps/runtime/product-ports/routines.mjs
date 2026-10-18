/** Routines family (lane 5): `routinesApplicationFactory` from the canonical foreground feature (`apps/runtime/routines.mjs`).
 *
 * Composed DISABLED (the feature's own kill switch: no pool, client or owner is inspected; readiness `schedules.application` and
 * `schedules.inbox` report `disabled`) unless BOTH `configuration.routines.enabled === true` AND the trusted in-process owners below
 * are supplied to `routinesFamily(owners)`. Enabled in configuration without them, the factory reports `unavailable` and the routes
 * answer 503 ROUTINES_UNAVAILABLE, so control still starts and readiness names the gap. JSON configuration never supplies an owner.
 *
 * Owners the enabled feature borrows (`PRODUCTION_ROUTINE_OWNERS` says who must produce each):
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
 *
 * `context.policy` and `runControl` are produced HERE when `configuration.routines.core` is declared
 * (native-authority/routines-configuration.mjs): Core wire A as the policy port and Core wire B proofs consumed by the Core-proof
 * run control, both over the owner's live action session bound at `create({sessions})`. A trusted caller then must NOT also supply
 * them (one source each). Firing stays held: the schedule worker remains refused in the product preview (cli.mjs) and nothing here
 * grants unattended authority. The pool, the Temporal `client` (schedule + workflow + connection) and the clock come from the
 * trusted control context; the HTTP limits come from the control's own `limits`/`native.maxResponseBytes`. */
import {types} from 'node:util';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createRuntimeRoutinesFeature} from '../routines.mjs';
import {createRoutinesApplication} from '../../control/schedules/application-http.mjs';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
import {createTemporalConversationDispatcher} from '../../control/conversations/temporal-dispatch.mjs';
import {createPostgresRunCancelProofLedger} from '../../control/schedules/postgres-run-cancel-proofs.mjs';
import {createReadCredentialRelay} from '../read-credential-relay.mjs';
import {compileRoutinesCoreConfiguration,routinesReservedSecretFiles} from '../native-authority/routines-configuration.mjs';
import {createRoutinesCoreClient,createRoutinesServiceSecret} from '../native-authority/routines-core-client.mjs';
import {routineCancellationTrust} from '../native-authority/routines-cancellation-proof.mjs';
import {createRoutinesRunControl} from '../native-authority/routines-run-control.mjs';
import {readSecret as readRuntimeSecret} from '../config.mjs';
const fault=code=>Object.assign(new Error(code),{code});
/** Who must produce each owner before routines can be enabled in production. */
export const PRODUCTION_ROUTINE_OWNERS=Object.freeze({
 'context.policy':'this family from configuration.routines.core: Core wire A POST /api/clio/routines/policy/check over the owner\'s live native session (native-authority/routines-core-client.mjs)',
 'context.commandContext+allocationJson+template':'lane 1: scheduled allocation through the prepared-run compiler and whole facts',
 'context.workflow':'composer: the schedule worker task queue, once a schedule-worker role is rendered',
 runControl:'this family from configuration.routines.core.cancellationProof: Core wire B proof (pinned Ed25519, single-use jti in meri_schedules.run_cancel_proofs) consumed by native-authority/routines-run-control.mjs',
 retirement:'lane 1: native allocation retirement (prepared-run registry retireInitial / continuation retirement)',
});
/** The owners `configuration.routines.core` produces; a trusted caller supplies them only when `core` is absent. */
export const CORE_PRODUCED_ROUTINE_OWNERS=Object.freeze(['context.policy','runControl']);
/** Control-only opt-in `{enabled:boolean, core?}`; absent is off. Also the config.mjs validator for the `routines` key. */
export function compileRoutinesConfiguration(configuration){
 if(configuration?.routines===undefined)return false;
 let c;try{c=own(configuration.routines,['enabled'],['core']);}catch{throw fault('ROUTINES_CONFIGURATION');}
 if(typeof c.enabled!=='boolean')throw fault('ROUTINES_CONFIGURATION');compileRoutinesCoreConfiguration(configuration);return c.enabled;
}
function captureOwners(owners){
 if(owners===undefined)return null;
 try{
  const o=own(owners,['context','retirement'],['runControl','newId']);
  const context=own(o.context,['commandContext','allocationJson','template','workflow','limits'],['policy']);
  if((context.policy===undefined)!==(o.runControl===undefined)||o.runControl!==undefined&&typeof o.runControl?.cancel!=='function'||typeof o.retirement?.retire!=='function'||o.newId!==undefined&&typeof o.newId!=='function')throw Error();
  return Object.freeze({...o,context});
 }catch{throw fault('ROUTINES_CONFIGURATION');}
}
function captureTransport(transport){
 try{
  const t=own(transport??{},[],['fetchImpl','readSecret']);
  for(const fn of Object.values(t))if(typeof fn!=='function'||types.isProxy(fn))throw Error();return Object.freeze(t);
 }catch{throw fault('ROUTINES_CONFIGURATION');}
}
const unavailable=Object.freeze({state:()=>'unavailable',inboxState:()=>'unavailable',create:()=>createRoutinesApplication({enabled:false})});
/** Core-produced owners over the trusted control context. Construction is inert: no secret read, request, query or RPC. */
function coreOwners({core,configuration,pool,client,now,newId,transport}){
 const maxRequestMs=configuration.limits.requestMs,relay=createReadCredentialRelay();
 const getServiceSecret=createRoutinesServiceSecret({file:core.serviceSecretFile,reservedFiles:routinesReservedSecretFiles(configuration),readSecret:transport.readSecret??readRuntimeSecret});
 const wires=createRoutinesCoreClient({origin:core.origin,nativeCredentials:relay.port,getServiceSecret,now,maxRequestMs,...(transport.fetchImpl===undefined?{}:{fetchImpl:transport.fetchImpl})});
 const taskQueue=configuration.temporal?.taskQueue;if(typeof taskQueue!=='string')throw fault('ROUTINES_CONFIGURATION');
 const runControl=createRoutinesRunControl({trust:routineCancellationTrust(core.cancellationProof),ledger:createPostgresRunCancelProofLedger({pool}),
  store:createPostgresConversationStore({pool,now}),dispatcher:createTemporalConversationDispatcher({client,taskQueue,now,maxRequestMs}),now,maxRequestMs,...(newId===undefined?{}:{newId})});
 return Object.freeze({sessionRelay:relay,policy:Object.freeze({check:wires.policyCheck}),runControl,cancellationProofs:Object.freeze({issue:wires.cancellationProof})});
}
/** Family builder over optional trusted owners; `createRoutinesFamily` is the production entry (lane 1 owners do not exist yet).
 * `transport` ({fetchImpl, readSecret}) is a trusted test seam only; production uses global fetch and the runtime secret reader. */
export function routinesFamily(owners,transport){
 const captured=captureOwners(owners),seam=captureTransport(transport);
 return function createRoutinesFamily(context){
  const {configuration,pool,client,now=Date.now}=context??{};
  if(!compileRoutinesConfiguration(configuration))return {ports:{routinesApplicationFactory:createRuntimeRoutinesFeature({enabled:false})}};
  const core=compileRoutinesCoreConfiguration(configuration);
  if(captured===null||core===null&&captured.runControl===undefined)return {ports:{routinesApplicationFactory:unavailable}};
  if(core!==null&&captured.runControl!==undefined)throw fault('ROUTINES_CONFIGURATION');
  const produced=core===null?null:coreOwners({core,configuration,pool,client,now,newId:captured.newId,transport:seam});
  return {ports:{routinesApplicationFactory:createRuntimeRoutinesFeature({enabled:true,pool,client,now,...(captured.newId?{newId:captured.newId}:{}),
   context:{...captured.context,policy:produced?.policy??captured.context.policy},
   runControl:produced?.runControl??captured.runControl,retirement:captured.retirement,
   ...(produced===null?{}:{cancellationProofs:produced.cancellationProofs,sessionRelay:produced.sessionRelay}),
   limits:{maxRequestMs:configuration.limits.requestMs,maxRequestBytes:configuration.limits.requestBytes,maxResponseBytes:configuration.native.maxResponseBytes}})}};
 };
}
export const createRoutinesFamily=routinesFamily();
