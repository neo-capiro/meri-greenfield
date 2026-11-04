import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {IncomingMessage,ServerResponse} from 'node:http';
import {Socket} from 'node:net';
import {getRequestListener} from '@hono/node-server';
import {listenRuntime} from '../http-server.mjs';
import {assertTemporalRuntimeCleanup} from '../temporal-runtime-fence.mjs';

test('actual HTTP shutdown retains an abort-ignoring borrowed handler after its socket is stopped',async()=>{
 let fetch,release,entered,observedAbort=false;
 const pending=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{entered=resolve;});
 const server=new EventEmitter();Object.assign(server,{listening:true,address:()=>({port:0}),close(callback){this.listening=false;callback();this.emit('close');},closeIdleConnections(){}});
 const listener=await listenRuntime({configuration:{http:{hostname:'127.0.0.1',port:0,frontendOrigin:'https://ui.synthetic.invalid'},limits:{requestMs:100,shutdownMs:100}},
  application:{async handle(request){request.signal.addEventListener('abort',()=>{observedAbort=true;},{once:true});entered();await pending;return new Response(null,{status:204});}},readiness:async()=>{},
  testOwners:{serve(options){fetch=options.fetch;return server;}}});
 const response=fetch(new Request('http://127.0.0.1/api/conversations',{method:'POST'}));await started;
 const receipt=await listener.close();assert.equal(observedAbort,true);assert.equal(receipt.listenerStopped,true);assert.equal(receipt.pendingRequests,1);
 assert.throws(()=>assertTemporalRuntimeCleanup([{status:'fulfilled',value:receipt}]),{code:'TEMPORAL_PRODUCT_CLEANUP_UNKNOWN'});
 release();assert.equal((await response).status,204);
});

test('shutdown preserves a synchronous Hono malformed-URL refusal without rewriting its sent headers',async()=>{
 // An accepted connection can deliver a queued request during drain. Hono refuses this URL before its Fetch callback,
 // and writes the real Node response synchronously, before the runtime's later request observer receives the event.
 let stopped,handled=0;
 const server=new EventEmitter();Object.assign(server,{listening:true,address:()=>({port:0}),close(callback){stopped=callback;},closeIdleConnections(){}});
 const listener=await listenRuntime({configuration:{http:{hostname:'127.0.0.1',port:0,frontendOrigin:'https://ui.synthetic.invalid'},limits:{requestMs:100,shutdownMs:1000}},
  application:{async handle(){handled++;return new Response(null,{status:204});}},readiness:async()=>{},
  testOwners:{serve(options){server.on('request',getRequestListener(options.fetch,{hostname:options.hostname,overrideGlobalObjects:false}));return server;}}});
 const socket=new Socket(),incoming=new IncomingMessage(socket);incoming.method='GET';incoming.url='http://[';incoming.headers={host:'127.0.0.1'};
 const outgoing=new ServerResponse(incoming);server.emit('connection',socket);const closing=listener.close();
 try{
  assert.doesNotThrow(()=>server.emit('request',incoming,outgoing));
  assert.equal(outgoing.statusCode,400);assert.equal(outgoing.headersSent,true);assert.equal(handled,0);
 }finally{outgoing.emit('close');socket.destroy();stopped();}
 const receipt=await closing;assert.deepEqual(receipt,{listenerStopped:true,pendingRequests:0});
});
