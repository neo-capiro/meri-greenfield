/** Cohesive Control-side browser execution prerequisite, beside the native one (native-execution-prerequisite.mjs).
 *
 * Need: control's compiled browser activation record must be open AND the run's resolved browser policy (platform
 * record, tenant settings, the actor's current role: the same `readBrowserPolicy` the host facts use) must be enabled.
 * A tenant or role with the browser off gets no host and never waits for one; a held activation is an explicit none.
 *
 * Provisioning on first use: an enabled run's need is `deferred` until its first browser use. `demand` (the runner's
 * `browser-prepare`, routed through control's browser operations) records that use durably (`demands`: the browser custody
 * journal, browser-operation-owner.mjs `demandHost`/`hostDemanded`) and waits for the host to be ready; from then on the
 * need is `browser-only`, on every control task, which the worker's broker answers by provisioning the host. Ordinary chats
 * never provision. The enabled verdict and a recorded demand are kept in memory for the run's own deadline; a demand read
 * that fails answers `deferred` (the broker asks again on its next poll).
 *
 * Readiness is the browser allocation reader's read-only answer for this run (`createPostgresHostAllocationReader.ready`):
 * absent, not-ready, or ready with the canonical run's browserAdmitted currentness. Every dependency await is raced
 * against one owned operation lifetime bounded by the original execution deadline and the provisioning effect
 * allowance; polling never holds a transaction. `reached` tells browser settlement whether the run's browser host could
 * ever have received its preparation: `browser-prepare` is forwarded only after this reader answered `ready`, and an
 * allocation moves forward only (reserved, dispatching, active), so a run with no allocation, or one still reserved or
 * dispatching, has no browser, egress grant, process or profile anywhere. An expired lease or any other answer counts as
 * reached (the host settles itself).
 */
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {assertOperatorBrowserAdmission,operatorBrowserDeadline} from './browser-operator-admission.mjs';
import {activationOpen} from '../worker/conversation/browser/activation.mjs';
import {validateBrowserPolicy} from '../worker/conversation/browser/policy.mjs';

const CODE='EXECUTION_BROWSER_PREREQUISITE_REFUSED';
const fail=()=>{throw Object.assign(Error(CODE),{code:CODE});};
const finite=value=>Number.isSafeInteger(value)&&value>0;
export const BROWSER_NEED=Object.freeze({kind:'browser-only',hostMode:'browser-only'});
export const BROWSER_DEFERRED=Object.freeze({kind:'deferred'});
const MAX_TRACKED=4096;

export function createBrowserExecutionPrerequisite(options){return prerequisite(options,null);}
export function createOperatorBrowserExecutionPrerequisite(options,caseAdmission){
 assertOperatorBrowserAdmission(caseAdmission);if(activationOpen(options.activation))fail();
 return prerequisite(options,caseAdmission);
}
function prerequisite({allocations,activation,policy,demands,now=Date.now,requestTimeoutMs,effectTimeoutMs},caseAdmission){
 if(typeof allocations?.ready!=='function'||typeof policy?.read!=='function'||typeof demands?.record!=='function'||typeof demands?.read!=='function'||
  typeof now!=='function'||!finite(requestTimeoutMs)||!finite(effectTimeoutMs))fail();
 const open=activationOpen(activation);
 // Per run (binding digest): the enabled verdict and a recorded demand, each kept until the run's own deadline.
 const verdicts=new Map(),demanded=new Map();
 const prune=()=>{const at=now();for(const map of [verdicts,demanded])for(const [key,entry] of map)if(entry.untilMs<=at)map.delete(key);};
 const remember=(map,key,entry)=>{prune();if(map.size>=MAX_TRACKED)map.delete(map.keys().next().value);map.set(key,entry);};
 const lifeFor=(deadlineMs,outerSignal,allowance)=>{
  const limit=Math.min(finite(deadlineMs)?deadlineMs:now()+allowance,now()+allowance);
  if(limit<=now())fail();
  return createOperationLifetime({now,deadlineMs:limit,signal:outerSignal,errorFactory:()=>Object.assign(Error(CODE),{code:CODE})});
 };
 /** The run's resolved browser policy, read within one request budget; a failed or malformed read refuses (never "none"). */
 async function enabled({binding,signal,deadlineMs}){
  if(caseAdmission===null){if(!open)return false;}else deadlineMs=operatorBrowserDeadline(caseAdmission,{binding,deadlineMs});
  const key=canonicalSha256(binding),known=verdicts.get(key);
  if(caseAdmission===null&&known!==undefined&&known.untilMs>now())return known.enabled;
  const life=lifeFor(deadlineMs,signal,requestTimeoutMs);
  try{
   let resolved;
   try{resolved=validateBrowserPolicy(await life.run(s=>policy.read({binding,signal:s,deadlineMs:life.deadline()})));}catch{fail();}
   if(caseAdmission!==null)operatorBrowserDeadline(caseAdmission,{binding,deadlineMs});
   if(finite(deadlineMs))remember(verdicts,key,{enabled:resolved.enabled===true,untilMs:deadlineMs});
   return resolved.enabled===true;
  }finally{life.close();}
 }
 async function need({binding,executionId,signal,deadlineMs}={}){
  if(caseAdmission!==null)deadlineMs=operatorBrowserDeadline(caseAdmission,{binding,executionId,deadlineMs});
  signal?.throwIfAborted();
  if(!await enabled({binding,signal,deadlineMs}))return Object.freeze({kind:'none'});
  const key=canonicalSha256(binding),known=demanded.get(key);
  if(known!==undefined&&known.untilMs>now())return BROWSER_NEED;
  const life=lifeFor(deadlineMs,signal,requestTimeoutMs);
  try{
   const hasDemand=await life.run(s=>demands.read({binding,signal:s}));
   if(caseAdmission!==null)operatorBrowserDeadline(caseAdmission,{binding,executionId,deadlineMs});
   if(!hasDemand)return BROWSER_DEFERRED;
   if(finite(deadlineMs))remember(demanded,key,{untilMs:deadlineMs});
   return BROWSER_NEED;
  }catch{signal?.throwIfAborted();if(caseAdmission!==null)operatorBrowserDeadline(caseAdmission,{binding,executionId,deadlineMs});return BROWSER_DEFERRED;}finally{life.close();}
 }
 async function ready({binding,signal,deadlineMs}){
  const life=lifeFor(deadlineMs,signal,effectTimeoutMs);
  try{
   for(;;){
    life.check();
    if(caseAdmission!==null)life.limitDeadline(operatorBrowserDeadline(caseAdmission,{binding,deadlineMs:life.deadline()}));
    const allocation=lifeFor(Math.min(life.deadline(),now()+requestTimeoutMs),life.signal,requestTimeoutMs);
    let result;try{result=await allocation.run(s=>allocations.ready({binding,signal:s}));}finally{allocation.close();}
    if(caseAdmission!==null)life.limitDeadline(operatorBrowserDeadline(caseAdmission,{binding,deadlineMs:life.deadline()}));
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
 /** The run's first browser use: record the demand durably (the broker provisions on its next poll) and wait for the host. */
 async function demand({binding,scopes,signal,deadlineMs,executionDeadlineMs}){
  if(!finite(executionDeadlineMs))fail();
  if(caseAdmission!==null){
   executionDeadlineMs=operatorBrowserDeadline(caseAdmission,{binding,deadlineMs:executionDeadlineMs});
   deadlineMs=operatorBrowserDeadline(caseAdmission,{binding,deadlineMs});
  }
  if(!await enabled({binding,signal,deadlineMs:executionDeadlineMs}))fail();
  const life=lifeFor(deadlineMs,signal,requestTimeoutMs);
  try{await life.run(s=>demands.record({binding,scopes,expiresAtMs:executionDeadlineMs,signal:s}));}catch{fail();}finally{life.close();}
  remember(demanded,canonicalSha256(binding),{untilMs:executionDeadlineMs});
  return ready({binding,signal,deadlineMs});
 }
 /** Whether the run's browser host could ever have received its preparation; a failed read refuses. */
 async function reached({binding,signal,deadlineMs}){
  const life=lifeFor(deadlineMs,signal,requestTimeoutMs);
  try{let result;try{result=await life.run(s=>allocations.ready({binding,signal:s}));}catch{fail();}
   return !(result?.status==='absent'||result?.status==='not-ready'&&['reserved','dispatching'].includes(result.state));}
  finally{life.close();}
 }
 return Object.freeze({need,demand,reached});
}
