// @ts-check
/** A D005 host-side consumer of an authenticated control port. It does not implement or authenticate `readCurrent`.
 * The returned signal is the lifetime input for every isolated-host SDK run, including browser-only and offline
 * Bash runs. A networked Bash proxy consumes the same signal. The control owner must
 * supply exact, fresh active receipts and honour the read's AbortSignal. Source bounds freshness to at most 30 s;
 * deployment must review the tighter refresh interval and revocation objective. */
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {performance} from 'node:perf_hooks';
import {assertCapabilityPolicy} from '../capabilities/policy.mjs';
import {assertHostAllocation,assertHostRunBinding,assertHostCurrent,MAX_HOST_CURRENTNESS_MS} from './binding.mjs';

const fault=code=>Object.assign(new Error(code),{code});
const fail=code=>{throw fault(code);};

/** Start with one verified currentness read, then renew before its bounded lease expires. Any failed read,
 * mismatch, timeout, lost lease, caller cancellation or close aborts `signal` synchronously. A late control reply
 * cannot renew an expired lease. `capabilityPolicy` must be the effective, trusted run policy, never SDK content.
 * @param {{allocation:unknown,binding:unknown,capabilityPolicy:unknown,
 *   readCurrent:(input:{allocation:object,binding:object,policySha256:string,signal:AbortSignal})=>Promise<unknown>,
 *   now?:()=>number,maxFreshMs:number,refreshEveryMs:number,signal?:AbortSignal}} input */
export async function startHostRunCurrentnessMonitor({allocation,binding,capabilityPolicy,readCurrent,now=Date.now,maxFreshMs,refreshEveryMs,signal}={}){
 const host=assertHostAllocation(allocation),run=assertHostRunBinding(host,binding),policy=assertCapabilityPolicy(capabilityPolicy);
 if(typeof readCurrent!=='function'||typeof now!=='function'||
  !Number.isSafeInteger(maxFreshMs)||maxFreshMs<2||maxFreshMs>MAX_HOST_CURRENTNESS_MS||
  !Number.isSafeInteger(refreshEveryMs)||refreshEveryMs<1||refreshEveryMs>Math.floor(maxFreshMs/2)||
  signal!==undefined&&!(signal instanceof AbortSignal))fail('HOST_CURRENTNESS_CONFIGURATION');
 const policySha256=canonicalSha256(policy),lifetime=new AbortController();
 let untilMs=0,leaseMonoDeadline=0,refreshTimer,expiryTimer,refreshInFlight,stopped=false;
 const clearTimers=()=>{clearTimeout(refreshTimer);clearTimeout(expiryTimer);};
 const stop=()=>{if(stopped)return;stopped=true;untilMs=0;clearTimers();signal?.removeEventListener('abort',onAbort);lifetime.abort(fault('HOST_CURRENTNESS_REFUSED'));};
 const onAbort=()=>stop();
 signal?.addEventListener('abort',onAbort,{once:true});
 if(signal?.aborted)stop();
 const read=async()=>{
  let at;try{at=now();}catch{fail('HOST_CURRENTNESS_REFUSED');}
  const deadline=Math.min(maxFreshMs,host.leaseDeadlineMs-at,untilMs?untilMs-at:Infinity,
   leaseMonoDeadline?Math.ceil(leaseMonoDeadline-performance.now()):Infinity);
  if(stopped||!Number.isSafeInteger(at)||at<0||!Number.isSafeInteger(deadline)||deadline<1)fail('HOST_CURRENTNESS_REFUSED');
  const readMonoDeadline=performance.now()+deadline;
  const timeout=AbortSignal.timeout(deadline),combined=AbortSignal.any([lifetime.signal,timeout]);
  let rejectStopped;
  const stoppedPromise=new Promise((_,reject)=>{rejectStopped=()=>reject(fault('HOST_CURRENTNESS_REFUSED'));combined.addEventListener('abort',rejectStopped,{once:true});});
  try{
   const receipt=await Promise.race([Promise.resolve().then(()=>readCurrent({allocation:structuredClone(host),binding:structuredClone(run),policySha256,signal:combined})),stoppedPromise]);
   if(stopped||combined.aborted||performance.now()>=readMonoDeadline)fail('HOST_CURRENTNESS_REFUSED');
   const checkedAtWallMs=now();
   const checked=assertHostCurrent({allocation:host,binding:run,policySha256,current:receipt,
    nowMs:checkedAtWallMs,maxFreshMs});
   const validatedMonoMs=performance.now();
   if(stopped||untilMs&&(now()>=untilMs||performance.now()>=leaseMonoDeadline))fail('HOST_CURRENTNESS_REFUSED');
   return Object.freeze({currentUntilMs:checked.currentUntilMs,
    monotonicUntilMs:validatedMonoMs+(checked.currentUntilMs-checkedAtWallMs)});
  }finally{combined.removeEventListener('abort',rejectStopped);}
 };
 const schedule=()=>{
  clearTimers();if(stopped)return;
  let left;try{left=Math.min(untilMs-now(),Math.ceil(leaseMonoDeadline-performance.now()));}
  catch{stop();return;}
  if(!Number.isSafeInteger(left)||left<=0){stop();return;}
  // The monotonic cutoff was anchored to validation's wall-clock sample, before any rollback in schedule().
  expiryTimer=setTimeout(()=>stop(),left);expiryTimer.unref?.();
  refreshTimer=setTimeout(()=>{refresh().catch(()=>{});},Math.min(refreshEveryMs,Math.max(1,Math.floor(left/2))));refreshTimer.unref?.();
 };
 async function refresh(){
  if(stopped||!untilMs||performance.now()>=leaseMonoDeadline){stop();fail('HOST_CURRENTNESS_REFUSED');}
  if(refreshInFlight)return refreshInFlight;
  refreshInFlight=(async()=>{try{const checked=await read();
    if(stopped||now()>=untilMs||performance.now()>=leaseMonoDeadline)fail('HOST_CURRENTNESS_REFUSED');
    untilMs=checked.currentUntilMs;leaseMonoDeadline=checked.monotonicUntilMs;schedule();
    if(stopped)fail('HOST_CURRENTNESS_REFUSED');
    return Object.freeze({currentUntilMs:untilMs});
   }catch{stop();fail('HOST_CURRENTNESS_REFUSED');}
   finally{refreshInFlight=undefined;}})();
  return refreshInFlight;
 }
 try{const checked=await read();if(stopped)fail('HOST_CURRENTNESS_REFUSED');
  untilMs=checked.currentUntilMs;leaseMonoDeadline=checked.monotonicUntilMs;schedule();
  if(stopped)fail('HOST_CURRENTNESS_REFUSED');}
 catch{stop();fail('HOST_CURRENTNESS_REFUSED');}
 return Object.freeze({signal:lifetime.signal,policySha256,allocation:host,binding:run,refresh,
  close(){stop();return Object.freeze({closed:true});}});
}
