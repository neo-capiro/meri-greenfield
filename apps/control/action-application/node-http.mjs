/** Explicit local HTTP transport. Importing allocates no listener or credentials. */
import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {types} from 'node:util';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
const refused=()=>{throw new Error('LOCAL_HTTP_CONFIGURATION');};
export function createActionHttpHandler(configuration){
 const {app,signal}=own(configuration,['app','signal']),{handle}=own(app,['handle']);
 if(typeof handle!=='function'||types.isProxy(signal)||!(signal instanceof AbortSignal))refused();
 return async function handleHttp(request,response){
  const controller=new AbortController(),abort=()=>controller.abort();
  const disconnect=()=>{if(!response.writableFinished)abort();};
  signal.addEventListener('abort',abort,{once:true});request.once('aborted',abort);response.once('close',disconnect);
  let invoked=false;
  try{
   if(signal.aborted)abort();if(controller.signal.aborted)throw Error('CANCELLED');
   if(typeof request.url!=='string'||!request.url.startsWith('/')||request.url.startsWith('//'))throw Error('INVALID_REQUEST');
   const headers=new Headers();for(let i=0;i<request.rawHeaders.length;i+=2)headers.append(request.rawHeaders[i],request.rawHeaders[i+1]);
   const method=request.method,body=['GET','HEAD'].includes(method)?undefined:Readable.toWeb(request);
   const incoming=new Request(`http://127.0.0.1${request.url}`,{method,headers,body,duplex:'half',signal:controller.signal});
   invoked=true;const result=await handle.call(app,incoming);
   if(controller.signal.aborted||response.destroyed)return;
   if(!(result instanceof Response))throw Error('INVALID_RESPONSE');
   response.statusCode=result.status;for(const [name,value]of result.headers)response.setHeader(name,value);
   if(result.body)await pipeline(Readable.fromWeb(result.body),response,{signal:controller.signal});else response.end();
  }catch{
   if(!response.destroyed&&!controller.signal.aborted&&!response.headersSent){
    response.writeHead(502,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
    response.end(JSON.stringify({error:{code:'HTTP_TRANSPORT_REFUSED',outcome:invoked?'UNKNOWN':'NOT_DISPATCHED'}}));
   }else if(!response.destroyed)response.destroy();
  }finally{signal.removeEventListener('abort',abort);request.removeListener('aborted',abort);response.removeListener('close',disconnect);}
 };
}
export async function listenActionApplication(configuration){
 const {app,host,port,lifetimeMs}=own(configuration,['app','host','port','lifetimeMs']);
 if(host!=='127.0.0.1'||port!==0||!Number.isSafeInteger(lifetimeMs)||lifetimeMs<1||lifetimeMs>30000)refused();
 const controller=new AbortController(),handler=createActionHttpHandler({app,signal:controller.signal}),sockets=new Set();
 const server=createServer({maxHeaderSize:16384,headersTimeout:Math.min(5000,lifetimeMs),requestTimeout:lifetimeMs,keepAliveTimeout:Math.min(1000,lifetimeMs)},handler);
 server.maxHeadersCount=100;server.setTimeout(Math.min(5000,lifetimeMs),socket=>socket.destroy());
 let stopping=false,finished=false,timer,resolveClosed;
 const closed=new Promise(resolve=>{resolveClosed=resolve;});
 const finish=()=>{if(stopping&&!server.listening&&sockets.size===0&&!finished){finished=true;resolveClosed();}};
 const close=()=>{if(!stopping){stopping=true;clearTimeout(timer);controller.abort();server.close(()=>finish());for(const socket of sockets)socket.destroy();}finish();return closed;};
 server.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>{sockets.delete(socket);finish();});if(stopping)socket.destroy();});
 server.on('clientError',(_error,socket)=>socket.destroy());server.on('upgrade',(_req,socket)=>socket.destroy());server.on('connect',(_req,socket)=>socket.destroy());
 try{
  await new Promise((resolve,reject)=>{const error=e=>{server.removeListener('listening',ready);reject(e);};const ready=()=>{server.removeListener('error',error);resolve();};server.once('error',error);server.once('listening',ready);server.listen({host,port,exclusive:true});});
  if(stopping)throw Error('LOCAL_HTTP_CLOSED');
  const address=server.address();server.on('error',()=>{void close();});timer=setTimeout(()=>{void close();},lifetimeMs);
  return Object.freeze({origin:`http://127.0.0.1:${address.port}`,close,closed,status:()=>Object.freeze({closed:finished,listening:server.listening,activeSockets:sockets.size})});
 }catch{await close();throw Error('LOCAL_HTTP_START_REFUSED');}
}
