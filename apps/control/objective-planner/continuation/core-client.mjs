/** Actual fixed Core application client; immutable ACK validation is separate from current projection and transport authority. */
import {own,continuationWork,creationObservation} from './contract.mjs';
import {createCorePlannerTransport} from './core-http.mjs';
export function createCoreCanonicalPlannerClient(configuration){
 const transport=createCorePlannerTransport(configuration);
 async function request(mode,value){const v=own(value,['work','deadlineMs'],['signal']),w=continuationWork(v.work);
  try{const response=await transport.request(mode,{...v,work:w});return response.kind==='response'?creationObservation(response.value,w):{kind:'unavailable'};}catch{return {kind:'unavailable'};}}
 return Object.freeze({available:transport.available,inspect:value=>request('application-read',value),prepare:value=>request('application-prepare',value)});
}
