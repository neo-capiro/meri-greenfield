/** Runner native calls use the same exact control CA pinned at poststart.
 * This adapter deliberately has no ambient proxy, redirect, DNS fallback or
 * connection pool; the existing capability client still owns operation bounds. */
import {request as httpsRequest} from 'node:https';
import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {PINNED_NATIVE_ERROR_BODY_MAX_BYTES,pinnedNativeRefusal as refusal,classifyPinnedStatus} from './runner-runtime-diagnostics.mjs';
import {browserOperationCeilingMs} from '../../packages/contracts/runtime-0.2/browser-tools.mjs';

/** Like fetch, every answer resolves as a Response: a 200 fully buffered, any other status with only its status, content type
 * and a body of at most PINNED_NATIVE_ERROR_BODY_MAX_BYTES (never its status text or other headers), so the caller decides
 * on the status. A rejection carries exactly one PINNED_NATIVE_FAILURE_CODES constant as `code` (its message stays
 * PINNED_NATIVE_REFUSED); the observed system/TLS code, status text, body or peer detail is never echoed. The runner
 * diagnostics allowlist owns the list, so RUNNER_FIRST_FAILURE can tell a refused status from a dropped or untrusted
 * connection without any message or payload reaching stderr.
 * CONFIGURATION: origin, limits or CA file refused while building the adapter. REFUSED: this call refused locally before
 * any byte was sent (address, method, headers, body). ABORTED/TIMEOUT: the caller's signal or this adapter's ceiling
 * (30 s for ordinary routes; shared domain ceilings only for the named browser operations).
 * CONNECT/TLS/SOCKET: failure before any response head. TRANSPORT: any other request error (bounded fallback).
 * STATUS_*: a non-200 head whose bounded body could not be read whole (malformed, oversize, truncated, encoded, redirected);
 * clients report a non-200 Response's class as `cause` (pinnedStatusRefusal). RESPONSE: a 200 head whose framing, size or
 * body did not complete (malformed, oversize, truncated, or the connection lost after the head). */
const fail=()=>{throw refusal('PINNED_NATIVE_REFUSED');};
const failConfiguration=()=>{throw refusal('PINNED_NATIVE_CONFIGURATION');};
const hex64=/^[a-f0-9]{64}$/u;
const CONNECT_CODES=new Set(['ECONNREFUSED','EHOSTUNREACH','ENETUNREACH','ENOTFOUND','EAI_AGAIN','EAI_FAIL','EAI_NONAME','ETIMEDOUT']);
const SOCKET_CODES=new Set(['ECONNRESET','EPIPE','ECONNABORTED','ERR_STREAM_PREMATURE_CLOSE','ERR_SOCKET_CLOSED']);
const TLS_CODES=new Set(['UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','SELF_SIGNED_CERT_IN_CHAIN','DEPTH_ZERO_SELF_SIGNED_CERT','CERT_HAS_EXPIRED','CERT_NOT_YET_VALID','CERT_SIGNATURE_FAILURE','CERT_UNTRUSTED','HOSTNAME_MISMATCH','EPROTO']);
/** Membership in fixed sets only. Never throws: a hostile or unrecognised value maps to the bounded TRANSPORT fallback. */
export function classifyPinnedRequestError(error){
 let code;try{code=error!==null&&typeof error==='object'?Object.getOwnPropertyDescriptor(error,'code')?.value:undefined;}catch{code=undefined;}
 if(typeof code!=='string')return 'PINNED_NATIVE_TRANSPORT';
 if(CONNECT_CODES.has(code))return 'PINNED_NATIVE_CONNECT';
 if(TLS_CODES.has(code)||code.startsWith('ERR_TLS_')||code.startsWith('ERR_SSL_')||code.startsWith('ERR_OSSL_'))return 'PINNED_NATIVE_TLS';
 if(SOCKET_CODES.has(code))return 'PINNED_NATIVE_SOCKET';
 if(code.startsWith('HPE_'))return 'PINNED_NATIVE_RESPONSE';return 'PINNED_NATIVE_TRANSPORT';
}
export async function createPinnedNativeFetch({origin,caFile,caSha256,maxResponseBytes=67108864,maxRequestBytes=50331648}){
 let base;try{base=new URL(origin);}catch{failConfiguration();}
 if(base.protocol!=='https:'||base.origin!==origin||base.pathname!=='/'||base.search||base.hash||
    base.username||base.password||typeof caFile!=='string'||!caFile.startsWith('/')||!hex64.test(caSha256)||
    !Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1||maxResponseBytes>67108864||
    !Number.isSafeInteger(maxRequestBytes)||maxRequestBytes<1||maxRequestBytes>50331648)failConfiguration();
 let handle,ca;
 try{
  handle=await open(caFile,constants.O_RDONLY|constants.O_NOFOLLOW);
  const st=await handle.stat();
  if(!st.isFile()||st.size<1||st.size>16384||typeof process.getuid!=='function'||st.uid!==process.getuid()||(st.mode&0o077)!==0)failConfiguration();
  ca=await handle.readFile();
  if(ca.length!==st.size||createHash('sha256').update(ca).digest('hex')!==caSha256)failConfiguration();
 }catch{failConfiguration();}finally{await handle?.close();}
 return async function pinnedNativeFetch(address,init){
  let url;try{url=new URL(address);}catch{fail();}
  if(url.origin!==origin||url.search||url.hash||url.username||url.password||
     !/^\/v1\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/u.test(url.pathname)||
     init?.method!=='POST'||init.redirect!=='error'||typeof init.body!=='string')fail();
  if(init.signal?.aborted)throw refusal('PINNED_NATIVE_ABORTED');
  const headers=new Headers(init.headers),authorization=headers.get('authorization');
  if(headers.get('content-type')!=='application/json'||!/^Bearer [A-Za-z0-9._~+\/-]{1,8192}={0,2}$/u.test(authorization??'')||
     [...headers.keys()].some(key=>!['authorization','content-type'].includes(key)))fail();
  const body=Buffer.from(init.body,'utf8');if(body.length<1||body.length>maxRequestBytes)fail();
  return await new Promise((resolve,reject)=>{
   // `head` is the accepted head's status: a later loss of a 200 is a truncated RESPONSE, of another answer its status class,
   // never a pre-response SOCKET/TLS failure.
   let done=false,head=0,request,timer;const chunks=[];let size=0;
   const finish=(code,value)=>{if(done)return;done=true;clearTimeout(timer);init.signal?.removeEventListener('abort',aborted);if(code)reject(refusal(code));else resolve(value);};
   // Settle first, then destroy: the asynchronous error/close events of the destroy find `done` set and cannot replace
   // ABORTED/TIMEOUT with a socket class. destroy() is idempotent and runs on every failure path, so no socket outlives it.
   const stopWith=code=>()=>{finish(code);request?.destroy();};
   const aborted=stopWith('PINNED_NATIVE_ABORTED'),timedOut=stopWith('PINNED_NATIVE_TIMEOUT');
   const failed=error=>finish(head===200?'PINNED_NATIVE_RESPONSE':head?classifyPinnedStatus(head):classifyPinnedRequestError(error));
   // Every caller supplies its own shorter AbortSignal; this ceiling covers
   // the longest approved read while preventing an unbounded socket.
   // Only named browser operations use their domain ceiling. Their caller's
   // signal still enforces the selected policy and remaining run allowance.
   const ceilingMs=browserOperationCeilingMs(url.pathname.slice('/v1/'.length))??30000;
   timer=setTimeout(timedOut,ceilingMs);
   try{request=httpsRequest(url,{method:'POST',agent:false,ca,minVersion:'TLSv1.3',rejectUnauthorized:true,servername:url.hostname,
    timeout:ceilingMs,maxHeaderSize:8192,headers:{authorization,'content-type':'application/json','content-length':String(body.length),accept:'application/json','accept-encoding':'identity',connection:'close'}},response=>{
    // Error listeners stay attached (`on`, not `once`): a second error after settlement is absorbed, never uncaught.
    response.on('error',failed);
    if(done){response.destroy();return;}
    const status=response.statusCode,length=response.headers['content-length'];
    const limit=status===200?maxResponseBytes:PINNED_NATIVE_ERROR_BODY_MAX_BYTES,unusable=status===200?'PINNED_NATIVE_RESPONSE':classifyPinnedStatus(status);
    if(response.headers.location||response.headers['content-encoding']&&response.headers['content-encoding']!=='identity'||
       length!==undefined&&(!/^(0|[1-9][0-9]*)$/u.test(length)||Number(length)>limit)||
       response.headers['transfer-encoding']&&length!==undefined){finish(unusable);response.destroy();return;}
    head=status;
    response.on('data',chunk=>{if(done)return;size+=chunk.length;if(size>limit){finish(unusable);response.destroy();}else chunks.push(chunk);});
    response.once('end',()=>{try{
     if(!response.complete||response.rawTrailers.length||length!==undefined&&size!==Number(length))fail();
     finish(false,new Response(Buffer.concat(chunks,size),{status,headers:{'content-type':response.headers['content-type']??'',
      ...(response.headers['content-encoding']?{'content-encoding':response.headers['content-encoding']}:{})}}));
    }catch{finish(unusable);}});
    response.once('aborted',()=>finish(unusable));
   });
   request.on('error',failed);request.once('timeout',timedOut);
   init.signal?.addEventListener('abort',aborted,{once:true});
   if(init.signal?.aborted)aborted();else request.end(body);
   }catch{finish('PINNED_NATIVE_REFUSED');request?.destroy();}
  });
 };
}
