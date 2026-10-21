import {types} from 'node:util';
import {budget,assertHotPathBudgets,runnerStartupBudget} from '../../packages/runtime/hot-path-budgets.mjs';
import {runtimeHotPathBudgets} from './hot-path-budget-inputs.mjs';
import {createHotPathFetch} from './hot-path-transports.mjs';
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
import {atRunnerStage,markRunnerStage,captureRunnerFailure,withRunnerDiagnostics,emitRunnerBudgetTable} from './runner-runtime-diagnostics.mjs';
export async function runRemoteConversation(configuration,options={}){
 let ownedFetch;try{return await withRunnerDiagnostics(()=>atRunnerStage('remote-config',async()=>{
 let {signal,fetchImpl,execute=runConversation,listen=listenRuntime,createWorker=createRemoteNativeWorker,sessionFactory,generalReads,poststartNativeFetch,budgets=runtimeHotPathBudgets(configuration)}=own(options,[],['signal','fetchImpl','execute','listen','createWorker','sessionFactory','generalReads','poststartNativeFetch','budgets']);nativeSignal(signal);assertHotPathBudgets(budgets);emitRunnerBudgetTable(budgets);if(fetchImpl===undefined)fetchImpl=(ownedFetch=createHotPathFetch(budgets)).fetch;
 const borrowedReads=captureGeneralReadPort(generalReads,configuration.sourceEnabled);
 const remote=own(configuration.remoteTask,['original','preparationIntent','taskArn','controlCapabilitySha256','processOrigin','http'],['preparedKickoff','approvedReads','tls','intents']),original=remoteOriginal(remote.original),intent=compileNativePreparationIntent(remote.preparationIntent);
 if(hash(original.binding)!==hash(configuration.binding)||hash(original.versions)!==hash(configuration.versions)||intent.workspace!==configuration.workspace||[fetchImpl,execute,listen,createWorker,...(sessionFactory?[sessionFactory]:[])].some(v=>typeof v!=='function'||types.isProxy(v))||poststartNativeFetch!==undefined&&(poststartNativeFetch!==fetchImpl||process.env.MERI_PRODUCT_PREVIEW_REQUIRED!=='1'||remote.processOrigin!==configuration.native.origin))throw Error('REMOTE_RUNNER_CONFIGURATION');
 if(process.env.MERI_PRODUCT_PREVIEW_REQUIRED!==undefined&&(process.env.MERI_PRODUCT_PREVIEW_REQUIRED!=='1'||remote.tls===undefined))throw Error('REMOTE_RUNNER_TLS_REQUIRED');
  markRunnerStage('remote-tls');const tls=remote.tls===undefined?undefined:await loadRunnerHttpsMaterial({original,taskArn:remote.taskArn,tls:remote.tls});
  const startup=runnerStartupBudget({requestMs:configuration.limits.requestMs,shutdownMs:configuration.limits.shutdownMs,originalExpiresAtMs:original.expiresAtMs}).stages;
  markRunnerStage('remote-clients');const credential=(await readSecret(configuration.native.capabilityFile)).toString('utf8').trim(),native=createNativeCapabilityClient({configuration:configuration.native,credential,fetch:fetchImpl,maxRequestMs:budget(budgets,'native.client.request'),loadMaxRequestMs:startup.load.attemptMs}),client=createNativeSdkSessionClient({origin:configuration.native.origin,credential,binding:configuration.binding,fetchImpl});
 const readPort=borrowedReads??(configuration.sourceEnabled===true&&remote.approvedReads?.enabled===true?captureGeneralReadPort(createNativeReadsClient({origin:configuration.native.origin,credential,binding:configuration.binding,approvedReads:remote.approvedReads,fetchImpl}),true):undefined);
 // P-INT-9: governed intents reach control's task-authorized /v1/runner/intents/ route only when this run's remote task declares them.
 const intentPort=configuration.sourceEnabled===true&&remote.intents?.enabled===true?createRunnerIntentsClient({origin:configuration.native.origin,credential,binding:configuration.binding,fetchImpl,enabled:true,limits:{maxRequestBytes:65536,maxResponseBytes:262144,maxPrepareMs:budget(budgets,'native.intent.prepare')}}):undefined;
 const factory=sessionFactory??createRuntimeSdkSessionFactory({origin:configuration.native.origin,credential,binding:configuration.binding,fetchImpl,sessionTimeoutMs:budget(budgets,'runner.session.store'),startupMaxRequestMs:startup.session.maxMs,startupExpiresAtMs:startup.session.expiresAtMs}),mirror=createCheckpointSessionFactory({factory,client,binding:configuration.binding});let worker,listener,result,failure;const retirement=Promise.withResolvers();retirement.promise.catch(()=>{});let retired=false;const gate=remote.preparedKickoff===true?createPreparedRunnerGate({original,taskArn:remote.taskArn,authorizer:createNativePreparationClient({native,startupBudget:startup}),enabled:true,maxRequestMs:Math.min(budget(budgets,'native.transport.request'),startup.admittedBefore.maxMs),maxWaitMs:Math.max(1,Math.min(1800000,startup.admittedAfter.expiresAtMs-Date.now()))}):null,gateApplication=gate?createPreparedRunnerGateApplication({gate,controlCapabilitySha256:remote.controlCapabilitySha256,enabled:true,maxRequestMs:configuration.limits.requestMs}):null;
 async function cleanup(method){const life=createOperationLifetime({now:Date.now,deadlineMs:Date.now()+configuration.limits.shutdownMs,errorFactory:()=>Error('REMOTE_RUNNER_CLEANUP_UNKNOWN')});try{await life.run(signal=>method({signal}));}finally{life.close();}}
  try{markRunnerStage('remote-worker');worker=createWorker({budgets,original,preparationIntent:intent,taskArn:remote.taskArn,controlCapabilitySha256:remote.controlCapabilitySha256,taskCapabilitySha256:capabilityDigest(credential),native,preparationBudget:startup,processTransport:{original,origin:remote.processOrigin,credential,fetchImpl,limits:{maxRequestMs:budget(budgets,'native.transport.request')}},session:mirror.session,enabled:true,limits:{maxRequestMs:Math.min(budget(budgets,'request'),budget(budgets,'runtime.preparation'))}});
   const handle=storageMethod(worker.application,'handle');async function receive(request){const response=(await gateApplication?.handle(request))??(await handle(request))??Response.json({error:{code:'NOT_FOUND'}},{status:404});if(gate&&new URL(request.url).pathname==='/v1/native-task/stop'&&request.headers.get('authorization')?.startsWith('Bearer ')&&matchesCapability(request.headers.get('authorization').slice(7),remote.controlCapabilitySha256)&&response.status===200){const body=await response.clone().json();if(hash(body.original)===hash(original)){let valid=false;if(body.receipt?.notAllocated===true){const receipt=own(body.receipt,['physicalStopProven','notAllocated']);valid=receipt.physicalStopProven===false;}else{const receipt=assertNativeExecution(body.receipt,original);valid=receipt.state==='stopped'&&receipt.physicalStopProven===true;}if(valid){retired=true;retirement.resolve();}}}return response;}markRunnerStage('remote-listen');listener=await listen({configuration:{...configuration,http:remote.http},budgets,application:{handle:receive},readiness:async()=>{if(signal?.aborted)throw Error('REMOTE_RUNNER_STOPPED');},...(tls?{tls}:{})});
   markRunnerStage('kickoff-wait');await gate?.wait({signal});markRunnerStage('activity');result=await execute({...configuration,captureOwnsClose:true},{signal,budgets,query:worker.query,sessionFactory:mirror.factory,...(readPort?{generalReads:readPort}:{}),...(intentPort?{governedIntents:intentPort}:{}),...(poststartNativeFetch?{nativeFetch:poststartNativeFetch}:{})});
  }catch(error){captureRunnerFailure(error);failure=error;}finally{markRunnerStage('remote-cleanup');gate?.close();const errors=[];if(worker)try{await cleanup(storageMethod(worker,'close'));}catch(error){errors.push(error);}try{await cleanup(mirror.session.close);}catch(error){errors.push(error);}if(gate&&listener&&!retired){const life=createOperationLifetime({now:Date.now,deadlineMs:Math.max(Date.now()+1,original.expiresAtMs+configuration.limits.shutdownMs),errorFactory:()=>Error('REMOTE_RUNNER_RETIREMENT_UNKNOWN')});try{await life.run(()=>retirement.promise);}catch(error){errors.push(error);}finally{life.close();}}if(listener)try{await cleanup(storageMethod(listener,'close'));}catch(error){errors.push(error);}if(errors.length)failure=new AggregateError([...(failure?[failure]:[]),...errors],'REMOTE_RUNNER_CLEANUP_UNKNOWN');}
 if(failure)throw failure;return result;
 }),{binding:configuration.binding,environment:configuration.telemetry?.environment});}finally{await ownedFetch?.close();}
}
