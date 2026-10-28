/**
 * MB-05 source-event runtime composition (finite slice).
 *
 * Wires the cohesive source-event engine in `apps/control/schedules/source-event*.mjs` to the
 * EXISTING owners so the inbound receiver is a mounted, authenticated application rather than an
 * unwired helper:
 *
 *   - `store` is the existing schedule-owner durable store (the source-event tables);
 *   - `scheduleOwner.readFiring` is the existing schedule owner's acknowledged-generation read;
 *   - `dispatch` is the existing scheduled-dispatch owner — the only thing that can start work;
 *   - `coreFactory()` returns the existing Core custody client, which resolves canonical producer
 *     facts over the configured service-identity transport.
 *
 * This adapter decides nothing: it exposes the fixed paths and the Fetch entry point, and every
 * domain and authority decision stays with the owners above. The two mount spans in
 * `apps/runtime/control.mjs` / `apps/runtime/control-route-boundary.mjs` are the coordinated
 * import/constructor/mount hunk, not this file.
 */
import {createSourceEventBinding} from '../control/schedules/source-event-binding.mjs';
import {createSourceEventReceiver} from '../control/schedules/source-event-receiver.mjs';
import {createSourceEventHttpApplication} from '../control/schedules/source-event-http.mjs';
import {createPostgresSourceEventStore} from '../control/schedules/source-event-store.mjs';
import {createSourceEventCoreClient} from '../control/schedules/source-event-core-client.mjs';
import {createPostgresScheduleOwner} from '../control/schedules/postgres-schedule-owner.mjs';
import {createScheduledDispatch} from '../control/schedules/scheduled-dispatch.mjs';
import {createApprovedScheduleInstructions} from '../control/schedules/approved-instructions.mjs';
import {createPostgresConversationStore} from '../control/conversations/postgres-store.mjs';
import {createTemporalConversationDispatcher} from '../control/conversations/temporal-dispatch.mjs';
import {createTemporalRunEvidence} from '../control/conversations/temporal-run-evidence.mjs';
import {createPostgresPreparedScheduleReader} from '../control/intents/postgres-journal.mjs';
import {compileRoutinesCoreConfiguration,routinesReservedSecretFiles} from './native-authority/routines-configuration.mjs';
import {createRoutinesCoreClient,createRoutinesServiceSecret} from './native-authority/routines-core-client.mjs';
import {routineFiringTrust} from './native-authority/routines-firing-grant.mjs';
import {createRoutinesFiringAuthority} from './native-authority/routines-firing-authority.mjs';
import {createScheduledNativeAdmission} from './native-authority/scheduled-admission.mjs';
import {createOccurrenceConsentAuthority} from './native-authority/routines-occurrence-owner.mjs';
import {readSecret as readRuntimeSecret} from './config.mjs';

/** One event per request, bounded: the same bound the HTTP boundary enforces. */
export const SOURCE_EVENT_REQUEST_BYTES = 64 * 1024;

export function createSourceEventApplication(configuration) {
  const {store, scheduleOwner, dispatch, coreFactory, now = Date.now, limits, getServiceSecret, enabled = true} = configuration ?? {};
  if (typeof coreFactory !== 'function') throw TypeError('SOURCE_EVENT_APPLICATION_CONFIGURATION');
  // The binding owner is the ONE place an approved producer/resource pair is read (and, on the
  // approved preparation path, written). The receiver never creates a binding from an event.
  const binding = createSourceEventBinding({scheduleOwner, store, now});
  const core = coreFactory();
  const receiver = createSourceEventReceiver({store, binding, scheduleOwner, core, dispatch, now,
    maxRequestMs: limits?.maxRequestMs ?? 15000});
  const http = createSourceEventHttpApplication({now, limits, service: receiver, lookup: binding.lookup, enabled, getServiceSecret});
  return Object.freeze({paths: http.paths, handle: http.handle, receiver, binding});
}

/**
 * The production mount for the private control listener: one call from startControl, and the SAME
 * existing owners the routine occurrence lane composes (pool, Temporal client, Core wire C, the
 * candidate's scheduled-run template and the canonical scheduled-dispatch owner). It decides
 * nothing itself and returns `null` — the routes stay 404, fail closed — unless every real owner
 * exists: no private listener, no declared `routines.core.unattendedGrant` pin, no resident
 * scheduled-run template, or no composable Core custody client.
 *
 * `ports.owners` is the trusted borrowed-owner record (`{dispatch}`) a runtime fixture may supply,
 * exactly as `composeRoutinesOccurrences` borrows template/retirement: production omits it and the
 * canonical scheduled-dispatch owner is built here over `pool`/`client`.
 * `transport` ({fetchImpl, readSecret}) is the same trusted test seam the sibling composer uses.
 */
export function composeSourceEventMount({configuration,pool,client,candidate,ports={},transport={},now=Date.now}) {
  if(configuration?.privateHttp===undefined||configuration?.routines?.enabled!==true)return null;
  let core;
  try{core=compileRoutinesCoreConfiguration(configuration);}catch{return null;}
  if(core===null||core.unattendedGrant===undefined)return null;
  const owners=candidate?.routinesOccurrenceOwners;
  const templateFor=owners?.template!==undefined?()=>owners.template
    :typeof owners?.templateFor==='function'?occurrence=>owners.templateFor(occurrence):null;
  if(templateFor===null)return null;
  const maxRequestMs=configuration.limits.requestMs;
  let getServiceSecret,wires,scheduleOwner,store,firing,dispatch,coreClient;
  try{
    getServiceSecret=createRoutinesServiceSecret({file:core.serviceSecretFile,reservedFiles:routinesReservedSecretFiles(configuration),readSecret:transport.readSecret??readRuntimeSecret});
    const clientOptions={origin:core.origin,getServiceSecret,now,maxRequestMs,...(transport.fetchImpl===undefined?{}:{fetchImpl:transport.fetchImpl})};
    wires=createRoutinesCoreClient(clientOptions);
    scheduleOwner=createPostgresScheduleOwner({pool});
    store=createPostgresConversationStore({pool,now,modelCatalog:configuration.models});
    // Core wire C under the service identity: the SAME per-run consent pin the routine occurrence
    // lane admits under, so an event-triggered run is authorised exactly like a cron firing.
    firing=createRoutinesFiringAuthority({wires,trust:routineFiringTrust(core.unattendedGrant),scheduleOwner,now,maxRequestMs});
    const admissionFor=(occurrence,occurrenceKey)=>{const template=templateFor(occurrence);
      return createScheduledNativeAdmission({pool,store,scheduleOwner,template,now,maxRequestMs,
        authority:createOccurrenceConsentAuthority({firing,template,occurrence,occurrenceKey,now})});};
    dispatch=ports.owners?.dispatch??createScheduledDispatch({scheduleOwner,store,
      dispatcher:createTemporalConversationDispatcher({client,taskQueue:configuration.temporal.taskQueue,lifecycle:true,now,maxRequestMs}),
      runs:createTemporalRunEvidence({client,now,maxRequestMs}),authority:firing,
      taskInstructions:createApprovedScheduleInstructions({scheduleOwner,preparations:createPostgresPreparedScheduleReader({pool}),now,maxRequestMs}),
      runAdmission:{admit:request=>admissionFor(request.occurrence,request.occurrenceKey).admit(request)},
      versions:configuration.versions,now,maxRequestMs});
    coreClient=createSourceEventCoreClient({origin:core.origin,getServiceSecret,now,maxRequestMs,...(transport.fetchImpl===undefined?{}:{fetchImpl:transport.fetchImpl})});
  }catch{return null;}
  return createSourceEventApplication({
    store:createPostgresSourceEventStore({pool}),scheduleOwner,dispatch,
    coreFactory:()=>coreClient,now,getServiceSecret,limits:{maxRequestMs,maxRequestBytes:SOURCE_EVENT_REQUEST_BYTES},
  });
}
