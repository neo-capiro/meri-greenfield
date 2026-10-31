/** Production composition and CLI main for the native processing host.
 *
 * Reads validated owner configuration, loads TLS key/cert/CA from the existing credential/provisioning owner's paths,
 * starts a TLS1.3 server that requires a client certificate and checks the exact Control peer SAN, fingerprint and
 * certificate validity against the bootstrap configuration (never from JSON), and handles the closed
 * POST /internal/upload-inspection through the CAP bootstrap.
 *
 * The Parent canonical custody validator is NOT yet exported; while it is absent the host starts no listener and reports
 * the exact missing module. No injected positive parent object is used as a stand-in for production.
 */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

/** The EXISTING lifecycle's own provisioning budget; never aliased to the inspection request deadline. */
const NATIVE_PROVISION_MS=120000;
import {createServer} from 'node:https';
import {nativeProcessingConfig} from './config.mjs';
import {readInstalledTls,createBootstrapStateStore} from './protected-bootstrap.mjs';
import {createInspectionHandler,NATIVE_INSPECTION_PATH} from './service.mjs';
import {createLifecycleHandler} from './lifecycle-http.mjs';
import {NATIVE_LIFECYCLE_PATH,NATIVE_LIFECYCLE_BODY_BYTES} from './lifecycle-contract.mjs';
import {createNativeProcessingVerifier} from './verifier.mjs';
import {createHostCurrentnessClient} from '../../worker/conversation/host/control/client.mjs';
import {openNativeProcessingHost} from './bootstrap.mjs';
import {runDefinitionProgram} from '../uploads/native-definitions.mjs';
import {createUploadDefinitionsComposition} from '../uploads/composition.mjs';
import {beginUploadNativeProvisioning} from '../uploads/control-lifecycle.mjs';
import {openNativeLifecycle,NATIVE_LIFECYCLE_SCHEMA} from './lifecycle.mjs';
import {prepareHostHierarchy,releaseOwnedHierarchy,realHierarchyPort} from './hierarchy.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {HOST_ALLOCATION_SCHEMA,D005_HOST_IDENTITY_SCHEMA} from '../../worker/conversation/host/binding.mjs';
import {createDefinitionSnapshotOwner} from './definitions-owner.mjs';
import {checkedCertificate,dnsName,fingerprint,privateAddress,sha256Der,tlsBytes} from '../../worker/conversation/host/control/tls.mjs';

export function nativeProcessingReadiness({config,verifyCustody}){
 const missing=[];
 if(config===null||typeof config!=='object')missing.push('configuration');
 if(typeof verifyCustody!=='function'&&config?.control===undefined)missing.push('canonical.currentness:endpoint');
 return Object.freeze({ready:missing.length===0,missing:Object.freeze(missing),endpoint:NATIVE_INSPECTION_PATH,});
}

export async function startNativeProcessingHost({env=globalThis.process?.env??{},readFile=readFileSync,
 verifyCustody=undefined,openHost=openNativeProcessingHost,serverFactory=createServer,
 authenticatePeer=undefined,definitionsOwner:injectedOwner,definitionsRun:runDefinitions=runDefinitionProgram,
 config:configOverride,definitionsChmod,lifecyclePorts,lifecycleLstat,lifecycleNow,hierarchyPort}={}){
 const config=configOverride??nativeProcessingConfig({env});
 const readiness=nativeProcessingReadiness({config,verifyCustody});
 if(!readiness.ready)return Object.freeze({started:false,readiness});
 // Listener identity (serverAuth); the native-Control CLIENT identity (clientAuth) is a SEPARATE protected pair. When the
 // protected installed bundle is selected it is the ONLY source of both pairs; there is no environment fallback.
 // The SAME validated installed material that produced this config is consumed here; no second, independent read.
 const installed=config.tls.installed===true
  ?(config.installedTls??readInstalledTls({store:createBootstrapStateStore(),now:Date.now}))
  :null;
 const key=installed?.tls.serverKey??tlsBytes(readFile(config.tls.keyPath));
 const cert=installed?.tls.serverCert??tlsBytes(readFile(config.tls.certPath));
 // The LISTENER trusts Control peers: its request CA is the separately pinned Control root, never the native issuer root.
 const ca=installed?.tls.controlCa??tlsBytes(readFile(config.tls.caPath));
 // The ACTUAL verifier: composed from this host's protected configuration and trusted material reader. It has no
 // Control-local custody closure; every fresh check is an authenticated native currentness read.
 const maxFreshMs=Math.min(30000,config.limits.deadlineMaxMs);
 const verifyCustodyDefault=verifyCustody??(()=>{
  const clientKey=installed?.tls.clientKey??tlsBytes(readFile(config.control.clientKeyPath));
  const clientCert=installed?.tls.clientCert??tlsBytes(readFile(config.control.clientCertPath));
  const controlCa=installed?.tls.controlCa??tlsBytes(readFile(config.control.caPath));
  return createNativeProcessingVerifier({now:Date.now,maxFreshMs,
  peerMaxLifetimeMs:config.tls.maxPeerLifetimeMs,policySha256:config.control.policySha256,
  createClient:({allocation,binding,hostIdentity})=>createHostCurrentnessClient({allocation,binding,hostIdentity,
   purpose:'native-processing',endpoint:config.control,tls:{cert:clientCert,key:clientKey,ca:controlCa},maxFreshMs,
   timeoutMs:Math.min(5000,maxFreshMs),now:Date.now})});})();
 const active=new Set();
 // ONE host-lifetime definition composition: the SAME factored store/updater/serialized refresh the upload host uses,
 // plus the host pin owner. The child never gets an updater or prune authority.
 // Every owned raw definition program call is tracked with its ACTUAL receipt. `provisioning.completion` swallows errors
 // and resolves null, so it is never proof that definition programs stopped; only a truthful receipt is.
 // Owned raw definition calls: a pending set plus a STICKY unknown physical disposition. Successfully closed calls are
 // not retained as history. `provisioning.completion` resolves null on error, so it is never proof of process closure.
 const pendingDefinitions=new Set();
 let definitionsUnknown=false;
 const receiptClosed=receipt=>receipt?.leaderClosed===true&&receipt?.groupAbsent===true&&receipt?.settlement==='closed';
 const trackedDefinitionsRun=(program,args,options)=>{
  // Exact pre-dispatch refusals: no process is owned, so nothing is recorded as unknown.
  if(admission.closed===true||shutdownController.signal.aborted===true||options?.signal?.aborted===true||
   (Number.isSafeInteger(options?.deadlineMs)&&options.deadlineMs<=Date.now()))
   throw Object.assign(Error('NATIVE_PROCESSING_CLOSED'),{code:'NATIVE_PROCESSING_CLOSED',notDispatched:true});
  let result;
  try{result=runDefinitions(program,args,options);}
  catch(error){
   // An exception AFTER invoking the runner may own a process: only a truthful receipt may claim closure.
   if(!receiptClosed(error?.receipt??error?.runArtifactProcess))definitionsUnknown=true;
   throw error;
  }
  const record=Promise.resolve(result).then(value=>{
   pendingDefinitions.delete(record);
   if(!receiptClosed(value?.receipt??value?.runArtifactProcess))definitionsUnknown=true;
   return value;
  },error=>{
   pendingDefinitions.delete(record);
   if(!receiptClosed(error?.receipt??error?.runArtifactProcess))definitionsUnknown=true;
   throw error;
  });
  record.catch(()=>{});                                   // observed, never unhandled
  pendingDefinitions.add(record);
  return result;
 };
 const definitionComposition=createUploadDefinitionsComposition({definitionsRoot:config.paths.definitionsRoot,
  now:Date.now,definitionsRun:trackedDefinitionsRun,
  ...(definitionsChmod===undefined?{}:{chmod:definitionsChmod})});
 const definitionsOwner=injectedOwner===undefined?createDefinitionSnapshotOwner({definitions:definitionComposition.definitions}):injectedOwner;
 const definitionsLifecycle=Object.freeze({provision:definitionComposition.provisionDefinitions,
  refresh:definitionComposition.refresh,pin:args=>definitionsOwner.pin(args),
  pruneIfIdle:args=>definitionsOwner.pruneIfIdle(args)});
 privateAddress(config.listen.address);dnsName(config.tls.peerSan);
 // ---- ALL shutdown/startup ownership state is declared BEFORE the listener can be exposed ----------------
 const shutdownController=new AbortController();
 const admission={closed:false};
 const idleWaiters=new Set();
 const notifyIdle=()=>{for(const waiter of [...idleWaiters]){idleWaiters.delete(waiter);waiter();}};
 const waitForIdle=()=>active.size===0?Promise.resolve():new Promise(resolve=>idleWaiters.add(resolve));
 const boundedWait=(promise,deadlineMs)=>new Promise(resolve=>{
  const timer=setTimeout(()=>resolve({timedOut:true}),Math.max(1,deadlineMs-Date.now()));
  Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve({value});},
   error=>{clearTimeout(timer);resolve({error});});
 });
 const canonicalAllocation=Object.freeze({schema:HOST_ALLOCATION_SCHEMA,tenantId:config.allocation.tenantId,
  conversationId:config.allocation.conversationId,generation:config.allocation.generation,hostId:config.allocation.hostId,
  imageDigest:config.image.digest,leaseDeadlineMs:config.allocation.leaseDeadlineMs,hostMode:config.allocation.hostMode});
 const hostIdentity=Object.freeze(config.hostIdentity!==undefined
  ?{schema:D005_HOST_IDENTITY_SCHEMA,instanceId:config.hostIdentity.instanceId,bootId:config.hostIdentity.bootId,
    conversationId:config.allocation.conversationId,hostId:config.allocation.hostId}
  :{schema:D005_HOST_IDENTITY_SCHEMA,instanceId:config.allocation.instanceId,bootId:config.allocation.bootId,
    conversationId:config.allocation.conversationId,hostId:config.allocation.hostId});
 let provisioning=null,server=null,rawProbe=null;
 // Trusted quiesce: admission closes SYNCHRONOUSLY, then every owned owner must be proven released within the
 // producer-supplied {signal,deadlineMs}. Pending or physically unknown owners settle unknown.
 const trustedQuiesce=async({signal,deadlineMs}={})=>{
  admission.closed=true;
  for(const controller of [...active]){try{controller.abort();}catch{}}
  try{shutdownController.abort();}catch{}
  const life=createOperationLifetime({deadlineMs:Number.isSafeInteger(deadlineMs)?deadlineMs:Date.now()+config.limits.deadlineMaxMs,
   now:Date.now,signal,errorFactory:()=>Object.assign(Error('NATIVE_PROCESSING_CLEANUP_UNKNOWN'),
    {code:'NATIVE_PROCESSING_CLEANUP_UNKNOWN'})});
  let closed=true;
  try{
   await life.run(()=>waitForIdle());
   await life.run(()=>Promise.resolve(provisioning?.completion??null));
   if(rawProbe!==null){try{await life.run(()=>rawProbe);}catch{closed=false;}}
   for(const pending of [...pendingDefinitions]){try{await life.run(()=>pending);}catch{closed=false;}}
  }catch{closed=false;}
  finally{life.close();}
  if(definitionsUnknown===true||pendingDefinitions.size>0)closed=false;
  return closed?Object.freeze({closed:true}):Object.freeze({closed:false,code:'NATIVE_PROCESSING_CLEANUP_UNKNOWN'});
 };
 // Root-owned generation hierarchy BEFORE the producer pins it. Only this invocation's created directories are owned.
 let hierarchy=null;
 try{
  hierarchy=await prepareHostHierarchy({config,port:hierarchyPort??realHierarchyPort,supervisorPid:globalThis.process?.pid});
  if(hierarchy.unavailable===true)
   return Object.freeze({started:false,readiness,error:'HOST_HIERARCHY_MOUNT_REFUSED'});
 }catch(error){
  return Object.freeze({started:false,readiness,error:typeof error?.code==='string'?error.code:'HOST_HIERARCHY_REFUSED'});
 }
 // ACTUAL producer, opened (guest root pinned) BEFORE the listener, probe or provisioning.
 let lifecycle=null;
 try{
  // The lifecycle producer selects its own canonical allocation fields; the local physical identity is supplied separately.
  const lifecycleAllocation={...config.allocation,instanceId:config.hostIdentity?.instanceId??config.allocation.instanceId,
   bootId:config.hostIdentity?.bootId??config.allocation.bootId};
  lifecycle=await openNativeLifecycle({config:{allocation:lifecycleAllocation,binding:config.binding,image:config.image},
   quiesce:trustedQuiesce,ports:lifecyclePorts,lstat:lifecycleLstat??undefined,now:lifecycleNow??Date.now,
   deadlineMs:Date.now()+config.limits.deadlineMaxMs});
 }catch(error){
  const cleanupResult=await releaseOwnedHierarchy({record:hierarchy,port:hierarchyPort??realHierarchyPort}).catch(()=>({unknown:['unreleased']}));
  const cleanup=cleanupResult.unknown.length===0?'removed':'unknown';
  return Object.freeze({started:false,readiness,cleanup,
   error:typeof error?.code==='string'?error.code:'NATIVE_PROCESSING_CONFIGURATION'});
 }
 // ONE bounded owned-cleanup routine shared by both failure branches: it only AWAITS work already started, observes the
 // callback-based listener close and the cached one-shot descriptor disposal, and reports unknown when its budget expires
 // (late settlement stays observed; timeout never proves closure).
 const startupCleanup=async deadlineMs=>{
  admission.closed=true;
  try{shutdownController.abort();}catch{}
  for(const controller of [...active]){try{controller.abort();}catch{}}
  let closed=true;
  if(rawProbe!==null){const probe=await boundedWait(rawProbe.catch(()=>{}),deadlineMs);if(probe.timedOut)closed=false;}
  if(provisioning!==null){const done=await boundedWait(Promise.resolve(provisioning.completion??null),deadlineMs);
   if(done.timedOut||done.error!==undefined)closed=false;}
  for(const pending of [...pendingDefinitions]){const settled=await boundedWait(pending,deadlineMs);
   if(settled.timedOut||settled.error!==undefined)closed=false;}
  if(definitionsUnknown===true||pendingDefinitions.size>0)closed=false;
  if(active.size>0)closed=false;
  if(server!==null){
   const listener=await boundedWait(new Promise(resolve=>{
    try{server.close(error=>resolve(error?{errored:true,code:error.code}:true));}catch{resolve(false);}
   }),deadlineMs);
   const settled=listener.value;
   const notListening=settled===true||(settled&&settled.code==='ERR_SERVER_NOT_RUNNING');
   if(listener.timedOut||notListening!==true)closed=false;
  }
  // Bounded idle wait inside the SAME cleanup deadline: surviving activity can never be reported closed.
  const idle=await boundedWait(waitForIdle(),deadlineMs);
  if(idle.timedOut||active.size>0)closed=false;
  const disposal=await boundedWait(lifecycle.dispose(),deadlineMs);
  if(disposal.timedOut||disposal.value?.closed!==true)closed=false;
  if(hierarchy!==null){
   const release=await boundedWait(releaseOwnedHierarchy({record:hierarchy,port:hierarchyPort??realHierarchyPort}),deadlineMs);
   if(release.timedOut||release.value?.unknown?.length>0)closed=false;
  }
  return Object.freeze({closed});
 };
 let startupError=null,startupState=null;
 try{
  // ONE Control peer authenticator and ONE bounded body reader, shared by inspection and lifecycle handlers.
  const authenticateControl=authenticatePeer??(async({socket})=>{
   if(socket.encrypted!==true)return {verified:false};
   const raw=socket.getPeerCertificate?.(true);
   if(!raw||!Buffer.isBuffer(raw.raw))return {verified:false};
   const print=sha256Der(raw.raw);
   if(fingerprint(print)!==config.tls.peerFingerprint)return {verified:false};
   const checked=checkedCertificate(raw.raw,{name:config.tls.peerSan,nowMs:Date.now(),
    maxLifetimeMs:config.tls.maxPeerLifetimeMs,notAfterMs:config.tls.peerNotAfterMs});
   return {verified:true,fingerprintSha256:checked.fingerprintSha256,notAfterMs:checked.notAfterMs};
  });
  const readBoundedBody=(req,limit,deadline,signal)=>new Promise((resolve,reject)=>{
   let total=0,finished=false;const chunks=[];
   const refuseBody=()=>Object.assign(Error('UPLOAD_INSPECTION_REQUEST_REFUSED'),
    {code:'UPLOAD_INSPECTION_REQUEST_REFUSED'});
   const detachBody=()=>{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);
    req.removeListener?.('data',onData);req.removeListener?.('end',onEnd);req.removeListener?.('error',onError);};
   const finish=(error,value)=>{if(finished)return;finished=true;detachBody();error?reject(error):resolve(value);};
   const timer=setTimeout(()=>{req.destroy?.();finish(refuseBody());},Math.max(1,deadline-Date.now()));
   const onAbort=()=>finish(refuseBody());
   const onData=chunk=>{if(finished)return;total+=chunk.length;
    if(total>limit){req.destroy?.();finish(refuseBody());return;}chunks.push(chunk);};
   const onEnd=()=>finish(null,Buffer.concat(chunks));
   const onError=error=>finish(error);
   signal?.addEventListener('abort',onAbort,{once:true});
   req.on('data',onData);req.on('end',onEnd);req.on('error',onError);
   if(signal?.aborted){onAbort();return;}
  });
  const handler=createInspectionHandler({
   admission:()=>admission.closed!==true,
   authenticate:authenticateControl,
   verifyCustody:verifyCustodyDefault,
   openHost:({allocation,binding,hostIdentity:identity,authority,deadlineMs,signal})=>openHost({config,allocation,binding,
    hostIdentity:identity,authority,deadlineMs,signal,definitionsOwner,hierarchyPort:hierarchyPort??realHierarchyPort}),
   readBody:readBoundedBody,
   limits:{deadlineMaxMs:config.limits.deadlineMaxMs,bodyBytes:config.limits.bodyBytes,cleanupMs:config.limits.deadlineMaxMs,
    leaseDeadlineMs:config.allocation.leaseDeadlineMs,peerNotAfterMs:config.tls.peerNotAfterMs},
   onActivity:controller=>{active.add(controller);return()=>{active.delete(controller);if(active.size===0)notifyIdle();};}});
  // Handler construction, server construction and listen are ALL under the same cleanup ownership.
  // Bounded initial definition probe FIRST: the raw promise is RETAINED, so a probe outliving its bounded wait stays owned.
  let probeDone=false,probePending=false;
  const probeOnceWork=()=>{
   if(rawProbe===null)
    rawProbe=Promise.resolve().then(()=>definitionComposition.probe({signal:shutdownController.signal,
     deadlineMs:Date.now()+config.limits.deadlineMaxMs}))
     .then(value=>{probeDone=true;return value;},error=>{probeDone=true;throw error;});
   return rawProbe;
  };
  const probeLife=createOperationLifetime({deadlineMs:Date.now()+config.limits.deadlineMaxMs,now:Date.now,
   signal:shutdownController.signal,errorFactory:()=>Object.assign(Error('UPLOAD_DEFINITIONS_UNAVAILABLE'),
    {code:'UPLOAD_DEFINITIONS_UNAVAILABLE'})});
  try{await probeLife.run(()=>probeOnceWork());}
  catch(error){
   startupError=typeof error?.code==='string'?error.code:'UPLOAD_DEFINITIONS_UNAVAILABLE';
   if(probeDone!==true)probePending=true;
  }
  finally{probeLife.close();}
  if(probePending===true){
   // Unsettled initial verification: never expose the listener, never start provisioning on raw pending work.
   const cleanup=await startupCleanup(Date.now()+config.limits.deadlineMaxMs);
   return Object.freeze({started:false,readiness,error:'UPLOAD_DEFINITIONS_PENDING',cleanup:cleanup.closed?'removed':'unknown'});
  }
  startupState=definitionComposition.provisioningState();
  // Provisioning ownership is initialized BEFORE listen (one bounded attempt; its completion is not awaited here). The
  // callback is fenced HERE because its Promise.then may run after a factory/listen failure or an abort.
  const gatedProvision=async args=>{
   if(admission.closed===true||shutdownController.signal.aborted===true||args?.signal?.aborted===true||
    (Number.isSafeInteger(args?.deadlineMs)&&args.deadlineMs<=Date.now()))
    throw Object.assign(Error('NATIVE_PROCESSING_CLEANUP_UNKNOWN'),{code:'NATIVE_PROCESSING_CLEANUP_UNKNOWN'});
   return definitionComposition.provisionDefinitions(args);
  };
  if(admission.closed!==true){
   provisioning=beginUploadNativeProvisioning({handle:{inspection:Object.freeze({kind:'native-processing-host',
     endpoint:NATIVE_INSPECTION_PATH}),remote:false,host:{definitionsProvisioningState:definitionComposition.provisioningState},
     provisionDefinitions:gatedProvision},
    configuration:{uploads:{native:{provisionMs:NATIVE_PROVISION_MS}}},signal:shutdownController.signal});
  }
  // The FIXED lifecycle route shares this listener, authenticator, body reader and the REAL producer handle.
  const lifecycleHandler=createLifecycleHandler({authenticate:authenticateControl,readBody:readBoundedBody,
   lifecycle,config:{...config,allocation:{...config.allocation,instanceId:hostIdentity.instanceId,bootId:hostIdentity.bootId}},
   now:Date.now,maxRequestMs:Math.min(config.limits.deadlineMaxMs,30000),
   bodyBytes:Math.min(NATIVE_LIFECYCLE_BODY_BYTES,config.limits.bodyBytes),
   peerNotAfterMs:Math.min(config.tls.peerNotAfterMs,config.tls.cleanupCeilingMs??config.allocation.leaseDeadlineMs)});
  const route=(req,res)=>req?.url===NATIVE_LIFECYCLE_PATH
   ?lifecycleHandler(req,res):handler(req,res);
  // Only now may the handler be exposed.
  server=serverFactory({key,cert,ca,minVersion:'TLSv1.3',maxVersion:'TLSv1.3',requestCert:true,rejectUnauthorized:true},route);
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(config.listen.port,config.listen.address,resolve);});
 }catch(error){
  const cleanup=await startupCleanup(Date.now()+config.limits.deadlineMaxMs);
  return Object.freeze({started:false,readiness,error:typeof error?.code==='string'?error.code:'NATIVE_PROCESSING_LISTEN_FAILED',
   cleanup:cleanup.closed?'removed':'unknown'});
 }
 let closePromise=null;
 const closeOnce=()=>{
  closePromise??=(async()=>{
   // ONE deadline governs the quiesce wait, the listener close and the descriptor-disposal wait.
   const deadlineMs=Date.now()+config.limits.deadlineMaxMs;
   const remaining=()=>Math.max(1,deadlineMs-Date.now());
   const bounded=(promise)=>new Promise(resolve=>{
    const timer=setTimeout(()=>resolve({timedOut:true}),remaining());
    Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve({value});},
     error=>{clearTimeout(timer);resolve({error});});
   });
   let producer;
   try{
    producer=await lifecycle.close({schema:NATIVE_LIFECYCLE_SCHEMA,action:'close',allocation:canonicalAllocation,
     binding:config.binding,hostIdentity},{deadlineMs});
   }catch(error){producer={status:'unknown',code:error?.code??'NATIVE_PROCESSING_CLEANUP_UNKNOWN'};}
   // The listener stays alive through quiesce (the 80 route needs its socket) and closes only after truth.
   // The callback is the observation: only a clean close (or a canonical already-closed server) proves it.
   const serverOutcome=await bounded(new Promise(resolve=>{
    try{server.close(err=>resolve(err?(err.code==='ERR_SERVER_NOT_RUNNING'?true:false):true));}catch{resolve(false);}
   }));
   const disposal=await bounded(lifecycle.dispose());   // dispose() is itself cached/one-shot: observed, not duplicated
   const disposed=disposal.value??disposal.error;
   let hierarchyReleased=true;
   if(hierarchy!==null){
    const release=await bounded(releaseOwnedHierarchy({record:hierarchy,port:hierarchyPort??realHierarchyPort}));
    hierarchyReleased=release.value?release.value.unknown.length===0:false;
   }
   const closed=producer?.status==='closed'&&serverOutcome.value===true&&disposed?.closed===true&&hierarchyReleased;
   return Object.freeze(closed?{closed:true,quiescedAtMs:producer.quiescedAtMs}
    :{closed:false,code:'NATIVE_PROCESSING_CLEANUP_UNKNOWN'});
  })();
  return closePromise;
 };
 return Object.freeze({started:true,server,lifecycle,readiness,definitionComposition,definitionsLifecycle,definitionsOwner,
  provisioning,startupState,startupError,close:closeOnce});
}

export async function main({env=globalThis.process?.env??{},verifyCustody,onStarted}={}){
 const started=await startNativeProcessingHost({env,verifyCustody});
 if(started.started!==true){
  globalThis.process.stderr.write(JSON.stringify({ready:false,missing:started.readiness.missing}));
  globalThis.process.exitCode=3;
  return started;
 }
 // Bounded SIGTERM/SIGINT cleanup: active work is signalled and the listener closed before exit.
 let stopping=false;
 const stop=async()=>{
  if(stopping)return;stopping=true;
  let disposition=null;try{disposition=await started.close();}catch{}
  globalThis.process.exit(disposition?.closed===true?0:1);   // a cleanup unknown is a nonzero exit
 };
 globalThis.process.once('SIGTERM',stop);globalThis.process.once('SIGINT',stop);
 onStarted?.(started);
 return started;
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){main().catch(()=>{process.exitCode=3;});}
