/** One isolated task, one run, canonical SDK activity. No Temporal or DB credentials. */
import {createConversationActivity} from '../worker/conversation/activity.mjs';
import {canonicalSha256,validateShape} from '../../packages/contracts/validate.mjs';
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {readSecret,fault} from './config.mjs';
import {createNativeCapabilityClient} from './native-client.mjs';
import {runnerStartupBudget,RUNNER_STARTUP_MIN_SHUTDOWN_MS,RUNNER_STARTUP_CLEANUP_MS,RUNNER_STARTUP_MARGIN_MS,ACTIVITY_PREPARATION_MAX_MS} from '../../packages/runtime/runner-load-budget.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {lstat,realpath,mkdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {compileNativePreparationIntent} from './native-authority/preparation-intent.mjs';
import {prepareRunSkillPlugin,sdkSkillPluginDirectory} from '../worker/conversation/capabilities/skill-plugin.mjs';
import {assertBedrockEnvironment} from '../worker/conversation/provider.mjs';
import {createLifecycleRunOwner} from '../control/conversations/lifecycle/worker-owner.mjs';
import {createTaskSelectedSkills} from './selected/task.mjs';
import {createRuntimeSdkSessionFactory,createOwnedRuntimeSdkSession} from './sdk-session-runtime.mjs';
import {waitForAdmittedTask,loadRemoteTaskBinding} from './task-bootstrap.mjs';
import {remoteOriginal} from './native-authority/remote-task-boundary.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {captureGeneralReadPort} from './general-read-port.mjs';
import {atRunnerStage,markRunnerStage,captureRunnerFailure,markRunnerTelemetryStage,withRunnerDiagnostics} from './runner-runtime-diagnostics.mjs';
export function assertRunnerEnvironment(environment=process.env){assertBedrockEnvironment(environment);if(environment.MERI_NATIVE_ADMIN_TOKEN)throw fault('RUNNER_AMBIENT_CREDENTIAL_REFUSED');}
/** Private task-local SDK directories; provider TLS uses the ordinary Bedrock trust store. */
export function sdkConfigurationDirectories(configuration){
 if(configuration.remoteTask===undefined)return {};
 const intent=compileNativePreparationIntent(configuration.remoteTask.preparationIntent);
 return {sdkConfigDirectory:join(intent.configParentDirectory,'sdk-'+configuration.binding.runId),sdkSecureStorageDirectory:intent.secureStorageDirectory};
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
const lifecycleOperations=new Set(['runner/next-controls','runner/claim-control','runner/ack-control','runner/record-checkpoint']);
function startupBudgetFor(configuration){
 if(configuration.remoteTask===undefined)return null;
 const original=remoteOriginal(configuration.remoteTask.original);
 return runnerStartupBudget({requestMs:configuration.limits?.requestMs,shutdownMs:configuration.limits?.shutdownMs,originalExpiresAtMs:original.expiresAtMs});
}
export function assembleConversationRunner({configuration,native,query,credentialForBinding,sessionFactory,generalReads,governedIntents,now=Date.now}){
 const readPort=captureGeneralReadPort(generalReads,configuration.sourceEnabled);
 const startup=startupBudgetFor(configuration),stages=startup?.stages;
 validateShape('RuntimeVersions',configuration.versions);const configuredVersionsSha256=canonicalSha256(configuration.versions);
 const binding=configuration.binding,call=(operation,input,signal)=>{let stage;
  if(operation==='runner/load')stage=stages?.load;
  else if(operation==='runner/runtime')stage=stages?.runtime;
  else if(operation==='runner/publish'&&startup){const state=input.event?.type==='run.status'?input.event.data?.state:null;
   stage=stages[state]??{maxMs:stages.session.maxMs,expiresAtMs:state==='failed'||state==='cancelled'?startup.originalExpiresAtMs-3*Math.max(configuration.limits.shutdownMs,RUNNER_STARTUP_MIN_SHUTDOWN_MS)-RUNNER_STARTUP_CLEANUP_MS-RUNNER_STARTUP_MARGIN_MS:stages.session.expiresAtMs+stages.session.maxMs};}
  // Lifecycle controls and checkpoints run during execution. Control re-verifies task authority three times per call
  // (worker-http.mjs), so they share the session allowance up to the execution cutoff instead of the 3 s default.
  else if(operation==='runner/checkpoint/capture'||operation==='runner/checkpoint/complete'||lifecycleOperations.has(operation))stage=startup?{maxMs:stages.session.maxMs,expiresAtMs:stages.session.expiresAtMs+stages.session.maxMs}:undefined;
  const result=native.call(operation,{binding,...input},stage?{signal,deadlineMs:stage.expiresAtMs,...(operation==='runner/load'?{}:{maxRequestMs:stage.maxMs})}:{signal});
  if(operation!=='runner/load')return result;
  const loaded=value=>{markRunnerTelemetryStage('runner.load.done');return value;};return typeof result?.then==='function'?result.then(loaded):loaded(result);};
 if(sessionFactory!==undefined&&typeof sessionFactory!=='function')throw fault('RUNNER_SESSION_CONFIGURATION');
 const selectedSkills=createTaskSelectedSkills({native,now,sourceEnabled:configuration.sourceEnabled??false}),sdkSession=sessionFactory===undefined?null:createOwnedRuntimeSdkSession({factory:sessionFactory,now,cleanupMs:configuration.limits?.shutdownMs??1000});
 const localBinding=b=>{if(canonicalSha256(b)!==canonicalSha256(binding))throw fault('RUNNER_BINDING_REFUSED');};
 let runOwner={recordUsage:({binding:b,input,signal})=>{localBinding(b);return call('runner/record-usage',{input},signal);},load:({binding:b,signal})=>{localBinding(b);return call('runner/load',{},signal);},append:({binding:b,event,signal})=>{localBinding(b);return call('runner/publish',{event},signal);}},lifecycle;
 if(credentialForBinding!==undefined){
  if(typeof credentialForBinding!=='function')throw fault('RUNNER_CREDENTIAL_CONFIGURATION');
  const forward=operation=>({binding:b,credential,signal,...input})=>{localBinding(b);return call(operation,input,signal);};
  const service={loadForExecution:forward('runner/load'),publish:forward('runner/publish'),nextControls:forward('runner/next-controls'),claimControl:forward('runner/claim-control'),ackControl:forward('runner/ack-control'),recordCheckpoint:forward('runner/record-checkpoint')};
  runOwner={...runOwner,...createLifecycleRunOwner({service,credentialForBinding:args=>{localBinding(args.binding);return credentialForBinding(args);}})};
  lifecycle={captureCheckpoint:async()=>{throw fault('NATIVE_SESSION_CONTINUATION_UNAVAILABLE');}};
 }
 const append=storageMethod(runOwner,'append');runOwner={...runOwner,async append(input){if(input.event.type==='run.status'&&input.event.data.state==='completed')await sdkSession?.settle(input.signal);return append(input);}};
  const prepareRuntime=async({binding:b,versions,model,signal,runtimeSignal,continuation,nextTurn,sourceRequest,request,scopes,skillPlugin})=>atRunnerStage('runtime-prepare',async()=>{if(canonicalSha256(versions)!==configuredVersionsSha256)throw fault('RUNNER_VERSION_REFUSED');if(continuation!==undefined&&nextTurn!==undefined)throw fault('RUNNER_RUNTIME_REFUSED');const lineage=nextTurn!==undefined?{nextTurn}:continuation!==undefined?{continuation}:null,resumed=lineage?{...lineage,sourceRequest,request,scopes}:{};markRunnerStage('runtime-admission');const r=await call('runner/runtime',{versions,...resumed},signal);own(r,['binding','versions','deadlineMs','maxOutputBytes'],[...(lineage===null?[]:['restoreReceipt']),...(sessionFactory===undefined?[]:['sdkSessionKey'])]);if(canonicalSha256(r.binding)!==canonicalSha256(b)||canonicalSha256(r.versions)!==configuredVersionsSha256)throw fault('RUNNER_RUNTIME_REFUSED');
  const local=stages?.local,localLife=local?createOperationLifetime({now,signal,deadlineMs:Math.min(now()+local.maxMs,local.expiresAtMs),errorFactory:fault}):null;
  try{return await (localLife?localLife.run:async fn=>fn(signal))(async localSignal=>{
  const {sdkSessionKey,...prepared}=r;own(model,['model','region','maxOutputTokens','usageBasis','maxTurns','maxCostMicroUSD']);const runtime={...prepared,...model};let sessionStore;
   markRunnerStage('sdk-session');if(sessionFactory!==undefined){if(sdkSessionKey===undefined||sdkSessionKey===null&&lineage!==null)throw fault('RUNNER_SDK_REGISTRATION_UNAVAILABLE');sessionStore=await sdkSession.prepare({binding:b,sessionKey:sdkSessionKey,signal:localSignal,...(lineage??{}),...(sdkSessionKey===null||lineage!==null?{runtimeSignal}:{})});}
  else sessionStore={load:key=>call('runner/session/load',{key}).then(v=>{own(v,['entries']);return v.entries;}),append:(key,entries)=>call('runner/session/append',{key,entries}).then(v=>{own(v,['committed']);if(v.committed!==true)throw fault('SESSION_PERSISTENCE_FAILED');})};
   markRunnerStage('sdk-directories');const directories=await ensureSdkConfigurationDirectories(sdkConfigurationDirectories(configuration));
  // G3: the read-only skill plugin copy under the admitted private config parent, one run-invariant path (sdkSkillPluginDirectory).
   markRunnerStage('skill-plugin');const plugin=skillPlugin===true&&directories.sdkConfigDirectory!==undefined?await prepareRunSkillPlugin(sdkSkillPluginDirectory(dirname(directories.sdkConfigDirectory))):undefined;
   markRunnerStage('activity');return {...runtime,cwd:configuration.workspace,sessionStore,...directories,...(plugin?{skillPluginDirectory:plugin.directory}:{})};});}finally{localLife?.close();}});
 // The activity bounds runtime preparation (the runner/runtime call, then the local stage); see ACTIVITY_PREPARATION_MAX_MS.
 const activity=createConversationActivity({runOwner,prepareRuntime,selectedSkills,now,...(stages?{loadMaxMs:stages.load.maxMs,loadExpiresAtMs:stages.load.expiresAtMs,runtimeMaxMs:Math.min(stages.runtime.maxMs+stages.local.maxMs,ACTIVITY_PREPARATION_MAX_MS),runtimeExpiresAtMs:stages.local.expiresAtMs,setupBudget:stages.setup,modelDeadlineMs:stages.session.expiresAtMs,executionDeadlineMs:stages.session.expiresAtMs+stages.session.maxMs,terminalAttemptMs:stages.session.maxMs}:{}),...(readPort?{generalReads:readPort}:{}),...(governedIntents?{governedIntents}:{}),...(query?{query}:{}),...(lifecycle?{lifecycle}:{}),heartbeat:()=>{},diagnostics:{stage:markRunnerStage,failure:captureRunnerFailure}});
  const execute=async input=>withRunnerDiagnostics(()=>atRunnerStage('activity',async()=>{try{return await activity(input);}catch(error){captureRunnerFailure(error);throw error;}finally{markRunnerStage('runner-cleanup');try{await selectedSkills.close();}finally{await sdkSession?.close();}}}),{binding,environment:configuration.telemetry?.environment});
 Object.defineProperty(execute,'cleanupStatus',{value:()=>sdkSession?.cleanupStatus()??{pendingInitializations:0,closed:true,failures:[],physicalStopProven:false}});return execute;
}
export async function assertRunnerWorkspace(configuration){const workspace=await lstat(configuration.workspace);if(process.getuid()===0||!workspace.isDirectory()||workspace.isSymbolicLink()||workspace.uid!==process.getuid()||await realpath(configuration.workspace)!==configuration.workspace)throw fault('RUNNER_WORKSPACE_REFUSED');}
export async function runConversation(configuration,{signal,query,sessionFactory,generalReads,governedIntents,poststartTls,nativeFetch}={}){
 return withRunnerDiagnostics(()=>atRunnerStage('runner-preflight',async()=>{
 const readPort=captureGeneralReadPort(generalReads,configuration.sourceEnabled);
 assertRunnerEnvironment();await assertRunnerWorkspace(configuration);
 const product=process.env.MERI_PRODUCT_PREVIEW_REQUIRED==='1';
 const initialPoststart=poststartTls!==undefined&&nativeFetch!==undefined&&configuration.bootstrap?.remote===true&&query===undefined&&product;
 const nestedPoststart=poststartTls===undefined&&nativeFetch!==undefined&&configuration.remoteTask?.tls!==undefined&&query!==undefined&&product&&configuration.remoteTask.processOrigin===configuration.native.origin;
 if(product&&!initialPoststart&&!nestedPoststart)throw fault('RUNNER_POSTSTART_REFUSED');
 if((poststartTls!==undefined||nativeFetch!==undefined)&&!initialPoststart&&!nestedPoststart)throw fault('RUNNER_POSTSTART_REFUSED');
 if(configuration.remoteTask&&query===undefined){
  if(poststartTls!==undefined||nativeFetch!==undefined)throw fault('RUNNER_POSTSTART_REFUSED');
   markRunnerStage('remote-module-import');const {runRemoteConversation}=await import('./remote-conversation-runner.mjs');
  return runRemoteConversation(configuration,{signal,...(readPort?{generalReads:readPort}:{}),...(sessionFactory?{sessionFactory}:{})});
 }
  markRunnerStage('capability-load');const startup=startupBudgetFor(configuration),bytes=await readSecret(configuration.native.capabilityFile),credential=bytes.toString('utf8').trim(),native=createNativeCapabilityClient({configuration:configuration.native,credential,...(startup?{loadMaxRequestMs:startup.stages.load.attemptMs}:{}),...(nativeFetch===undefined?{}:{fetch:nativeFetch})});
 if(configuration.bootstrap?.remote===true&&query===undefined){
   markRunnerStage('binding-bootstrap');const bootstrap=runnerStartupBudget({requestMs:configuration.limits.requestMs,shutdownMs:configuration.limits.shutdownMs,originalExpiresAtMs:configuration.bootstrap.expiresAtMs}).stages.bootstrap;const resolved=await loadRemoteTaskBinding({native,configuration,signal,startupBudget:bootstrap,...(poststartTls===undefined?{}:{poststartTls})});
   markRunnerStage('remote-module-import');const {runRemoteConversation}=await import('./remote-conversation-runner.mjs');
  return runRemoteConversation(resolved,{signal,...(nativeFetch===undefined?{}:{fetchImpl:nativeFetch,poststartNativeFetch:nativeFetch}),...(readPort?{generalReads:readPort}:{}),...(sessionFactory?{sessionFactory}:{})});
 }
 if(poststartTls!==undefined)throw fault('RUNNER_POSTSTART_REFUSED');
  if(configuration.bootstrap){markRunnerStage('admission-wait');await waitForAdmittedTask({native,binding:configuration.binding,versions:configuration.versions,deadlineMs:configuration.bootstrap.expiresAtMs,signal});}
  markRunnerStage('activity');
 const sessions=sessionFactory??createRuntimeSdkSessionFactory({origin:configuration.native.origin,credential,binding:configuration.binding});
  return assembleConversationRunner({configuration,native,credentialForBinding:async()=>credential,sessionFactory:sessions,...(readPort?{generalReads:readPort}:{}),...(governedIntents?{governedIntents}:{}),...(query?{query}:{})})({binding:configuration.binding,signal});
 }),{binding:configuration.binding,environment:configuration.telemetry?.environment});
}
