/** Cohesive Control-side browser execution prerequisite, beside the native one (native-execution-prerequisite.mjs).
 *
 * Need: while control's compiled browser activation record is open, every run is admitted with `browser.enabled` and
 * the runtime mounts the browser port, whose preparation resolves this run's browser-only host; so the need is the
 * activation record itself, not a per-run read. Readiness is the browser allocation reader's read-only answer for this
 * run (`createPostgresHostAllocationReader.ready`): absent, not-ready, or ready with the canonical run's browserAdmitted
 * currentness. Every dependency await is raced against one owned operation lifetime bounded by the original execution
 * deadline and the provisioning effect allowance; polling never holds a transaction.
 */
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {activationOpen} from '../worker/conversation/browser/activation.mjs';

const CODE='EXECUTION_BROWSER_PREREQUISITE_REFUSED';
const fail=()=>{throw Object.assign(Error(CODE),{code:CODE});};
const finite=value=>Number.isSafeInteger(value)&&value>0;
export const BROWSER_NEED=Object.freeze({kind:'browser-only',hostMode:'browser-only'});

export function createBrowserExecutionPrerequisite({allocations,activation,now=Date.now,requestTimeoutMs,effectTimeoutMs}){
 if(typeof allocations?.ready!=='function'||typeof now!=='function'||!finite(requestTimeoutMs)||!finite(effectTimeoutMs))fail();
 const open=activationOpen(activation);
 const lifeFor=(deadlineMs,outerSignal,allowance)=>{
  const limit=Math.min(finite(deadlineMs)?deadlineMs:now()+allowance,now()+allowance);
  if(limit<=now())fail();
  return createOperationLifetime({now,deadlineMs:limit,signal:outerSignal,errorFactory:()=>Object.assign(Error(CODE),{code:CODE})});
 };
 async function need({signal}={}){signal?.throwIfAborted();return open?BROWSER_NEED:Object.freeze({kind:'none'});}
 async function ready({binding,signal,deadlineMs}){
  if(!open)return Object.freeze({status:'none'});
  const life=lifeFor(deadlineMs,signal,effectTimeoutMs);
  try{
   for(;;){
    life.check();
    const allocation=lifeFor(Math.min(life.deadline(),now()+requestTimeoutMs),life.signal,requestTimeoutMs);
    let result;try{result=await allocation.run(s=>allocations.ready({binding,signal:s}));}finally{allocation.close();}
    if(result?.status==='ready'){
     const currentUntilMs=result.currentUntilMs,leaseDeadlineMs=result.leaseDeadlineMs;
     if(!Number.isSafeInteger(currentUntilMs)||currentUntilMs<=now()||!Number.isSafeInteger(leaseDeadlineMs)||
      leaseDeadlineMs<=now()||!Number.isSafeInteger(result.generation))fail();
     return Object.freeze({...result,currentUntilMs:Math.min(currentUntilMs,leaseDeadlineMs,life.deadline())});
    }
    if(!['absent','not-ready'].includes(result?.status))fail();
    const delay=Math.min(250,Math.max(0,life.deadline()-now()));
    if(life.deadline()<=now())fail();
    await life.run(s=>new Promise((resolve,reject)=>{
     let timer;
     const finish=()=>{if(timer)clearTimeout(timer);s.removeEventListener('abort',abort);};
     const abort=()=>{finish();reject(Object.assign(Error(CODE),{code:CODE}));};
     timer=setTimeout(()=>{finish();resolve();},delay);
     s.addEventListener('abort',abort,{once:true});
    }));
   }
  }finally{life.close();}
 }
 return Object.freeze({need,ready});
}
