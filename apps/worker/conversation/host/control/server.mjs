/** Private mTLS currentness listener. It owns only the network boundary and delegates durable authority to `store`.
 * An authenticated TLS peer is still merely a claim until the transactional store accepts its current credential. */
import https from 'node:https';
import {privateAddress,dnsName,tlsBytes,checkedCertificate} from './tls.mjs';
import {HOST_CONTROL_PATH,HOST_CONTROL_MAX_BYTES,hostControlRequest,hostControlResponse,
 hostClientDnsName,encodeHostControl,decodeHostControl} from './protocol.mjs';
import {MAX_HOST_CURRENTNESS_MS} from '../binding.mjs';

const fail=()=>{throw Object.assign(new Error('HOST_CONTROL_UNAVAILABLE'),{code:'HOST_CONTROL_UNAVAILABLE'});};
const allowed=new Set(['host','content-type','content-length','connection']);
function requestLength(req){
 if(req.httpVersion!=='1.1'||req.method!=='POST'||req.url!==HOST_CONTROL_PATH)fail();
 const raw=req.rawHeaders;if(!Array.isArray(raw)||raw.length%2!==0||raw.length<2)fail();
 const headers=new Map();for(let n=0;n<raw.length;n+=2){const name=raw[n].toLowerCase();
  if(!allowed.has(name)||headers.has(name))fail();headers.set(name,raw[n+1]);}
 if(!headers.get('host')||headers.get('content-type')!=='application/json'||
  headers.has('connection')&&headers.get('connection').toLowerCase()!=='close')fail();
 const length=headers.get('content-length');
 if(typeof length!=='string'||!/^[1-9][0-9]*$/u.test(length)||Number(length)>HOST_CONTROL_MAX_BYTES)fail();
 return Number(length);
}
async function requestBody(req,length,signal){
 const chunks=[];let size=0;
 for await(const chunk of req){if(signal.aborted||!Buffer.isBuffer(chunk)||size+chunk.length>length)fail();
  size+=chunk.length;chunks.push(chunk);}
 if(signal.aborted||size!==length)fail();return Buffer.concat(chunks,size);
}
function bounded(operation,signal){
 if(signal.aborted)fail();
 return new Promise((resolve,reject)=>{
  const abort=()=>{cleanup();reject(new Error('HOST_CONTROL_UNAVAILABLE'));};
  const cleanup=()=>signal.removeEventListener('abort',abort);
  signal.addEventListener('abort',abort,{once:true});
  Promise.resolve().then(operation).then(value=>{cleanup();resolve(value);},error=>{cleanup();reject(error);});
 });
}

/** `store.readCurrent` must consume nonce, authenticate the current credential and read canonical run state in one
 * acknowledged write transaction. A syntax-valid request or a verified TLS certificate alone is insufficient. */
export function createHostCurrentnessServer({bind,tls,store,maxFreshMs,requestMs,maxConcurrent=32,maxSockets=maxConcurrent,
 now=Date.now,httpsModule=https}={}){
 if(!bind||!tls||typeof store?.readCurrent!=='function'||typeof now!=='function'||
  typeof httpsModule?.createServer!=='function'||!Number.isSafeInteger(maxFreshMs)||maxFreshMs<1||
  maxFreshMs>MAX_HOST_CURRENTNESS_MS||!Number.isSafeInteger(requestMs)||requestMs<1||requestMs>5000||
  !Number.isSafeInteger(maxConcurrent)||maxConcurrent<1||maxConcurrent>128||
  !Number.isSafeInteger(maxSockets)||maxSockets<maxConcurrent||maxSockets>256)fail();
 let address,serverName,cert,key,clientCa;
 try{address=privateAddress(bind.address);serverName=dnsName(tls.serverName);
  if(!Number.isSafeInteger(bind.port)||bind.port<0||bind.port>65535||
   bind.port===0&&address!=='127.0.0.1')fail();
  cert=tlsBytes(tls.cert);key=tlsBytes(tls.key);clientCa=tlsBytes(tls.clientCa);
  checkedCertificate(cert,{name:serverName,nowMs:now()});
 }catch{fail();}
 let closed=false,starting,closing,active=0;const sockets=new Set(),lifetime=new AbortController();
 const server=httpsModule.createServer({cert,key,ca:clientCa,requestCert:true,rejectUnauthorized:true,
  minVersion:'TLSv1.3',maxVersion:'TLSv1.3',keepAlive:false,handshakeTimeout:requestMs},async(req,res)=>{
  if(closed||active>=maxConcurrent){res.writeHead(503,{'content-length':'0','connection':'close'});res.end();return;}
  active++;const requestLifetime=new AbortController(),timer=setTimeout(()=>{
   requestLifetime.abort();req.destroy();res.destroy();
  },requestMs);
  const stop=()=>requestLifetime.abort();lifetime.signal.addEventListener('abort',stop,{once:true});
  req.on('aborted',stop);res.on('close',stop);
  try{
   const length=requestLength(req);
   if(req.socket.authorized!==true||typeof req.socket.getPeerCertificate!=='function')fail();
   const q=hostControlRequest(decodeHostControl(await bounded(()=>requestBody(req,length,requestLifetime.signal),requestLifetime.signal)));
   const peerName=hostClientDnsName(q.allocation),peer=req.socket.getPeerCertificate(false);
   const certificate=checkedCertificate(peer?.raw,{name:peerName,nowMs:now(),notAfterMs:q.allocation.leaseDeadlineMs});
   if(closed||requestLifetime.signal.aborted)fail();
   const answer=await bounded(()=>store.readCurrent({request:q,fingerprintSha256:certificate.fingerprintSha256,
    peerDnsName:peerName,signal:requestLifetime.signal}),requestLifetime.signal);
   hostControlResponse(answer,q,{nowMs:now(),maxFreshMs});
   if(closed||requestLifetime.signal.aborted)fail();
   const bytes=encodeHostControl(answer);
   res.writeHead(200,{'content-type':'application/json','content-length':String(bytes.length),'connection':'close'});
   res.end(bytes);
  }catch{if(res.destroyed){}else if(!res.headersSent){res.writeHead(503,{'content-length':'0','connection':'close'});res.end();}
   else res.destroy();}
  finally{clearTimeout(timer);lifetime.signal.removeEventListener('abort',stop);active--;}
 });
 server.maxConnections=maxSockets;server.maxHeadersCount=8;
 server.headersTimeout=Math.min(requestMs,5000);server.requestTimeout=requestMs;
 server.on('tlsClientError',(_error,socket)=>socket.destroy());
 server.on('connection',socket=>{if(sockets.size>=maxSockets){socket.destroy();return;}
  sockets.add(socket);socket.on('close',()=>sockets.delete(socket));
  socket.on('error',()=>{});});
 const bound=()=>{const at=server.address();return at&&typeof at==='object'?Object.freeze({address:at.address,port:at.port}):null;};
 return Object.freeze({
  async start(){if(closed)fail();if(server.listening)return bound();if(starting)return starting;
   starting=new Promise((resolve,reject)=>{const cleanup=()=>{server.off('error',bad);server.off('listening',good);};
    const bad=()=>{cleanup();try{server.close();}catch{}reject(new Error('HOST_CONTROL_UNAVAILABLE'));};
    const good=()=>{cleanup();if(closed){server.close(()=>reject(new Error('HOST_CONTROL_UNAVAILABLE')));}
     else resolve(bound());};
    server.once('error',bad);server.once('listening',good);
    try{server.listen({host:address,port:bind.port,exclusive:true});}catch{bad();}
   }).finally(()=>{starting=undefined;});return starting;},
  async close(){if(closing)return closing;closed=true;lifetime.abort();
   closing=(async()=>{await starting?.catch(()=>{});for(const socket of sockets)socket.destroy();
    if(server.listening)await new Promise(resolve=>server.close(resolve));return Object.freeze({closed:true});})();
   return closing;},
  address:bound,
 });
}
