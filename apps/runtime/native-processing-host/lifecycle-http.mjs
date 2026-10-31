/** FIXED authenticated lifecycle route on the EXISTING native TLS listener. One closed POST, one closed body, one per-request
 *  bounded lifetime. It never joins the inspection activity set and never calls server.close/dispose: the response must be sent
 *  while the listener is still alive so the supervisor can read the proof. */
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {NATIVE_LIFECYCLE_PATH,NATIVE_LIFECYCLE_SCHEMA,NATIVE_LIFECYCLE_MAX_MS,NATIVE_LIFECYCLE_BODY_BYTES,
 nativeLifecycleRequest} from './lifecycle-contract.mjs';

const fault=code=>{throw Object.assign(new Error(code),{code});};
const VALIDATION=new Set(['NATIVE_LIFECYCLE_REFUSED','NATIVE_LIFECYCLE_REQUEST_REFUSED','HOST_BINDING_REFUSED',
 'HOST_IDENTITY_REFUSED','HOST_ALLOCATION_REFUSED']);
const statusFor=code=>VALIDATION.has(code)?400
 :code==='NATIVE_LIFECYCLE_CONFIGURATION'?500
 :code==='NATIVE_LIFECYCLE_CANCELLED'?408
 :code==='UPLOAD_INSPECTION_REQUEST_REFUSED'?413
 :code==='NATIVE_LIFECYCLE_UNKNOWN'||code==='NATIVE_LIFECYCLE_CLEANUP_UNKNOWN'?503:503;

/** @param {{authenticate:Function,readBody:Function,lifecycle:object,config:object,now?:Function,
 *  maxRequestMs?:number,bodyBytes?:number}} input */
export function createLifecycleHandler({authenticate,readBody,lifecycle,config,now=Date.now,
 maxRequestMs=NATIVE_LIFECYCLE_MAX_MS,bodyBytes=NATIVE_LIFECYCLE_BODY_BYTES,peerNotAfterMs}={}){
 if(typeof authenticate!=='function'||typeof readBody!=='function'||typeof now!=='function'||
  typeof lifecycle?.close!=='function'||typeof lifecycle?.processes!=='function'||typeof lifecycle?.observe!=='function'||
  config===null||typeof config!=='object'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||
  maxRequestMs>NATIVE_LIFECYCLE_MAX_MS||!Number.isSafeInteger(bodyBytes)||bodyBytes<1)
  fault('NATIVE_LIFECYCLE_CONFIGURATION');
 return async function handle(req,res){
  const controller=new AbortController();
  const onReqClose=()=>{if(req.complete!==true)controller.abort();};
  const onResClose=()=>{if(!res.writableEnded)controller.abort();};
  const onAbort=()=>controller.abort();
  req?.once?.('aborted',onAbort);req?.once?.('close',onReqClose);res?.once?.('close',onResClose);
  const detach=()=>{req?.removeListener?.('aborted',onAbort);req?.removeListener?.('close',onReqClose);
   res?.removeListener?.('close',onResClose);};
  const send=(status,body)=>{if(res.writableEnded||res.headersSent)return;
   // Serialize EXACTLY once and send those same UTF-8 bytes with an exact content-length. Without the length
   // Node framed the response as transfer-encoding:chunked, which the strict Control client (and a metadata
   // cache) cannot accept. Status, content-type, error mapping and lifetime behavior are unchanged.
   let text;try{text=JSON.stringify(body);}catch{text='{"error":"NATIVE_LIFECYCLE_UNKNOWN"}';}
   if(typeof text!=='string')text='{"error":"NATIVE_LIFECYCLE_UNKNOWN"}';
   const bytes=Buffer.from(text,'utf8');
   try{res.writeHead(status,{'content-type':'application/json','content-length':String(bytes.length)});res.end(bytes);}catch{}};
  // ONE per-request lifetime, started at ENTRY from now()+maxRequestMs with the caller/disconnect signal.
  let life=null;
  try{
   const entryCap=Number.isSafeInteger(peerNotAfterMs)?peerNotAfterMs:Infinity;
   life=createOperationLifetime({deadlineMs:Math.min(now()+maxRequestMs,entryCap),now,signal:controller.signal,
    errorFactory:()=>Object.assign(Error('NATIVE_LIFECYCLE_CANCELLED'),{code:'NATIVE_LIFECYCLE_CANCELLED'})});
   if(req?.method!=='POST'){send(405,{error:'METHOD_NOT_ALLOWED'});return;}
   if(req?.url!==NATIVE_LIFECYCLE_PATH){send(404,{error:'NOT_FOUND'});return;}
   if(req?.socket?.encrypted!==true){send(401,{error:'UNAUTHORIZED'});return;}
   const peer=await life.run(signal=>authenticate({socket:req.socket,headers:req.headers,
    deadlineMs:life.deadline(),signal}));
   if(peer?.verified!==true){send(401,{error:'UNAUTHORIZED'});return;}
   life.check();
   // The SAME budget is only NARROWED by the authenticated peer expiry and the protected peerNotAfter bound; maxRequestMs is
   // never reset after authentication and cleanup is never capped by an expired allocation lease.
   // The verified peer expiry NARROWS the existing lifetime (no second timer, no reset of maxRequestMs).
   if(Number.isSafeInteger(peer.notAfterMs))life.limitDeadline(peer.notAfterMs);
   const deadlineMs=life.deadline();
   if(deadlineMs<=now())fault('NATIVE_LIFECYCLE_CANCELLED');
   const bytes=await life.run(()=>readBody(req,bodyBytes,deadlineMs,life.signal));
   let parsed;
   try{parsed=JSON.parse(Buffer.isBuffer(bytes)?bytes.toString('utf8'):String(bytes ?? ''));}
   catch{fault('NATIVE_LIFECYCLE_REFUSED');}
   const validated=nativeLifecycleRequest(parsed,{config});
   // nativeLifecycleRequest returns the INTERNAL record without a wire schema: reassemble the closed canonical envelope the
   // actual producer revalidates.
   const request=Object.freeze({schema:NATIVE_LIFECYCLE_SCHEMA,action:validated.action,
    allocation:validated.allocation,binding:validated.binding,hostIdentity:validated.hostIdentity});
   const result=await life.run(()=>lifecycle[validated.action](request,{signal:life.signal,deadlineMs}));
   life.check();
   send(200,result);
  }catch(error){
   const code=typeof error?.code==='string'?error.code:'NATIVE_LIFECYCLE_UNKNOWN';
   const publicCode=VALIDATION.has(code)?'NATIVE_LIFECYCLE_REFUSED'
    :statusFor(code)===503?'NATIVE_LIFECYCLE_UNKNOWN':code;
   send(statusFor(code),{error:publicCode});
  }finally{
   try{life?.close();}catch{}
   detach();
  }
 };
}
