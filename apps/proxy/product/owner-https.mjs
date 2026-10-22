/** Actual, explicit opt-in mTLS boundary for the one product budget owner. */
import {currentTurnTelemetry} from '../../runtime/telemetry/turn-context.mjs';
import {runOwnerHttpRequest,finishOwnerChannel} from './owner-request-telemetry.mjs';
import {createServer} from 'node:https';
import {TLSSocket} from 'node:tls';
import {X509Certificate,createHash,randomBytes,constants} from 'node:crypto';
import {isIPv4} from 'node:net';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createProductOwnerChannel,createProductOwnerAdmissionChannel,OWNER_PATHS} from './owner-channel.mjs';
import {parseOwnerWire,decodeAdmitFrame} from './owner-wire-codec.mjs';
import {OWNER_MAX_REQUEST_MS} from './service-pair-discovery.mjs';
import {PAIR_LEASE_TTL_MS} from './owner-pair-lease.mjs';

const fail=()=>{throw Error('PRODUCT_OWNER_HTTPS_UNAVAILABLE');};
/** The proxy keeps one verified socket per carrier and proves every reconnect (owner_https.py), and a
 * session is bound to its socket, so the owner never closes an idle one: the former 900 s idle close retired the pair at the first
 * exchange after a quiet quarter hour. TCP keep-alive still reaps a socket whose proxy task is gone. */
export const PRODUCT_OWNER_IDLE_SOCKETS=Object.freeze({keepAliveTimeout:0,keepAlive:true,keepAliveInitialDelay:60000});
const sha=v=>createHash('sha256').update(v).digest('hex');
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v)?v:fail();
const slot=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/u.test(v)?v:fail();
const MAX=24*1024*1024;
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
export function assertProductServiceTaskLease(value,{policy,tls,localAddress,remoteAddress,started,at,deadline,monotonicNow}){
 const v=data(own(value,['schemaVersion','deploymentRevision','ownerTaskArn','proxyTaskArn',
  'ownerPrivateIpv4Address','proxyPrivateIpv4Address','ownerCertSha256','proxyCertSha256','checkedAtMs','expiresAtMs'],
  ['owner','proxy','generation','proofStartedAtMonoMs','checkedAtMonoMs','expiresAtMonoMs']));
 if(v.schemaVersion!==1||v.deploymentRevision!==policy.deploymentRevision||
    v.ownerTaskArn!==policy.ownerTaskArn||v.proxyTaskArn!==policy.proxyTaskArn||
    v.ownerCertSha256!==tls.certSha256||v.proxyCertSha256!==policy.clientCertSha256||
    !isIPv4(localAddress)||!isIPv4(remoteAddress)||v.ownerPrivateIpv4Address!==localAddress||
    v.proxyPrivateIpv4Address!==remoteAddress||!Number.isSafeInteger(v.checkedAtMs)||
    (started!==undefined&&v.checkedAtMs<started)||!Number.isSafeInteger(v.expiresAtMs)||
    v.expiresAtMs<=at||v.expiresAtMs>v.checkedAtMs+PAIR_LEASE_TTL_MS)fail();
 if(v.generation!==undefined){
  if(!Number.isSafeInteger(v.generation)||v.generation<1||typeof monotonicNow!=='number'||
     !Number.isFinite(monotonicNow)||!Number.isFinite(v.checkedAtMonoMs)||!Number.isFinite(v.expiresAtMonoMs)||
     v.checkedAtMonoMs>monotonicNow||monotonicNow>=v.expiresAtMonoMs||
     v.expiresAtMonoMs>v.checkedAtMonoMs+PAIR_LEASE_TTL_MS)fail();
 }else if(v.checkedAtMs>at||v.expiresAtMs>deadline)fail();
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
 const telemetry=currentTurnTelemetry();
 const enabled=c.enabled??false,maxRequestMs=c.maxRequestMs??3000;
 if(typeof enabled!=='boolean'||typeof c.now!=='function'||!Number.isSafeInteger(maxRequestMs)||
    maxRequestMs<1||maxRequestMs>OWNER_MAX_REQUEST_MS)fail();
 if(!enabled)return Object.freeze({available:false,listen:async()=>fail(),close:async()=>{}});
 const t=own(c.tlsMaterial,['origin','serverName','ca','cert','key','certSha256','issuerSha256']);
 const initialPolicy=Object.freeze(data(c.clientPolicy));
 if(t.origin!==`https://${t.serverName}:8444`||!/^https:\/\/[a-z0-9.-]+:8444$/u.test(t.origin)||
    typeof c.placement?.resolve!=='function'||c.placement.available!==true||
    ['read','ensure','current','proveConnection','assertConnection','subscribe','nowMono','retire'].some(key=>typeof c.taskLeaseReader?.[key]!=='function')||c.taskLeaseReader.available!==true||
    c.serviceGate?.available!==true)fail();
 digest(t.certSha256);digest(t.issuerSha256);
 if(initialPolicy.issuerSha256!==t.issuerSha256)fail();
 const leaf=new X509Certificate(t.cert),root=new X509Certificate(t.ca),at=c.now();
 if(sha(leaf.raw)!==t.certSha256||sha(root.raw)!==t.issuerSha256||!root.ca||leaf.ca||
    !leaf.keyUsage?.includes('1.3.6.1.5.5.7.3.1')||leaf.subjectAltName!==`DNS:${t.serverName}`||
    !leaf.checkIssued(root)||!leaf.verify(root.publicKey)||Date.parse(leaf.validFrom)>at||Date.parse(leaf.validTo)<=at)fail();
 const sockets=new Set(),states=new WeakMap(),sessions=new Map(),reads=new Set(),controllers=new Set();
 // Reuse the canonical policy/port validator before a server can be started.
 let initialAdmission=createProductOwnerAdmissionChannel({clientPolicy:initialPolicy,persistedFacts:c.persistedFacts,
  ownerPorts:c.ownerPorts,serviceGate:c.serviceGate,now:c.now,maxExchangeMs:maxRequestMs});
 let closed=false;
 const operational=()=>!closed&&c.serviceGate.available&&c.persistedFacts.available&&c.placement.available&&c.taskLeaseReader.available&&c.nativeCurrentness?.available!==false;
 const available=()=>operational()&&c.taskLeaseReader.ready;
 function retire(){retireProductOwnerRequests(c.serviceGate,controllers);for(const socket of sockets)socket.destroy();}
 function state(socket){
  if(!states.has(socket))states.set(socket,{id:randomBytes(24).toString('hex'),role:null,busy:false,admission:null,lease:null,policy:null,binding:null,abort:null});
  return states.get(socket);
 }
 function peer(socket){
  const policy=state(socket).policy??initialPolicy;
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
  if(!s.admission){s.admission=initialAdmission??createProductOwnerAdmissionChannel({clientPolicy:s.policy,
   persistedFacts:c.persistedFacts,ownerPorts:c.ownerPorts,serviceGate:c.serviceGate,now:c.now,maxExchangeMs:maxRequestMs});initialAdmission=null;}
  return s.admission;
 }
 async function dispatch(path,body,socket,p,deadline,signal){
  const f=parseOwnerWire(body),s=state(socket),policy=s.policy;
  const assertLive=()=>{if(signal.aborted||socket.destroyed||c.now()>=deadline)fail();assertBound(socket);};
  for(const [id,session]of sessions)if(session.expiry<=c.now()){finishOwnerChannel(session.channel);sessions.delete(id);}
  if(path===OWNER_PATHS.operation&&f[0]==='meri.proxy.admit/1'){
   role(socket,'operation');
   const request=decodeAdmitFrame(f);if(sessions.size>=1024)fail();
   consumeProductPlacementRead(reads,request.requestId,c.serviceGate);
   const started=c.now();
   if(request.deadlineMs<=started||request.deadlineMs-started>900000)fail();
   const v=await c.placement.resolve({capabilitySha256:request.capabilitySha256,
    deadlineMs:Math.min(request.deadlineMs,deadline),signal});
   assertLive();
   if(!Number.isSafeInteger(v.checkedAtMs)||v.checkedAtMs<started||v.checkedAtMs>c.now()||
      !Number.isSafeInteger(v.effectiveExpiresAtMs)||v.effectiveExpiresAtMs<=c.now())fail();
   const receipt=parseOwnerWire(await admission(s).read(wire(['meri.proxy.admission-read/1',request.requestId,
    request.capabilitySha256,null,Math.min(request.deadlineMs,deadline)]),p,'operation'));
   assertLive();
   const sessionDeadline=Math.min(request.deadlineMs,v.issuedTaskNetwork.expires_at_ms,receipt[4][4][3]);
   const binding=Object.fromEntries(bindingFields.map((key,index)=>[key,receipt[4][0][index]]));
   if(bindingFields.some(key=>binding[key]!==v.issuedTaskNetwork.execution_binding[key])||
      receipt[4][1]!==v.issuedTaskNetwork.grant_id||receipt[4][3][2]!==v.issuedTaskNetwork.binding.worker_arn)fail();
   const channel=createProductOwnerChannel({clientPolicy:policy,persistedFacts:c.persistedFacts,
    ownerPorts:c.ownerPorts,serviceGate:c.serviceGate,now:c.now,maxExchangeMs:maxRequestMs});
   try{
    const reply=parseOwnerWire(await channel.admit({requestId:request.requestId,capabilitySha256:request.capabilitySha256,
     binding,deadlineMs:sessionDeadline},p));
    assertLive();
    sessions.set(reply[1],{channel,operation:socket,admission:admission(s),expiry:sessionDeadline,generation:s.lease.generation});
    return wire(['meri.proxy.admitted/1',request.requestId,request.capabilitySha256,encodeProductPlacement(v),receipt,reply[1],sessionDeadline]);
   }catch(error){channel.close();throw error;}
  }
  if(path===OWNER_PATHS.operation&&f[0]==='meri.proxy.admission-read/1'){
   if(s.role===null)role(socket,'operation');
   if(!s.admission)admission(s);
   return s.admission.read(body,p,s.role);
  }
  const id=f[1],session=sessions.get(id);if(!session||session.generation!==s.lease.generation)fail();
  if(path===OWNER_PATHS.operation){
   if(session.operation!==socket){
    if(!session.operation.destroyed||!session.channel.canReadOutcome)fail();
    role(socket,'operation');return session.channel.readOutcome(body,p,{signal});
   }
   role(socket,'operation');return session.channel.operation(body,p);
  }
  fail();
 }
 function closeSocketSessions(socket){
  const s=states.get(socket);s?.abort?.abort();
  for(const [id,session]of sessions)if(session.operation===socket){
   session.channel.close();
   if(!session.channel.canReadOutcome){finishOwnerChannel(session.channel);sessions.delete(id);}
  }
  // Retire the admission reader when no session still owns it.
  if(s?.admission&&![...sessions.values()].some(session=>session.admission===s.admission))s.admission.close();
 }
 function closeGeneration(){
  for(const controller of controllers)controller.abort();
  for(const session of sessions.values()){session.channel.close();session.admission.close();finishOwnerChannel(session.channel);}
  sessions.clear();reads.clear();initialAdmission?.close();initialAdmission=null;
  for(const socket of sockets)socket.destroy();
 }
 const unsubscribe=c.taskLeaseReader.subscribe(reason=>{
  closeGeneration();if(reason==='retired')c.serviceGate.poison();
 });
 function assertBound(socket){
  const s=state(socket),lease=c.taskLeaseReader.assertConnection(s.lease);
  if(!s.lease||lease.generation!==s.lease.generation)fail();
  assertProductServiceTaskLease(lease,{policy:s.policy,tls:t,localAddress:socket.localAddress,
   remoteAddress:socket.remoteAddress,at:c.now(),monotonicNow:c.taskLeaseReader.nowMono()});
  peer(socket);return lease;
 }
 async function bindSocket(socket,handshakeAtMonoMs){
  const s=state(socket),deadlineMs=c.now()+maxRequestMs;
  const lease=await c.taskLeaseReader.ensure({deadlineMs});
  if(socket.destroyed)fail();
  s.policy=Object.freeze({...initialPolicy,ownerTaskArn:lease.ownerTaskArn,proxyTaskArn:lease.proxyTaskArn});
  // The pre-proof lease must already name these physical endpoints.
  assertProductServiceTaskLease(lease,{policy:s.policy,tls:t,localAddress:socket.localAddress,
   remoteAddress:socket.remoteAddress,at:c.now(),monotonicNow:c.taskLeaseReader.nowMono()});
  peer(socket);
  s.lease=await c.taskLeaseReader.proveConnection({generation:lease.generation,
   localAddress:socket.localAddress,remoteAddress:socket.remoteAddress,handshakeAtMonoMs,deadlineMs});
  if(socket.destroyed)fail();assertBound(socket);
 }
 const server=createServer({key:t.key,cert:t.cert,ca:t.ca,requestCert:true,rejectUnauthorized:true,
  minVersion:'TLSv1.3',maxVersion:'TLSv1.3',ALPNProtocols:['http/1.1'],
  secureOptions:constants.SSL_OP_NO_TICKET,maxHeaderSize:16384,headersTimeout:maxRequestMs,
  requestTimeout:maxRequestMs,...PRODUCT_OWNER_IDLE_SOCKETS},(req,res)=>runOwnerHttpRequest(telemetry,async()=>{
  const socket=req.socket,s=state(socket),started=c.now(),deadline=started+maxRequestMs;
  const abort=new AbortController();let timer,releaseRequest;
  req.once('aborted',()=>{if(releaseRequest){abort.abort();socket.destroy();}});
  try{
   const health=req.method==='GET'&&['/health/live','/health/ready'].includes(req.url);
   if(closed||!health&&!operational())fail();releaseRequest=acquireProductOwnerRequest(s);
   controllers.add(abort);s.abort=abort;
   productOwnerRoute(req.method,req.url);
   if(req.httpVersion!=='1.1'||req.rawHeaders.length>128)fail();
   const headers=new Map();for(let i=0;i<req.rawHeaders.length;i+=2){const name=req.rawHeaders[i].toLowerCase();if(headers.has(name))fail();headers.set(name,req.rawHeaders[i+1]);}
   await s.binding;
   await c.taskLeaseReader.ensure({deadlineMs:deadline,signal:abort.signal});
   assertBound(socket);const p=peer(socket),policy=s.policy;
   if(health){
    if(headers.has('transfer-encoding')||headers.has('authorization')||headers.has('content-encoding')||
       headers.has('content-length')&&headers.get('content-length')!=='0')fail();
    if(req.url==='/health/ready'&&!available())fail();
    const result=wire({status:req.url==='/health/live'?'live':'ready'});
    res.writeHead(200,{'content-type':'application/json','content-length':String(result.length),'cache-control':'no-store',
     'x-meri-owner-revision':policy.deploymentRevision});res.end(result);return;
   }
   if(headers.get('content-type')!=='application/json'||! /^(?:0|[1-9][0-9]*)$/u.test(headers.get('content-length')??'')||
      Number(headers.get('content-length'))<1||Number(headers.get('content-length'))>MAX||
      [...headers.keys()].some(v=>v==='transfer-encoding'||v==='authorization'||v==='content-encoding'||v==='forwarded'||v.startsWith('x-')))fail();
   const parts=[];let bytes=0;
   timer=setTimeout(()=>{abort.abort();socket.destroy();},maxRequestMs);
   for await(const part of req){bytes+=part.length;if(bytes>MAX||c.now()>=deadline)fail();parts.push(part);}
   if(bytes!==Number(headers.get('content-length'))||req.rawTrailers.length)fail();
   const result=await dispatch(req.url,Buffer.concat(parts,bytes),socket,p,deadline,abort.signal);
   assertBound(socket);
   if(!available()||abort.signal.aborted||c.now()>=deadline||!Buffer.isBuffer(result)||result.length>MAX)fail();
   res.writeHead(200,{'content-type':'application/json','content-length':String(result.length),'cache-control':'no-store',
    'x-meri-owner-revision':policy.deploymentRevision});res.end(result);
  }catch{if(!res.headersSent&&!socket.destroyed){res.writeHead(403,{'content-length':'0','cache-control':'no-store','connection':'close'}).end(()=>socket.destroy());}
   else socket.destroy();}
  finally{clearTimeout(timer);controllers.delete(abort);if(s.abort===abort)s.abort=null;releaseRequest?.();}
 }));
 server.maxConnections=16;
 server.on('connection',socket=>{sockets.add(socket);socket.on('error',()=>{});socket.once('close',()=>sockets.delete(socket));});
 server.on('secureConnection',socket=>{
  sockets.add(socket);socket.once('close',()=>{sockets.delete(socket);closeSocketSessions(socket);});
  const s=state(socket),handshakeAtMonoMs=c.taskLeaseReader.nowMono();
  s.binding=bindSocket(socket,handshakeAtMonoMs);void s.binding.catch(()=>socket.destroy());
 });
 server.on('clientError',(_error,socket)=>socket.destroy());server.on('tlsClientError',()=>{});
 server.on('error',()=>{retire();if(!closed)c.taskLeaseReader.retire();});
 const listener=createProductOwnerListenerLifecycle(server,{retire,pendingRequests:()=>controllers.size,maxCloseMs:maxRequestMs});
 return Object.freeze({get available(){return available();},get pendingRequests(){return controllers.size;},
  async listen(value){if(!available())fail();await listener.listen(value);},
  close(){closed=true;unsubscribe();closeGeneration();const result=listener.close(),retained=[...sessions.values()];
   const finish=()=>{for(const session of retained)finishOwnerChannel(session.channel);};
   void result.then(finish,finish);sessions.clear();return result;}});
}
