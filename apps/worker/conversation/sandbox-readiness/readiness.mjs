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
 *     completes. The query is then closed and its consumer awaited. */
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {buildBashSandboxSettings,buildBashSandboxLocks,assertBashSandboxAttestation,BASH_TOOL,BASH_SANDBOX_ENV} from '../capabilities/bash-sandbox.mjs';
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
/** @param {string} text */
// Measured on CLI 2.1.295: with the sandbox enabled the CLI refuses to start when bwrap/socat are missing, and with
// CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1 it exits even earlier because the scrub itself requires bubblewrap.
const reasonOf=text=>/dependencies are missing|bubblewrap is required|not installed/iu.test(text)?'SANDBOX_DEPENDENCIES_MISSING':/sandbox required but unavailable/iu.test(text)?'SANDBOX_UNAVAILABLE':'SDK_STARTUP_FAILED';
/** @param {number} ms @param {string} code */
const timeout=(ms,code)=>{
 /** @type {ReturnType<typeof setTimeout>|undefined} */
 let timer;
 const promise=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error(code),{code})),ms);});
 return {promise,cancel:()=>clearTimeout(timer)};
};
/** SDK sandbox startup with the product settings and no user message. Owns and closes everything it creates.
 * @param {ReadinessPorts} ports @param {{weakerNestedSandbox:boolean,protectedPaths?:import('../capabilities/bash-sandbox.mjs').ProtectedPaths,deadlineMs:number}} input */
export async function probeSdkSandboxStartup(ports,{weakerNestedSandbox,protectedPaths,deadlineMs}){
 const workspace=ports.makeTempDir('workspace'),config=ports.makeTempDir('config');
 const controller=new AbortController();/** @type {()=>void} */let release=()=>{};const hold=new Promise(resolve=>{release=()=>resolve(undefined);});
 /** @type {{subtype?:string,is_error?:boolean,num_turns?:number,total_cost_usd?:number}|undefined} */let errorResult;let messages=0;let consumer;
 /** @type {string[]} */
 const errorTexts=[];
 try{
  const q=ports.query({prompt:(async function*(){await hold;})(),options:{cwd:workspace,abortController:controller,settingSources:[],settings:{autoMemoryEnabled:false},tools:[BASH_TOOL],allowedTools:[],permissionMode:'default',
   canUseTool:async()=>({behavior:'deny',message:'Readiness check runs no tool'}),maxTurns:1,
   sandbox:buildBashSandboxSettings({cwd:workspace,domains:[],weakerNestedSandbox,...(protectedPaths===undefined?{}:{protectedPaths})}),managedSettings:{sandbox:buildBashSandboxLocks(weakerNestedSandbox)},
   env:{...READINESS_MODEL_ENV,...BASH_SANDBOX_ENV,CLAUDE_CONFIG_DIR:config,HOME:config,PATH:ports.pathEnv}}});
  /** @type {(message:any)=>void} */let onError=()=>{};const errored=new Promise(resolve=>{onError=resolve;});
  consumer=(async()=>{try{for await(const m of q){messages++;if(m?.type==='result'&&m.is_error!==false){errorResult=m;errorTexts.push(...[m.result,...(Array.isArray(m.errors)?m.errors:[])].filter(t=>typeof t==='string'));onError(m);}}}catch(error){errorTexts.push(String(/** @type {Error} */(error)?.message??''));onError(error);}})();
  const limit=timeout(deadlineMs,'SDK_STARTUP_TIMEOUT');
  /** @type {{status:'ready'|'refused'|'timeout',reasonCode:string|null}} */let outcome;
  try{const first=await Promise.race([q.initializationResult().then(()=>'init',(/** @type {any} */error)=>{errorTexts.push(String(error?.message??''));return 'init-refused';}),errored.then(()=>'error'),limit.promise]);
   if(first==='init')outcome={status:'ready',reasonCode:null};
   else{await Promise.race([errored,limit.promise]).catch(()=>{});await Promise.race([consumer,new Promise(resolve=>setTimeout(resolve,1000).unref())]);
    outcome={status:'refused',reasonCode:reasonOf(errorTexts.join(' '))};} // Only a bounded code leaves this module, never the SDK's text.
  }catch(error){outcome={status:'timeout',reasonCode:/** @type {{code?:string}} */(error).code??'SDK_STARTUP_TIMEOUT'};}finally{limit.cancel();}
  release();try{q.close?.();}catch{}controller.abort();
  const settle=timeout(5000,'SDK_CLEANUP_TIMEOUT');try{await Promise.race([consumer,settle.promise]);}finally{settle.cancel();}
  // No user message was ever yielded; a startup error result must also show that no model turn ran.
  const modelTurns=errorResult?.num_turns??0,costUsd=errorResult?.total_cost_usd??0;if(modelTurns!==0||costUsd!==0)throw Object.assign(Error('READINESS_MODEL_TURN_OBSERVED'),{code:'READINESS_MODEL_TURN_OBSERVED'});
  return {...outcome,userMessagesSent:0,modelTurns,messagesObserved:messages};
 }finally{release();controller.abort();ports.removeDir(workspace);ports.removeDir(config);}
}
/** @param {ReadinessPorts} ports @param {{protectedPaths?:import('../capabilities/bash-sandbox.mjs').ProtectedPaths,deadlineMs?:number}} [options] */
export async function checkSandboxReadiness(ports,{protectedPaths,deadlineMs=30000}={}){
 const bwrap=ports.findExecutable('bwrap'),socat=ports.findExecutable('socat');
 const freshProc=bwrap?await ports.runProbe(bwrap,namespaceProbeArgs(true,ports.nodePath)):false;
 const withoutProc=bwrap&&!freshProc?await ports.runProbe(bwrap,namespaceProbeArgs(false,ports.nodePath)):freshProc;
 const weakerNestedSandboxRequired=!freshProc&&withoutProc,managedSettingsTier=ports.exists(MANAGED_SETTINGS_PATH)?'present':'absent';
 const sdkVersionMatches=ports.sdkVersion===SDK_VERSION;
 const sdkStartup=sdkVersionMatches?await probeSdkSandboxStartup(ports,{weakerNestedSandbox:weakerNestedSandboxRequired,...(protectedPaths===undefined?{}:{protectedPaths}),deadlineMs}):{status:'refused',reasonCode:'SDK_VERSION_MISMATCH',userMessagesSent:0,modelTurns:0,messagesObserved:0};
 const ready=!!bwrap&&!!socat&&(freshProc||withoutProc)&&managedSettingsTier==='absent'&&sdkVersionMatches&&sdkStartup.status==='ready';
 return Object.freeze({schema:READINESS_SCHEMA,sdk:ports.sdkVersion,cli:CLI_VERSION,dependencies:{bwrap:!!bwrap,socat:!!socat},namespaces:{freshProc,withoutProc},
  managedSettingsTier,sdkStartup,weakerNestedSandboxRequired,ready,
  scope:'LOCAL_READINESS_ONLY: not sandbox, network, credential, Fargate or release qualification'});
}
/** Trusted runtime fact for the worker, derived by the runtime preparation owner. `outerIsolationBoundary` is that
 * owner's deployment assertion (the disposable per-conversation worker is the isolation boundary); the check cannot
 * measure it. A host that needs the weaker nested sandbox without that assertion is reported unavailable.
 * @param {Awaited<ReturnType<typeof checkSandboxReadiness>>} report @param {{outerIsolationBoundary:boolean}} deployment */
export function toBashSandboxAttestation(report,{outerIsolationBoundary}){
 const weaker=report.weakerNestedSandboxRequired===true,available=report.ready===true&&(!weaker||outerIsolationBoundary===true);
 return assertBashSandboxAttestation({available,sdk:SDK_VERSION,cli:CLI_VERSION,weakerNestedSandbox:available&&weaker,outerIsolationBoundary:outerIsolationBoundary===true,readinessSha256:canonicalSha256(report)});
}
