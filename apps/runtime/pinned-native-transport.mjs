/** Runner native calls use the same exact control CA pinned at poststart.
 * This adapter deliberately has no ambient proxy, redirect, DNS fallback or
 * connection pool; the existing capability client still owns operation bounds. */
import {request as httpsRequest} from 'node:https';
import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';

const fail=()=>{throw Error('PINNED_NATIVE_REFUSED');};
const hex64=/^[a-f0-9]{64}$/u;
export async function createPinnedNativeFetch({origin,caFile,caSha256,maxResponseBytes=67108864,maxRequestBytes=50331648}){
 let base;try{base=new URL(origin);}catch{fail();}
 if(base.protocol!=='https:'||base.origin!==origin||base.pathname!=='/'||base.search||base.hash||
    base.username||base.password||typeof caFile!=='string'||!caFile.startsWith('/')||!hex64.test(caSha256)||
    !Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1||maxResponseBytes>67108864||
    !Number.isSafeInteger(maxRequestBytes)||maxRequestBytes<1||maxRequestBytes>50331648)fail();
 let handle,ca;
 try{
  handle=await open(caFile,constants.O_RDONLY|constants.O_NOFOLLOW);
  const st=await handle.stat();
  if(!st.isFile()||st.size<1||st.size>16384||typeof process.getuid!=='function'||st.uid!==process.getuid()||(st.mode&0o077)!==0)fail();
  ca=await handle.readFile();
  if(ca.length!==st.size||createHash('sha256').update(ca).digest('hex')!==caSha256)fail();
 }catch{fail();}finally{await handle?.close();}
 return async function pinnedNativeFetch(address,init){
  let url;try{url=new URL(address);}catch{fail();}
  if(url.origin!==origin||url.search||url.hash||url.username||url.password||
     !/^\/v1\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/u.test(url.pathname)||
     init?.method!=='POST'||init.redirect!=='error'||typeof init.body!=='string'||
     init.signal?.aborted)fail();
  const headers=new Headers(init.headers),authorization=headers.get('authorization');
  if(headers.get('content-type')!=='application/json'||!/^Bearer [A-Za-z0-9._~+\/-]{1,8192}={0,2}$/u.test(authorization??'')||
     [...headers.keys()].some(key=>!['authorization','content-type'].includes(key)))fail();
  const body=Buffer.from(init.body,'utf8');if(body.length<1||body.length>maxRequestBytes)fail();
  return await new Promise((resolve,reject)=>{
   let done=false,request,timer;const chunks=[];let size=0;
   const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);init.signal?.removeEventListener('abort',abort);if(error)reject(Error('PINNED_NATIVE_REFUSED'));else resolve(value);};
   const abort=()=>{request?.destroy();finish(true);};
   // Every caller supplies its own shorter AbortSignal; this ceiling covers
   // the longest approved read while preventing an unbounded socket.
   timer=setTimeout(abort,30000);
   try{request=httpsRequest(url,{method:'POST',agent:false,ca,minVersion:'TLSv1.3',rejectUnauthorized:true,servername:url.hostname,
    timeout:30000,maxHeaderSize:8192,headers:{authorization,'content-type':'application/json','content-length':String(body.length),accept:'application/json','accept-encoding':'identity',connection:'close'}},response=>{
    const length=response.headers['content-length'];
    if(response.statusCode!==200||response.headers.location||response.headers['content-encoding']&&response.headers['content-encoding']!=='identity'||
       length!==undefined&&(!/^(0|[1-9][0-9]*)$/u.test(length)||Number(length)>maxResponseBytes)||
       response.headers['transfer-encoding']&&length!==undefined){response.destroy();finish(true);return;}
    response.on('data',chunk=>{size+=chunk.length;if(size>maxResponseBytes){response.destroy();finish(true);}else chunks.push(chunk);});
    response.once('end',()=>{try{
     if(!response.complete||response.rawTrailers.length||length!==undefined&&size!==Number(length))fail();
     finish(false,new Response(Buffer.concat(chunks,size),{status:200,headers:{'content-type':response.headers['content-type']??'',
      ...(response.headers['content-encoding']?{'content-encoding':response.headers['content-encoding']}:{})}}));
    }catch{finish(true);}});
    response.once('error',()=>finish(true));response.once('aborted',()=>finish(true));
   });
   request.once('error',()=>finish(true));request.once('timeout',abort);
   init.signal?.addEventListener('abort',abort,{once:true});
   if(init.signal?.aborted)abort();else request.end(body);
   }catch{finish(true);}
  });
 };
}
