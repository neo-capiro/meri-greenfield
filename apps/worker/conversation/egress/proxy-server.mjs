// @ts-check
/** Socket-level egress proxy: the enforcing form of a run's destination control. One instance serves one run on the
 * worker or browser host's loopback interface, and every connection the sandboxed browser or Bash command opens must
 * reach the network through it (the sandbox or host network policy supplies that routing; this module does not).
 *
 * It speaks the two forms the clients use:
 *  - HTTP forward proxy: CONNECT tunnels (https, wss) and absolute-form plain-http requests, including WebSocket
 *    upgrades. Every request on a keep-alive client connection is admitted separately.
 *  - SOCKS5 CONNECT (no authentication), for clients that the SDK sandbox routes through SOCKS.
 *
 * For each connection it asks the injected `control` for a decision and, when admitted, dials ONLY the single checked
 * address the control returns (`connect.address`, an IP literal), never the name: a later DNS answer (rebinding) can
 * never move an admitted connection. It never follows redirects: a 3xx response is relayed to the client, whose next
 * request comes back through the proxy and is admitted on its own. A plain-http request whose Host header names a
 * different authority than its target is refused. Upstream sockets are never pooled or reused across requests.
 *
 * `revoke()` ends the run's egress: the control refuses every later admission and every open tunnel or relayed request
 * is destroyed. The proxy cannot see inside TLS, so connection coalescing and domain fronting inside an admitted tunnel
 * remain host-qualification items (browser ACTIVATION-CHECKLIST.md). */
import {createServer as createHttpServer,request as httpRequest} from 'node:http';
import {createServer as createNetServer,connect as netConnect,isIP} from 'node:net';
export const PROXY_REFUSAL_HEADER='x-meri-egress-refusal';
const LOOPBACK=Object.freeze(['127.0.0.1','::1']);
const HOP_BY_HOP=Object.freeze(['connection','keep-alive','proxy-connection','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade']);
const DEFAULT_LIMITS=Object.freeze({admitMs:10000,idleMs:120000,connectMs:10000,maxHeaderSize:16384,maxConnections:256});
/** @param {string} code @returns {never} */
const fail=code=>{throw Object.assign(new Error(code),{code});};
/** @typedef {{ok:true,connect:{address:string,port:number}}|{ok:false,code:string}} Admission */
/** @typedef {{admitProxyRequest:(request:{method:string,target:string,headers:Record<string,unknown>},options:{signal:AbortSignal})=>Promise<Admission>,admitSocks?:(destination:{host:string,port:number},options:{signal:AbortSignal})=>Promise<Admission>,revoke?:()=>unknown}} EgressControl */
/** @typedef {{kind:'connect'|'http'|'upgrade'|'socks',ok:boolean,code:string|null,host:string,port:number}} ProxyDecision */
/** Default dialer: TCP to an IP literal only, so no name resolution can happen here.
 * @param {{address:string,port:number}} target */
export function dialAddress({address,port}){
 if(isIP(address)===0||!Number.isSafeInteger(port)||port<1||port>65535)fail('EGRESS_DIAL_REFUSED');
 return netConnect({host:address,port,lookup:()=>fail('EGRESS_DIAL_REFUSED')});
}
/** Host and port of an authority-form or absolute-form target, for decision records only. @param {string} target */
function describe(target){
 try{const u=new URL(/^[a-z][a-z0-9+.-]*:\/\//iu.test(target)?target:`tcp://${target}`);return {host:u.hostname.replace(/^\[|\]$/gu,''),port:Number(u.port)||(u.protocol==='https:'?443:80)};}
 catch{return {host:'',port:0};}
}
/** The authority a plain-http absolute-form target names, lower-cased, default port omitted. @param {string} target */
function targetAuthority(target){
 try{const u=new URL(target);return u.host.toLowerCase();}catch{return null;}
}
/** @param {import('node:http').IncomingHttpHeaders} headers @param {string} authority */
function forwardHeaders(headers,authority,{keepUpgrade=false}={}){
 const listed=String(headers.connection??'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);
 /** @type {Record<string,string|string[]>} */const out={};
 for(const [name,value] of Object.entries(headers)){
  const n=name.toLowerCase();if(value===undefined||n==='host'||n.startsWith('proxy-')||listed.includes(n)&&!(keepUpgrade&&n==='upgrade')||HOP_BY_HOP.includes(n)&&!(keepUpgrade&&n==='upgrade'))continue;
  out[n]=value;
 }
 out.host=authority;
 if(keepUpgrade){out.connection='Upgrade';out.upgrade=String(headers.upgrade);}else out.connection='close';
 return out;
}
/** @param {import('node:stream').Duplex} socket @param {number} status @param {string} reason @param {string} code */
function refuseRaw(socket,status,reason,code){
 try{socket.end(`HTTP/1.1 ${status} ${reason}\r\n${PROXY_REFUSAL_HEADER}: ${code}\r\ncontent-length: 0\r\nconnection: close\r\n\r\n`);}catch{}
 socket.destroySoon?.();
}
/** Starts the proxy on loopback. `httpPort`/`socksPort` 0 picks a free port; `socksPort` undefined starts no SOCKS
 * listener (it is also refused when the control has no `admitSocks`). `dial` is injected only by tests and the
 * qualification harness; production uses `dialAddress`.
 * @param {{control:EgressControl,dial?:(target:{address:string,port:number})=>import('node:net').Socket,host?:string,httpPort?:number,socksPort?:number,limits?:Partial<typeof DEFAULT_LIMITS>,onDecision?:(decision:ProxyDecision)=>void}} input */
export async function startEgressProxy({control,dial=dialAddress,host='127.0.0.1',httpPort=0,socksPort,limits={},onDecision=()=>{}}){
 if(typeof control?.admitProxyRequest!=='function'||typeof dial!=='function'||typeof onDecision!=='function'||!LOOPBACK.includes(host))fail('EGRESS_PROXY_CONFIGURATION');
 if(socksPort!==undefined&&typeof control.admitSocks!=='function')fail('EGRESS_PROXY_CONFIGURATION');
 const L={...DEFAULT_LIMITS,...limits};
 for(const v of Object.values(L))if(!Number.isSafeInteger(v)||v<1)fail('EGRESS_PROXY_CONFIGURATION');
 /** @type {Set<import('node:stream').Duplex>} */const live=new Set();let revoked=false;
 const lifetime=new AbortController();
 /** @param {import('node:stream').Duplex} s */
 const track=s=>{live.add(s);s.once('close',()=>live.delete(s));s.on('error',()=>{});if('setTimeout' in s&&typeof s.setTimeout==='function')s.setTimeout(L.idleMs,()=>s.destroy());return s;};
 /** @param {ProxyDecision} d */
 const record=d=>{try{onDecision(Object.freeze({...d}));}catch{}};
 /** Admission bounded by the proxy lifetime and `admitMs`; any throw is a refusal. @param {(signal:AbortSignal)=>Promise<Admission>} ask @returns {Promise<Admission>} */
 async function decide(ask){
  if(revoked)return {ok:false,code:'EGRESS_REVOKED'};
  const signal=AbortSignal.any([lifetime.signal,AbortSignal.timeout(L.admitMs)]);
  try{
   const a=await Promise.race([ask(signal),new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(new Error('EGRESS_ADMISSION_TIMEOUT'),{code:'EGRESS_ADMISSION_TIMEOUT'})),{once:true}))]);
   if(revoked)return {ok:false,code:'EGRESS_REVOKED'};
   if(a?.ok===true&&isIP(a.connect?.address)!==0&&Number.isSafeInteger(a.connect?.port))return {ok:true,connect:{address:a.connect.address,port:a.connect.port}};
   return {ok:false,code:typeof a?.code==='string'&&/^[A-Z0-9_]{1,64}$/u.test(a.code)?a.code:'EGRESS_REFUSED'};
  }catch(error){return {ok:false,code:/** @type {any} */(error)?.code==='EGRESS_ADMISSION_TIMEOUT'?'EGRESS_ADMISSION_TIMEOUT':'EGRESS_REFUSED'};}
 }
 /** Dials the checked address; resolves the connected socket or rejects. @param {{address:string,port:number}} target */
 const open=target=>new Promise((resolve,reject)=>{
  let s;try{s=track(dial(target));}catch(e){reject(e);return;}
  const timer=setTimeout(()=>{s.destroy();reject(fail('EGRESS_CONNECT_TIMEOUT'));},L.connectMs);
  s.once('connect',()=>{clearTimeout(timer);resolve(s);});
  s.once('error',e=>{clearTimeout(timer);reject(e);});
 });
 /** @param {import('node:stream').Duplex} a @param {import('node:stream').Duplex} b */
 const splice=(a,b)=>{a.pipe(b);b.pipe(a);const end=()=>{a.destroy();b.destroy();};a.once('close',end);b.once('close',end);};

 const http=createHttpServer({maxHeaderSize:L.maxHeaderSize,requestTimeout:L.idleMs,headersTimeout:Math.min(L.idleMs,L.connectMs+L.admitMs),keepAliveTimeout:L.idleMs});
 http.maxConnections=L.maxConnections;
 http.on('connection',s=>track(s));
 http.on('connect',async(req,socket,head)=>{
  track(socket);const where=describe(String(req.url));
  const a=await decide(signal=>control.admitProxyRequest({method:'CONNECT',target:String(req.url),headers:{...req.headers}},{signal}));
  record({kind:'connect',ok:a.ok,code:a.ok?null:a.code,...where});
  if(!a.ok)return refuseRaw(socket,403,'Forbidden',a.code);
  try{const upstream=await open(a.connect);if(revoked||socket.destroyed){upstream.destroy();socket.destroy();return;}
   socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head?.length)upstream.write(head);splice(socket,upstream);}
  catch{refuseRaw(socket,502,'Bad Gateway','EGRESS_CONNECT_FAILED');}
 });
 http.on('upgrade',async(req,socket,head)=>{
  track(socket);const target=String(req.url),where=describe(target),authority=targetAuthority(target);
  if(!authority||String(req.headers.host??'').toLowerCase()!==authority){record({kind:'upgrade',ok:false,code:'EGRESS_HOST_MISMATCH',...where});return refuseRaw(socket,403,'Forbidden','EGRESS_HOST_MISMATCH');}
  const a=await decide(signal=>control.admitProxyRequest({method:String(req.method),target,headers:{...req.headers}},{signal}));
  record({kind:'upgrade',ok:a.ok,code:a.ok?null:a.code,...where});
  if(!a.ok)return refuseRaw(socket,403,'Forbidden',a.code);
  try{const upstream=await open(a.connect),u=new URL(target),headers=forwardHeaders(req.headers,authority,{keepUpgrade:true});
   if(revoked||socket.destroyed){upstream.destroy();socket.destroy();return;}
   upstream.write(`${req.method} ${u.pathname}${u.search} HTTP/1.1\r\n${Object.entries(headers).flatMap(([k,v])=>(Array.isArray(v)?v:[v]).map(x=>`${k}: ${x}`)).join('\r\n')}\r\n\r\n`);
   if(head?.length)upstream.write(head);splice(socket,upstream);}
  catch{refuseRaw(socket,502,'Bad Gateway','EGRESS_CONNECT_FAILED');}
 });
 http.on('request',async(req,res)=>{
  const target=String(req.url),where=describe(target),authority=targetAuthority(target);
  /** @param {number} status @param {string} code */
  const refuse=(status,code)=>{record({kind:'http',ok:false,code,...where});if(!res.headersSent){res.writeHead(status,{[PROXY_REFUSAL_HEADER]:code,'content-length':'0',connection:'close'});}res.end();req.socket.destroySoon?.();};
  if(!/^http:\/\//iu.test(target)||!authority)return refuse(400,'EGRESS_REQUEST');
  if(String(req.headers.host??'').toLowerCase()!==authority)return refuse(403,'EGRESS_HOST_MISMATCH');
  const a=await decide(signal=>control.admitProxyRequest({method:String(req.method),target,headers:{...req.headers}},{signal}));
  if(!a.ok)return refuse(403,a.code);
  record({kind:'http',ok:true,code:null,...where});
  const u=new URL(target);
  /** @type {import('node:net').Socket} */let connection;
  try{connection=track(dial(a.connect));}catch{return refuse(502,'EGRESS_CONNECT_FAILED');}
  // No agent: Node uses createConnection only without one, so this request owns its socket and nothing is pooled.
  const upstream=httpRequest({method:req.method,path:`${u.pathname}${u.search}`,headers:forwardHeaders(req.headers,authority),createConnection:()=>connection,timeout:L.connectMs});
  upstream.on('response',r=>{
   /** @type {Record<string,string|string[]>} */const h={};
   for(const [k,v] of Object.entries(r.headers))if(v!==undefined&&!HOP_BY_HOP.includes(k)&&!k.startsWith('proxy-'))h[k]=v;
   h.connection='close';res.writeHead(r.statusCode??502,h);r.pipe(res);
  });
  upstream.on('timeout',()=>upstream.destroy());
  upstream.on('error',e=>{if(process.env.MERI_EGRESS_DEBUG)console.error(e);if(!res.headersSent)refuse(502,'EGRESS_CONNECT_FAILED');else res.destroy();});
  req.pipe(upstream);
 });
 http.on('clientError',(_,socket)=>refuseRaw(socket,400,'Bad Request','EGRESS_REQUEST'));

 /** @type {import('node:net').Server|undefined} */let socks;
 if(socksPort!==undefined){
  socks=createNetServer(socket=>{track(socket);handleSocks(socket).catch(()=>socket.destroy());});
  socks.maxConnections=L.maxConnections;
 }
 /** SOCKS5 (RFC 1928) CONNECT with no authentication; every other method or command is refused.
  * @param {import('node:net').Socket} socket */
 async function handleSocks(socket){
  const reader=bufferedReader(socket,L.connectMs);
  const greeting=await reader.take(2);if(greeting[0]!==5||greeting[1]<1){socket.destroy();return;}
  const methods=await reader.take(greeting[1]);if(!methods.includes(0)){socket.end(Buffer.from([5,0xff]));return;}
  socket.write(Buffer.from([5,0]));
  const head=await reader.take(4);
  const reply=(/** @type {number} */rep)=>Buffer.from([5,rep,0,1,0,0,0,0,0,0]);
  if(head[0]!==5||head[2]!==0){socket.destroy();return;}
  let host;
  if(head[3]===1)host=[...await reader.take(4)].join('.');
  else if(head[3]===3){const n=(await reader.take(1))[0];if(!n){socket.end(reply(1));return;}host=(await reader.take(n)).toString('latin1');}
  else if(head[3]===4){const b=await reader.take(16);host=Array.from({length:8},(_,i)=>b.readUInt16BE(i*2).toString(16)).join(':');}
  else{socket.end(reply(8));return;}
  const port=(await reader.take(2)).readUInt16BE(0);
  if(head[1]!==1){record({kind:'socks',ok:false,code:'EGRESS_SOCKS_COMMAND',host,port});socket.end(reply(7));return;}
  const admitSocks=/** @type {NonNullable<EgressControl['admitSocks']>} */(control.admitSocks);
  const a=await decide(signal=>admitSocks({host,port},{signal}));
  record({kind:'socks',ok:a.ok,code:a.ok?null:a.code,host,port});
  if(!a.ok){socket.end(reply(2));return;}
  let upstream;try{upstream=await open(a.connect);}catch{socket.end(reply(5));return;}
  if(revoked||socket.destroyed){upstream.destroy();socket.destroy();return;}
  socket.write(reply(0));const rest=reader.release();if(rest.length)upstream.write(rest);splice(socket,upstream);
 }
 /** @param {import('node:net').Server|import('node:http').Server} server @param {number} port @returns {Promise<number>} */
 const listen=(server,port)=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen({host,port,exclusive:true},()=>{server.off('error',reject);resolve(/** @type {import('node:net').AddressInfo} */(server.address()).port);});});
 const ports={http:await listen(http,httpPort),...(socks?{socks:await listen(socks,/** @type {number} */(socksPort))}:{})};
 const destroyAll=()=>{for(const s of live)s.destroy();live.clear();};
 /** Ends the run's egress now: later admissions refuse and every open tunnel or request is destroyed. Idempotent. */
 const revoke=()=>{revoked=true;lifetime.abort();try{control.revoke?.();}catch{}destroyAll();return Object.freeze({revoked:true});};
 /** Revokes, then stops listening and waits for both servers to close. */
 const close=async()=>{revoke();await Promise.all([http,...(socks?[socks]:[])].map(s=>new Promise(resolve=>{s.close(()=>resolve(undefined));})));};
 return Object.freeze({host,ports:Object.freeze(ports),revoke,close});
}
/** Exact-length reads from a socket, bounded by `timeoutMs` per read; `release()` returns unread bytes.
 * @param {import('node:net').Socket} socket @param {number} timeoutMs */
function bufferedReader(socket,timeoutMs){
 let buffer=Buffer.alloc(0);/** @type {(()=>void)|undefined} */let wake;
 const onData=(/** @type {Buffer} */chunk)=>{buffer=Buffer.concat([buffer,chunk]);if(buffer.length>4096)socket.destroy();wake?.();};
 const onEnd=()=>wake?.();
 socket.on('data',onData);socket.once('end',onEnd);socket.once('close',onEnd);
 return {
  /** @param {number} n @returns {Promise<Buffer>} */
  async take(n){
   const deadline=Date.now()+timeoutMs;
   while(buffer.length<n){
    if(socket.destroyed||socket.readableEnded||Date.now()>=deadline)fail('EGRESS_SOCKS_TRUNCATED');
    await new Promise(resolve=>{const t=setTimeout(resolve,Math.max(1,deadline-Date.now()));wake=()=>{clearTimeout(t);resolve(undefined);};});
    wake=undefined;
   }
   const out=buffer.subarray(0,n);buffer=buffer.subarray(n);return out;
  },
  release(){socket.off('data',onData);socket.off('end',onEnd);socket.off('close',onEnd);const rest=buffer;buffer=Buffer.alloc(0);return rest;},
 };
}
