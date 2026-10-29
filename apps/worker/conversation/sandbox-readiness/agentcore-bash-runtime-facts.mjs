// @ts-check
/** Runtime-preparation owner for SDK-sandboxed Bash inside a Meri AgentCore runtime session. It supplies the trusted
 * `bashSandbox` fact (and, for an authorised networked policy, `bashEgress`/`bashApprovals`) that the capability
 * composer consumes; it hosts no executor and starts no second harness. Shell and Python are the Claude Agent SDK's
 * own `Bash` tool running inside the SDK's `sandbox`, in the conversation workspace, with the SDK's credential scrub
 * and filesystem/network rules. Nothing here decides admission: `capabilities/bash-sandbox.mjs` does, from this fact.
 *
 * Why this is not `host/bash-runtime-facts.mjs`: that owner carries the D005 per-conversation EC2 identity and an
 * `d005-isolated-ec2` outer-isolation receipt, which an AgentCore task cannot produce. Reusing it (or relabelling its
 * receipt) would forge the outer boundary. Here `outerIsolationBoundary` is honestly false: this host claims no outer
 * boundary beyond the SDK sandbox itself. Consequently a task whose kernel cannot give the sandbox a fresh /proc
 * (the weaker nested mode) yields an unavailable attestation and Bash is not admitted — the same-UID model-credential
 * process is not an acceptable outer boundary, and no escape flag is set to change that.
 *
 * The sandbox is measured, not assumed: `checkSandboxReadiness` runs the pinned SDK's real no-model startup with the
 * product settings, and only a clean measurement produces an available attestation. The measurement is host-level
 * (immutable image, one runtime session), so it runs at most once per process and is reused for later runs. */
import {performance} from 'node:perf_hooks';
import {validateShape} from '../../../../packages/contracts/validate.mjs';
import {assertCapabilityPolicy} from '../capabilities/policy.mjs';
import {assertBashEgressFact} from '../capabilities/bash-sandbox.mjs';
import {isApprovalPort} from '../capabilities/bash-approval.mjs';
import {checkSandboxReadiness,toBashSandboxAttestation} from './readiness.mjs';
import {createHostPorts} from './host-probes.mjs';
import {startBashEgress} from '../egress/bash-egress.mjs';

/** Identifies the topology this owner prepares for, in receipts and diagnostics. */
export const AGENTCORE_BASH_TOPOLOGY='agentcore-runtime-session';
/** Readiness verdict codes that mean the probe's own SDK shutdown failed or could not be accounted for. They are
 * cleanup uncertainty about a process this run started, never evidence that the host simply lacks a sandbox. */
export const READINESS_CLEANUP_FAILURES=Object.freeze(['SDK_CLOSE_FAILED','SDK_CLEANUP_TIMEOUT','SDK_SHUTDOWN_FAILED','READINESS_CLEANUP_FAILED']);
const fault=code=>Object.assign(new Error(code),{code});
const fail=code=>{throw fault(code);};
const current=(now,expiresAtMs)=>{const time=now();if(!Number.isSafeInteger(time)||!Number.isSafeInteger(expiresAtMs)||expiresAtMs<=time)fail('BASH_HOST_BINDING_REFUSED');return time;};
/** Revoke first so open tunnels end even if stopping listeners fails; always attempt both operations. */
async function closeProxy(proxy){let known=true;
 try{if(proxy?.revoke?.()?.revoked!==true)known=false;}catch{known=false;}
 try{if(typeof proxy?.close!=='function')known=false;else await proxy.close();}catch{known=false;}
 if(!known)fail('BASH_EGRESS_CLEANUP_UNKNOWN');
}
/** Host-level sandbox readiness for this process. The first caller measures; every later run in the same runtime
 * session reuses that measurement. A settled refusal is reused too: the image and kernel do not change under a
 * running task, so re-probing would only spend the run's preparation budget on the same answer.
 *
 * The pending measurement belongs to the run that started it: a caller's `signal` aborts it, so a cancelled run or
 * an expired preparation stage stops the SDK startup instead of leaving it to its own 30 s deadline while the run
 * returns. A cancelled or cleanup-unknown measurement is not a verdict about the host and is never reused —
 * `settle()` lets the runner await whatever is still in flight before it finishes.
 * @param {{createReadinessPorts?:typeof createHostPorts}} [options] */
export function createHostSandboxReadiness({createReadinessPorts=createHostPorts}={}){
 /** @type {{promise:Promise<any>,controller:AbortController,reusable:boolean}|null} */let pending=null;
 /** @param {{pathEnv:string,protectedPaths?:object,deadlineMs?:number,signal?:AbortSignal}} input */
 function read({pathEnv,protectedPaths,deadlineMs=30000,signal}){
  if(!pending){
   const controller=new AbortController();
   /** @type {{promise:Promise<any>,controller:AbortController,reusable:boolean}} */
   const entry={controller,reusable:true,promise:Promise.resolve()};
   entry.promise=(async()=>{
    /** @type {any} */let ports,report;
    try{ports=await createReadinessPorts({pathEnv});if(typeof ports?.close!=='function')fail('BASH_READINESS_INCOMPLETE');
     report=await checkSandboxReadiness(ports,{protectedPaths,deadlineMs,signal:controller.signal});
     if(report?.aborted===true)entry.reusable=false;}
    catch(error){entry.reusable=false;
     if(error?.code==='BASH_READINESS_CLEANUP_UNKNOWN'||error?.code==='BASH_READINESS_INCOMPLETE')throw error;
     throw fault('BASH_READINESS_INCOMPLETE');}
    finally{try{await ports?.close?.();}catch{entry.reusable=false;throw fault('BASH_READINESS_CLEANUP_UNKNOWN');}}
    return report;
   })();
   pending=entry;
   // A measurement stopped by its caller, or one whose own cleanup failed, is not evidence about the host: drop it so
   // the next run measures again instead of inheriting an answer this host never gave.
   entry.promise.then(()=>{if(pending===entry&&!entry.reusable)pending=null;},()=>{if(pending===entry)pending=null;});
  }
  const entry=pending;
  if(signal!==undefined){
   const abort=()=>entry.controller.abort(signal.reason);
   if(signal.aborted)abort();
   else{signal.addEventListener('abort',abort,{once:true});
    // The listener never outlives the measurement or the run it belongs to.
    entry.promise.then(()=>signal.removeEventListener('abort',abort),()=>signal.removeEventListener('abort',abort));}
  }
  return entry.promise;
 }
 /** Resolves once any in-flight measurement has settled; never rejects. */
 async function settle(){const entry=pending;if(entry)try{await entry.promise}catch{}}
 return Object.freeze({read,settle});
}
/** The default host measurement for this task: one per process, shared by every run it serves. */
const defaultReadiness=createHostSandboxReadiness();
/**
 * Prepare trusted Bash facts for one run in this AgentCore task.
 *
 * Networked Bash (a non-empty `sandboxNetworkDomains`) additionally requires an approval port and a host-currentness
 * signal from the owning runtime, exactly as the disposabe-worker owner requires: an external destination is
 * approved before it is reached, and revocation aborts it. This task has no such owner today, so a networked policy
 * refuses rather than silently running without approvals.
 * @param {{binding:object,policy:unknown,approvals?:unknown,expiresAtMs:number,now?:()=>number,pathEnv?:string,
 *   protectedPaths?:import('../capabilities/bash-sandbox.mjs').ProtectedPaths,signal?:AbortSignal,hostCurrentnessSignal?:AbortSignal,
 *   readiness?:(input:{pathEnv:string,protectedPaths?:object,deadlineMs?:number,signal?:AbortSignal})=>Promise<any>,
 *   startEgress?:typeof startBashEgress}} input
 */
export async function prepareAgentCoreBashRuntimeFacts({binding,policy,approvals,expiresAtMs,now=Date.now,pathEnv=process.env.PATH??'',
 protectedPaths,signal,hostCurrentnessSignal,readiness=defaultReadiness.read,startEgress=startBashEgress}){
 const effective=assertCapabilityPolicy(policy);
 if(!effective.bash)return Object.freeze({runtimeFacts:Object.freeze({}),async close(){return Object.freeze({closed:true});}});
 // The run binding is the run's identity, checked but never widened by this owner.
 if(typeof binding?.tenantId!=='string'||typeof binding.actorId!=='string'||typeof binding.conversationId!=='string'||typeof binding.runId!=='string')fail('BASH_HOST_BINDING_REFUSED');
 try{validateShape('RunBinding',binding);}catch{fail('BASH_HOST_BINDING_REFUSED');}
 const networked=effective.sandboxNetworkDomains.length>0;
 const read=readiness;
 if(typeof now!=='function'||typeof pathEnv!=='string'||typeof read!=='function'||typeof startEgress!=='function'||
  signal!==undefined&&!(signal instanceof AbortSignal)||networked&&(!(hostCurrentnessSignal instanceof AbortSignal)||!isApprovalPort(approvals)))
  fail('BASH_HOST_CONFIGURATION');
 const checkSignals=()=>{if(networked&&hostCurrentnessSignal.aborted)fail('BASH_HOST_REVOKED');signal?.throwIfAborted();};
 current(now,expiresAtMs);checkSignals();
 // The measurement is joined to this run's lifetime: a cancelled run or an expired stage aborts the pending SDK
 // startup, which settles its own child before this call returns.
 const report=await (async()=>{try{return await read({pathEnv,...(protectedPaths===undefined?{}:{protectedPaths}),deadlineMs:30000,...(signal===undefined?{}:{signal})});}
  catch(error){if(error?.code==='BASH_READINESS_CLEANUP_UNKNOWN'||error?.code==='BASH_READINESS_INCOMPLETE')throw error;fail('BASH_READINESS_INCOMPLETE');}})();
 // A measurement its caller stopped proves nothing about this host, and the run is stopping anyway.
 if(report?.aborted===true)fail('BASH_HOST_REVOKED');
 // Owned startup cleanup that failed or is unknown is never ordinary "no Bash on this host": it is retained and the
 // run refuses, so a failed SDK shutdown cannot be spent as a normal chat that silently lacks Bash.
 const startup=report?.sdkStartup??{};
 if(startup.shutdown==='failed'||READINESS_CLEANUP_FAILURES.includes(startup.reasonCode))fail('BASH_READINESS_CLEANUP_UNKNOWN');
 // No outer per-conversation boundary is claimed here; a host needing the weaker nested sandbox is unavailable.
 const attestation=toBashSandboxAttestation(report,{outerIsolationBoundary:false});
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
 return Object.freeze({runtimeFacts,topology:AGENTCORE_BASH_TOPOLOGY,readinessSha256:attestation.readinessSha256,close});
}
