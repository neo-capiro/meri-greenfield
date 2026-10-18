/** Trusted D005 supervisor client for the fixed private mTLS currentness endpoint. No tool-facing method exposes
 * TLS material, endpoint selection, nonce, host identity or a way to mint/extend a lease. */
import https from 'node:https';
import {randomBytes} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {nativeSignal} from '../../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertHostAllocation,assertHostRunBinding,assertD005HostIdentity,MAX_HOST_CURRENTNESS_MS} from '../binding.mjs';
import {privateAddress,dnsName,fingerprint,tlsBytes,checkedCertificate,MAX_CERT_LIFETIME_MS} from './tls.mjs';
import {HOST_CONTROL_PATH,HOST_CONTROL_MAX_BYTES,HOST_CONTROL_PURPOSES,
 hostClientDnsName,makeHostControlRequest,hostControlResponse,encodeHostControl,decodeHostControl} from './protocol.mjs';

const fail=()=>{throw Object.assign(new Error('HOST_CONTROL_UNAVAILABLE'),{code:'HOST_CONTROL_UNAVAILABLE'});};
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const bodyResponse=(res,signal)=>new Promise((resolve,reject)=>{
 let size=0,done=false;const chunks=[];
 const end=(error,bytes)=>{if(done)return;done=true;error?reject(error):resolve(bytes);};
 if(res.statusCode!==200||res.headers.location!==undefined||res.headers['content-type']!=='application/json'||
  res.headers['content-encoding']!==undefined){res.resume();return end(new Error('refused'));}
 const length=res.headers['content-length'];
 if(typeof length!=='string'||!/^[1-9][0-9]*$/u.test(length)||Number(length)>HOST_CONTROL_MAX_BYTES){
  res.resume();return end(new Error('refused'));
 }
 signal.addEventListener('abort',()=>{res.destroy();end(new Error('aborted'));},{once:true});
 res.on('data',chunk=>{if(done)return;if(!Buffer.isBuffer(chunk)||size+chunk.length>HOST_CONTROL_MAX_BYTES){
  res.destroy();end(new Error('refused'));return;}size+=chunk.length;chunks.push(chunk);});
 res.on('end',()=>size===Number(length)?end(null,Buffer.concat(chunks,size)):end(new Error('refused')));
 res.on('aborted',()=>end(new Error('aborted')));res.on('error',error=>end(error));
 res.on('close',()=>{if(!done)end(new Error('closed'));});
});

/** Endpoint is a literal private IPv4 address, plus separately pinned DNS SAN and DER fingerprint. This avoids
 * any DNS lookup in the SDK supervisor namespace. `tls` is runtime-supplied short-lived material. */
export function createHostCurrentnessClient({allocation,binding,hostIdentity,purpose,endpoint,tls,maxFreshMs,timeoutMs,
 now=Date.now,httpsModule=https}={}){
 const a=assertHostAllocation(allocation),b=assertHostRunBinding(a,binding),i=assertD005HostIdentity(hostIdentity,b,a);
 if(!endpoint||!tls||!HOST_CONTROL_PURPOSES.includes(purpose)||typeof now!=='function'||typeof httpsModule?.request!=='function'||
  !Number.isSafeInteger(maxFreshMs)||maxFreshMs<1||maxFreshMs>MAX_HOST_CURRENTNESS_MS||
  !Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>Math.min(5000,maxFreshMs))fail();
 let address,serverName,serverFingerprintSha256,cert,key,ca;
 try{address=privateAddress(endpoint.address);serverName=dnsName(endpoint.serverName);
  serverFingerprintSha256=fingerprint(endpoint.serverFingerprintSha256);
  if(!Number.isSafeInteger(endpoint.port)||endpoint.port<1||endpoint.port>65535)fail();
  cert=tlsBytes(tls.cert);key=tlsBytes(tls.key);ca=tlsBytes(tls.ca);
 }catch{fail();}
 const clientDnsName=hostClientDnsName(a),lifetime=new AbortController();let closed=false;
 const localCertificate=()=>checkedCertificate(cert,{name:clientDnsName,nowMs:now(),notAfterMs:a.leaseDeadlineMs});
 // Refuse invalid credentials before opening a socket; recheck on every read as they age.
 try{localCertificate();}catch{fail();}
 return Object.freeze({
  async readCurrent({allocation:requestedAllocation,binding:requestedBinding,policySha256,signal}={}){
   try{
    nativeSignal(signal);
    if(closed||signal?.aborted||!same(requestedAllocation,a)||!same(requestedBinding,b))fail();
    localCertificate();
    const nonce=randomBytes(32).toString('hex'),request=makeHostControlRequest({
     allocation:a,binding:b,hostIdentity:i,purpose,policySha256,nonce,signal});
    const bytes=encodeHostControl(request),cutoff=Math.min(timeoutMs,a.leaseDeadlineMs-now());
    if(cutoff<1)fail();const started=performance.now();
    const timeout=AbortSignal.timeout(cutoff),combined=AbortSignal.any([lifetime.signal,timeout,...(signal?[signal]:[])]);
    const raw=await new Promise((resolve,reject)=>{
     let outbound;try{
      outbound=httpsModule.request({host:address,port:endpoint.port,path:HOST_CONTROL_PATH,method:'POST',
       servername:serverName,cert,key,ca,agent:false,rejectUnauthorized:true,minVersion:'TLSv1.3',maxVersion:'TLSv1.3',
       signal:combined,headers:{'content-type':'application/json','content-length':String(bytes.length),'connection':'close'},
       checkServerIdentity(_name,peer){try{
        checkedCertificate(peer?.raw,{name:serverName,nowMs:now(),maxLifetimeMs:MAX_CERT_LIFETIME_MS,
         fingerprintSha256:serverFingerprintSha256});return undefined;
       }catch{return new Error('HOST_CONTROL_TLS_REFUSED');}}
      },res=>bodyResponse(res,combined).then(resolve,reject));
      outbound.on('error',reject);outbound.end(bytes);
     }catch(error){outbound?.destroy();reject(error);}
    });
    if(closed||combined.aborted||performance.now()-started>=cutoff)fail();
    const response=decodeHostControl(raw);
    return hostControlResponse(response,request,{nowMs:now(),maxFreshMs});
   }catch{fail();}
  },
  close(){if(!closed){closed=true;lifetime.abort();}return Object.freeze({closed:true});},
 });
}
