/** Canonical native host material owner: the EXISTING forHost adapter over the six canonical allocator-writer methods.
 *
 *  Input is exactly {binding,generation,hostId,declaration,instanceId,state,privateIp,signal} with `declaration` the SOURCE
 *  PROJECTION. All authority (full declaration, declarationSha256, bootstrap spec, owner, lease) comes from the retained row.
 *  Every step recovers the saved operation, otherwise claims with the canonical {disposition,operation} shape and sends exactly
 *  the retained request once. All awaits use the existing shared operation lifetime; late custody is recorded once under an
 *  independent bounded cleanup lifetime. The owner exposes one-shot owned cleanup and refuses new work after closing.
 */
import {createNativeBootstrapSendRequest,createNativeBootstrapSsmTransport} from './native-host-bootstrap-ssm.mjs';
import {NATIVE_BOOTSTRAP_PREPARE_REQUEST,NATIVE_BOOTSTRAP_INSTALL_REQUEST,decodeNativeBootstrapPayload,
 nativeBootstrapOperationId,assertNativeBootstrapSpec,assertNativeBootstrapObservation,nativeBootstrapKeyProofMessage}
 from '@capiro/meri-contracts/native-bootstrap';
import {canonicalSha256} from '@capiro/meri-contracts/node';
import {verifyRunnerPoststartProof} from './runner-poststart-csr.mjs';
import {proofStatement} from '../native-processing-host/protected-bootstrap.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {NATIVE_DECLARATION_V2,nativeObserverDeadline} from '../../../packages/contracts/native-observer.mjs';

const REFUSED='NATIVE_HOST_MATERIAL_REFUSED';
const UNKNOWN='NATIVE_HOST_MATERIAL_UNKNOWN';
const CANCELLED='NATIVE_HOST_MATERIAL_CANCELLED';
const INPUT_KEYS=Object.freeze(['binding','generation','hostId','declaration','instanceId','state','privateIp','signal']);
const SOURCE_KEYS=Object.freeze(['imageDigest','sourceCommit','bootstrapSha256']);
const OPTIONAL_SOURCE_KEYS=Object.freeze(['nativeHelperSha256','maxLifetimeMs']);
const MIN_SEND_MS=30000,CLEANUP_MS=5000;
const hostClientDnsName=a=>`h-${a.hostId.replace(/-/gu,'')}-g${a.generation}.host.meri.internal`;

const fault=code=>{throw Object.assign(new Error(code),{code});};
const cancelError=code=>Object.assign(new Error(CANCELLED),{code:CANCELLED,cause:code});

function closedInput(input){
 if(input===null||typeof input!=='object')fault(REFUSED);
 const keys=Object.keys(input);
 if(keys.some(key=>!INPUT_KEYS.includes(key)))fault(REFUSED);
 for(const key of INPUT_KEYS)if(key!=='signal'&&input[key]===undefined)fault(REFUSED);
 const {binding,generation,hostId,declaration,instanceId,privateIp,state,signal}=input;
 if(binding===null||typeof binding!=='object')fault(REFUSED);
 for(const key of ['tenantId','actorId','conversationId','runId','attemptId','workerId'])
  if(typeof binding[key]!=='string'||binding[key].length===0)fault(REFUSED);
 if(!Number.isSafeInteger(binding.writerFence)||binding.writerFence<1)fault(REFUSED);
 if(typeof hostId!=='string'||hostId.length===0||!Number.isSafeInteger(generation)||generation<1)fault(REFUSED);
 if(typeof instanceId!=='string'||!/^i-(?:[0-9a-f]{8}|[0-9a-f]{17})$/u.test(instanceId))fault(REFUSED);
 if(state!=='created'&&state!=='existing')fault(REFUSED);
 if(typeof privateIp!=='string'||privateIp.length===0)fault(REFUSED);
 if(declaration===null||typeof declaration!=='object')fault(REFUSED);
 if(!SOURCE_KEYS.every(key=>typeof declaration[key]==='string'&&declaration[key].length>0)||
  Object.keys(declaration).some(key=>!SOURCE_KEYS.includes(key)&&!OPTIONAL_SOURCE_KEYS.includes(key))||
  (declaration.nativeHelperSha256!==undefined&&typeof declaration.nativeHelperSha256!=='string')||
  (declaration.maxLifetimeMs!==undefined&&!Number.isSafeInteger(declaration.maxLifetimeMs)))fault(REFUSED);
 if(signal!==undefined&&signal!==null&&typeof signal.aborted!=='boolean')fault(REFUSED);
 return Object.freeze({binding,generation,hostId,declaration,instanceId,state,privateIp,signal});
}

function assertReservation(reservation,{input}){
 if(reservation===null||typeof reservation!=='object')fault('NATIVE_HOST_RESERVATION_REFUSED');
 const {allocation,originalBinding,observedInstance,declaration,declarationSha256,ownerInstanceId}=reservation;
 if(allocation===null||typeof allocation!=='object'||allocation.hostId!==input.hostId||allocation.generation!==input.generation)
  fault('NATIVE_HOST_RESERVATION_REFUSED');
 if(originalBinding===undefined||canonicalSha256(originalBinding)!==canonicalSha256(input.binding))
  fault('NATIVE_HOST_RESERVATION_REFUSED');
 if(observedInstance?.instanceId!==input.instanceId||observedInstance?.privateIp!==input.privateIp)
  fault('NATIVE_HOST_RESERVATION_REFUSED');
 if(declaration===null||typeof declaration!=='object')fault('NATIVE_HOST_RESERVATION_REFUSED');
 for(const key of [...SOURCE_KEYS,...OPTIONAL_SOURCE_KEYS])
  if(declaration[key]!==input.declaration[key])fault('NATIVE_HOST_RESERVATION_REFUSED');
 if(declarationSha256!==canonicalSha256(declaration))fault('NATIVE_HOST_RESERVATION_REFUSED');
 const spec=assertNativeBootstrapSpec(declaration.bootstrapSpec);
 if(typeof ownerInstanceId!=='string'||ownerInstanceId.length===0)fault('NATIVE_HOST_RESERVATION_REFUSED');
 const lease=allocation.leaseDeadlineMs;
 if(!Number.isSafeInteger(lease)||lease<1)fault('NATIVE_HOST_RESERVATION_REFUSED');
 const cleanupCeilingMs=declaration.schema===NATIVE_DECLARATION_V2?declaration.watchdog?.cleanupCeilingMs:undefined;
 if(declaration.schema===NATIVE_DECLARATION_V2&&(cleanupCeilingMs!==nativeObserverDeadline(lease)||declaration.watchdog?.leaseDeadlineMs!==lease))fault('NATIVE_HOST_RESERVATION_REFUSED');
 return Object.freeze({ownerInstanceId,leaseDeadlineMs:lease,allocation,declarationSha256,spec,cleanupCeilingMs});
}

export async function createNativeHostMaterialOwner({writer,issuer,transport,now=Date.now}={}){
 const NAMES=['readNativeReservation','reserveBootstrapOperation','claimBootstrapDispatch','recordBootstrapCommand',
  'readBootstrapOperation','recordBootstrapObservation'];
 for(const name of NAMES)if(typeof writer?.[name]!=='function')fault(REFUSED);
 const methods=Object.fromEntries(NAMES.map(name=>[name,writer[name].bind(writer)]));
 if(typeof issuer?.issue!=='function')fault(REFUSED);
 const ownedTransport=transport===undefined;
 const ssm=transport??await createNativeBootstrapSsmTransport();
 let closed=false,closing=null;

 const lifetime=(deadlineMs,signal)=>createOperationLifetime({deadlineMs,now,signal,errorFactory:cancelError});
 const pendingWork=new Set(),liveLifetimes=new Set();
 /** Run one bounded operation with the shared lifetime, its own signal, and truthful pending tracking. */
 async function bounded(deadlineMs,signal,operation){
  const life=lifetime(deadlineMs,signal);
  liveLifetimes.add(life);
  const work=Promise.resolve().then(()=>operation(life.signal));
  pendingWork.add(work);
  work.then(()=>pendingWork.delete(work),()=>pendingWork.delete(work));
  try{return await life.run(()=>work);}finally{life.close();liveLifetimes.delete(life);}
 }
 function validateObservation(step,observation,{request,prepareObservation}){
  try{return assertNativeBootstrapObservation(observation,{request,prepareObservation});}catch{fault(UNKNOWN);}
 }

 /** Record exact custody ONCE under an independent bounded cleanup lifetime (never the caller's aborted signal). */
 function custodyRecorder(ctx,{step,dispatchId,requestSha256}){
  let recorded=false,recordedValue=null;
  return commandId=>{
   if(recorded||typeof commandId!=='string')return recordedValue;
   recorded=true;
   const cleanup=lifetime(now()+CLEANUP_MS,undefined);
   const record=cleanup.run(()=>methods.recordBootstrapCommand({hostId:ctx.hostId,generation:ctx.generation,step,
    dispatchId,requestSha256,commandId})).catch(()=>null).finally(()=>cleanup.close());
   pendingWork.add(record);                                    // custody promises count toward truthful close
   record.then(()=>pendingWork.delete(record),()=>pendingWork.delete(record));
   recordedValue=record;
   return recordedValue;
  };
 }

 async function observeStep(ctx,{step,request,prepareObservation,signal,lease,commandId,dispatchId,requestSha256}){
  const observed=await bounded(lease,signal,lifeSignal=>ssm.observe({commandId,instanceId:ctx.instanceId,request,
   prepareObservation,signal:lifeSignal,deadlineMs:lease,now}));
  const observation=validateObservation(step,observed?.observation??observed,{request,prepareObservation});
  await bounded(lease,signal,()=>methods.recordBootstrapObservation({hostId:ctx.hostId,generation:ctx.generation,step,
   dispatchId,requestSha256,commandId,observation}));
  return observation;
 }

 /** Saved operation first, canonical claim second, at most ONE send of the retained request. Call-local ctx only. */
 async function advance(ctx,{step,request,prepareObservation,signal,lease}){
  const op=await bounded(lease,signal,lifeSignal=>methods.readBootstrapOperation({hostId:ctx.hostId,
   generation:ctx.generation,step,signal:lifeSignal}));
  const saved=op?.operation??op;
  if(saved?.observation!==undefined&&saved?.observation!==null)
   return {observation:validateObservation(step,saved.observation,{request,prepareObservation})};
  if(saved?.commandId)
   return {observation:await observeStep(ctx,{step,request,prepareObservation,signal,lease,commandId:saved.commandId,
    dispatchId:saved.dispatchId,requestSha256:saved.requestSha256})};
  if(lease-now()<MIN_SEND_MS)fault(CANCELLED);
  await bounded(lease,signal,lifeSignal=>methods.reserveBootstrapOperation({hostId:ctx.hostId,generation:ctx.generation,
   step,request,signal:lifeSignal}));
  const claim=await bounded(lease,signal,lifeSignal=>methods.claimBootstrapDispatch({hostId:ctx.hostId,
   generation:ctx.generation,step,requestSha256:canonicalSha256(request),signal:lifeSignal}));
  if(claim===null||typeof claim!=='object'||!['send-once','reconcile'].includes(claim.disposition))fault(UNKNOWN);
  const operation=claim.operation;
  if(operation===null||typeof operation!=='object')fault(UNKNOWN);
  if(claim.disposition!=='send-once'){
   if(operation.observation!==undefined&&operation.observation!==null)
    return {observation:validateObservation(step,operation.observation,{request,prepareObservation})};
   if(operation.commandId)return {observation:await observeStep(ctx,{step,request,prepareObservation,signal,lease,
    commandId:operation.commandId,dispatchId:operation.dispatchId,requestSha256:operation.requestSha256})};
   fault(UNKNOWN);                                            // reconcile without custody: never send
  }
  if(canonicalSha256(operation.request)!==canonicalSha256(request))fault(UNKNOWN);
  if(typeof operation.dispatchId!=='string'||operation.requestSha256!==canonicalSha256(request))fault(UNKNOWN);
  // Positive COMMIT does not waive delivery eligibility: recheck the ORIGINAL lease right before the SDK call.
  if(lease-now()<MIN_SEND_MS||signal?.aborted===true)fault(CANCELLED);
  const custody=custodyRecorder(ctx,{step,dispatchId:operation.dispatchId,requestSha256:operation.requestSha256});
  // The exact SDK call runs under its own owned lifetime; its provided signal reaches the transport.
  const sendLife=lifetime(lease,signal);
  liveLifetimes.add(sendLife);
  const sending=ssm.sendOnce(operation.request,{signal:sendLife.signal,deadlineMs:lease,now});
  pendingWork.add(sending);
  sending.then(()=>pendingWork.delete(sending),()=>pendingWork.delete(sending));
  sending.then(sentValue=>custody(sentValue?.commandId),error=>{if(error?.commandId)custody(error.commandId);});
  let sent;
  try{sent=await sendLife.run(()=>sending);}
  catch(error){throw error;}                                  // late custody is already attached above
  finally{sendLife.close();liveLifetimes.delete(sendLife);}
  if(typeof sent?.commandId!=='string')fault(UNKNOWN);
  await custody(sent.commandId);
  if(signal?.aborted===true)fault(CANCELLED);
  return {observation:await observeStep(ctx,{step,request,prepareObservation,signal,lease,commandId:sent.commandId,
   dispatchId:operation.dispatchId,requestSha256:operation.requestSha256})};
 }

 return Object.freeze({
  /** One-shot owned cleanup; a borrowed transport is never disposed. */
  close(){
   if(closing!==null)return closing;
   closed=true;
   closing=(async()=>{
    for(const life of [...liveLifetimes])try{life.close();}catch{/* already closed */}   // cancel owned call lifetimes
    let timer=null;
    let drained=await Promise.race([
     Promise.allSettled([...pendingWork]).then(()=>true),
     new Promise(resolve=>{timer=setTimeout(()=>resolve(false),CLEANUP_MS);timer.unref?.();}),
    ]);
    if(timer!==null)clearTimeout(timer);
    if(ownedTransport&&typeof ssm.close==='function'){
     // Owned SDK disposal is bounded too; a hung destroy is an unknown close, never a proven one.
     let closeTimer=null;
     const disposed=await Promise.race([
      ssm.close().then(()=>true,()=>false),
      new Promise(resolve=>{closeTimer=setTimeout(()=>resolve(false),CLEANUP_MS);closeTimer.unref?.();}),
     ]);
     if(closeTimer!==null)clearTimeout(closeTimer);
     if(disposed!==true)drained=false;
    }
    // A stopped wait or a disposed SDK is not proof that borrowed work stopped.
    return {closed:drained===true&&pendingWork.size===0,pendingCalls:pendingWork.size,physicalStopProven:false};
   })();
   return closing;
  },
  async forHost(raw){
   if(closed===true)fault(REFUSED);
   const input=closedInput(raw),signal=input.signal;
   const ctx=Object.freeze({hostId:input.hostId,generation:input.generation,instanceId:input.instanceId});
   if(signal?.aborted===true)fault(CANCELLED);
   // The initial read has no lease yet: it is bounded by its own finite window AND the caller's cancellation.
   const reservation=await bounded(now()+MIN_SEND_MS*2,signal,lifeSignal=>methods.readNativeReservation({hostId:ctx.hostId,
    generation:ctx.generation,signal:lifeSignal}));
   const retained=assertReservation(reservation,{input});
   const lease=retained.leaseDeadlineMs,at=now();
   if(!Number.isSafeInteger(at)||at>=lease)fault(CANCELLED);
   const spec=retained.spec;
   const scope=Object.freeze({allocation:retained.allocation,originalBinding:input.binding,
    ...(retained.cleanupCeilingMs===undefined?{}:{cleanupCeilingMs:retained.cleanupCeilingMs}),
    ownerInstanceId:retained.ownerInstanceId,instanceId:input.instanceId,
    endpoint:Object.freeze({address:input.privateIp,port:spec.hostEndpoint.port,serverName:spec.hostEndpoint.serverName}),
    // The optional saved helper pin survives iff the (validated-equal) caller/row source projection declares it.
    source:Object.freeze({imageDigest:input.declaration.imageDigest,sourceCommit:input.declaration.sourceCommit,
     bootstrapSha256:input.declaration.bootstrapSha256,
     ...(input.declaration.nativeHelperSha256===undefined?{}:{nativeHelperSha256:input.declaration.nativeHelperSha256})}),
    declarationSha256:retained.declarationSha256,bootstrapSpecSha256:canonicalSha256(spec)});
   const preparePayload={schema:NATIVE_BOOTSTRAP_PREPARE_REQUEST,
    operationId:nativeBootstrapOperationId({hostId:ctx.hostId,generation:ctx.generation,step:'prepare'}),
    scope,bootstrapSpec:spec};
   const prepareRequest=createNativeBootstrapSendRequest({payload:preparePayload});
   const prepareObservation=(await advance(ctx,{step:'prepare',request:prepareRequest,signal,lease})).observation;
   const statement=proofStatement(prepareObservation);
   for(const [role,csrPem,proofBase64] of [['host-client',prepareObservation.hostCsrPem,prepareObservation.hostProofBase64],
    ['host-server',prepareObservation.serverCsrPem,prepareObservation.serverProofBase64]])
    try{verifyRunnerPoststartProof({csrPem,message:nativeBootstrapKeyProofMessage(statement,role),proofBase64});}
    catch{fault(REFUSED);}
   const prepareObservationSha256=canonicalSha256(prepareObservation);
   const notAfterMs=Math.min(lease,at+900000);
   let hostCertificate,serverCertificate,installRequest,installObservation;
   const savedInstallRaw=await bounded(lease,signal,lifeSignal=>methods.readBootstrapOperation({hostId:ctx.hostId,
    generation:ctx.generation,step:'install',signal:lifeSignal}));
   const savedInstall=savedInstallRaw?.operation??savedInstallRaw;
   if(savedInstall!==null&&savedInstall!==undefined&&typeof savedInstall.request==='object'&&savedInstall.request!==null){
    // A retained install request is authoritative even before its observation: reconcile, never reissue.
    const wire=decodeNativeBootstrapPayload(savedInstall.request.Parameters.Payload[0]);
    if(wire.operationId!==nativeBootstrapOperationId({hostId:ctx.hostId,generation:ctx.generation,step:'install'})||
     canonicalSha256(wire.scope)!==canonicalSha256(scope)||canonicalSha256(wire.bootstrapSpec)!==canonicalSha256(spec)||
     wire.prepareOperationId!==preparePayload.operationId||wire.prepareRequestSha256!==canonicalSha256(prepareRequest)||
     wire.prepareObservationSha256!==prepareObservationSha256||wire.bootId!==prepareObservation.bootId)fault(UNKNOWN);
    hostCertificate=wire.hostCertificate;serverCertificate=wire.serverCertificate;installRequest=savedInstall.request;
    if(savedInstall.observation!==undefined&&savedInstall.observation!==null)
     installObservation=validateObservation('install',savedInstall.observation,{request:installRequest,prepareObservation});
   }else{
    hostCertificate=(await bounded(lease,signal,lifeSignal=>issuer.issue({kind:'client',san:hostClientDnsName(retained.allocation),
     csrPem:prepareObservation.hostCsrPem,notAfterMs,leaseDeadlineMs:lease,signal:lifeSignal,deadlineMs:lease}))).certPem;
    serverCertificate=(await bounded(lease,signal,lifeSignal=>issuer.issue({kind:'server',san:scope.endpoint.serverName,
     csrPem:prepareObservation.serverCsrPem,notAfterMs:retained.cleanupCeilingMs??notAfterMs,leaseDeadlineMs:lease,
     ...(retained.cleanupCeilingMs===undefined?{}:{cleanupCeilingMs:retained.cleanupCeilingMs}),signal:lifeSignal,deadlineMs:lease}))).certPem;
    const installWire={schema:NATIVE_BOOTSTRAP_INSTALL_REQUEST,
     operationId:nativeBootstrapOperationId({hostId:ctx.hostId,generation:ctx.generation,step:'install'}),
     scope,bootstrapSpec:spec,prepareOperationId:preparePayload.operationId,
     prepareRequestSha256:canonicalSha256(prepareRequest),prepareObservationSha256,
     bootId:prepareObservation.bootId,hostCertificate,serverCertificate};
    installRequest=createNativeBootstrapSendRequest({payload:installWire});
   }
   if(installObservation===undefined)
    installObservation=(await advance(ctx,{step:'install',request:installRequest,prepareObservation,signal,lease})).observation;
   if(signal?.aborted===true||now()>=lease)fault(CANCELLED);
   return Object.freeze({
    hostIdentity:Object.freeze({schema:'meri-d005-host-identity/1',hostId:ctx.hostId,
     conversationId:input.binding.conversationId,instanceId:ctx.instanceId,bootId:prepareObservation.bootId}),
    endpoint:Object.freeze({address:input.privateIp,port:scope.endpoint.port,serverName:scope.endpoint.serverName}),
    hostCertificate,serverCertificate,ownerInstanceId:retained.ownerInstanceId,leaseDeadlineMs:lease});
  },
 });
}
