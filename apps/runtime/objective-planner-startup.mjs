/** Source-only opt-in composition for the existing control server/Temporal worker. Missing genuine producer or credential owner disables entry. */
import {createCoreCanonicalPlannerClient} from '../control/objective-planner/continuation/core-client.mjs';
import {createContinuationAdmission} from '../control/objective-planner/continuation/admission.mjs';
import {createObjectivePlannerActivities} from './objective-planner-activities.mjs';
import {createObjectivePlannerDispatcher} from '../control/conversations/objective-planner-dispatch.mjs';
import {createObjectivePlannerServer} from '../control/objective-planner/continuation/server.mjs';
export function createObjectivePlannerContinuation({core,authorization,producer,runs,temporalClient,taskQueue,activityContext,now=Date.now}){
 const client=createCoreCanonicalPlannerClient({...core,authorization,now}),admission=createContinuationAdmission({producer,runs,now}),dispatcher=createObjectivePlannerDispatcher({client:temporalClient,taskQueue,now});
 const activities=createObjectivePlannerActivities({client,admission,context:activityContext,now}),server=createObjectivePlannerServer({admission,dispatcher,core:client,now});
 return Object.freeze({server,activities,available:server.available});
}
