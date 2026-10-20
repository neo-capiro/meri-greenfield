import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import {connect} from 'node:net';
import {serve} from '@hono/node-server';
import {listenRuntime,RUNTIME_KEEP_ALIVE_MS} from '../http-server.mjs';

const configuration={http:{hostname:'127.0.0.1',port:0,frontendOrigin:'https://ui.synthetic.invalid'},limits:{requestMs:25000,shutdownMs:1000}};
const application={async handle(){return new Response(null,{status:204});}};

test('idle keep-alive outlives the private ALB idle timeout, so the load balancer closes idle sockets first',async()=>{
 const template=readFileSync(new URL('../../../infra/product-preview/first-chat-private-edge.mjs',import.meta.url),'utf8');
 const idle=/'idle_timeout\.timeout_seconds',value:'(\d+)'/u.exec(template);assert.ok(idle,'the private edge declares its ALB idle timeout');
 const server=new EventEmitter();Object.assign(server,{listening:true,address:()=>({port:0}),close(callback){callback();},closeIdleConnections(){}});
 const listener=await listenRuntime({configuration,application,readiness:async()=>{},testOwners:{serve(){return server;}}});
 try{assert.equal(server.keepAliveTimeout,RUNTIME_KEEP_ALIVE_MS);assert.ok(RUNTIME_KEEP_ALIVE_MS>Number(idle[1])*1000,'listener keep-alive must exceed the ALB idle timeout');}
 finally{await listener.close();}
});

// Node 24 closes an idle socket one second after keepAliveTimeout, so the former 1 s setting closed it after about 2 s.
test('a real idle keep-alive connection stays open past the former close and is reused',async()=>{
 const listener=await listenRuntime({configuration,application,readiness:async()=>{}});
 const socket=connect(listener.address.port,'127.0.0.1');let closed=false,received='';socket.on('close',()=>{closed=true;});socket.setEncoding('utf8');socket.on('data',chunk=>{received+=chunk;});
 const request=()=>socket.write('GET /health/live HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: keep-alive\r\n\r\n');
 const answered=async count=>{while((received.match(/HTTP\/1\.1 200/gu)??[]).length<count&&!closed)await new Promise(resolve=>setTimeout(resolve,20));};
 try{
  await new Promise(resolve=>socket.once('connect',resolve));request();await answered(1);
  await new Promise(resolve=>setTimeout(resolve,3000));assert.equal(closed,false,'the idle socket outlived the former keep-alive');
  request();await answered(2);assert.equal((received.match(/HTTP\/1\.1 200/gu)??[]).length,2,'the same connection served a second request');
 }finally{socket.destroy();await listener.close();}
});

// Once close() has begun, a connection must not outlive the responses it has in flight. Kept alive, it holds the listener open for
// the whole keep-alive timeout, so close() ends only on its shutdown timer: the moment the runner's cleanup lifetime (also
// shutdownMs) expires, which it reports as REMOTE_RUNNER_CLEANUP_UNKNOWN.
const stopping={...configuration,limits:{...configuration.limits,shutdownMs:5000}};
async function keptAlive(port){const socket=connect(port,'127.0.0.1'),state={received:''},closed=new Promise(resolve=>socket.once('close',resolve));
 socket.setEncoding('utf8');socket.on('data',chunk=>{state.received+=chunk;});await new Promise(resolve=>socket.once('connect',resolve));
 socket.write('GET /work HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: keep-alive\r\n\r\n');return {socket,state,closed};}
async function closesAtOnce(closing,client){
 const started=Date.now(),receipt=await closing,ms=Date.now()-started;
 assert.equal(receipt.listenerStopped,true,'the listener stopped, not the shutdown timer');assert.ok(ms<2000,`close resolved after ${ms} ms`);
 assert.equal(await Promise.race([client.closed.then(()=>true),new Promise(resolve=>setTimeout(resolve,2000,false))]),true,'its connection was closed');
 assert.match(client.state.received,/^HTTP\/1\.1 204 /u,'the response in flight was delivered first');
}

test('a kept-alive connection whose response starts after close() began is closed with it, and close resolves at once',async()=>{
 const entered=Promise.withResolvers(),release=Promise.withResolvers();
 const listener=await listenRuntime({configuration:stopping,readiness:async()=>{},
  application:{async handle(){entered.resolve();await release.promise;return new Response(null,{status:204});}}});
 const client=await keptAlive(listener.address.port);
 try{await entered.promise;const closing=listener.close();release.resolve();await closesAtOnce(closing,client);
  assert.match(client.state.received,/\r\nconnection: close\r\n/iu,'a response begun after close() says connection: close');}
 finally{client.socket.destroy();}
});

test('a kept-alive connection whose response ends after close() began is closed with it, and close resolves at once',async()=>{
 let listener,closing;
 // close() begins between the response's head, which went out kept alive, and its end.
 const serveEndingAfterClose=options=>{const server=serve(options);server.on('request',(request,response)=>{const end=response.end;
  response.end=function(...args){closing??=listener.close();setImmediate(()=>end.apply(this,args));return this;};});return server;};
 listener=await listenRuntime({configuration:stopping,readiness:async()=>{},application:{async handle(){return new Response(null,{status:204});}},
  testOwners:{serve:serveEndingAfterClose}});
 const client=await keptAlive(listener.address.port);
 try{while(!closing)await new Promise(resolve=>setTimeout(resolve,5));await closesAtOnce(closing,client);
  assert.match(client.state.received,/\r\nconnection: keep-alive\r\n/iu,'its head went out kept alive');}
 finally{client.socket.destroy();}
});
