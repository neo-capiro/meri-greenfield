/** One invocation in a conversation-isolated AgentCore environment. Canonical SDK activity. */
import {createConversationActivity} from '../worker/conversation/activity.mjs';
import {canonicalSha256,validateShape} from '../../packages/contracts/validate.mjs';
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {fault} from './config.mjs';
import {runnerStartupBudget,ACTIVITY_PREPARATION_MAX_MS} from '../../packages/runtime/runner-load-budget.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {lstat,realpath,mkdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {prepareRunSkillPlugin,sdkSkillPluginDirectory} from '../worker/conversation/capabilities/skill-plugin.mjs';
import {assertProviderEnvironment} from '../worker/conversation/provider.mjs';
import {createLifecycleRunOwner} from '../control/conversations/lifecycle/worker-owner.mjs';
import {createTaskSelectedSkills} from './selected/task.mjs';
import {createTaskSiteWorkflowPort} from '../worker/conversation/browser/site-workflows/task-port.mjs';
import {createTaskProcedurePort} from '../worker/conversation/procedures/task-port.mjs';
import {createOwnedRuntimeSdkSession} from './sdk-session-runtime.mjs';
import {assertExecutionIdentity} from '../control/conversations/execution-boundary.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {captureGeneralReadPort} from './general-read-port.mjs';
import {createNativeFiles,prepareNativeTaskDirectory} from './artifacts/native-files.mjs';
import {assertNativeFileRestore} from '../../packages/contracts/runtime-0.2/files.mjs';
import {atRunnerStage,markRunnerStage,captureRunnerFailure,markRunnerTelemetryStage,withRunnerDiagnostics} from './runner-runtime-diagnostics.mjs';
import {createOutreachGenerationRuntime} from '../worker/conversation/outreach-generation.mjs';
import {createObjectiveGenerationRuntime} from '../worker/conversation/objective-generation/runtime.mjs';
import {attemptCleanup,CLEANUP_ATTEMPT_MS} from '../worker/conversation/cleanup.mjs';
// Bash facts for this runtime session: the SDK sandbox measured on this host, plus the run's egress/approval facts.
import {prepareAgentCoreBashRuntimeFacts,createHostSandboxReadiness} from '../worker/conversation/sandbox-readiness/agentcore-bash-runtime-facts.mjs';
export function assertRunnerEnvironment(environment=process.env){assertProviderEnvironment(environment);if(environment.MERI_NATIVE_ADMIN_TOKEN)throw fault('RUNNER_AMBIENT_CREDENTIAL_REFUSED');}
/** Private task-local SDK directories; provider TLS uses the ordinary Bedrock trust store. */
export function sdkConfigurationDirectories(configuration){
 if(configuration.sdk===undefined)return {};
 const sdk=own(configuration.sdk,['configParentDirectory','secureStorageDirectory']);
 return {sdkConfigDirectory:join(sdk.configParentDirectory,'sdk-'+configuration.binding.runId),sdkSecureStorageDirectory:sdk.secureStorageDirectory};
}
/** A directory the SDK may use only if it is a real directory owned by this task's uid, private to it, and reached without symlinks. */
async function assertOwnedPrivateDirectory(path,uid){let stat;try{stat=await lstat(path);}catch{throw fault('RUNNER_SDK_DIRECTORY_REFUSED');}if(stat.isSymbolicLink()||!stat.isDirectory()||stat.uid!==uid||(stat.mode&0o077)!==0||await realpath(path)!==path)throw fault('RUNNER_SDK_DIRECTORY_REFUSED');}
/** The config directory is fresh per run (an existing one refuses); secure storage may pre-exist. Parents and both directories are verified owned, private and symlink-free before any SDK initialization. */
export async function ensureSdkConfigurationDirectories(directories,options={}){
 if(directories.sdkConfigDirectory===undefined)return directories;
 const uid=options.uid??process.getuid?.();if(!Number.isSafeInteger(uid)||uid<0)throw fault('RUNNER_SDK_DIRECTORY_REFUSED');
 const {sdkConfigDirectory,sdkSecureStorageDirectory}=directories;
 await assertOwnedPrivateDirectory(dirname(sdkConfigDirectory),uid);
 try{await mkdir(sdkConfigDirectory,{mode:0o700});}catch{throw fault('RUNNER_SDK_DIRECTORY_REFUSED');}
 await assertOwnedPrivateDirectory(sdkConfigDirectory,uid);
 await assertOwnedPrivateDirectory(dirname(sdkSecureStorageDirectory),uid);
 try{await mkdir(sdkSecureStorageDirectory,{mode:0o700});}catch(error){if(error?.code!=='EEXIST')throw fault('RUNNER_SDK_DIRECTORY_REFUSED');}
 await assertOwnedPrivateDirectory(sdkSecureStorageDirectory,uid);
 return directories;
}
const lifecycleOperations=new Set(['runner/next-controls','runner/claim-control','runner/ack-control','runner/record-checkpoint','runner/child-dispatch','runner/child-settle']);
function startupBudgetFor(configuration){
 if(configuration.execution===undefined)return null;
 const execution=assertExecutionIdentity(configuration.execution);
 if(canonicalSha256(execution.binding)!==canonicalSha256(configuration.binding))throw fault('RUNNER_BINDING_REFUSED');
 return runnerStartupBudget({requestMs:configuration.limits?.requestMs,shutdownMs:configuration.limits?.shutdownMs,originalExpiresAtMs:execution.expiresAtMs});
}
export function assembleConversationRunner({configuration,native,query,credentialForBinding,sessionFactory,generalReads,governedIntents,providerCredentials,browser,now=Date.now}){
 const readPort=captureGeneralReadPort(generalReads,configuration.sourceEnabled);
 const startup=startupBudgetFor(configuration),stages=startup?.stages;
 validateShape('RuntimeVersions',configuration.versions);const configuredVersionsSha256=canonicalSha256(configuration.versions);
 const binding=configuration.binding,call=(operation,input,signal)=>{let stage;
  if(operation==='runner/load')stage=stages?.load;
  else if(operation==='runner/runtime')stage=stages?.runtime;
  else if(operation==='runner/publish'&&startup){const state=input.event?.type==='run.status'?input.event.data?.state:null;
   stage=stages[state]??{maxMs:stages.session.maxMs,expiresAtMs:startup.originalExpiresAtMs};}
  // Lifecycle calls share the existing session allowance and immutable execution cutoff.
  else if(operation==='runner/outreach/complete'||operation==='runner/outreach/fail'||operation==='runner/checkpoint/capture'||operation==='runner/checkpoint/complete'||operation==='runner/files/restore'||lifecycleOperations.has(operation))stage=startup?{maxMs:stages.session.maxMs,expiresAtMs:startup.originalExpiresAtMs}:undefined;
  const result=native.call(operation,{binding,...input},stage?{signal,deadlineMs:stage.expiresAtMs,...(operation==='runner/load'?{}:{maxRequestMs:stage.maxMs})}:{signal});
  if(operation!=='runner/load')return result;
  const loaded=value=>{markRunnerTelemetryStage('runner.load.done');return value;};return typeof result?.then==='function'?result.then(loaded):loaded(result);};
 if(sessionFactory!==undefined&&typeof sessionFactory!=='function')throw fault('RUNNER_SESSION_CONFIGURATION');
 const selectedSkills=createTaskSelectedSkills({native,now,sourceEnabled:configuration.sourceEnabled??false}),sdkSession=sessionFactory===undefined?null:createOwnedRuntimeSdkSession({factory:sessionFactory,now,cleanupMs:configuration.limits?.shutdownMs??1000});
 // Wave5 MO01/ST16: the same task transport resolves the persisted procedure selection for a run. The control-side
 // 'procedure/resolve' handler is the remaining join; without it a selected procedure refuses rather than runs.
 const procedures=createTaskProcedurePort({native,now}),siteWorkflows=createTaskSiteWorkflowPort({native});
 const localBinding=b=>{if(canonicalSha256(b)!==canonicalSha256(binding))throw fault('RUNNER_BINDING_REFUSED');};
 let outreachSelection=null;
 const outreachGeneration=createOutreachGenerationRuntime({selection:{async read({binding:b}){localBinding(b);return outreachSelection;}},complete:({binding:b,signal,...input})=>{localBinding(b);return call('runner/outreach/complete',input,signal);},fail:({binding:b,signal,...input})=>{localBinding(b);return call('runner/outreach/fail',input,signal);}});
 let objectiveSelection=null,objectiveRead=false;const objectiveGeneration=createObjectiveGenerationRuntime({now,selection:{async read({binding:b,signal}){localBinding(b);if(!objectiveRead){objectiveRead=true;return objectiveSelection;}const r=await call('runner/runtime',{versions:configuration.versions},signal);if(canonicalSha256(r.binding)!==canonicalSha256(binding)||canonicalSha256(r.versions)!==configuredVersionsSha256)throw fault('RUNNER_RUNTIME_REFUSED');return r.objective??null;}}});
 let nativeFiles,bashRuntime,localCleanupFailed=false,workspaceRecorded=false;
 // Host-level sandbox measurement is taken at most once per runtime session and reused by later runs.
 const bashReadiness=createHostSandboxReadiness();
 let runOwner={readUploadSource:({binding:b,input,signal})=>{localBinding(b);return call('runner/upload-source',{input},signal);},recordUsage:({binding:b,input,signal})=>{localBinding(b);return call('runner/record-usage',{input},signal);},load:({binding:b,signal})=>{localBinding(b);return call('runner/load',{},signal);},append:({binding:b,event,signal})=>{localBinding(b);return call('runner/publish',{event},signal);}},lifecycle;
 if(credentialForBinding!==undefined){
  if(typeof credentialForBinding!=='function')throw fault('RUNNER_CREDENTIAL_CONFIGURATION');
  const forward=operation=>({binding:b,credential,signal,...input})=>{localBinding(b);return call(operation,input,signal);};
  // Child assignment custody is forwarded to the same private run-owner route family: the assignment is persisted
  // before the SDK Agent call is admitted and the child result receipt before the parent is acknowledged.
  const service={loadForExecution:forward('runner/load'),publish:forward('runner/publish'),nextControls:forward('runner/next-controls'),claimControl:forward('runner/claim-control'),ackControl:forward('runner/ack-control'),recordCheckpoint:forward('runner/record-checkpoint'),dispatchChild:forward('runner/child-dispatch'),settleChild:forward('runner/child-settle')};
  runOwner={...runOwner,...createLifecycleRunOwner({service,credentialForBinding:args=>{localBinding(args.binding);return credentialForBinding(args);}})};
  const capture=operation=>async({binding:b,sessionId,controlId,typedResult,signal})=>{localBinding(b);
   if(!sdkSession||!nativeFiles)throw fault('RUNNER_NATIVE_FILES_UNAVAILABLE');
   // The activity has closed and drained the query before this callback. Flush
   // the SDK mirror before reading either mutable local tree.
   await sdkSession.settle(signal);const upload=nativeFiles.capture({signal});
   const recorded=await call(operation,{sessionId,...upload,...(controlId===undefined?{}:{controlId}),...(typedResult===undefined?{}:{typedResult})},signal);
   // The durable owner accepted exactly these local bytes: the warm tree is this run's recorded materialization.
   workspaceRecorded=true;return recorded;};
  lifecycle={captureOwnsClose:true,captureCheckpoint:capture('runner/checkpoint/capture'),...(configuration.sdk===undefined?{}:{captureCompletion:capture('runner/checkpoint/complete')})};
 }
 const append=storageMethod(runOwner,'append');runOwner={...runOwner,async append(input){if(input.event.type==='run.status'&&input.event.data.state==='completed')await sdkSession?.settle(input.signal);return append(input);}};
  const prepareRuntime=async({binding:b,versions,model,signal,runtimeSignal,continuation,nextTurn,sourceRequest,request,scopes,skillPlugin,capabilityPolicy})=>atRunnerStage('runtime-prepare',async()=>{if(canonicalSha256(versions)!==configuredVersionsSha256)throw fault('RUNNER_VERSION_REFUSED');if(continuation!==undefined&&nextTurn!==undefined)throw fault('RUNNER_RUNTIME_REFUSED');const lineage=nextTurn!==undefined?{nextTurn}:continuation!==undefined?{continuation}:null,resumed=lineage?{...lineage,sourceRequest,request,scopes}:{};markRunnerStage('runtime-admission');const r=await call('runner/runtime',{versions,...resumed},signal);own(r,['binding','versions','deadlineMs','maxOutputBytes'],['objective','automaticClientContext','outreach',...(lineage===null?[]:['restoreReceipt']),...(sessionFactory===undefined?[]:['sdkSessionKey'])]);if(canonicalSha256(r.binding)!==canonicalSha256(b)||canonicalSha256(r.versions)!==configuredVersionsSha256)throw fault('RUNNER_RUNTIME_REFUSED');
  const local=stages?.local,localLife=local?createOperationLifetime({now,signal,deadlineMs:Math.min(now()+local.maxMs,local.expiresAtMs),errorFactory:fault}):null;
  try{return await (localLife?localLife.run:async fn=>fn(signal))(async localSignal=>{
  const {sdkSessionKey,objective,outreach,...prepared}=r;objectiveSelection=objective??null;outreachSelection=outreach??null;own(model,['model','region','maxOutputTokens','usageBasis','maxTurns','maxCostMicroUSD'],['provider','effort']);const runtime={...prepared,...model};let sessionStore;
  if(model.provider==='claude-api'){
   if(typeof providerCredentials?.read!=='function')throw fault('CLAUDE_API_CREDENTIAL_UNAVAILABLE');
   runtime.providerApiKey=await providerCredentials.read({signal:localSignal});localSignal?.throwIfAborted();
  }
   markRunnerStage('sdk-session');if(sessionFactory!==undefined){if(sdkSessionKey===undefined||sdkSessionKey===null&&lineage!==null)throw fault('RUNNER_SDK_REGISTRATION_UNAVAILABLE');sessionStore=await sdkSession.prepare({binding:b,sessionKey:sdkSessionKey,signal:localSignal,...(lineage??{}),...(sdkSessionKey===null||lineage!==null?{runtimeSignal}:{})});}
  else sessionStore={load:key=>call('runner/session/load',{key}).then(v=>{own(v,['entries']);return v.entries;}),append:(key,entries)=>call('runner/session/append',{key,entries}).then(v=>{own(v,['committed']);if(v.committed!==true)throw fault('SESSION_PERSISTENCE_FAILED');})};
   markRunnerStage('sdk-directories');const directories=await ensureSdkConfigurationDirectories(sdkConfigurationDirectories(configuration));
   if(directories.sdkConfigDirectory!==undefined){
    if(!sdkSession)throw fault('RUNNER_SDK_SESSION_UNKNOWN');
    await prepareNativeTaskDirectory(directories.sdkConfigDirectory);
    nativeFiles=createNativeFiles({workspace:configuration.workspace,sdkConfigDirectory:directories.sdkConfigDirectory,expiresAtMs:r.deadlineMs,now});
    const restored=assertNativeFileRestore(await call('runner/files/restore',{},localSignal),b);
    if(restored.files!==null){if(lineage===null)throw fault('RUNNER_NATIVE_FILES_UNAVAILABLE');
     await nativeFiles.restore({state:restored.files,files:restored.upload.files.map(f=>Buffer.from(f.base64,'base64')),taskFiles:restored.upload.taskFiles.map(f=>Buffer.from(f.base64,'base64')),signal:localSignal});}
   }
  // G3: the read-only skill plugin copy under the admitted private config parent, one run-invariant path (sdkSkillPluginDirectory).
   const selection=request?.skill??undefined; // Stored requests use null for no selected skill; the plugin API uses omission.
   markRunnerStage('skill-plugin');const plugin=skillPlugin===true&&directories.sdkConfigDirectory!==undefined?await prepareRunSkillPlugin(sdkSkillPluginDirectory(dirname(directories.sdkConfigDirectory),selection),{selection}):undefined;
   markRunnerStage('activity');
   // Bash is admitted only from a measured host sandbox: with the effective policy's `bash` flag the run owner prepares
   // the trusted facts here and the activity forwards them to the capability composer. Any refusal (no bwrap/socat, no
   // fresh /proc, SDK version mismatch) leaves Bash out of `tools` for this run — it never weakens the sandbox.
   if(capabilityPolicy?.bash===true&&directories.sdkConfigDirectory!==undefined){
    markRunnerStage('bash-facts');
    try{bashRuntime=await prepareAgentCoreBashRuntimeFacts({binding:b,policy:capabilityPolicy,expiresAtMs:r.deadlineMs,now,
     pathEnv:process.env.PATH??'',signal:localSignal,readiness:bashReadiness.read,
     protectedPaths:{sdkConfigDirectory:directories.sdkConfigDirectory,...(directories.sdkSecureStorageDirectory===undefined?{}:{sdkSecureStorageDirectory:directories.sdkSecureStorageDirectory})}});
     // The run may have been cancelled while this preparation was returning: the facts are owned here, so close them
     // now rather than leaving the egress proxy to a cleanup path that has already run.
     if(localSignal.aborted){try{await bashRuntime.close();}catch{localCleanupFailed=true;}bashRuntime=undefined;}}
    catch(error){
     // This host cannot provide the measured sandbox: the capability's own admission rule then leaves Bash out of
     // `tools` (it is never run unsandboxed). Wiring refusals — a networked policy without an approval owner, a failed
     // egress start, an invalid policy — still fail the run instead of quietly narrowing it. A refused host is not a
     // run failure: `bash-facts` remains the last stage and the run's admitted tools show Bash absent.
     if(!['BASH_SANDBOX_UNAVAILABLE','BASH_READINESS_INCOMPLETE'].includes(error?.code))throw error;
     bashRuntime=undefined;
    }
   }
   return {...runtime,cwd:configuration.workspace,sessionStore,...directories,...(bashRuntime?.runtimeFacts??{}),...(plugin?{skillPluginDirectory:plugin.directory}:{})};});}finally{localLife?.close();}});
 // The activity bounds runtime preparation (the runner/runtime call, then the local stage); see ACTIVITY_PREPARATION_MAX_MS.
 const activity=createConversationActivity({runOwner,prepareRuntime,selectedSkills,procedures,siteWorkflows,objectiveGeneration,outreachGeneration,now,...(stages?{loadMaxMs:stages.load.maxMs,loadExpiresAtMs:stages.load.expiresAtMs,runtimeMaxMs:Math.min(stages.runtime.maxMs+stages.local.maxMs,ACTIVITY_PREPARATION_MAX_MS),runtimeExpiresAtMs:stages.local.expiresAtMs,setupBudget:stages.setup,modelDeadlineMs:stages.session.expiresAtMs,executionDeadlineMs:startup.originalExpiresAtMs,terminalAttemptMs:stages.session.maxMs}:{}),...(readPort?{generalReads:readPort}:{}),...(governedIntents?{governedIntents}:{}),...(query?{query}:{}),...(lifecycle?{lifecycle}:{}),...(browser?{browser}:{}),heartbeat:()=>{},diagnostics:{stage:markRunnerStage,failure:captureRunnerFailure}});
  const execute=async input=>withRunnerDiagnostics(()=>atRunnerStage('activity',async()=>{try{return await activity(input);}catch(error){captureRunnerFailure(error);throw error;}finally{markRunnerStage('runner-cleanup');
   try{try{await selectedSkills.close();}catch(error){localCleanupFailed=true;throw error;}finally{await sdkSession?.close();}}
   finally{
   // A run that never recorded its cwd bytes leaves a conversation-local tree the durable owner cannot account for:
   // retain those bytes beside the workspace and leave the workspace empty, so the next run restores the durable state
   // instead of refusing a stale tree. Nothing is erased; a failed retention is unknown local cleanup.
   if(!workspaceRecorded&&nativeFiles&&!await attemptCleanup(signal=>nativeFiles.retain({signal,deadlineMs:now()+CLEANUP_ATTEMPT_MS}),{now,timeoutMs:CLEANUP_ATTEMPT_MS}))localCleanupFailed=true;
   // The run's egress proxy (networked Bash) is revoked and closed here on success, failure and cancellation, and any
   // readiness measurement still in flight is awaited so no owned SDK startup outlives the run that started it.
   try{await bashRuntime?.close();}catch{localCleanupFailed=true;}
   try{await bashReadiness.settle();}catch{localCleanupFailed=true;}
   }
  }}),{binding,environment:configuration.telemetry?.environment});
 Object.defineProperty(execute,'cleanupStatus',{value:()=>{const status=sdkSession?.cleanupStatus()??{pendingInitializations:0,closed:true,failures:[],physicalStopProven:false};return {...status,failures:[...status.failures,...(localCleanupFailed?['RUNNER_CLEANUP_UNKNOWN']:[])]};}});return execute;
}
export async function assertRunnerWorkspace(configuration){const workspace=await lstat(configuration.workspace);if(process.getuid()===0||!workspace.isDirectory()||workspace.isSymbolicLink()||workspace.uid!==process.getuid()||await realpath(configuration.workspace)!==configuration.workspace)throw fault('RUNNER_WORKSPACE_REFUSED');}
