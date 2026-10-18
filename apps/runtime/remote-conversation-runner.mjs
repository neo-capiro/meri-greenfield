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
import {capabilityDigest,matchesCapability} from './native-authority/task-verifier.mjs';
import {remoteOriginal} from './native-authority/remote-task-boundary.mjs';
import {compileNativePreparationIntent} from './native-authority/preparation-intent.mjs';
import {listenRuntime} from './http-server.mjs';
import {createPreparedRunnerGate} from './native-authority/prepared-kickoff.mjs';
import {createPreparedRunnerGateApplication} from './native-authority/prepared-kickoff-http.mjs';
import {createNativePreparationClient} from './native-authority/preparation-http.mjs';
import {assertNativeExecution} from '../control/conversations/execution-boundary.mjs';
import {runConversation} from './conversation-runner.mjs';
import {captureGeneralReadPort} from './general-read-port.mjs';
import {createNativeReadsClient} from './native-authority/reads-client.mjs';
import {createRunnerIntentsClient} from './native-authority/intents-client.mjs';
import {loadRunnerHttpsMaterial} from './runner-https-material.mjs';
export async function runRemoteConversation(configuration,options={}){
 const {signal,fetchImpl=fetch,execute=runConversation,listen=listenRuntime,createWorker=createRemoteNativeWorker,sessionFactory,generalReads,poststartNativeFetch}=own(options,[],['signal','fetchImpl','execute','listen','createWorker','sessionFactory','generalReads','poststartNativeFetch']);nativeSignal(signal);
 const borrowedReads=captureGeneralReadPort(generalReads,configuration.sourceEnabled);
 const remote=own(configuration.remoteTask,['original','preparationIntent','taskArn','controlCapabilitySha256','processOrigin','http'],['preparedKickoff','approvedReads','tls']),original=remoteOriginal(remote.original),intent=compileNativePreparationIntent(remote.preparationIntent);
 if(hash(original.binding)!==hash(configuration.binding)||hash(original.versions)!==hash(configuration.versions)||intent.workspace!==configuration.workspace||[fetchImpl,execute,listen,createWorker,...(sessionFactory?[sessionFactory]:[])].some(v=>typeof v!=='function'||types.isProxy(v))||poststartNativeFetch!==undefined&&(poststartNativeFetch!==fetchImpl||process.env.MERI_PRODUCT_PREVIEW_REQUIRED!=='1'||remote.processOrigin!==configuration.native.origin))throw Error('REMOTE_RUNNER_CONFIGURATION');
 if(process.env.MERI_PRODUCT_PREVIEW_REQUIRED!==undefined&&(process.env.MERI_PRODUCT_PREVIEW_REQUIRED!=='1'||remote.tls===undefined))throw Error('REMOTE_RUNNER_TLS_REQUIRED');
 const tls=remote.tls===undefined?undefined:await loadRunnerHttpsMaterial({original,taskArn:remote.taskArn,tls:remote.tls});
 const credential=(await readSecret(configuration.native.capabilityFile)).toString('utf8').trim(),native=createNativeCapabilityClient({configuration:configuration.native,credential,fetch:fetchImpl}),client=createNativeSdkSessionClient({origin:configuration.native.origin,credential,binding:configuration.binding,fetchImpl});
 const readPort=borrowedReads??(configuration.sourceEnabled===true&&remote.approvedReads?.enabled===true?captureGeneralReadPort(createNativeReadsClient({origin:configuration.native.origin,credential,binding:configuration.binding,approvedReads:remote.approvedReads,fetchImpl}),true):undefined);
 // P-INT-9: governed intents reach control's task-authorized /v1/runner/intents/ route only when this run's remote task declares them.
 const intentPort=configuration.sourceEnabled===true&&remote.intents?.enabled===true?createRunnerIntentsClient({origin:configuration.native.origin,credential,binding:configuration.binding,fetchImpl,enabled:true}):undefined;
 const factory=sessionFactory??createRuntimeSdkSessionFactory({origin:configuration.native.origin,credential,binding:configuration.binding,fetchImpl}),mirror=createCheckpointSessionFactory({factory,client,binding:configuration.binding});let worker,listener,result,failure;const retirement=Promise.withResolvers();retirement.promise.catch(()=>{});let retired=false;const gate=remote.preparedKickoff===true?createPreparedRunnerGate({original,taskArn:remote.taskArn,authorizer:createNativePreparationClient({native}),enabled:true,maxWaitMs:Math.max(1,Math.min(1800000,original.expiresAtMs-Date.now()))}):null,gateApplication=gate?createPreparedRunnerGateApplication({gate,controlCapabilitySha256:remote.controlCapabilitySha256,enabled:true,maxRequestMs:configuration.limits.requestMs}):null;
 async function cleanup(method){const life=createOperationLifetime({now:Date.now,deadlineMs:Date.now()+configuration.limits.shutdownMs,errorFactory:()=>Error('REMOTE_RUNNER_CLEANUP_UNKNOWN')});try{await life.run(signal=>method({signal}));}finally{life.close();}}
 try{worker=createWorker({original,preparationIntent:intent,taskArn:remote.taskArn,controlCapabilitySha256:remote.controlCapabilitySha256,taskCapabilitySha256:capabilityDigest(credential),native,processTransport:{original,origin:remote.processOrigin,credential,fetchImpl},session:mirror.session,enabled:true,limits:{maxRequestMs:Math.min(configuration.limits.requestMs,30000)}});
  const handle=storageMethod(worker.application,'handle');async function receive(request){const response=(await gateApplication?.handle(request))??(await handle(request))??Response.json({error:{code:'NOT_FOUND'}},{status:404});if(gate&&new URL(request.url).pathname==='/v1/native-task/stop'&&request.headers.get('authorization')?.startsWith('Bearer ')&&matchesCapability(request.headers.get('authorization').slice(7),remote.controlCapabilitySha256)&&response.status===200){const body=await response.clone().json();if(hash(body.original)===hash(original)){let valid=false;if(body.receipt?.notAllocated===true){const receipt=own(body.receipt,['physicalStopProven','notAllocated']);valid=receipt.physicalStopProven===false;}else{const receipt=assertNativeExecution(body.receipt,original);valid=receipt.state==='stopped'&&receipt.physicalStopProven===true;}if(valid){retired=true;retirement.resolve();}}}return response;}listener=await listen({configuration:{...configuration,http:remote.http},application:{handle:receive},readiness:async()=>{if(signal?.aborted)throw Error('REMOTE_RUNNER_STOPPED');},...(tls?{tls}:{})});
  await gate?.wait({signal});result=await execute({...configuration,captureOwnsClose:true},{signal,query:worker.query,sessionFactory:mirror.factory,...(readPort?{generalReads:readPort}:{}),...(intentPort?{governedIntents:intentPort}:{}),...(poststartNativeFetch?{nativeFetch:poststartNativeFetch}:{})});
 }catch(error){failure=error;}finally{gate?.close();const errors=[];if(worker)try{await cleanup(storageMethod(worker,'close'));}catch(error){errors.push(error);}try{await cleanup(mirror.session.close);}catch(error){errors.push(error);}if(gate&&listener&&!retired){const life=createOperationLifetime({now:Date.now,deadlineMs:Math.max(Date.now()+1,original.expiresAtMs+configuration.limits.shutdownMs),errorFactory:()=>Error('REMOTE_RUNNER_RETIREMENT_UNKNOWN')});try{await life.run(()=>retirement.promise);}catch(error){errors.push(error);}finally{life.close();}}if(listener)try{await cleanup(storageMethod(listener,'close'));}catch(error){errors.push(error);}if(errors.length)failure=new AggregateError([...(failure?[failure]:[]),...errors],'REMOTE_RUNNER_CLEANUP_UNKNOWN');}
 if(failure)throw failure;return result;
}
