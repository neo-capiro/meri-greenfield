// @ts-check
/** Source-only preparation of Bash facts on the D005 per-conversation host. This is not composed by the product
 * runner. The future host owner must supply an independently verified outer-isolation port and exact local host
 * identity; neither a run policy nor a caller-supplied boolean is isolation evidence. The SDK sandbox is measured
 * afresh with its real no-model startup probe. A failed proof or probe admits no Bash and starts no egress proxy. */
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {performance} from 'node:perf_hooks';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertCapabilityPolicy} from '../capabilities/policy.mjs';
import {assertBashEgressFact} from '../capabilities/bash-sandbox.mjs';
import {isApprovalPort} from '../capabilities/bash-approval.mjs';
import {checkSandboxReadiness,toBashSandboxAttestation} from '../sandbox-readiness/readiness.mjs';
import {createHostPorts} from '../sandbox-readiness/host-probes.mjs';
import {startBashEgress} from '../egress/bash-egress.mjs';
import {assertHostAllocation,assertHostRunBinding,assertD005HostIdentity as assertHostIdentity,D005_HOST_IDENTITY_SCHEMA} from './binding.mjs';

export {D005_HOST_IDENTITY_SCHEMA};
export const D005_ISOLATION_RECEIPT_SCHEMA='meri-d005-outer-isolation/1';
const fault=code=>Object.assign(new Error(code),{code});
const fail=code=>{throw fault(code);};
const current=(now,expiresAtMs)=>{const time=now();if(!Number.isSafeInteger(time)||!Number.isSafeInteger(expiresAtMs)||expiresAtMs<=time)fail('BASH_HOST_BINDING_REFUSED');return time;};
/** Revoke first so open tunnels end even if stopping listeners fails; always attempt both operations. */
async function closeProxy(proxy){let known=true;
 try{if(proxy?.revoke?.()?.revoked!==true)known=false;}catch{known=false;}
 try{if(typeof proxy?.close!=='function')known=false;else await proxy.close();}catch{known=false;}
 if(!known)fail('BASH_EGRESS_CLEANUP_UNKNOWN');
}
/** The identity comes from the trusted host owner, not run data. A verifier must prove this exact instance/boot
 * serves this conversation alone, has no Fargate placement, and is the outer boundary for the run. */
export function assertD005HostIdentity(value,binding,allocation){
 try{return assertHostIdentity(value,binding,allocation);}catch{fail('BASH_HOST_BINDING_REFUSED');}
}
/** A receipt returned only by the trusted native outer-isolation verifier. Shape and binding checks here prevent
 * accidental cross-run reuse; this pure check cannot authenticate a forged verifier. */
export function assertD005IsolationReceipt(value,{binding,allocation,hostIdentity,now,expiresAtMs}){
 let r,a,i;try{r=own(value,['schema','verified','hostKind','outerIsolationBoundary','allocationSha256','bindingSha256','hostIdentitySha256','observedAtMs','expiresAtMs']);
  a=assertHostAllocation(allocation);assertHostRunBinding(a,binding);i=assertD005HostIdentity(hostIdentity,binding,a);}catch{fail('BASH_HOST_ISOLATION_REFUSED');}
 const time=current(now,expiresAtMs);
 if(r.schema!==D005_ISOLATION_RECEIPT_SCHEMA||r.verified!==true||r.hostKind!=='d005-isolated-ec2'||r.outerIsolationBoundary!==true||
  r.allocationSha256!==canonicalSha256(a)||r.bindingSha256!==canonicalSha256(binding)||r.hostIdentitySha256!==canonicalSha256(i)||
  !Number.isSafeInteger(r.observedAtMs)||r.observedAtMs>time||r.observedAtMs<time-30000||
  !Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<expiresAtMs||r.expiresAtMs>a.leaseDeadlineMs||expiresAtMs>a.leaseDeadlineMs)fail('BASH_HOST_ISOLATION_REFUSED');
 return Object.freeze({...r});
}
/** Prepare trusted `bashSandbox`, optionally `bashEgress` and `bashApprovals`, for one SDK run. The `verifyOuterIsolation`
 * port is mandatory for Bash and must return the control-owned allocation and exact local host identity after
 * validating native host/container/network evidence for that allocation, identity and binding. `createReadinessPorts`
 * is injected only in focused tests; production uses the real SDK and host probes. Networked Bash also requires
 * `hostCurrentnessSignal` from the authenticated host monitor. That monitor must abort it on run revocation,
 * currentness loss or host teardown. The signal is a lifetime input, not evidence of native isolation.
 * The returned `close()` must settle when the run ends, including failures and cancellation.
 * @param {{binding:object,policy:unknown,verifyOuterIsolation?:(input:{binding:object,expiresAtMs:number,signal?:AbortSignal})=>Promise<unknown>,
 *   approvals?:unknown,expiresAtMs?:number,now?:()=>number,pathEnv?:string,protectedPaths?:object,signal?:AbortSignal,hostCurrentnessSignal?:AbortSignal,
 *   createReadinessPorts?:typeof createHostPorts,startEgress?:typeof startBashEgress}} input */
export async function prepareHostBashRuntimeFacts({binding,policy,verifyOuterIsolation,approvals,expiresAtMs,now=Date.now,pathEnv=process.env.PATH??'',protectedPaths,signal,hostCurrentnessSignal,createReadinessPorts=createHostPorts,startEgress=startBashEgress}){
 const effective=assertCapabilityPolicy(policy);
 if(!effective.bash)return Object.freeze({runtimeFacts:Object.freeze({}),async close(){return Object.freeze({closed:true});}});
 const networked=effective.sandboxNetworkDomains.length>0;
 if(typeof now!=='function'||typeof pathEnv!=='string'||typeof verifyOuterIsolation!=='function'||typeof createReadinessPorts!=='function'||typeof startEgress!=='function'||
  signal!==undefined&&!(signal instanceof AbortSignal)||networked&&(!(hostCurrentnessSignal instanceof AbortSignal)||!isApprovalPort(approvals)))fail('BASH_HOST_CONFIGURATION');
 const checkSignals=()=>{if(networked&&hostCurrentnessSignal.aborted)fail('BASH_HOST_REVOKED');signal?.throwIfAborted();};
 current(now,expiresAtMs);checkSignals();
 let proof;try{proof=own(await verifyOuterIsolation({binding:structuredClone(binding),expiresAtMs,...(signal?{signal}:{})}),['allocation','hostIdentity','receipt']);}
 catch{fail('BASH_HOST_ISOLATION_REFUSED');}
 let allocation;try{allocation=assertHostAllocation(proof.allocation);assertHostRunBinding(allocation,binding);}catch{fail('BASH_HOST_BINDING_REFUSED');}
 if(expiresAtMs>allocation.leaseDeadlineMs||now()>=allocation.leaseDeadlineMs)fail('BASH_HOST_BINDING_REFUSED');
 const identity=assertD005HostIdentity(proof.hostIdentity,binding,allocation);
 const receipt=assertD005IsolationReceipt(proof.receipt,{binding,allocation,hostIdentity:identity,now,expiresAtMs});checkSignals();
 let ports,report,probeError,portCleanupError;
 try{ports=await createReadinessPorts({pathEnv});if(typeof ports?.close!=='function')fail('BASH_READINESS_INCOMPLETE');
  report=await checkSandboxReadiness(ports,{...(protectedPaths===undefined?{}:{protectedPaths}),deadlineMs:30000});}
 catch{probeError=fault('BASH_READINESS_INCOMPLETE');}
 finally{try{await ports?.close?.();}catch{portCleanupError=fault('BASH_READINESS_CLEANUP_UNKNOWN');}}
 if(portCleanupError)throw portCleanupError;
 if(probeError)throw probeError;
 const attestation=toBashSandboxAttestation(report,{outerIsolationBoundary:true});
 if(!attestation.available)fail('BASH_SANDBOX_UNAVAILABLE');
 current(now,expiresAtMs);checkSignals();
 let started,egressFact,remainingAtStart;
 try{
  if(networked){
   started=await startEgress({domains:effective.sandboxNetworkDomains,expiresAtMs,now});
   if(typeof started?.proxy?.close!=='function'||typeof started.proxy.revoke!=='function')fail('BASH_EGRESS_START_FAILED');
   egressFact=assertBashEgressFact(started.fact,effective.sandboxNetworkDomains);
  }
  remainingAtStart=expiresAtMs-current(now,expiresAtMs);checkSignals();
 }catch(error){if(started?.proxy)await closeProxy(started.proxy);
  if(error?.code==='BASH_EGRESS_START_FAILED'||error?.code==='BASH_HOST_REVOKED')throw error;
  fail('BASH_EGRESS_START_FAILED');}
 let closing,expiryTimer;
 const monotonicDeadline=performance.now()+remainingAtStart;
 const observedSignals=networked?[...new Set([hostCurrentnessSignal,signal].filter(Boolean))]:[];
 const onAbort=()=>{close().catch(()=>{});};
 const close=()=>{if(closing)return closing;
  clearTimeout(expiryTimer);
  for(const observed of observedSignals)observed.removeEventListener('abort',onAbort);
  // `closeProxy` calls revoke synchronously before its first await, destroying active tunnels now.
  closing=(async()=>{if(started?.proxy)await closeProxy(started.proxy);return Object.freeze({closed:true});})();
  return closing;};
 for(const observed of observedSignals)observed.addEventListener('abort',onAbort,{once:true});
 if(observedSignals.some(observed=>observed.aborted)){await close();fail('BASH_HOST_REVOKED');}
 const scheduleExpiry=()=>{if(closing)return;
  let left;try{left=Math.min(expiresAtMs-now(),monotonicDeadline-performance.now());}catch{onAbort();return;}
  if(!Number.isFinite(left)||left<=0){onAbort();return;}
  expiryTimer=setTimeout(scheduleExpiry,Math.max(1,Math.ceil(Math.min(left,1000))));expiryTimer.unref?.();};
 if(networked)scheduleExpiry();if(closing){await closing;fail('BASH_HOST_REVOKED');}
 const runtimeFacts=Object.freeze({bashSandbox:attestation,...(started?{bashEgress:egressFact,bashApprovals:approvals}:{})});
 return Object.freeze({runtimeFacts,allocation,hostIdentity:identity,isolationReceipt:receipt,close});
}
