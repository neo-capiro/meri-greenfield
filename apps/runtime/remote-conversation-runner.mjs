import {types} from 'node:util';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
/** Existing conversation role, with one task-local Query and live private receiver. */
import {own,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {readSecret} from './config.mjs';
import {createNativeCapabilityClient} from './native-client.mjs';
import {createNativeSdkSessionClient} from './native-authority/session-client.mjs';
import {createRuntimeSdkSessionFactory} from './sdk-session-runtime.mjs';
import {createCheckpointSessionFactory} from './checkpoint-session-factory.mjs';
import {createRemoteNativeWorker} from './native-authority/remote-composition.mjs';
import {capabilityDigest} from './native-authority/task-verifier.mjs';
import {remoteOriginal} from './native-authority/remote-task-boundary.mjs';
import {compileNativePreparationIntent} from './native-authority/preparation-intent.mjs';
import {listenRuntime} from './http-server.mjs';
import {runConversation} from './conversation-runner.mjs';
export async function runRemoteConversation(configuration,options={}){
 const {signal,fetchImpl=fetch,execute=runConversation,listen=listenRuntime,createWorker=createRemoteNativeWorker,sessionFactory}=own(options,[],['signal','fetchImpl','execute','listen','createWorker','sessionFactory']);nativeSignal(signal);
 const remote=own(configuration.remoteTask,['original','preparationIntent','taskArn','controlCapabilitySha256','processOrigin','http']),original=remoteOriginal(remote.original),intent=compileNativePreparationIntent(remote.preparationIntent);
 if(hash(original.binding)!==hash(configuration.binding)||hash(original.versions)!==hash(configuration.versions)||intent.workspace!==configuration.workspace||[fetchImpl,execute,listen,createWorker,...(sessionFactory?[sessionFactory]:[])].some(v=>typeof v!=='function'||types.isProxy(v)))throw Error('REMOTE_RUNNER_CONFIGURATION');
 const credential=(await readSecret(configuration.native.capabilityFile)).toString('utf8').trim(),native=createNativeCapabilityClient({configuration:configuration.native,credential,fetch:fetchImpl}),client=createNativeSdkSessionClient({origin:configuration.native.origin,credential,binding:configuration.binding,fetchImpl});
 const factory=sessionFactory??createRuntimeSdkSessionFactory({origin:configuration.native.origin,credential,binding:configuration.binding,fetchImpl}),mirror=createCheckpointSessionFactory({factory,client,binding:configuration.binding});let worker,listener,result,failure;
 async function cleanup(method){const life=createOperationLifetime({now:Date.now,deadlineMs:Date.now()+configuration.limits.shutdownMs,errorFactory:()=>Error('REMOTE_RUNNER_CLEANUP_UNKNOWN')});try{await life.run(signal=>method({signal}));}finally{life.close();}}
 try{worker=createWorker({original,preparationIntent:intent,taskArn:remote.taskArn,controlCapabilitySha256:remote.controlCapabilitySha256,taskCapabilitySha256:capabilityDigest(credential),native,processTransport:{original,origin:remote.processOrigin,credential,fetchImpl},session:mirror.session,enabled:true,limits:{maxRequestMs:Math.min(configuration.limits.requestMs,30000)}});
  const handle=storageMethod(worker.application,'handle');listener=await listen({configuration:{...configuration,http:remote.http},application:{handle:async request=>(await handle(request))??Response.json({error:{code:'NOT_FOUND'}},{status:404})},readiness:async()=>{if(signal?.aborted)throw Error('REMOTE_RUNNER_STOPPED');}});
  result=await execute({...configuration,captureOwnsClose:true},{signal,query:worker.query,sessionFactory:mirror.factory});
 }catch(error){failure=error;}finally{const errors=[];if(worker)try{await cleanup(storageMethod(worker,'close'));}catch(error){errors.push(error);}try{await cleanup(mirror.session.close);}catch(error){errors.push(error);}if(listener)try{await cleanup(storageMethod(listener,'close'));}catch(error){errors.push(error);}if(errors.length)failure=new AggregateError([...(failure?[failure]:[]),...errors],'REMOTE_RUNNER_CLEANUP_UNKNOWN');}
 if(failure)throw failure;return result;
}
