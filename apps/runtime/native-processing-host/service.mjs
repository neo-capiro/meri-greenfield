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
/** Bounded settlement of a setup owner that resolved after the operation already failed. */
async function settleLateOwner(pending,ms){
 let host=null;let settled=true;
 try{host=await Promise.race([pending,new Promise(resolve=>setTimeout(()=>resolve(undefined),ms))]);}
 catch{return 'unsettled';}
 if(host===undefined)return 'unsettled';
 try{const out=await Promise.race([host.close(),new Promise(resolve=>setTimeout(()=>resolve({closed:false}),ms))]);
  settled=out?.closed===true;}catch{settled=false;}
 return settled?'closed':'unsettled';
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
 }catch(error){if(error?.code)fault('UPLOAD_INSPECTION_REQUEST_REFUSED');fault('UPLOAD_INSPECTION_REQUEST_REFUSED');}
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
  const send=(status,payload)=>{try{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});
   res.end(JSON.stringify(payload));}catch{}};
  let host=null,cleanupUnknown=false;
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
    const raw=await life.run(signal=>readBody(req,limits.bodyBytes,life.deadline(),signal));
    let parsed;try{parsed=JSON.parse(raw.toString('utf8'));}catch{fault('UPLOAD_INSPECTION_REQUEST_REFUSED');}
    const body=nativeInspectionBody(parsed);
    // The request deadline is folded into the same lifetime, so authority/setup cannot outlive the request.
    const deadline=Math.min(body.request.deadlineMs,life.deadline(),limits.leaseDeadlineMs??Infinity);
    const granted=await life.run(signal=>verifyCustody({allocation:body.allocation,hostIdentity:body.hostIdentity,
     binding:body.binding,custody:body.custody,request:body.request,peer,deadlineMs:deadline,signal}));
    if(granted?.authorized!==true)fault('NATIVE_INSPECTION_CUSTODY_REFUSED');
    // Late setup: if the lifetime rejects while setup is still running, keep the pending owner and unwind whatever it
    // eventually returns inside a separate bounded cleanup window. Nothing clean is reported while ownership is unsettled.
    const pendingSetup=Promise.resolve().then(()=>openHost({allocation:granted.allocation??body.allocation,
     binding:granted.binding??body.binding,hostIdentity:granted.hostIdentity??body.hostIdentity,
     authority:granted.currentness,deadlineMs:deadline,signal:controller.signal}));
    try{host=await pendingSetup;}
    catch(error){
     const late=await settleLateOwner(pendingSetup,limits.cleanupMs??5000);
     if(late!=='closed'){cleanupUnknown=true;fault('NATIVE_INSPECTION_CLEANUP_UNKNOWN');}
     throw error;
    }
    let out;
    try{out=await life.run(signal=>host.runRequest({requestDocument:body.request,deadlineMs:deadline,signal}));}
    catch(error){
     // The placement runner already settled the group; retain an honest unknown rather than a success or a bare kill.
     const code=error?.preDispatchCleanup?.unknown===true?'NATIVE_INSPECTION_CLEANUP_UNKNOWN':
      (typeof error?.code==='string'?error.code:'NATIVE_INSPECTION_UNKNOWN');
     fault(code);
    }
    let value;try{value=JSON.parse(Buffer.from(out?.stdout??out).toString('utf8'));}catch{fault('UPLOAD_INSPECTION_RESULT_REFUSED');}
    const closed=uploadInspectionResult(value,{requestId:body.request.requestId,declaration:body.request.declaration,
     imageDigest:body.request.imageDigest,fromMs:started,toMs:now()});
    // A success response is only sent when the owned operation's own cleanup succeeded.
    if(host!==null){const disposition=await host.close();host=null;
     if(disposition?.closed!==true){cleanupUnknown=true;fault('NATIVE_INSPECTION_CLEANUP_UNKNOWN');}}
    send(200,uploadInspectionBody({requestId:body.request.requestId,imageDigest:body.request.imageDigest,value:closed}));
   }finally{life.close();}
  }catch(error){
   if(host!==null){try{const disposition=await host.close();if(disposition?.closed!==true)cleanupUnknown=true;}
    catch{cleanupUnknown=true;}host=null;}
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
