/** Control owns Core access, immutable run acceptance and four bounded background activities. */
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createTemporalConversationDispatcher} from '../../control/conversations/temporal-dispatch.mjs';
import {compileObjectiveGenerationConfiguration} from '../objective-generation/configuration.mjs';
import {createObjectiveRunOwner} from '../objective-generation/run-owner.mjs';
import {createObjectiveNativeAdmission} from './objective-admission.mjs';
import {createObjectiveActivitiesApplication} from './objective-runs-http.mjs';
import {createObjectiveGenerationActivities} from '../objective-generation/lifecycle-activities.mjs';

const fault=()=>Error('OBJECTIVE_RUNS_CONFIGURATION');
export function composeObjectiveRuns(options){
 const o=own(options,['configuration','controlCapabilitySha256'],['pool','store','client','runStarts','template','core','retention','now']);
 const declared=compileObjectiveGenerationConfiguration(o.configuration,'control').runs;
 if(!declared)return Object.freeze({application:createObjectiveActivitiesApplication({controlCapabilitySha256:o.controlCapabilitySha256}),state:'disabled',tables:Object.freeze([])});
 if(!o.core||!o.runStarts||!o.template)throw fault();
 const now=o.now??Date.now,requestMs=Math.min(30000,Math.max(15000,o.configuration.limits.requestMs));
 const admission=createObjectiveNativeAdmission({pool:o.pool,store:o.store,authority:o.core,template:o.template,now,maxRequestMs:requestMs});
 const dispatcher=createTemporalConversationDispatcher({client:o.client,taskQueue:o.configuration.temporal.taskQueue,lifecycle:true,now,maxRequestMs:requestMs});
 const owner=createObjectiveRunOwner({enabled:true,runStarts:o.runStarts,admission,core:o.core,dispatcher,store:o.store,retention:o.retention,now,maxRequestMs:requestMs});
 if(!owner.available())throw fault();
 const runs={start:owner.start,async read(value){return (await owner.read(value)).run;}};
 const activitiesFor=({signal})=>createObjectiveGenerationActivities({clientFor:o.core.clientFor,runs,context:()=>({cancellationSignal:signal}),now,maxRequestMs:requestMs});
 return Object.freeze({application:createObjectiveActivitiesApplication({controlCapabilitySha256:o.controlCapabilitySha256,activitiesFor,now,maxRequestMs:requestMs}),
  state:'composed',tables:Object.freeze(['meri_objective_source.run_starts'])});
}
