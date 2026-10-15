// @ts-check
/** Worker-host readiness for SDK-sandboxed Bash, run by the runtime preparation owner on the disposable worker host.
 * It measures; it does not qualify. A `ready` report is local evidence that the SDK sandbox started on this host
 * with the exact product settings, nothing more: live network/filesystem/credential behaviour of a real sandboxed
 * command still needs the synthetic-budget check described in the lane report.
 *
 * Steps (all ports injected, so this module is pure orchestration and safe to import):
 *  1. bubblewrap and socat present (the SDK's documented Linux dependencies);
 *  2. a bubblewrap namespace probe with a fresh /proc, and without one (decides `enableWeakerNestedSandbox`);
 *  3. no admin managed-settings file on the host (it would silently drop the parent-tier locks);
 *  4. the SDK's own sandbox startup with `failIfUnavailable: true`, WITHOUT any model call: the prompt stream never
 *     yields a user message, the base URL is a closed loopback port and the token is a non-secret placeholder. The
 *     SDK emits an error result instead of starting when the sandbox cannot start; otherwise initialisation
 *     completes. A short quiet window follows, then the query is deliberately closed and its consumer awaited. Every
 *     frame and failure observed before, during and after initialisation (including the shutdown) is accounted by
 *     `startup-observation.mjs`; any contrary evidence outranks an earlier initialisation. */
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {buildBashSandboxSettings,buildBashSandboxLocks,assertBashSandboxAttestation,BASH_TOOL,BASH_SANDBOX_ENV} from '../capabilities/bash-sandbox.mjs';
import {createStartupObservation} from './startup-observation.mjs';
export const READINESS_SCHEMA='meri.worker-sandbox-readiness/0.1-proposal';
export const SDK_VERSION='0.3.295',CLI_VERSION='2.1.295';
export const MANAGED_SETTINGS_PATH='/etc/claude-code/managed-settings.json';
/** Non-secret placeholder and a loopback discard port: no credential exists and no request can leave the host. */
export const READINESS_MODEL_ENV=Object.freeze({ANTHROPIC_BASE_URL:'http://127.0.0.1:9',ANTHROPIC_AUTH_TOKEN:'meri-readiness-placeholder-not-a-credential',CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1'});
const NAMESPACE_BASE=Object.freeze(['--ro-bind','/','/','--dev','/dev','--unshare-all','--die-with-parent','--new-session']);
/** Bubblewrap probe arguments; the probe runs the current Node binary, which every Meri image contains.
 * @param {boolean} freshProc @param {string} node */
export const namespaceProbeArgs=(freshProc,node)=>[...NAMESPACE_BASE,...(freshProc?['--proc','/proc']:[]),'--',node,'-e','0'];
/** @typedef {{findExecutable:(name:string)=>string|undefined,runProbe:(command:string,args:string[])=>Promise<boolean>,exists:(path:string)=>boolean,makeTempDir:(label:string)=>string,removeDir:(path:string)=>void,query:(args:any)=>any,sdkVersion:string,nodePath:string,pathEnv:string}} ReadinessPorts */
/** Quiet window after initialisation in which any contrary frame still refuses; bounded cleanup wait after close. */
export const OBSERVE_MS=1000,CLEANUP_MS=5000;
/** @param {number} ms @param {string} code */
const timeout=(ms,code)=>{
 /** @type {ReturnType<typeof setTimeout>|undefined} */
 let timer;
 const promise=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error(code),{code})),ms);});
 promise.catch(()=>{});
 return {promise,cancel:()=>clearTimeout(timer)};
};
/** @param {number} ms */
const pause=ms=>{
 /** @type {ReturnType<typeof setTimeout>|undefined} */
 let timer;
 const promise=new Promise(resolve=>{timer=setTimeout(resolve,ms);});
 return {promise,cancel:()=>clearTimeout(timer)};
};
/** SDK sandbox startup with the product settings and no user message. Owns and closes everything it creates, and
 * returns only after the consumer has finished (or the bounded cleanup wait expired), so the verdict covers every
 * frame and failure observed, including those during the deliberate shutdown (`startup-observation.mjs`).
 * @param {ReadinessPorts} ports @param {{weakerNestedSandbox:boolean,protectedPaths?:import('../capabilities/bash-sandbox.mjs').ProtectedPaths,deadlineMs:number,observeMs?:number,cleanupMs?:number}} input
 * @returns {Promise<import('./startup-observation.mjs').StartupVerdict>} */
export async function probeSdkSandboxStartup(ports,{weakerNestedSandbox,protectedPaths,deadlineMs,observeMs=OBSERVE_MS,cleanupMs=CLEANUP_MS}){
 const workspace=ports.makeTempDir('workspace'),config=ports.makeTempDir('config');
 const controller=new AbortController(),seen=createStartupObservation();
 /** @type {()=>void} */let release=()=>{};const hold=new Promise(resolve=>{release=()=>resolve(undefined);});
 /** @type {()=>void} */let stop=()=>{};const stopped=new Promise(resolve=>{stop=()=>resolve('stopped');});
 /** @type {any} */let q;/** @type {Promise<void>|undefined} */let consumer;
 try{
  try{
   q=ports.query({prompt:(async function*(){await hold;})(),options:{cwd:workspace,abortController:controller,settingSources:[],settings:{autoMemoryEnabled:false},tools:[BASH_TOOL],allowedTools:[],permissionMode:'default',
    canUseTool:async()=>({behavior:'deny',message:'Readiness check runs no tool'}),maxTurns:1,
    sandbox:buildBashSandboxSettings({cwd:workspace,domains:[],weakerNestedSandbox,...(protectedPaths===undefined?{}:{protectedPaths})}),managedSettings:{sandbox:buildBashSandboxLocks(weakerNestedSandbox)},
    env:{...READINESS_MODEL_ENV,...BASH_SANDBOX_ENV,CLAUDE_CONFIG_DIR:config,HOME:config,PATH:ports.pathEnv}}});
  }catch(error){seen.startupRefused(error);}
  if(q){
   const query=q;
   consumer=(async()=>{try{for await(const m of query){seen.frame(m);if(seen.contrary)stop();}seen.streamEnded();}catch(error){seen.streamFailed(error);}finally{stop();}})();
   const limit=timeout(deadlineMs,'SDK_STARTUP_TIMEOUT');
   try{
    const init=Promise.resolve().then(()=>query.initializationResult()).then(()=>'init',(/** @type {unknown} */error)=>{seen.startupRefused(error);return 'refused';});
    const first=await Promise.race([init,stopped,limit.promise]);
    // Initialisation is necessary, not sufficient: a contrary frame in the quiet window, or later, still refuses.
    if(first==='init'){seen.initialized();if(!seen.contrary){const quiet=pause(observeMs);try{await Promise.race([stopped,quiet.promise]);}finally{quiet.cancel();}}}
   }catch{seen.timedOut();}finally{limit.cancel();}
  }
 }finally{
  // Deliberate shutdown: still observed, and a failure here is a failed shutdown, never `ready`.
  seen.beginShutdown();release();
  try{q?.close?.();}catch{seen.cleanupFailed('SDK_CLOSE_FAILED');}
  controller.abort();
  if(consumer){const settle=timeout(cleanupMs,'SDK_CLEANUP_TIMEOUT');try{await Promise.race([consumer,settle.promise]);}catch{seen.cleanupFailed('SDK_CLEANUP_TIMEOUT');}finally{settle.cancel();}}
  for(const dir of [workspace,config])try{ports.removeDir(dir);}catch{seen.cleanupFailed('READINESS_CLEANUP_FAILED');}
 }
 return seen.verdict();
}
/** @param {ReadinessPorts} ports @param {{protectedPaths?:import('../capabilities/bash-sandbox.mjs').ProtectedPaths,deadlineMs?:number,observeMs?:number,cleanupMs?:number}} [options] */
export async function checkSandboxReadiness(ports,{protectedPaths,deadlineMs=30000,observeMs=OBSERVE_MS,cleanupMs=CLEANUP_MS}={}){
 const bwrap=ports.findExecutable('bwrap'),socat=ports.findExecutable('socat');
 const freshProc=bwrap?await ports.runProbe(bwrap,namespaceProbeArgs(true,ports.nodePath)):false;
 const withoutProc=bwrap&&!freshProc?await ports.runProbe(bwrap,namespaceProbeArgs(false,ports.nodePath)):freshProc;
 const weakerNestedSandboxRequired=!freshProc&&withoutProc,managedSettingsTier=ports.exists(MANAGED_SETTINGS_PATH)?'present':'absent';
 const sdkVersionMatches=ports.sdkVersion===SDK_VERSION;
 const sdkStartup=sdkVersionMatches?await probeSdkSandboxStartup(ports,{weakerNestedSandbox:weakerNestedSandboxRequired,...(protectedPaths===undefined?{}:{protectedPaths}),deadlineMs,observeMs,cleanupMs})
  :/** @type {import('./startup-observation.mjs').StartupVerdict} */({status:'refused',reasonCode:'SDK_VERSION_MISMATCH',userMessagesSent:0,modelTurns:0,costUsd:0,messagesObserved:0,resultsObserved:0,initialized:false,shutdown:'clean'});
 const ready=!!bwrap&&!!socat&&(freshProc||withoutProc)&&managedSettingsTier==='absent'&&sdkVersionMatches&&sdkStartup.status==='ready';
 return Object.freeze({schema:READINESS_SCHEMA,sdk:ports.sdkVersion,cli:CLI_VERSION,dependencies:{bwrap:!!bwrap,socat:!!socat},namespaces:{freshProc,withoutProc},
  managedSettingsTier,sdkStartup,weakerNestedSandboxRequired,ready,
  scope:'LOCAL_READINESS_ONLY: not sandbox, network, credential, Fargate or release qualification'});
}
/** Trusted runtime fact for the worker, derived by the runtime preparation owner. `outerIsolationBoundary` is that
 * owner's deployment assertion (the disposable per-conversation worker is the isolation boundary); the check cannot
 * measure it. A host that needs the weaker nested sandbox without that assertion is reported unavailable. Besides
 * `ready`, the startup verdict itself must be clean (ready, initialised, no result, model turn or cost, clean shutdown).
 * @param {Awaited<ReturnType<typeof checkSandboxReadiness>>} report @param {{outerIsolationBoundary:boolean}} deployment */
export function toBashSandboxAttestation(report,{outerIsolationBoundary}){
 const s=report.sdkStartup,clean=s?.status==='ready'&&s.reasonCode===null&&s.initialized===true&&s.shutdown==='clean'&&s.resultsObserved===0&&s.modelTurns===0&&s.costUsd===0&&s.userMessagesSent===0;
 const weaker=report.weakerNestedSandboxRequired===true,available=report.ready===true&&clean&&(!weaker||outerIsolationBoundary===true);
 return assertBashSandboxAttestation({available,sdk:SDK_VERSION,cli:CLI_VERSION,weakerNestedSandbox:available&&weaker,outerIsolationBoundary:outerIsolationBoundary===true,readinessSha256:canonicalSha256(report)});
}
