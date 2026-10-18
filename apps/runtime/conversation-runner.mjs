/** One isolated task, one run, canonical SDK activity. No Temporal or DB credentials. */
import {createConversationActivity} from '../worker/conversation/activity.mjs';
import {canonicalSha256,validateShape} from '../../packages/contracts/validate.mjs';
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {readSecret,fault} from './config.mjs';
import {createNativeCapabilityClient} from './native-client.mjs';
import {lstat,realpath,mkdir,open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,dirname,isAbsolute} from 'node:path';
import {compileNativePreparationIntent,RUNNER_SDK_CA_FILE} from './native-authority/preparation-intent.mjs';
import {createLifecycleRunOwner} from '../control/conversations/lifecycle/worker-owner.mjs';
import {createTaskSelectedSkills} from './selected/task.mjs';
import {createRuntimeSdkSessionFactory,createOwnedRuntimeSdkSession} from './sdk-session-runtime.mjs';
import {waitForAdmittedTask,loadRemoteTaskBinding} from './task-bootstrap.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {captureGeneralReadPort} from './general-read-port.mjs';
export function assertRunnerEnvironment(environment=process.env){for(const key of ['DATABASE_URL','PGPASSWORD','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN','ANTHROPIC_API_KEY','CLAUDE_CODE_OAUTH_TOKEN','TEMPORAL_API_KEY','MERI_NATIVE_ADMIN_TOKEN','CLAUDE_CODE_USE_BEDROCK','CLAUDE_CODE_USE_VERTEX','CLAUDE_CODE_USE_FOUNDRY','ANTHROPIC_AWS_BEARER_TOKEN','ANTHROPIC_AWS_REGION'])if(environment[key])throw fault('RUNNER_AMBIENT_CREDENTIAL_REFUSED');}
/** Per-run SDK configuration directories under the admitted preparation intent; absent outside the remote task path.
 * The SDK subprocess environment replaces (never inherits) process.env, so its one extra TLS anchor comes from the same
 * admitted launch template: only the pinned runner CA path, required on the product path where the proxy cert is private. */
export function sdkConfigurationDirectories(configuration,environment=process.env){
 if(configuration.remoteTask===undefined)return {};
 const intent=compileNativePreparationIntent(configuration.remoteTask.preparationIntent),ca=intent.launchTemplate.env.NODE_EXTRA_CA_CERTS;
 if(ca!==undefined&&ca!==RUNNER_SDK_CA_FILE||ca===undefined&&environment.MERI_PRODUCT_PREVIEW_REQUIRED==='1')throw fault('RUNNER_SDK_CA_REFUSED');
 return {sdkConfigDirectory:join(intent.configParentDirectory,'sdk-'+configuration.binding.runId),sdkSecureStorageDirectory:intent.secureStorageDirectory,...(ca===undefined?{}:{sdkCaFile:ca})};
}
/** The SDK CA file must be the exact pinned control CA the poststart owner wrote: a regular, private, symlink-free file owned by
 * this uid whose bytes match MERI_POSTSTART_CA_SHA256. Checked before SDK initialization; never an arbitrary readable path. */
export async function assertPinnedSdkCaFile(path,{uid,expectedSha256}){
 const refuse=()=>{throw fault('RUNNER_SDK_CA_REFUSED');};
 if(typeof path!=='string'||!isAbsolute(path)||!Number.isSafeInteger(uid)||uid<0||typeof expectedSha256!=='string'||!/^[a-f0-9]{64}$/u.test(expectedSha256))refuse();
 let handle;try{const before=await lstat(path);if(before.isSymbolicLink()||!before.isFile()||before.uid!==uid||(before.mode&0o077)!==0||before.size<1||before.size>16384||await realpath(path)!==path)refuse();
  handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);const stat=await handle.stat(),bytes=await handle.readFile();
  if(stat.ino!==before.ino||stat.dev!==before.dev||bytes.length!==stat.size||createHash('sha256').update(bytes).digest('hex')!==expectedSha256)refuse();
 }catch(error){if(error?.code==='RUNNER_SDK_CA_REFUSED')throw error;refuse();}finally{await handle?.close();}
}
/** A directory the SDK may use only if it is a real directory owned by this task's uid, private to it, and reached without symlinks. */
async function assertOwnedPrivateDirectory(path,uid){let stat;try{stat=await lstat(path);}catch{throw fault('RUNNER_SDK_DIRECTORY_REFUSED');}if(stat.isSymbolicLink()||!stat.isDirectory()||stat.uid!==uid||(stat.mode&0o077)!==0||await realpath(path)!==path)throw fault('RUNNER_SDK_DIRECTORY_REFUSED');}
/** The config directory is fresh per run (an existing one refuses); secure storage may pre-exist. Parents and both directories are verified owned, private and symlink-free before any SDK initialization. */
export async function ensureSdkConfigurationDirectories(directories,options={}){
 if(directories.sdkConfigDirectory===undefined)return directories;
 const uid=options.uid??process.getuid?.();if(!Number.isSafeInteger(uid)||uid<0)throw fault('RUNNER_SDK_DIRECTORY_REFUSED');
 const {sdkConfigDirectory,sdkSecureStorageDirectory,sdkCaFile}=directories;
 if(sdkCaFile!==undefined)await assertPinnedSdkCaFile(sdkCaFile,{uid,expectedSha256:(options.environment??process.env).MERI_POSTSTART_CA_SHA256});
 await assertOwnedPrivateDirectory(dirname(sdkConfigDirectory),uid);
 try{await mkdir(sdkConfigDirectory,{mode:0o700});}catch{throw fault('RUNNER_SDK_DIRECTORY_REFUSED');}
 await assertOwnedPrivateDirectory(sdkConfigDirectory,uid);
 await assertOwnedPrivateDirectory(dirname(sdkSecureStorageDirectory),uid);
 try{await mkdir(sdkSecureStorageDirectory,{mode:0o700});}catch(error){if(error?.code!=='EEXIST')throw fault('RUNNER_SDK_DIRECTORY_REFUSED');}
 await assertOwnedPrivateDirectory(sdkSecureStorageDirectory,uid);
 return directories;
}
export function assembleConversationRunner({configuration,native,query,credentialForBinding,sessionFactory,generalReads,now=Date.now}){
 const readPort=captureGeneralReadPort(generalReads,configuration.sourceEnabled);
 validateShape('RuntimeVersions',configuration.versions);const configuredVersionsSha256=canonicalSha256(configuration.versions);
 const binding=configuration.binding,call=(operation,input,signal)=>native.call(operation,{binding,...input},{signal});
 if(sessionFactory!==undefined&&typeof sessionFactory!=='function')throw fault('RUNNER_SESSION_CONFIGURATION');
 const selectedSkills=createTaskSelectedSkills({native,now,sourceEnabled:configuration.sourceEnabled??false}),sdkSession=sessionFactory===undefined?null:createOwnedRuntimeSdkSession({factory:sessionFactory,now,cleanupMs:configuration.limits?.shutdownMs??1000});
 const localBinding=b=>{if(canonicalSha256(b)!==canonicalSha256(binding))throw fault('RUNNER_BINDING_REFUSED');};
 let runOwner={load:({binding:b,signal})=>{localBinding(b);return call('runner/load',{},signal);},append:({binding:b,event,signal})=>{localBinding(b);return call('runner/publish',{event},signal);}},lifecycle;
 if(credentialForBinding!==undefined){
  if(typeof credentialForBinding!=='function')throw fault('RUNNER_CREDENTIAL_CONFIGURATION');
  const forward=operation=>({binding:b,credential,signal,...input})=>{localBinding(b);return call(operation,input,signal);};
  const service={loadForExecution:forward('runner/load'),publish:forward('runner/publish'),nextControls:forward('runner/next-controls'),claimControl:forward('runner/claim-control'),ackControl:forward('runner/ack-control'),recordCheckpoint:forward('runner/record-checkpoint')};
  runOwner=createLifecycleRunOwner({service,credentialForBinding:args=>{localBinding(args.binding);return credentialForBinding(args);}});
  lifecycle={captureOwnsClose:configuration.captureOwnsClose??false,captureCheckpoint:({binding:b,signal,...input})=>{localBinding(b);return call('runner/checkpoint/capture',input,signal);},captureCompletion:async({binding:b,signal,...input})=>{localBinding(b);await sdkSession?.settle(signal);return call('runner/checkpoint/complete',input,signal);}};
 }
 const append=storageMethod(runOwner,'append');runOwner={...runOwner,async append(input){if(input.event.type==='run.status'&&input.event.data.state==='completed')await sdkSession?.settle(input.signal);return append(input);}};
 const prepareRuntime=async({binding:b,versions,signal,runtimeSignal,continuation,nextTurn,sourceRequest,request,scopes})=>{if(canonicalSha256(versions)!==configuredVersionsSha256)throw fault('RUNNER_VERSION_REFUSED');if(continuation!==undefined&&nextTurn!==undefined)throw fault('RUNNER_RUNTIME_REFUSED');const lineage=nextTurn!==undefined?{nextTurn}:continuation!==undefined?{continuation}:null,resumed=lineage?{...lineage,sourceRequest,request,scopes}:{};const r=await call('runner/runtime',{versions,...resumed},signal);own(r,['binding','versions','proxyUrl','proxyCredential','model','deadlineMs','maxTurns','maxCostMicroUSD','maxOutputBytes'],[...(lineage===null?[]:['restoreReceipt']),...(sessionFactory===undefined?[]:['sdkSessionKey'])]);if(canonicalSha256(r.binding)!==canonicalSha256(b)||canonicalSha256(r.versions)!==configuredVersionsSha256||new URL(r.proxyUrl).origin!==configuration.proxyOrigin)throw fault('RUNNER_RUNTIME_REFUSED');
  const {sdkSessionKey,...runtime}=r;let sessionStore;
  if(sessionFactory!==undefined){if(sdkSessionKey===undefined||sdkSessionKey===null&&lineage!==null)throw fault('RUNNER_SDK_REGISTRATION_UNAVAILABLE');sessionStore=await sdkSession.prepare({binding:b,sessionKey:sdkSessionKey,signal,...(lineage??{}),...(sdkSessionKey===null||lineage!==null?{runtimeSignal}:{})});}
  else sessionStore={load:key=>call('runner/session/load',{key}).then(v=>{own(v,['entries']);return v.entries;}),append:(key,entries)=>call('runner/session/append',{key,entries}).then(v=>{own(v,['committed']);if(v.committed!==true)throw fault('SESSION_PERSISTENCE_FAILED');})};
  const directories=await ensureSdkConfigurationDirectories(sdkConfigurationDirectories(configuration));
  return {...runtime,cwd:configuration.workspace,sessionStore,...directories};};
 const activity=createConversationActivity({runOwner,prepareRuntime,selectedSkills,now,...(readPort?{generalReads:readPort}:{}),...(query?{query}:{}),...(lifecycle?{lifecycle}:{}),heartbeat:()=>{}});
 const execute=async input=>{try{return await activity(input);}finally{try{await selectedSkills.close();}finally{await sdkSession?.close();}}};
 Object.defineProperty(execute,'cleanupStatus',{value:()=>sdkSession?.cleanupStatus()??{pendingInitializations:0,closed:true,failures:[],physicalStopProven:false}});return execute;
}
export async function assertRunnerWorkspace(configuration){const workspace=await lstat(configuration.workspace);if(process.getuid()===0||!workspace.isDirectory()||workspace.isSymbolicLink()||workspace.uid!==process.getuid()||await realpath(configuration.workspace)!==configuration.workspace)throw fault('RUNNER_WORKSPACE_REFUSED');}
export async function runConversation(configuration,{signal,query,sessionFactory,generalReads,poststartTls,nativeFetch}={}){
 const readPort=captureGeneralReadPort(generalReads,configuration.sourceEnabled);
 assertRunnerEnvironment();await assertRunnerWorkspace(configuration);
 const product=process.env.MERI_PRODUCT_PREVIEW_REQUIRED==='1';
 const initialPoststart=poststartTls!==undefined&&nativeFetch!==undefined&&configuration.bootstrap?.remote===true&&query===undefined&&product;
 const nestedPoststart=poststartTls===undefined&&nativeFetch!==undefined&&configuration.remoteTask?.tls!==undefined&&query!==undefined&&product&&configuration.remoteTask.processOrigin===configuration.native.origin;
 if(product&&!initialPoststart&&!nestedPoststart)throw fault('RUNNER_POSTSTART_REFUSED');
 if((poststartTls!==undefined||nativeFetch!==undefined)&&!initialPoststart&&!nestedPoststart)throw fault('RUNNER_POSTSTART_REFUSED');
 if(configuration.remoteTask&&query===undefined){
  if(poststartTls!==undefined||nativeFetch!==undefined)throw fault('RUNNER_POSTSTART_REFUSED');
  const {runRemoteConversation}=await import('./remote-conversation-runner.mjs');
  return runRemoteConversation(configuration,{signal,...(readPort?{generalReads:readPort}:{}),...(sessionFactory?{sessionFactory}:{})});
 }
 const bytes=await readSecret(configuration.native.capabilityFile),credential=bytes.toString('utf8').trim(),native=createNativeCapabilityClient({configuration:configuration.native,credential,...(nativeFetch===undefined?{}:{fetch:nativeFetch})});
 if(configuration.bootstrap?.remote===true&&query===undefined){
  const resolved=await loadRemoteTaskBinding({native,configuration,signal,...(poststartTls===undefined?{}:{poststartTls})});
  const {runRemoteConversation}=await import('./remote-conversation-runner.mjs');
  return runRemoteConversation(resolved,{signal,...(nativeFetch===undefined?{}:{fetchImpl:nativeFetch,poststartNativeFetch:nativeFetch}),...(readPort?{generalReads:readPort}:{}),...(sessionFactory?{sessionFactory}:{})});
 }
 if(poststartTls!==undefined)throw fault('RUNNER_POSTSTART_REFUSED');
 if(configuration.bootstrap)await waitForAdmittedTask({native,binding:configuration.binding,versions:configuration.versions,deadlineMs:configuration.bootstrap.expiresAtMs,signal});
 const sessions=sessionFactory??createRuntimeSdkSessionFactory({origin:configuration.native.origin,credential,binding:configuration.binding});
 return assembleConversationRunner({configuration,native,credentialForBinding:async()=>credential,sessionFactory:sessions,...(readPort?{generalReads:readPort}:{}),...(query?{query}:{})})({binding:configuration.binding,signal});
}
