/** The Objective generation activities the trusted Temporal poller registers next to the conversation broker, so the
 * `meriObjectiveGenerationWorkflow` type it already bundles (apps/control/conversations/workflow.ts) has its four activities.
 *
 * Production registration passes only the declared ports (`objectiveWorkerPorts` below). The poller holds only its native
 * capability client and no database pool, so its `runs` port is the control accepted-run owner reached through private native
 * operations (D7-4: run-start migration 0002 + objective-origin admission), composed only when declared. The Core
 * generation-workload credential owner (D7-3, `clientFor`) does not exist. Without `clientFor` every step is a definite no-op
 * that changes nothing:
 * source/readRun/complete answer `unconfirmed` and startRun answers `not-started`, so a started workflow only waits and then
 * expires at its server-set `notAfterMs`. Control dispatches it only through the declared start route (start-application.mjs).
 *
 * `clientFor` and `runs` are trusted in-process ports (lifecycle-activities.mjs documents their contracts); they are never read
 * from configuration. */
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createObjectiveGenerationActivities} from './lifecycle-activities.mjs';
import {createObjectiveNativeRunsPort} from './native-runs-port.mjs';
import {compileObjectiveGenerationConfiguration} from './configuration.mjs';

export const OBJECTIVE_GENERATION_ACTIVITY_NAMES=Object.freeze(['objectiveGenerationSource','objectiveGenerationStartRun','objectiveGenerationReadRun','objectiveGenerationComplete']);

export function createObjectiveWorkerActivities(ports={}){
 let c;try{c=own(ports,[],['clientFor','runs','context','now','maxRequestMs']);}catch{throw Object.assign(Error('OBJECTIVE_GENERATION_ACTIVITY_CONFIGURATION'),{code:'OBJECTIVE_GENERATION_ACTIVITY_CONFIGURATION'});}
 const activities=createObjectiveGenerationActivities(c);
 return Object.freeze(Object.fromEntries(OBJECTIVE_GENERATION_ACTIVITY_NAMES.map(name=>[name,activities[name]])));
}

/** Declared worker ports only. `runs` is the control accepted-run owner reached through the poller's native capability client
 * (native-runs-port.mjs -> /v1/objective-generation/runs/*), composed only with `objectiveGeneration.runs.enabled`. `clientFor`
 * is never composed here: it needs the Core generation-workload credential owner (D7-3), which does not exist. */
export function objectiveWorkerPorts({configuration,native}){
 const declared=compileObjectiveGenerationConfiguration(configuration,'temporal-worker');
 return declared.runs?Object.freeze({runs:createObjectiveNativeRunsPort({native})}):Object.freeze({});
}
