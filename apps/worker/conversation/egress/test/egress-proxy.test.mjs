/** Socket-level egress proxy cases on loopback only. Synthetic names resolve through a scripted resolver to
 * documentation-style public addresses, and the injected dialer maps each checked address to a local fixture server,
 * recording every dial. Nothing leaves this host: no real DNS, no external connection. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createServer as httpServer,request as httpRequest} from 'node:http';
import {createServer as netServer,connect} from 'node:net';
import {once} from 'node:events';
import {startEgressProxy,PROXY_REFUSAL_HEADER,dialAddress} from '../proxy-server.mjs';
import {createBashEgressControl,startBashEgress,domainAllowed,bashEgressDomainsSha256,BASH_EGRESS_SCHEMA} from '../bash-egress.mjs';
import {createEgressGrant,createEgressControl} from '../../browser/egress-control.mjs';
import {validateBrowserPolicy} from '../../browser/policy.mjs';
import {binding,enabledPolicy,clock} from '../../browser/test/fixtures.mjs';

const TABLE={'records.example':['93.184.215.14'],'api.cdn.example':['93.184.215.21'],'cdn.example':['93.184.215.22'],'unlisted.example':['93.184.215.17'],
 'rebind.example':['93.184.215.20','169.254.169.254'],'private.example':['10.0.0.5'],'v6.example':['2606:2800:21f:cb07:6820:80da:af6b:8b2c'],'mapped.example':['::ffff:127.0.0.1']};
const DOMAINS=['records.example','*.cdn.example','rebind.example','private.example','v6.example','mapped.example'];
async function fixture(t,{table=TABLE,domains=DOMAINS,expiresAtMs=clock()+60000,now=clock,control:custom}={}){
 const web=httpServer((req,res)=>{
  if(req.url==='/redirect'){res.writeHead(302,{location:'http://unlisted.example/landing'});res.end();return;}
  res.writeHead(200,{'content-type':'text/plain','x-seen-host':String(req.headers.host),'x-seen-proxy-auth':String(req.headers['proxy-authorization']??'')});res.end(`hello ${req.method} ${req.url}`);
 });
 const echo=netServer(s=>s.pipe(s));
 await Promise.all([once(web.listen(0,'127.0.0.1'),'listening'),once(echo.listen(0,'127.0.0.1'),'listening')]);
 const dials=[],lookups=[];
 const dial=({address,port})=>{dials.push(`${address}:${port}`);if(!['93.184.215.14','93.184.215.21','93.184.215.20','2606:2800:21f:cb07:6820:80da:af6b:8b2c'].includes(address))throw Object.assign(new Error('unexpected'),{code:'UNEXPECTED_DIAL'});
  return connect({host:'127.0.0.1',port:port===443?echo.address().port:web.address().port});};
 const resolve=async name=>{lookups.push(name);const v=table[name];if(!v)throw new Error('NXDOMAIN');return typeof v==='function'?v():v;};
 const control=custom??createBashEgressControl({domains,resolve,now,expiresAtMs});
 const decisions=[];
 const proxy=await startEgressProxy({control,dial,httpPort:0,...(control.admitSocks?{socksPort:0}:{}),onDecision:d=>decisions.push(d),limits:{admitMs:2000,connectMs:2000,idleMs:5000}});
 t.after(async()=>{await proxy.close();web.close();echo.close();});
 return {proxy,dials,lookups,decisions,control};
}
/** Absolute-form plain-http request through the proxy. */
function get(proxy,url,{host=new URL(url).host,headers={}}={}){
 return new Promise((resolve,reject)=>{
  const r=httpRequest({host:'127.0.0.1',port:proxy.ports.http,path:url,headers:{host,...headers},agent:false},res=>{let body='';res.setEncoding('utf8');res.on('data',c=>{body+=c;});res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));});
  r.on('error',reject);r.end();
 });
}
/** CONNECT through the proxy; resolves {status, refusal, socket}. */
function tunnel(proxy,authority){
 return new Promise((resolve,reject)=>{
  const r=httpRequest({host:'127.0.0.1',port:proxy.ports.http,method:'CONNECT',path:authority,agent:false});
  r.on('connect',(res,socket)=>resolve({status:res.statusCode,refusal:res.headers[PROXY_REFUSAL_HEADER],socket}));
  r.on('response',res=>{res.resume();resolve({status:res.statusCode,refusal:res.headers[PROXY_REFUSAL_HEADER]});});
  r.on('error',reject);r.end();
 });
}
async function roundTrip(socket,text){socket.write(text);const [chunk]=await once(socket,'data');return chunk.toString();}
/** Raw SOCKS5 CONNECT; returns the reply code and the socket. */
async function socks(proxy,{atyp=3,host='records.example',port=443,cmd=1,methods=[0]}={}){
 const s=connect({host:'127.0.0.1',port:proxy.ports.socks});await once(s,'connect');
 const chunks=[];let wake;s.on('data',c=>{chunks.push(c);wake?.();});
 const read=async n=>{while(Buffer.concat(chunks).length<n){if(s.destroyed)return Buffer.concat(chunks);await new Promise(r=>{wake=r;setTimeout(r,200);});}const all=Buffer.concat(chunks);chunks.length=0;if(all.length>n)chunks.push(all.subarray(n));return all.subarray(0,n);};
 s.write(Buffer.from([5,methods.length,...methods]));const hello=await read(2);if(hello[1]!==0)return {method:hello[1],socket:s};
 const addr=atyp===3?[host.length,...Buffer.from(host)]:atyp===1?host.split('.').map(Number):[...Buffer.alloc(16)];
 const p=Buffer.alloc(2);p.writeUInt16BE(port);s.write(Buffer.from([5,cmd,0,atyp,...addr,...p]));
 const reply=await read(10);return {reply:reply[1],socket:s};
}

test('an allowlisted name is admitted, dialled only at its checked address, and the Host and proxy headers are normalized',async t=>{
 const {proxy,dials,decisions}=await fixture(t);
 const r=await get(proxy,'http://records.example/page?q=1',{headers:{'proxy-authorization':'Basic c2VjcmV0'}});
 assert.equal(r.status,200);assert.equal(r.body,'hello GET /page?q=1');assert.equal(r.headers['x-seen-host'],'records.example');assert.equal(r.headers['x-seen-proxy-auth'],'','proxy credentials never reach the destination');
 assert.deepEqual(dials,['93.184.215.14:80']);
 assert.deepEqual(decisions,[{kind:'http',ok:true,code:null,host:'records.example',port:80}],'decision records carry host, port and code only: no path, query or content');
});

test('a redirect is relayed, never followed: the next hop is a new request decided on its own and an unlisted target is refused',async t=>{
 const {proxy,dials}=await fixture(t);
 const r=await get(proxy,'http://records.example/redirect');
 assert.equal(r.status,302);assert.equal(r.headers.location,'http://unlisted.example/landing');assert.deepEqual(dials,['93.184.215.14:80']);
 const hop=await get(proxy,r.headers.location);
 assert.equal(hop.status,403);assert.equal(hop.headers[PROXY_REFUSAL_HEADER],'BASH_EGRESS_DESTINATION');assert.deepEqual(dials,['93.184.215.14:80'],'nothing dialled for the refused hop');
});

test('IP literals, non-public answers, rebinding answers, IPv4-mapped loopback and non-web ports are refused before any dial',async t=>{
 const {proxy,dials,lookups}=await fixture(t);
 const cases=[['http://93.184.215.14/','BASH_EGRESS_IP_LITERAL'],['http://169.254.169.254/latest/meta-data/','BASH_EGRESS_IP_LITERAL'],['http://[::1]/','BASH_EGRESS_IP_LITERAL'],['http://2130706433/','BASH_EGRESS_IP_LITERAL'],
  ['http://private.example/','BASH_EGRESS_ADDRESS'],['http://rebind.example/','BASH_EGRESS_ADDRESS'],['http://mapped.example/','BASH_EGRESS_ADDRESS'],['http://records.example:8080/','BASH_EGRESS_PORT'],
  ['http://localhost/','BASH_EGRESS_DESTINATION'],['http://cdn.example/','BASH_EGRESS_DESTINATION'],['http://records.example.evil.example/','BASH_EGRESS_DESTINATION']];
 for(const [url,code] of cases){const r=await get(proxy,url);assert.equal(r.status,403,url);assert.equal(r.headers[PROXY_REFUSAL_HEADER],code,url);}
 assert.deepEqual(dials,[]);assert.deepEqual(lookups,['private.example','rebind.example','mapped.example'],'IP literals and unlisted names are never resolved');
});

test('the Host header must name the target authority, so an admitted address cannot be asked for another site',async t=>{
 const {proxy,dials}=await fixture(t);
 const r=await get(proxy,'http://records.example/',{host:'unlisted.example'});
 assert.equal(r.status,403);assert.equal(r.headers[PROXY_REFUSAL_HEADER],'EGRESS_HOST_MISMATCH');assert.deepEqual(dials,[]);
});

test('a DNS answer that changes after admission cannot move the admitted connection; the next admission is decided afresh',async t=>{
 let n=0;const table={...TABLE,'records.example':()=>++n===1?['93.184.215.14']:['127.0.0.1']};
 const {proxy,dials}=await fixture(t,{table});
 const first=await tunnel(proxy,'records.example:443');assert.equal(first.status,200);assert.equal(await roundTrip(first.socket,'ping'),'ping');
 const second=await tunnel(proxy,'records.example:443');assert.equal(second.status,403);assert.equal(second.refusal,'BASH_EGRESS_ADDRESS');
 assert.deepEqual(dials,['93.184.215.14:443']);first.socket.destroy();
});

test('CONNECT admits only allowlisted names on 443/80; wildcard entries admit subdomains, never the apex',async t=>{
 const {proxy,dials}=await fixture(t);
 const ok=await tunnel(proxy,'api.cdn.example:443');assert.equal(ok.status,200);assert.equal(await roundTrip(ok.socket,'tls-bytes'),'tls-bytes');ok.socket.destroy();
 for(const [authority,code] of [['cdn.example:443','BASH_EGRESS_DESTINATION'],['records.example:22','BASH_EGRESS_PORT'],['93.184.215.14:443','BASH_EGRESS_IP_LITERAL'],['[2606:2800:21f:cb07:6820:80da:af6b:8b2c]:443','BASH_EGRESS_IP_LITERAL']]){
  const r=await tunnel(proxy,authority);assert.equal(r.status,403,authority);assert.equal(r.refusal,code,authority);}
 assert.deepEqual(dials,['93.184.215.21:443']);
 assert.equal(domainAllowed(['*.cdn.example'],'a.b.cdn.example'),true);assert.equal(domainAllowed(['*.cdn.example'],'xcdn.example'),false);assert.equal(domainAllowed(['*.cdn.example'],'cdn.example'),false);
});

test('SOCKS5 admits only CONNECT by allowlisted name; address-type requests, other commands and auth-only clients are refused',async t=>{
 const {proxy,dials}=await fixture(t);
 const ok=await socks(proxy);assert.equal(ok.reply,0);assert.equal(await roundTrip(ok.socket,'socks-bytes'),'socks-bytes');ok.socket.destroy();
 const literal=await socks(proxy,{atyp:1,host:'93.184.215.14'});assert.equal(literal.reply,2,'IPv4 literal refused by ruleset');literal.socket.destroy();
 const v6=await socks(proxy,{atyp:4});assert.equal(v6.reply,2);v6.socket.destroy();
 const unlisted=await socks(proxy,{host:'unlisted.example'});assert.equal(unlisted.reply,2);unlisted.socket.destroy();
 const bind=await socks(proxy,{cmd:2});assert.equal(bind.reply,7,'BIND is not supported');bind.socket.destroy();
 const auth=await socks(proxy,{methods:[2]});assert.equal(auth.method,0xff);auth.socket.destroy();
 assert.deepEqual(dials,['93.184.215.14:443']);
});

test('revocation refuses every later admission and destroys tunnels that are already open; expiry refuses too',async t=>{
 const {proxy,dials}=await fixture(t);
 const open=await tunnel(proxy,'records.example:443');assert.equal(open.status,200);
 const closed=once(open.socket,'close');proxy.revoke();await closed;
 const after=await tunnel(proxy,'records.example:443').catch(e=>({error:e.code}));
 assert.ok(after.error||after.status===403,'no tunnel after revocation');assert.deepEqual(dials,['93.184.215.14:443']);
 let now=clock();const expiring=createBashEgressControl({domains:DOMAINS,resolve:async()=>['93.184.215.14'],now:()=>now,expiresAtMs:clock()+10});
 assert.equal((await expiring.admit({host:'records.example',port:443})).ok,true);now+=10;
 assert.deepEqual(await expiring.admit({host:'records.example',port:443}),{ok:false,code:'BASH_EGRESS_EXPIRED'});
 expiring.revoke();assert.deepEqual(await expiring.admit({host:'records.example',port:443}),{ok:false,code:'BASH_EGRESS_REVOKED'});
});

test('the browser run control is enforced by the same proxy: allowlisted origins tunnel, unlisted and non-public ones do not',async t=>{
 const policy=validateBrowserPolicy(enabledPolicy({allowedOrigins:['https://records.example']}));
 const grant=createEgressGrant({binding,policy,expiresAtMs:clock()+60000});
 const control=createEgressControl({grant,resolve:async name=>TABLE[name]??[],now:clock});
 const {proxy,dials}=await fixture(t,{control});
 const ok=await tunnel(proxy,'records.example:443');assert.equal(ok.status,200);ok.socket.destroy();
 const unlisted=await tunnel(proxy,'unlisted.example:443');assert.equal(unlisted.status,403);assert.equal(unlisted.refusal,'BROWSER_ORIGIN_NOT_ALLOWED');
 const metadata=await get(proxy,'http://169.254.169.254/');assert.equal(metadata.status,403);
 assert.deepEqual(dials,['93.184.215.14:443']);
 await assert.rejects(startEgressProxy({control,socksPort:0}),e=>e.code==='EGRESS_PROXY_CONFIGURATION','no SOCKS listener for a control without SOCKS admission');
});

test('the proxy listens on loopback only, dials IP literals only, and the Bash runtime fact binds its ports to the domain list',async t=>{
 const control=createBashEgressControl({domains:DOMAINS,resolve:async()=>[],now:clock,expiresAtMs:clock()+1});
 await assert.rejects(startEgressProxy({control,host:'0.0.0.0'}),e=>e.code==='EGRESS_PROXY_CONFIGURATION');
 assert.throws(()=>dialAddress({address:'records.example',port:443}),e=>e.code==='EGRESS_DIAL_REFUSED');
 const {fact,proxy}=await startBashEgress({domains:['records.example'],expiresAtMs:clock()+60000,now:clock,resolve:async()=>['93.184.215.14'],dial:()=>{throw new Error('no dial in this case');}});
 t.after(()=>proxy.close());
 assert.equal(fact.schema,BASH_EGRESS_SCHEMA);assert.equal(fact.domainsSha256,bashEgressDomainsSha256(['records.example']));
 assert.ok(Number.isSafeInteger(fact.httpProxyPort)&&Number.isSafeInteger(fact.socksProxyPort)&&fact.httpProxyPort!==fact.socksProxyPort);
 await assert.rejects(startBashEgress({domains:[],expiresAtMs:clock()+1}),e=>e.code==='BASH_EGRESS_CONFIGURATION','an empty list starts no proxy: the sandbox then has no network');
 assert.throws(()=>createBashEgressControl({domains:['10.0.0.1'],resolve:async()=>[],now:clock,expiresAtMs:1}),e=>e.code==='BASH_EGRESS_CONFIGURATION');
});
