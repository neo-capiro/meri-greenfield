// @ts-check
/** Existing profile tool mounts. Per-run installation and scope decide which mounted tools answer.
 * Missing trusted ports return UNAVAILABLE. Step 3 replaces the remaining admission presentation. */
import {createGeneralReadRuntime} from '../reads/runtime.mjs';
import {createIntentRuntime} from '../intents/runtime.mjs';
const fault=(/** @type {string} */code)=>Object.assign(Error(code),{code});
/** General-read port of a run without a gateway read mount: no availability, no execution. */
export const UNAVAILABLE_READ_PORT=Object.freeze({async readAvailability(){throw fault('READ_PORT_UNAVAILABLE');},async execute(){throw fault('UNAVAILABLE');}});
/** Intent port of a run without a control intent mount: no availability, nothing prepared. */
export const UNAVAILABLE_INTENT_PORT=Object.freeze({async readAvailability(){throw fault('INTENT_PORT_UNAVAILABLE');},async prepare(){throw fault('UNAVAILABLE');}});
/**
 * @param {{policy:import('./policy.mjs').CapabilityPolicy|undefined,binding:unknown,scopes:any[],now:()=>number,deadlineMs:number,
 *  generalReads?:{readAvailability:Function,execute:Function},governedIntents?:{readAvailability:Function,prepare:Function},
 *  expectedSessionId?:string,skill?:any,exclude?:{id:string,version:string}[],runBudgets?:{maxToolCalls:number,maxOutputBytes?:number,maxAggregateOutputBytes?:number},signal?:AbortSignal}} c
 * @returns {Promise<{reads:any,intents:any}>} each runtime, or null when the profile does not enable it (or mounts no tool)
 */
export async function createProfileMounts(c){
 const shared={binding:c.binding,scopes:c.scopes,policy:c.policy,now:c.now,deadlineMs:c.deadlineMs,mount:/** @type {const} */('profile'),...(c.expectedSessionId===undefined?{}:{expectedSessionId:c.expectedSessionId}),...(c.signal===undefined?{}:{signal:c.signal})};
 // The run's admitted budgets bound only the early read ledger (never the SDK options), so the measured template is unchanged.
 const reads=c.policy?.generalReads===true?await createGeneralReadRuntime({...shared,port:c.generalReads??UNAVAILABLE_READ_PORT,...(c.skill===undefined?{}:{skill:c.skill}),exclude:c.exclude??[],...(c.runBudgets===undefined?{}:{runBudgets:c.runBudgets})}):null;
 let intents=null;
 try{intents=c.policy?.governedIntents===true?await createIntentRuntime({...shared,port:c.governedIntents??UNAVAILABLE_INTENT_PORT}):null;}
 catch(error){await reads?.close();throw error;}
 return {reads,intents};
}
