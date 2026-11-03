/** Same logical HTTPS callback origin and Response interface; protected literal connection destination. */
import {request as httpsRequest} from 'node:https';
import {checkServerIdentity} from 'node:tls';
import {Readable} from 'node:stream';
import {operatorCallbackConfiguration} from './operator-callback-configuration.mjs';
import {checkedCertificate} from '../worker/conversation/host/control/tls.mjs';
const fault=()=>Error('OPERATOR_CALLBACK_TRANSPORT_REFUSED');
/** Request is a source-level TLS test boundary only; operator startup never accepts it. */
export function createOperatorCallbackTransport(raw,{request=httpsRequest}={}){
 const c=operatorCallbackConfiguration(raw),e=c.endpoint,requests=new Set();let closed=false;
 function fetchImpl(input,options={}){
  let url,headers;
  try{
   url=new URL(input);headers=new Headers(options.headers);
   if(closed||Date.now()>=c.retainUntilMs||url.origin!==c.origin||url.username||url.password||url.hash||
    options.method!=='POST'||options.redirect!=='error'||typeof options.body!=='string'||
    headers.has('host')&&headers.get('host')!==e.serverName)throw fault();
   const size=String(Buffer.byteLength(options.body));
   if(headers.has('content-length')&&headers.get('content-length')!==size)throw fault();
   headers.set('host',e.serverName);headers.set('content-length',size);
  }catch{return Promise.reject(fault());}
  return new Promise((resolve,reject)=>{
   const req=request({hostname:e.address,port:443,servername:e.serverName,method:'POST',path:url.pathname+url.search,
    headers:Object.fromEntries(headers),ca:c.caCertificate,rejectUnauthorized:true,minVersion:'TLSv1.3',agent:false,signal:options.signal,
    checkServerIdentity:(_name,certificate)=>{
     const mismatch=checkServerIdentity(e.serverName,certificate);if(mismatch)return mismatch;
     try{
      if(closed||Date.now()>=c.retainUntilMs)throw fault();
      const leaf=checkedCertificate(certificate.raw,{name:e.serverName,nowMs:Date.now(),pinnedControl:'server',fingerprintSha256:e.serverFingerprintSha256});
      if(leaf.notAfterMs<=c.retainUntilMs)throw fault();
     }catch{return fault();}
    }},res=>{
     try{const responseHeaders=new Headers();for(const [key,value]of Object.entries(res.headers))if(value!==undefined)responseHeaders.set(key,Array.isArray(value)?value.join(', '):value);
     // Existing native/session/read/intent owners enforce status, decoding and byte limits.
     // A redirect is returned once, never followed; cancellation keeps owning the stream.
     const empty=[204,205,304].includes(res.statusCode);if(empty)res.resume();
     resolve(new Response(empty?null:Readable.toWeb(res),{status:res.statusCode,headers:responseHeaders}));
     }catch{res.destroy();reject(fault());}
    });
   requests.add(req);req.once('close',()=>requests.delete(req));req.once('error',reject);req.end(options.body);
  });
 }
 return Object.freeze({fetch:fetchImpl,close(){closed=true;for(const req of requests)req.destroy(fault());}});
}
