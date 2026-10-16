/** Optional activities join for the existing worker/queue. Missing configuration never creates another model owner. */
import {own} from '../identity.mjs';
export function objectivePlannerActivities(value){
 if(value===undefined)return {};
 const methods=own(value,['inspectObjectivePlanner','prepareObjectivePlanner']);
 if(Object.values(methods).some(fn=>typeof fn!=='function'))throw Error('OBJECTIVE_PLANNER_CONFIGURATION');
 return methods;
}
