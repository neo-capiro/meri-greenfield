import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:https';
import {createServer as createTcpServer} from 'node:net';
import {X509Certificate} from 'node:crypto';
import {once} from 'node:events';
import {operatorObserverEndpoint,createOperatorObserverPost} from '../native-observer-transport.mjs';
import {sha256Der} from '../../worker/conversation/host/control/tls.mjs';
import {NATIVE_OBSERVER_ORIGIN,OBSERVER_BODY_BYTES} from '../native-observer-http.mjs';
import {NATIVE_OBSERVER_ROUTE} from '../../../packages/contracts/native-observer.mjs';
import {observerTransportPki} from './native-observer-transport.fixture.mjs';
const pki=observerTransportPki(),name=new URL(NATIVE_OBSERVER_ORIGIN).hostname;
const endpoint=()=>({address:'10.0.0.7',port:443,serverName:name,serverFingerprintSha256:sha256Der(new X509Certificate(pki.good.cert).raw)});
const payload={body:Buffer.from('{"unchanged":"signed-body"}'),headers:{'content-type':'application/json','x-meri-observer-mac':'original-mac'},ca:Buffer.from(pki.ca)};
async function server(t,leaf,handle){
 const s=createServer({...leaf,minVersion:'TLSv1.3'},handle);s.on('tlsClientError',()=>{});
 s.listen(0,'127.0.0.1');await once(s,'listening');t.after(()=>{s.closeAllConnections();return new Promise(r=>s.close(r));});return s;
}
// Keep actual TLS/hostname/chain/leaf checks. Only the test TCP destination moves to
// an ephemeral loopback port so this test needs neither a private interface nor root.
function localRequest(s,seen){return (options,callback)=>{
 seen.push(options);assert.equal(options.hostname,'10.0.0.7');assert.equal(options.port,443);
 assert.equal(options.servername,name);assert.equal(options.headers.host,name);assert.equal(options.agent,false);
 return request({...options,hostname:'127.0.0.1',port:s.address().port},callback);
};}
test('operator endpoint is closed, private IPv4 only, exact 443/name/canonical pin',()=>{
 assert.deepEqual(operatorObserverEndpoint(endpoint()),endpoint());
 for(const change of [e=>e.address='127.0.0.1',e=>e.address='8.8.8.8',e=>e.address='https://10.0.0.7',e=>e.address='::1',
  e=>e.port=444,e=>e.serverName='other.example',e=>e.serverFingerprintSha256='A'.repeat(64),e=>delete e.port,e=>e.extra=true]){
  const e=endpoint();change(e);assert.throws(()=>operatorObserverEndpoint(e));
 }
});
test('real TLS carries fixed SNI/Host/route and unchanged signed bytes only after valid case CA and leaf',async t=>{
 let received=0;const seen=[];
 const s=await server(t,pki.good,async(req,res)=>{
  received++;assert.equal(req.socket.servername,name);assert.equal(req.headers.host,name);assert.equal(req.url,NATIVE_OBSERVER_ROUTE);
  assert.equal(req.method,'POST');assert.equal(req.headers['x-meri-observer-mac'],'original-mac');
  const chunks=[];for await(const c of req)chunks.push(c);assert.deepEqual(Buffer.concat(chunks),payload.body);
  res.writeHead(200,{'content-type':'application/json'}).end('{"disposition":"pending"}');
 });
 const post=createOperatorObserverPost(endpoint(),{request:localRequest(s,seen)});
 assert.deepEqual(await post(payload),{disposition:'pending'});assert.equal(received,1);assert.equal(seen.length,1);
});
test('real handshake rejects foreign CA, wrong SAN, wrong leaf and expired certificate before HTTP/HMAC bytes',async t=>{
 for(const [leaf,ca,pin] of [[pki.good,pki.otherCa,null],[pki.wrongName,pki.ca,null],[pki.good,pki.ca,'0'.repeat(64)],[pki.expired,pki.ca,null]]){
  let received=0;const seen=[];const s=await server(t,leaf,(_req,res)=>{received++;res.end();});
  const e=endpoint();if(pin)e.serverFingerprintSha256=pin;
  const post=createOperatorObserverPost(e,{request:localRequest(s,seen)});
  await assert.rejects(post({...payload,ca:Buffer.from(ca)}));assert.equal(received,0);assert.equal(seen.length,1);
 }
});
test('redirects and oversized replies fail once without discovery, retry or default transport fallback',async t=>{
 for(const mode of ['redirect','large']){
  const seen=[];const s=await server(t,pki.good,(_req,res)=>{
   if(mode==='redirect')res.writeHead(302,{location:'https://production.invalid'}).end();
   else res.writeHead(200,{'content-type':'application/json'}).end('x'.repeat(OBSERVER_BODY_BYTES+1));
  });
  await assert.rejects(createOperatorObserverPost(endpoint(),{request:localRequest(s,seen)})(payload));assert.equal(seen.length,1);
 }
});
test('cancellation bounds a stalled TLS handshake; no alternate connection',async t=>{
 const sockets=new Set(),s=createTcpServer(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
 s.listen(0,'127.0.0.1');await once(s,'listening');t.after(()=>{for(const socket of sockets)socket.destroy();return new Promise(r=>s.close(r));});
 const seen=[],signal=AbortSignal.timeout(100);
 await assert.rejects(createOperatorObserverPost(endpoint(),{request:localRequest(s,seen)})({...payload,signal}));assert.equal(seen.length,1);
});
