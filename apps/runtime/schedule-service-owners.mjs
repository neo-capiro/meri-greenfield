/** The schedule service's four domain owners (D016-A item 5: unattended routine firing), composed from `configuration.routines.core`
 * for the `schedule-worker` role over the trusted pool/client the service owns or borrows:
 *  authority    Core firing grant (wire C) + Meri's schedule fence (native-authority/routines-firing-authority.mjs)
 *  runControl   the unattended stop under a `before_stop` grant through the existing lifecycle Stop order
 *  runAdmission lane 1: scheduled native admission (native-authority/scheduled-admission.mjs over the prepared-run template)
 *  retirement   lane 1: native allocation retirement (prepared-run registry retireInitial)
 * The first two are produced here; the last two are trusted in-process owners the composer (cli.mjs) supplies once lane 1's
 * worker-side producers exist. Anything missing refuses with SCHEDULE_SERVICE_UNAVAILABLE before any secret read, connection
 * or SQL, so the service cannot start half-composed: fail closed until every owner exists. The result is exactly the
 * `runtimePorts` record `startScheduleWorker` / `composeScheduleService` capture. Construction is inert. */
import {types} from 'node:util';
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {createPostgresConversationStore} from '../control/conversations/postgres-store.mjs';
import {createTemporalConversationDispatcher} from '../control/conversations/temporal-dispatch.mjs';
import {createPostgresScheduleOwner} from '../control/schedules/postgres-schedule-owner.mjs';
import {compileRoutinesCoreConfiguration,routinesReservedSecretFiles} from './native-authority/routines-configuration.mjs';
import {createRoutinesCoreClient,createRoutinesServiceSecret} from './native-authority/routines-core-client.mjs';
import {routineFiringTrust} from './native-authority/routines-firing-grant.mjs';
import {createRoutinesFiringAuthority,createRoutinesUnattendedRunControl} from './native-authority/routines-firing-authority.mjs';
import {readSecret as readRuntimeSecret,fault} from './config.mjs';

/** Who must produce each schedule-service owner. */
export const SCHEDULE_SERVICE_OWNERS=Object.freeze({
 authority:'this composer from routines.core.unattendedGrant: Core wire C firing grant verified against the pinned key, after the schedule owner\'s own active/generation fence',
 runControl:'this composer from routines.core.unattendedGrant: before_stop grant for the run\'s own occurrence, then the lifecycle Stop order',
 runAdmission:'lane 1: scheduled native admission over the prepared-run template (native-authority/scheduled-admission.mjs)',
 retirement:'lane 1: native allocation retirement (prepared-run registry retireInitial)',
});
const unavailable=()=>fault('SCHEDULE_SERVICE_UNAVAILABLE');
export function composeRoutinesWorkerOwners(options){
 let o,transport;
 try{
  o=own(options,['configuration','pool','client'],['now','runAdmission','retirement','transport','newId']);
  transport=own(o.transport??{},[],['fetchImpl','readSecret']);for(const fn of Object.values(transport))if(typeof fn!=='function'||types.isProxy(fn))throw Error();
  if(o.now!==undefined&&(typeof o.now!=='function'||types.isProxy(o.now))||o.newId!==undefined&&(typeof o.newId!=='function'||types.isProxy(o.newId)))throw Error();
 }catch{throw fault('SCHEDULE_SERVICE_CONFIGURATION');}
 const {configuration,pool,client}=o,now=o.now??Date.now;
 if(configuration?.routines?.enabled!==true)throw unavailable();
 const core=compileRoutinesCoreConfiguration(configuration);
 if(core===null||core.unattendedGrant===undefined||typeof configuration.scheduledDispatch?.conversationTaskQueue!=='string')throw unavailable();
 // Lane 1's owners are trusted ports, never configuration; their absence is the exact remaining task, named by SCHEDULE_SERVICE_OWNERS.
 let runAdmission,retirement;
 try{runAdmission=Object.freeze({admit:storageMethod(o.runAdmission,'admit')});retirement=Object.freeze({retire:storageMethod(o.retirement,'retire')});}catch{throw unavailable();}
 const maxRequestMs=configuration.limits.requestMs;
 const getServiceSecret=createRoutinesServiceSecret({file:core.serviceSecretFile,reservedFiles:routinesReservedSecretFiles(configuration),readSecret:transport.readSecret??readRuntimeSecret});
 const wires=createRoutinesCoreClient({origin:core.origin,getServiceSecret,now,maxRequestMs,...(transport.fetchImpl===undefined?{}:{fetchImpl:transport.fetchImpl})});
 const trust=routineFiringTrust(core.unattendedGrant),scheduleOwner=createPostgresScheduleOwner({pool});
 const authority=createRoutinesFiringAuthority({wires,trust,scheduleOwner,now,maxRequestMs});
 const runControl=createRoutinesUnattendedRunControl({wires,trust,scheduleOwner,now,maxRequestMs,store:createPostgresConversationStore({pool,now}),
  dispatcher:createTemporalConversationDispatcher({client,taskQueue:configuration.scheduledDispatch.conversationTaskQueue,lifecycle:true,now,maxRequestMs}),...(o.newId===undefined?{}:{newId:o.newId})});
 return Object.freeze({authority,runAdmission,runControl,retirement,pool,client,now});
}
