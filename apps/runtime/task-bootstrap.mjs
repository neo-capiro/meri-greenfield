/** A preallocated task performs no SDK/tool work until its original runtime is admitted. */
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {own,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {validateConfiguration,fault} from './config.mjs';
export async function waitForAdmittedTask({native,binding,versions,deadlineMs,signal,now=Date.now,pollMs=100}){
 nativeSignal(signal);if(!Number.isSafeInteger(deadlineMs)||deadlineMs<=now()||!Number.isSafeInteger(pollMs)||pollMs<10||pollMs>1000)throw fault('TASK_BOOTSTRAP_REFUSED');
 const life=createOperationLifetime({now,signal,deadlineMs,errorFactory:()=>fault('TASK_BOOTSTRAP_REFUSED')});
 try{while(true){life.check();let runtime;try{const saved=await life.run(signal=>native.call('runner/load',{binding},{signal,deadlineMs}));if(hash(saved.run.binding)!==hash(binding)||hash(saved.run.versions)!==hash(versions))throw fault('TASK_BOOTSTRAP_BINDING_REFUSED');const resumed=saved.continuation?{continuation:saved.continuation,sourceRequest:saved.sourceRequest,request:saved.request,scopes:saved.run.scopes}:{};runtime=await life.run(signal=>native.call('runner/runtime',{binding,versions,...resumed},{signal,deadlineMs}));}catch(error){if(error?.code==='TASK_BOOTSTRAP_BINDING_REFUSED')throw error;life.check();}
  if(runtime){own(runtime,['binding','versions','proxyUrl','proxyCredential','model','deadlineMs','maxTurns','maxCostMicroUSD','maxOutputBytes'],['sdkSessionKey','restoreReceipt']);if(hash(runtime.binding)!==hash(binding)||hash(runtime.versions)!==hash(versions)||!Number.isSafeInteger(runtime.deadlineMs)||runtime.deadlineMs<=now()||runtime.deadlineMs>deadlineMs)throw fault('TASK_BOOTSTRAP_REFUSED');return;}
  await life.run(()=>new Promise(resolve=>setTimeout(resolve,pollMs)));
 }}finally{life.close();}
}

/** Resolve only the admitted original task's private binding; no extra credential. */
export async function loadRemoteTaskBinding({native,configuration,signal,now=Date.now,pollMs=100}){
 const deadlineMs=configuration.bootstrap.expiresAtMs;nativeSignal(signal);if(!Number.isSafeInteger(deadlineMs)||deadlineMs<=now()||!Number.isSafeInteger(pollMs)||pollMs<10||pollMs>1000)throw fault('TASK_BOOTSTRAP_REFUSED');
 const life=createOperationLifetime({now,signal,deadlineMs,errorFactory:()=>fault('TASK_BOOTSTRAP_REFUSED')});
 try{while(true){life.check();let binding;try{binding=await life.run(signal=>native.call('runner/native/bootstrap',{binding:configuration.binding,versions:configuration.versions},{signal,deadlineMs}));}catch{life.check();}
  if(binding){const remote=own(binding,['original','preparationIntent','taskArn','controlCapabilitySha256','processOrigin','http'],['preparedKickoff']);if(remote.original.expiresAtMs!==deadlineMs)throw fault('TASK_BOOTSTRAP_REFUSED');const {bootstrap,...rest}=configuration;return validateConfiguration({...rest,remoteTask:remote},'conversation-runner');}
  await life.run(()=>new Promise(resolve=>setTimeout(resolve,pollMs)));
 }}finally{life.close();}
}
