/** One private, authenticated fixed upload-inspection operation on the native processing host.
 *
 * Wire body (Parent-owned canonical envelope, final validator NOT yet exported):
 *   {schema:'meri-native-upload-inspection/1', allocation, hostIdentity, binding, custody, request}
 * `request` is the EXISTING closed upload-inspection request, validated unchanged by `uploadInspectionRequest`; `custody`
 * is Parent's closed projection of saved upload identity/scopes/currentness. This module never invents a RunBinding, never
 * derives one from upload content, and never treats the TLS pin as authorization: without the canonical verifier the
 * handler refuses with NATIVE_INSPECTION_CUSTODY_UNBOUND.
 */
import {uploadInspectionRequest,uploadInspectionBody,uploadInspectionResult,uploadInspectionFault} from '../uploads/agentcore-contract.mjs';

export const NATIVE_INSPECTION_SCHEMA='meri-native-upload-inspection/1';
export const NATIVE_INSPECTION_PATH='/internal/upload-inspection';
const BODY_KEYS=Object.freeze(['schema','allocation','hostIdentity','binding','custody','request']);
const fault=(code)=>uploadInspectionFault(code);

/** Closed wire validation. The custody projection is deliberately opaque here: only Parent's validator interprets it. */
export function nativeInspectionBody(raw){
 let value;try{
  if(raw===null||typeof raw!=='object'||Array.isArray(raw))fault('UPLOAD_INSPECTION_REQUEST_REFUSED');
  if(Object.keys(raw).some(key=>!BODY_KEYS.includes(key)))fault('UPLOAD_INSPECTION_REQUEST_REFUSED');
  if(raw.schema!==NATIVE_INSPECTION_SCHEMA||!raw.allocation||!raw.hostIdentity||!raw.binding||!raw.custody)fault('UPLOAD_INSPECTION_REQUEST_REFUSED');
  value=raw;
 }catch{fault('UPLOAD_INSPECTION_REQUEST_REFUSED');}
 const {request,bytes}=uploadInspectionRequest(value.request);
 return Object.freeze({allocation:value.allocation,hostIdentity:value.hostIdentity,binding:value.binding,
  custody:value.custody,request,bytes});
}

/** Build the HTTP handler. `verifyCustody` is the Parent canonical export (unbound today), `openHost` is the CAP bootstrap,
 *  `authenticate` is the TLS1.3 peer check. All work is bounded by ONE operation lifetime. */
export function createInspectionHandler({authenticate,verifyCustody,openHost,readBody,limits,now=Date.now}={}){
 if(typeof authenticate!=='function'||typeof openHost!=='function'||typeof readBody!=='function'||
  !limits||!Number.isSafeInteger(limits.deadlineMaxMs)||!Number.isSafeInteger(limits.bodyBytes))
  fault('NATIVE_INSPECTION_CONFIGURATION');
 return async function handle(req,res){
  const started=now();
  const deadline=started+limits.deadlineMaxMs;
  const send=(status,payload)=>{try{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});
   res.end(JSON.stringify(payload));}catch{}};
  try{
   if(req?.method!=='POST'||req?.url!==NATIVE_INSPECTION_PATH)fault('NATIVE_INSPECTION_ROUTE');
   if(req?.socket?.encrypted!==true)fault('NATIVE_INSPECTION_TLS');
   const length=Number(req.headers?.['content-length']);
   if(Number.isFinite(length)&&length>limits.bodyBytes)fault('UPLOAD_INSPECTION_REQUEST_REFUSED');
   const peer=await authenticate({socket:req.socket,headers:req.headers,deadlineMs:deadline});
   if(peer?.verified!==true)fault('NATIVE_INSPECTION_PEER');
   if(typeof verifyCustody!=='function')fault('NATIVE_INSPECTION_CUSTODY_UNBOUND');
   const raw=await readBody(req,limits.bodyBytes,deadline);
   let parsed;try{parsed=JSON.parse(raw.toString('utf8'));}catch{fault('UPLOAD_INSPECTION_REQUEST_REFUSED');}
   const body=nativeInspectionBody(parsed);
   // Parent's canonical validator decides whether this exact allocation/purpose/binding/custody is currently authorized.
   const granted=await verifyCustody({allocation:body.allocation,hostIdentity:body.hostIdentity,binding:body.binding,
    custody:body.custody,request:body.request,peer,deadlineMs:Math.min(body.request.deadlineMs,deadline)});
   if(granted?.authorized!==true)fault('NATIVE_INSPECTION_CUSTODY_REFUSED');
   const host=await openHost({allocation:granted.allocation??body.allocation,binding:granted.binding??body.binding,
    hostIdentity:granted.hostIdentity??body.hostIdentity,authority:granted.currentness,deadlineMs:Math.min(body.request.deadlineMs,deadline)});
   let out;
   try{
    out=await host.runRequest({requestDocument:body.request,deadlineMs:Math.min(body.request.deadlineMs,deadline)});
   }catch(error){
    // The child's group is settled by the placement runner; retain an honest unknown instead of a success or a bare kill.
    const cleanup=error?.preDispatchCleanup?.unknown===true?'NATIVE_INSPECTION_CLEANUP_UNKNOWN':null;
    fault(cleanup??(typeof error?.code==='string'?error.code:'NATIVE_INSPECTION_UNKNOWN'));
   }
   let value;try{value=JSON.parse(Buffer.from(out?.stdout??out).toString('utf8'));}catch{fault('UPLOAD_INSPECTION_RESULT_REFUSED');}
   const closed=uploadInspectionResult(value,{requestId:body.request.requestId,declaration:body.request.declaration,
    imageDigest:body.request.imageDigest,fromMs:started,toMs:now()});
   send(200,uploadInspectionBody({requestId:body.request.requestId,imageDigest:body.request.imageDigest,value:closed}));
  }catch(error){
   const code=typeof error?.code==='string'?error.code:'NATIVE_INSPECTION_UNKNOWN';
   const status=code==='NATIVE_INSPECTION_ROUTE'?404:code==='NATIVE_INSPECTION_TLS'||code==='NATIVE_INSPECTION_PEER'?403:
    code==='NATIVE_INSPECTION_CUSTODY_UNBOUND'?503:400;
   send(status,{error:code});
  }
 };
}
