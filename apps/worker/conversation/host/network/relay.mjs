/** One fixed TCP byte relay. It cannot resolve names, choose a destination from client bytes or use an HTTP CONNECT
 * target. The enforcing browser/Bash proxy remains a separate loopback listener in the trusted host namespace. */
import {createServer,createConnection,isIP} from 'node:net';
import {openSync,fstatSync,closeSync} from 'node:fs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const validPort=(p,min=1024)=>Number.isSafeInteger(p)&&p>=min&&p<=65535;

/** @param {{listenAddress:string,listenPort:number,targetAddress:string,targetPort:number,signal?:AbortSignal,maxConnections?:number,connectTimeoutMs?:number}} input */
export async function startPinnedRelay({listenAddress,listenPort,targetAddress,targetPort,signal,maxConnections=64,connectTimeoutMs=5000}){
 if(isIP(listenAddress)!==4||isIP(targetAddress)!==4||!validPort(listenPort,0)||!validPort(targetPort,1)||!Number.isSafeInteger(maxConnections)||maxConnections<1||maxConnections>256||!Number.isSafeInteger(connectTimeoutMs)||connectTimeoutMs<1||connectTimeoutMs>10000||signal!==undefined&&!(signal instanceof AbortSignal)||signal?.aborted)fail('HOST_NETWORK_RELAY_CONFIGURATION');
 const sockets=new Set();let revoked=false,closing;
 const server=createServer({allowHalfOpen:false},client=>{
  if(revoked){client.destroy();return;}
  client.pause();sockets.add(client);
  const upstream=createConnection({host:targetAddress,port:targetPort});sockets.add(upstream);
  const remove=s=>{sockets.delete(s);};client.once('close',()=>remove(client));upstream.once('close',()=>remove(upstream));
  const kill=()=>{client.destroy();upstream.destroy();};
  client.on('error',kill);upstream.on('error',kill);
  upstream.setTimeout(connectTimeoutMs,kill);
  upstream.once('connect',()=>{
   upstream.setTimeout(0);if(revoked||client.destroyed){kill();return;}
   client.pipe(upstream);upstream.pipe(client);client.resume();
  });
 });
 server.maxConnections=maxConnections;
 const revoke=()=>{revoked=true;for(const socket of sockets)socket.destroy();return Object.freeze({revoked:true});};
 const close=()=>{if(closing)return closing;revoke();signal?.removeEventListener('abort',onAbort);
  closing=new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve(Object.freeze({closed:true}))));return closing;};
 const onAbort=()=>{close().catch(()=>{});};
 try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen({host:listenAddress,port:listenPort,exclusive:true},()=>{server.off('error',reject);resolve();});});}
 catch(error){revoke();try{server.close();}catch{}throw error;}
 if(signal){signal.addEventListener('abort',onAbort,{once:true});if(signal.aborted)await close();}
 const address=server.address();if(!address||typeof address==='string'||address.address!==listenAddress||!validPort(address.port)){await close();fail('HOST_NETWORK_RELAY_BINDING_UNKNOWN');}
 return Object.freeze({address:listenAddress,port:address.port,revoke,close,
  verify(){if(revoked||!server.listening||server.address()?.address!==listenAddress||server.address()?.port!==address.port)fail('HOST_NETWORK_RELAY_BINDING_UNKNOWN');return Object.freeze({verified:true,address:listenAddress,port:address.port});}});
}

/** The launcher executes this under the target netns, unprivileged UID/GID and a scrubbed environment, before MCP,
 * Chromium or SDK exec. The pinned namespace ID is the value returned by the privileged setup owner. */
export async function startToolLoopbackRelays({namespaceDev,namespaceIno,hostAddress,routes,signal}){
 if(typeof namespaceDev!=='string'||!/^\d+$/u.test(namespaceDev)||typeof namespaceIno!=='string'||!/^\d+$/u.test(namespaceIno)||isIP(hostAddress)!==4||!Array.isArray(routes)||!routes.length||routes.length>4)fail('HOST_NETWORK_RELAY_CONFIGURATION');
 let fd;try{fd=openSync('/proc/self/ns/net','r');const stat=fstatSync(fd);if(String(stat.dev)!==namespaceDev||String(stat.ino)!==namespaceIno)fail('HOST_NETWORK_NAMESPACE_UNKNOWN');}
 finally{if(fd!==undefined)closeSync(fd);}
 const handles=[];
 try{for(const route of routes){if(!validPort(route.localPort)||!validPort(route.hostRelayPort)||route.hostAddress!==hostAddress)fail('HOST_NETWORK_RELAY_CONFIGURATION');
   handles.push(await startPinnedRelay({listenAddress:'127.0.0.1',listenPort:route.localPort,targetAddress:hostAddress,targetPort:route.hostRelayPort,signal}));}
  return Object.freeze({endpoints:Object.freeze(handles.map(h=>`http://127.0.0.1:${h.port}`)),
   verify(){for(const h of handles)h.verify();return Object.freeze({verified:true});},
   async close(){await Promise.all(handles.map(h=>h.close()));return Object.freeze({closed:true});}});
 }catch(error){await Promise.allSettled(handles.map(h=>h.close()));throw error;}
}
