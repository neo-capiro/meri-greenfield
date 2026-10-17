/** Private Temporal token issuer. This is a source-only boundary: TLS material, the
 * signing operation, and the live ECS/revocation authority are supplied by their
 * respective owners. A request body is never an authority for a workload. */
import {createServer} from 'node:https';
import {createTemporalIssuerToken,validateTemporalIssuerPublicJwk} from './protocol.mjs';

const TOKEN_PATH='/v1/internal/temporal/token/read';
const JWKS_PATH='/.well-known/jwks.json';
const IDENTITY_KEYS=['role','subject','workloadPrincipal'];
const REQUEST_KEYS=['schemaVersion',...IDENTITY_KEYS,'namespace','audience','issuer'];
const STATE_KEYS=['state','identity','observedAtMs','validUntilMs'];
const fault=()=>Object.assign(Error('TEMPORAL_ISSUER_REFUSED'),{code:'TEMPORAL_ISSUER_REFUSED'});
const own=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
 Object.getPrototypeOf(value)===Object.prototype&&Object.keys(value).length===keys.length&&
 keys.every(key=>Object.hasOwn(value,key));
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const exactIdentity=(a,b)=>own(a,IDENTITY_KEYS)&&own(b,IDENTITY_KEYS)&&
 IDENTITY_KEYS.every(key=>a[key]===b[key]);
const origin=value=>{
 try{const url=new URL(value);return url.protocol==='https:'&&url.username===''&&url.password===''&&
  url.search===''&&url.hash===''&&url.pathname==='/'&&url.origin===value&&url.hostname===url.hostname.toLowerCase();}
 catch{return false;}
};
const name=value=>typeof value==='string'&&/^[A-Za-z0-9._:-]{1,128}$/u.test(value);
const role=value=>value==='control'||value==='temporal-worker';
const configKeys=['schemaVersion','issuerOrigin','kid','namespace','audience','maxRequestMs','maxBodyBytes','currentnessLeaseMs'];

/** Closed public configuration. issuerOrigin is a bare HTTPS URL; JWT/request iss
 * is exactly issuerOrigin + '/', matching Temporal's retained issuer field. */
export function parseTemporalIssuerServiceConfiguration(raw){
 if(!own(raw,configKeys)||raw.schemaVersion!==1||!origin(raw.issuerOrigin)||
    !name(raw.kid)||raw.namespace!=='meri'||raw.audience!=='meri-temporal'||
    !integer(raw.maxRequestMs,1,30000)||!integer(raw.maxBodyBytes,128,8192)||
    !integer(raw.currentnessLeaseMs,raw.maxRequestMs+1,120000))throw fault();
 return Object.freeze({...raw});
}

function headers(response,status,body){
 if(response.headersSent||response.writableEnded)return;
 const bytes=Buffer.from(JSON.stringify(body),'utf8');
 response.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
  'Content-Length':String(bytes.length),'Cache-Control':'no-store',Pragma:'no-cache',
  'X-Content-Type-Options':'nosniff'});
 response.end(bytes);
}
const refused=(response,status=400)=>headers(response,status,{error:'TEMPORAL_ISSUER_REFUSED'});
const unavailable=(identity,observedAtMs)=>({schemaVersion:1,state:'UNAVAILABLE',identity,
 observedAtMs,validUntilMs:null,token:null});
const rejected=(identity,observedAtMs)=>({schemaVersion:1,state:'REVOKED',identity,
 observedAtMs,validUntilMs:null,token:null});

async function readJson(request,maxBodyBytes,signal){
 const contentType=request.headers['content-type'];
 if(contentType!=='application/json'||request.headers['content-encoding']!==undefined||
    (request.headers['content-length']!==undefined&&
     (!/^\d+$/u.test(request.headers['content-length'])||Number(request.headers['content-length'])>maxBodyBytes)))throw fault();
 let length=0;const chunks=[];
 const interrupt=()=>request.destroy?.(fault());
 signal.addEventListener('abort',interrupt,{once:true});
 try{
  for await(const chunk of request){
   signal.throwIfAborted();length+=chunk.length;if(length>maxBodyBytes)throw fault();chunks.push(chunk);
  }
  signal.throwIfAborted();
 }finally{signal.removeEventListener('abort',interrupt);}
 const raw=Buffer.concat(chunks,length).toString('utf8');
 let body;try{body=JSON.parse(raw);}catch{throw fault();}
 // The paired client emits one exact JSON object. This rejects duplicate keys,
 // alternate encodings and ambiguous transport transformations before binding.
 if(JSON.stringify(body)!==raw)throw fault();
 if(!own(body,REQUEST_KEYS)||body.schemaVersion!==1||!role(body.role)||
    !name(body.subject)||!name(body.workloadPrincipal)||body.namespace!=='meri'||
    body.audience!=='meri-temporal')throw fault();
 return body;
}

function peerFrom(request){
 const socket=request.socket;
 if(socket?.encrypted!==true||socket.authorized!==true||typeof socket.getPeerCertificate!=='function')throw fault();
 const certificate=socket.getPeerCertificate(true);
 if(!certificate||typeof certificate!=='object'||!Buffer.isBuffer(certificate.raw)||
    certificate.raw.length===0||!/^([\dA-F]{2}:){31}[\dA-F]{2}$/iu.test(certificate.fingerprint256??''))throw fault();
 return Object.freeze({authorized:true,certificate});
}

function checkedFact(raw,identity,startedAtMs,nowMs,currentnessLeaseMs){
 if(!raw||typeof raw!=='object'||!['CURRENT','REVOKED','UNAVAILABLE'].includes(raw.state)||
    !exactIdentity(raw.identity,identity)||
    !integer(raw.observedAtMs,startedAtMs,nowMs))throw fault();
 if(raw.state!=='CURRENT'){
  if(raw.validUntilMs!==null)throw fault();
  return raw;
 }
 if(!integer(raw.validUntilMs,nowMs+1,raw.observedAtMs+currentnessLeaseMs))throw fault();
 if(!name(raw.revision))throw fault();
 return raw;
}

function bounded(call,signal){
 signal.throwIfAborted();
 let interrupt;
 const stopped=new Promise((_,reject)=>{
  interrupt=()=>reject(fault());signal.addEventListener('abort',interrupt,{once:true});
 });
 return Promise.race([Promise.resolve().then(call),stopped]).finally(()=>signal.removeEventListener('abort',interrupt));
}

/** The actual HTTPS boundary. taskAuthority.readCurrent must independently map
 * the verified TLS peer to live service/task/revocation facts on EACH call. sign
 * is an externally owned RSA signing port; protocol.mjs verifies its result
 * against the pinned public JWK before this service can release it. */
export function createTemporalIssuerService({configuration,taskAuthority,sign,publicJwk,now=Date.now}={}){
 const c=parseTemporalIssuerServiceConfiguration(configuration);
 if(typeof taskAuthority?.readCurrent!=='function'||typeof sign!=='function'||typeof now!=='function')throw fault();
 try{validateTemporalIssuerPublicJwk(publicJwk,c.kid);}catch{throw fault();}
 const pinnedPublicJwk=Object.freeze({...publicJwk});
 let closed=false,server=null;const active=new Set();
 const available=()=>!closed&&server?.listening===true;
 async function handle(request,response){
  if(closed){refused(response,503);return;}
  if(request.url===JWKS_PATH&&request.method==='GET'){
   if(request.headers['content-length']!==undefined||request.headers['transfer-encoding']!==undefined){refused(response);return;}
   headers(response,200,{keys:[pinnedPublicJwk]});return;
  }
  if(request.url!==TOKEN_PATH||request.method!=='POST'){refused(response,404);return;}
  let peer;try{peer=peerFrom(request);}catch{refused(response,401);return;}
  const controller=new AbortController();
  const operation={controller,response};active.add(operation);
  const abort=()=>controller.abort();
  request.once('aborted',abort);response.once('close',abort);
  const timeout=setTimeout(()=>{controller.abort();refused(response,503);request.destroy?.();},c.maxRequestMs);timeout.unref?.();
  let identity;
  try{
   const startedAtMs=now();if(!integer(startedAtMs,0,Number.MAX_SAFE_INTEGER))throw fault();
   const body=await readJson(request,c.maxBodyBytes,controller.signal);
   if(body.issuer!==c.issuerOrigin+'/'||body.namespace!==c.namespace||body.audience!==c.audience)throw fault();
   identity={role:body.role,subject:body.subject,workloadPrincipal:body.workloadPrincipal};
   const first=checkedFact(await bounded(()=>taskAuthority.readCurrent({peer,identity,signal:controller.signal}),controller.signal),
    identity,startedAtMs,now(),c.currentnessLeaseMs);
   controller.signal.throwIfAborted();
   if(first.state!=='CURRENT'){
    headers(response,200,first.state==='REVOKED'?rejected(identity,first.observedAtMs):unavailable(identity,first.observedAtMs));return;
   }
   if(first.validUntilMs<=now()+c.maxRequestMs)throw fault();
   const issued=await createTemporalIssuerToken({issuerOrigin:c.issuerOrigin,kid:c.kid,
    publicJwk:pinnedPublicJwk,role:first.identity.role,subject:first.identity.subject,audience:c.audience,
    namespace:c.namespace,nowMs:now(),validUntilMs:first.validUntilMs,
    sign:input=>bounded(()=>sign(input,{signal:controller.signal,identity:first.identity}),controller.signal)});
   controller.signal.throwIfAborted();
   const second=checkedFact(await bounded(()=>taskAuthority.readCurrent({peer,identity,signal:controller.signal}),controller.signal),
    identity,startedAtMs,now(),c.currentnessLeaseMs);
   controller.signal.throwIfAborted();
   if(second.state!=='CURRENT'){
    headers(response,200,second.state==='REVOKED'?rejected(identity,second.observedAtMs):unavailable(identity,second.observedAtMs));return;
   }
   // A re-bound task/revision is not the workload whose token was signed.
   if(first.revision!==second.revision)throw fault();
   const observedAtMs=second.observedAtMs;
   // Temporal can use an already-issued JWT until exp. A shorter second lease
   // cannot be repaired by clipping only this HTTP response's currentness.
   if(issued.expiresAtMs>second.validUntilMs)throw fault();
   const validUntilMs=Math.min(first.validUntilMs,second.validUntilMs,issued.expiresAtMs);
   if(validUntilMs<=now()+c.maxRequestMs||validUntilMs>observedAtMs+c.currentnessLeaseMs)throw fault();
   if(closed)throw fault();
   headers(response,200,{schemaVersion:1,state:'CURRENT',identity,observedAtMs,validUntilMs,
    token:{token:issued.token,expiresAtMs:issued.expiresAtMs,
     claims:{namespace:c.namespace,audience:c.audience,issuer:c.issuerOrigin+'/'}}});
  }catch{
   if(!controller.signal.aborted&&!response.writableEnded){
    if(identity)headers(response,200,unavailable(identity,now()));else refused(response);
   }
  }finally{
   clearTimeout(timeout);request.off('aborted',abort);response.off('close',abort);active.delete(operation);
  }
 }
 async function listen({tls,host,port}){
  if(closed||server||!tls||typeof tls!=='object'||!tls.key||!tls.cert||!tls.ca||
     typeof host!=='string'||!host||!integer(port,1,65535))throw fault();
  // A public JWKS read shares this listener; token POST explicitly requires the
  // completed client-certificate handshake and the fresh server-side binding.
  server=createServer({key:tls.key,cert:tls.cert,ca:tls.ca,requestCert:true,
   rejectUnauthorized:false,minVersion:'TLSv1.3'},(req,res)=>{handle(req,res).catch(()=>refused(res,503));});
  try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
   return Object.freeze({address:server.address()});
  }catch{server.close();server=null;throw fault();}
 }
 async function close(){
  closed=true;
  for(const operation of active){operation.controller.abort();refused(operation.response,503);}
  if(server){const held=server;server=null;held.closeAllConnections?.();await new Promise(resolve=>held.close(resolve));}
 }
 return Object.freeze({handle,listen,close,available});
}
