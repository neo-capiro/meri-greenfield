/** Control->native-host lifecycle client on the EXISTING pinned private mTLS transport. One fixed path, one closed
 * request, one bounded response. Contract validation here grants no authority; close answers map to
 * {closed:true} only for a validated 'closed' status with exact hashes and a fresh safe-integer time. */
import https from 'node:https';
import {privateAddress,dnsName,fingerprint,tlsBytes,checkedCertificate} from '../worker/conversation/host/control/tls.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {nativeObserverDeadline} from '../../packages/contracts/native-observer.mjs';
import {NATIVE_LIFECYCLE_PATH,NATIVE_LIFECYCLE_SCHEMA,NATIVE_LIFECYCLE_MAX_MS,
 NATIVE_LIFECYCLE_BODY_BYTES,assertNativeHostAllocation,assertHostRunBindingPin,assertD005HostIdentityShape,
 nativeLifecycleCloseAnswer,nativeAbsenceRecord} from '../../packages/contracts/native-lifecycle.mjs';

const fault=code=>{throw Object.assign(new Error(code),{code});};
const HEX=/^[0-9a-f]{64}$/u;
const responseLimit=32768;

function readBody(stream,limit,signal){
 return new Promise((resolve,reject)=>{
  const length=stream.headers?.['content-length'];
  if(stream.headers?.['content-type']!=='application/json'||stream.headers?.['location']!==undefined||
   stream.headers?.['content-encoding']!==undefined||stream.headers?.['transfer-encoding']!==undefined||
   typeof length!=='string'||!/^[1-9][0-9]*$/u.test(length)||Number(length)>limit)return reject(Error('refused'));
  const chunks=[];let size=0;
  stream.on('data',chunk=>{if(!Buffer.isBuffer(chunk)||size+chunk.length>limit){stream.destroy?.();reject(Error('refused'));return;}
   size+=chunk.length;chunks.push(chunk);});
  stream.on('end',()=>{try{signal?.throwIfAborted();}catch{return reject(Error('aborted'));}
   if(size!==Number(length))return reject(Error('refused'));try{resolve(JSON.parse(Buffer.concat(chunks,size).toString('utf8')));}catch{reject(Error('refused'));}});
  stream.on('error',reject);stream.on('aborted',()=>reject(Error('aborted')));
 });
}

export function createNativeLifecycleClient({allocation,binding,hostIdentity,endpoint,tls,now=Date.now,
 requestMs=10000,httpsModule=https}={}){
 const a=assertNativeHostAllocation(allocation),b=assertHostRunBindingPin(a,binding),i=assertD005HostIdentityShape(hostIdentity,b,a);
 if(!endpoint||!tls||typeof httpsModule?.request!=='function'||!Number.isSafeInteger(requestMs)||
  requestMs<1||requestMs>NATIVE_LIFECYCLE_MAX_MS)throw Error('NATIVE_LIFECYCLE_CONFIGURATION');
 // Public configuration is validated BEFORE any sensitive bytes are copied. The protected Control peer
 // identity is explicit: no guest host name, derived name or global helper is accepted here.
 if(typeof tls.clientName!=='string'||!tls.clientName)throw Error('NATIVE_LIFECYCLE_CONFIGURATION');
 let address,serverName,serverFingerprint,clientName,port;
 try{address=privateAddress(endpoint.address);serverName=dnsName(endpoint.serverName);
  serverFingerprint=fingerprint(endpoint.serverFingerprintSha256);clientName=dnsName(tls.clientName);port=endpoint.port;
  if(!Number.isSafeInteger(port)||port<1||port>65535)throw Error();}catch{throw Error('NATIVE_LIFECYCLE_CONFIGURATION');}
 const owned=[],lifetime=new AbortController();let disposed=false;
 const ownedBytes=name=>{const value=tlsBytes(tls[name]);owned.push(value);return value;};
 let cert,key,ca;
 try{cert=ownedBytes('cert');key=ownedBytes('key');ca=ownedBytes('ca');}catch{clearOwned();throw Error('NATIVE_LIFECYCLE_CONFIGURATION');}
 function clearOwned(){for(const value of owned){try{value.fill(0);}catch{}}}
 // Credential validity is INDEPENDENT of the workload allocation lease: cleanup must remain possible after
 // that lease expires. The certificate's own not-after is the per-operation cutoff.
 function credential(){if(disposed)throw Error('NATIVE_LIFECYCLE_DISPOSED');
  const certInfo=checkedCertificate(cert,{name:clientName,nowMs:now()});
  if(!Number.isSafeInteger(certInfo?.notAfterMs)||certInfo.notAfterMs<=now())throw Error('NATIVE_LIFECYCLE_CREDENTIAL');
  return certInfo.notAfterMs;}
 function local(){return credential();}
 try{local();}catch{clearOwned();throw Error('NATIVE_LIFECYCLE_CONFIGURATION');}
 const hashes=Object.freeze({allocationSha256:canonicalSha256(a),bindingSha256:canonicalSha256(b),hostIdentitySha256:canonicalSha256(i)});
 async function post(action,signal){
  if(!['close','processes','observe'].includes(action))fault('NATIVE_LIFECYCLE_REFUSED');
  if(disposed)fault('NATIVE_LIFECYCLE_DISPOSED');
  const certUntil=local();if(signal?.aborted)fault('NATIVE_LIFECYCLE_CANCELLED');
  const request=Object.freeze({schema:NATIVE_LIFECYCLE_SCHEMA,action,allocation:a,binding:b,hostIdentity:i});
  const bytes=Buffer.from(JSON.stringify(request));
  if(bytes.length>NATIVE_LIFECYCLE_BODY_BYTES)fault('NATIVE_LIFECYCLE_REFUSED');
   const life=createOperationLifetime({deadlineMs:Math.min(now()+requestMs,certUntil,nativeObserverDeadline(a.leaseDeadlineMs)),now,
   signal:AbortSignal.any([lifetime.signal,...(signal?[signal]:[])]),
   errorFactory:()=>Object.assign(Error('NATIVE_LIFECYCLE_CANCELLED'),{code:'NATIVE_LIFECYCLE_CANCELLED'})});
  try{
   const answer=await life.run(current=>new Promise((resolve,reject)=>{
    const req=httpsModule.request({host:address,port:port,path:NATIVE_LIFECYCLE_PATH,method:'POST',
     servername:serverName,cert,key,ca,agent:false,rejectUnauthorized:true,minVersion:'TLSv1.3',maxVersion:'TLSv1.3',
     signal:current,checkServerIdentity(_name,peer){try{checkedCertificate(peer?.raw,{name:serverName,nowMs:now(),
      fingerprintSha256:serverFingerprint,notAfterMs:nativeObserverDeadline(a.leaseDeadlineMs)});}catch{return Error('NATIVE_LIFECYCLE_TLS_REFUSED');}},
     headers:{'content-type':'application/json','content-length':String(bytes.length),'connection':'close'}},res=>{
      if(res.statusCode!==200){res.resume?.();reject(Error('refused'));return;}
      readBody(res,responseLimit,current).then(resolve,reject);
     });
    req.on('error',reject);req.end(bytes);
   }));
   // The credential must still be current and this client undisposed BEFORE a success can be released.
   local();if(disposed||signal?.aborted)fault('NATIVE_LIFECYCLE_CANCELLED');
   return answer;
  }finally{life.close();}
 }
 function digestMatch(value){return value.allocationSha256===hashes.allocationSha256&&
  value.bindingSha256===hashes.bindingSha256&&value.hostIdentitySha256===hashes.hostIdentitySha256;}
 return Object.freeze({
  hash:Object.freeze(hashes),
  async close({signal}={}){
   const raw=await post('close',signal);
   const answer=nativeLifecycleCloseAnswer(raw,{allocation:a,binding:b,hostIdentity:i,nowMs:now(),
    maxFreshMs:NATIVE_LIFECYCLE_MAX_MS});
   if(answer===null)return Object.freeze({status:'unknown'});
   if(answer.status!=='closed')return Object.freeze({status:'unknown'});
   return Object.freeze({status:'closed',closed:true,observedAtMs:answer.quiescedAtMs});
  },
  /** Local owner disposal, distinct from remote close: abort in-flight work, refuse future exchanges and zero
   * ONLY the copies this client made. Borrowed TLS buffers and the transport are never mutated. Idempotent. */
  async dispose(){
   if(!disposed){disposed=true;lifetime.abort();clearOwned();}
   return Object.freeze({disposed:true});
  },
  async processes({signal}={}){
   const raw=await post('processes',signal);
   let r;try{r=own(data(raw),['schema','allocationSha256','bindingSha256','hostIdentitySha256','observedAtMs',
    'scope','exited','remainingPids']);}catch{fault('NATIVE_LIFECYCLE_UNKNOWN');}
   if(r.schema!=='meri-d005-process-absence/1'||!HEX.test(r.allocationSha256)||!digestMatch(r)||
    !Number.isSafeInteger(r.observedAtMs)||r.observedAtMs>now()||r.observedAtMs<now()-NATIVE_LIFECYCLE_MAX_MS||
    r.scope!=='native-processing-descendants'||r.exited!==true||!Array.isArray(r.remainingPids)||r.remainingPids.length!==0)
    fault('NATIVE_LIFECYCLE_UNKNOWN');
   return Object.freeze({schema:r.schema,allocationSha256:r.allocationSha256,bindingSha256:r.bindingSha256,
    hostIdentitySha256:r.hostIdentitySha256,observedAtMs:r.observedAtMs,scope:r.scope,exited:true,
    remainingPids:Object.freeze([])});
  },
  async observe({signal}={}){
   const raw=await post('observe',signal);
   const absence=nativeAbsenceRecord(raw);
   if(absence===null||!digestMatch(absence)||absence.observedAtMs>now()||
    absence.observedAtMs<now()-NATIVE_LIFECYCLE_MAX_MS)fault('NATIVE_LIFECYCLE_UNKNOWN');
   return Object.freeze({...absence});
  },
 });
}
