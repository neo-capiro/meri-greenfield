/** Actual, explicit opt-in mTLS boundary for the one product budget owner. */
import {createServer} from 'node:https';
import {TLSSocket} from 'node:tls';
import {X509Certificate,createHash,randomBytes,constants} from 'node:crypto';
import {isIPv4} from 'node:net';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createProductOwnerChannel,createProductOwnerAdmissionChannel,OWNER_PATHS} from './owner-channel.mjs';
import {parseOwnerWire} from './owner-wire-codec.mjs';

const fail=()=>{throw Error('PRODUCT_OWNER_HTTPS_UNAVAILABLE');};
const sha=v=>createHash('sha256').update(v).digest('hex');
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v)?v:fail();
const slot=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/u.test(v)?v:fail();
const MAX=12*1024*1024;
const tuple=(v,n)=>Array.isArray(v)&&v.length===n?v:fail();
const wire=v=>Buffer.from(JSON.stringify(v));
const fields=['binding','grant_id','cluster_arn','task_definition_arn','container_name','image_digest',
 'execution_binding','started_by','group','created_at_ms','expires_at_ms','vpc_id','subnet_id','security_group_ids','tags'];
const bindingFields=['tenantId','actorId','conversationId','runId','attemptId','workerId','writerFence'];

export function encodeProductPlacement(value){
 const v=data(own(value,['issuedTaskNetwork','checkedAtMs','effectiveExpiresAtMs']));
 const p=own(v.issuedTaskNetwork,fields),q=own(p.binding,['run_id','attempt','worker_arn','fence','policy_revision']);
 own(p.execution_binding,bindingFields);
 return [[q.run_id,q.attempt,q.worker_arn,q.fence,q.policy_revision],...fields.slice(1).map(k=>
  k==='execution_binding'?bindingFields.map(n=>p[k][n]):p[k])];
}

/** The native reader owns task proof; configured fingerprints are not AWS attestations. */
export function assertProductServiceTaskLease(value,{policy,tls,localAddress,remoteAddress,started,at,deadline}){
 const v=data(own(value,['schemaVersion','deploymentRevision','ownerTaskArn','proxyTaskArn',
  'ownerPrivateIpv4Address','proxyPrivateIpv4Address','ownerCertSha256','proxyCertSha256','checkedAtMs','expiresAtMs']));
 if(v.schemaVersion!==1||v.deploymentRevision!==policy.deploymentRevision||
    v.ownerTaskArn!==policy.ownerTaskArn||v.proxyTaskArn!==policy.proxyTaskArn||
    v.ownerCertSha256!==tls.certSha256||v.proxyCertSha256!==policy.clientCertSha256||
    !isIPv4(localAddress)||!isIPv4(remoteAddress)||v.ownerPrivateIpv4Address!==localAddress||
    v.proxyPrivateIpv4Address!==remoteAddress||!Number.isSafeInteger(v.checkedAtMs)||
    v.checkedAtMs<started||v.checkedAtMs>at||!Number.isSafeInteger(v.expiresAtMs)||
    v.expiresAtMs<=at||v.expiresAtMs>deadline||v.expiresAtMs>v.checkedAtMs+30000)fail();
 return v.expiresAtMs;
}

export function productOwnerRoute(method,path){
 if(method==='GET'&&['/health/live','/health/ready'].includes(path))return path;
 if(method!=='POST'||!Object.values(OWNER_PATHS).includes(path))fail();
 return path;
}

/** One accepted physical connection has one request owner until its finally. */
export function acquireProductOwnerRequest(state){
 if(state.busy)fail();state.busy=true;
 let released=false;
 return ()=>{if(!released){released=true;state.busy=false;}};
}

/** Abort means revocation/quarantine, not proof that borrowed owner I/O stopped. */
export function retireProductOwnerRequests(serviceGate,controllers){
 serviceGate.poison();for(const controller of controllers)controller.abort();
 return controllers.size;
}

export function consumeProductPlacementRead(reads,readId,serviceGate){
 slot(readId);if(reads.has(readId))fail();
 if(reads.size>=4096){serviceGate.poison();fail();}reads.add(readId);
}

/** Own the native listener's pending bind as well as its established sockets. */
export function createProductOwnerListenerLifecycle(server,{retire,pendingRequests,maxCloseMs=3000}){
 let closed=false,listening=false,starting=null,rejectStart,detachStart,listenAbort,closing;
 function stop(){return new Promise(resolve=>{
  let settled=false;const done=stopped=>{if(!settled){settled=true;clearTimeout(timer);resolve(stopped);}};
  const timer=setTimeout(()=>done(false),maxCloseMs);
  try{server.close(error=>done(!error||error.code==='ERR_SERVER_NOT_RUNNING'));}catch{done(false);}
 });}
 return Object.freeze({async listen({host='0.0.0.0',port=8444}={}){
  if(closed||listening||starting||host!=='0.0.0.0'||port!==8444)fail();
  listenAbort=new AbortController();
  const attempt=new Promise((resolve,reject)=>{
   const bad=()=>reject(Error('PRODUCT_OWNER_HTTPS_UNAVAILABLE'));
   rejectStart=bad;detachStart=()=>server.off('error',bad);server.once('error',bad);
   try{server.listen({host,port,signal:listenAbort.signal},()=>{
    server.off('error',bad);
    if(closed||listenAbort.signal.aborted){void stop();bad();return;}
    listening=true;resolve();
   });}catch{server.off('error',bad);bad();}
  });starting=attempt;
  try{await attempt;}finally{detachStart?.();starting=null;rejectStart=null;}
 },close(){
  if(closing)return closing;
  closed=true;retire();listenAbort?.abort();rejectStart?.();
  closing=stop().then(listenerStopped=>({listenerStopped,pendingRequests:pendingRequests(),physicalStopProven:false}));
  return closing;
 }});
}

export function createProductOwnerHttpsServer(configuration){
 const c=own(configuration,['tlsMaterial','clientPolicy','persistedFacts','ownerPorts','placement',
  'taskLeaseReader','serviceGate','now'],['enabled','maxRequestMs','nativeCurrentness']);
 const enabled=c.enabled??false,maxRequestMs=c.maxRequestMs??3000;
 if(typeof enabled!=='boolean'||typeof c.now!=='function'||!Number.isSafeInteger(maxRequestMs)||
    maxRequestMs<1||maxRequestMs>3000)fail();
 if(!enabled)return Object.freeze({available:false,listen:async()=>fail(),close:async()=>{}});
 const t=own(c.tlsMaterial,['origin','serverName','ca','cert','key','certSha256','issuerSha256']);
 const policy=Object.freeze(data(c.clientPolicy));
 if(t.origin!==`https://${t.serverName}:8444`||!/^https:\/\/[a-z0-9.-]+:8444$/u.test(t.origin)||
    typeof c.placement?.resolve!=='function'||c.placement.available!==true||
    typeof c.taskLeaseReader?.read!=='function'||c.taskLeaseReader.available!==true||
    c.serviceGate?.available!==true)fail();
 digest(t.certSha256);digest(t.issuerSha256);
 if(policy.issuerSha256!==t.issuerSha256)fail();
 const leaf=new X509Certificate(t.cert),root=new X509Certificate(t.ca),at=c.now();
 if(sha(leaf.raw)!==t.certSha256||sha(root.raw)!==t.issuerSha256||!root.ca||leaf.ca||
    !leaf.keyUsage?.includes('1.3.6.1.5.5.7.3.1')||leaf.subjectAltName!==`DNS:${t.serverName}`||
    !leaf.checkIssued(root)||!leaf.verify(root.publicKey)||Date.parse(leaf.validFrom)>at||Date.parse(leaf.validTo)<=at)fail();
 const sockets=new Set(),states=new WeakMap(),sessions=new Map(),reads=new Set(),controllers=new Set();
 // Reuse the canonical policy/port validator before a server can be started.
 let initialAdmission=createProductOwnerAdmissionChannel({clientPolicy:policy,persistedFacts:c.persistedFacts,
  ownerPorts:c.ownerPorts,serviceGate:c.serviceGate,now:c.now,maxExchangeMs:maxRequestMs});
 let closed=false;
 const available=()=>!closed&&c.serviceGate.available&&c.persistedFacts.available&&c.placement.available&&c.taskLeaseReader.available&&c.nativeCurrentness?.available!==false;
 function retire(){retireProductOwnerRequests(c.serviceGate,controllers);for(const socket of sockets)socket.destroy();}
 function state(socket){
  if(!states.has(socket))states.set(socket,{id:randomBytes(24).toString('hex'),role:null,busy:false,admission:null});
  return states.get(socket);
 }
 function peer(socket){
  if(!(socket instanceof TLSSocket)||socket.destroyed||socket.authorized!==true||socket.authorizationError||
     socket.getProtocol()!=='TLSv1.3'||socket.alpnProtocol!=='http/1.1')fail();
  const certificate=socket.getPeerCertificate(true),actual=new X509Certificate(certificate.raw);
  if(sha(actual.raw)!==policy.clientCertSha256||!certificate.issuerCertificate?.raw||
     sha(certificate.issuerCertificate.raw)!==policy.issuerSha256||actual.ca||
     !actual.keyUsage?.includes('1.3.6.1.5.5.7.3.2')||actual.subject!==`CN=${policy.clientSubject}`||
     Date.parse(actual.validFrom)>c.now()||Date.parse(actual.validTo)<=c.now())fail();
  return {clientCertSha256:sha(actual.raw),clientSubject:policy.clientSubject,
   deploymentRevision:policy.deploymentRevision,issuerSha256:sha(certificate.issuerCertificate.raw),
   proxyTaskArn:policy.proxyTaskArn,tlsVersion:socket.getProtocol(),connectionId:state(socket).id};
 }
 function role(socket,value){const s=state(socket);if(s.role!==null&&s.role!==value)fail();s.role=value;return s;}
 function admission(s){
  if(!s.admission){s.admission=initialAdmission??createProductOwnerAdmissionChannel({clientPolicy:policy,
   persistedFacts:c.persistedFacts,ownerPorts:c.ownerPorts,serviceGate:c.serviceGate,now:c.now,maxExchangeMs:maxRequestMs});initialAdmission=null;}
  return s.admission;
 }
 async function dispatch(path,body,socket,p,deadline,signal){
  const f=parseOwnerWire(body),s=state(socket);
  for(const [id,session]of sessions)if(session.expiry<=c.now())sessions.delete(id);
  if(path===OWNER_PATHS.operation&&f[0]==='meri.proxy.placement-read/1'){
   role(socket,'operation');tuple(f,4);slot(f[1]);digest(f[2]);
   if(!Number.isSafeInteger(f[3])||f[3]<=c.now())fail();consumeProductPlacementRead(reads,f[1],c.serviceGate);
   const v=await c.placement.resolve({capabilitySha256:f[2],deadlineMs:Math.min(f[3],deadline),signal});
   if(!Number.isSafeInteger(v.checkedAtMs)||v.checkedAtMs<deadline-maxRequestMs||v.checkedAtMs>c.now()||
      !Number.isSafeInteger(v.effectiveExpiresAtMs)||v.effectiveExpiresAtMs<=c.now())fail();
   return wire(['meri.proxy.placement/1',f[1],f[2],encodeProductPlacement(v),v.checkedAtMs,
    Math.min(v.effectiveExpiresAtMs,f[3],deadline)]);
  }
  if(path===OWNER_PATHS.operation&&f[0]==='meri.proxy.admission-read/1'){
   if(s.role===null)role(socket,'operation');
   if(!s.admission)admission(s);
   return s.admission.read(body,p,s.role);
  }
  if(path===OWNER_PATHS.open){
   role(socket,'operation');tuple(f,5);if(sessions.size>=1024)fail();
   const channel=createProductOwnerChannel({clientPolicy:policy,persistedFacts:c.persistedFacts,
    ownerPorts:c.ownerPorts,serviceGate:c.serviceGate,now:c.now,maxExchangeMs:maxRequestMs});
   const reply=await channel.open(body,p),id=tuple(parseOwnerWire(reply),4)[1];
   sessions.set(id,{channel,operation:socket,capture:null,admission:admission(s),expiry:f[4]});return reply;
  }
  const id=f[1],session=sessions.get(id);if(!session)fail();
  if(path===OWNER_PATHS.operation){
   if(session.operation!==socket)fail();role(socket,'operation');return session.channel.operation(body,p);
  }
  if(socket===session.operation||session.capture!==null&&session.capture!==socket)fail();
  if(session.capture===null&&path!==OWNER_PATHS.poll)fail();
  role(socket,'capture');session.capture=socket;
  if(s.admission!==null&&s.admission!==session.admission)fail();s.admission=session.admission;
  return path===OWNER_PATHS.poll?session.channel.poll(body,p):session.channel.reply(body,p);
 }
 const server=createServer({key:t.key,cert:t.cert,ca:t.ca,requestCert:true,rejectUnauthorized:true,
  minVersion:'TLSv1.3',maxVersion:'TLSv1.3',ALPNProtocols:['http/1.1'],
  secureOptions:constants.SSL_OP_NO_TICKET,maxHeaderSize:16384,headersTimeout:maxRequestMs,
  requestTimeout:maxRequestMs,keepAliveTimeout:900000},async(req,res)=>{
  const socket=req.socket,s=state(socket),started=c.now(),deadline=started+maxRequestMs;
  const abort=new AbortController();let timer,releaseRequest;
  req.once('aborted',()=>{if(releaseRequest){abort.abort();retire();}});
  try{
   const health=req.method==='GET'&&['/health/live','/health/ready'].includes(req.url);
   if(closed||!health&&!available())fail();releaseRequest=acquireProductOwnerRequest(s);
   controllers.add(abort);
   productOwnerRoute(req.method,req.url);
   if(req.httpVersion!=='1.1'||req.rawHeaders.length>128)fail();
   const headers=new Map();for(let i=0;i<req.rawHeaders.length;i+=2){const name=req.rawHeaders[i].toLowerCase();if(headers.has(name))fail();headers.set(name,req.rawHeaders[i+1]);}
   const p=peer(socket);
   if(health){
    if(headers.has('transfer-encoding')||headers.has('authorization')||headers.has('content-encoding')||
       headers.has('content-length')&&headers.get('content-length')!=='0')fail();
    if(req.url==='/health/ready'){
     timer=setTimeout(()=>{abort.abort();retire();},maxRequestMs);
     for(let n=0;n<2;n++){
      const value=await c.taskLeaseReader.read({deadlineMs:deadline,signal:abort.signal});
      assertProductServiceTaskLease(value,{policy,tls:t,localAddress:socket.localAddress,
       remoteAddress:socket.remoteAddress,started,at:c.now(),deadline});peer(socket);
     }
     if(!available()||c.now()>=deadline)fail();
    }
    const result=wire({status:req.url==='/health/live'?'live':'ready'});
    res.writeHead(200,{'content-type':'application/json','content-length':String(result.length),'cache-control':'no-store',
     'x-meri-owner-revision':policy.deploymentRevision});res.end(result);return;
   }
   if(headers.get('content-type')!=='application/json'||! /^(?:0|[1-9][0-9]*)$/u.test(headers.get('content-length')??'')||
      Number(headers.get('content-length'))<1||Number(headers.get('content-length'))>MAX||
      [...headers.keys()].some(v=>v==='transfer-encoding'||v==='authorization'||v==='content-encoding'||v==='forwarded'||v.startsWith('x-')))fail();
   const parts=[];let bytes=0;
   timer=setTimeout(()=>{abort.abort();retire();},maxRequestMs);
   const proof=async()=>{const value=await c.taskLeaseReader.read({deadlineMs:deadline,signal:abort.signal});
    assertProductServiceTaskLease(value,{policy,tls:t,localAddress:socket.localAddress,
     remoteAddress:socket.remoteAddress,started,at:c.now(),deadline});peer(socket);};
   await proof();
   for await(const part of req){bytes+=part.length;if(bytes>MAX||c.now()>=deadline)fail();parts.push(part);}
   if(bytes!==Number(headers.get('content-length'))||req.rawTrailers.length)fail();
   const result=await dispatch(req.url,Buffer.concat(parts,bytes),socket,p,deadline,abort.signal);
   await proof();
   if(!available()||abort.signal.aborted||c.now()>=deadline||!Buffer.isBuffer(result)||result.length>MAX)fail();
   res.writeHead(200,{'content-type':'application/json','content-length':String(result.length),'cache-control':'no-store',
    'x-meri-owner-revision':policy.deploymentRevision});res.end(result);
  }catch{if(abort.signal.aborted)retire();if(!res.headersSent&&!socket.destroyed)res.writeHead(403,{'content-length':'0','cache-control':'no-store'}).end();}
  finally{clearTimeout(timer);controllers.delete(abort);releaseRequest?.();}
 });
 server.maxConnections=16;
 server.on('connection',socket=>{sockets.add(socket);socket.on('error',()=>{});socket.once('close',()=>sockets.delete(socket));});
 server.on('clientError',(_error,socket)=>socket.destroy());server.on('tlsClientError',()=>{});
 server.on('error',retire);
 const listener=createProductOwnerListenerLifecycle(server,{retire,pendingRequests:()=>controllers.size,maxCloseMs:maxRequestMs});
 return Object.freeze({get available(){return available();},get pendingRequests(){return controllers.size;},
  async listen(value){if(!available())fail();await listener.listen(value);},
  close(){closed=true;const result=listener.close();sessions.clear();return result;}});
}
