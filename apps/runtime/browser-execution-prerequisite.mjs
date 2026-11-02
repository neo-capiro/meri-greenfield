/** Cohesive Control-side browser execution prerequisite, beside the native one (native-execution-prerequisite.mjs).
 *
 * Need: control's compiled browser activation record must be open AND the run's resolved browser policy (platform
 * record, tenant settings, the actor's current role: the same `readBrowserPolicy` the host facts use) must be enabled.
 * A tenant or role with the browser off gets no host and never waits for one; a held activation is an explicit none.
 * Readiness is the browser allocation reader's read-only answer for this run (`createPostgresHostAllocationReader.ready`):
 * absent, not-ready, or ready with the canonical run's browserAdmitted currentness. Every dependency await is raced
 * against one owned operation lifetime bounded by the original execution deadline and the provisioning effect
 * allowance; polling never holds a transaction.
 */
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {activationOpen} from '../worker/conversation/browser/activation.mjs';
import {validateBrowserPolicy} from '../worker/conversation/browser/policy.mjs';

const CODE='EXECUTION_BROWSER_PREREQUISITE_REFUSED';
const fail=()=>{throw Object.assign(Error(CODE),{code:CODE});};
const finite=value=>Number.isSafeInteger(value)&&value>0;
export const BROWSER_NEED=Object.freeze({kind:'browser-only',hostMode:'browser-only'});

export function createBrowserExecutionPrerequisite({allocations,activation,policy,now=Date.now,requestTimeoutMs,effectTimeoutMs}){
 if(typeof allocations?.ready!=='function'||typeof policy?.read!=='function'||typeof now!=='function'||!finite(requestTimeoutMs)||!finite(effectTimeoutMs))fail();
 const open=activationOpen(activation);
 const lifeFor=(deadlineMs,outerSignal,allowance)=>{
  const limit=Math.min(finite(deadlineMs)?deadlineMs:now()+allowance,now()+allowance);
  if(limit<=now())fail();
  return createOperationLifetime({now,deadlineMs:limit,signal:outerSignal,errorFactory:()=>Object.assign(Error(CODE),{code:CODE})});
 };
 /** The run's resolved browser policy, read within one request budget; a failed or malformed read refuses (never "none"). */
 async function enabled({binding,signal,deadlineMs}){
  if(!open)return false;
  const life=lifeFor(deadlineMs,signal,requestTimeoutMs);
  try{
   let resolved;
   try{resolved=validateBrowserPolicy(await life.run(s=>policy.read({binding,signal:s,deadlineMs:life.deadline()})));}catch{fail();}
   return resolved.enabled===true;
  }finally{life.close();}
 }
 async function need({binding,signal,deadlineMs}={}){
  signal?.throwIfAborted();
  return await enabled({binding,signal,deadlineMs})?BROWSER_NEED:Object.freeze({kind:'none'});
 }
 async function ready({binding,signal,deadlineMs}){
  if(!await enabled({binding,signal,deadlineMs}))return Object.freeze({status:'none'});
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
