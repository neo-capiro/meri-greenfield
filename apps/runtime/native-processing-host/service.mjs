/** One private, authenticated fixed upload-inspection operation on the native processing host.
 *
 * Body (Parent-owned canonical envelope; final validator not yet exported):
 *   {schema:'meri-native-upload-inspection/1', allocation, hostIdentity, binding, custody, request}
 * `request` is the EXISTING closed upload-inspection request, validated unchanged by `uploadInspectionRequest`. The TLS pin
 * is NOT upload authorization: without Parent's canonical verifier the handler refuses. Every refusal THROWS.
 */
import {uploadInspectionRequest,uploadInspectionBody,uploadInspectionResult,uploadInspectionFault} from '../uploads/agentcore-contract.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';

export const NATIVE_INSPECTION_SCHEMA='meri-native-upload-inspection/1';
export const NATIVE_INSPECTION_PATH='/internal/upload-inspection';
const BODY_KEYS=Object.freeze(['schema','allocation','hostIdentity','binding','custody','request']);
const fault=code=>{throw uploadInspectionFault(code);};
/** One idempotent cleanup promise per acquired owner, so a stale close call can never run twice. */
const cleanups=new WeakMap();
function cleanupOnce(host){
 let pending=cleanups.get(host);
 if(pending===undefined){
  pending=(async()=>{
   try{const value=await host.close();
    return value?.closed===true?{closed:true}:{closed:false,code:value?.code??'NATIVE_INSPECTION_CLEANUP_UNKNOWN'};}
   catch(error){return {closed:false,code:error?.code??'NATIVE_INSPECTION_CLEANUP_UNKNOWN'};}
  })();
  cleanups.set(host,pending);
 }
 return pending;
}
/** Bounded wait over an already-started promise. The timer is always cleared and the promise is never abandoned: a
 * later fulfillment is still handled by its own continuation. */
function boundedWait(promise,ms){
 return new Promise(resolve=>{
  let done=false;
  const timer=setTimeout(()=>{if(done)return;done=true;resolve({settled:false});},Math.max(1,ms));
  promise.then(value=>{if(done)return;done=true;clearTimeout(timer);resolve({settled:true,value});},
   error=>{if(done)return;done=true;clearTimeout(timer);resolve({settled:true,value:{closed:false,code:error?.code}});});
 });
}

/** Closed wire validation; the custody projection is opaque here and interpreted only by Parent's validator. */
export function nativeInspectionBody(raw){
 let value;
 try{
  if(raw===null||typeof raw!=='object'||Array.isArray(raw))fault('UPLOAD_INSPECTION_REQUEST_REFUSED');
  if(Object.keys(raw).some(key=>!BODY_KEYS.includes(key)))fault('UPLOAD_INSPECTION_REQUEST_REFUSED');
  if(raw.schema!==NATIVE_INSPECTION_SCHEMA||!raw.allocation||!raw.hostIdentity||!raw.binding||!raw.custody)
   fault('UPLOAD_INSPECTION_REQUEST_REFUSED');
  value=raw;
 }catch{fault('UPLOAD_INSPECTION_REQUEST_REFUSED');}
 const {request,bytes}=uploadInspectionRequest(value.request);
 return Object.freeze({allocation:value.allocation,hostIdentity:value.hostIdentity,binding:value.binding,
  custody:value.custody,request,bytes});
}

/** @param {{authenticate:Function,verifyCustody?:Function,openHost:Function,readBody:Function,limits:object,now?:Function}} input */
export function createInspectionHandler({authenticate,verifyCustody,openHost,readBody,limits,now=Date.now,onActivity}={}){
 if(typeof authenticate!=='function'||typeof openHost!=='function'||typeof readBody!=='function'||
  !limits||!Number.isSafeInteger(limits.deadlineMaxMs)||!Number.isSafeInteger(limits.bodyBytes))
  fault('NATIVE_INSPECTION_CONFIGURATION');
 return async function handle(req,res){
  const started=now();
  const controller=new AbortController();
  // HTTP `close` fires on NORMAL message completion too. Only a PREMATURE end (message not fully received, or the
  // response/socket destroyed before finish) is a cancellation; an ordinary completed body continues to inspection.
  const abort=()=>controller.abort();
  const onReqClose=()=>{if(req.complete!==true)abort();};
  const onResClose=()=>{if(!res.writableEnded)abort();};
  req?.once?.('aborted',abort);
  req?.once?.('close',onReqClose);
  res?.once?.('close',onResClose);
  const track=onActivity===undefined?null:onActivity(controller);
  let host=null,cleanupUnknown=false;
  const cleanupMs=Number.isSafeInteger(limits.cleanupMs)&&limits.cleanupMs>0?limits.cleanupMs:5000;
  const cleanupDeadline=()=>Math.max(1,(started+limits.deadlineMaxMs+cleanupMs)-now());
  const send=(status,payload)=>{try{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});
   res.end(JSON.stringify(payload));}catch{}};
  try{
   const life=createOperationLifetime({deadlineMs:started+limits.deadlineMaxMs,now,signal:controller.signal,
    errorFactory:uploadInspectionFault});
   try{
    if(req?.method!=='POST'||req?.url!==NATIVE_INSPECTION_PATH)fault('NATIVE_INSPECTION_ROUTE');
    if(req?.socket?.encrypted!==true)fault('NATIVE_INSPECTION_TLS');
    const length=Number(req.headers?.['content-length']);
    if(Number.isFinite(length)&&length>limits.bodyBytes)fault('UPLOAD_INSPECTION_REQUEST_REFUSED');
    const peer=await life.run(signal=>authenticate({socket:req.socket,headers:req.headers,deadlineMs:life.deadline(),signal}));
    if(peer?.verified!==true)fault('NATIVE_INSPECTION_PEER');
    if(typeof verifyCustody!=='function')fault('NATIVE_INSPECTION_CUSTODY_UNBOUND');
    // The trusted lease and the peer certificate expiry are part of ONE operation deadline, applied to the lifetime.
    const capped=Math.min(life.deadline(),Number.isSafeInteger(limits.leaseDeadlineMs)?limits.leaseDeadlineMs:Infinity,
     Number.isSafeInteger(peer.notAfterMs)?peer.notAfterMs:Infinity,
     Number.isSafeInteger(limits.peerNotAfterMs)?limits.peerNotAfterMs:Infinity);
    life.limitDeadline(capped);
    const raw=await life.run(signal=>readBody(req,limits.bodyBytes,life.deadline(),signal));
    let parsed;try{parsed=JSON.parse(raw.toString('utf8'));}catch{fault('UPLOAD_INSPECTION_REQUEST_REFUSED');}
    const body=nativeInspectionBody(parsed);
    if(body.request.imageDigest!==body.allocation?.imageDigest&&body.allocation?.imageDigest!==undefined)
     fault('NATIVE_INSPECTION_CUSTODY_REFUSED');
    const deadline=Math.min(body.request.deadlineMs,life.deadline());
    life.limitDeadline(deadline);
    const granted=await life.run(signal=>verifyCustody({allocation:body.allocation,hostIdentity:body.hostIdentity,
     binding:body.binding,custody:body.custody,request:body.request,peer,deadlineMs:deadline,signal}));
    if(granted?.authorized!==true)fault('NATIVE_INSPECTION_CUSTODY_REFUSED');
    // Setup is raced through the SAME lifetime, and its promise is retained: if it fulfills after this operation already
    // failed, the continuation below closes that owner exactly once instead of leaking it.
    let settled=false,lateCleanup=null;
    const pendingSetup=Promise.resolve().then(()=>openHost({allocation:granted.allocation??body.allocation,
      binding:granted.binding??body.binding,hostIdentity:granted.hostIdentity??body.hostIdentity,
      authority:granted.currentness,deadlineMs:deadline,signal:controller.signal}))
     .then(value=>{if(settled){lateCleanup=cleanupOnce(value);}else{host=value;}return value;});
    try{await life.run(()=>pendingSetup);}
    catch(setupError){
     settled=true;
     const target=host??null;
     if(target!==null){const result=await boundedWait(cleanupOnce(target),cleanupDeadline());if(result.settled!==true||result.value?.closed!==true)cleanupUnknown=true;}
     else if(lateCleanup!==null){const result=await boundedWait(lateCleanup,cleanupDeadline());if(result.settled!==true||result.value?.closed!==true)cleanupUnknown=true;}
     else cleanupUnknown=false;   // nothing acquired yet; the retained continuation still closes anything that arrives
     throw setupError;
    }
    settled=true;
    if(host===null)fault('NATIVE_INSPECTION_UNKNOWN');
    let out;
    try{out=await life.run(signal=>host.runRequest({requestDocument:body.request,deadlineMs:deadline,signal}));}
    catch(error){
     const code=error?.preDispatchCleanup?.unknown===true?'NATIVE_INSPECTION_CLEANUP_UNKNOWN':
      (typeof error?.code==='string'?error.code:'NATIVE_INSPECTION_UNKNOWN');
     fault(code);
    }
    let value;try{value=JSON.parse(Buffer.from(out?.stdout??out).toString('utf8'));}catch{fault('UPLOAD_INSPECTION_RESULT_REFUSED');}
    const closed=uploadInspectionResult(value,{requestId:body.request.requestId,declaration:body.request.declaration,
     imageDigest:body.request.imageDigest,fromMs:started,toMs:now()});
    life.check();
    // A success response requires this operation's own cleanup to be proven closed within the bounded window.
    const disposition=await boundedWait(cleanupOnce(host),cleanupDeadline());host=null;
    if(disposition.settled!==true||disposition.value?.closed!==true){cleanupUnknown=true;
     fault('NATIVE_INSPECTION_CLEANUP_UNKNOWN');}
    send(200,uploadInspectionBody({requestId:body.request.requestId,imageDigest:body.request.imageDigest,value:closed}));
   }finally{life.close();}
  }catch(error){
   if(host!==null){const result=await boundedWait(cleanupOnce(host),cleanupDeadline());host=null;
    if(result.settled!==true||result.value?.closed!==true)cleanupUnknown=true;}
   const code=cleanupUnknown?'NATIVE_INSPECTION_CLEANUP_UNKNOWN':
    (typeof error?.code==='string'?error.code:'NATIVE_INSPECTION_UNKNOWN');
   const status=code==='NATIVE_INSPECTION_ROUTE'?404:code==='NATIVE_INSPECTION_TLS'||code==='NATIVE_INSPECTION_PEER'?403:
    code==='NATIVE_INSPECTION_CUSTODY_UNBOUND'?503:code==='NATIVE_INSPECTION_CLEANUP_UNKNOWN'?503:400;
   send(status,{error:code});
  }finally{
   req?.removeListener?.('aborted',abort);
   req?.removeListener?.('close',onReqClose);
   res?.removeListener?.('close',onResClose);
   if(track!==null){try{track();}catch{}}
  }
 };
}
