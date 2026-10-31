/** Pinned, authenticated CONTROL -> fixed native processing host transport for the closed upload-inspection operation.
 * Real custody interface: `inspect(declaration, exactBytes, {deadlineMs, signal, custodyContext})` where custodyContext is
 * the saved-upload owner's `{record, current, assertCurrent}`. The fresh authority is re-read here, the canonical custody
 * projection is DERIVED from the record plus that fresh current value, and only the closed 4-field declaration and the
 * exact original bytes are serialized. Nothing credential-like or closure-like crosses the wire. */
import {randomBytes} from 'node:crypto';
import {uploadInspectionRequest,uploadInspectionResult} from './agentcore-contract.mjs';
import {inspectUploadOriginal,uploadDeclaration,uploadHash} from '../../control/uploads/policy.mjs';
import {NATIVE_UPLOAD_INSPECTION_PATH,NATIVE_UPLOAD_INSPECTION_SCHEMA,nativeUploadCustody} from './native-host-contract.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {dnsName,fingerprint,privateAddress} from '../../worker/conversation/host/control/tls.mjs';
import {assertNativeProcessingAllocation,assertHostRunBinding,assertD005HostIdentity} from '../../worker/conversation/host/binding.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';

const fault=code=>{throw Object.assign(new Error(code),{code});};
const CLEANUP_WINDOW_MS=5000;
const TIMEOUT=Symbol('timeout');
async function raceUntil(promise,at,now){
 let timer;
 const work=Promise.resolve(promise).then(value=>({ok:true,value}),error=>({ok:false,error}));
 const stop=new Promise(resolve=>{timer=setTimeout(()=>resolve(TIMEOUT),Math.max(1,at-now()));});
 try{const raced=await Promise.race([work,stop]);
  return raced===TIMEOUT?{ok:false,error:faultOf('UPLOAD_INSPECTION_CANCELLED'),timedOut:true}:raced;}
 finally{clearTimeout(timer);}
}
const faultOf=code=>Object.assign(new Error(code),{code});
/** Canonical acknowledgement only: exactly {closed:true}. */
async function closeEstablished(client,at,now){
 if(typeof client?.close!=='function')return false;
 let closing;try{closing=Promise.resolve(client.close());}catch{return false;}
 closing.catch(()=>{});
 const raced=await raceUntil(closing,at,now);
 return raced.ok===true&&typeof raced.value==='object'&&raced.value!==null&&raced.value.closed===true;
}
export const UPLOAD_NATIVE_WIRE_LIMIT=16*1024*1024;

export function createNativeHostInspectionClient({endpoint,allocation,hostIdentity,binding,imageDigest,now=Date.now,
 maxRequestMs=3000,connect}={}){
 const e=endpoint??{};
 privateAddress(e.address);dnsName(e.serverName);fingerprint(e.serverFingerprintSha256);
 if(!Number.isSafeInteger(e.port)||e.port<1||e.port>65535)fault('UPLOAD_NATIVE_TRANSPORT_CONFIGURATION');
 if(typeof connect!=='function'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||
  maxRequestMs<1||maxRequestMs>30000||typeof imageDigest!=='string')fault('UPLOAD_NATIVE_TRANSPORT_CONFIGURATION');
 const pinned=assertNativeProcessingAllocation(allocation),identity=assertD005HostIdentity(hostIdentity,
  assertHostRunBinding(pinned,binding),pinned);
 return Object.freeze({
  native:true,
  async inspect(declaration,bytes,{deadlineMs,signal,custodyContext}={}){
   const began=now();
   let until=Math.min(Number.isSafeInteger(deadlineMs)?deadlineMs:began+maxRequestMs,began+maxRequestMs,
    pinned.leaseDeadlineMs);
   if(signal?.aborted===true)fault('UPLOAD_INSPECTION_CANCELLED');
   if(until<=began)fault('UPLOAD_INSPECTION_EXPIRED');
   // Validate the ORIGINAL bytes/declaration, but keep the wire declaration closed and unenriched.
   const original=inspectUploadOriginal(declaration,Buffer.isBuffer(bytes)?bytes:Buffer.alloc(0));
   const closed={filename:String(declaration.filename),mimeType:String(declaration.mimeType),
    bytes:Number(declaration.bytes),sha256:String(declaration.sha256)};
   uploadDeclaration(closed);
   void original;
   const context=custodyContext;
   if(context===undefined||typeof context.assertCurrent!=='function'||context.record===undefined||context.current===undefined)
    fault('UPLOAD_NATIVE_CUSTODY_REQUIRED');
   const life=createOperationLifetime({now,deadlineMs:until,signal,errorFactory:()=>
    Object.assign(Error('UPLOAD_INSPECTION_CANCELLED'),{code:'UPLOAD_INSPECTION_CANCELLED'})});

   try{
    // The saved row's CURRENT decision is re-read through its own owner; the freshly returned value is authoritative.
    const fresh=await life.run(()=>Promise.resolve(context.assertCurrent()));
    life.check();
    assertNativeConversationScope({binding:fresh.binding,scopes:fresh.scopes,selectedClientId:fresh.selectedClientId});
    // Canonical equality: identical authority must not be revoked by object-key insertion order.
    // Existing canonical digest (key-order independent) - no bespoke sorted-JSON comparator.
    if(canonicalSha256({binding:fresh.binding,scopes:fresh.scopes,selectedClientId:fresh.selectedClientId})!==
     canonicalSha256({binding:context.current.binding,scopes:context.current.scopes,
      selectedClientId:context.current.selectedClientId}))fault('UPLOAD_AUTHORITY_CHANGED');
    if(!Number.isSafeInteger(fresh.expiresAtMs)||fresh.expiresAtMs<=now())fault('UPLOAD_INSPECTION_CUSTODY_REFUSED');
    // The FRESH custody expiry narrows the actual lifetime used for connect/request/send.
    until=Math.min(until,fresh.expiresAtMs);
    life.limitDeadline(until);            // the ACTUAL lifetime now ends at the fresh custody expiry
    if(until<=now())fault('UPLOAD_INSPECTION_CUSTODY_REFUSED');
    const custody=nativeUploadCustody(context.record,{binding:fresh.binding,scopes:fresh.scopes,
     selectedClientId:fresh.selectedClientId,checkedAtMs:began,expiresAtMs:Math.min(fresh.expiresAtMs,until)});
    const requestId=randomBytes(32).toString('hex');
    // The request body carries the ORIGINAL closed declaration and the EXACT original bytes.
    const request=uploadInspectionRequest({kind:'upload-inspection',requestId,imageDigest,declaration:closed,
     bytesBase64:Buffer.from(bytes).toString('base64'),inputSha256:uploadHash(bytes),deadlineMs:until}).request;
    const payload=Buffer.from(JSON.stringify({schema:NATIVE_UPLOAD_INSPECTION_SCHEMA,allocation:pinned,
     hostIdentity:identity,binding:fresh.binding,custody,request}));
    if(payload.length>UPLOAD_NATIVE_WIRE_LIMIT)fault('UPLOAD_INSPECTION_REQUEST_REFUSED');
    life.check();
    if(typeof hostIdentity?.bootId!=='string')fault('UPLOAD_NATIVE_TRANSPORT_CONFIGURATION');
    // RAW acquisition retained for late cleanup AND raced under the shared lifetime: no dispatch after cancel.
    const acquisition=(async()=>{life.check();return connect({address:e.address,port:e.port,serverName:e.serverName,
     serverFingerprintSha256:e.serverFingerprintSha256,signal:life.signal,deadlineMs:until});})();
    acquisition.catch(()=>{});
    const acquired=await raceUntil(life.run(()=>acquisition),until,now);
    if(acquired.ok!==true){
     if(acquired.error?.code!=='UPLOAD_INSPECTION_CANCELLED')
      throw faultOf('UPLOAD_NATIVE_TRANSPORT_CONFIGURATION');
     const cleanupAt=now()+CLEANUP_WINDOW_MS;
     const late=await raceUntil(acquisition,cleanupAt,now);
     let established=true;
     if(late.ok===true)established=await closeEstablished(late.value,cleanupAt,now);
     else{acquisition.then(value=>{Promise.resolve().then(()=>value?.close?.()).catch(()=>{});}).catch(()=>{});
      established=false;}
     throw established?faultOf('UPLOAD_INSPECTION_CANCELLED'):faultOf('UPLOAD_INSPECTION_CLEANUP_UNKNOWN');
    }
    const wire=acquired.value;
    let receipt;
    try{
     life.check();
     if(typeof wire?.send!=='function')fault('UPLOAD_NATIVE_TRANSPORT_REFUSED');
     receipt=await raceUntil(life.run(()=>Promise.resolve(wire.send({path:NATIVE_UPLOAD_INSPECTION_PATH,body:payload,
      signal:life.signal,deadlineMs:until}))),until,now);
    }catch(error){
     const cleanupAt=now()+CLEANUP_WINDOW_MS;
     if(!await closeEstablished(wire,cleanupAt,now))throw faultOf('UPLOAD_INSPECTION_CLEANUP_UNKNOWN');
     throw error;
    }
    // Positive result only after KNOWN cleanup: exactly once, canonical acknowledgement.
    if(!await closeEstablished(wire,now()+CLEANUP_WINDOW_MS,now))throw faultOf('UPLOAD_INSPECTION_CLEANUP_UNKNOWN');
    if(receipt.ok!==true)throw receipt.error;
    const response=receipt.value;
    life.check();
    if(response?.status!==200){
     let code='UPLOAD_INSPECTION_REFUSED';
     try{code=JSON.parse(Buffer.isBuffer(response.body)?response.body.toString('utf8'):response.body).error??code;}catch{}
     fault(code);
    }
    let parsed;try{parsed=JSON.parse(Buffer.isBuffer(response.body)?response.body.toString('utf8'):response.body);}
    catch{fault('UPLOAD_INSPECTION_RESULT_REFUSED');}
    const result=uploadInspectionResult(parsed,{requestId,declaration:closed,imageDigest,fromMs:began,toMs:now()});
    return Object.freeze({file:result.file,scan:result.scan,extraction:result.extraction});
   }finally{life.close();}
  },
  endpoint:Object.freeze({address:e.address,port:e.port,serverName:e.serverName,
   serverFingerprintSha256:e.serverFingerprintSha256}),
  close:async()=>Object.freeze({closed:true}),
 });
}
