/** Private mTLS currentness listener. It owns only the network boundary and delegates durable authority to `store`.
 * An authenticated TLS peer is still merely a claim until the transactional store accepts its current credential. */
import https from 'node:https';
import {privateAddress,dnsName,tlsBytes,checkedCertificate} from './tls.mjs';
import {HOST_CONTROL_PATH,HOST_CONTROL_MAX_BYTES,hostControlRequest,hostControlResponse,
 hostFactsRequest,hostFactsResponse,HOST_FACTS_PATH,HOST_FACTS_WIRE_MAX_BYTES,
 hostWorkflowRequest,hostWorkflowResponse,HOST_WORKFLOW_PATH,HOST_WORKFLOW_WIRE_MAX_BYTES,
 hostHoldRequest,hostHoldResponse,HOST_HOLD_PATH,HOST_HOLD_WIRE_MAX_BYTES,HOST_OPERATION_REQUEST_MAX_BYTES,
 hostClientDnsName,encodeHostControl,decodeHostControl,
 hostDecideRequest,hostDecideResponse,HOST_DECIDE_PATH,HOST_DECIDE_MAX_BYTES,HOST_DECIDE_WIRE_MAX_BYTES,
 HOST_DECIDE_MAX_WINDOW_MS} from './protocol.mjs';
import {MAX_HOST_CURRENTNESS_MS} from '../binding.mjs';

const fail=()=>{throw Object.assign(new Error('HOST_CONTROL_UNAVAILABLE'),{code:'HOST_CONTROL_UNAVAILABLE'});};
const allowed=new Set(['host','content-type','content-length','connection']);
/** The three named operations are the only routes this listener serves; anything else is refused
 * before a single body byte is read. Each route owns its request/answer validator and wire bound. */
const ROUTES=new Map([
 [HOST_CONTROL_PATH,{method:'readCurrent',requestMax:HOST_CONTROL_MAX_BYTES,max:HOST_CONTROL_MAX_BYTES,
  request:value=>hostControlRequest(value)}],
 [HOST_FACTS_PATH,{method:'readFacts',requestMax:HOST_OPERATION_REQUEST_MAX_BYTES,max:HOST_FACTS_WIRE_MAX_BYTES,
  request:value=>hostFactsRequest(value),answer:(answer,q)=>hostFactsResponse(answer,q)}],
 [HOST_WORKFLOW_PATH,{method:'resolveBrowserWorkflow',requestMax:HOST_OPERATION_REQUEST_MAX_BYTES,max:HOST_WORKFLOW_WIRE_MAX_BYTES,
  request:value=>hostWorkflowRequest(value),answer:(answer,q)=>hostWorkflowResponse(answer,q)}],
 [HOST_HOLD_PATH,{method:'holdBrowser',requestMax:HOST_OPERATION_REQUEST_MAX_BYTES,max:HOST_HOLD_WIRE_MAX_BYTES,
  request:value=>hostHoldRequest(value),answer:(answer,q)=>hostHoldResponse(answer,q)}],
 // The ONE approval route. Its ingress is still bounded by requestMs; only AFTER the store acknowledges the
 // admission transaction may this request's timer extend to the admitted absolute deadline.
 [HOST_DECIDE_PATH,{method:'decideBrowserApproval',requestMax:HOST_DECIDE_WIRE_MAX_BYTES,max:HOST_DECIDE_WIRE_MAX_BYTES,
  request:value=>hostDecideRequest(value),answer:(answer,q,atMs)=>hostDecideResponse(answer,q,atMs),long:true}],
]);
function requestLength(req,routeMax){
 if(req.httpVersion!=='1.1'||req.method!=='POST'||!Number.isSafeInteger(routeMax))fail();
 const raw=req.rawHeaders;if(!Array.isArray(raw)||raw.length%2!==0||raw.length<2)fail();
 const headers=new Map();for(let n=0;n<raw.length;n+=2){const name=raw[n].toLowerCase();
  if(!allowed.has(name)||headers.has(name))fail();headers.set(name,raw[n+1]);}
 if(!headers.get('host')||headers.get('content-type')!=='application/json'||
  headers.has('connection')&&headers.get('connection').toLowerCase()!=='close')fail();
 const length=headers.get('content-length');
 if(typeof length!=='string'||!/^[1-9][0-9]*$/u.test(length)||Number(length)>routeMax)fail();
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
 if(!bind||!tls||typeof store?.readCurrent!=='function'||typeof store?.readFacts!=='function'||
  typeof store?.resolveBrowserWorkflow!=='function'||typeof store?.holdBrowser!=='function'||typeof now!=='function'||
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
  active++;const requestLifetime=new AbortController();
  let timer=setTimeout(()=>{requestLifetime.abort();req.destroy();res.destroy();},requestMs);
  // Trusted store->server seam: called once after the acknowledged admission transaction, never serialized.
  let extended=false,originalCutoff=null;
  const extend=deadline=>{
   // One admitted extension only, and never beyond this request's own original cutoff, the allocation lease
   // or the peer certificate expiry.
   if(extended||!Number.isSafeInteger(deadline)||closed||requestLifetime.signal.aborted)return;
   extended=true;
   const capped=Math.min(deadline,originalCutoff??Infinity);
   const remaining=Math.min(capped-now(),HOST_DECIDE_MAX_WINDOW_MS);
   if(remaining<1){requestLifetime.abort();req.destroy();res.destroy();return;}
   clearTimeout(timer);
   timer=setTimeout(()=>{requestLifetime.abort();req.destroy();res.destroy();},remaining);
  };
  const stop=()=>requestLifetime.abort();lifetime.signal.addEventListener('abort',stop,{once:true});
  req.on('aborted',stop);res.on('close',stop);
  try{
   const route=ROUTES.get(req.url);if(!route)fail();
   const length=requestLength(req,route.requestMax);
   if(req.socket.authorized!==true||typeof req.socket.getPeerCertificate!=='function')fail();
   const q=route.request(decodeHostControl(await bounded(()=>requestBody(req,length,requestLifetime.signal),requestLifetime.signal),route.requestMax));
   const peerName=hostClientDnsName(q.allocation),peer=req.socket.getPeerCertificate(false);
   const certificate=checkedCertificate(peer?.raw,{name:peerName,nowMs:now(),notAfterMs:q.allocation.leaseDeadlineMs});
   if(route.long)originalCutoff=Math.min(q.deadlineMs,q.allocation.leaseDeadlineMs,certificate.notAfterMs??Infinity);
   if(closed||requestLifetime.signal.aborted)fail();
   const answer=await bounded(()=>store[route.method]({request:q,fingerprintSha256:certificate.fingerprintSha256,
    peerDnsName:peerName,signal:requestLifetime.signal,...(route.long?{onAdmitted:extend}:{})}),requestLifetime.signal);
   if(route.method==='readCurrent')hostControlResponse(answer,q,{nowMs:now(),maxFreshMs});else route.answer(answer,q,now());
   if(closed||requestLifetime.signal.aborted)fail();
   const bytes=encodeHostControl(answer,route.max);
   res.writeHead(200,{'content-type':'application/json','content-length':String(bytes.length),'connection':'close'});
   res.end(bytes);
  }catch{if(res.destroyed){}else if(!res.headersSent){res.writeHead(503,{'content-length':'0','connection':'close'});res.end();}
   else res.destroy();}
  finally{clearTimeout(timer);lifetime.signal.removeEventListener('abort',stop);active--;}
 });
 server.maxConnections=maxSockets;server.maxHeadersCount=8;
 server.headersTimeout=Math.min(requestMs,5000);
 // The whole incoming request/body stays under requestMs; the long approval wait is the RESPONSE phase and is
 // governed solely by the per-request timer extended after acknowledged admission.
server.requestTimeout=requestMs;
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
