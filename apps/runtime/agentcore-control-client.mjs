/** Fixed control HTTPS origin and public CA. Standard TLS; no process-global trust changes. */
import {Agent,request as httpsRequest} from 'node:https';
import {Readable} from 'node:stream';
import {createHash,X509Certificate} from 'node:crypto';
import {agentcoreFault} from './agentcore-contract.mjs';

export function agentcoreEnvironment(environment=process.env){
 const origin=environment.MERI_CONTROL_ORIGIN,encoded=environment.MERI_CONTROL_CA_BASE64,sha=environment.MERI_CONTROL_CA_SHA256;let url,ca;
 try{url=new URL(origin);ca=Buffer.from(encoded,'base64');}catch{throw agentcoreFault('AGENTCORE_CONFIGURATION');}
 if(url.protocol!=='https:'||url.origin!==origin||url.username||url.password||url.pathname!=='/'||url.search||url.hash||typeof encoded!=='string'||ca.toString('base64')!==encoded||ca.length<1||ca.length>16384||createHash('sha256').update(ca).digest('hex')!==sha||! /^-----BEGIN CERTIFICATE-----\r?\n(?:[A-Za-z0-9+/=]+\r?\n)+-----END CERTIFICATE-----\r?\n?$/u.test(ca.toString('utf8'))||!new X509Certificate(ca).ca||environment.AWS_REGION!=='us-east-1')throw agentcoreFault('AGENTCORE_CONFIGURATION');
 return Object.freeze({origin,ca,region:environment.AWS_REGION});
}
export function createAgentCoreControlTransport({origin,ca}){
 const agent=new Agent({ca,keepAlive:true,maxSockets:8,rejectUnauthorized:true});let closed=false;
 function fetchImpl(input,options={}){
  const url=new URL(input);if(closed||url.origin!==origin||url.username||url.password||url.hash||options.method!=='POST'||options.redirect!=='error'||typeof options.body!=='string')return Promise.reject(agentcoreFault('CONTROL_REQUEST_REFUSED'));
  return new Promise((resolve,reject)=>{
   const req=httpsRequest(url,{method:'POST',headers:options.headers,agent,signal:options.signal},res=>{
    const headers=new Headers();for(const [key,value]of Object.entries(res.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(', '):value);
    // The existing run/session adapters bound and decode the stream. Redirects remain responses and are refused there.
    resolve(new Response(Readable.toWeb(res),{status:res.statusCode,headers}));
   });req.once('error',reject);req.end(options.body);
  });
 }
 return Object.freeze({fetch:fetchImpl,close(){closed=true;agent.destroy();}});
}
