import {types} from 'node:util';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
/** Existing conversation role, with one task-local Query and live private receiver. */
import {own,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {readSecret} from './config.mjs';
import {createNativeCapabilityClient} from './native-client.mjs';
import {createRuntimeSdkSessionFactory} from './sdk-session-runtime.mjs';
import {remoteOriginal} from './native-authority/remote-task-boundary.mjs';
import {compileNativePreparationIntent} from './native-authority/preparation-intent.mjs';
import {listenRuntime} from './http-server.mjs';
import {createPreparedRunnerGate} from './native-authority/prepared-kickoff.mjs';
import {createPreparedRunnerGateApplication} from './native-authority/prepared-kickoff-http.mjs';
import {createNativePreparationClient} from './native-authority/preparation-http.mjs';
import {runnerStartupBudget} from '../../packages/runtime/runner-load-budget.mjs';
import {runConversation} from './conversation-runner.mjs';
import {sdkQuery} from '../worker/conversation/activity.mjs';
import {captureGeneralReadPort} from './general-read-port.mjs';
import {createNativeReadsClient} from './native-authority/reads-client.mjs';
import {createRunnerIntentsClient} from './native-authority/intents-client.mjs';
import {loadRunnerHttpsMaterial} from './runner-https-material.mjs';
import {atRunnerStage,markRunnerStage,captureRunnerFailure,withRunnerDiagnostics} from './runner-runtime-diagnostics.mjs';
export async function runRemoteConversation(configuration,options={}){
 return withRunnerDiagnostics(()=>atRunnerStage('remote-config',async()=>{
 const {signal,fetchImpl=fetch,execute=runConversation,listen=listenRuntime,query=sdkQuery,sessionFactory,generalReads,poststartNativeFetch}=own(options,[],['signal','fetchImpl','execute','listen','query','sessionFactory','generalReads','poststartNativeFetch']);nativeSignal(signal);
 const borrowedReads=captureGeneralReadPort(generalReads,configuration.sourceEnabled);
 const remote=own(configuration.remoteTask,['original','preparationIntent','taskArn','controlCapabilitySha256','processOrigin','http'],['preparedKickoff','approvedReads','tls','intents']),original=remoteOriginal(remote.original),intent=compileNativePreparationIntent(remote.preparationIntent);
 if(hash(original.binding)!==hash(configuration.binding)||hash(original.versions)!==hash(configuration.versions)||intent.workspace!==configuration.workspace||[fetchImpl,execute,listen,query,...(sessionFactory?[sessionFactory]:[])].some(v=>typeof v!=='function'||types.isProxy(v))||poststartNativeFetch!==undefined&&(poststartNativeFetch!==fetchImpl||process.env.MERI_PRODUCT_PREVIEW_REQUIRED!=='1'||remote.processOrigin!==configuration.native.origin))throw Error('REMOTE_RUNNER_CONFIGURATION');
 if(process.env.MERI_PRODUCT_PREVIEW_REQUIRED!==undefined&&(process.env.MERI_PRODUCT_PREVIEW_REQUIRED!=='1'||remote.tls===undefined))throw Error('REMOTE_RUNNER_TLS_REQUIRED');
  markRunnerStage('remote-tls');const tls=remote.tls===undefined?undefined:await loadRunnerHttpsMaterial({original,taskArn:remote.taskArn,tls:remote.tls});
  const startup=runnerStartupBudget({requestMs:configuration.limits.requestMs,shutdownMs:configuration.limits.shutdownMs,originalExpiresAtMs:original.expiresAtMs}).stages;
  markRunnerStage('remote-clients');const credential=(await readSecret(configuration.native.capabilityFile)).toString('utf8').trim(),native=createNativeCapabilityClient({configuration:configuration.native,credential,fetch:fetchImpl,loadMaxRequestMs:startup.load.attemptMs});
 const readPort=borrowedReads??(configuration.sourceEnabled===true&&remote.approvedReads?.enabled===true?captureGeneralReadPort(createNativeReadsClient({origin:configuration.native.origin,credential,binding:configuration.binding,approvedReads:remote.approvedReads,fetchImpl}),true):undefined);
 // P-INT-9: governed intents reach control's task-authorized /v1/runner/intents/ route only when this run's remote task declares them.
 const intentPort=configuration.sourceEnabled===true&&remote.intents?.enabled===true?createRunnerIntentsClient({origin:configuration.native.origin,credential,binding:configuration.binding,fetchImpl,enabled:true}):undefined;
 const factory=sessionFactory??createRuntimeSdkSessionFactory({origin:configuration.native.origin,credential,binding:configuration.binding,fetchImpl,startupMaxRequestMs:startup.session.maxMs,startupExpiresAtMs:startup.session.expiresAtMs}),gate=remote.preparedKickoff===true?createPreparedRunnerGate({original,taskArn:remote.taskArn,authorizer:createNativePreparationClient({native,startupBudget:startup}),enabled:true,maxRequestMs:Math.min(8000,startup.admittedBefore.maxMs),maxWaitMs:Math.max(1,Math.min(1800000,startup.admittedAfter.expiresAtMs-Date.now()))}):null,gateApplication=gate?createPreparedRunnerGateApplication({gate,controlCapabilitySha256:remote.controlCapabilitySha256,enabled:true,maxRequestMs:configuration.limits.requestMs}):null;
 let listener,result,failure;
 async function cleanup(method){const life=createOperationLifetime({now:Date.now,deadlineMs:Date.now()+configuration.limits.shutdownMs,errorFactory:()=>Error('REMOTE_RUNNER_CLEANUP_UNKNOWN')});try{await life.run(signal=>method({signal}));}finally{life.close();}}
 try{
  markRunnerStage('remote-listen');listener=await listen({configuration:{...configuration,http:remote.http},application:{async handle(request){return (await gateApplication?.handle(request))??Response.json({error:{code:'NOT_FOUND'}},{status:404});}},readiness:async()=>{if(signal?.aborted)throw Error('REMOTE_RUNNER_STOPPED');},...(tls?{tls}:{})});
  markRunnerStage('kickoff-wait');await gate?.wait({signal});markRunnerStage('activity');result=await execute(configuration,{signal,query,sessionFactory:factory,...(readPort?{generalReads:readPort}:{}),...(intentPort?{governedIntents:intentPort}:{}),...(poststartNativeFetch?{nativeFetch:poststartNativeFetch}:{})});
 }catch(error){captureRunnerFailure(error);failure=error;}finally{markRunnerStage('remote-cleanup');gate?.close();if(listener)try{await cleanup(storageMethod(listener,'close'));}catch(error){failure=new AggregateError([...(failure?[failure]:[]),error],'REMOTE_RUNNER_CLEANUP_UNKNOWN');}}

 if(failure)throw failure;return result;
 }),{binding:configuration.binding,environment:configuration.telemetry?.environment});
}
