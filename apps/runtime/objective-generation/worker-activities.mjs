/** The Objective generation activities the trusted Temporal poller registers next to the conversation broker, so the
 * `meriObjectiveGenerationWorkflow` type it already bundles (apps/control/conversations/workflow.ts) has its four activities.
 *
 * Production registration passes no ports: the poller holds only its native capability client and no database pool, the Core
 * generation-workload credential owner (D7-3) and the accepted-run owner (`runs`, needing the D7-4 run-start migration and the
 * prepared-run splice) do not exist yet. With both absent every step is a definite no-op that changes nothing:
 * source/readRun/complete answer `unconfirmed` and startRun answers `not-started`, so a started workflow only waits and then
 * expires at its server-set `notAfterMs`. Nothing in control dispatches the workflow today.
 *
 * `clientFor` and `runs` are trusted in-process ports (lifecycle-activities.mjs documents their contracts); they are never read
 * from configuration. */
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createObjectiveGenerationActivities} from './lifecycle-activities.mjs';

export const OBJECTIVE_GENERATION_ACTIVITY_NAMES=Object.freeze(['objectiveGenerationSource','objectiveGenerationStartRun','objectiveGenerationReadRun','objectiveGenerationComplete']);

export function createObjectiveWorkerActivities(ports={}){
 let c;try{c=own(ports,[],['clientFor','runs','context','now','maxRequestMs']);}catch{throw Object.assign(Error('OBJECTIVE_GENERATION_ACTIVITY_CONFIGURATION'),{code:'OBJECTIVE_GENERATION_ACTIVITY_CONFIGURATION'});}
 const activities=createObjectiveGenerationActivities(c);
 return Object.freeze(Object.fromEntries(OBJECTIVE_GENERATION_ACTIVITY_NAMES.map(name=>[name,activities[name]])));
}
