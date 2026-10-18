/** One D005 host's run-bound browser proxy. The listener starts denied and admits a grant only after a fresh trusted
 * control read. This module owns proxy sockets and a local currentness timer; host network isolation and the
 * authenticated control channel are separate prerequisites, not facts this module can assert. */
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {performance} from 'node:perf_hooks';
import {data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createEgressControl} from '../browser/egress-control.mjs';
import {startEgressProxy} from '../egress/proxy-server.mjs';
import {assertHostAllocation,assertHostRunBinding,assertBrowserHostCurrent,MAX_HOST_CURRENTNESS_MS} from './binding.mjs';

const fault=code=>Object.assign(new Error(code),{code});
const same=(a,b)=>{try{return canonicalSha256(a)===canonicalSha256(b);}catch{return false;}};
const refuse=code=>Object.freeze({ok:false,code});

/** `readCurrent` is an authenticated control port returning an exact allocation, full RunBinding, policy digest and
 * bounded active lease. `maxFreshMs`/`refreshEveryMs` are required reviewed deployment inputs; the module imposes a
 * 30 s ceiling, not a product revocation SLO. No proxy route is safe until the host launcher separately proves that
 * the browser user can reach only this proxy and that its own namespace cannot reach trusted control or metadata. */
export async function startBrowserHostEgressService({allocation,binding,readCurrent,resolve,now=Date.now,maxFreshMs,refreshEveryMs,onDecision}={}){
 const host=assertHostAllocation(allocation),run=assertHostRunBinding(host,binding);
 if(typeof readCurrent!=='function'||typeof resolve!=='function'||typeof now!=='function'||!Number.isSafeInteger(maxFreshMs)||maxFreshMs<2||maxFreshMs>MAX_HOST_CURRENTNESS_MS||!Number.isSafeInteger(refreshEveryMs)||refreshEveryMs<1||refreshEveryMs>Math.floor(maxFreshMs/2)||onDecision!==undefined&&typeof onDecision!=='function')throw fault('HOST_EGRESS_CONFIGURATION');
 let proxy,control,grantDigest,grantExpiresAtMs=0,untilMs=0,leaseMonoDeadline=0,revoked=false,closing,refreshTimer,expiryTimer,refreshInFlight;
 const lifetime=new AbortController();
 const clearTimers=()=>{clearTimeout(refreshTimer);clearTimeout(expiryTimer);};
 const monoExpired=()=>leaseMonoDeadline>0&&performance.now()>=leaseMonoDeadline;
 const terminate=()=>{if(revoked)return closing;revoked=true;untilMs=0;leaseMonoDeadline=0;clearTimers();lifetime.abort();control?.revoke();
  // `close` immediately revokes and destroys open tunnels before waiting for listener closure.
  closing=proxy.close();closing.catch(()=>{});return closing;};
 const gate=Object.freeze({
  async admitProxyRequest(request,options){if(revoked||!control)return refuse('BROWSER_EGRESS_REVOKED');
   if(now()>=untilMs||monoExpired()){terminate();return refuse('HOST_CURRENTNESS_EXPIRED');}
   const decision=await control.admitProxyRequest(request,options);
   if(revoked||now()>=untilMs||monoExpired()){terminate();return refuse('HOST_CURRENTNESS_EXPIRED');}
   return decision;},
  revoke(){control?.revoke();},
 });
 proxy=await startEgressProxy({control:gate,httpPort:0,...(onDecision?{onDecision}:{})});
 const endpoint=`http://127.0.0.1:${proxy.ports.http}`;
 const current=async(policySha256,signal)=>{
  const at=now(),deadline=Math.min(maxFreshMs,host.leaseDeadlineMs-at,grantExpiresAtMs-at,
   leaseMonoDeadline?Math.ceil(leaseMonoDeadline-performance.now()):Infinity);
  if(revoked||!Number.isSafeInteger(at)||!Number.isSafeInteger(deadline)||deadline<1||signal?.aborted)throw fault('HOST_CURRENTNESS_REFUSED');
  const readMonoDeadline=performance.now()+deadline;
  const timeout=AbortSignal.timeout(deadline),combined=AbortSignal.any([lifetime.signal,timeout,...(signal?[signal]:[])]);
  const stopped=new Promise((_,reject)=>combined.addEventListener('abort',()=>reject(fault('HOST_CURRENTNESS_REFUSED')),{once:true}));
  const receipt=await Promise.race([readCurrent({allocation:structuredClone(host),binding:structuredClone(run),policySha256,signal:combined}),stopped]);
  if(revoked||combined.aborted||performance.now()>=readMonoDeadline||monoExpired())throw fault('HOST_CURRENTNESS_REFUSED');
  return assertBrowserHostCurrent({allocation:host,binding:run,policySha256,current:receipt,nowMs:now(),maxFreshMs});
 };
 const schedule=()=>{
  clearTimers();if(revoked||!control)return;
  const left=untilMs-now();if(!Number.isSafeInteger(left)||left<=0||monoExpired()){terminate();return;}
  // A wall-clock rollback must not extend the last authenticated lease in elapsed time.
  leaseMonoDeadline=performance.now()+left;
  expiryTimer=setTimeout(()=>terminate(),left);expiryTimer.unref?.();
  refreshTimer=setTimeout(()=>{refresh().catch(()=>{});},Math.min(refreshEveryMs,Math.max(1,Math.floor(left/2))));refreshTimer.unref?.();
 };
 async function refresh({signal}={}){
  if(revoked||!control||!grantDigest)throw fault('HOST_CURRENTNESS_REFUSED');
  if(refreshInFlight)return refreshInFlight;
  refreshInFlight=(async()=>{try{if(now()>=untilMs||monoExpired())throw fault('HOST_CURRENTNESS_REFUSED');
    const receipt=await current(grantDigest,signal);if(revoked||now()>=untilMs||monoExpired())throw fault('HOST_CURRENTNESS_REFUSED');
    untilMs=Math.min(receipt.currentUntilMs,grantExpiresAtMs,host.leaseDeadlineMs);schedule();return Object.freeze({currentUntilMs:untilMs});}
   catch(error){terminate();throw error;}
   finally{refreshInFlight=undefined;}})();
  return refreshInFlight;
 }
 return Object.freeze({endpoint,
  async grant(grant,{signal}={}){
   if(revoked||control||grantDigest)throw fault('HOST_GRANT_REFUSED');
   let candidate,pinned;try{pinned=data(grant);candidate=createEgressControl({grant:pinned,resolve,now});}catch{terminate();throw fault('HOST_GRANT_REFUSED');}
   if(!same(candidate.binding,run)||pinned.expiresAtMs<=now()||pinned.expiresAtMs>host.leaseDeadlineMs){terminate();throw fault('HOST_GRANT_REFUSED');}
   grantDigest=candidate.policySha256;grantExpiresAtMs=pinned.expiresAtMs;
   try{const receipt=await current(grantDigest,signal);if(revoked||signal?.aborted)throw fault('HOST_GRANT_REFUSED');
    control=candidate;untilMs=Math.min(receipt.currentUntilMs,grantExpiresAtMs,host.leaseDeadlineMs);schedule();
    if(revoked)throw fault('HOST_GRANT_REFUSED');return Object.freeze({granted:true,policySha256:grantDigest});}
   catch(error){terminate();throw error;}
  },
  refresh,
  async revoke({binding:requested,policySha256}={}){
   // A mismatched cleanup command is never an acknowledgement for this run. Still terminate locally.
   const valid=same(requested,run)&&typeof policySha256==='string'&&policySha256===grantDigest;
   try{await terminate();}catch{throw fault('HOST_EGRESS_CLEANUP_UNKNOWN');}
   if(!valid)throw fault('HOST_GRANT_REFUSED');
   return Object.freeze({revoked:true});
  },
  async close(){try{await terminate();}catch{throw fault('HOST_EGRESS_CLEANUP_UNKNOWN');}return Object.freeze({closed:true});},
 });
}
