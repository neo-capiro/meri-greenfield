/** Pinned Temporal issuer delivery for the existing task-local token writer.
 * Configuration parsing has no filesystem, network, or secret side effect. The
 * returned port performs a fresh mutually authenticated request for each read.
 */
import {createHash} from 'node:crypto';
import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {request as httpsRequest} from 'node:https';
import {posix} from 'node:path';
import {types} from 'node:util';
import {verifyTemporalIssuerToken} from './protocol.mjs';

const refused=()=>{throw Object.assign(Error('TEMPORAL_ISSUER_DELIVERY_REFUSED'),{code:'TEMPORAL_ISSUER_DELIVERY_REFUSED'});};
const fields=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&!types.isProxy(value)&&
 Object.getPrototypeOf(value)===Object.prototype&&Reflect.ownKeys(value).length===keys.length&&
 keys.every(key=>Object.hasOwn(value,key)&&Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'));
const path=value=>typeof value==='string'&&value.startsWith('/')&&!value.includes('\\')&&!value.includes('//')&&
 value===posix.normalize(value)&&!value.endsWith('/')&&/^\/[A-Za-z0-9._/-]+$/u.test(value)&&
 !value.split('/').includes('..')&&!value.split('/').includes('.');
const number=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const hex64=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const parsedConfigurations=new WeakSet();

export function parseTemporalIssuerDeliveryConfiguration(raw){
 try{
  // Only the exact frozen object returned here can carry the derived issuer.
  // A JSON object or clone that posts an `issuer` field remains rejected.
  if(raw!==null&&typeof raw==='object'&&parsedConfigurations.has(raw))return raw;
  if(!fields(raw,['schemaVersion','issuerOrigin','audience','namespace','identity','publicKey','tls','requestTimeoutMs','maxReplyBytes'])||raw.schemaVersion!==1)refused();
  const url=new URL(raw.issuerOrigin);
  if(url.protocol!=='https:'||url.port!=='8445'||url.origin!==raw.issuerOrigin||url.pathname!=='/'||url.search||url.hash||url.username||url.password||
     !/^[a-z0-9.-]+$/u.test(url.hostname)||raw.audience!=='meri-temporal'||raw.namespace!=='meri')refused();
  const identity=raw.identity;
  if(!fields(identity,['role','subject','workloadPrincipal'])||!['control','temporal-worker'].includes(identity.role)||
     identity.subject!==(identity.role==='control'?'meri-temporal-control:v1':'meri-temporal-worker:v1')||
     identity.workloadPrincipal!==(identity.role==='control'?'meri-workload-control:v1':'meri-workload-worker:v1'))refused();
  const publicKey=raw.publicKey;
  if(!fields(publicKey,['kid','alg','jwkSha256','manifestFile'])||publicKey.alg!=='RS256'||
     typeof publicKey.kid!=='string'||!/^[A-Za-z0-9._:-]{1,128}$/u.test(publicKey.kid)||
     !hex64(publicKey.jwkSha256)||!path(publicKey.manifestFile))refused();
  const tls=raw.tls;
  if(!fields(tls,['serverName','issuerCaFile','clientCertFile','clientKeyFile'])||tls.serverName!==url.hostname||
     !path(tls.issuerCaFile)||!path(tls.clientCertFile)||!path(tls.clientKeyFile)||
     new Set([publicKey.manifestFile,tls.issuerCaFile,tls.clientCertFile,tls.clientKeyFile]).size!==4||
     !number(raw.requestTimeoutMs,100,30000)||!number(raw.maxReplyBytes,512,32768))refused();
  const parsed=Object.freeze({schemaVersion:1,issuerOrigin:raw.issuerOrigin,issuer:raw.issuerOrigin+'/',
   audience:raw.audience,namespace:raw.namespace,identity:Object.freeze({...identity}),
   publicKey:Object.freeze({...publicKey}),tls:Object.freeze({...tls}),
   requestTimeoutMs:raw.requestTimeoutMs,maxReplyBytes:raw.maxReplyBytes});
  parsedConfigurations.add(parsed);return parsed;
 }catch{refused();}
}

async function readOwnedFile(file,{kind,signal}){
 let handle;
 try{
  handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);
  const stat=await handle.stat(),limit=kind==='manifest'?16384:65536;
  if(!stat.isFile()||stat.size<1||stat.size>limit||stat.nlink!==1||
     (stat.mode&0o022)!==0||kind==='clientKey'&&(stat.mode&0o077)!==0)refused();
  const bytes=await handle.readFile({signal});
  if(bytes.length!==stat.size||signal?.aborted){if(kind==='clientKey')bytes.fill(0);refused();}
  return bytes;
 }catch{refused();}finally{await handle?.close();}
}

function pinnedJwk(bytes,expected){
 try{
  const manifest=JSON.parse(bytes.toString('utf8'));
  if(!fields(manifest,['keys'])||!Array.isArray(manifest.keys)||manifest.keys.length!==1)refused();
  const jwk=manifest.keys[0];
  if(!fields(jwk,['kty','kid','alg','use','n','e'])||jwk.kty!=='RSA'||jwk.alg!=='RS256'||jwk.use!=='sig'||
     jwk.kid!==expected.kid||typeof jwk.n!=='string'||!/^[A-Za-z0-9_-]{342,1366}$/u.test(jwk.n)||
     typeof jwk.e!=='string'||!/^[A-Za-z0-9_-]{1,8}$/u.test(jwk.e))refused();
  // Explicit field order defines the portable public-key pin. This pin includes
  // the kid and algorithm, not only the RSA modulus and exponent.
  const canonical=JSON.stringify({kty:jwk.kty,kid:jwk.kid,alg:jwk.alg,use:jwk.use,n:jwk.n,e:jwk.e});
  if(createHash('sha256').update(canonical).digest('hex')!==expected.jwkSha256)refused();
  return Object.freeze({...jwk});
 }catch{refused();}
}

function httpRead({url,body,ca,cert,key,configuration,signal,request=httpsRequest}){
 return new Promise((resolve,reject)=>{
  let done=false,call,timer,size=0;const chunks=[];
  const finish=(value,error)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);
   if(error)reject(Object.assign(Error('TEMPORAL_ISSUER_DELIVERY_REFUSED'),{code:'TEMPORAL_ISSUER_DELIVERY_REFUSED'}));else resolve(value);};
  const abort=()=>{call?.destroy();finish(null,true);};
  try{
   timer=setTimeout(abort,configuration.requestTimeoutMs);timer.unref?.();
   call=request(url,{method:'POST',agent:false,ca,cert,key,servername:configuration.tls.serverName,
    minVersion:'TLSv1.3',rejectUnauthorized:true,maxHeaderSize:8192,timeout:configuration.requestTimeoutMs,
    headers:{'content-type':'application/json','content-length':String(body.length),accept:'application/json',
     'accept-encoding':'identity','cache-control':'no-store',connection:'close'}},response=>{
    const length=response.headers['content-length'];
    if(response.statusCode!==200||response.headers.location||response.headers['set-cookie']||
       response.headers['content-encoding']&&response.headers['content-encoding']!=='identity'||
       typeof response.headers['content-type']!=='string'||!/^application\/json(?:;\s*charset=utf-8)?$/iu.test(response.headers['content-type'])||
       length!==undefined&&(!/^(0|[1-9][0-9]*)$/u.test(length)||Number(length)>configuration.maxReplyBytes)||
       response.headers['transfer-encoding']&&length!==undefined){response.destroy();finish(null,true);return;}
    response.on('data',chunk=>{size+=chunk.length;if(size>configuration.maxReplyBytes){response.destroy();finish(null,true);}else chunks.push(chunk);});
    response.once('end',()=>{if(!response.complete||response.rawTrailers.length||length!==undefined&&size!==Number(length)){
     finish(null,true);return;}finish(Buffer.concat(chunks,size),false);});
    response.once('aborted',()=>finish(null,true));response.once('error',()=>finish(null,true));
   });
   call.once('error',()=>finish(null,true));call.once('timeout',abort);
   signal?.addEventListener('abort',abort,{once:true});
   if(signal?.aborted)abort();else call.end(body);
  }catch{finish(null,true);}
 });
}

function acceptedReply(bytes,configuration,jwk,requestStartedAtMs,nowMs){
 try{
  const value=JSON.parse(bytes.toString('utf8'));
  if(!fields(value,['schemaVersion','state','identity','observedAtMs','validUntilMs','token'])||value.schemaVersion!==1||
     !['CURRENT','REVOKED','UNAVAILABLE'].includes(value.state)||
     !fields(value.identity,['role','subject','workloadPrincipal'])||
     Object.keys(configuration.identity).some(key=>value.identity[key]!==configuration.identity[key])||
     !number(value.observedAtMs,requestStartedAtMs,nowMs))refused();
  if(value.state!=='CURRENT'){
   if(value.validUntilMs!==null||value.token!==null)refused();
   return Object.freeze(value);
  }
  if(!number(value.validUntilMs,nowMs+configuration.requestTimeoutMs+1,value.observedAtMs+300000)||
     !fields(value.token,['token','expiresAtMs','claims'])||
     typeof value.token.token!=='string'||value.token.token.length>16384||
     !number(value.token.expiresAtMs,nowMs+1,value.validUntilMs)||
     !fields(value.token.claims,['namespace','audience','issuer'])||
     value.token.claims.namespace!==configuration.namespace||
     value.token.claims.audience!==configuration.audience||
     value.token.claims.issuer!==configuration.issuer)refused();
  const claims=verifyTemporalIssuerToken({token:value.token.token,issuerOrigin:configuration.issuerOrigin,
   kid:configuration.publicKey.kid,publicJwk:jwk,role:configuration.identity.role,
   subject:configuration.identity.subject,audience:configuration.audience,namespace:configuration.namespace,nowMs});
  if(claims.exp*1000!==value.token.expiresAtMs||value.token.expiresAtMs>value.validUntilMs)refused();
  return Object.freeze({...value,identity:Object.freeze(value.identity),token:Object.freeze({...value.token,claims:Object.freeze(value.token.claims)})});
 }catch{refused();}
}

/** `readMaterial(path,{kind})` may be supplied by the task's already-owned file
 * authority. With no override, the port reads only pinned absolute files and
 * requires a regular, non-symlink file; it never provisions material. */
export function createTemporalIssuerDelivery({configuration,readMaterial=readOwnedFile,now=Date.now,request=httpsRequest}={}){
 const c=parseTemporalIssuerDeliveryConfiguration(configuration);
 if(typeof readMaterial!=='function'||typeof now!=='function'||typeof request!=='function')refused();
 let closed=false;const active=new Set();
 return Object.freeze({
  available:()=>!closed,
  close(){closed=true;const unsettledOperations=active.size;for(const controller of active)controller.abort();
   return Object.freeze({unsettledOperations,physicalStopProven:unsettledOperations===0});},
  async read(input){
   const started=now();let key,timer,abortInput,controller;
   try{
    if(closed||!fields(input,['schemaVersion','role','subject','workloadPrincipal','namespace','audience','issuer','signal'])||
       input.schemaVersion!==1||input.role!==c.identity.role||input.subject!==c.identity.subject||
       input.workloadPrincipal!==c.identity.workloadPrincipal||input.namespace!==c.namespace||
       input.audience!==c.audience||input.issuer!==c.issuer||
       input.signal?.aborted||!number(started,0,Number.MAX_SAFE_INTEGER))refused();
    controller=new AbortController();active.add(controller);
    abortInput=()=>controller.abort();input.signal?.addEventListener('abort',abortInput,{once:true});
    timer=setTimeout(abortInput,c.requestTimeoutMs);timer.unref?.();
    if(input.signal?.aborted)abortInput();
    const signal=controller.signal;
    // Material reads are sequential, so a failed public pin never loads the
    // private client key. An uncooperative injected reader cannot extend the
    // caller's deadline or release a late key after close.
    async function material(file,kind){
     if(signal.aborted)refused();
     let onAbort;
     const aborted=new Promise((_,reject)=>{onAbort=()=>reject(Error('TEMPORAL_ISSUER_DELIVERY_REFUSED'));
      signal.addEventListener('abort',onAbort,{once:true});if(signal.aborted)onAbort();});
     const pending=Promise.resolve().then(()=>readMaterial(file,{kind,signal})).then(value=>{
      if(signal.aborted&&kind==='clientKey'&&Buffer.isBuffer(value))value.fill(0);return value;});
     try{return await Promise.race([pending,aborted]);}
     finally{signal.removeEventListener('abort',onAbort);}
    }
    const manifest=await material(c.publicKey.manifestFile,'manifest');
    if(!Buffer.isBuffer(manifest))refused();
    const jwk=pinnedJwk(manifest,c.publicKey);
    const ca=await material(c.tls.issuerCaFile,'issuerCa');
    const cert=await material(c.tls.clientCertFile,'clientCert');
    key=await material(c.tls.clientKeyFile,'clientKey');
    if(closed||signal.aborted||![ca,cert,key].every(Buffer.isBuffer))refused();
    const body=Buffer.from(JSON.stringify({schemaVersion:1,role:input.role,subject:input.subject,
     workloadPrincipal:input.workloadPrincipal,namespace:input.namespace,audience:input.audience,issuer:input.issuer}),'utf8');
    const bytes=await httpRead({url:new URL('/v1/internal/temporal/token/read',c.issuerOrigin),body,ca,cert,key,
     configuration:c,signal,request});
    const finished=now();
    if(closed||signal.aborted||!number(finished,started,started+c.requestTimeoutMs))refused();
    return acceptedReply(bytes,c,jwk,started,finished);
   }catch{refused();}
   finally{key?.fill(0);clearTimeout(timer);if(abortInput)input.signal?.removeEventListener('abort',abortInput);
    if(controller)active.delete(controller);}
  }
 });
}
