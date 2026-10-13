/** Production-capable HTTP adapter; canonical Fetch owners handle application input. */
import {serve} from '@hono/node-server';
import {fault} from './config.mjs';
export async function listenRuntime({configuration,application,readiness,signal}){
 signal?.throwIfAborted();
 let stopping=false;const active=new Set(),sockets=new Set();const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
 const server=serve({hostname:configuration.http.hostname,port:configuration.http.port,overrideGlobalObjects:false,fetch:async request=>{
  const path=new URL(request.url).pathname;if(path==='/health/live'||path==='/health/ready'){
   if(request.method!=='GET'||new URL(request.url).search)return json({error:{code:'METHOD_NOT_ALLOWED'}},405);
   if(path==='/health/live')return json({status:stopping?'stopping':'live'},stopping?503:200);
   if(stopping)return json({status:'not-ready'},503);try{await readiness({signal:request.signal});return json({status:'ready',profile:'isolated-preview',releaseAcceptance:'held'});}catch{return json({status:'not-ready'},503);}
  }
  if(stopping)return json({error:{code:'RUNTIME_STOPPING'}},503);
  const origin=request.headers.get('origin');if(origin!==null&&origin!==configuration.http.frontendOrigin)return json({error:{code:'ORIGIN_REFUSED'}},403);
  const controller=new AbortController();active.add(controller);const joined=AbortSignal.any([request.signal,controller.signal]);let streamed=false;
  const cleanup=()=>{active.delete(controller);joined.removeEventListener('abort',cleanup);};joined.addEventListener('abort',cleanup,{once:true});
  try{const nativeRequest=new Request(request.url,{method:request.method,headers:request.headers,signal:joined,...(request.body?{body:request.body,duplex:'half'}:{})});const response=await application.handle(nativeRequest);if(!response.body)return response;streamed=true;return new Response(response.body.pipeThrough(new TransformStream({transform(chunk,controller){controller.enqueue(chunk);},flush:cleanup}),{signal:joined}),{status:response.status,statusText:response.statusText,headers:response.headers});}finally{if(!streamed)cleanup();}
 }});
 server.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));});
 server.requestTimeout=configuration.limits.requestMs+1000;server.headersTimeout=configuration.limits.requestMs;server.keepAliveTimeout=1000;server.maxHeadersCount=100;
 await new Promise((resolve,reject)=>{if(server.listening)return resolve();server.once('listening',resolve);server.once('error',reject);});
 let closing;const close=()=>closing??=new Promise(resolve=>{stopping=true;for(const c of active)c.abort(fault('RUNTIME_STOPPING'));server.close(resolve);server.closeIdleConnections();const timer=setTimeout(()=>{for(const socket of sockets)socket.destroy();resolve();},configuration.limits.shutdownMs);timer.unref();server.once('close',()=>clearTimeout(timer));});
 const abort=()=>{void close();};signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){await close();signal.removeEventListener('abort',abort);throw fault('RUNTIME_STOPPED');}return Object.freeze({address:server.address(),async close(){signal?.removeEventListener('abort',abort);await close();}});
}
