/** Direct bounded poststart HTTP clients. No proxy, redirect, bearer, or fallback
 * destination; TLS uses the image/task-definition pinned nonsecret CA. */
import {request as httpsRequest} from 'node:https';
import {request as httpRequest} from 'node:http';
import {createHash} from 'node:crypto';
import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {own,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
const fault=code=>Object.assign(Error(code),{code});
const fail=()=>{throw fault('RUNNER_POSTSTART_REFUSED');};
const hex64=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
/** Return only locally defined categories. Node error messages, addresses and TLS material never reach the reporter. */
export function classifyRunnerPoststartTransportError(error){
 let code;try{code=error?.code;}catch{return 'RUNNER_POSTSTART_REFUSED';}
 if(['ENOTFOUND','EAI_AGAIN','EAI_FAIL','EAI_NODATA'].includes(code))return 'RUNNER_POSTSTART_DNS';
 if(['ETIMEDOUT','ERR_SOCKET_CONNECTION_TIMEOUT','ERR_TLS_HANDSHAKE_TIMEOUT'].includes(code))return 'RUNNER_POSTSTART_TIMEOUT';
 if(typeof code==='string'&&(/^(ERR_TLS_|ERR_SSL_|ERR_OSSL_)/u.test(code)||
  ['UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT','UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
   'DEPTH_ZERO_SELF_SIGNED_CERT','SELF_SIGNED_CERT_IN_CHAIN','CERT_HAS_EXPIRED','CERT_UNTRUSTED'].includes(code)))return 'RUNNER_POSTSTART_TLS';
 if(['ECONNREFUSED','ECONNRESET','ECONNABORTED','EHOSTUNREACH','ENETUNREACH','EADDRNOTAVAIL','ENOTCONN','EPIPE'].includes(code))return 'RUNNER_POSTSTART_TCP';
 return 'RUNNER_POSTSTART_REFUSED';
}
export async function readRunnerPoststartCa({path,sha256}){
 if(typeof path!=='string'||!path.startsWith('/')||!hex64(sha256))fail();let file;
 try{file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);const st=await file.stat();if(!st.isFile()||st.size<1||st.size>16384)fail();const bytes=await file.readFile();if(bytes.length!==st.size||createHash('sha256').update(bytes).digest('hex')!==sha256)fail();return bytes;}
 catch{fail();}finally{await file?.close();}
}
function exchange(url,{method,body,ca,signal,maxBytes=131072,deadlineMs=3000}){
 nativeSignal(signal);if(signal?.aborted||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>262144||!Number.isSafeInteger(deadlineMs)||deadlineMs<1||deadlineMs>3000)fail();
 return new Promise((resolve,reject)=>{
  let settled=false,received=0,request,timer;const chunks=[];const done=(code,value)=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);clearTimeout(timer);code?reject(fault(code)):resolve(value);};
  const abort=()=>{done('RUNNER_POSTSTART_REFUSED');request?.destroy();};
  const timedOut=()=>{done('RUNNER_POSTSTART_TIMEOUT');request?.destroy();};
  try{request=(url.protocol==='https:'?httpsRequest:httpRequest)(url,{method,agent:false,timeout:deadlineMs,maxHeaderSize:8192,
   ...(ca?{ca,minVersion:'TLSv1.3',rejectUnauthorized:true,servername:url.hostname}:{}),
   headers:{accept:'application/json','accept-encoding':'identity',connection:'close',...(body?{'content-type':'application/json','content-length':String(body.length)}:{})}},response=>{
    const pending=response.statusCode===503;
    if(response.statusCode!==200&&!pending){response.destroy();done('RUNNER_POSTSTART_HTTP');return;}
    const contentType=response.headers['content-type'];
    if(typeof contentType!=='string'||contentType.split(';')[0]!=='application/json'||response.headers['content-encoding']&&response.headers['content-encoding']!=='identity'||response.headers.location||response.headers['transfer-encoding']&&response.headers['content-length']||Number(response.headers['content-length']??0)>(pending?256:maxBytes)){response.destroy();done('RUNNER_POSTSTART_PROTOCOL');return;}
    response.on('data',chunk=>{received+=chunk.length;if(received>(pending?256:maxBytes)){response.destroy();done('RUNNER_POSTSTART_PROTOCOL');}else chunks.push(chunk);});
    response.once('end',()=>{try{if(!response.complete||response.rawTrailers.length||response.headers['content-length']!==undefined&&received!==Number(response.headers['content-length']))throw fault('RUNNER_POSTSTART_PROTOCOL');const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,received)));if(pending)done(value?.error?.code==='RUNNER_POSTSTART_PENDING'?'RUNNER_POSTSTART_PENDING':'RUNNER_POSTSTART_HTTP');else done(null,value);}catch{done('RUNNER_POSTSTART_PROTOCOL');}});
    response.once('error',()=>done('RUNNER_POSTSTART_PROTOCOL'));response.once('aborted',()=>done('RUNNER_POSTSTART_PROTOCOL'));
   });
   request.once('error',error=>done(classifyRunnerPoststartTransportError(error)));request.once('timeout',timedOut);signal?.addEventListener('abort',abort,{once:true});timer=setTimeout(timedOut,deadlineMs);
   if(signal?.aborted)abort();else request.end(body);
  }catch(error){request?.destroy();done(classifyRunnerPoststartTransportError(error));}
 });
}
export function createRunnerPoststartTransport(configuration){
 const c=own(configuration,['origin','ca'],['maxRequestMs']),maxRequestMs=c.maxRequestMs??3000;
 let base;try{base=new URL(c.origin);}catch{fail();}
 if(base.protocol!=='https:'||base.origin!==c.origin||base.pathname!=='/'||base.search||base.hash||base.username||base.password||!Buffer.isBuffer(c.ca)||c.ca.length<1||c.ca.length>16384||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>3000)fail();
 return Object.freeze({async post(step,body,{signal,deadlineMs=maxRequestMs}={}){
  if(!['challenge','redeem'].includes(step))fail();const bytes=Buffer.from(JSON.stringify(body));if(bytes.length>16384)fail();
  if(!Number.isSafeInteger(deadlineMs)||deadlineMs<1)fail();
  return exchange(new URL('/v1/runner-poststart/'+step,base),{method:'POST',body:bytes,ca:c.ca,signal,maxBytes:131072,deadlineMs:Math.min(deadlineMs,maxRequestMs)});
 }});
}
export async function readRunnerPoststartMetadata({uri,signal}){
 let url;try{url=new URL(uri);}catch{fail();}
 if(url.protocol!=='http:'||url.hostname!=='169.254.170.2'||url.port||!/^\/v4\/[A-Za-z0-9_-]{1,128}$/u.test(url.pathname)||url.search||url.hash||url.username||url.password)fail();
 return exchange(new URL(url.pathname+'/task',url),{method:'GET',signal,maxBytes:65536,deadlineMs:2000});
}
