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

/** The EXISTING lifecycle's own provisioning budget; never aliased to the inspection request deadline. */
const NATIVE_PROVISION_MS=120000;
import {createServer} from 'node:https';
import {nativeProcessingConfig} from './config.mjs';
import {createInspectionHandler,NATIVE_INSPECTION_PATH} from './service.mjs';
import {openNativeProcessingHost} from './bootstrap.mjs';
import {runDefinitionProgram} from '../uploads/native-definitions.mjs';
import {createUploadDefinitionsComposition} from '../uploads/composition.mjs';
import {beginUploadNativeProvisioning} from '../uploads/control-lifecycle.mjs';
import {createDefinitionSnapshotOwner} from './definitions-owner.mjs';
import {checkedCertificate,dnsName,fingerprint,privateAddress,sha256Der,tlsBytes} from '../../worker/conversation/host/control/tls.mjs';

export function nativeProcessingReadiness({config,verifyCustody}){
 const missing=[];
 if(config===null||typeof config!=='object')missing.push('configuration');
 if(typeof verifyCustody!=='function')missing.push('canonical.custody:pending-parent');
 return Object.freeze({ready:missing.length===0,missing:Object.freeze(missing),endpoint:NATIVE_INSPECTION_PATH,});
}

export async function startNativeProcessingHost({env=globalThis.process?.env??{},readFile=readFileSync,
 verifyCustody=undefined,openHost=openNativeProcessingHost,serverFactory=createServer,
 authenticatePeer=undefined,definitionsOwner:injectedOwner,definitionsRun:runDefinitions=runDefinitionProgram,
 config:configOverride}={}){
 const config=configOverride??nativeProcessingConfig({env});
 const readiness=nativeProcessingReadiness({config,verifyCustody});
 if(!readiness.ready)return Object.freeze({started:false,readiness});
 const key=tlsBytes(readFile(config.tls.keyPath)),cert=tlsBytes(readFile(config.tls.certPath)),ca=tlsBytes(readFile(config.tls.caPath));
 void ca;
 const active=new Set();
 // ONE host-lifetime definition composition: the SAME factored store/updater/serialized refresh the upload host uses,
 // plus the host pin owner. The child never gets an updater or prune authority.
 const definitionComposition=createUploadDefinitionsComposition({definitionsRoot:config.paths.definitionsRoot,
  now:Date.now,definitionsRun:runDefinitions});
 const definitionsOwner=injectedOwner===undefined?createDefinitionSnapshotOwner({definitions:definitionComposition.definitions}):injectedOwner;
 const definitionsLifecycle=Object.freeze({provision:definitionComposition.provisionDefinitions,
  refresh:definitionComposition.refresh,pin:args=>definitionsOwner.pin(args),
  pruneIfIdle:args=>definitionsOwner.pruneIfIdle(args)});
 privateAddress(config.listen.address);dnsName(config.tls.peerSan);
 // The CA is a trust anchor, not a leaf: it is passed to the TLS server as `ca` and must NOT be subjected to the peer
 // leaf SAN/15-minute-lifetime rules. The peer leaf is checked per connection in `authenticate`.
 const handler=createInspectionHandler({
  authenticate:authenticatePeer??(async({socket})=>{
   if(socket.encrypted!==true)return {verified:false};
   const raw=socket.getPeerCertificate?.(true);
   if(!raw||!Buffer.isBuffer(raw.raw))return {verified:false};
   const print=sha256Der(raw.raw);
   if(fingerprint(print)!==config.tls.peerFingerprint)return {verified:false};
   const checked=checkedCertificate(raw.raw,{name:config.tls.peerSan,nowMs:Date.now(),
    maxLifetimeMs:config.tls.maxPeerLifetimeMs,notAfterMs:config.tls.peerNotAfterMs});
   return {verified:true,fingerprintSha256:checked.fingerprintSha256,notAfterMs:checked.notAfterMs};
  }),
  verifyCustody,
  openHost:({allocation,binding,hostIdentity,authority,deadlineMs,signal})=>openHost({config,allocation,binding,
   hostIdentity,authority,deadlineMs,signal,definitionsOwner}),
  readBody:(req,limit,deadline,signal)=>new Promise((resolve,reject)=>{
   let total=0,finished=false;const chunks=[];
   const refuse=()=>Object.assign(Error('UPLOAD_INSPECTION_REQUEST_REFUSED'),{code:'UPLOAD_INSPECTION_REQUEST_REFUSED'});
   const detach=()=>{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);
    req.removeListener?.('data',onData);req.removeListener?.('end',onEnd);req.removeListener?.('error',onError);};
   const finish=(error,value)=>{if(finished)return;finished=true;detach();error?reject(error):resolve(value);};
   const timer=setTimeout(()=>{req.destroy?.();finish(refuse());},Math.max(1,deadline-Date.now()));
   const onAbort=()=>finish(refuse());
   const onData=chunk=>{if(finished)return;total+=chunk.length;
    if(total>limit){req.destroy?.();finish(refuse());return;}chunks.push(chunk);};
   const onEnd=()=>finish(null,Buffer.concat(chunks));
   const onError=error=>finish(error);
   signal?.addEventListener('abort',onAbort,{once:true});
   req.on('data',onData);req.on('end',onEnd);req.on('error',onError);
   if(signal?.aborted){onAbort();return;}   // attach first, then honour an already-aborted lifetime
  }),
  limits:{deadlineMaxMs:config.limits.deadlineMaxMs,bodyBytes:config.limits.bodyBytes,cleanupMs:config.limits.deadlineMaxMs,
   leaseDeadlineMs:config.allocation.leaseDeadlineMs,peerNotAfterMs:config.tls.peerNotAfterMs},
  onActivity:controller=>{active.add(controller);return()=>active.delete(controller);}});
 const server=serverFactory({key,cert,ca,minVersion:'TLSv1.3',maxVersion:'TLSv1.3',requestCert:true,rejectUnauthorized:true},handler);
 const shutdownController=new AbortController();
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(config.listen.port,config.listen.address,resolve);});
 // ACTUAL startup state: read the store once (freshness may refresh through the SAME serialized owner; corrupt,
 // unsigned or cancelled never fetches). The host may not consider an unprobed root fresh.
 let startupError=null;
 try{await definitionComposition.probe({signal:shutdownController.signal,deadlineMs:Date.now()+config.limits.deadlineMaxMs});}
 catch(error){startupError=typeof error?.code==='string'?error.code:'UPLOAD_DEFINITIONS_UNAVAILABLE';}
 const startupState=definitionComposition.provisioningState();
 // The EXISTING bounded provisioning lifecycle, composed (not re-implemented): its handle exposes this host's
 // definition state and provisioning port. It starts one bounded attempt and never runs on corrupt/unsigned input.
 const provisioning=beginUploadNativeProvisioning({handle:{inspection:Object.freeze({kind:'native-processing-host',
   endpoint:NATIVE_INSPECTION_PATH}),remote:false,host:{definitionsProvisioningState:definitionComposition.provisioningState},
   provisionDefinitions:definitionComposition.provisionDefinitions},
  configuration:{uploads:{native:{provisionMs:NATIVE_PROVISION_MS}}},signal:shutdownController.signal});
 return Object.freeze({started:true,server,readiness,definitionComposition,definitionsLifecycle,definitionsOwner,provisioning,startupState,startupError,
  close:()=>new Promise(resolve=>{
   // Shutdown signals active work to stop first, then closes the listener within one bounded settlement window.
   for(const controller of active){try{controller.abort();}catch{}}
   shutdownController.abort();                       // the held provisioning attempt is cancelled by the same lifetime
   const timer=setTimeout(()=>resolve({closed:false,code:'NATIVE_PROCESSING_CLEANUP_UNKNOWN'}),Math.max(1,config.limits.deadlineMaxMs));
   const settledProvisioning=Promise.resolve(provisioning?.completion??null).then(()=>true,()=>false);
   server.close(async()=>{const provisionClean=await settledProvisioning;clearTimeout(timer);
    resolve({closed:active.size===0&&provisionClean,pending:active.size});});
  })});
}

/** Executable CLI main: composes the production verifier (Parent's canonical export) when it is installed and otherwise
 * stops with the exact missing join. It is a real entrypoint, not an uninvoked factory. */
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

if(process.argv[1]&&process.argv[1].endsWith('entrypoint.mjs')){main().catch(()=>{process.exitCode=3;});}
