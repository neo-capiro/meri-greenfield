/** One-call control composition of the routine occurrence native operations (lane B3), so startControl needs a single splice.
 * Disabled unless the control configuration declares `routines.enabled` with `routines.core.unattendedGrant` (the same pin the
 * schedule worker fires under). Declared, it always mounts the private application; the owner inside refuses (503, no evidence)
 * until every trusted owner exists:
 *   - `owners.template`: the prepared candidate's scheduled-run template (scheduled-admission.mjs: principal, selectedClientId,
 *     policyRevision, versions, task, configurationSha256, allocationJson, runWindowMs, destinationId). Scheduled runs are prepared
 *     only by the dynamic-initial-run path, so the candidate exposes it only when that path is composed;
 *   - `owners.retirement`: the candidate's initial-run retirement ({retire({binding, signal, deadlineMs})} over
 *     prepared-run-bindings.mjs retireInitial with the control's ECS client);
 *   - the control pool (schedule owner, conversation store and the original-binding journal), always present in control;
 *   - Core wire C under the service identity (routines.core: origin, serviceSecretFile) for the per-occurrence consent.
 * `transport` ({fetchImpl, readSecret}) is a trusted test seam only. Nothing here reads configuration files, credentials or request
 * data; the service secret is read per call by the Core client. */
import {types} from 'node:util';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
import {createPostgresScheduleOwner} from '../../control/schedules/postgres-schedule-owner.mjs';
import {readSecret as readRuntimeSecret} from '../config.mjs';
import {compileRoutinesCoreConfiguration,routinesReservedSecretFiles} from './routines-configuration.mjs';
import {createRoutinesCoreClient,createRoutinesServiceSecret} from './routines-core-client.mjs';
import {routineFiringTrust} from './routines-firing-grant.mjs';
import {createRoutinesFiringAuthority} from './routines-firing-authority.mjs';
import {createScheduledNativeAdmission} from './scheduled-admission.mjs';
import {createRoutinesOccurrenceApplication} from './routines-occurrence-http.mjs';
import {createOccurrenceConsentAuthority,createRoutinesOccurrenceOwner} from './routines-occurrence-owner.mjs';

const fault=()=>Object.assign(Error('ROUTINES_OCCURRENCE_CONFIGURATION'),{code:'ROUTINES_OCCURRENCE_CONFIGURATION'});
const unavailable=()=>Object.assign(Error('ROUTINES_OCCURRENCE_UNAVAILABLE'),{code:'ROUTINES_OCCURRENCE_UNAVAILABLE'});
/** Who must produce each owner before the operations can serve. */
export const ROUTINES_OCCURRENCE_OWNERS=Object.freeze({
 template:'prepared candidate (dynamic initial runs): the scheduled-run template over its qualification, bindings digest, allocation and run window; the routine task identity is the lane-1 open input',
 retirement:'prepared candidate (dynamic initial runs): retireInitial over the sealed allocation and issuance rows with the control ECS client',
 consent:'this composer from routines.core.unattendedGrant: Core wire C before_admission grant per occurrence under the service identity',
});
/** Readiness must see these once the owner can write (schedules migrations 0001/0002, conversations 0012 initial_run_bindings). */
const TABLES=Object.freeze(['meri_schedules.projections','meri_schedules.intents','meri_schedules.occurrences','meri_conversations.initial_run_bindings','meri_conversations.initial_inputs']);
const refusing=Object.freeze({async admit(){throw unavailable();},async retire(){throw unavailable();}});

export function composeRoutinesOccurrences(options){
 let o,transport;
 try{
  o=own(options,['configuration','controlCapabilitySha256'],['pool','owners','transport','now']);
  transport=own(o.transport??{},[],['fetchImpl','readSecret']);for(const fn of Object.values(transport))if(typeof fn!=='function'||types.isProxy(fn))throw Error();
  if(o.now!==undefined&&(typeof o.now!=='function'||types.isProxy(o.now)))throw Error();
 }catch{throw fault();}
 const {configuration,controlCapabilitySha256}=o,now=o.now??Date.now;
 const core=configuration?.routines?.enabled===true?compileRoutinesCoreConfiguration(configuration):null;
 if(core===null||core.unattendedGrant===undefined)return Object.freeze({application:createRoutinesOccurrenceApplication({controlCapabilitySha256}),state:'disabled',tables:Object.freeze([])});
 const maxRequestMs=configuration.limits.requestMs;
 let owners=null;
 if(o.owners!==undefined){try{owners=own(o.owners,['template','retirement']);}catch{throw fault();}}
 const ready=owners!==null&&o.pool!==undefined;
 if(!ready)return Object.freeze({application:createRoutinesOccurrenceApplication({controlCapabilitySha256,owner:refusing,enabled:true,now,maxRequestMs}),state:'owners-unavailable',tables:Object.freeze([])});
 const getServiceSecret=createRoutinesServiceSecret({file:core.serviceSecretFile,reservedFiles:routinesReservedSecretFiles(configuration),readSecret:transport.readSecret??readRuntimeSecret});
 const wires=createRoutinesCoreClient({origin:core.origin,getServiceSecret,now,maxRequestMs,...(transport.fetchImpl===undefined?{}:{fetchImpl:transport.fetchImpl})});
 const trust=routineFiringTrust(core.unattendedGrant),scheduleOwner=createPostgresScheduleOwner({pool:o.pool}),store=createPostgresConversationStore({pool:o.pool,now});
 const firing=createRoutinesFiringAuthority({wires,trust,scheduleOwner,now,maxRequestMs});
 const template=owners.template;
 // The template is validated now, inertly, against the same admission constructor the per-occurrence owner uses: a malformed
 // candidate template refuses control startup instead of every later admission.
 createScheduledNativeAdmission({pool:o.pool,store,scheduleOwner,authority:{async authorize(){throw unavailable();}},template,now,maxRequestMs});
 const admissionFor=(occurrence,occurrenceKey)=>createScheduledNativeAdmission({pool:o.pool,store,scheduleOwner,template,now,maxRequestMs,
  authority:createOccurrenceConsentAuthority({firing,template,occurrence,occurrenceKey,now})});
 const owner=createRoutinesOccurrenceOwner({admissionFor,retirement:owners.retirement,scheduleOwner,principal:template.principal,now,maxRequestMs});
 return Object.freeze({application:createRoutinesOccurrenceApplication({controlCapabilitySha256,owner,enabled:true,now,maxRequestMs}),state:'composed',tables:TABLES});
}
