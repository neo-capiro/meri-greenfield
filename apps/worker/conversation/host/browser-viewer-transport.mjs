/** Control-to-host viewer channel over pinned private mTLS. Supplied allocation
 * and credentials come from the existing host owner; no public URL, credential
 * issuer, model listener, replay queue or allocation registry is introduced. */
import https from 'node:https';
import {privateAddress,dnsName,fingerprint,tlsBytes,checkedCertificate} from './control/tls.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {parseBytes} from '../../../../packages/contracts/document-application/boundary.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {assertBrowserReturn,assertBrowserCustody} from '../../../../packages/runtime/browser-custody.mjs';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {BROWSER_VIEWER_LIMITS,receiveBrowserViewerResponse,receiveBrowserViewerRequest} from '../../../../packages/contracts/browser-viewer/receive.mjs';
import {assertBrowserOperationRequest,assertBrowserOperationResponse,browserOperationName,browserOperationCeilingMs,BROWSER_NATIVE_LIMITS} from '../../../../packages/contracts/runtime-0.2/browser-tools.mjs';
const PATH='/internal/browser-viewer',REQUEST_LIMIT=BROWSER_VIEWER_LIMITS.requestBytes+8192;
const TOOL_PATH='/internal/browser-tools',TOOL_REQUEST_LIMIT=BROWSER_NATIVE_LIMITS.requestBytes+8192;
const fail=()=>{throw Object.assign(Error('BROWSER_VIEWER_TRANSPORT_UNAVAILABLE'),{code:'BROWSER_VIEWER_TRANSPORT_UNAVAILABLE'});};
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b),encode=v=>Buffer.from(JSON.stringify(v));
async function body(stream,limit,signal){
 const length=stream.headers['content-length'];
 if(stream.headers['content-type']!=='application/json'||stream.headers['content-encoding']!==undefined||stream.headers['transfer-encoding']!==undefined||
  typeof length!=='string'||!/^[1-9][0-9]*$/u.test(length)||Number(length)>limit)fail();
 const chunks=[];let size=0;
 for await(const chunk of stream){signal.throwIfAborted();if(!Buffer.isBuffer(chunk)||size+chunk.length>Number(length))fail();size+=chunk.length;chunks.push(chunk);}
 signal.throwIfAborted();if(size!==Number(length))fail();return parseBytes(Buffer.concat(chunks,size),limit);
}
function operation(value){
 const q=own(value,['operation'],['binding','route','request','grant','custody']);
 if(['admission','prepare-resume'].includes(q.operation)){own(q,['operation','binding','custody']);if(q.custody!==null)assertBrowserCustody(q.custody,{binding:q.binding});else if(q.operation==='prepare-resume')fail();return q;}
 if(q.operation!=='execute')fail();own(q,['operation','route','request','grant']);
 return {...q,request:receiveBrowserViewerRequest(q.route,encode(q.request))};
}
function admission(result,binding){
 const r=own(result,['binding','admitted','expiresAtMs','ownerInstanceId','state','leaseEpoch','leaseExpiresAtMs']);
 if(!same(r.binding,binding)||typeof r.admitted!=='boolean'||!Number.isSafeInteger(r.expiresAtMs)||
  typeof r.ownerInstanceId!=='string'||!['agent','fencing','drained','user','returning','drain-unknown','ended'].includes(r.state)||
  !Number.isSafeInteger(r.leaseEpoch)||r.leaseEpoch<0||r.leaseExpiresAtMs!==null&&!Number.isSafeInteger(r.leaseExpiresAtMs))fail();return r;
}

/** One exact allocation per client. A canonical host resolver may select this
 * client, but request fields cannot alter its destination or TLS identity. */
export function createBrowserViewerHostClient({binding,ownerInstanceId,hostId,generation,endpoint,tls,now=Date.now,requestMs=10000}){
 const source=structuredClone(binding),address=privateAddress(endpoint.address),serverName=dnsName(endpoint.serverName),serverFingerprint=fingerprint(endpoint.serverFingerprintSha256);
 const clientName=dnsName(tls.clientName),cert=tlsBytes(tls.cert),key=tlsBytes(tls.key),ca=tlsBytes(tls.ca),lifetime=new AbortController();
 if(!Number.isSafeInteger(endpoint.port)||endpoint.port<1||endpoint.port>65535||!Number.isSafeInteger(requestMs)||requestMs<1||requestMs>30000)fail();
 checkedCertificate(cert,{name:clientName,nowMs:now()});
 async function send(payload,signal,{path=PATH,deadlineMs=now()+requestMs,requestLimit=REQUEST_LIMIT,responseLimit=BROWSER_VIEWER_LIMITS.responseBytes}={}){
  lifetime.signal.throwIfAborted();checkedCertificate(cert,{name:clientName,nowMs:now()});
  const bytes=encode(payload);if(bytes.length>requestLimit)fail();
  const life=createOperationLifetime({now,deadlineMs,signal:AbortSignal.any([lifetime.signal,...(signal?[signal]:[])]),errorFactory:()=>Object.assign(Error('BROWSER_VIEWER_TRANSPORT_UNAVAILABLE'),{code:'BROWSER_VIEWER_TRANSPORT_UNAVAILABLE'})});
  try{return await life.run(current=>new Promise((resolve,reject)=>{
   const req=https.request({host:address,port:endpoint.port,path,method:'POST',servername:serverName,cert,key,ca,
    agent:false,rejectUnauthorized:true,minVersion:'TLSv1.3',maxVersion:'TLSv1.3',signal:current,
    checkServerIdentity(_name,peer){try{checkedCertificate(peer.raw,{name:serverName,nowMs:now(),fingerprintSha256:serverFingerprint});}catch{return Error('BROWSER_VIEWER_TLS_REFUSED');}},
    headers:{'content-type':'application/json','content-length':String(bytes.length),'connection':'close'}},res=>{
     if(res.statusCode!==200||res.headers.location!==undefined){res.destroy();reject(Error('BROWSER_VIEWER_TRANSPORT_UNAVAILABLE'));return;}
     body(res,responseLimit,current).then(resolve,reject);
    });req.on('error',reject);req.end(bytes);
  }));}finally{life.close();}
 }
 return Object.freeze({
  async executeBrowserOperation(operation,request,options){
   const {signal,deadlineMs}=own(options,['deadlineMs'],['signal']),name=browserOperationName(operation),q=assertBrowserOperationRequest(name,request);
   if(!same(source,q.binding)||!Number.isSafeInteger(deadlineMs)||deadlineMs<=now())fail();
   const until=Math.min(deadlineMs,now()+browserOperationCeilingMs(name));
   const result=await send({operation:name,request:q,deadlineMs:until},signal,{path:TOOL_PATH,deadlineMs:until,requestLimit:TOOL_REQUEST_LIMIT,responseLimit:BROWSER_NATIVE_LIMITS.responseBytes});
   return assertBrowserOperationResponse(result,source);
  },
  async read({binding:requested,custody=null,signal}){
   if(!same(source,requested)||custody!==null&&(custody.hostId!==hostId||custody.generation!==generation||custody.ownerInstanceId!==ownerInstanceId))fail();
   const result=admission(await send({operation:'admission',binding:source,custody},signal),source);if(result.ownerInstanceId!==ownerInstanceId)fail();return result;
  },
  async prepareResume({binding:requested,custody,signal}){
   if(!same(source,requested)||custody.hostId!==hostId||custody.generation!==generation||custody.ownerInstanceId!==ownerInstanceId)fail();
   const held=assertBrowserCustody(custody,{binding:source});
   return assertBrowserReturn(await send({operation:'prepare-resume',binding:source,custody:held},signal),held);
  },
  async execute({route,request,grant,signal}){
   if(grant?.custody?.ownerInstanceId!==ownerInstanceId||grant.custody.hostId!==hostId||grant.custody.generation!==generation||!same(grant.custody.binding,source))fail();
   const q=receiveBrowserViewerRequest(route,encode(request)),result=await send({operation:'execute',route,request:q,grant},signal);
   return receiveBrowserViewerResponse(route,200,encode(result),q,grant.context);
  },
  close(){lifetime.abort();return {closed:true};},
 });
}

export function createBrowserViewerHostServer({bind,tls,peer,relay,custodyOwner,operationOwner,now=Date.now,requestMs=10000}){
 const address=privateAddress(bind.address),serverName=dnsName(tls.serverName),cert=tlsBytes(tls.cert),key=tlsBytes(tls.key),ca=tlsBytes(tls.clientCa);
 const peerName=dnsName(peer.name),peerFingerprint=fingerprint(peer.fingerprintSha256);
 if(!Number.isSafeInteger(bind.port)||bind.port<0||bind.port>65535||bind.port===0&&address!=='127.0.0.1'||
  !Number.isSafeInteger(requestMs)||requestMs<1||requestMs>30000||!['execute','readAdmission'].every(k=>typeof relay?.[k]==='function'))fail();
 checkedCertificate(cert,{name:serverName,nowMs:now()});
 const lifetime=new AbortController(),sockets=new Set();let active=0,starting,closing;
 const server=https.createServer({cert,key,ca,requestCert:true,rejectUnauthorized:true,minVersion:'TLSv1.3',maxVersion:'TLSv1.3',
  keepAlive:false,handshakeTimeout:requestMs},async(req,res)=>{
   if(active>=4||lifetime.signal.aborted){res.writeHead(503,{'content-length':'0','connection':'close'});res.end();return;}
   active++;const disconnected=new AbortController(),stop=()=>disconnected.abort();req.on('aborted',stop);res.on('close',stop);
   let life=createOperationLifetime({now,deadlineMs:now()+requestMs,signal:AbortSignal.any([lifetime.signal,disconnected.signal]),errorFactory:()=>Error('BROWSER_VIEWER_TRANSPORT_UNAVAILABLE')});
   const abort=()=>{req.destroy();res.destroy();};life.signal.addEventListener('abort',abort,{once:true});
   try{
    const tools=req.url===TOOL_PATH;
    if(req.httpVersion!=='1.1'||req.method!=='POST'||!tools&&req.url!==PATH||req.socket.authorized!==true||tools&&typeof operationOwner?.executeBrowserOperation!=='function')fail();
    const seen=new Set();for(let n=0;n<req.rawHeaders.length;n+=2){const name=req.rawHeaders[n].toLowerCase();if(seen.has(name)||!['host','content-type','content-length','connection'].includes(name))fail();seen.add(name);}
    checkedCertificate(req.socket.getPeerCertificate(false).raw,{name:peerName,nowMs:now(),fingerprintSha256:peerFingerprint});
    const raw=await life.run(signal=>body(req,tools?TOOL_REQUEST_LIMIT:REQUEST_LIMIT,signal));
    let q;
    if(tools){
     q=own(raw,['operation','request','deadlineMs']);const name=browserOperationName(q.operation);if(!name||!Number.isSafeInteger(q.deadlineMs)||q.deadlineMs<=now())fail();
     q={...q,operation:name,request:assertBrowserOperationRequest(name,q.request)};
     // Body/header delivery keeps the viewer deadline. Only an authenticated,
     // closed named browser operation gets its own bounded execution lifetime.
     life.signal.removeEventListener('abort',abort);life.close();
     life=createOperationLifetime({now,deadlineMs:Math.min(q.deadlineMs,now()+browserOperationCeilingMs(name)),signal:AbortSignal.any([lifetime.signal,disconnected.signal]),errorFactory:()=>Error('BROWSER_VIEWER_TRANSPORT_UNAVAILABLE')});
     life.signal.addEventListener('abort',abort,{once:true});
    }else q=operation(raw);
    const result=await life.run(signal=>{
     if(tools)return operationOwner.executeBrowserOperation(q.operation,q.request,{signal,deadlineMs:life.deadline()});
     if(q.operation==='admission')return relay.readAdmission({binding:q.binding,custody:q.custody,signal});
     if(q.operation==='prepare-resume'){if(typeof custodyOwner?.prepareResume!=='function')fail();return custodyOwner.prepareResume({binding:q.binding,custody:q.custody,signal});}
     return relay.execute({route:q.route,request:q.request,grant:q.grant,signal});
    });
    if(tools)assertBrowserOperationResponse(result,q.request.binding);
    const bytes=encode(result);if(bytes.length>(tools?BROWSER_NATIVE_LIMITS.responseBytes:BROWSER_VIEWER_LIMITS.responseBytes))fail();life.check();
    res.writeHead(200,{'content-type':'application/json','content-length':String(bytes.length),'connection':'close','cache-control':'no-store'});res.end(bytes);
   }catch{if(!res.destroyed&&!res.headersSent){res.writeHead(503,{'content-length':'0','connection':'close'});res.end();}}
   finally{life.signal.removeEventListener('abort',abort);life.close();req.off('aborted',stop);res.off('close',stop);active--;}
  });
 server.maxConnections=4;server.maxHeadersCount=8;server.headersTimeout=requestMs;server.requestTimeout=requestMs;
 server.on('tlsClientError',(_error,socket)=>socket.destroy());
 server.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));socket.on('error',()=>{});});
 return Object.freeze({
  async start(){
   lifetime.signal.throwIfAborted();if(server.listening)return server.address();
   if(!starting)starting=new Promise((resolve,reject)=>{const good=()=>{server.off('error',bad);resolve(server.address());},bad=error=>{server.off('listening',good);reject(error);};server.once('listening',good);server.once('error',bad);server.listen({host:address,port:bind.port,exclusive:true});});
   return starting;
  },
  async close(){if(closing)return closing;lifetime.abort();closing=(async()=>{await starting?.catch(()=>{});for(const socket of sockets)socket.destroy();if(server.listening)await new Promise(resolve=>server.close(resolve));return {closed:true};})();return closing;},
 });
}
