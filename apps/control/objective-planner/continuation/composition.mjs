/** Source-only opt-in composition for the existing control server/Temporal worker. Missing genuine producer or credential owner disables entry. */
import {createCoreCanonicalPlannerClient} from './core-client.mjs';
import {createContinuationAdmission} from './admission.mjs';
import {createObjectivePlannerActivities} from './activities.mjs';
import {createObjectivePlannerDispatcher} from './dispatcher.mjs';
import {createObjectivePlannerServer} from './server.mjs';
export function createObjectivePlannerContinuation({core,authorization,producer,runs,temporalClient,taskQueue,activityContext,now=Date.now}){
 const client=createCoreCanonicalPlannerClient({...core,authorization,now}),admission=createContinuationAdmission({producer,runs,now}),dispatcher=createObjectivePlannerDispatcher({client:temporalClient,taskQueue,now});
 const activities=createObjectivePlannerActivities({client,admission,context:activityContext,now}),server=createObjectivePlannerServer({admission,dispatcher,core:client,now});
 return Object.freeze({server,activities,available:server.available});
}
