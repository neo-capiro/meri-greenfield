/** Protected operator transport. Existing HTTP/HMAC protocol; never selected by an event or browser admission. */
import {request as httpsRequest} from 'node:https';
import {checkServerIdentity} from 'node:tls';
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {privateAddress} from '../../packages/contracts/native-tls-kernel.mjs';
import {checkedCertificate,fingerprint} from '../worker/conversation/host/control/tls.mjs';
import {NATIVE_OBSERVER_ROUTE} from '../../packages/contracts/native-observer.mjs';
import {NATIVE_OBSERVER_ORIGIN,OBSERVER_BODY_BYTES} from './native-observer-http.mjs';
const fail=()=>{throw Error('NATIVE_OBSERVER_TRANSPORT_REFUSED');};
export function operatorObserverEndpoint(raw){
 try{
  const e=own(raw,['address','port','serverName','serverFingerprintSha256']);
  privateAddress(e.address);fingerprint(e.serverFingerprintSha256);
  if(e.port!==443||e.serverName!==new URL(NATIVE_OBSERVER_ORIGIN).hostname)fail();
  return Object.freeze({...e});
 }catch{fail();}
}
/** `request` is a source-level test port, not a serialized deployment or event option. */
export function createOperatorObserverPost(raw,{request=httpsRequest}={}){
 const endpoint=operatorObserverEndpoint(raw);
 return ({body,headers,ca,signal})=>new Promise((resolve,reject)=>{
  // HTTPS completes chain/hostname/pin validation before flushing any HTTP bytes. A fresh
  // agent per request prevents session resumption or socket reuse from skipping this check.
  const req=request({hostname:endpoint.address,port:443,servername:endpoint.serverName,
   method:'POST',path:NATIVE_OBSERVER_ROUTE,ca,rejectUnauthorized:true,minVersion:'TLSv1.3',agent:false,signal,
   checkServerIdentity:(_name,certificate)=>{
    const mismatch=checkServerIdentity(endpoint.serverName,certificate);if(mismatch)return mismatch;
    try{checkedCertificate(certificate.raw,{name:endpoint.serverName,nowMs:Date.now(),pinnedControl:'server',
     fingerprintSha256:endpoint.serverFingerprintSha256});}catch{return Error('NATIVE_OBSERVER_TLS_REFUSED');}
   },headers:{...headers,host:endpoint.serverName,'content-length':String(body.length)}},res=>{
    const chunks=[];let count=0;
    res.on('data',chunk=>{count+=chunk.length;if(count>OBSERVER_BODY_BYTES){res.destroy(Error('NATIVE_OBSERVER_BRIDGE_UNKNOWN'));return;}chunks.push(chunk);});
    res.on('error',reject);res.on('end',()=>{
     if(res.statusCode!==200||res.headers['content-type']!=='application/json'){reject(Error('NATIVE_OBSERVER_BRIDGE_UNKNOWN'));return;}
     try{resolve(JSON.parse(Buffer.concat(chunks,count).toString('utf8')));}catch{reject(Error('NATIVE_OBSERVER_BRIDGE_UNKNOWN'));}
    });
   });
  // No lookup, redirect, fallback address, retry or mutable endpoint discovery.
  req.on('error',reject);req.end(body);
 });
}
