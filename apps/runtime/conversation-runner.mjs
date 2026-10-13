/** One isolated task, one run, canonical SDK activity. No Temporal or DB credentials. */
import {createConversationActivity} from '../worker/conversation/activity.mjs';
import {canonicalSha256,validateShape} from '../../packages/contracts/validate.mjs';
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {readSecret,fault} from './config.mjs';
import {createNativeCapabilityClient} from './native-client.mjs';
import {lstat,realpath} from 'node:fs/promises';
import {createLifecycleRunOwner} from '../control/conversations/lifecycle/worker-owner.mjs';
export function assertRunnerEnvironment(environment=process.env){for(const key of ['DATABASE_URL','PGPASSWORD','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN','ANTHROPIC_API_KEY','CLAUDE_CODE_OAUTH_TOKEN','TEMPORAL_API_KEY','MERI_NATIVE_ADMIN_TOKEN','CLAUDE_CODE_USE_BEDROCK','CLAUDE_CODE_USE_VERTEX','CLAUDE_CODE_USE_FOUNDRY','ANTHROPIC_AWS_BEARER_TOKEN','ANTHROPIC_AWS_REGION'])if(environment[key])throw fault('RUNNER_AMBIENT_CREDENTIAL_REFUSED');}
export function assembleConversationRunner({configuration,native,query,credentialForBinding}){
 validateShape('RuntimeVersions',configuration.versions);const configuredVersionsSha256=canonicalSha256(configuration.versions);
 const binding=configuration.binding,call=(operation,input,signal)=>native.call(operation,{binding,...input},{signal});
 const localBinding=b=>{if(canonicalSha256(b)!==canonicalSha256(binding))throw fault('RUNNER_BINDING_REFUSED');};
 let runOwner={load:({binding:b,signal})=>{localBinding(b);return call('runner/load',{},signal);},append:({binding:b,event,signal})=>{localBinding(b);return call('runner/publish',{event},signal);}},lifecycle;
 if(credentialForBinding!==undefined){
  if(typeof credentialForBinding!=='function')throw fault('RUNNER_CREDENTIAL_CONFIGURATION');
  const forward=operation=>({binding:b,credential,signal,...input})=>{localBinding(b);return call(operation,input,signal);};
  const service={loadForExecution:forward('runner/load'),publish:forward('runner/publish'),nextControls:forward('runner/next-controls'),claimControl:forward('runner/claim-control'),ackControl:forward('runner/ack-control'),recordCheckpoint:forward('runner/record-checkpoint')};
  runOwner=createLifecycleRunOwner({service,credentialForBinding:args=>{localBinding(args.binding);return credentialForBinding(args);}});
  lifecycle={captureCheckpoint:({binding:b,signal,...input})=>{localBinding(b);return call('runner/checkpoint/capture',input,signal);}};
 }
 const prepareRuntime=async({binding:b,versions,signal,continuation,sourceRequest,request,scopes})=>{if(canonicalSha256(versions)!==configuredVersionsSha256)throw fault('RUNNER_VERSION_REFUSED');const resumed=continuation!==undefined?{continuation,sourceRequest,request,scopes}:{};const r=await call('runner/runtime',{versions,...resumed},signal);own(r,['binding','versions','proxyUrl','proxyCredential','model','deadlineMs','maxTurns','maxCostMicroUSD','maxOutputBytes'],continuation===undefined?[]:['restoreReceipt']);if(canonicalSha256(r.binding)!==canonicalSha256(b)||canonicalSha256(r.versions)!==configuredVersionsSha256||new URL(r.proxyUrl).origin!==configuration.proxyOrigin)throw fault('RUNNER_RUNTIME_REFUSED');return {...r,cwd:configuration.workspace,sessionStore:{load:key=>call('runner/session/load',{key}).then(v=>{own(v,['entries']);return v.entries;}),append:(key,entries)=>call('runner/session/append',{key,entries}).then(v=>{own(v,['committed']);if(v.committed!==true)throw fault('SESSION_PERSISTENCE_FAILED');})}};};
 // No selected-skills/lifecycle adapter is silently invented. Canonical activity
 // refuses selected originals against their preservation catalog until mounted.
 return createConversationActivity({runOwner,prepareRuntime,...(query?{query}:{}),...(lifecycle?{lifecycle}:{}),heartbeat:()=>{}});
}
export async function runConversation(configuration,{signal,query}={}){assertRunnerEnvironment();const workspace=await lstat(configuration.workspace);if(process.getuid()===0||!workspace.isDirectory()||workspace.isSymbolicLink()||workspace.uid!==process.getuid()||await realpath(configuration.workspace)!==configuration.workspace)throw fault('RUNNER_WORKSPACE_REFUSED');const bytes=await readSecret(configuration.native.capabilityFile),credential=bytes.toString('utf8').trim(),native=createNativeCapabilityClient({configuration:configuration.native,credential});return assembleConversationRunner({configuration,native,credentialForBinding:async()=>credential,...(query?{query}:{})})({binding:configuration.binding,signal});}
