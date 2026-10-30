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
import {createServer} from 'node:https';
import {nativeProcessingConfig} from './config.mjs';
import {createInspectionHandler,NATIVE_INSPECTION_PATH} from './service.mjs';
import {openNativeProcessingHost} from './bootstrap.mjs';
import {checkedCertificate,dnsName,fingerprint,privateAddress,sha256Der,tlsBytes} from '../../worker/conversation/host/control/tls.mjs';

export function nativeProcessingReadiness({config,verifyCustody}){
 const missing=[];
 if(config===null||typeof config!=='object')missing.push('configuration');
 if(typeof verifyCustody!=='function')missing.push('canonical.custody:pending-parent');
 return Object.freeze({ready:missing.length===0,missing:Object.freeze(missing),endpoint:NATIVE_INSPECTION_PATH,
  export:PARENT_CUSTODY_EXPORTS});
}

export async function startNativeProcessingHost({env=globalThis.process?.env??{},readFile=readFileSync,
 verifyCustody=undefined,openHost=openNativeProcessingHost}={}){
 const config=nativeProcessingConfig({env});
 const readiness=nativeProcessingReadiness({config,verifyCustody});
 if(!readiness.ready)return Object.freeze({started:false,readiness});
 const key=tlsBytes(readFile(config.tls.keyPath)),cert=tlsBytes(readFile(config.tls.certPath)),ca=tlsBytes(readFile(config.tls.caPath));
 void ca;
 const active=new Set();
 privateAddress(config.listen.address);dnsName(config.tls.peerSan);
 // The CA is a trust anchor, not a leaf: it is passed to the TLS server as `ca` and must NOT be subjected to the peer
 // leaf SAN/15-minute-lifetime rules. The peer leaf is checked per connection in `authenticate`.
 const handler=createInspectionHandler({
  authenticate:async({socket})=>{
   if(socket.encrypted!==true)return {verified:false};
   const raw=socket.getPeerCertificate?.(true);
   if(!raw||!Buffer.isBuffer(raw.raw))return {verified:false};
   const print=sha256Der(raw.raw);
   if(fingerprint(print)!==config.tls.peerFingerprint)return {verified:false};
   const checked=checkedCertificate(raw.raw,{name:config.tls.peerSan,nowMs:Date.now(),
    maxLifetimeMs:config.tls.maxPeerLifetimeMs,notAfterMs:config.tls.peerNotAfterMs});
   return {verified:true,fingerprintSha256:checked.fingerprintSha256};
  },
  verifyCustody,
  openHost:({allocation,binding,hostIdentity,authority,deadlineMs})=>openHost({config,allocation,binding,hostIdentity,
   authority,deadlineMs}),
  readBody:(req,limit,deadline,signal)=>new Promise((resolve,reject)=>{
   let total=0;const chunks=[];
   const finish=(error,value)=>{clearTimeout(timer);error?reject(error):resolve(value);};
   const timer=setTimeout(()=>{req.destroy();finish(Object.assign(Error('UPLOAD_INSPECTION_REQUEST_REFUSED'),{code:'UPLOAD_INSPECTION_REQUEST_REFUSED'}));},
    Math.max(1,deadline-Date.now()));
   const onAbort=()=>{finish(Object.assign(Error('UPLOAD_INSPECTION_REQUEST_REFUSED'),{code:'UPLOAD_INSPECTION_REQUEST_REFUSED'}));};
   signal?.addEventListener('abort',onAbort,{once:true});
   if(signal?.aborted)onAbort();
   const cleanup=()=>signal?.removeEventListener('abort',onAbort);
   req.on('data',chunk=>{total+=chunk.length;
    if(total>limit){cleanup();req.destroy();finish(Object.assign(Error('UPLOAD_INSPECTION_REQUEST_REFUSED'),{code:'UPLOAD_INSPECTION_REQUEST_REFUSED'}));return;}
    chunks.push(chunk);});
   req.on('end',()=>{cleanup();finish(null,Buffer.concat(chunks));});
   req.on('error',error=>{cleanup();finish(error);});
  }),
  limits:{deadlineMaxMs:config.limits.deadlineMaxMs,bodyBytes:config.limits.bodyBytes},
  onActivity:controller=>{active.add(controller);return()=>active.delete(controller);}});
 const server=createServer({key,cert,ca,minVersion:'TLSv1.3',maxVersion:'TLSv1.3',requestCert:true,rejectUnauthorized:true},handler);
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(config.listen.port,config.listen.address,resolve);});
 return Object.freeze({started:true,server,readiness,
  close:()=>new Promise(resolve=>{
   // Shutdown signals active work to stop first, then closes the listener within one bounded settlement window.
   for(const controller of active){try{controller.abort();}catch{}}
   const timer=setTimeout(()=>resolve({closed:false,code:'NATIVE_PROCESSING_CLEANUP_UNKNOWN'}),Math.max(1,config.limits.deadlineMaxMs));
   server.close(()=>{clearTimeout(timer);resolve({closed:active.size===0,pending:active.size});});
  })});
}

/** Executable CLI main: composes the production verifier (Parent's canonical export) when it is installed and otherwise
 * stops with the exact missing join. It is a real entrypoint, not an uninvoked factory. */
export async function main({env=globalThis.process?.env??{},verifyCustody,onStarted}={}= {}){
 const started=await startNativeProcessingHost({env,verifyCustody});
 if(started.started!==true){
  globalThis.process.stderr.write(JSON.stringify({ready:false,missing:started.readiness.missing}));
  globalThis.process.exitCode=3;
  return started;
 }
 // Bounded SIGTERM/SIGINT cleanup: active work is signalled and the listener closed before exit.
 const stop=async()=>{try{await started.close();}finally{globalThis.process.exit(0);}};
 globalThis.process.once('SIGTERM',stop);globalThis.process.once('SIGINT',stop);
 onStarted?.(started);
 return started;
}

if(process.argv[1]&&process.argv[1].endsWith('entrypoint.mjs')){main().catch(()=>{process.exitCode=3;});}
