/** One isolated task, one run, canonical SDK activity. No Temporal or DB credentials. */
import {createConversationActivity} from '../worker/conversation/activity.mjs';
import {canonicalSha256,validateShape} from '../../packages/contracts/validate.mjs';
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {readSecret,fault} from './config.mjs';
import {createNativeCapabilityClient} from './native-client.mjs';
import {lstat,realpath} from 'node:fs/promises';
import {createLifecycleRunOwner} from '../control/conversations/lifecycle/worker-owner.mjs';
import {createTaskSelectedSkills} from './selected/task.mjs';
import {createRuntimeSdkSessionFactory,createOwnedRuntimeSdkSession} from './sdk-session-runtime.mjs';
import {waitForAdmittedTask} from './task-bootstrap.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
export function assertRunnerEnvironment(environment=process.env){for(const key of ['DATABASE_URL','PGPASSWORD','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN','ANTHROPIC_API_KEY','CLAUDE_CODE_OAUTH_TOKEN','TEMPORAL_API_KEY','MERI_NATIVE_ADMIN_TOKEN','CLAUDE_CODE_USE_BEDROCK','CLAUDE_CODE_USE_VERTEX','CLAUDE_CODE_USE_FOUNDRY','ANTHROPIC_AWS_BEARER_TOKEN','ANTHROPIC_AWS_REGION'])if(environment[key])throw fault('RUNNER_AMBIENT_CREDENTIAL_REFUSED');}
export function assembleConversationRunner({configuration,native,query,credentialForBinding,sessionFactory,now=Date.now}){
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
  lifecycle={captureOwnsClose:configuration.captureOwnsClose??false,captureCheckpoint:({binding:b,signal,...input})=>{localBinding(b);return call('runner/checkpoint/capture',input,signal);}};
 }
 const append=storageMethod(runOwner,'append');runOwner={...runOwner,async append(input){if(input.event.type==='run.status'&&input.event.data.state==='completed')await sdkSession?.settle(input.signal);return append(input);}};
 const prepareRuntime=async({binding:b,versions,signal,runtimeSignal,continuation,sourceRequest,request,scopes})=>{if(canonicalSha256(versions)!==configuredVersionsSha256)throw fault('RUNNER_VERSION_REFUSED');const resumed=continuation!==undefined?{continuation,sourceRequest,request,scopes}:{};const r=await call('runner/runtime',{versions,...resumed},signal);own(r,['binding','versions','proxyUrl','proxyCredential','model','deadlineMs','maxTurns','maxCostMicroUSD','maxOutputBytes'],[...(continuation===undefined?[]:['restoreReceipt']),...(sessionFactory===undefined?[]:['sdkSessionKey'])]);if(canonicalSha256(r.binding)!==canonicalSha256(b)||canonicalSha256(r.versions)!==configuredVersionsSha256||new URL(r.proxyUrl).origin!==configuration.proxyOrigin)throw fault('RUNNER_RUNTIME_REFUSED');
  const {sdkSessionKey,...runtime}=r;let sessionStore;
  if(sessionFactory!==undefined){if(sdkSessionKey===undefined||sdkSessionKey===null&&continuation!==undefined)throw fault('RUNNER_SDK_REGISTRATION_UNAVAILABLE');sessionStore=await sdkSession.prepare({binding:b,sessionKey:sdkSessionKey,signal,continuation,...(sdkSessionKey===null||continuation!==undefined?{runtimeSignal}:{})});}
  else sessionStore={load:key=>call('runner/session/load',{key}).then(v=>{own(v,['entries']);return v.entries;}),append:(key,entries)=>call('runner/session/append',{key,entries}).then(v=>{own(v,['committed']);if(v.committed!==true)throw fault('SESSION_PERSISTENCE_FAILED');})};
  return {...runtime,cwd:configuration.workspace,sessionStore};};
 const activity=createConversationActivity({runOwner,prepareRuntime,selectedSkills,now,...(query?{query}:{}),...(lifecycle?{lifecycle}:{}),heartbeat:()=>{}});
 const execute=async input=>{try{return await activity(input);}finally{try{await selectedSkills.close();}finally{await sdkSession?.close();}}};
 Object.defineProperty(execute,'cleanupStatus',{value:()=>sdkSession?.cleanupStatus()??{pendingInitializations:0,closed:true,failures:[],physicalStopProven:false}});return execute;
}
export async function runConversation(configuration,{signal,query,sessionFactory}={}){assertRunnerEnvironment();const workspace=await lstat(configuration.workspace);if(process.getuid()===0||!workspace.isDirectory()||workspace.isSymbolicLink()||workspace.uid!==process.getuid()||await realpath(configuration.workspace)!==configuration.workspace)throw fault('RUNNER_WORKSPACE_REFUSED');const bytes=await readSecret(configuration.native.capabilityFile),credential=bytes.toString('utf8').trim(),native=createNativeCapabilityClient({configuration:configuration.native,credential});if(configuration.bootstrap)await waitForAdmittedTask({native,binding:configuration.binding,versions:configuration.versions,deadlineMs:configuration.bootstrap.expiresAtMs,signal});const sessions=sessionFactory??createRuntimeSdkSessionFactory({origin:configuration.native.origin,credential,binding:configuration.binding});return assembleConversationRunner({configuration,native,credentialForBinding:async()=>credential,sessionFactory:sessions,...(query?{query}:{})})({binding:configuration.binding,signal});}
