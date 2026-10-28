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
 *  expectedSessionId?:string,skill?:any,procedure?:{allowedTools:string[]},exclude?:{id:string,version:string}[],runBudgets?:{maxToolCalls:number,maxOutputBytes?:number,maxAggregateOutputBytes?:number},signal?:AbortSignal}} c
 * @returns {Promise<{reads:any,intents:any}>} each runtime, or null when the profile does not enable it (or mounts no tool)
 */
export async function createProfileMounts(c){
 const shared={binding:c.binding,scopes:c.scopes,policy:c.policy,now:c.now,deadlineMs:c.deadlineMs,mount:/** @type {const} */('profile'),...(c.expectedSessionId===undefined?{}:{expectedSessionId:c.expectedSessionId}),...(c.signal===undefined?{}:{signal:c.signal})};
 // The run's admitted budgets bound only the early read ledger (never the SDK options), so the measured template is unchanged.
 const reads=c.policy?.generalReads===true?await createGeneralReadRuntime({...shared,port:c.generalReads??UNAVAILABLE_READ_PORT,...(c.skill===undefined?{}:{skill:c.skill}),...(c.procedure===undefined?{}:{procedure:c.procedure}),exclude:c.exclude??[],...(c.runBudgets===undefined?{}:{runBudgets:c.runBudgets})}):null;
 // Wave5 MO01/ST16: Core's canonical read-only procedure policy (native-procedures/selected-procedure.ts
 // READ_ONLY_PROHIBITED) forbids exactly the external effects a governed intent prepares — sending or drafting an
 // external message, creating or updating a task or record, and writing memory — and every admission Meri accepts is
 // `effectMode:'read_only'` (procedures/guidance.mjs). So a run with a selected read-only procedure never mounts the
 // governed-intent server, whatever the run's general profile enables: the intent port's availability is not even read,
 // nothing can be prepared and no `meri_intents` tool exists to call. A run with no procedure is unchanged.
 const readOnlyProcedure=c.procedure!==undefined&&c.procedure.effectMode==='read_only';
 let intents=null;
 try{intents=c.policy?.governedIntents===true&&!readOnlyProcedure?await createIntentRuntime({...shared,port:c.governedIntents??UNAVAILABLE_INTENT_PORT}):null;}
 catch(error){await reads?.close();throw error;}
 return {reads,intents};
}
