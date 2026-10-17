/** Post-placement client for a task-local Temporal service certificate.
 * ECS metadata supplies a task selector only. The private issuer establishes
 * task identity from the observed connection and its own fresh ECS/ENI reads.
 * Importing this module has no network, filesystem, or key-generation effect.
 */
import {createHash,createPrivateKey,createPublicKey,X509Certificate} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';
import {isIP} from 'node:net';
import {types} from 'node:util';
import {createRunnerPoststartCsr} from '../native-authority/runner-poststart-csr.mjs';

const CONFIG_KEYS=['schemaVersion','role','clusterArn','revision','issuerOrigin','serverName',
 'metadataUri','peerSubjectCn','peerUriBase','serverCaSha256','clientCaSha256',
 'requestTimeoutMs','totalTimeoutMs','maxReplyBytes'];
const CHALLENGE_KEYS=['schemaVersion','challengeId','proofMessage','expiresAtMs'];
const PROOF_KEYS=['schemaVersion','purpose','challengeId','nonce','role','taskArn',
 'peerIPv4','revision','taskFactSha256','csrSha256','expiresAtMs'];
const REDEEM_KEYS=['schemaVersion','certPem','registration'];
const RECEIPT_KEYS=['schemaVersion','state','certificateSha256','role','peerSanUri',
 'taskArn','revision','expiresAtMs'];
const SHA256=/^[a-f0-9]{64}$/u;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
const CERT=/^-----BEGIN CERTIFICATE-----\n(?:[A-Za-z0-9+/=]{1,64}\n)+-----END CERTIFICATE-----\n$/u;
const parsedConfigurations=new WeakSet();
const refused=()=>Object.assign(Error('TEMPORAL_ISSUER_BOOTSTRAP_CLIENT_REFUSED'),
 {code:'TEMPORAL_ISSUER_BOOTSTRAP_CLIENT_REFUSED'});
function exact(value,keys){
 return value!==null&&typeof value==='object'&&!Array.isArray(value)&&!types.isProxy(value)&&
  Object.getPrototypeOf(value)===Object.prototype&&Reflect.ownKeys(value).length===keys.length&&
  keys.every(key=>Object.hasOwn(value,key)&&
   Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'));
}
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const digest=value=>createHash('sha256').update(value).digest('hex');
function taskArnFor(clusterArn,value){
 const [,region,account,cluster]=/^arn:aws:ecs:([a-z0-9-]+):([0-9]{12}):cluster\/([A-Za-z0-9_-]{1,255})$/u.exec(clusterArn)??[];
 return typeof value==='string'&&new RegExp(`^arn:aws:ecs:${region}:${account}:task/${cluster}/[a-f0-9]{32}$`,'u').test(value);
}
function canonicalBase64(value,min=1,max=8192){
 if(typeof value!=='string'||value.length<min||value.length>max||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value))throw refused();
 const bytes=Buffer.from(value,'base64');
 if(bytes.toString('base64')!==value)throw refused();
 return bytes;
}
function certificate(value,pin,at){
 if(!Buffer.isBuffer(value)||value.length<1||value.length>16384)throw refused();
 let parsed;
 try{parsed=new X509Certificate(value);}catch{throw refused();}
 if(digest(parsed.raw)!==pin||parsed.ca!==true||
    !integer(Date.parse(parsed.validFrom),0,at)||
    !integer(Date.parse(parsed.validTo),at+1,Number.MAX_SAFE_INTEGER))throw refused();
 return parsed;
}

/** The metadata URI is injected by ECS v4. Its link-local host and /v4 token
 * are bounded here, but TaskARN remains untrusted until issuer-side proof. */
export function parseTemporalIssuerBootstrapClientConfiguration(raw){
 try{
  if(raw!==null&&typeof raw==='object'&&parsedConfigurations.has(raw))return raw;
  if(!exact(raw,CONFIG_KEYS)||raw.schemaVersion!==1||
     !['control','temporal-worker'].includes(raw.role)||
     !/^arn:aws:ecs:[a-z0-9-]+:[0-9]{12}:cluster\/[A-Za-z0-9_-]{1,255}$/u.test(raw.clusterArn)||
     typeof raw.revision!=='string'||!/^[A-Za-z0-9._:-]{1,128}$/u.test(raw.revision)||
     typeof raw.peerSubjectCn!=='string'||!/^[A-Za-z0-9._:-]{1,128}$/u.test(raw.peerSubjectCn)||
     typeof raw.peerUriBase!=='string'||!/^spiffe:\/\/[a-z0-9.-]+\/[A-Za-z0-9/_-]+\/$/u.test(raw.peerUriBase)||
     !SHA256.test(raw.serverCaSha256)||!SHA256.test(raw.clientCaSha256)||
     !integer(raw.requestTimeoutMs,100,15000)||
     !integer(raw.totalTimeoutMs,raw.requestTimeoutMs,30000)||
     !integer(raw.maxReplyBytes,1024,32768))throw refused();
  const issuer=new URL(raw.issuerOrigin),metadata=new URL(raw.metadataUri);
  if(issuer.protocol!=='https:'||issuer.origin!==raw.issuerOrigin||issuer.port!=='8445'||
     issuer.pathname!=='/'||issuer.search||issuer.hash||issuer.username||issuer.password||
     !/^[a-z0-9.-]+$/u.test(issuer.hostname)||raw.serverName!==issuer.hostname||
     metadata.protocol!=='http:'||metadata.hostname!=='169.254.170.2'||metadata.port||
     !/^\/v4\/[A-Za-z0-9-]{1,128}$/u.test(metadata.pathname)||metadata.search||
     metadata.hash||metadata.username||metadata.password||metadata.href!==raw.metadataUri)throw refused();
  const parsed=Object.freeze({...raw});parsedConfigurations.add(parsed);return parsed;
 }catch{throw refused();}
}

function readHttp({request,url,method,body,configuration,ca,signal,secure,trackRequest}){
 return new Promise((resolve,reject)=>{
  let call,timer,done=false,size=0;const chunks=[];
  const finish=(value,error)=>{if(done)return;done=true;clearTimeout(timer);
   signal?.removeEventListener('abort',abort);if(error)reject(refused());else resolve(value);};
  const abort=()=>{call?.destroy();finish(null,true);};
  try{
   const options={method,agent:false,maxHeaderSize:8192,timeout:configuration.requestTimeoutMs,
    headers:{accept:'application/json','accept-encoding':'identity','cache-control':'no-store',
     connection:'close',...(body?{'content-type':'application/json','content-length':String(body.length)}:{})}};
   if(secure)Object.assign(options,{ca,servername:configuration.serverName,
    minVersion:'TLSv1.3',rejectUnauthorized:true});
   timer=setTimeout(abort,configuration.requestTimeoutMs);timer.unref?.();
   call=request(url,options,response=>{
    const headers=response.headers??{},length=headers['content-length'],socket=response.socket;
    if(response.statusCode!==200||headers.location||headers['set-cookie']||
       headers['content-encoding']&&headers['content-encoding']!=='identity'||
       typeof headers['content-type']!=='string'||
       !/^application\/json(?:;\s*charset=utf-8)?$/iu.test(headers['content-type'])||
       length!==undefined&&(!/^(0|[1-9][0-9]*)$/u.test(length)||
        Number(length)>configuration.maxReplyBytes)||
       headers['transfer-encoding']&&length!==undefined||
       secure&&(socket?.encrypted!==true||socket.authorized!==true||
        socket.getProtocol?.()!=='TLSv1.3')){
     response.destroy();finish(null,true);return;
    }
    response.on('data',part=>{size+=part.length;if(size>configuration.maxReplyBytes){
     response.destroy();finish(null,true);}else chunks.push(part);});
    response.once('end',()=>{if(!response.complete||response.rawTrailers?.length||
       length!==undefined&&size!==Number(length))finish(null,true);
     else finish(Buffer.concat(chunks,size),false);});
    response.once('aborted',()=>finish(null,true));response.once('error',()=>finish(null,true));
   });
   trackRequest(call);
   call.once('error',()=>finish(null,true));call.once('timeout',abort);
   signal?.addEventListener('abort',abort,{once:true});
   if(signal?.aborted)abort();else call.end(body);
  }catch{finish(null,true);}
 });
}
function json(bytes){
 try{return JSON.parse(bytes.toString('utf8'));}catch{throw refused();}
}
function challenge(value,{configuration,taskArn,csrPem,startedAtMs,at}){
 if(!exact(value,CHALLENGE_KEYS)||value.schemaVersion!==1||
    !UUID.test(value.challengeId)||!integer(value.expiresAtMs,at+1,startedAtMs+15000))throw refused();
 const bytes=canonicalBase64(value.proofMessage,44,4096),proof=json(bytes);
 if(!exact(proof,PROOF_KEYS)||Buffer.from(JSON.stringify(proof),'utf8').compare(bytes)!==0||
    proof.schemaVersion!==1||proof.purpose!=='meri-temporal-service-client-cert-bootstrap'||
    proof.challengeId!==value.challengeId||proof.role!==configuration.role||
    proof.taskArn!==taskArn||proof.revision!==configuration.revision||
    proof.expiresAtMs!==value.expiresAtMs||isIP(proof.peerIPv4)!==4||
    !SHA256.test(proof.taskFactSha256)||proof.csrSha256!==digest(Buffer.from(csrPem,'utf8'))||
    typeof proof.nonce!=='string'||!/^[A-Za-z0-9_-]{43}$/u.test(proof.nonce)||
    Buffer.from(proof.nonce,'base64url').length!==32)throw refused();
 return bytes;
}
function acceptedCertificate(value,{configuration,taskArn,keyPem,clientCa,at}){
 if(!exact(value,REDEEM_KEYS)||value.schemaVersion!==1||
    typeof value.certPem!=='string'||value.certPem.length>16384||
    !CERT.test(value.certPem)||!exact(value.registration,RECEIPT_KEYS))throw refused();
 const encoded=value.certPem.replace('-----BEGIN CERTIFICATE-----\n','')
  .replace('\n-----END CERTIFICATE-----\n','').replaceAll('\n','');
 if(Buffer.from(encoded,'base64').toString('base64')!==encoded||
    value.certPem!==`-----BEGIN CERTIFICATE-----\n${encoded.match(/.{1,64}/gu).join('\n')}\n-----END CERTIFICATE-----\n`)throw refused();
 const leaf=new X509Certificate(value.certPem),receipt=value.registration;
 const expectedSan=configuration.peerUriBase+encodeURIComponent(taskArn);
 const spki=createPublicKey(createPrivateKey(keyPem)).export({type:'spki',format:'der'});
 if(receipt.schemaVersion!==1||receipt.state!=='CURRENT'||
    receipt.role!==configuration.role||receipt.taskArn!==taskArn||
    receipt.revision!==configuration.revision||receipt.peerSanUri!==expectedSan||
    receipt.certificateSha256!==digest(leaf.raw)||!SHA256.test(receipt.certificateSha256)||
    leaf.ca!==false||leaf.subject!==`CN=${configuration.peerSubjectCn}`||
    leaf.subjectAltName!==`URI:${expectedSan}`||
    leaf.keyUsage?.length!==1||leaf.keyUsage[0]!=='1.3.6.1.5.5.7.3.2'||
    !leaf.publicKey.export({type:'spki',format:'der'}).equals(spki)||
    !leaf.checkIssued(clientCa)||!leaf.verify(clientCa.publicKey)||
    !integer(Date.parse(leaf.validFrom),0,at)||
    !integer(Date.parse(leaf.validTo),at+1,at+3600000)||
    receipt.expiresAtMs!==Date.parse(leaf.validTo))throw refused();
 return Object.freeze({schemaVersion:1,role:configuration.role,taskArn,
  certificateSha256:receipt.certificateSha256,expiresAtMs:receipt.expiresAtMs,
  keyPem,certPem:Buffer.from(value.certPem,'utf8'),registration:Object.freeze({...receipt})});
}

/** Returns verified task-local buffers; the caller owns atomic 0700/0600
 * material installation and MUST wipe `keyPem` after that operation. The
 * source CSR helper exports a JS PEM string, so physical key zeroization before
 * GC cannot be proven. Nothing is persisted by this module. */
export function createTemporalIssuerBootstrapClient({configuration,serverCaPem,clientCaPem,
 metadataRequest=httpRequest,request=httpsRequest,now=Date.now}={}){
 const c=parseTemporalIssuerBootstrapClientConfiguration(configuration);
 if(!Buffer.isBuffer(serverCaPem)||!Buffer.isBuffer(clientCaPem)||
    typeof metadataRequest!=='function'||typeof request!=='function'||typeof now!=='function')throw refused();
 const serverCa=Buffer.from(serverCaPem),clientCaBytes=Buffer.from(clientCaPem);
 let clientCa;
 try{certificate(serverCa,c.serverCaSha256,now());
  clientCa=certificate(clientCaBytes,c.clientCaSha256,now());}
 catch{serverCa.fill(0);clientCaBytes.fill(0);throw refused();}
 let state='new',controller=null,closeReceipt=null;
 const physical=new Set();
 const trackRequest=call=>{
  physical.add(call);
  call.once('close',()=>physical.delete(call));
  // A completed ClientRequest can precede actual TLS/TCP socket retirement.
  call.once('socket',socket=>{
   physical.add(socket);
   socket.once('close',()=>physical.delete(socket));
   // A transport can deliver its assigned socket after the abort race has
   // released the caller and after close walked the old request set.
   if(state==='closed'||controller?.signal.aborted)try{socket.destroy?.();}catch{}
  });
 };
 const close=()=>{
  // Socket settlement alone cannot prove whether the issuer registered a
  // certificate before abort. Preserve the first UNKNOWN retirement witness.
  if(closeReceipt)return closeReceipt;
  state='closed';controller?.abort();
  for(const raw of physical)try{raw.destroy?.();}catch{}
  serverCa.fill(0);clientCaBytes.fill(0);
  const pendingOperations=physical.size+(controller===null?0:1);
  closeReceipt=Object.freeze({schemaVersion:1,
   state:pendingOperations===0?'CLEAN':'CLEANUP_UNKNOWN',pendingOperations});
  return closeReceipt;
 };
 return Object.freeze({
  available:()=>state==='new',
  close,
  async bootstrap({signal}={}){
   if(state!=='new'||signal?.aborted)throw refused();
   state='running';controller=new AbortController();let keyPem,delivered=false;
   const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
   const deadline=setTimeout(abort,c.totalTimeoutMs);deadline.unref?.();
   try{
    const startedAtMs=now();if(!integer(startedAtMs,0,Number.MAX_SAFE_INTEGER))throw refused();
    const metadataBytes=await readHttp({request:metadataRequest,
     url:new URL(c.metadataUri+'/task'),method:'GET',configuration:c,
     signal:controller.signal,secure:false,trackRequest});
    const metadata=json(metadataBytes),taskArn=metadata?.TaskARN;
    if(!taskArnFor(c.clusterArn,taskArn)||controller.signal.aborted)throw refused();
    const csr=createRunnerPoststartCsr();keyPem=Buffer.from(csr.keyPem,'utf8');
    const body={schemaVersion:1,role:c.role,taskArn,csrPem:csr.csrPem};
    const challengeBytes=await readHttp({request,url:new URL('/v1/internal/temporal/bootstrap/challenge',c.issuerOrigin),
     method:'POST',body:Buffer.from(JSON.stringify(body),'utf8'),configuration:c,
     ca:serverCa,signal:controller.signal,secure:true,trackRequest});
    const challengeReply=json(challengeBytes);
    const proofMessage=challenge(challengeReply,{configuration:c,taskArn,csrPem:csr.csrPem,
     startedAtMs,at:now()});
    if(controller.signal.aborted||challengeReply.expiresAtMs<=now())throw refused();
    const redeem={...body,challengeId:challengeReply.challengeId,
     proofBase64:csr.signProof(proofMessage)};
    const resultBytes=await readHttp({request,url:new URL('/v1/internal/temporal/bootstrap/redeem',c.issuerOrigin),
     method:'POST',body:Buffer.from(JSON.stringify(redeem),'utf8'),configuration:c,
     ca:serverCa,signal:controller.signal,secure:true,trackRequest});
    const finishedAtMs=now();
    if(controller.signal.aborted||challengeReply.expiresAtMs<=finishedAtMs||
       !integer(finishedAtMs,startedAtMs,startedAtMs+c.totalTimeoutMs)||state==='closed')throw refused();
    const material=acceptedCertificate(json(resultBytes),{configuration:c,taskArn,keyPem,
     clientCa,at:finishedAtMs});
    delivered=true;keyPem=null;state='delivered';return material;
   }catch{state='closed';throw refused();}
   finally{if(!delivered)keyPem?.fill(0);clearTimeout(deadline);
    signal?.removeEventListener('abort',abort);controller=null;
    serverCa.fill(0);clientCaBytes.fill(0);}
  },
 });
}
