/** Independent bounded cleanup attempts. A timeout never proves physical stop; native retirement remains the stop owner. */
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {BROWSER_CLEANUP_MS} from './browser/lifecycle.mjs';
export const CLEANUP_ATTEMPT_MS=3000;
export async function attemptCleanup(operation,{now,timeoutMs}){
 let life;
 try{life=createOperationLifetime({deadlineMs:now()+timeoutMs,now,errorFactory:code=>Object.assign(Error(code),{code})});await life.run(operation);return true;}
 catch{return false;}finally{life?.close();}
}
export async function cleanupConversation({skillRuntime,readRuntime,intentRuntime,controls,input,closeQuery,browserRun,browserOutcome,now,timeoutMs}){
 let known=true;
 // Every owner is attempted even if an earlier owner throws or never settles. Finish/close remain ordered; query close is idempotent.
 for(const operation of [()=>skillRuntime?.close(),()=>readRuntime?.close(),()=>intentRuntime?.close(),()=>controls?.finish(),
  ()=>controls?.close(),()=>input?.close(),closeQuery])if(!await attemptCleanup(operation,{now,timeoutMs}))known=false;
 // An unconfirmed query close cannot block egress revocation. The browser owner separately proves process exit before profile deletion.
 // Preserve its full existing cleanup budget rather than racing it with the shorter SDK/resource budget.
 if(!await attemptCleanup(()=>browserRun?.settle({outcome:browserOutcome}),{now,timeoutMs:BROWSER_CLEANUP_MS.max+1000}))known=false;
 return known;
}
