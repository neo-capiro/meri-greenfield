/** Production composition of the native processing host.
 *
 * Startup: validated owner configuration -> private pinned TLS1.3 listener with an exact short-lived Control peer SAN and
 * certificate fingerprint (existing `control/tls.mjs` validators; key material comes from the existing credential owner and
 * is never read or generated here) -> one finite processing placement (root bootstrap) -> the closed authenticated
 * inspection handler. No SDK, model proxy, provider environment or arbitrary command RPC exists on this host.
 *
 * Parent-owned pieces are referenced, not copied: the canonical allocation/currentness/custody envelope
 * (`authorize`, see service.mjs) and the CONTROL caller. Until Parent supplies that exact module, `startNativeProcessingHost`
 * keeps the listener closed and reports the missing import — it never falls back to an unauthenticated or unallocated path.
 */
import {readFileSync} from 'node:fs';
import {createServer} from 'node:https';
import {nativeProcessingConfig} from './config.mjs';
import {createInspectionHandler,NATIVE_INSPECTION_PATH} from './service.mjs';
import {fingerprint,sha256Der} from '../../worker/conversation/host/control/tls.mjs';
import {loadParentJoin,PARENT_JOIN_MODULE} from './parent-join.mjs';
import {runFixedInspection} from './inspection-child.mjs';

export function nativeProcessingReadiness({config,parent}){
 const missing=[];
 if(config===null||typeof config!=='object')missing.push('configuration');
 if(parent?.authorize?.available!==true)missing.push(`parent.authorize:${PARENT_JOIN_MODULE}`);
 if(parent?.placement?.available!==true)missing.push(`parent.placement:${PARENT_JOIN_MODULE}`);
 return Object.freeze({ready:missing.length===0,missing:Object.freeze(missing),endpoint:NATIVE_INSPECTION_PATH});
}

/** Exact Parent import needed (see HANDBACK-13): a module exporting
 *  - `authorize({requestId,imageDigest,declarationId,deadlineMs,signal}) -> {authorized:true,allocation,binding,currentness}`
 *  - `openPlacement({allocation,binding,hostIdentity,signal}) -> {placement,network,close}`
 *  Anything else is refused; nothing is synthesized from upload content. */
export async function startNativeProcessingHost({env=globalThis.process?.env??{},readFile=readFileSync,parent=loadParentJoin()}={}){
 const config=nativeProcessingConfig({env});
 const readiness=nativeProcessingReadiness({config,parent});
 if(!readiness.ready)return Object.freeze({started:false,readiness});
 const key=readFile(config.tls.keyPath),cert=readFile(config.tls.certPath);
 const placement=parent.placement;
 const handler=createInspectionHandler({
  authenticate:async({socket})=>{
   const raw=socket.getPeerCertificate(true);
   const der=raw?.raw;
   if(!Buffer.isBuffer(der))return {verified:false};
   const print=sha256Der(der);
   if(fingerprint(print)!==config.tls.peerFingerprint)return {verified:false};
   return {verified:true,fingerprintSha256:print};
  },
  runInspection:({request,deadlineMs})=>runFixedInspection({placement,config,deadlineMs,bytes:request.bytes,
   file:request.file}),
  readBody:async(req,limit)=>new Promise((resolve,reject)=>{
   let total=0;const chunks=[];
   req.on('data',chunk=>{total+=chunk.length;if(total>limit){reject(Object.assign(Error('NATIVE_INSPECTION_REQUEST'),{code:'NATIVE_INSPECTION_REQUEST'}));req.destroy();}else chunks.push(chunk);});
   req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject);
  }),
  limits:{deadlineMaxMs:config.limits.deadlineMaxMs,bodyBytes:config.limits.bodyBytes}});
 const server=createServer({key,cert,minVersion:'TLSv1.3',requestCert:true,rejectUnauthorized:true},handler);
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(config.listen.port,config.listen.address,resolve);});
 return Object.freeze({started:true,server,readiness,close:()=>new Promise(resolve=>server.close(()=>resolve({closed:true})))});
}
