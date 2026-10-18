// @ts-check
/** G3: the run's profile-bound MCP mounts. When the effective capability policy enables general reads or governed intents, the
 * `meri_reads` / `meri_intents` server is ALWAYS mounted with the profile's full tool list (`mount:'profile'` in reads/runtime.mjs and
 * intents/runtime.mjs), so the SDK options are a function of the profile alone and one measured sdkOptionsSha256 covers every run of
 * that profile. Per-run availability (installation receipt, discovery grant, client scope, intent owners, an absent or failing port)
 * only decides which mounted tools answer; every other call answers a typed UNAVAILABLE and never reaches a port. A trusted port the
 * runtime composition does not supply is the unavailable port below: the server is still mounted and every call answers UNAVAILABLE.
 *
 * The activity (`activity.mjs`) and the in-image measurement (`apps/runtime/build/first-chat-launch-measurement.mjs`) both build the
 * mounts with this one function, so the measured template is the runner's. */
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
